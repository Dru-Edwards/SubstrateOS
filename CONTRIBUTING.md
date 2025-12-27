# Contributing to SubstrateOS

Thank you for your interest in contributing to SubstrateOS! This guide will help you get started.

## Development Setup

```bash
# Clone the repository
git clone https://github.com/edwards-tech/substrateos.git
cd substrateos

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Start development server
cd web-demo && pnpm dev
```

## Running Tests

```bash
# Run all E2E tests
cd web-demo
pnpm test:e2e

# Run specific test file
pnpm test:e2e app.spec.ts

# Run with UI
pnpm test:e2e --ui
```

---

## Adding a New Command

Commands are defined in `packages/runtime-sdk/src/shell/commands.ts`.

### 1. Add Your Command

```typescript
// In builtinCommands object:
mycommand: (args, ctx) => {
  // args: string[] - command arguments
  // ctx: CommandContext - provides fs, env, write functions
  
  ctx.writeln('Hello from my command!');
  ctx.writeln(`Arguments: ${args.join(', ')}`);
  
  // Return exit code
  return { exitCode: 0 };
},
```

### 2. Add to Help

Update the `help` command to include your new command:

```typescript
ctx.writeln('  mycommand           Description of my command');
```

### 3. Test It

```bash
pnpm build
cd web-demo && pnpm dev
# In terminal: mycommand arg1 arg2
```

---

## Adding a New Lesson

Lessons are interactive tutorials that guide users through commands.

### 1. Create the Lesson Command

```typescript
// In commands.ts
myLesson: (args, ctx) => {
  ctx.writeln('');
  ctx.writeln('\x1b[1;36m╔══════════════════════════════════════╗\x1b[0m');
  ctx.writeln('\x1b[1;36m║     My Awesome Lesson               ║\x1b[0m');
  ctx.writeln('\x1b[1;36m╚══════════════════════════════════════╝\x1b[0m');
  ctx.writeln('');
  ctx.writeln('\x1b[1;33mStep 1: Introduction\x1b[0m');
  ctx.writeln('  Welcome to this lesson!');
  ctx.writeln('  Try running: \x1b[1mls\x1b[0m');
  ctx.writeln('');
  // ... more steps
  return { exitCode: 0 };
},
```

### 2. Add to Tutorial Menu

Update the `tutorial` command to list your lesson.

---

## Adding a New Extension

Extensions are more complex features packaged as classes.

### 1. Create Extension File

```typescript
// packages/runtime-sdk/src/extensions/examples/my-extension.ts

import type { CommandHandler, CommandContext } from '../../shell';

export class MyExtension {
  private state: Map<string, unknown> = new Map();

  getCommands(): Record<string, CommandHandler> {
    return {
      myext: this.handleCommand.bind(this),
    };
  }

  private handleCommand: CommandHandler = (args, ctx) => {
    const subcmd = args[0];
    
    switch (subcmd) {
      case 'help':
        ctx.writeln('MyExtension - Does cool things');
        break;
      case 'do':
        ctx.writeln('Doing the thing...');
        break;
      default:
        ctx.writeError('Unknown subcommand');
        return { exitCode: 1 };
    }
    
    return { exitCode: 0 };
  };
}

export function createMyExtension(): MyExtension {
  return new MyExtension();
}
```

### 2. Register in Commands

```typescript
// In commands.ts
import { MyExtension } from '../extensions/examples/my-extension';

const myExtension = new MyExtension();
const myExtCommands = myExtension.getCommands();

// In builtinCommands:
myext: myExtCommands.myext,
```

---

## Code Style

- **TypeScript** - Strict mode enabled
- **Formatting** - Use Prettier defaults
- **Naming** - camelCase for functions, PascalCase for classes
- **Comments** - JSDoc for public APIs

## Commit Messages

Follow conventional commits:

```
feat: add new cowsay command
fix: resolve filesystem persistence issue
docs: update README quickstart
test: add E2E tests for sql command
```

## Pull Request Process

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Make your changes
4. Run tests: `pnpm test:e2e`
5. Commit with descriptive message
6. Push and open a PR

## Questions?

- Open an issue for bugs or feature requests
- Start a discussion for questions

---

**Thank you for contributing!** 🎉
