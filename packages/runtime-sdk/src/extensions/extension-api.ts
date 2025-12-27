/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║               EDWARDS TECH INNOVATION                    ║
 * ╚══════════════════════════════════════════════════════════╝
 *  SubstrateOS Extension API
 *  
 *  Core API for building SubstrateOS extensions. Extensions can:
 *  - Register new shell commands
 *  - Add filesystem entries
 *  - Create virtual devices
 *  - Provide UI components
 *  - Hook into system events
 */

import { VirtualFileSystem } from '../shell/filesystem';
import { CommandHandler, CommandContext } from '../shell/commands';

/**
 * Extension metadata
 */
export interface ExtensionManifest {
  /** Unique package identifier (e.g., "@substrateos/python") */
  name: string;
  /** Semantic version (e.g., "1.0.0") */
  version: string;
  /** Human-readable description */
  description: string;
  /** Author name or organization */
  author?: string;
  /** License identifier */
  license?: string;
  /** Homepage URL */
  homepage?: string;
  /** Repository URL */
  repository?: string;
  /** Dependencies on other extensions */
  dependencies?: Record<string, string>;
  /** Commands provided by this extension */
  commands?: string[];
  /** Devices provided by this extension */
  devices?: string[];
  /** Entry point for initialization */
  main?: string;
  /** Keywords for discovery */
  keywords?: string[];
  /** Minimum SubstrateOS version required */
  substrateosVersion?: string;
}

/**
 * Extension lifecycle hooks
 */
export interface ExtensionHooks {
  /** Called when extension is loaded */
  onLoad?: () => void | Promise<void>;
  /** Called when extension is unloaded */
  onUnload?: () => void | Promise<void>;
  /** Called when shell starts */
  onShellReady?: () => void;
  /** Called before command execution */
  onBeforeCommand?: (command: string, args: string[]) => boolean | void;
  /** Called after command execution */
  onAfterCommand?: (command: string, args: string[], exitCode: number) => void;
}

/**
 * Extension context - APIs available to extensions
 */
export interface ExtensionContext {
  /** Virtual filesystem access */
  fs: VirtualFileSystem;
  /** Environment variables */
  env: Map<string, string>;
  /** Register a new command */
  registerCommand(name: string, handler: CommandHandler): void;
  /** Unregister a command */
  unregisterCommand(name: string): void;
  /** Log to host console */
  log(level: 'debug' | 'info' | 'warn' | 'error', message: string): void;
  /** Write to terminal output */
  write(text: string): void;
  /** Write line to terminal output */
  writeln(text: string): void;
  /** Show notification to user */
  notify(message: string, type?: 'info' | 'success' | 'warning' | 'error'): void;
  /** Get extension storage (persisted) */
  getStorage(): ExtensionStorage;
  /** HTTP client for network requests */
  http: ExtensionHttp;
  /** Event emitter for pub/sub */
  events: ExtensionEvents;
  /** Extension manifest */
  manifest: ExtensionManifest;
}

/**
 * Extension storage API
 */
export interface ExtensionStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
  delete(key: string): void;
  list(): string[];
  clear(): void;
}

/**
 * Extension HTTP client
 */
export interface ExtensionHttp {
  get(url: string, options?: HttpOptions): Promise<HttpResponse>;
  post(url: string, body?: string, options?: HttpOptions): Promise<HttpResponse>;
  put(url: string, body?: string, options?: HttpOptions): Promise<HttpResponse>;
  delete(url: string, options?: HttpOptions): Promise<HttpResponse>;
  fetch(url: string, options?: HttpOptions): Promise<HttpResponse>;
}

export interface HttpOptions {
  headers?: Record<string, string>;
  timeout?: number;
}

export interface HttpResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  json<T = unknown>(): T;
}

/**
 * Extension event system
 */
export interface ExtensionEvents {
  on(event: string, handler: (...args: unknown[]) => void): void;
  off(event: string, handler: (...args: unknown[]) => void): void;
  emit(event: string, ...args: unknown[]): void;
  once(event: string, handler: (...args: unknown[]) => void): void;
}

/**
 * Base class for SubstrateOS extensions
 */
export abstract class SubstrateOSExtension {
  protected ctx!: ExtensionContext;
  abstract manifest: ExtensionManifest;
  
  /**
   * Initialize the extension with context
   */
  init(ctx: ExtensionContext): void {
    this.ctx = ctx;
  }
  
  /**
   * Called when extension is activated
   */
  abstract activate(): void | Promise<void>;
  
  /**
   * Called when extension is deactivated
   */
  deactivate(): void | Promise<void> {
    // Default: do nothing
  }
  
  /**
   * Get commands provided by this extension
   */
  getCommands(): Record<string, CommandHandler> {
    return {};
  }
}

/**
 * Extension loader result
 */
export interface LoadedExtension {
  manifest: ExtensionManifest;
  instance: SubstrateOSExtension;
  status: 'loaded' | 'active' | 'error' | 'unloaded';
  error?: Error;
}

/**
 * Extension manager - handles loading/unloading extensions
 */
export class ExtensionManager {
  private extensions: Map<string, LoadedExtension> = new Map();
  private commandHandlers: Map<string, CommandHandler> = new Map();
  private context: ExtensionContext | null = null;

