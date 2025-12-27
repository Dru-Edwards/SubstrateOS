# SubstrateOS

**The browser-native Linux playground for building, teaching, and experimenting.**

<p align="center">
  <img src="docs/screenshot.png" alt="SubstrateOS Terminal" width="700">
</p>

<p align="center">
  <a href="#-30-second-quickstart">Quickstart</a> •
  <a href="#-ai-agents">AI Agents</a> •
  <a href="#-playground">Playground</a> •
  <a href="#-teaching">Teaching</a> •
  <a href="#-embedding">Embedding</a> •
  <a href="#-contributing">Contributing</a>
</p>

<p align="center">
  <a href="https://edwardstech.lemonsqueezy.com/checkout/buy/52e14b1e-ba38-4f14-b1b2-a6b0e5397624" target="_blank">
    <img src="https://img.shields.io/badge/🍋_Get_SubstrateOS-Buy_Now-yellow?style=for-the-badge" alt="Buy SubstrateOS">
  </a>
</p>

---

## 💰 Get SubstrateOS

Choose the tier that fits your needs:

| Tier | Price | Features |
|------|-------|----------|
| **Free** | $0 | 75+ commands, SQLite, 50MB storage |
| **Developer** | $9/mo | Python, Node.js, Git, 200MB storage |
| **Pro** | $19/mo | AI Agent SDK, 11 tools, 500MB storage |
| **Classroom** | $299/yr | Instructor dashboard, 25 students |
| **Enterprise** | Custom | SSO, Audit, Compliance, SLA |

<a href="https://edwardstech.lemonsqueezy.com/checkout/buy/52e14b1e-ba38-4f14-b1b2-a6b0e5397624" class="lemonsqueezy-button">🍋 Buy SubstrateOS</a>

<!-- Embed Lemon Squeezy overlay on your site -->
```html
<a href="https://edwardstech.lemonsqueezy.com/checkout/buy/52e14b1e-ba38-4f14-b1b2-a6b0e5397624?embed=1" 
   class="lemonsqueezy-button">Buy SubstrateOS</a>
<script src="https://assets.lemonsqueezy.com/lemon.js" defer></script>
```

---

## ⚡ 30-Second Quickstart

```bash
# In your terminal, learn Linux basics:
learn

# Explore available packages:
apt list

# Try the built-in SQL database:
sql SELECT 1 + 1;
```

That's it. No install. No configuration. Just open and start learning.

---

## 🎯 What SubstrateOS IS

| ✅ IS | ❌ IS NOT |
|-------|----------|
| Browser-based Linux shell simulator | A real Linux kernel |
| Educational playground for learning commands | A production server environment |
| Safe sandbox for demos and tutorials | Access to your real filesystem |
| Embeddable widget for websites | Cloud-synced or multi-device |
| AI agent execution environment | A security-hardened container |

> **All data is stored locally in your browser.** No cloud. No server. Clearing browser data resets everything.

---

## 🎮 Playground

SubstrateOS is a fully-featured pseudo-Linux environment:

```bash
# Navigate the filesystem
ls -la /home/user
cd /etc && cat hostname

# Create and edit files
echo "Hello World" > hello.txt
cat hello.txt

# Developer tools
json parse '{"name": "SubstrateOS"}'
calc sqrt(16) + pow(2, 3)
uuid
sql CREATE TABLE users (id, name); SELECT * FROM users;

# Fun commands
cowsay "I love Linux!"
fortune
neofetch
```

**Features:**
- 🖥️ Full xterm.js terminal with history & tab completion
- 📁 Persistent virtual filesystem (IndexedDB)
- 🔧 50+ built-in commands
- 💾 Import/export workspaces
- 🔒 Multi-tab session locking

---

## 📚 Teaching

Perfect for Linux education without the risk of breaking anything:

```bash
# Interactive 10-minute Linux tutorial
learn

# Step-by-step guided lessons
tutorial

# SQL basics with live database
sql CREATE TABLE students (id, name, grade);
sql INSERT INTO students VALUES (1, 'Alice', 'A');
sql SELECT * FROM students;
```

**Use Cases:**
- **Bootcamps** - Teach Linux basics without VM setup
- **Classrooms** - Distribute lesson workspaces to students
- **Self-learners** - Practice commands safely
- **Documentation** - Embed live examples in docs

---

## 🤖 AI Agents

**SubstrateOS is a safe execution sandbox for AI agents.**

Drop this into your OpenAI / Anthropic agent pipeline:

```typescript
import { SubstrateOS, createAgent } from '@substrateos/runtime';

// Initialize the sandbox
const os = new SubstrateOS();
await os.boot();

// Create a restricted agent
const agent = createAgent(os, {
  agentId: 'gpt-4-agent',
  allowedCommands: ['ls', 'cat', 'python', 'sql', 'echo'],
  maxCommands: 100,
});

// Execute commands from your LLM
await agent.exec('python -c "print(2 + 2)"');
// Output: 4

await agent.exec('sql SELECT COUNT(*) FROM users');
// Output: | count | 42 |

// Store agent memory
await agent.remember('user_preference', 'dark_mode');
const pref = await agent.recall('user_preference');
```

