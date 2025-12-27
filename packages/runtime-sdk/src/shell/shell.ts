/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║               EDWARDS TECH INNOVATION                    ║
 * ╚══════════════════════════════════════════════════════════╝
 *  SubstrateOS Shell - Main Shell Implementation
 */

import { VirtualFileSystem } from './filesystem';
import { commands, CommandContext, CommandHandler } from './commands';

export interface ShellOptions {
  onOutput?: (text: string) => void;
  onPrompt?: (prompt: string) => void;
  persistKey?: string;
  write?: (text: string) => void;
  writeln?: (text: string) => void;
}

export interface ShellCallbacks {
  http?: (method: string, url: string, body?: string) => Promise<string>;
  store?: (op: 'get' | 'put' | 'delete' | 'list', key?: string, value?: string) => Promise<string>;
  logger?: (message: string) => void;
}

/**
 * SubstrateOS Shell - Interactive command interpreter
 */
export class SubstrateOSShell {
  private fs: VirtualFileSystem;
  private env: Map<string, string>;
  private history: string[] = [];
  private aliases: Map<string, string>;
  private isSudo = false;
  private outputBuffer = '';
  private options: ShellOptions;
  private callbacks: ShellCallbacks;
  private customCommands: Map<string, CommandHandler> = new Map();

  constructor(options: ShellOptions = {}, callbacks: ShellCallbacks = {}) {
    this.options = options;
    this.callbacks = callbacks;
    this.fs = new VirtualFileSystem({ persistKey: options.persistKey });
    
    // Initialize environment
    this.env = new Map([
      ['HOME', '/home/user'],
      ['USER', 'user'],
      ['SHELL', '/bin/sh'],
      ['PATH', '/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin'],
      ['PWD', '/home/user'],
      ['TERM', 'xterm-256color'],
      ['HOSTNAME', 'substrateos'],
      ['LANG', 'en_US.UTF-8'],
      ['PS1', '\\u@\\h:\\w\\$ '],
      ['EDITOR', 'nano'],
      ['PAGER', 'less'],
    ]);
    
    // Default aliases
    this.aliases = new Map([
      ['ll', 'ls -la'],
      ['la', 'ls -A'],
      ['l', 'ls -CF'],
      ['..', 'cd ..'],
      ['...', 'cd ../..'],
      ['cls', 'clear'],
      ['dir', 'ls'],
      ['md', 'mkdir'],
      ['rd', 'rmdir'],
      ['del', 'rm'],
      ['copy', 'cp'],
      ['move', 'mv'],
      ['ren', 'mv'],
      ['type', 'cat'],
    ]);

    // Register device commands
    this.registerDeviceCommands();
  }

