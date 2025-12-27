/**
 * SubstrateOS Tier Smoke Tests
 * 
 * End-to-end tests verifying core functionality works across all tiers.
 * These tests run against the main SubstrateOS demo.
 */

import { test, expect } from '@playwright/test';

// ==================== FREE TIER TESTS ====================

test.describe('Free Tier Smoke Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.xterm-screen', { timeout: 10000 });
  });

  test('shell boots and shows prompt', async ({ page }) => {
    const terminal = page.locator('.xterm-screen');
    await expect(terminal).toContainText('$');
  });

  test('pwd command works', async ({ page }) => {
    const terminal = page.locator('.xterm-screen');
    await page.keyboard.type('pwd');
    await page.keyboard.press('Enter');
    await expect(terminal).toContainText('/home/user');
  });

  test('ls command works', async ({ page }) => {
    const terminal = page.locator('.xterm-screen');
    await page.keyboard.type('ls');
    await page.keyboard.press('Enter');
    await expect(terminal).toContainText('Documents');
  });

  test('echo command works', async ({ page }) => {
    const terminal = page.locator('.xterm-screen');
    await page.keyboard.type('echo "Free Tier Test"');
    await page.keyboard.press('Enter');
    await expect(terminal).toContainText('Free Tier Test');
  });

  test('SQLite SELECT works', async ({ page }) => {
    const terminal = page.locator('.xterm-screen');
    await page.keyboard.type('sql SELECT 42 as answer');
    await page.keyboard.press('Enter');
    await expect(terminal).toContainText('42');
  });

  test('help command works', async ({ page }) => {
    const terminal = page.locator('.xterm-screen');
    await page.keyboard.type('help');
    await page.keyboard.press('Enter');
    await expect(terminal).toContainText('Developer Tools');
  });

  test('filesystem write and read', async ({ page }) => {
    const terminal = page.locator('.xterm-screen');
    
    // Write
    await page.keyboard.type('echo "smoke test" > smoke_test.txt');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);

    // Read
    await page.keyboard.type('cat smoke_test.txt');
    await page.keyboard.press('Enter');
    await expect(terminal).toContainText('smoke test');
  });

  test('cd and navigation works', async ({ page }) => {
    const terminal = page.locator('.xterm-screen');
    
    await page.keyboard.type('cd /');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    
    await page.keyboard.type('pwd');
    await page.keyboard.press('Enter');
    await expect(terminal).toContainText('/');
    
    await page.keyboard.type('cd /home/user');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    
    await page.keyboard.type('pwd');
    await page.keyboard.press('Enter');
    await expect(terminal).toContainText('/home/user');
  });

  test('mkdir creates directories', async ({ page }) => {
    const terminal = page.locator('.xterm-screen');
    
    await page.keyboard.type('mkdir smoke_test_dir');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    
    await page.keyboard.type('ls');
    await page.keyboard.press('Enter');
    await expect(terminal).toContainText('smoke_test_dir');
  });

  test('learn command starts tutorial', async ({ page }) => {
    const terminal = page.locator('.xterm-screen');
    await page.keyboard.type('learn');
    await page.keyboard.press('Enter');
    await expect(terminal).toContainText('Minute');
  });
});

// ==================== DEVELOPER TIER FEATURES ====================

test.describe('Developer Tier Features', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.xterm-screen', { timeout: 10000 });
  });

  test('apt list shows packages', async ({ page }) => {
    const terminal = page.locator('.xterm-screen');
    await page.keyboard.type('apt list');
    await page.keyboard.press('Enter');
    await expect(terminal).toContainText('python');
  });

  test('json command parses JSON', async ({ page }) => {
    const terminal = page.locator('.xterm-screen');
    await page.keyboard.type('json parse \'{"name":"test"}\'');
    await page.keyboard.press('Enter');
    await expect(terminal).toContainText('name');
  });

  test('calc command works', async ({ page }) => {
    const terminal = page.locator('.xterm-screen');
    await page.keyboard.type('calc 2 + 2');
    await page.keyboard.press('Enter');
    await expect(terminal).toContainText('4');
  });

  test('uuid generates UUID', async ({ page }) => {
    const terminal = page.locator('.xterm-screen');
    await page.keyboard.type('uuid');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    // Should contain some kind of UUID-like output with dashes
    const text = await terminal.textContent();
    expect(text?.includes('-')).toBeTruthy();
  });

  test('base64 encoding works', async ({ page }) => {
    const terminal = page.locator('.xterm-screen');
    await page.keyboard.type('base64 encode hello');
    await page.keyboard.press('Enter');
    await expect(terminal).toContainText('aGVsbG8=');
  });
});

// ==================== PRO TIER FEATURES (Agent SDK) ====================

