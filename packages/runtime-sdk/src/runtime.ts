/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║               EDWARDS TECH INNOVATION                    ║
 * ║                                                          ║
 * ╚══════════════════════════════════════════════════════════╝
 *  Business Unit : SubstrateOS-Core
 *  Module        : WebAssembly Linux DevKit Platform
 *  Author        : Andrew "Dru" Edwards
 *  Umbrella      : Edwards Tech Innovation
 *  Notice        : © 2025 All rights reserved.
 * ============================================================
 */

import { EventEmitter } from 'eventemitter3';

// Types
export type SubstrateOSState = 
  | 'CREATED'
  | 'LOADING'
  | 'BOOTING'
  | 'RUNNING'
  | 'PAUSED'
  | 'STOPPED'
  | 'ERROR';

export interface SubstrateOSLogEntry {
  timestamp: number;
  level: 'debug' | 'info' | 'warn' | 'error';
  category: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface SubstrateOSDevice {
  name: string;
  init(context: SubstrateOSDeviceContext): Promise<void> | void;
  handleMessage(data: ArrayBuffer | Uint8Array): Promise<void>;
}

export interface SubstrateOSDeviceContext {
  sendToGuest(data: ArrayBuffer | Uint8Array): void;
  runtime: SubstrateOSRuntime;
}

export interface SubstrateOSRuntimeOptions {
  devices?: SubstrateOSDevice[];
  onLog?: (entry: SubstrateOSLogEntry) => void;
  onStateChange?: (state: SubstrateOSState) => void;
  onError?: (error: Error) => void;
  onConsoleData?: (data: string) => void;
  onMetricsUpdate?: (metrics: any) => void;
  onUsageEvent?: (event: SubstrateOSUsageEvent) => void;
  limits?: SubstrateOSLimits;
  tenantId?: string;
  userId?: string;
}

export interface StartInstanceOptions {
  container: HTMLElement;
  image: {
    kernelUrl: string;
    initramfsUrl: string;
  };
  memory?: number;
}

export interface SubstrateOSInstance {
  id: string;
  state: SubstrateOSState;
  stop(): Promise<void>;
  sendInput(data: string): void;
}

export interface SubstrateOSUsageEvent {
  type: 'sandbox_started' | 'sandbox_stopped' | 'command_executed' | 
        'http_request' | 'storage_operation' | 'error' | 'limit_reached';
  timestamp: number;
  sessionId: string;
  tenantId?: string;
  userId?: string;
  data?: any;
  metrics?: SubstrateOSMetrics;
}

export interface SubstrateOSLimits {
  maxRuntimeMs?: number;
  maxCommands?: number;
  maxHttpCalls?: number;
  maxStorageOps?: number;
}

export interface SubstrateOSMetrics {
  cpuTime: number;
  memoryUsed: number;
  commandCount: number;
  httpRequestCount: number;
  storageOperationCount: number;
}

/**
 * Main SubstrateOS Runtime class
 */
export class SubstrateOSRuntime extends EventEmitter {
  private state: SubstrateOSState = 'CREATED';
  private devices: SubstrateOSDevice[] = [];
  private options: SubstrateOSRuntimeOptions;
  private instance: SubstrateOSInstance | null = null;
  private wasmModule: WebAssembly.Module | null = null;
  private wasmInstance: WebAssembly.Instance | null = null;
  private memory: WebAssembly.Memory | null = null;
  private legacyMetrics = {
    bootTimeMs: 0,
    commandsExecuted: 0,
    deviceCalls: {} as Record<string, number>,
    errorsCount: 0
  };
  private bootStartTime = 0;
  private consoleBuffer = '';
  private usageEventCallback?: (event: SubstrateOSUsageEvent) => void;
  private limits?: SubstrateOSLimits;
  private tenantId?: string;
  private userId?: string;
  private sessionId: string = '';
  private metrics: SubstrateOSMetrics = {
    cpuTime: 0,
    memoryUsed: 0,
    commandCount: 0,
    httpRequestCount: 0,
    storageOperationCount: 0
  };
  private startTime: number = 0;
  private limitCheckInterval: NodeJS.Timeout | null = null;

