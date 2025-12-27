/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║               EDWARDS TECH INNOVATION                    ║
 * ║                                                          ║
 * ╚══════════════════════════════════════════════════════════╝
 *  Business Unit : DruOS-Core
 *  Module        : Embed SDK
 *  Author        : Andrew "Dru" Edwards
 *  Umbrella      : Edwards Tech Innovation
 *  Notice        : © 2025 All rights reserved.
 * ============================================================
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * Configuration options for creating a DevTools Sandbox
 */
export interface DruOSDevtoolsOptions {
  /** HTML element to render the sandbox into */
  container: HTMLElement;
  /** Template to use (defaults to 'devtools-sandbox') */
  template?: 'devtools-sandbox' | 'education-lab' | 'ai-sandbox';
  /** Endpoint URL where the sandbox is hosted */
  endpoint?: string;
  /** Event handler for usage events */
  onEvent?: (event: DruOSUsageEvent) => void;
  /** Default command to run on startup */
  defaultCommand?: string;
  /** Environment variables to set */
  env?: Record<string, string>;
  /** Usage limits for the session */
  limits?: DruOSLimits;
  /** Tenant ID for multi-tenant deployments */
  tenantId?: string;
  /** User ID for tracking */
  userId?: string;
  /** Billing backend endpoint for usage tracking */
  usageEndpoint?: string;
  /** API key for authenticating with billing backend */
  apiKey?: string;
  /** Custom styling options */
  style?: {
    width?: string;
    height?: string;
    theme?: 'light' | 'dark';
  };
  /** Files to preload into the sandbox */
  overlay?: Array<{
    path: string;
    content: string;
  }>;
}

/**
 * Types of usage events emitted by the sandbox
 */
export type DruOSUsageEventType =
  | 'sandbox_started'
  | 'sandbox_stopped'
  | 'command_executed'
  | 'http_request'
  | 'storage_operation'
  | 'error'
  | 'limit_reached'
  | 'heartbeat';

/**
 * Usage event emitted by the sandbox
 */
export interface DruOSUsageEvent {
  /** Type of event */
  type: DruOSUsageEventType;
  /** Unix timestamp in milliseconds */
  timestamp: number;
  /** Unique session identifier */
  sessionId: string;
  /** Tenant ID if provided */
  tenantId?: string;
  /** User ID if provided */
  userId?: string;
  /** Event-specific data */
  data?: {
    command?: string;
    exitCode?: number;
    url?: string;
    method?: string;
    storage_key?: string;
    storage_operation?: 'get' | 'set' | 'delete';
    limitType?: 'runtime' | 'commands' | 'http' | 'storage';
    error?: string;
    duration?: number;
  };
  /** Current metrics */
  metrics?: {
    cpuTime?: number;
    memoryUsed?: number;
    commandCount?: number;
    httpRequestCount?: number;
    storageOperationCount?: number;
  };
}

/**
 * Usage limits for a sandbox session
 */
export interface DruOSLimits {
  /** Maximum runtime in milliseconds */
  maxRuntimeMs?: number;
  /** Maximum number of commands */
  maxCommands?: number;
  /** Maximum number of HTTP requests */
  maxHttpCalls?: number;
  /** Maximum number of storage operations */
  maxStorageOps?: number;
  /** Maximum memory usage in bytes */
  maxMemoryBytes?: number;
}

/**
 * Handle to control a sandbox instance
 */
export interface DruOSSandboxHandle {
  /** Unique session ID */
  sessionId: string;
  /** Execute a command in the sandbox */
  execute(command: string): Promise<void>;
  /** Get current metrics */
  getMetrics(): Promise<DruOSUsageEvent['metrics']>;
  /** Destroy the sandbox and cleanup */
  destroy(): Promise<void>;
  /** Reset the sandbox to initial state */
  reset(): Promise<void>;
  /** Update environment variables */
  updateEnv(env: Record<string, string>): Promise<void>;
}

/**
 * Internal message types for iframe communication
 */
interface SandboxMessage {
  type: 'init' | 'event' | 'command' | 'destroy' | 'reset' | 'update_env' | 'heartbeat';
  sessionId: string;
  data?: any;
}

/**
 * Internal metrics type (always defined, unlike the optional export type)
 */
interface InternalMetrics {
  cpuTime: number;
  memoryUsed: number;
  commandCount: number;
  httpRequestCount: number;
  storageOperationCount: number;
}

/**
 * Default usage sink that sends events to billing backend
 */
