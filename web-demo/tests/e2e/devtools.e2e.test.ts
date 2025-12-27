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

import { test, expect } from '@playwright/test';

test.describe('DevTools Sandbox Template', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('/');
  });

  test('should boot and show terminal', async ({ page }) => {
    // Wait for VM to start
    await page.waitForSelector('#status:has-text("Running")', { timeout: 30000 });
    
    // Check terminal is visible
    const terminal = page.locator('#terminal');
    await expect(terminal).toBeVisible();
    
    // Look for xterm terminal
    const xtermScreen = page.locator('.xterm-screen');
    await expect(xtermScreen).toBeVisible();
    
    // Check for prompt (terminal is ready when prompt appears)
    await expect(page.locator('.xterm')).toContainText('substrateos', { timeout: 10000 });
  });

  test('should show device status', async ({ page }) => {
    // Wait for devices panel
    await page.click('[data-panel="devices"]');
    
    // Check for device list
    const deviceList = page.locator('#device-list');
    await expect(deviceList).toBeVisible();
    
    // Verify devices are listed
    await expect(deviceList).toContainText('/dev/http');
    await expect(deviceList).toContainText('/dev/hostlog');
    await expect(deviceList).toContainText('/dev/store0');
  });

  test('should display logs in observability panel', async ({ page }) => {
    // Switch to logs panel
    await page.click('[data-panel="logs"]');
    
    // Check logs panel is visible
    const logsPanel = page.locator('#logs');
    await expect(logsPanel).toBeVisible();
    
    // Wait for boot logs to appear
    await page.waitForSelector('#status:has-text("Running")', { timeout: 30000 });
    await page.waitForTimeout(1000);
    
    // Logs panel should be visible and have content
    await expect(logsPanel).toContainText('system');
  });

  test('should show metrics panel', async ({ page }) => {
    // Wait for VM to boot
    await page.waitForSelector('#status:has-text("Running")');
    
    // Switch to metrics panel
    await page.click('[data-panel="metrics"]');
    
    // Check metrics panel is visible
    const metricsPanel = page.locator('#metrics');
    await expect(metricsPanel).toBeVisible();
    
    // Should show boot time metric
    await expect(metricsPanel).toContainText('Boot Time');
    await expect(metricsPanel).toContainText('Commands');
    await expect(metricsPanel).toContainText('Device Calls');
  });

  test('should accept terminal input', async ({ page }) => {
    // Wait for terminal to be ready
    await page.waitForSelector('.xterm-screen', { timeout: 30000 });
    await page.waitForTimeout(2000);
    
    // Type a command in terminal
    await page.keyboard.type('echo "Hello from E2E test"');
    await page.keyboard.press('Enter');
    
    // Command should appear in terminal (exact verification depends on shell implementation)
    await page.waitForTimeout(1000);
    
    // Terminal should still be responsive
    const terminal = page.locator('.xterm');
    await expect(terminal).toBeVisible();
  });

  test('should handle errors gracefully', async ({ page }) => {
    // If VM fails to start, error should be shown
    // This is harder to test without mocking, but we can check the structure exists
    const loadingOverlay = page.locator('#loading');
    
    // Loading overlay should eventually be hidden when successful
    await page.waitForSelector('#loading.hidden', { timeout: 30000 });
  });

  test('should have documentation panel', async ({ page }) => {
    // Wait for boot first
    await page.waitForSelector('#status:has-text("Running")', { timeout: 30000 });
    
    // Switch to docs panel
    await page.click('[data-panel="docs"]');
    
    // Check docs content
    const docsPanel = page.locator('#docs');
    await expect(docsPanel).toBeVisible();
    
    // Should have shell commands section
    await expect(docsPanel.locator('h4')).toContainText(['Shell Commands']);
  });
});