  constructor(options: SubstrateOSRuntimeOptions = {}) {
    super();
    this.options = options;
    
    // Register devices
    if (options.devices) {
      this.devices = options.devices;
    }
    
    // Setup event forwarding
    if (options.onStateChange) {
      this.on('stateChange', options.onStateChange);
    }
    if (options.onLog) {
      this.on('log', options.onLog);
    }
    if (options.onError) {
      this.on('error', options.onError);
    }
    if (options.onConsoleData) {
      this.on('consoleData', options.onConsoleData);
    }
    if (options.onMetricsUpdate) {
      this.on('metricsUpdate', options.onMetricsUpdate);
    }
    if (options.onUsageEvent) {
      this.usageEventCallback = options.onUsageEvent;
    }
    this.limits = options.limits;
    this.tenantId = options.tenantId;
    this.userId = options.userId;
    this.sessionId = this.generateSessionId();
  }

  async startInstance(options: StartInstanceOptions): Promise<SubstrateOSInstance> {
    try {
      this.setState('LOADING');
      
      // Create memory (SharedArrayBuffer if available)
      const memorySize = options.memory || 256 * 1024 * 1024; // 256MB default
      this.memory = this.createMemory(memorySize);
      
      // Fetch kernel
      this.log('info', 'system', 'Fetching kernel...');
      const kernelResponse = await fetch(options.image.kernelUrl);
      if (!kernelResponse.ok) {
        throw new Error(`Failed to fetch kernel: ${kernelResponse.statusText}`);
      }
      
      // Fetch initramfs
      this.log('info', 'system', 'Fetching initramfs...');
      const initramfsResponse = await fetch(options.image.initramfsUrl);
      if (!initramfsResponse.ok) {
        throw new Error(`Failed to fetch initramfs: ${initramfsResponse.statusText}`);
      }
      
      this.setState('BOOTING');
      
      // Compile WASM module
      this.log('info', 'system', 'Compiling WASM module...');
      const kernelBuffer = await kernelResponse.arrayBuffer();
      
      try {
        this.wasmModule = await WebAssembly.compile(kernelBuffer);
      } catch (compileError) {
        // If real kernel fails, create minimal stub for development
        this.log('warn', 'system', 'Using stub kernel for development');
        this.wasmModule = await this.createStubKernel();
      }
      
      // Create import object for WASM
      const imports = this.createImports();
      
      // Instantiate WASM
      this.log('info', 'system', 'Instantiating WASM...');
      this.wasmInstance = await WebAssembly.instantiate(this.wasmModule, imports);
      
      // Initialize devices
      await this.initializeDevices();
      
      // Create instance
      this.instance = this.createInstance(options);
      
      // Start kernel
      this.log('info', 'system', 'Starting kernel...');
      if (this.wasmInstance.exports._start) {
        (this.wasmInstance.exports._start as Function)();
      }
      
      this.setState('RUNNING');
      this.log('info', 'system', 'SubstrateOS is running');
      
      // Setup terminal if container provided
      if (options.container) {
        await this.setupTerminal(options.container);
      }
      
      // Emit sandbox_started event
      this.emitUsageEvent({
        type: 'sandbox_started',
        timestamp: Date.now(),
        sessionId: this.sessionId,
        tenantId: this.tenantId,
        userId: this.userId,
        metrics: this.metrics
      });
      
      // Start monitoring for limits
      if (this.limits) {
        this.startLimitChecker();
      }
      
      return this.instance;
      
    } catch (error) {
      this.setState('ERROR');
      this.emit('error', error);
      throw error;
    }
  }

  private createMemory(size: number): WebAssembly.Memory {
    const pages = Math.ceil(size / (64 * 1024)); // WASM page size is 64KB
    
    // Try SharedArrayBuffer first
    if (typeof SharedArrayBuffer !== 'undefined') {
      try {
        return new WebAssembly.Memory({
          initial: pages,
          maximum: pages * 2,
          shared: true
        });
      } catch (e) {
        this.log('warn', 'system', 'SharedArrayBuffer not available, falling back to ArrayBuffer');
      }
    }
    
    // Fallback to regular memory
    return new WebAssembly.Memory({
      initial: pages,
      maximum: pages * 2
    });
  }

  private async createStubKernel(): Promise<WebAssembly.Module> {
    // Minimal WASM module for development
    const wat = `
      (module
        (import "env" "memory" (memory 1))
        (import "console" "log" (func $log (param i32) (param i32)))
        (func (export "_start")
          ;; Call console.log with "SubstrateOS Stub Kernel"
          (call $log (i32.const 0) (i32.const 17))
        )
        (data (i32.const 0) "SubstrateOS Stub Kernel")
      )
    `;
    
    // Convert WAT to WASM (simplified - in real implementation use wat2wasm)
    const encoder = new TextEncoder();
    const wasmBytes = encoder.encode(wat);
    
    // For now, return a minimal valid WASM module
    const minimalWasm = new Uint8Array([
      0x00, 0x61, 0x73, 0x6d, // WASM magic
      0x01, 0x00, 0x00, 0x00  // Version 1
    ]);
    
    return WebAssembly.compile(minimalWasm);
  }