  private registerDeviceCommands(): void {
    // HTTP command
    this.customCommands.set('http', async (args, ctx) => {
      if (args.length < 2) {
        ctx.writeError('Usage: http <METHOD> <URL> [body]');
        return { exitCode: 1 };
      }
      
      const method = args[0].toUpperCase();
      const url = args[1];
      const body = args.slice(2).join(' ');
      
      if (this.callbacks.http) {
        try {
          ctx.writeln(`\x1b[90mHTTP ${method} ${url}...\x1b[0m`);
          const result = await this.callbacks.http(method, url, body);
          ctx.writeln(result);
          return { exitCode: 0 };
        } catch (e) {
          ctx.writeError(`HTTP error: ${(e as Error).message}`);
          return { exitCode: 1 };
        }
      } else {
        ctx.writeError('HTTP device not available');
        return { exitCode: 1 };
      }
    });

    // Curl alias
    this.customCommands.set('curl', async (args, ctx) => {
      // Simple curl implementation
      let method = 'GET';
      let url = '';
      let data = '';
      
      for (let i = 0; i < args.length; i++) {
        if (args[i] === '-X' && args[i + 1]) {
          method = args[i + 1].toUpperCase();
          i++;
        } else if (args[i] === '-d' && args[i + 1]) {
          data = args[i + 1];
          i++;
        } else if (!args[i].startsWith('-')) {
          url = args[i];
        }
      }
      
      if (!url) {
        ctx.writeError('curl: no URL specified');
        return { exitCode: 1 };
      }
      
      return this.customCommands.get('http')!([method, url, data], ctx);
    });

    // Wget alias
    this.customCommands.set('wget', async (args, ctx) => {
      const url = args.filter(a => !a.startsWith('-'))[0];
      if (!url) {
        ctx.writeError('wget: missing URL');
        return { exitCode: 1 };
      }
      return this.customCommands.get('http')!(['GET', url], ctx);
    });

    // Store command
    this.customCommands.set('store', async (args, ctx) => {
      if (args.length === 0) {
        ctx.writeError('Usage: store <get|put|delete|list> [key] [value]');
        return { exitCode: 1 };
      }
      
      const op = args[0] as 'get' | 'put' | 'delete' | 'list';
      const key = args[1];
      const value = args.slice(2).join(' ');
      
      if (this.callbacks.store) {
        try {
          const result = await this.callbacks.store(op, key, value);
          if (result) ctx.writeln(result);
          return { exitCode: 0 };
        } catch (e) {
          ctx.writeError(`Store error: ${(e as Error).message}`);
          return { exitCode: 1 };
        }
      } else {
        ctx.writeError('Store device not available');
        return { exitCode: 1 };
      }
    });

    // Logger command
    this.customCommands.set('logger', (args, ctx) => {
      const message = args.join(' ');
      
      if (this.callbacks.logger) {
        this.callbacks.logger(message);
        ctx.writeln(`\x1b[90m[logged]\x1b[0m ${message}`);
        return { exitCode: 0 };
      } else {
        ctx.writeError('Logger device not available');
        return { exitCode: 1 };
      }
    });

    // Ping simulation
    this.customCommands.set('ping', async (args, ctx) => {
      const host = args.filter(a => !a.startsWith('-'))[0] || 'localhost';
      const count = args.includes('-c') ? parseInt(args[args.indexOf('-c') + 1], 10) : 4;
      
      ctx.writeln(`PING ${host} 56 data bytes`);
      
      for (let i = 0; i < count; i++) {
        const time = (Math.random() * 50 + 10).toFixed(3);
        await new Promise(r => setTimeout(r, 1000));
        ctx.writeln(`64 bytes from ${host}: icmp_seq=${i + 1} ttl=64 time=${time} ms`);
      }
      
      ctx.writeln('');
      ctx.writeln(`--- ${host} ping statistics ---`);
      ctx.writeln(`${count} packets transmitted, ${count} received, 0% packet loss`);
      
      return { exitCode: 0 };
    });
  }

  /**
   * Execute a command line
   */
  async execute(line: string): Promise<number> {
    const trimmed = line.trim();
    if (!trimmed) return 0;
    
    // Add to history
    this.history.push(trimmed);
    
    // Parse command line
    const { command, args, isSudo } = this.parseCommandLine(trimmed);
    
    if (!command) return 0;
    
    // Set sudo context
    const wasSudo = this.isSudo;
    if (isSudo) {
      this.isSudo = true;
    }
    
    try {
      // Create command context
      const ctx = this.createContext();
      
      // Look up command handler
      const handler = this.getCommandHandler(command);
      
      if (!handler) {
        this.output(`\x1b[31m${command}: command not found\x1b[0m\n`);
        this.output(`\x1b[90mTry 'help' to see available commands, or 'learn' to get started.\x1b[0m\n`);
        return 127;
      }
      
      // Execute command
      const result = await handler(args, ctx);
      
      // Flush output buffer
      if (this.outputBuffer) {
        if (this.options.onOutput) {
          this.options.onOutput(this.outputBuffer);
        }
        this.outputBuffer = '';
      }
      
      // Handle sudo wrapper
      if (result.output === '__SUDO__' && args.length > 0) {
        this.isSudo = true;
        const subResult = await this.execute(args.join(' '));
        this.isSudo = wasSudo;
        return subResult;
      }
      
      return result.exitCode;
      
    } finally {
      this.isSudo = wasSudo;
    }
  }

