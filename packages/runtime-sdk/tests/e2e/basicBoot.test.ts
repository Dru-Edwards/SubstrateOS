/**
 * Runtime SDK - Basic Boot E2E Test
 * Validates core VM lifecycle in browser environment
 */

import { test, expect, Page } from '@playwright/test';
import path from 'path';
import { startTestServer } from '../helpers/testServer';

let serverUrl: string;
let serverCleanup: () => void;

test.beforeAll(async () => {
  // Start test server with artifacts
  const server = await startTestServer({
    port: 0, // Random port
    serveArtifacts: true,
    artifactsPath: path.join(__dirname, '../../fixtures/artifacts')
  });
  
  serverUrl = server.url;
  serverCleanup = server.cleanup;
});

test.afterAll(async () => {
  await serverCleanup();
});

test.describe('DruOS Runtime - Basic Boot', () => {
  test('should boot VM successfully', async ({ page }) => {
    // Navigate to test page
    await page.goto(`${serverUrl}/test.html`);
    
    // Inject runtime and start VM
    const bootTime = await page.evaluate(async () => {
      const runtime = new window.DruOSRuntime({
        onLog: (entry) => console.log('[VM]', entry),
        onError: (error) => console.error('[VM Error]', error)
      });
      
      const container = document.createElement('div');
      container.id = 'terminal';
      document.body.appendChild(container);
      
      const startTime = performance.now();
      
      const instance = await runtime.startInstance({
        container,
        kernelUrl: '/vmlinux.wasm',
        initramfsUrl: '/initramfs.cpio.gz'
      });
      
      // Wait for boot
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Boot timeout')), 10000);
        
        instance.on('stateChange', ({ to }) => {
          if (to === 'running') {
            clearTimeout(timeout);
            resolve();
          }
        });
      });
      
      return performance.now() - startTime;
    });
    
    // Assertions
    expect(bootTime).toBeLessThan(5000); // Boot in < 5 seconds
    
    // Verify terminal is visible
    const terminal = await page.locator('#terminal');
    await expect(terminal).toBeVisible();
    
    // Check for boot message
    const terminalText = await terminal.textContent();
    expect(terminalText).toContain('DruOS Boot Complete');
  });
  
  test('should handle missing kernel gracefully', async ({ page }) => {
    await page.goto(`${serverUrl}/test.html`);
    
    const error = await page.evaluate(async () => {
      const runtime = new window.DruOSRuntime();
      
      try {
        await runtime.startInstance({
          container: document.body,
          kernelUrl: '/nonexistent.wasm',
          initramfsUrl: '/initramfs.cpio.gz'
        });
        return null;
      } catch (err) {
        return err.message;
      }
    });
    
    expect(error).toContain('Failed to load kernel');
  });
  
  test('should execute commands after boot', async ({ page }) => {
    await page.goto(`${serverUrl}/test.html`);
    
    const result = await page.evaluate(async () => {
      const runtime = new window.DruOSRuntime();
      
      const instance = await runtime.startInstance({
        container: document.body,
        kernelUrl: '/vmlinux.wasm',
        initramfsUrl: '/initramfs.cpio.gz'
      });
      
      // Wait for boot
      await new Promise(resolve => {
        instance.on('stateChange', ({ to }) => {
          if (to === 'running') resolve(null);
        });
      });
      
      // Execute command
      const result = await instance.execute('echo "Hello from DruOS"');
      return result;
    });
    
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('Hello from DruOS');
  });
  
  test('should stop instance cleanly', async ({ page }) => {
    await page.goto(`${serverUrl}/test.html`);
    
    const states = await page.evaluate(async () => {
      const runtime = new window.DruOSRuntime();
      const stateLog: string[] = [];
      
      const instance = await runtime.startInstance({
        container: document.body,
        kernelUrl: '/vmlinux.wasm',
        initramfsUrl: '/initramfs.cpio.gz'
      });
      
      instance.on('stateChange', ({ to }) => {
        stateLog.push(to);
      });
      
      // Wait for boot
      await new Promise(resolve => {
        instance.on('stateChange', ({ to }) => {
          if (to === 'running') resolve(null);
        });
      });
      
      // Stop instance
      await instance.stop();
      
      return stateLog;
    });
    
    expect(states).toContain('loading');
    expect(states).toContain('booting');
    expect(states).toContain('running');
    expect(states).toContain('stopping');
    expect(states).toContain('stopped');
  });
});

