/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║               EDWARDS TECH INNOVATION                    ║
 * ╚══════════════════════════════════════════════════════════╝
 *  SubstrateOS Script Interpreter
 *  
 *  Basic shell script interpreter for .sh files.
 *  Supports a subset of POSIX shell syntax.
 */

import { CommandContext, CommandHandler, CommandResult } from '../shell/commands';
import { VirtualFileSystem } from '../shell/filesystem';

export interface ScriptContext {
  fs: VirtualFileSystem;
  env: Map<string, string>;
  args: string[];
  execute: (cmd: string) => Promise<number>;
  write: (text: string) => void;
  writeln: (text: string) => void;
}

/**
 * Shell Script Interpreter
 */
export class ShellScriptInterpreter {
  private variables: Map<string, string> = new Map();
  private functions: Map<string, string[]> = new Map();
  private exitCode = 0;

  constructor(private ctx: ScriptContext) {
    // Initialize special variables
    this.variables.set('0', ctx.args[0] || 'script');
    ctx.args.forEach((arg, i) => {
      this.variables.set(String(i), arg);
    });
    this.variables.set('#', String(ctx.args.length - 1));
    this.variables.set('@', ctx.args.slice(1).join(' '));
    this.variables.set('*', ctx.args.slice(1).join(' '));
    this.variables.set('?', '0');
    this.variables.set('$', String(Math.floor(Math.random() * 10000)));
    
    // Copy environment
    for (const [key, value] of ctx.env) {
      this.variables.set(key, value);
    }
  }

  /**
   * Execute a shell script
   */
  async execute(script: string): Promise<number> {
    const lines = this.parseScript(script);
    
    for (const line of lines) {
      const result = await this.executeLine(line);
      this.exitCode = result;
      this.variables.set('?', String(result));
      
      // Handle exit
      if (result === -1) {
        return this.exitCode;
      }
    }
    
    return this.exitCode;
  }

  /**
   * Parse script into executable lines
   */
  private parseScript(script: string): string[] {
    const lines: string[] = [];
    let current = '';
    let inString = false;
    let stringChar = '';
    
    for (const line of script.split('\n')) {
      const trimmed = line.trim();
      
      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }
      
      // Handle line continuations
      if (trimmed.endsWith('\\')) {
        current += trimmed.slice(0, -1) + ' ';
        continue;
      }
      
      current += trimmed;
      lines.push(current);
      current = '';
    }
    
    if (current) {
      lines.push(current);
    }
    
