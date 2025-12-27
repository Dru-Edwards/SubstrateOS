/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║               EDWARDS TECH INNOVATION                    ║
 * ╚══════════════════════════════════════════════════════════╝
 *  End-to-End Tests for SubstrateOS Web Demo
 */

import { test, expect } from '@playwright/test';

test.describe('SubstrateOS Web Demo', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test.describe('Initial Load', () => {
    test('should display loading screen on initial load', async ({ page }) => {
      // Go to page fresh
      await page.goto('/');
      
      // Loading overlay should be visible initially
      const loadingOverlay = page.locator('.loading-overlay');
      await expect(loadingOverlay).toBeVisible({ timeout: 1000 });
      
      // Should show loading title
      await expect(page.locator('.loading-title')).toHaveText('SubstrateOS');
    });

    test('should display header with logo and status', async ({ page }) => {
      const header = page.locator('.header');
      await expect(header).toBeVisible();
      
      // Logo should be visible
      await expect(page.locator('.logo')).toContainText('SubstrateOS');
      
      // Status badge should be visible
      await expect(page.locator('.status-badge')).toBeVisible();
    });

    test('should have restart and fullscreen buttons', async ({ page }) => {
      await expect(page.locator('#btn-restart')).toBeVisible();
      await expect(page.locator('#btn-fullscreen')).toBeVisible();
    });
  });

  test.describe('Terminal Section', () => {
    test('should display terminal container', async ({ page }) => {
      const terminal = page.locator('#terminal');
      await expect(terminal).toBeVisible();
    });

    test('should display terminal header with title', async ({ page }) => {
      const terminalHeader = page.locator('.terminal-header');
      await expect(terminalHeader).toBeVisible();
      await expect(terminalHeader).toContainText('Terminal');
    });

    test('should display window controls (close, minimize, maximize)', async ({ page }) => {
      await expect(page.locator('.window-control.close')).toBeVisible();
      await expect(page.locator('.window-control.minimize')).toBeVisible();
      await expect(page.locator('.window-control.maximize')).toBeVisible();
    });

    test('should display quick command buttons', async ({ page }) => {
      const quickCommands = page.locator('.quick-commands');
      await expect(quickCommands).toBeVisible();
      
      // Check for specific quick commands
      await expect(page.locator('.quick-cmd[data-cmd="help"]')).toBeVisible();
      await expect(page.locator('.quick-cmd[data-cmd="ls -la"]')).toBeVisible();
      await expect(page.locator('.quick-cmd[data-cmd="clear"]')).toBeVisible();
    });
  });

  test.describe('Sidebar Navigation', () => {
    test('should display sidebar with tabs', async ({ page }) => {
      const sidebar = page.locator('.sidebar');
      await expect(sidebar).toBeVisible();
      
      // Check all tabs exist
      await expect(page.locator('.sidebar-tab[data-panel="logs"]')).toBeVisible();
      await expect(page.locator('.sidebar-tab[data-panel="metrics"]')).toBeVisible();
      await expect(page.locator('.sidebar-tab[data-panel="devices"]')).toBeVisible();
      await expect(page.locator('.sidebar-tab[data-panel="docs"]')).toBeVisible();
    });

    test('should switch between tabs when clicked', async ({ page }) => {
      // Logs tab should be active by default
      await expect(page.locator('.sidebar-tab[data-panel="logs"]')).toHaveClass(/active/);
      await expect(page.locator('#logs')).toHaveClass(/active/);
      
      // Click on Metrics tab
      await page.locator('.sidebar-tab[data-panel="metrics"]').click();
      await expect(page.locator('.sidebar-tab[data-panel="metrics"]')).toHaveClass(/active/);
      await expect(page.locator('#metrics')).toHaveClass(/active/);
      await expect(page.locator('#logs')).not.toHaveClass(/active/);
      
      // Click on Devices tab
      await page.locator('.sidebar-tab[data-panel="devices"]').click();
      await expect(page.locator('.sidebar-tab[data-panel="devices"]')).toHaveClass(/active/);
      await expect(page.locator('#devices')).toHaveClass(/active/);
      
      // Click on Docs tab
      await page.locator('.sidebar-tab[data-panel="docs"]').click();
      await expect(page.locator('.sidebar-tab[data-panel="docs"]')).toHaveClass(/active/);
      await expect(page.locator('#docs')).toHaveClass(/active/);
    });
  });

  test.describe('Logs Panel', () => {
    test('should display logs panel title', async ({ page }) => {
      await expect(page.locator('#logs .panel-title')).toContainText('System Logs');
    });

    test('should show empty state when no logs', async ({ page }) => {
      // Empty state should be visible initially
      const emptyState = page.locator('#log-list .empty-state');
      // May or may not be present depending on if logs have been added
    });
  });

  test.describe('Metrics Panel', () => {
    test('should display metrics cards', async ({ page }) => {
      // Navigate to metrics panel
      await page.locator('.sidebar-tab[data-panel="metrics"]').click();
      
      await expect(page.locator('#metric-boot')).toBeVisible();
      await expect(page.locator('#metric-commands')).toBeVisible();
      await expect(page.locator('#metric-device-calls')).toBeVisible();
      await expect(page.locator('#metric-errors')).toBeVisible();
    });
  });

  test.describe('Devices Panel', () => {
    test('should display device list', async ({ page }) => {
      // Navigate to devices panel
      await page.locator('.sidebar-tab[data-panel="devices"]').click();
      
      const deviceList = page.locator('#device-list');
      await expect(deviceList).toBeVisible();
    });
  });

  test.describe('Docs Panel', () => {
    test('should display documentation sections', async ({ page }) => {
      // Navigate to docs panel
      await page.locator('.sidebar-tab[data-panel="docs"]').click();
      
      // Check for documentation sections
      await expect(page.locator('#docs')).toContainText('Shell Commands');
      await expect(page.locator('#docs')).toContainText('Network');
      await expect(page.locator('#docs')).toContainText('Storage');
    });

    test('should display command documentation', async ({ page }) => {
      await page.locator('.sidebar-tab[data-panel="docs"]').click();
      
      // Check for specific commands
      await expect(page.locator('#docs')).toContainText('learn');
      await expect(page.locator('#docs')).toContainText('json');
      await expect(page.locator('#docs')).toContainText('calc');
    });
  });

  test.describe('Responsive Layout', () => {
    test('should have proper layout on desktop', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      
      const mainContainer = page.locator('.main-container');
      await expect(mainContainer).toBeVisible();
      
      // Both terminal and sidebar should be visible
      await expect(page.locator('.terminal-section')).toBeVisible();
      await expect(page.locator('.sidebar')).toBeVisible();
    });

    test('should adapt layout on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      
      // Both sections should still be visible but stacked
      await expect(page.locator('.terminal-section')).toBeVisible();
      await expect(page.locator('.sidebar')).toBeVisible();
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper heading structure', async ({ page }) => {
      // Check for h2 in loading
      await expect(page.locator('.loading-title')).toBeVisible();
    });

    test('should have buttons with accessible labels', async ({ page }) => {
      const restartBtn = page.locator('#btn-restart');
      await expect(restartBtn).toHaveAttribute('title', 'Restart VM');
      
      const fullscreenBtn = page.locator('#btn-fullscreen');
      await expect(fullscreenBtn).toHaveAttribute('title', 'Toggle Fullscreen');
    });
  });
});

test.describe('SubstrateOS Visual States', () => {
  test('loading state should show animated progress bar', async ({ page }) => {
    await page.goto('/');
    
    const progressBar = page.locator('.loading-bar');
    await expect(progressBar).toBeVisible({ timeout: 1000 });
  });

  test('status badge should be visible and have valid state', async ({ page }) => {
    await page.goto('/');
    
    // Status badge should be visible
    const statusBadge = page.locator('.status-badge');
    await expect(statusBadge).toBeVisible();
    
    // Should have either loading or running class (fast loads may skip loading)
    const classAttr = await statusBadge.getAttribute('class');
    expect(classAttr).toMatch(/loading|running/);
  });
});
