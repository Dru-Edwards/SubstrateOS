"""
AI Agent with tool use for SubstrateOS.

Implements a ReAct-style agent that can:
- Plan and reason about tasks
- Use tools to interact with the shell
- Handle errors gracefully
- Maintain conversation context
"""

import json
import os
from dataclasses import dataclass, field
from typing import AsyncGenerator, List, Dict, Any, Optional

import structlog

logger = structlog.get_logger()


@dataclass
class ToolCall:
    """A tool invocation."""
    name: str
    arguments: dict


@dataclass
class AgentStep:
    """A single step in agent execution."""
    step: int
    thought: str
    tool_call: Optional[ToolCall] = None
    tool_result: Optional[str] = None
    final_answer: Optional[str] = None
    error: Optional[str] = None
    
    def model_dump(self) -> dict:
        return {
            "step": self.step,
            "thought": self.thought,
            "tool_call": {"name": self.tool_call.name, "arguments": self.tool_call.arguments} if self.tool_call else None,
            "tool_result": self.tool_result,
            "final_answer": self.final_answer,
            "error": self.error
        }


@dataclass
class AgentResult:
    """Final agent result."""
    steps: List[AgentStep]
    final_answer: str
    tool_calls_count: int
    iterations: int


class Agent:
    """
    ReAct-style agent for SubstrateOS.
    
    Follows the pattern:
    1. Thought: Reason about the task
    2. Action: Choose a tool to use
    3. Observation: See the result
    4. Repeat or Answer
    """
    
    def __init__(
        self,
        llm_client,
        prompt_registry,
        rag_retriever=None
    ):
        self.llm = llm_client
        self.prompts = prompt_registry
        self.rag = rag_retriever
        self.tools = self._init_tools()
        
        # Safety settings
        self.max_iterations = int(os.getenv("AGENT_MAX_ITERATIONS", 10))
        self.timeout = int(os.getenv("AGENT_TIMEOUT_SECONDS", 30))
    
    def _init_tools(self) -> Dict[str, callable]:
        """Initialize available tools."""
        from agent.tools import (
            shell_execute,
            file_read,
            file_write,
            search_docs,
            list_directory
        )
        
        return {
            "shell_execute": shell_execute,
            "file_read": file_read,
            "file_write": file_write,
            "search_docs": search_docs,
            "list_directory": list_directory
        }
    
    async def run(
        self,
        task: str,
        context: dict = None,
        max_iterations: int = None
    ) -> AgentResult:
        """
        Run the agent to complete a task.
        """
        max_iterations = max_iterations or self.max_iterations
        steps = []
        tool_calls_count = 0
        
        # Get system prompt
        system_prompt = self.prompts.get_prompt("agent_planner", "latest")
        
        # Build tool descriptions
        tool_desc = self._format_tool_descriptions()
        
        messages = [
            {"role": "system", "content": system_prompt + "\n\n" + tool_desc},
            {"role": "user", "content": f"Task: {task}\n\nContext: {json.dumps(context or {})}"}
        ]
        
        for iteration in range(max_iterations):
            # Get next action from LLM
            response = await self.llm.complete(messages=messages, temperature=0.2)
            
            # Parse response
            step = self._parse_response(response.content, iteration + 1)
            steps.append(step)
            
            # Check for final answer
            if step.final_answer:
                return AgentResult(
                    steps=steps,
                    final_answer=step.final_answer,
                    tool_calls_count=tool_calls_count,
                    iterations=iteration + 1
                )
            
            # Execute tool if requested
            if step.tool_call:
                try:
                    result = await self._execute_tool(step.tool_call)
                    step.tool_result = result
                    tool_calls_count += 1
                except Exception as e:
                    step.error = str(e)
                    logger.error("Tool execution failed", tool=step.tool_call.name, error=str(e))
                
                # Add to conversation
                messages.append({
                    "role": "assistant",
                    "content": response.content
                })
                messages.append({
                    "role": "user",
                    "content": f"Observation: {step.tool_result or step.error}"
                })
        
        # Max iterations reached
        return AgentResult(
            steps=steps,
            final_answer="I was unable to complete the task within the allowed iterations.",
            tool_calls_count=tool_calls_count,
            iterations=max_iterations
        )
    
    async def run_stream(
        self,
        task: str,
        context: dict = None,
        max_iterations: int = None
    ) -> AsyncGenerator[AgentStep, None]:
        """
        Stream agent execution steps.
        """
        max_iterations = max_iterations or self.max_iterations
        
        system_prompt = self.prompts.get_prompt("agent_planner", "latest")
        tool_desc = self._format_tool_descriptions()
        
        messages = [
            {"role": "system", "content": system_prompt + "\n\n" + tool_desc},
            {"role": "user", "content": f"Task: {task}\n\nContext: {json.dumps(context or {})}"}
        ]
        
        for iteration in range(max_iterations):
            response = await self.llm.complete(messages=messages, temperature=0.2)
            step = self._parse_response(response.content, iteration + 1)
            
            if step.tool_call:
                try:
                    result = await self._execute_tool(step.tool_call)
                    step.tool_result = result
                except Exception as e:
                    step.error = str(e)
            
            yield step
            
            if step.final_answer:
                return
            
            messages.append({"role": "assistant", "content": response.content})
            messages.append({
                "role": "user",
                "content": f"Observation: {step.tool_result or step.error}"
            })
    
    def _format_tool_descriptions(self) -> str:
        """Format tool descriptions for the prompt."""
        lines = ["## Available Tools\n"]
        
        tool_docs = {
            "shell_execute": "Execute a shell command. Args: command (str)",
            "file_read": "Read a file's contents. Args: path (str)",
            "file_write": "Write content to a file. Args: path (str), content (str)",
            "search_docs": "Search documentation. Args: query (str)",
            "list_directory": "List files in directory. Args: path (str, default='.')"
        }
        
        for name in self.tools:
            lines.append(f"- **{name}**: {tool_docs.get(name, 'No description')}")
        
        return "\n".join(lines)
    
    def _parse_response(self, content: str, step_num: int) -> AgentStep:
        """Parse LLM response into a step."""
        thought = ""
        tool_call = None
        final_answer = None
        
        # Look for thought
        if "Thought:" in content:
            thought = content.split("Thought:")[1].split("\n")[0].strip()
        
        # Look for action
        if "Action:" in content:
            action_line = content.split("Action:")[1].split("\n")[0].strip()
            if "(" in action_line:
                name = action_line.split("(")[0].strip()
                args_str = action_line.split("(")[1].rstrip(")")
                # Parse simple args
                try:
                    args = json.loads("{" + args_str + "}")
                except:
                    args = {"input": args_str.strip("'\"") if args_str else ""}
                tool_call = ToolCall(name=name, arguments=args)
        
        # Look for final answer
        if "Final Answer:" in content:
            final_answer = content.split("Final Answer:")[1].strip()
        
        return AgentStep(
            step=step_num,
            thought=thought or content[:200],
            tool_call=tool_call,
            final_answer=final_answer
        )
    
    async def _execute_tool(self, tool_call: ToolCall) -> str:
        """Execute a tool with safety checks."""
        if tool_call.name not in self.tools:
            raise ValueError(f"Unknown tool: {tool_call.name}")
        
        tool_fn = self.tools[tool_call.name]
        
        # Execute with timeout
        import asyncio
        try:
            result = await asyncio.wait_for(
                tool_fn(**tool_call.arguments),
                timeout=self.timeout
            )
            return str(result)
        except asyncio.TimeoutError:
            raise TimeoutError(f"Tool {tool_call.name} timed out after {self.timeout}s")