  /**
   * Set the extension context
   */
  setContext(ctx: ExtensionContext): void {
    this.context = ctx;
  }

  /**
   * Load an extension from a class
   */
  async loadExtension(ExtClass: new () => SubstrateOSExtension): Promise<LoadedExtension> {
    const instance = new ExtClass();
    const manifest = instance.manifest;
    
    if (this.extensions.has(manifest.name)) {
      throw new Error(`Extension "${manifest.name}" is already loaded`);
    }
    
    const loaded: LoadedExtension = {
      manifest,
      instance,
      status: 'loaded'
    };
    
    try {
      // Create extension-specific context
      const extContext = this.createExtensionContext(manifest);
      instance.init(extContext);
      
      // Activate extension
      await instance.activate();
      
      // Register commands
      const commands = instance.getCommands();
      for (const [name, handler] of Object.entries(commands)) {
        this.registerCommand(name, handler);
      }
      
      loaded.status = 'active';
      this.extensions.set(manifest.name, loaded);
      
      console.log(`[SubstrateOS] Extension loaded: ${manifest.name}@${manifest.version}`);
      
    } catch (error) {
      loaded.status = 'error';
      loaded.error = error as Error;
      console.error(`[SubstrateOS] Failed to load extension "${manifest.name}":`, error);
    }
    
    return loaded;
  }

  /**
   * Load extension from URL (ESM module)
   */
  async loadExtensionFromUrl(url: string): Promise<LoadedExtension> {
    try {
      const module = await import(/* webpackIgnore: true */ url);
      
      if (!module.default) {
        throw new Error('Extension must export default class');
      }
      
      return this.loadExtension(module.default);
      
    } catch (error) {
      throw new Error(`Failed to load extension from ${url}: ${(error as Error).message}`);
    }
  }

  /**
   * Load extension from inline code
   */
  async loadExtensionFromCode(code: string, manifest: ExtensionManifest): Promise<LoadedExtension> {
    // Create a blob URL for the code
    const blob = new Blob([code], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    
    try {
      const result = await this.loadExtensionFromUrl(url);
      return result;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  /**
   * Unload an extension
   */
  async unloadExtension(name: string): Promise<void> {
    const ext = this.extensions.get(name);
    if (!ext) {
      throw new Error(`Extension "${name}" is not loaded`);
    }
    
    try {
      await ext.instance.deactivate();
      
      // Unregister commands
      const commands = ext.instance.getCommands();
      for (const cmdName of Object.keys(commands)) {
        this.unregisterCommand(cmdName);
      }
      
      ext.status = 'unloaded';
      this.extensions.delete(name);
      
      console.log(`[SubstrateOS] Extension unloaded: ${name}`);
      
    } catch (error) {
      console.error(`[SubstrateOS] Error unloading extension "${name}":`, error);
      throw error;
    }
  }

  /**
   * Get loaded extensions
   */
  getExtensions(): LoadedExtension[] {
    return Array.from(this.extensions.values());
  }

  /**
   * Get extension by name
   */
  getExtension(name: string): LoadedExtension | undefined {
    return this.extensions.get(name);
  }

  /**
   * Register a command handler
   */
  registerCommand(name: string, handler: CommandHandler): void {
    this.commandHandlers.set(name, handler);
    if (this.context) {
      this.context.registerCommand(name, handler);
    }
  }

  /**
   * Unregister a command handler
   */
  unregisterCommand(name: string): void {
    this.commandHandlers.delete(name);
    if (this.context) {
      this.context.unregisterCommand(name);
    }
  }

  /**
   * Get all registered command handlers
   */
  getCommandHandlers(): Map<string, CommandHandler> {
    return new Map(this.commandHandlers);
  }

  /**
   * Create extension-specific context
   */
  private createExtensionContext(manifest: ExtensionManifest): ExtensionContext {
    if (!this.context) {
      throw new Error('Extension manager context not set');
    }
    
    const prefix = `ext:${manifest.name}:`;
    
    // Create extension-specific storage
    const storage: ExtensionStorage = {
      get: (key) => localStorage.getItem(prefix + key),
      set: (key, value) => localStorage.setItem(prefix + key, value),
      delete: (key) => localStorage.removeItem(prefix + key),
      list: () => Object.keys(localStorage)
        .filter(k => k.startsWith(prefix))
        .map(k => k.slice(prefix.length)),
      clear: () => {
        for (const key of Object.keys(localStorage)) {
          if (key.startsWith(prefix)) {
            localStorage.removeItem(key);
          }
        }
      }
    };
    
    return {
      ...this.context,
      manifest,
      getStorage: () => storage
    };
  }
}

/**
 * Create a simple extension from an object
 */
export function createExtension(config: {
  manifest: ExtensionManifest;
  commands?: Record<string, CommandHandler>;
  activate?: (ctx: ExtensionContext) => void | Promise<void>;
  deactivate?: () => void | Promise<void>;
}): new () => SubstrateOSExtension {
  return class extends SubstrateOSExtension {
    manifest = config.manifest;
    
    async activate() {
      if (config.activate) {
        await config.activate(this.ctx);
      }
    }
    
    async deactivate() {
      if (config.deactivate) {
        await config.deactivate();
      }
    }
    
    getCommands() {
      return config.commands || {};
    }
  };
}

/**
 * Global extension manager instance
 */
export const extensionManager = new ExtensionManager();
