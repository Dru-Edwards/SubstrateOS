import { test, expect } from '@playwright/test';

/**
 * Gate G2 — a file created in the kernel survives a full page reload.
 *
 * Cold boot → login → create a marked file → snapshot to IndexedDB → reload
 * (the VM is destroyed; only the compressed snapshot persists) → warm-restore →
 * the file is still there. Warm boot must be faster than cold.
 */
const MARK = 'PERSIST_OK_'; // followed by 9*9 = 81 (computed by the shell)

const boot = async (page: import('@playwright/test').Page) =>
  page.waitForFunction(
    () => { const s = (window as any).__substrateKernel; return !!s && (s.booted === true || s.error !== null); },
    null,
    { timeout: 90_000 },
  );
const tel = (page: import('@playwright/test').Page) =>
  page.evaluate(() => { const s = (window as any).__substrateKernel; return { booted: s.booted, error: s.error, bootTimeMs: s.bootTimeMs }; });
const send = (page: import('@playwright/test').Page, s: string) =>
  page.evaluate((str) => (window as any).__substrateKernel.sendInput?.(str), s);

test('a file created in the kernel survives a page reload', async ({ page }) => {
  test.setTimeout(180_000);

  // Start clean so the first load is a genuine cold boot.
  await page.goto('/?engine=kernel');
  await page.evaluate(() => new Promise((res) => {
    const r = indexedDB.deleteDatabase('substrateos');
    r.onsuccess = r.onerror = r.onblocked = () => res(null);
  }));
  await page.reload();

  // --- Cold boot ---
  await boot(page);
  let t = await tel(page);
  expect(t.error, `boot error: ${t.error}`).toBeNull();
  expect(t.booted).toBe(true);
  const coldMs = t.bootTimeMs as number;

  await send(page, 'root\n');
  await page.waitForTimeout(1500);
  await send(page, `echo ${MARK}$((9*9)) > /root/persist_test\n`);
  await page.waitForTimeout(1200);

  // Snapshot to IndexedDB (saveSnapshot resolves when the compressed blob is stored).
  await page.evaluate(() => (window as any).__substrateKernel.saveSnapshot());

  // --- Reload: VM gone, only the snapshot remains ---
  await page.reload();

  // --- Warm restore ---
  await boot(page);
  t = await tel(page);
  expect(t.error, `warm boot error: ${t.error}`).toBeNull();
  expect(t.booted).toBe(true);
  const warmMs = t.bootTimeMs as number;

  // The restored VM is already logged in — read the file straight back.
  await send(page, 'cat /root/persist_test\n');
  await page.waitForFunction(
    (mark) => new RegExp(mark + '81').test((window as any).__substrateKernel.transcript),
    MARK,
    { timeout: 20_000 },
  );
  const transcript: string = await page.evaluate(() => (window as any).__substrateKernel.transcript);
  expect(transcript, 'file did not survive the reload').toMatch(new RegExp(MARK + '81'));

  // Warm boot (restore) must be faster than a full cold boot.
  expect(warmMs, `warm ${warmMs}ms should be < cold ${coldMs}ms`).toBeLessThan(coldMs);
  // eslint-disable-next-line no-console
  console.log(`[G2] cold=${coldMs}ms warm=${warmMs}ms`);
});