  private createImports(): WebAssembly.Imports {
    const decoder = new TextDecoder();
    
    return {
      env: {
        memory: this.memory!
      },
      console: {
        log: (ptr: number, len: number) => {
          if (this.memory) {
            const buffer = new Uint8Array(this.memory.buffer, ptr, len);
            const message = decoder.decode(buffer);
            this.log('info', 'kernel', message);
          }
        }
      },
      substrateos: {
        deviceWrite: (deviceId: number, ptr: number, len: number) => {
          // Handle device writes from guest
          this.handleDeviceWrite(deviceId, ptr, len);
        },
        deviceRead: (deviceId: number, ptr: number, maxLen: number) => {
          // Handle device reads from guest
          return this.handleDeviceRead(deviceId, ptr, maxLen);
        }
      }
    };
  }

  private async initializeDevices(): Promise<void> {
    for (const device of this.devices) {
      this.log('info', 'system', `Initializing device: ${device.name}`);
      
      const context: SubstrateOSDeviceContext = {
        sendToGuest: (data) => this.sendToGuest(data),
        runtime: this
      };
      
      await device.init(context);
    }
  }

  private createInstance(options: StartInstanceOptions): SubstrateOSInstance {
    const instanceId = Math.random().toString(36).substr(2, 9);
    
    return {
      id: instanceId,
      state: this.state,
      stop: async () => {
        this.setState('STOPPED');
        // Cleanup
        this.wasmInstance = null;
        this.wasmModule = null;
        this.memory = null;
        
        // Stop limit checker
        if (this.limitCheckInterval) {
          clearInterval(this.limitCheckInterval);
          this.limitCheckInterval = null;
        }
        
        // Emit sandbox_stopped event
        this.emitUsageEvent({
          type: 'sandbox_stopped',
          timestamp: Date.now(),
          sessionId: this.sessionId,
          tenantId: this.tenantId,
          userId: this.userId,
          data: {
            duration: Date.now() - this.startTime
          },
          metrics: this.metrics
        });
      },
      sendInput: (data: string) => {
        // Send input to guest
        this.sendToGuest(new TextEncoder().encode(data));
      }
    };
  }