async function defaultUsageSink(
  event: DruOSUsageEvent,
  options: DruOSDevtoolsOptions
): Promise<void> {
  // Skip if no endpoint configured
  if (!options.usageEndpoint || !options.apiKey) {
    return;
  }

  // Ensure tenant ID is included
  const enrichedEvent = {
    ...event,
    tenantId: event.tenantId || options.tenantId
  };

  try {
    const response = await fetch(options.usageEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-DruOS-API-Key': options.apiKey
      },
      body: JSON.stringify({
        tenantId: options.tenantId,
        sessionId: event.sessionId,
        events: [enrichedEvent]
      })
    });

    if (!response.ok) {
      console.warn(`Failed to send usage event: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    console.warn('Failed to send usage event:', error);
  }
}

/**
 * Create an embedded DevTools Sandbox
 * @param options Configuration options
 * @returns Promise resolving to a sandbox handle
 */
export async function createDevtoolsSandbox(
  options: DruOSDevtoolsOptions
): Promise<DruOSSandboxHandle> {
  const sessionId = uuidv4();
  const endpoint = options.endpoint || 'https://sandbox.druos.dev';
  const template = options.template || 'devtools-sandbox';
  
  // Create iframe
  const iframe = document.createElement('iframe');
  iframe.style.width = options.style?.width || '100%';
  iframe.style.height = options.style?.height || '500px';
  iframe.style.border = 'none';
  iframe.style.borderRadius = '8px';
  iframe.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
  
  // Build URL with query parameters
  const url = new URL(endpoint);
  url.searchParams.set('template', template);
  url.searchParams.set('sessionId', sessionId);
  url.searchParams.set('embedded', 'true');
  
  if (options.tenantId) {
    url.searchParams.set('tenantId', options.tenantId);
  }
  
  if (options.userId) {
    url.searchParams.set('userId', options.userId);
  }
  
  if (options.defaultCommand) {
    url.searchParams.set('defaultCommand', options.defaultCommand);
  }
  
  if (options.style?.theme) {
    url.searchParams.set('theme', options.style.theme);
  }
  
  iframe.src = url.toString();
  
  // Track metrics locally (always defined internally)
  let metrics: InternalMetrics = {
    cpuTime: 0,
    memoryUsed: 0,
    commandCount: 0,
    httpRequestCount: 0,
    storageOperationCount: 0
  };
  
  let startTime = Date.now();
  let destroyed = false;
  let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  
  // Start heartbeat interval (every 30 seconds)
  const startHeartbeat = () => {
    heartbeatInterval = setInterval(() => {
      if (destroyed) {
        if (heartbeatInterval) clearInterval(heartbeatInterval);
        return;
      }
      
      const heartbeatEvent: DruOSUsageEvent = {
        type: 'heartbeat',
        timestamp: Date.now(),
        sessionId,
        tenantId: options.tenantId,
        userId: options.userId,
        data: {
          duration: Date.now() - startTime
        },
        metrics: { ...metrics }
      };
      options.onEvent?.(heartbeatEvent);
      defaultUsageSink(heartbeatEvent, options);
    }, 30000);
  };
  
  // Setup message handler
  const messageHandler = (event: MessageEvent) => {
    if (event.origin !== new URL(endpoint).origin) return;
    
    const message = event.data as SandboxMessage;
    if (message.sessionId !== sessionId) return;
    
    if (message.type === 'event') {
      const usageEvent = message.data as DruOSUsageEvent;
      
      // Update local metrics (metrics is always defined internally)
      if (usageEvent.type === 'command_executed') {
        metrics.commandCount += 1;
      } else if (usageEvent.type === 'http_request') {
        metrics.httpRequestCount += 1;
      } else if (usageEvent.type === 'storage_operation') {
        metrics.storageOperationCount += 1;
      }
      
      // Check limits
      if (options.limits) {
        const limitsExceeded = checkLimitsInternal(metrics, options.limits, Date.now() - startTime);
        if (limitsExceeded) {
          const limitEvent: DruOSUsageEvent = {
            type: 'limit_reached',
            timestamp: Date.now(),
            sessionId,
            tenantId: options.tenantId,
            userId: options.userId,
            data: {
              limitType: limitsExceeded
            },
            metrics: { ...metrics }
          };
          options.onEvent?.(limitEvent);
          defaultUsageSink(limitEvent, options);
          
          // Optionally destroy sandbox on limit
          if (limitsExceeded === 'runtime' || limitsExceeded === 'commands') {
            handle.destroy();
          }
        }
      }
      
      // Forward to event handler
      options.onEvent?.(usageEvent);
      
      // Send to billing backend
      defaultUsageSink(usageEvent, options);
    }
  };
  
  window.addEventListener('message', messageHandler);
  
  // Wait for iframe to load
  await new Promise<void>((resolve) => {
    iframe.onload = () => {
      // Send initialization message
      iframe.contentWindow?.postMessage({
        type: 'init',
        sessionId,
        data: {
          template,
          env: options.env,
          limits: options.limits,
          overlay: options.overlay,
          defaultCommand: options.defaultCommand
        }
      } as SandboxMessage, endpoint);
      
      // Emit sandbox_started event
      const startEvent: DruOSUsageEvent = {
        type: 'sandbox_started',
        timestamp: Date.now(),
        sessionId,
        tenantId: options.tenantId,
        userId: options.userId,
        data: {},
        metrics: { ...metrics }
      };
      options.onEvent?.(startEvent);
      defaultUsageSink(startEvent, options);
      
      // Start heartbeat
      startHeartbeat();
      
      resolve();
    };
  });
  
  // Append to container
  options.container.appendChild(iframe);
  
  // Create handle
  const handle: DruOSSandboxHandle = {
    sessionId,
    
    async execute(command: string): Promise<void> {
      if (destroyed) throw new Error('Sandbox is destroyed');
      
      iframe.contentWindow?.postMessage({
        type: 'command',
        sessionId,
        data: { command }
      } as SandboxMessage, endpoint);
    },
    
    async getMetrics(): Promise<DruOSUsageEvent['metrics']> {
      return { ...metrics };
    },
    
    async reset(): Promise<void> {
      if (destroyed) throw new Error('Sandbox is destroyed');
      
      iframe.contentWindow?.postMessage({
        type: 'reset',
        sessionId
      } as SandboxMessage, endpoint);
      
      // Reset metrics
      metrics = {
        cpuTime: 0,
        memoryUsed: 0,
        commandCount: 0,
        httpRequestCount: 0,
        storageOperationCount: 0
      };
      startTime = Date.now();
      
      // Restart heartbeat
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      startHeartbeat();
    },
    
    async updateEnv(env: Record<string, string>): Promise<void> {
      if (destroyed) throw new Error('Sandbox is destroyed');
      
      iframe.contentWindow?.postMessage({
        type: 'update_env',
        sessionId,
        data: { env }
      } as SandboxMessage, endpoint);
    },
    
    async destroy(): Promise<void> {
      if (destroyed) return;
      destroyed = true;
      
      // Stop heartbeat
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      }
      
      // Emit sandbox_stopped event
      const stopEvent: DruOSUsageEvent = {
        type: 'sandbox_stopped',
        timestamp: Date.now(),
        sessionId,
        tenantId: options.tenantId,
        userId: options.userId,
        data: {
          duration: Date.now() - startTime
        },
        metrics: { ...metrics }
      };
      options.onEvent?.(stopEvent);
      defaultUsageSink(stopEvent, options);
      
      // Send destroy message
      iframe.contentWindow?.postMessage({
        type: 'destroy',
        sessionId
      } as SandboxMessage, endpoint);
      
      // Cleanup
      window.removeEventListener('message', messageHandler);
      iframe.remove();
    }
  };
  
  return handle;
}

/**
 * Check if any limits have been exceeded (internal version with required metrics)
 */
function checkLimitsInternal(
  metrics: InternalMetrics,
  limits: DruOSLimits,
  runtimeMs: number
): 'runtime' | 'commands' | 'http' | 'storage' | null {
  if (limits.maxRuntimeMs && runtimeMs > limits.maxRuntimeMs) {
    return 'runtime';
  }
  
  if (limits.maxCommands && metrics.commandCount > limits.maxCommands) {
    return 'commands';
  }
  
  if (limits.maxHttpCalls && metrics.httpRequestCount > limits.maxHttpCalls) {
    return 'http';
  }
  
  if (limits.maxStorageOps && metrics.storageOperationCount > limits.maxStorageOps) {
    return 'storage';
  }
  
  return null;
}

/**
 * Check if any limits have been exceeded (exported version for external use)
 */
export function checkLimits(
  metrics: DruOSUsageEvent['metrics'],
  limits: DruOSLimits,
  runtimeMs: number
): 'runtime' | 'commands' | 'http' | 'storage' | null {
  if (limits.maxRuntimeMs && runtimeMs > limits.maxRuntimeMs) {
    return 'runtime';
  }
  
  if (limits.maxCommands && (metrics?.commandCount || 0) > limits.maxCommands) {
    return 'commands';
  }
  
  if (limits.maxHttpCalls && (metrics?.httpRequestCount || 0) > limits.maxHttpCalls) {
    return 'http';
  }
  
  if (limits.maxStorageOps && (metrics?.storageOperationCount || 0) > limits.maxStorageOps) {
    return 'storage';
  }
  
  return null;
}

/**
 * Utility function to create a sandbox with minimal configuration
 */
export async function quickEmbed(
  containerId: string,
  options?: Partial<DruOSDevtoolsOptions>
): Promise<DruOSSandboxHandle> {
  const container = document.getElementById(containerId);
  if (!container) {
    throw new Error(`Container element with ID '${containerId}' not found`);
  }
  
  return createDevtoolsSandbox({
    container: container as HTMLElement,
    ...options
  });
}

// Types are already exported directly via 'export interface' and 'export type' declarations
