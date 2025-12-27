import type { DruOSDevice, DruOSDeviceContext } from './index';

/**
 * Host Logging Device (/dev/hostlog)
 * Allows guest to send structured logs to the host
 */

export interface HostLogOptions {
  onLog?: (entry: LogEntry) => void;
  bufferSize?: number;
}

export interface LogEntry {
  timestamp?: number;
  level: 'debug' | 'info' | 'warn' | 'error';
  category: string;
  message: string;
  metadata?: Record<string, unknown>;
}

class HostLogDevice implements DruOSDevice {
  readonly name = '/dev/hostlog';
  private context: DruOSDeviceContext | null = null;
  private options: HostLogOptions;
  private buffer: LogEntry[] = [];
  private decoder = new TextDecoder();
  private encoder = new TextEncoder();

  constructor(options: HostLogOptions = {}) {
    this.options = options;
  }

  init(context: DruOSDeviceContext): void {
    this.context = context;
    console.log('[HostLog] Device initialized');
  }

  async handleMessage(data: ArrayBuffer | Uint8Array): Promise<void> {
    try {
      // Decode message from guest
      const message = this.decoder.decode(data);
      
      // Parse JSON protocol
      const entry = JSON.parse(message) as LogEntry;
      
      // Add timestamp if not present
      if (!entry.timestamp) {
        entry.timestamp = Date.now();
      }
      
      // Add to buffer
      this.addToBuffer(entry);
      
      // Forward to handler if provided
      if (this.options.onLog) {
        this.options.onLog(entry);
      } else {
        // Default console logging
        this.consoleLog(entry);
      }
      
      // Send acknowledgment to guest
      if (this.context) {
        const response = JSON.stringify({ 
          type: 'ack',
          id: (entry as any).id 
        });
        this.context.sendToGuest(this.encoder.encode(response));
      }
      
    } catch (error) {
      console.error('[HostLog] Failed to handle message:', error);
      
      // Send error response
      if (this.context) {
        const response = JSON.stringify({ 
          type: 'error',
          error: 'Invalid log message format' 
        });
        this.context.sendToGuest(this.encoder.encode(response));
      }
    }
  }

  private addToBuffer(entry: LogEntry): void {
    const maxSize = this.options.bufferSize || 100;
    this.buffer.push(entry);
    
    // Trim buffer if too large
    if (this.buffer.length > maxSize) {
      this.buffer.shift();
    }
  }

  private consoleLog(entry: LogEntry): void {
    const timestamp = new Date(entry.timestamp || Date.now()).toISOString();
    const prefix = `[${timestamp}] [${entry.level.toUpperCase()}] [${entry.category}]`;
    
    switch (entry.level) {
      case 'debug':
        console.debug(prefix, entry.message, entry.metadata || '');
        break;
      case 'info':
        console.info(prefix, entry.message, entry.metadata || '');
        break;
      case 'warn':
        console.warn(prefix, entry.message, entry.metadata || '');
        break;
      case 'error':
        console.error(prefix, entry.message, entry.metadata || '');
        break;
    }
  }

  getBuffer(): LogEntry[] {
    return [...this.buffer];
  }

  clearBuffer(): void {
    this.buffer = [];
  }
}

export function hostLogDevice(options?: HostLogOptions): DruOSDevice {
  return new HostLogDevice(options);
}

/**
 * Guest-side protocol specification:
 * 
 * To send a log from the guest:
 * 1. Format message as JSON:
 *    {
 *      "level": "info",
 *      "category": "app",
 *      "message": "Application started",
 *      "metadata": { "version": "1.0.0" }
 *    }
 * 
 * 2. Write to /dev/hostlog
 * 
 * 3. Read response for acknowledgment
 * 
 * Example C implementation (guest):
 * ```c
 * int druos_log(const char* level, const char* category, const char* message) {
 *     int fd = open("/dev/hostlog", O_RDWR);
 *     if (fd < 0) return -1;
 *     
 *     char buffer[1024];
 *     snprintf(buffer, sizeof(buffer),
 *              "{\"level\":\"%s\",\"category\":\"%s\",\"message\":\"%s\"}",
 *              level, category, message);
 *     
 *     write(fd, buffer, strlen(buffer));
 *     
 *     // Read acknowledgment
 *     char response[256];
 *     read(fd, response, sizeof(response));
 *     
 *     close(fd);
 *     return 0;
 * }
 * ```
 */
