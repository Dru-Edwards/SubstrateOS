import { test, expect } from '@playwright/test';

/**
 * Gate G1 — proves SubstrateOS boots a real, modern Linux kernel to an
 * INTERACTIVE shell (not just emits boot text) via ?engine=kernel.
 *
 * Hardened after a panicking kernel once passed a looser version of this test:
 *  - waits for booted OR error (so a panic fails fast instead of timing out),
 *  - hard-fails on "Kernel panic" and on a recorded boot error,
 *  - proves a real shell with a COMPUTED marker (`$((6*7))` + `$(uname -r)`),
 *    which the boot log can never contain, and reads the kernel version from
 *    that shell output rather than the kernel's own boot banner.
 */
test('boots a real modern Linux kernel to an interactive shell (no panic)', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/?engine=kernel');

  // Boot resolves at the login prompt, or the app records an error (panic/timeout).
  await page.waitForFunction(
    () => {
      const s = (window as any).__substrateKernel;
      return s && (s.booted === true || s.error !== null);
    },
    null,
    { timeout: 90_000 },
  );

  const tel = await page.evaluate(() => {
    const s = (window as any).__substrateKernel;
    return { booted: s.booted, error: s.error, bootTimeMs: s.bootTimeMs, transcript: s.transcript as string };
  });

  // A panic or boot error must NOT pass the gate.
  expect(tel.error, `kernel boot error: ${tel.error}`).toBeNull();
  expect(tel.transcript, 'kernel panicked during boot').not.toMatch(/Kernel panic/i);
  expect(tel.booted, 'kernel did not reach a login prompt').toBe(true);
  expect(tel.transcript, 'never reached a login prompt').toMatch(/login:/i);
  expect(tel.bootTimeMs).toBeGreaterThan(0);

  // Prove an INTERACTIVE shell: log in, then emit a marker the shell must COMPUTE.
  const send = (s: string) =>
    page.evaluate((str) => (window as any).__substrateKernel.sendInput?.(str), s);
  await send('root\n');
  await page.waitForTimeout(1500);
  await send('echo READY_$((6*7))_$(uname -r)\n');

  // The marker only appears if the shell evaluated arithmetic + ran uname.
  await page.waitForFunction(
    () => /READY_42_\d+\.\d+/.test((window as any).__substrateKernel.transcript),
    null,
    { timeout: 20_000 },
  );

  const transcript: string = await page.evaluate(() => (window as any).__substrateKernel.transcript);
  const m = transcript.match(/READY_42_(\d+)\.(\d+)\.\d+/);
  expect(m, `shell did not emit the computed marker:\n${transcript.slice(-400)}`).not.toBeNull();

  // GATE G1: a modern (>= 5.x) kernel, as reported by uname THROUGH the shell.
  expect(Number(m![1]), `kernel major version was ${m![1]}; need >= 5`).toBeGreaterThanOrEqual(5);
});
