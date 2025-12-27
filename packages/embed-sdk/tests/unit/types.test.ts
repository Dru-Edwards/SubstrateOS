/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║               EDWARDS TECH INNOVATION                    ║
 * ╚══════════════════════════════════════════════════════════╝
 *  Embed SDK - Type Definition Tests
 *  Tests for type structures and interface contracts
 */

import { describe, it, expect } from 'vitest';
import type { 
  DruOSDevtoolsOptions,
  DruOSUsageEvent,
  DruOSUsageEventType,
  DruOSLimits,
  DruOSSandboxHandle
} from '../../src/index.js';

describe('Type Definitions', () => {
  describe('DruOSUsageEventType', () => {
    it('should include all valid event types', () => {
      const validTypes: DruOSUsageEventType[] = [
        'sandbox_started',
        'sandbox_stopped',
        'command_executed',
        'http_request',
        'storage_operation',
        'error',
        'limit_reached',
        'heartbeat'
      ];
      
      expect(validTypes.length).toBe(8);
    });
  });

  describe('DruOSUsageEvent', () => {
    it('should have required fields', () => {
      const event: DruOSUsageEvent = {
        type: 'sandbox_started',
        timestamp: Date.now(),
        sessionId: 'test-session-123'
      };
      
      expect(event.type).toBe('sandbox_started');
      expect(event.timestamp).toBeDefined();
      expect(event.sessionId).toBeDefined();
    });

    it('should allow optional fields', () => {
      const event: DruOSUsageEvent = {
        type: 'command_executed',
        timestamp: Date.now(),
        sessionId: 'test-session-123',
        tenantId: 'tenant-abc',
        userId: 'user-xyz',
        data: {
          command: 'ls -la',
          exitCode: 0
        },
        metrics: {
          cpuTime: 100,
          memoryUsed: 1024,
          commandCount: 5,
          httpRequestCount: 2,
          storageOperationCount: 1
        }
      };
      
      expect(event.tenantId).toBe('tenant-abc');
      expect(event.userId).toBe('user-xyz');
      expect(event.data?.command).toBe('ls -la');
      expect(event.metrics?.commandCount).toBe(5);
    });

    it('should support all data field properties', () => {
      const errorEvent: DruOSUsageEvent = {
        type: 'error',
        timestamp: Date.now(),
        sessionId: 'test',
        data: {
          error: 'Something went wrong'
        }
      };
      
      const httpEvent: DruOSUsageEvent = {
        type: 'http_request',
        timestamp: Date.now(),
        sessionId: 'test',
        data: {
          url: 'https://api.example.com',
          method: 'POST'
        }
      };
      
      const storageEvent: DruOSUsageEvent = {
        type: 'storage_operation',
        timestamp: Date.now(),
        sessionId: 'test',
        data: {
          storage_key: 'user:prefs',
          storage_operation: 'set'
        }
      };
      
      const limitEvent: DruOSUsageEvent = {
        type: 'limit_reached',
        timestamp: Date.now(),
        sessionId: 'test',
        data: {
          limitType: 'runtime'
        }
      };
      
      const stopEvent: DruOSUsageEvent = {
        type: 'sandbox_stopped',
        timestamp: Date.now(),
        sessionId: 'test',
        data: {
          duration: 60000
        }
      };
      
      expect(errorEvent.data?.error).toBe('Something went wrong');
      expect(httpEvent.data?.url).toBe('https://api.example.com');
      expect(storageEvent.data?.storage_operation).toBe('set');
      expect(limitEvent.data?.limitType).toBe('runtime');
      expect(stopEvent.data?.duration).toBe(60000);
    });
  });

  describe('DruOSLimits', () => {
    it('should allow all limit types', () => {
      const limits: DruOSLimits = {
        maxRuntimeMs: 300000,      // 5 minutes
        maxCommands: 1000,
        maxHttpCalls: 100,
        maxStorageOps: 500,
        maxMemoryBytes: 512 * 1024 * 1024  // 512MB
      };
      
      expect(limits.maxRuntimeMs).toBe(300000);
      expect(limits.maxCommands).toBe(1000);
      expect(limits.maxHttpCalls).toBe(100);
      expect(limits.maxStorageOps).toBe(500);
      expect(limits.maxMemoryBytes).toBe(512 * 1024 * 1024);
    });

    it('should allow partial limits', () => {
      const limits: DruOSLimits = {
        maxCommands: 50
      };
      
      expect(limits.maxCommands).toBe(50);
      expect(limits.maxRuntimeMs).toBeUndefined();
    });

    it('should allow empty limits', () => {
      const limits: DruOSLimits = {};
      
      expect(Object.keys(limits).length).toBe(0);
    });
  });

  describe('DruOSDevtoolsOptions', () => {
    it('should require container', () => {
      // This test validates the interface structure
      const mockContainer = {} as HTMLElement;
      
      const options: DruOSDevtoolsOptions = {
        container: mockContainer
      };
      
      expect(options.container).toBeDefined();
    });

    it('should support all template types', () => {
      const mockContainer = {} as HTMLElement;
      
      const devtoolsOptions: DruOSDevtoolsOptions = {
        container: mockContainer,
        template: 'devtools-sandbox'
      };
      
      const educationOptions: DruOSDevtoolsOptions = {
        container: mockContainer,
        template: 'education-lab'
      };
      
      const aiOptions: DruOSDevtoolsOptions = {
        container: mockContainer,
        template: 'ai-sandbox'
      };
      
      expect(devtoolsOptions.template).toBe('devtools-sandbox');
      expect(educationOptions.template).toBe('education-lab');
      expect(aiOptions.template).toBe('ai-sandbox');
    });

    it('should support all optional configuration', () => {
      const mockContainer = {} as HTMLElement;
      
      const options: DruOSDevtoolsOptions = {
        container: mockContainer,
        template: 'devtools-sandbox',
        endpoint: 'https://sandbox.example.com',
        onEvent: (event) => console.log(event),
        defaultCommand: 'ls -la',
        env: { PATH: '/usr/bin', HOME: '/home/user' },
        limits: { maxCommands: 100 },
        tenantId: 'tenant-123',
        userId: 'user-456',
        usageEndpoint: 'https://billing.example.com/api/usage',
        apiKey: 'api-key-secret',
        style: {
          width: '100%',
          height: '600px',
          theme: 'dark'
        },
        overlay: [
          { path: '/etc/motd', content: 'Welcome to DruOS!' },
          { path: '/home/user/.bashrc', content: 'export PS1="$ "' }
        ]
      };
      
      expect(options.endpoint).toBe('https://sandbox.example.com');
      expect(options.env?.PATH).toBe('/usr/bin');
      expect(options.style?.theme).toBe('dark');
      expect(options.overlay?.length).toBe(2);
    });
  });

  describe('DruOSSandboxHandle', () => {
    it('should define all required methods', () => {
      // This test validates the interface structure
      const mockHandle: DruOSSandboxHandle = {
        sessionId: 'test-session',
        execute: async (command: string) => {},
        getMetrics: async () => ({
          cpuTime: 0,
          memoryUsed: 0,
          commandCount: 0,
          httpRequestCount: 0,
          storageOperationCount: 0
        }),
        destroy: async () => {},
        reset: async () => {},
        updateEnv: async (env: Record<string, string>) => {}
      };
      
      expect(mockHandle.sessionId).toBe('test-session');
      expect(typeof mockHandle.execute).toBe('function');
      expect(typeof mockHandle.getMetrics).toBe('function');
      expect(typeof mockHandle.destroy).toBe('function');
      expect(typeof mockHandle.reset).toBe('function');
      expect(typeof mockHandle.updateEnv).toBe('function');
    });
  });
});