  private parseCommandLine(line: string): { command: string; args: string[]; isSudo: boolean } {
    // Handle pipes and redirects (basic support)
    // For now, just split on whitespace
    const tokens = this.tokenize(line);
    
    if (tokens.length === 0) {
      return { command: '', args: [], isSudo: false };
    }
    
    let command = tokens[0];
    let args = tokens.slice(1);
    let isSudo = false;
    
    // Expand alias
    if (this.aliases.has(command)) {
      const aliasTokens = this.tokenize(this.aliases.get(command)!);
      command = aliasTokens[0];
      args = [...aliasTokens.slice(1), ...args];
    }
    
    // Check for sudo
    if (command === 'sudo') {
      isSudo = true;
      command = args[0] || '';
      args = args.slice(1);
      
      // Expand alias for sudo command too
      if (this.aliases.has(command)) {
        const aliasTokens = this.tokenize(this.aliases.get(command)!);
        command = aliasTokens[0];
        args = [...aliasTokens.slice(1), ...args];
      }
    }
    
    return { command, args, isSudo };
  }

  private tokenize(line: string): string[] {
    const tokens: string[] = [];
    let current = '';
    let inQuote = '';
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (inQuote) {
        if (char === inQuote) {
          inQuote = '';
        } else {
          current += char;
        }
      } else if (char === '"' || char === "'") {
        inQuote = char;
      } else if (char === ' ' || char === '\t') {
        if (current) {
          tokens.push(current);
          current = '';
        }
      } else {
        current += char;
      }
    }
    
    if (current) {
      tokens.push(current);
    }
    
    return tokens;
  }

  private getCommandHandler(name: string): CommandHandler | null {
    // Check custom commands first
    if (this.customCommands.has(name)) {
      return this.customCommands.get(name)!;
    }
    
    // Check built-in commands
    if (commands[name]) {
      return commands[name];
    }
    
    // Check if it's an executable file
    const paths = (this.env.get('PATH') || '').split(':');
    for (const dir of paths) {
      const fullPath = `${dir}/${name}`;
      if (this.fs.exists(fullPath) && this.fs.isFile(fullPath)) {
        // Return a stub handler for "executable" files
        return (args, ctx) => {
          ctx.writeln(`\x1b[90m[stub] Would execute: ${fullPath} ${args.join(' ')}\x1b[0m`);
          return { exitCode: 0 };
        };
      }
    }
    
    return null;
  }

  private createContext(): CommandContext {
    return {
      fs: this.fs,
      env: this.env,
      write: (text) => this.output(text),
      writeln: (text) => this.output(text + '\n'),
      writeError: (text) => this.output(`\x1b[31m${text}\x1b[0m\n`),
      isSudo: this.isSudo,
      history: this.history,
      aliases: this.aliases,
    };
  }

  private output(text: string): void {
    // Use direct callbacks if available, otherwise buffer
    if (this.options.onOutput) {
      this.options.onOutput(text);
    } else {
      this.outputBuffer += text;
    }
  }

  /**
   * Get the current prompt string
   */
  getPrompt(): string {
    const user = this.isSudo ? 'root' : this.fs.getUser();
    const host = this.fs.getHostname();
    const cwd = this.fs.pwd();
    
    // Shorten home directory
    const home = this.env.get('HOME') || '/home/user';
    const displayCwd = cwd.startsWith(home) ? '~' + cwd.slice(home.length) : cwd;
    
    const symbol = this.isSudo ? '#' : '$';
    
    return `\x1b[1;32m${user}@${host}\x1b[0m:\x1b[1;34m${displayCwd}\x1b[0m${symbol} `;
  }

  /**
   * Get filesystem
   */
  getFileSystem(): VirtualFileSystem {
    return this.fs;
  }

  /**
   * Get environment
   */
  getEnv(): Map<string, string> {
    return this.env;
  }

  /**
   * Set environment variable
   */
  setEnv(key: string, value: string): void {
    this.env.set(key, value);
  }

  /**
   * Register a custom command
   */
  registerCommand(name: string, handler: CommandHandler): void {
    this.customCommands.set(name, handler);
  }

  /**
   * Get command history
   */
  getHistory(): string[] {
    return [...this.history];
  }

  /**
   * Clear the screen (returns clear escape sequence)
   */
  clear(): string {
    return '\x1b[2J\x1b[H';
  }

  /**
   * Show MOTD (message of the day)
   */
  getMotd(): string {
    return this.fs.readFile('/etc/motd') || '';
  }
}
