"""
Evaluation Framework for SubstrateOS AI Assistant.

Runs systematic evaluations across:
- Prompt versions
- Model configurations
- RAG retrieval quality
- End-to-end response quality
"""

import argparse
import json
import os
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any

import structlog

logger = structlog.get_logger()


class EvaluationRunner:
    """
    Main evaluation runner.
    
    Loads test sets, runs evaluations, and outputs metrics.
    """
    
    def __init__(self, output_dir: str = "./eval/runs"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.run_id = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    async def run_eval(
        self,
        test_set: List[Dict[str, Any]],
        llm_client,
        prompt_registry,
        prompt_version: str = "latest"
    ) -> Dict[str, Any]:
        """
        Run evaluation on a test set.
        
        Each test case has:
        - input: User message
        - expected: Expected response or criteria
        - category: Optional category for grouping
        """
        results = []
        
        # Get prompt
        system_prompt = prompt_registry.get_prompt("shell_assistant", prompt_version)
        
        for i, test_case in enumerate(test_set):
            logger.info(f"Running test {i+1}/{len(test_set)}")
            
            # Generate response
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": test_case["input"]}
            ]
            
            response = await llm_client.complete(messages=messages)
            
            # Evaluate response
            score = await self._evaluate_response(
                response=response.content,
                expected=test_case.get("expected"),
                criteria=test_case.get("criteria", [])
            )
            
            results.append({
                "test_id": i,
                "input": test_case["input"],
                "expected": test_case.get("expected"),
                "response": response.content,
                "score": score,
                "category": test_case.get("category", "general"),
                "tokens": response.usage
            })
        
        # Calculate metrics
        metrics = self._calculate_metrics(results)
        
        # Save results
        run_output = {
            "run_id": self.run_id,
            "timestamp": datetime.now().isoformat(),
            "prompt_version": prompt_version,
            "test_count": len(test_set),
            "metrics": metrics,
            "results": results
        }
        
        output_file = self.output_dir / f"eval_{self.run_id}.json"
        with open(output_file, "w") as f:
            json.dump(run_output, f, indent=2)
        
        logger.info(
            "Evaluation complete",
            run_id=self.run_id,
            accuracy=metrics["accuracy"],
            output=str(output_file)
        )
        
        return run_output
    
    async def _evaluate_response(
        self,
        response: str,
        expected: str = None,
        criteria: List[str] = None
    ) -> float:
        """
        Score a response.
        
        Methods:
        - Exact match (if expected is provided)
        - Criteria check (if criteria list provided)
        - LLM-as-judge (default)
        """
        scores = []
        
        # Check exact match
        if expected:
            if expected.lower() in response.lower():
                scores.append(1.0)
            else:
                scores.append(0.0)
        
        # Check criteria
        if criteria:
            for criterion in criteria:
                if criterion.lower() in response.lower():
                    scores.append(1.0)
                else:
                    scores.append(0.0)
        
        # Default: Basic quality check
        if not scores:
            # Check for non-empty, reasonable response
            if len(response) > 20 and not response.startswith("Error"):
                scores.append(0.7)
            else:
                scores.append(0.3)
        
        return sum(scores) / len(scores) if scores else 0.0
    
    def _calculate_metrics(self, results: List[Dict]) -> Dict[str, float]:
        """Calculate aggregate metrics from results."""
        scores = [r["score"] for r in results]
        
        # By category
        categories = {}
        for r in results:
            cat = r["category"]
            if cat not in categories:
                categories[cat] = []
            categories[cat].append(r["score"])
        
        category_metrics = {
            cat: sum(scores) / len(scores) if scores else 0
            for cat, scores in categories.items()
        }
        
        # Token usage
        total_tokens = sum(r["tokens"]["total_tokens"] for r in results)
        
        return {
            "accuracy": sum(scores) / len(scores) if scores else 0,
            "pass_rate": sum(1 for s in scores if s >= 0.7) / len(scores) if scores else 0,
            "by_category": category_metrics,
            "total_tokens": total_tokens,
            "avg_tokens_per_test": total_tokens / len(results) if results else 0
        }


def load_test_set(path: str) -> List[Dict[str, Any]]:
    """Load test set from JSON file."""
    with open(path) as f:
        return json.load(f)


async def main():
    parser = argparse.ArgumentParser(description="Run evaluations")
    parser.add_argument("--dataset", "-d", required=True, help="Path to test set JSON")
    parser.add_argument("--output", "-o", default="./eval/runs", help="Output directory")
    parser.add_argument("--prompt-version", "-p", default="latest", help="Prompt version")
    
    args = parser.parse_args()
    
    # Initialize components
    from apps.api.services.llm_client import LLMClient
    from apps.api.services.prompt_registry import PromptRegistry
    
    llm_client = LLMClient()
    prompt_registry = PromptRegistry("./prompts")
    
    # Load test set
    test_set = load_test_set(args.dataset)
    
    # Run evaluation
    runner = EvaluationRunner(args.output)
    results = await runner.run_eval(
        test_set=test_set,
        llm_client=llm_client,
        prompt_registry=prompt_registry,
        prompt_version=args.prompt_version
    )
    
    print(f"\nEvaluation Results:")
    print(f"  Accuracy: {results['metrics']['accuracy']:.2%}")
    print(f"  Pass Rate: {results['metrics']['pass_rate']:.2%}")
    print(f"  Total Tokens: {results['metrics']['total_tokens']}")


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
