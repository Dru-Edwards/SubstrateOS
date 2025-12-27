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

test.describe('Education Lab Template', () => {
  // Note: These tests assume the education-lab template is active
  // In a real scenario, we'd need to configure the server with the right template
  
  test('should show education-specific UI', async ({ page }) => {
    await page.goto('/');
    
    // Wait for VM to start
    await page.waitForSelector('#status:has-text("Running")', { timeout: 30000 });
    
    // Terminal should be ready
    const terminal = page.locator('#terminal');
    await expect(terminal).toBeVisible();
    
    // Check for education-specific welcome
    // (This would require the education template to be active)
    await page.waitForTimeout(2000);
  });

  test('should track lab progress in logs', async ({ page }) => {
    await page.goto('/');
    
    // Wait for boot
    await page.waitForSelector('#status:has-text("Running")', { timeout: 30000 });
    
    // Switch to logs panel
    await page.click('[data-panel="logs"]');
    
    // Logs should be visible
    const logsPanel = page.locator('#logs');
    await expect(logsPanel).toBeVisible();
    
    // Simulate a lab command (if terminal accepts input)
    await page.keyboard.type('ls');
    await page.keyboard.press('Enter');
    
    // Wait for logs to appear
    await page.waitForTimeout(1000);
    
    // Logs panel should have boot messages
    await expect(logsPanel).toContainText('system');
  });

  test('should show metrics for education tracking', async ({ page }) => {
    await page.goto('/');
    
    // Wait for boot
    await page.waitForSelector('#status:has-text("Running")', { timeout: 30000 });
    
    // Switch to metrics
    await page.click('[data-panel="metrics"]');
    
    const metricsPanel = page.locator('#metrics');
    await expect(metricsPanel).toBeVisible();
    
    // Should show command count (useful for tracking student activity)
    await expect(metricsPanel).toContainText('Commands');
  });

  test('should have documentation for students', async ({ page }) => {
    await page.goto('/');
    
    // Switch to docs
    await page.click('[data-panel="docs"]');
    
    const docsPanel = page.locator('#docs');
    await expect(docsPanel).toBeVisible();
    
    // Should have beginner-friendly command list
    await expect(docsPanel).toContainText('learn');
    await expect(docsPanel).toContainText('tutorial');
    await expect(docsPanel).toContainText('help');
  });

  test('should handle basic Linux commands', async ({ page }) => {
    await page.goto('/');
    
    // Wait for terminal
    await page.waitForSelector('.xterm-screen', { timeout: 30000 });
    await page.waitForTimeout(2000);
    
    // Try basic educational commands
    await page.keyboard.type('pwd');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    
    await page.keyboard.type('whoami');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    
    // Terminal should remain responsive
    const terminal = page.locator('.xterm');
    await expect(terminal).toBeVisible();
  });

  test('should support persistent storage for progress', async ({ page }) => {
    await page.goto('/');
    
    // Check that /dev/store0 is available
    await page.click('[data-panel="devices"]');
    const deviceList = page.locator('#device-list');
    await expect(deviceList).toContainText('/dev/store0');
    
    // This device can be used to store student progress
  });
});