**Tool Definition (OpenAI-compatible):**
```json
{
  "type": "function",
  "function": {
    "name": "execute_command",
    "description": "Execute a shell command in the SubstrateOS sandbox",
    "parameters": {
      "type": "object",
      "properties": {
        "command": { "type": "string" }
      },
      "required": ["command"]
    }
  }
}
```

**Why use SubstrateOS for agents?**
- ✅ **Zero infrastructure** – No Docker, no VMs, runs in browser
- ✅ **Real languages** – Python 3.11 (Pyodide), Node.js (QuickJS)
- ✅ **Persistent memory** – SQLite + key-value store
- ✅ **Safe by default** – Restrict commands, readonly modes
- ✅ **OpenAI-compatible** – Tool definitions ready to go

📖 [Read the full Agent integration guide →](docs/WHY_AGENTS.md)

---

## 🔗 Embedding

Embed SubstrateOS in any website:

```html
<!-- Simple iframe embed -->
<iframe 
  src="https://substrateos.dev/embed?lesson=linux-basics&readonly=true"
  width="800" 
  height="500"
></iframe>
```

**URL Presets:**
```
/embed?lesson=linux-basics    # Auto-run lesson
/embed?cmd=neofetch          # Run startup command
/embed?readonly=true         # Disable destructive commands
/embed?theme=light           # Light color theme
```

**SDK for full control:**
```javascript
import { SubstrateOS } from '@substrateos/embed';

const os = new SubstrateOS('#container', {
  initialCommands: ['learn'],
  safeMode: true,  // Disable rm, apt, etc.
});

os.exec('echo "Hello from host!"');
```

See [EMBEDDING.md](EMBEDDING.md) for full documentation.

---

## 🚀 Getting Started (Development)

### Prerequisites

- Node.js 18+
- pnpm 8+

### Installation

```bash
git clone https://github.com/edwards-tech/substrateos.git
cd substrateos
pnpm install
pnpm build
cd web-demo && pnpm dev
```

Open http://localhost:5173

## Project Structure

```
SubstrateOS/
├── packages/
│   ├── runtime-sdk/        # Core runtime and shell implementation
│   ├── device-protocols/   # Device bridge protocols
│   ├── embed-sdk/          # Embeddable SDK for integration
│   └── devkit-cli/         # CLI development tools
├── web-demo/               # Main web application demo
├── package.json            # Root workspace config
└── pnpm-workspace.yaml     # pnpm workspace definition
```

## 📋 Command Reference

### Core Commands
| Command | Description |
|---------|-------------|
| `learn` | 10-minute Linux tutorial |
| `tutorial` | Interactive guided lessons |
| `help` | Show all commands |
| `about` | About SubstrateOS |

### File System
| Command | Description |
|---------|-------------|
| `ls`, `ll` | List directory |
| `cd`, `pwd` | Navigate |
| `cat`, `head`, `tail` | View files |
| `mkdir`, `touch`, `rm` | Create/delete |
| `cp`, `mv` | Copy/move |

### Developer Tools
| Command | Description |
|---------|-------------|
| `sql <query>` | Execute SQL |
| `sqlite` | SQLite database |
| `json parse {...}` | Parse & format JSON |
| `calc 2+2` | Calculator |
| `uuid` | Generate UUID |
| `base64 encode/decode` | Base64 tools |
| `timestamp` | Unix timestamp |

### Workspace
| Command | Description |
|---------|-------------|
| `backup download` | Export workspace |
| `restore file` | Import workspace |
| `storage` | Storage status |
| `apt list` | Available packages |

### Fun
| Command | Description |
|---------|-------------|
| `cowsay <msg>` | ASCII cow |
| `fortune` | Random quote |
| `figlet <text>` | ASCII art |
| `neofetch` | System info |

## Development

### Build Packages

```bash
# Build all packages
pnpm build

# Build specific package
cd packages/runtime-sdk
pnpm build
```

### Run Tests

```bash
# Run all tests
pnpm test

# Run E2E tests
cd web-demo
pnpm test:e2e
```

### Start Dev Server

```bash
cd web-demo
pnpm dev
```

## Architecture

SubstrateOS consists of several key components:

1. **SubstrateOSRuntime** - Core runtime managing the shell and devices
2. **SubstrateOSShell** - Command interpreter with Unix-like shell features
3. **VirtualFileSystem** - In-memory filesystem with localStorage persistence
4. **Device Bridges** - Abstraction layer for HTTP, storage, and logging

## API Usage

### Embedding SubstrateOS

```typescript
import { SubstrateOSShell } from '@substrateos/runtime';

const shell = new SubstrateOSShell({
  persistKey: 'my-app',
  onOutput: (text) => console.log(text)
});

// Execute commands
await shell.execute('ls -la');
await shell.execute('echo "Hello World"');
```

---

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for:

- How to add a new command
- How to add a new lesson
- How to run tests

### Quick Contribution

```bash
# Fork & clone
git clone https://github.com/your-username/substrateos.git

# Install & build
pnpm install && pnpm build

# Run tests
cd web-demo && pnpm test:e2e

# Make changes & submit PR
```

---

## 📄 License

Apache-2.0 - See [LICENSE](LICENSE)

---

## 👤 Author

**Edwards Tech Innovation** - Andrew "Dru" Edwards

---

<p align="center">
  <sub>Built with ❤️ for developers, teachers, and curious minds.</sub>
</p>
