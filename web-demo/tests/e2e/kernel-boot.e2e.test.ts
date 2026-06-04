import { test, expect } from '@playwright/test';

/**
 * Gate G1 — proves SubstrateOS boots a REAL Linux kernel through its own UI.
 *
 * Drives the real KernelSession via the window.__substrateKernel.sendInput seam
 * (set up in main.ts kernel mode) so the test doesn't depend on xterm focus.
 *
 * NOTE: with the Phase-0 DEV image (kernel 2.6) the final "modern kernel" assertion
 * FAILS BY DESIGN — that failure is what makes G1 genuinely depend on Task 7's
 * Buildroot 6.6 image. Once substrate.iso is the modern image, this goes green.
 */
test('boots a real Linux kernel through the SubstrateOS UI and reports a modern uname', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/?engine=kernel');

  // KernelSession.boot() resolves when a login/shell prompt is detected.
  await page.waitForFunction(
    () => (window as any).__substrateKernel?.booted === true,
    null,
    { timeout: 90_000 },
  );

  const bootTimeMs: number = await page.evaluate(() => (window as any).__substrateKernel.bootTimeMs);
  expect(bootTimeMs, 'bootTimeMs should be recorded once the kernel is ready').toBeGreaterThan(0);

  const send = (s: string) =>
    page.evaluate((str) => (window as any).__substrateKernel.sendInput?.(str), s);

  // Log in if the image shows a login prompt (dev + buildroot both do), then ask the kernel.
  const needsLogin = await page.evaluate(() => /login:/i.test((window as any).__substrateKernel.transcript));
  if (needsLogin) {
    await send('root\n');
    await page.waitForTimeout(2500);
  }
  await send('uname -r\n');
  await page.waitForTimeout(3000);

  const transcript: string = await page.evaluate(() => (window as any).__substrateKernel.transcript);
  const m = transcript.match(/\b(\d+)\.(\d+)\.\d+/);
  expect(m, `no kernel version found in transcript tail:\n${transcript.slice(-500)}`).not.toBeNull();

  const major = Number(m![1]);
  // GATE G1: a modern (>= 5.x) kernel is required for the product.
  expect(major, `kernel major version was ${major}; need >= 5 (modern Buildroot image, Task 7)`).toBeGreaterThanOrEqual(5);
});