  private async setupTerminal(container: HTMLElement): Promise<void> {
    // For now, create a simple text area
    // In real implementation, integrate xterm.js
    const terminal = document.createElement('div');
    terminal.style.width = '100%';
    terminal.style.height = '100%';
    terminal.style.backgroundColor = '#000';
    terminal.style.color = '#0f0';
    terminal.style.fontFamily = 'monospace';
    terminal.style.padding = '10px';
    terminal.style.overflow = 'auto';
    
    const output = document.createElement('pre');
    output.textContent = 'SubstrateOS Boot Complete\n\n$ ';
    terminal.appendChild(output);
    
    const input = document.createElement('input');
    input.style.width = '100%';
    input.style.backgroundColor = '#000';
    input.style.color = '#0f0';
    input.style.border = 'none';
    input.style.outline = 'none';
    input.style.fontFamily = 'monospace';
    
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const cmd = input.value;
        output.textContent += cmd + '\n';
        
        // Process command (stub)
        if (cmd === 'help') {
          output.textContent += 'Available commands: help, echo, ls\n';
        } else if (cmd.startsWith('echo ')) {
          output.textContent += cmd.substring(5) + '\n';
        } else if (cmd === 'ls') {
          output.textContent += 'bin  dev  etc  proc  sys  tmp  usr  var\n';
        } else if (cmd) {
          output.textContent += `${cmd}: command not found\n`;
        }
        
        output.textContent += '$ ';
        input.value = '';
        
        // Scroll to bottom
        terminal.scrollTop = terminal.scrollHeight;
      }
    });
    
    terminal.appendChild(input);
    container.appendChild(terminal);
    
    // Focus input
    input.focus();
  }

  private setState(newState: SubstrateOSState): void {
    const oldState = this.state;
    this.state = newState;
    
    if (this.instance) {
      this.instance.state = newState;
    }
    
    this.emit('stateChange', newState);
    this.log('debug', 'system', `State transition: ${oldState} → ${newState}`);
  }

  private log(level: SubstrateOSLogEntry['level'], category: string, message: string, metadata?: Record<string, unknown>): void {
    const entry: SubstrateOSLogEntry = {
      timestamp: Date.now(),
      level,
      category,
      message,
      metadata
    };
    
    this.emit('log', entry);
    
    // Also log to console for debugging
    console.log(`[${level.toUpperCase()}] [${category}] ${message}`, metadata || '');
  }

  private sendToGuest(data: ArrayBuffer | Uint8Array): void {
    // TODO: Implement sending data to guest
    this.log('debug', 'system', `Sending ${data.byteLength} bytes to guest`);
  }

  private handleDeviceWrite(deviceId: number, ptr: number, len: number): void {
    // TODO: Route to appropriate device
    this.log('debug', 'device', `Device ${deviceId} write: ${len} bytes`);
  }

  private handleDeviceRead(deviceId: number, ptr: number, maxLen: number): number {
    // TODO: Route to appropriate device
    this.log('debug', 'device', `Device ${deviceId} read: max ${maxLen} bytes`);
    return 0;
  }
  
  private generateSessionId(): string {
    return Math.random().toString(36).substr(2, 9) + '-' + Date.now().toString(36);
  }
  
  private emitUsageEvent(event: SubstrateOSUsageEvent): void {
    if (this.usageEventCallback) {
      this.usageEventCallback(event);
    }
    this.emit('usageEvent', event);
  }
  
  private startLimitChecker(): void {
    this.limitCheckInterval = setInterval(() => {
      if (!this.limits) return;
      
      const runtime = Date.now() - this.startTime;
      
      // Check runtime limit
      if (this.limits.maxRuntimeMs && runtime > this.limits.maxRuntimeMs) {
        this.emitUsageEvent({
          type: 'limit_reached',
          timestamp: Date.now(),
          sessionId: this.sessionId,
          tenantId: this.tenantId,
          userId: this.userId,
          data: { limitType: 'runtime' },
          metrics: this.metrics
        });
        if (this.instance) {
          this.instance.stop();
        }
        return;
      }
      
      // Check command limit
      if (this.limits.maxCommands && this.metrics.commandCount > this.limits.maxCommands) {
        this.emitUsageEvent({
          type: 'limit_reached',
          timestamp: Date.now(),
          sessionId: this.sessionId,
          tenantId: this.tenantId,
          userId: this.userId,
          data: { limitType: 'commands' },
          metrics: this.metrics
        });
        if (this.instance) {
          this.instance.stop();
        }
      }
      
      // Check HTTP limit
      if (this.limits.maxHttpCalls && this.metrics.httpRequestCount > this.limits.maxHttpCalls) {
        this.emitUsageEvent({
          type: 'limit_reached',
          timestamp: Date.now(),
          sessionId: this.sessionId,
          tenantId: this.tenantId,
          userId: this.userId,
          data: { limitType: 'http' },
          metrics: this.metrics
        });
      }
      
      // Check storage limit
      if (this.limits.maxStorageOps && this.metrics.storageOperationCount > this.limits.maxStorageOps) {
        this.emitUsageEvent({
          type: 'limit_reached',
          timestamp: Date.now(),
          sessionId: this.sessionId,
          tenantId: this.tenantId,
          userId: this.userId,
          data: { limitType: 'storage' },
          metrics: this.metrics
        });
      }
    }, 1000); // Check every second
  }
  
  // Public method to track command execution
  public trackCommand(command: string): void {
    this.metrics.commandCount++;
    this.emitUsageEvent({
      type: 'command_executed',
      timestamp: Date.now(),
      sessionId: this.sessionId,
      tenantId: this.tenantId,
      userId: this.userId,
      data: { command },
      metrics: this.metrics
    });
  }
  
  // Public method to track HTTP request
  public trackHttpRequest(url: string, method: string = 'GET'): void {
    this.metrics.httpRequestCount++;
    this.emitUsageEvent({
      type: 'http_request',
      timestamp: Date.now(),
      sessionId: this.sessionId,
      tenantId: this.tenantId,
      userId: this.userId,
      data: { url, method },
      metrics: this.metrics
    });
  }
  
  // Public method to track storage operation
  public trackStorageOperation(operation: 'get' | 'set' | 'delete', key: string): void {
    this.metrics.storageOperationCount++;
    this.emitUsageEvent({
      type: 'storage_operation',
      timestamp: Date.now(),
      sessionId: this.sessionId,
      tenantId: this.tenantId,
      userId: this.userId,
      data: { operation, key },
      metrics: this.metrics
    });
  }
}
