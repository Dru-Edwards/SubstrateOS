/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║               EDWARDS TECH INNOVATION                    ║
 * ╚══════════════════════════════════════════════════════════╝
 *  Embed SDK - checkLimits Unit Tests
 *  Pure function tests for limit checking logic
 */

import { describe, it, expect } from 'vitest';
import { checkLimits, DruOSLimits } from '../../src/index.js';

describe('checkLimits - Pure Function Tests', () => {
  describe('Runtime Limits', () => {
    it('should return null when under runtime limit', () => {
      const metrics = {
        cpuTime: 0,
        memoryUsed: 0,
        commandCount: 0,
        httpRequestCount: 0,
        storageOperationCount: 0
      };
      const limits: DruOSLimits = { maxRuntimeMs: 60000 };
      
      const result = checkLimits(metrics, limits, 30000);
      expect(result).toBeNull();
    });

    it('should return "runtime" when runtime limit exceeded', () => {
      const metrics = {
        cpuTime: 0,
        memoryUsed: 0,
        commandCount: 0,
        httpRequestCount: 0,
        storageOperationCount: 0
      };
      const limits: DruOSLimits = { maxRuntimeMs: 60000 };
      
      const result = checkLimits(metrics, limits, 60001);
      expect(result).toBe('runtime');
    });

    it('should return "runtime" when exactly at runtime limit', () => {
      const metrics = {
        cpuTime: 0,
        memoryUsed: 0,
        commandCount: 0,
        httpRequestCount: 0,
        storageOperationCount: 0
      };
      const limits: DruOSLimits = { maxRuntimeMs: 60000 };
      
      // At exactly the limit, should not exceed
      const result = checkLimits(metrics, limits, 60000);
      expect(result).toBeNull();
    });
  });

  describe('Command Limits', () => {
    it('should return null when under command limit', () => {
      const metrics = {
        cpuTime: 0,
        memoryUsed: 0,
        commandCount: 50,
        httpRequestCount: 0,
        storageOperationCount: 0
      };
      const limits: DruOSLimits = { maxCommands: 100 };
      
      const result = checkLimits(metrics, limits, 0);
      expect(result).toBeNull();
    });

    it('should return "commands" when command limit exceeded', () => {
      const metrics = {
        cpuTime: 0,
        memoryUsed: 0,
        commandCount: 101,
        httpRequestCount: 0,
        storageOperationCount: 0
      };
      const limits: DruOSLimits = { maxCommands: 100 };
      
      const result = checkLimits(metrics, limits, 0);
      expect(result).toBe('commands');
    });

    it('should return null when exactly at command limit', () => {
      const metrics = {
        cpuTime: 0,
        memoryUsed: 0,
        commandCount: 100,
        httpRequestCount: 0,
        storageOperationCount: 0
      };
      const limits: DruOSLimits = { maxCommands: 100 };
      
      const result = checkLimits(metrics, limits, 0);
      expect(result).toBeNull();
    });
  });

  describe('HTTP Request Limits', () => {
    it('should return null when under HTTP limit', () => {
      const metrics = {
        cpuTime: 0,
        memoryUsed: 0,
        commandCount: 0,
        httpRequestCount: 25,
        storageOperationCount: 0
      };
      const limits: DruOSLimits = { maxHttpCalls: 50 };
      
      const result = checkLimits(metrics, limits, 0);
      expect(result).toBeNull();
    });

    it('should return "http" when HTTP limit exceeded', () => {
      const metrics = {
        cpuTime: 0,
        memoryUsed: 0,
        commandCount: 0,
        httpRequestCount: 51,
        storageOperationCount: 0
      };
      const limits: DruOSLimits = { maxHttpCalls: 50 };
      
      const result = checkLimits(metrics, limits, 0);
      expect(result).toBe('http');
    });
  });

  describe('Storage Operation Limits', () => {
    it('should return null when under storage limit', () => {
      const metrics = {
        cpuTime: 0,
        memoryUsed: 0,
        commandCount: 0,
        httpRequestCount: 0,
        storageOperationCount: 100
      };
      const limits: DruOSLimits = { maxStorageOps: 200 };
      
      const result = checkLimits(metrics, limits, 0);
      expect(result).toBeNull();
    });

    it('should return "storage" when storage limit exceeded', () => {
      const metrics = {
        cpuTime: 0,
        memoryUsed: 0,
        commandCount: 0,
        httpRequestCount: 0,
        storageOperationCount: 201
      };
      const limits: DruOSLimits = { maxStorageOps: 200 };
      
      const result = checkLimits(metrics, limits, 0);
      expect(result).toBe('storage');
    });
  });

  describe('Limit Priority', () => {
    it('should check runtime limit first', () => {
      const metrics = {
        cpuTime: 0,
        memoryUsed: 0,
        commandCount: 200,  // Exceeds limit
        httpRequestCount: 100,  // Exceeds limit
        storageOperationCount: 500  // Exceeds limit
      };
      const limits: DruOSLimits = {
        maxRuntimeMs: 1000,
        maxCommands: 100,
        maxHttpCalls: 50,
        maxStorageOps: 200
      };
      
      // Runtime exceeded - should return 'runtime' first
      const result = checkLimits(metrics, limits, 2000);
      expect(result).toBe('runtime');
    });

    it('should check commands limit second', () => {
      const metrics = {
        cpuTime: 0,
        memoryUsed: 0,
        commandCount: 200,  // Exceeds limit
        httpRequestCount: 100,  // Exceeds limit
        storageOperationCount: 500  // Exceeds limit
      };
      const limits: DruOSLimits = {
        maxRuntimeMs: 60000,  // Not exceeded
        maxCommands: 100,
        maxHttpCalls: 50,
        maxStorageOps: 200
      };
      
      const result = checkLimits(metrics, limits, 1000);
      expect(result).toBe('commands');
    });

    it('should check HTTP limit third', () => {
      const metrics = {
        cpuTime: 0,
        memoryUsed: 0,
        commandCount: 50,  // Under limit
        httpRequestCount: 100,  // Exceeds limit
        storageOperationCount: 500  // Exceeds limit
      };
      const limits: DruOSLimits = {
        maxRuntimeMs: 60000,  // Not exceeded
        maxCommands: 100,  // Not exceeded
        maxHttpCalls: 50,
        maxStorageOps: 200
      };
      
      const result = checkLimits(metrics, limits, 1000);
      expect(result).toBe('http');
    });

    it('should check storage limit fourth', () => {
      const metrics = {
        cpuTime: 0,
        memoryUsed: 0,
        commandCount: 50,  // Under limit
        httpRequestCount: 25,  // Under limit
        storageOperationCount: 500  // Exceeds limit
      };
      const limits: DruOSLimits = {
        maxRuntimeMs: 60000,  // Not exceeded
        maxCommands: 100,  // Not exceeded
        maxHttpCalls: 50,  // Not exceeded
        maxStorageOps: 200
      };
      
      const result = checkLimits(metrics, limits, 1000);
      expect(result).toBe('storage');
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined metrics gracefully', () => {
      const limits: DruOSLimits = { maxCommands: 100 };
      
      const result = checkLimits(undefined, limits, 0);
      expect(result).toBeNull();
    });

    it('should handle empty limits object', () => {
      const metrics = {
        cpuTime: 100,
        memoryUsed: 1000,
        commandCount: 500,
        httpRequestCount: 200,
        storageOperationCount: 1000
      };
      const limits: DruOSLimits = {};
      
      const result = checkLimits(metrics, limits, 100000);
      expect(result).toBeNull();
    });

    it('should treat zero limits as no limit (falsy check)', () => {
      const metrics = {
        cpuTime: 0,
        memoryUsed: 0,
        commandCount: 1,
        httpRequestCount: 0,
        storageOperationCount: 0
      };
      const limits: DruOSLimits = { maxCommands: 0 };
      
      // Zero limit is treated as "no limit" due to falsy check
      // This is by design - use undefined/omit the limit to disable it
      const result = checkLimits(metrics, limits, 0);
      expect(result).toBeNull();
    });

    it('should handle very large numbers', () => {
      const metrics = {
        cpuTime: 0,
        memoryUsed: 0,
        commandCount: Number.MAX_SAFE_INTEGER,
        httpRequestCount: 0,
        storageOperationCount: 0
      };
      const limits: DruOSLimits = { maxCommands: Number.MAX_SAFE_INTEGER - 1 };
      
      const result = checkLimits(metrics, limits, 0);
      expect(result).toBe('commands');
    });
  });
});