describe('Usage Event Structure Validation', () => {
  describe('Event Timestamps', () => {
    it('should be valid Unix timestamps in milliseconds', () => {
      const now = Date.now();
      const event: DruOSUsageEvent = {
        type: 'sandbox_started',
        timestamp: now,
        sessionId: 'test'
      };
      
      expect(event.timestamp).toBeGreaterThan(0);
      expect(event.timestamp).toBeLessThanOrEqual(Date.now());
      // Should be in milliseconds (13+ digits)
      expect(event.timestamp.toString().length).toBeGreaterThanOrEqual(13);
    });
  });

  describe('Session ID Format', () => {
    it('should be a non-empty string', () => {
      const event: DruOSUsageEvent = {
        type: 'sandbox_started',
        timestamp: Date.now(),
        sessionId: 'abc123-def456-ghi789'
      };
      
      expect(event.sessionId.length).toBeGreaterThan(0);
      expect(typeof event.sessionId).toBe('string');
    });
  });

  describe('Limit Type Values', () => {
    it('should only allow valid limit types', () => {
      const validLimitTypes: Array<'runtime' | 'commands' | 'http' | 'storage'> = [
        'runtime',
        'commands',
        'http',
        'storage'
      ];
      
      validLimitTypes.forEach(limitType => {
        const event: DruOSUsageEvent = {
          type: 'limit_reached',
          timestamp: Date.now(),
          sessionId: 'test',
          data: { limitType }
        };
        
        expect(['runtime', 'commands', 'http', 'storage']).toContain(event.data?.limitType);
      });
    });
  });

  describe('Storage Operation Values', () => {
    it('should only allow valid storage operations', () => {
      const validOps: Array<'get' | 'set' | 'delete'> = ['get', 'set', 'delete'];
      
      validOps.forEach(op => {
        const event: DruOSUsageEvent = {
          type: 'storage_operation',
          timestamp: Date.now(),
          sessionId: 'test',
          data: {
            storage_key: 'test-key',
            storage_operation: op
          }
        };
        
        expect(['get', 'set', 'delete']).toContain(event.data?.storage_operation);
      });
    });
  });
});