    return lines;
  }

  /**
   * Execute a single line
   */
  private async executeLine(line: string): Promise<number> {
    // Variable expansion
    line = this.expandVariables(line);
    
    // Parse the line
    const tokens = this.tokenize(line);
    if (tokens.length === 0) return 0;
    
    const cmd = tokens[0];
    const args = tokens.slice(1);
    
    // Handle built-in shell constructs
    switch (cmd) {
      case 'if':
        return this.handleIf(line);
      case 'for':
        return this.handleFor(line);
      case 'while':
        return this.handleWhile(line);
      case 'case':
        return this.handleCase(line);
      case 'function':
        return this.handleFunction(line);
      case 'return':
        return parseInt(args[0]) || 0;
      case 'exit':
        this.exitCode = parseInt(args[0]) || 0;
        return -1; // Signal exit
      case 'export':
        return this.handleExport(args);
      case 'local':
        return this.handleLocal(args);
      case 'set':
        return this.handleSet(args);
      case 'unset':
        return this.handleUnset(args);
      case 'read':
        return this.handleRead(args);
      case 'shift':
        return this.handleShift(args);
      case 'true':
        return 0;
      case 'false':
        return 1;
      case ':':
        return 0; // No-op
      case 'source':
      case '.':
        return this.handleSource(args);
      case 'eval':
        return this.executeLine(args.join(' '));
    }
    
    // Check for variable assignment
    if (cmd.includes('=') && !cmd.startsWith('=')) {
      return this.handleAssignment(cmd);
    }
    
    // Check for function call
    if (this.functions.has(cmd)) {
      return this.callFunction(cmd, args);
    }
    
    // Execute as regular command
    return this.ctx.execute(line);
  }

  /**
   * Expand variables in a string
   */
  private expandVariables(str: string): string {
    // Handle ${var} syntax
    str = str.replace(/\$\{(\w+)(?::([+-])([^}]*))?\}/g, (_, name, op, alt) => {
      const value = this.variables.get(name) || this.ctx.env.get(name) || '';
      
      if (op === '-') {
        return value || alt;
      } else if (op === '+') {
        return value ? alt : '';
      }
      
      return value;
    });
    
    // Handle $var syntax
    str = str.replace(/\$(\w+)/g, (_, name) => {
      return this.variables.get(name) || this.ctx.env.get(name) || '';
    });
    
    // Handle $? $$ $# etc
    str = str.replace(/\$([?$#@*!])/g, (_, char) => {
      return this.variables.get(char) || '';
    });
    
    return str;
  }

  /**
   * Tokenize a line
   */
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

  /**
   * Handle variable assignment
   */
  private handleAssignment(expr: string): number {
    const [name, ...rest] = expr.split('=');
    const value = rest.join('=');
    this.variables.set(name, value);
    return 0;
  }

  /**
   * Handle export command
   */
  private handleExport(args: string[]): number {
    for (const arg of args) {
      if (arg.includes('=')) {
        const [name, ...rest] = arg.split('=');
        const value = rest.join('=');
        this.variables.set(name, value);
        this.ctx.env.set(name, value);
      } else if (this.variables.has(arg)) {
        this.ctx.env.set(arg, this.variables.get(arg)!);
      }
    }
    return 0;
  }

  /**
   * Handle local command
   */
  private handleLocal(args: string[]): number {
    for (const arg of args) {
      if (arg.includes('=')) {
        this.handleAssignment(arg);
      } else {
        this.variables.set(arg, '');
      }
    }
    return 0;
  }

  /**
   * Handle set command
   */
  private handleSet(args: string[]): number {
    if (args.length === 0) {
      // Print all variables
      for (const [key, value] of this.variables) {
        this.ctx.writeln(`${key}=${value}`);
      }
    }
    return 0;
  }

  /**
   * Handle unset command
   */
  private handleUnset(args: string[]): number {
    for (const name of args) {
      this.variables.delete(name);
      this.ctx.env.delete(name);
    }
    return 0;
  }

  /**
   * Handle read command
   */
  private handleRead(args: string[]): number {
    // In browser environment, we can't really read input synchronously
    // Set empty values for the variables
    for (const name of args) {
      this.variables.set(name, '');
    }
    return 0;
  }

  /**
   * Handle shift command
   */
  private handleShift(args: string[]): number {
    const n = parseInt(args[0]) || 1;
    const currentArgs = this.variables.get('@')?.split(' ') || [];
    const shifted = currentArgs.slice(n);
    
    shifted.forEach((arg, i) => {
      this.variables.set(String(i + 1), arg);
    });
    
    this.variables.set('#', String(shifted.length));
    this.variables.set('@', shifted.join(' '));
    this.variables.set('*', shifted.join(' '));
    
    return 0;
  }

  /**
   * Handle source/. command
   */
  private async handleSource(args: string[]): Promise<number> {
    if (args.length === 0) return 1;
    
    const content = this.ctx.fs.readFile(args[0]);
    if (content === null) {
      this.ctx.writeln(`source: ${args[0]}: No such file or directory`);
      return 1;
    }
    
    return this.execute(content);
  }

  /**
   * Handle if statement (simplified)
   */
  private async handleIf(line: string): Promise<number> {
    // Simplified - just evaluate the condition
    this.ctx.writeln('\x1b[90m[script] if/then/fi blocks require multi-line parsing\x1b[0m');
    return 0;
  }

  /**
   * Handle for loop (simplified)
   */
  private async handleFor(line: string): Promise<number> {
    this.ctx.writeln('\x1b[90m[script] for loops require multi-line parsing\x1b[0m');
    return 0;
  }

  /**
   * Handle while loop (simplified)
   */
  private async handleWhile(line: string): Promise<number> {
    this.ctx.writeln('\x1b[90m[script] while loops require multi-line parsing\x1b[0m');
    return 0;
  }

  /**
   * Handle case statement (simplified)
   */
  private async handleCase(line: string): Promise<number> {
    this.ctx.writeln('\x1b[90m[script] case statements require multi-line parsing\x1b[0m');
    return 0;
  }

  /**
   * Handle function definition
   */
  private handleFunction(line: string): number {
    // function name { ... } or name() { ... }
    this.ctx.writeln('\x1b[90m[script] function definitions require multi-line parsing\x1b[0m');
    return 0;
  }

  /**
   * Call a defined function
   */
  private async callFunction(name: string, args: string[]): Promise<number> {
    const body = this.functions.get(name);
    if (!body) return 127;
    
    // Save current args
    const savedArgs = new Map(this.variables);
    
    // Set function args
    args.forEach((arg, i) => {
      this.variables.set(String(i + 1), arg);
    });
    this.variables.set('#', String(args.length));
    this.variables.set('@', args.join(' '));
    
    // Execute function body
    let result = 0;
    for (const line of body) {
      result = await this.executeLine(line);
    }
    
    // Restore args
    for (const [key, value] of savedArgs) {
      this.variables.set(key, value);
    }
    
    return result;
  }
}

/**
 * sh/bash command - run shell scripts
 */
export const shCommand: CommandHandler = async (args, ctx) => {
  if (args.length === 0) {
    ctx.writeln('\x1b[90m[sh] Interactive shell mode not available.\x1b[0m');
    ctx.writeln('\x1b[90mUsage: sh <script.sh> [args...]\x1b[0m');
    return { exitCode: 0 };
  }
  
  const scriptPath = args[0];
  const scriptArgs = args;
  
  // Check for -c option (execute string)
  if (args[0] === '-c' && args[1]) {
    ctx.writeln(`\x1b[90mExecuting: ${args[1]}\x1b[0m`);
    // Would execute the command string
    return { exitCode: 0 };
  }
  
  ctx.writeln(`\x1b[90m[sh] Would execute script: ${scriptPath}\x1b[0m`);
  ctx.writeln('\x1b[33mNote: Full shell script execution requires the script interpreter.\x1b[0m');
  
  return { exitCode: 0 };
};

/**
 * bash command - alias for sh
 */
export const bashCommand = shCommand;

/**
 * source command - execute script in current shell
 */
export const sourceCommand: CommandHandler = async (args, ctx) => {
  if (args.length === 0) {
    ctx.writeError('source: filename argument required');
    return { exitCode: 1 };
  }
  
  ctx.writeln(`\x1b[90m[source] Would source: ${args[0]}\x1b[0m`);
  return { exitCode: 0 };
};