test.describe('Runtime SDK - Error Handling', () => {
  test('should handle WASM instantiation failure', async ({ page }) => {
    await page.goto(`${serverUrl}/test.html`);
    
    // Inject malformed WASM
    await page.route('/bad.wasm', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/wasm',
        body: Buffer.from('not valid wasm')
      });
    });
    
    const error = await page.evaluate(async () => {
      const runtime = new window.DruOSRuntime();
      
      try {
        await runtime.startInstance({
          container: document.body,
          kernelUrl: '/bad.wasm',
          initramfsUrl: '/initramfs.cpio.gz'
        });
        return null;
      } catch (err) {
        return err.message;
      }
    });
    
    expect(error).toMatch(/Failed to instantiate|Invalid WASM/);
  });
  
  test('should handle memory exhaustion', async ({ page }) => {
    await page.goto(`${serverUrl}/test.html`);
    
    const error = await page.evaluate(async () => {
      const runtime = new window.DruOSRuntime();
      
      try {
        await runtime.startInstance({
          container: document.body,
          kernelUrl: '/vmlinux.wasm',
          initramfsUrl: '/initramfs.cpio.gz',
          limits: {
            memory: 1024 // Only 1KB - will fail
          }
        });
        return null;
      } catch (err) {
        return err.message;
      }
    });
    
    expect(error).toMatch(/memory|Memory/);
  });
  
  test('should timeout on hung boot', async ({ page }) => {
    await page.goto(`${serverUrl}/test.html`);
    
    // Mock a kernel that never completes boot
    await page.route('/hung.wasm', async route => {
      // Return valid WASM that hangs
      const response = await route.fetch();
      const body = await response.body();
      route.fulfill({ response, body });
    });
    
    const error = await page.evaluate(async () => {
      const runtime = new window.DruOSRuntime({
        performance: {
          bootTimeout: 2000 // 2 second timeout
        }
      });
      
      try {
        await runtime.startInstance({
          container: document.body,
          kernelUrl: '/hung.wasm',
          initramfsUrl: '/initramfs.cpio.gz'
        });
        return null;
      } catch (err) {
        return err.message;
      }
    });
    
    expect(error).toContain('timeout');
  });
});

test.describe('Runtime SDK - SharedArrayBuffer Fallback', () => {
  test('should work without SharedArrayBuffer', async ({ page, context }) => {
    // Disable SharedArrayBuffer
    await context.addInitScript(() => {
      delete window.SharedArrayBuffer;
    });
    
    await page.goto(`${serverUrl}/test.html`);
    
    const { hasSharedArrayBuffer, booted } = await page.evaluate(async () => {
      const runtime = new window.DruOSRuntime();
      
      const instance = await runtime.startInstance({
        container: document.body,
        kernelUrl: '/vmlinux.wasm',
        initramfsUrl: '/initramfs.cpio.gz'
      });
      
      await new Promise(resolve => {
        instance.on('stateChange', ({ to }) => {
          if (to === 'running') resolve(null);
        });
      });
      
      return {
        hasSharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined',
        booted: instance.getState() === 'running'
      };
    });
    
    expect(hasSharedArrayBuffer).toBe(false);
    expect(booted).toBe(true);
    
    // Check for warning in console
    const consoleMessages = await page.evaluate(() => {
      return window.__consoleLog || [];
    });
    
    expect(consoleMessages.some(msg => 
      msg.includes('SharedArrayBuffer not available')
    )).toBe(true);
  });
});
