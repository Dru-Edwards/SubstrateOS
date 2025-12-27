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

test.describe('AI Sandbox Template', () => {
  // Note: These tests assume the ai-sandbox template is active
  
  test('should boot with AI features', async ({ page }) => {
    await page.goto('/');
    
    // Wait for VM to start
    await page.waitForSelector('#status:has-text("Running")', { timeout: 30000 });
    
    // Terminal should be ready
    const terminal = page.locator('#terminal');
    await expect(terminal).toBeVisible();
  });

  test('should show AI device available', async ({ page }) => {
    await page.goto('/');
    
    // Wait for boot
    await page.waitForSelector('#status:has-text("Running")', { timeout: 30000 });
    
    // Check devices panel
    await page.click('[data-panel="devices"]');
    const deviceList = page.locator('#device-list');
    await expect(deviceList).toBeVisible();
    
    // Devices should be listed
    await expect(deviceList).toContainText('/dev/');
  });

  test('should track AI agent activity in logs', async ({ page }) => {
    await page.goto('/');
    
    // Wait for boot
    await page.waitForSelector('#status:has-text("Running")', { timeout: 30000 });
    
    // Switch to logs to monitor activity
    await page.click('[data-panel="logs"]');
    const logsPanel = page.locator('#logs');
    await expect(logsPanel).toBeVisible();
    
    // Wait for logs to appear
    await page.waitForTimeout(1000);
    
    // Logs panel should have boot messages
    await expect(logsPanel).toContainText('system');
  });

  test('should show metrics for AI operations', async ({ page }) => {
    await page.goto('/');
    
    // Wait for boot
    await page.waitForSelector('#status:has-text("Running")', { timeout: 30000 });
    
    // Check metrics
    await page.click('[data-panel="metrics"]');
    const metricsPanel = page.locator('#metrics');
    await expect(metricsPanel).toBeVisible();
    
    // Should track device calls including AI
    await expect(metricsPanel).toContainText('Device Calls');
  });

  test('should support sandboxed command execution', async ({ page }) => {
    await page.goto('/');
    
    // Wait for terminal
    await page.waitForSelector('.xterm-screen', { timeout: 30000 });
    await page.waitForTimeout(2000);
    
    // Try safe commands (sandboxed)
    await page.keyboard.type('echo "AI agent test"');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    
    // Check terminal is still responsive
    const terminal = page.locator('.xterm');
    await expect(terminal).toBeVisible();
  });

  test('should have persistent storage for agent state', async ({ page }) => {
    await page.goto('/');
    
    // Verify storage device available
    await page.click('[data-panel="devices"]');
    const deviceList = page.locator('#device-list');
    await expect(deviceList).toContainText('/dev/store0');
    
    // This can be used to store agent state between executions
  });

  test('should provide agent documentation', async ({ page }) => {
    await page.goto('/');
    
    // Check docs panel
    await page.click('[data-panel="docs"]');
    const docsPanel = page.locator('#docs');
    await expect(docsPanel).toBeVisible();
    
    // Should have shell commands documentation
    await expect(docsPanel).toContainText('Shell Commands');
    await expect(docsPanel).toContainText('help');
  });

  test('should handle multiple panels for monitoring', async ({ page }) => {
    await page.goto('/');
    
    // Wait for boot
    await page.waitForSelector('#status:has-text("Running")', { timeout: 30000 });
    
    // Test switching between panels quickly
    await page.click('[data-panel="logs"]');
    await expect(page.locator('#logs')).toBeVisible();
    
    await page.click('[data-panel="metrics"]');
    await expect(page.locator('#metrics')).toBeVisible();
    
    await page.click('[data-panel="devices"]');
    await expect(page.locator('#device-list')).toBeVisible();
    
    // All panels should work smoothly for monitoring AI activity
  });
});
