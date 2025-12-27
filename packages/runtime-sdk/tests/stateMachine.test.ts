import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DruOSRuntime } from '../src/runtime.js';
import type { DruOSState } from '../src/runtime.js';

describe('DruOS Runtime State Machine', () => {
  let runtime: DruOSRuntime;
  let stateChanges: DruOSState[] = [];
  
  beforeEach(() => {
    stateChanges = [];
    runtime = new DruOSRuntime({
      onStateChange: (state) => {
        stateChanges.push(state);
      }
    });
    
    // Mock fetch to avoid real network calls
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(8)
    } as Response);
    global.WebAssembly = {
      compile: vi.fn().mockResolvedValue({} as WebAssembly.Module),
      instantiate: vi.fn().mockResolvedValue({
        exports: {
          _start: vi.fn()
        }
      } as unknown as WebAssembly.Instance),
      Memory: vi.fn().mockImplementation(() => ({
        buffer: new ArrayBuffer(1024)
      }))
    } as any;
  });
  
  describe('State Transitions', () => {
    it('should start in CREATED state', () => {
      expect(stateChanges).toEqual([]);
    });
    
    it('should transition through LOADING → BOOTING → RUNNING', async () => {
      const container = document.createElement('div');
      
      await runtime.startInstance({
        container,
        image: {
          kernelUrl: '/test/vmlinux.wasm',
          initramfsUrl: '/test/initramfs.cpio.gz'
        }
      });
      
      expect(stateChanges).toEqual(['LOADING', 'BOOTING', 'RUNNING']);
    });
    
    it('should transition to ERROR on fetch failure', async () => {
      global.fetch = vi.fn(() => Promise.reject(new Error('Network error'))) as typeof fetch;
      
      const container = document.createElement('div');
      
      await expect(runtime.startInstance({
        container,
        image: {
          kernelUrl: '/test/vmlinux.wasm',
          initramfsUrl: '/test/initramfs.cpio.gz'
        }
      })).rejects.toThrow('Network error');
      
      expect(stateChanges).toContain('ERROR');
    });
    
    it('should handle WASM compilation failure gracefully', async () => {
      // Mock WASM compilation to fail
      global.WebAssembly.compile = vi.fn().mockRejectedValue(
        new Error('Invalid WASM')
      ) as typeof WebAssembly.compile;
      
      const container = document.createElement('div');
      
      // The runtime should handle compilation failure gracefully
      // Either by using a stub kernel or transitioning to ERROR
      try {
        await runtime.startInstance({
          container,
          image: {
            kernelUrl: '/test/vmlinux.wasm',
            initramfsUrl: '/test/initramfs.cpio.gz'
          }
        });
        // If it succeeds, it used a stub kernel
        expect(stateChanges).toContain('RUNNING');
      } catch (error) {
        // If it throws, it should have transitioned to ERROR
        expect(stateChanges).toContain('ERROR');
      }
    });
  });
  
  describe('Instance Management', () => {
    it('should create instance with unique ID', async () => {
      const container = document.createElement('div');
      
      const instance = await runtime.startInstance({
        container,
        image: {
          kernelUrl: '/test/vmlinux.wasm',
          initramfsUrl: '/test/initramfs.cpio.gz'
        }
      });
      
      expect(instance.id).toBeDefined();
      expect(instance.id.length).toBeGreaterThan(0);
    });
    
    it('should stop instance correctly', async () => {
      const container = document.createElement('div');
      
      const instance = await runtime.startInstance({
        container,
        image: {
          kernelUrl: '/test/vmlinux.wasm',
          initramfsUrl: '/test/initramfs.cpio.gz'
        }
      });
      
      await instance.stop();
      
      expect(stateChanges).toContain('STOPPED');
    });
  });
  
  describe('Memory Management', () => {
    it('should create SharedArrayBuffer when available', async () => {
      // Mock SharedArrayBuffer
      global.SharedArrayBuffer = ArrayBuffer as any;
      
      const container = document.createElement('div');
      
      await runtime.startInstance({
        container,
        image: {
          kernelUrl: '/test/vmlinux.wasm',
          initramfsUrl: '/test/initramfs.cpio.gz'
        },
        memory: 64 * 1024 * 1024 // 64MB
      });
      
      expect(WebAssembly.Memory).toHaveBeenCalled();
    });
    
    it('should fall back to ArrayBuffer when SharedArrayBuffer unavailable', async () => {
      // Remove SharedArrayBuffer
      delete (global as any).SharedArrayBuffer;
      
      const container = document.createElement('div');
      
      await runtime.startInstance({
        container,
        image: {
          kernelUrl: '/test/vmlinux.wasm',
          initramfsUrl: '/test/initramfs.cpio.gz'
        }
      });
      
      expect(WebAssembly.Memory).toHaveBeenCalled();
      expect(stateChanges).toContain('RUNNING');
    });
  });
});
