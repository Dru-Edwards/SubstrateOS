import { test, expect } from '@playwright/test';

/**
 * Embeddable-lab gate: a single URL launches a CONFIGURED kernel lab.
 *   ?files=<base64 JSON [{path,content}]>  preloads lesson files into the VM
 *   ?run=<base64 command>                  runs on boot
 * This is the surface the embed-SDK targets (it iframes a URL like this).
 *
 * The marker text appears ONLY from the run command's output (the file-write
 * commands carry it base64-encoded), so this can't pass on an echo.
 */
test('embeddable lab: ?files preloads lesson files and ?run executes on boot', async ({ page }) => {
  test.setTimeout(120_000);
  const files = btoa(JSON.stringify([{ path: '/root/lesson.txt', content: 'LAB_CONTENT_OK' }]));
  const run = btoa('cat /root/lesson.txt');
  await page.goto(`/?engine=kernel&files=${encodeURIComponent(files)}&run=${encodeURIComponent(run)}`);

  await page.waitForFunction(
    () => { const s = (window as any).__substrateKernel; return s && (s.booted === true || s.error !== null); },
    null,
    { timeout: 90_000 },
  );
  expect(await page.evaluate(() => (window as any).__substrateKernel.error)).toBeNull();

  // The decoded lesson content only appears if the file was written AND `run` ran it.
  await page.waitForFunction(
    () => /LAB_CONTENT_OK/.test((window as any).__substrateKernel.transcript),
    null,
    { timeout: 30_000 },
  );
  const t: string = await page.evaluate(() => (window as any).__substrateKernel.transcript);
  expect(t, 'preloaded lab file not shown by the run command').toMatch(/LAB_CONTENT_OK/);
});
