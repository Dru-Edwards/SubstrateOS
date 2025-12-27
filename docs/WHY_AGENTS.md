# Why SubstrateOS for AI Agents

## The Problem

Running AI agents is dangerous.

Giving them shell access is worse.

When you let an LLM execute arbitrary code on your machine, you're one hallucination away from:
- Deleted files
- Leaked secrets
- Infinite loops consuming resources
- Network requests you didn't authorize

Most sandboxing solutions require Docker, VMs, or complex infrastructure. That's overkill for agents that just need to run a Python script or query a database.

## The Solution

**SubstrateOS is an in-browser OS with Python, Node.js, SQLite, and a strict AgentSDK.**

Agents can run code without touching real machines.

- **Zero infrastructure** – Runs entirely in the browser via WebAssembly
- **Real languages** – Python 3.11 (Pyodide), Node.js (QuickJS), SQLite
- **Persistent workspace** – Files survive page reloads (IndexedDB)
- **OpenAI-compatible** – Tool definitions ready for function calling
- **Restriction modes** – Block dangerous commands, limit operations

## Features

| Feature | Description |
|---------|-------------|
| **Python Runtime** | Full CPython via Pyodide (~15MB WASM) |
| **Node.js Runtime** | QuickJS for lightweight JS execution |
| **SQLite Database** | Real SQL queries, persistent storage |
| **Virtual Filesystem** | /home/user, /tmp, file operations |
| **AgentSDK** | `exec()`, `readFile()`, `remember()`, `recall()` |
| **Tool Definitions** | Ready for OpenAI/Claude function calling |
| **Readonly Mode** | Agents can read but not write |
| **Restricted Mode** | Whitelist specific commands only |
| **Session Tracking** | Log all commands and tool calls |

## Integration Example

```typescript
import { createAgent } from '@substrateos/runtime';

// Initialize agent with restrictions
const agent = createAgent(os, {
  agentId: 'gpt-4-agent',
  allowedCommands: ['ls', 'cat', 'python', 'sql'],
  maxCommands: 100,
});

// Get OpenAI-compatible tool definitions
const tools = agent.getToolDefinitions();

// Process tool calls from your LLM
async function handleToolCall(name: string, args: any) {
  switch (name) {
    case 'execute_command':
      return agent.exec(args.command);
    case 'read_file':
      return agent.readFile(args.path);
    case 'write_file':
      return agent.writeFile(args.path, args.content);
    case 'run_sql':
      return agent.exec(`sql ${args.query}`);
    case 'remember':
      return agent.remember(args.key, args.value);
    case 'recall':
      return agent.recall(args.key);
  }
}

// Example: Agent runs Python
await handleToolCall('execute_command', {
  command: 'python -c "print(2 + 2)"'
});
// Output: 4

// Example: Agent queries database
await handleToolCall('run_sql', {
  query: 'SELECT COUNT(*) FROM users'
});
```

## Use Cases

### 1. Code Execution Sandbox
Let agents write and run code safely.

```
Agent: "I'll calculate the factorial of 10"
Tool: execute_command { command: 'python -c "import math; print(math.factorial(10))"' }
Result: 3628800
```

### 2. Data Analysis
Query databases without risking production data.

```
Agent: "How many users signed up last week?"
Tool: run_sql { query: 'SELECT COUNT(*) FROM signups WHERE date > date("now", "-7 days")' }
Result: 142
```

### 3. Agent Memory
Persistent key-value storage across sessions.

```
Agent: "Remember that the user prefers dark mode"
Tool: remember { key: 'user_preference_theme', value: 'dark' }
...later...
Tool: recall { key: 'user_preference_theme' }
Result: dark
```

### 4. File Workspace
Create, edit, and manage files.

```
Agent: "Create a config file"
Tool: write_file { path: '/home/user/config.json', content: '{"debug": true}' }
```

## What SubstrateOS Is NOT

- ❌ A full Linux distribution
- ❌ A replacement for Docker
- ❌ A way to run native ELF binaries
- ❌ A production server environment
- ❌ A multi-user system

## Getting Started

### Embed in your app

```html
<iframe src="https://substrateos.dev/embed?readonly=true" />
```

### Use the SDK

```bash
npm install @substrateos/runtime
```

```typescript
import { SubstrateOS, createAgent } from '@substrateos/runtime';

const os = new SubstrateOS();
await os.boot();

const agent = createAgent(os, 'restricted');
await agent.exec('echo "Hello from the sandbox"');
```

## License

Apache 2.0 – Use it commercially, fork it, embed it.

---

**SubstrateOS** – Safe execution for AI agents.