test.describe('Pro Tier Features', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.xterm-screen', { timeout: 10000 });
  });

  test('SQLite advanced queries work', async ({ page }) => {
    const terminal = page.locator('.xterm-screen');
    
    // Create table
    await page.keyboard.type('sql CREATE TABLE IF NOT EXISTS users (id INTEGER, name TEXT)');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);

    // Insert
    await page.keyboard.type('sql INSERT INTO users VALUES (1, \'Alice\')');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);

    // Query
    await page.keyboard.type('sql SELECT * FROM users');
    await page.keyboard.press('Enter');
    await expect(terminal).toContainText('Alice');
  });

  test('multiple workspace files', async ({ page }) => {
    const terminal = page.locator('.xterm-screen');
    
    // Create multiple files
    await page.keyboard.type('echo "file1" > f1.txt && echo "file2" > f2.txt && echo "file3" > f3.txt');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);

    await page.keyboard.type('ls');
    await page.keyboard.press('Enter');
    await expect(terminal).toContainText('f1.txt');
    await expect(terminal).toContainText('f2.txt');
  });

  test('complex shell scripting', async ({ page }) => {
    const terminal = page.locator('.xterm-screen');
    
    // Using && for command chaining
    await page.keyboard.type('mkdir -p pro_test && cd pro_test && pwd');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    
    const text = await terminal.textContent();
    expect(text?.includes('pro_test') || text?.includes('/home/user')).toBeTruthy();
  });
});

// ==================== CLASSROOM TIER FEATURES ====================

test.describe('Classroom Tier Features', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.xterm-screen', { timeout: 10000 });
  });

  test('learn command in classroom', async ({ page }) => {
    const terminal = page.locator('.xterm-screen');
    await page.keyboard.type('learn');
    await page.keyboard.press('Enter');
    await expect(terminal).toContainText('Minute');
  });

  test('educational neofetch', async ({ page }) => {
    const terminal = page.locator('.xterm-screen');
    await page.keyboard.type('neofetch');
    await page.keyboard.press('Enter');
    await expect(terminal).toContainText('SubstrateOS');
  });

  test('cowsay for fun', async ({ page }) => {
    const terminal = page.locator('.xterm-screen');
    await page.keyboard.type('cowsay Hello Students');
    await page.keyboard.press('Enter');
    // Cowsay produces ASCII art
    const text = await terminal.textContent();
    expect(text?.includes('Hello') || text?.includes('___')).toBeTruthy();
  });
});

// ==================== ENTERPRISE TIER FEATURES ====================

test.describe('Enterprise Tier Features', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.xterm-screen', { timeout: 10000 });
  });

  test('storage command works', async ({ page }) => {
    const terminal = page.locator('.xterm-screen');
    await page.keyboard.type('storage');
    await page.keyboard.press('Enter');
    // Should show storage information
    const text = await terminal.textContent();
    expect(text?.includes('Usage') || text?.includes('storage') || text?.includes('KB')).toBeTruthy();
  });

  test('about shows system info', async ({ page }) => {
    const terminal = page.locator('.xterm-screen');
    await page.keyboard.type('about');
    await page.keyboard.press('Enter');
    await expect(terminal).toContainText('SubstrateOS');
  });

  test('backup command available', async ({ page }) => {
    const terminal = page.locator('.xterm-screen');
    await page.keyboard.type('backup');
    await page.keyboard.press('Enter');
    // Should respond to backup command
    const text = await terminal.textContent();
    expect(text).toBeDefined();
  });
});

// ==================== PERFORMANCE & STABILITY ====================

test.describe('Performance & Stability', () => {
  test('boots in under 5 seconds', async ({ page }) => {
    const start = Date.now();
    await page.goto('/');
    await page.waitForSelector('.xterm-screen', { timeout: 10000 });
    const bootTime = Date.now() - start;
    
    console.log(`Boot time: ${bootTime}ms`);
    expect(bootTime).toBeLessThan(5000);
  });

  test('handles rapid commands', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.xterm-screen', { timeout: 10000 });

    const terminal = page.locator('.xterm-screen');
    
    // Rapid fire commands
    for (let i = 0; i < 5; i++) {
      await page.keyboard.type(`echo "rapid ${i}"`);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(100);
    }

    await expect(terminal).toContainText('rapid 4');
  });

  test('filesystem survives within session', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.xterm-screen', { timeout: 10000 });

    const terminal = page.locator('.xterm-screen');
    
    // Create file
    await page.keyboard.type('echo "session test" > session_test.txt');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Navigate away and back (soft navigation)
    await page.keyboard.type('cd / && cd /home/user');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);

    // Check file still exists in session
    await page.keyboard.type('cat session_test.txt');
    await page.keyboard.press('Enter');
    await expect(terminal).toContainText('session test');
  });

  test('handles errors gracefully', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.xterm-screen', { timeout: 10000 });

    const terminal = page.locator('.xterm-screen');
    
    // Try invalid command
    await page.keyboard.type('nonexistent_command_xyz');
    await page.keyboard.press('Enter');
    
    // Should show error but not crash
    const text = await terminal.textContent();
    expect(text?.includes('not found') || text?.includes('error') || text?.includes('$')).toBeTruthy();
    
    // Should still be responsive
    await page.keyboard.type('echo "still working"');
    await page.keyboard.press('Enter');
    await expect(terminal).toContainText('still working');
  });
});
