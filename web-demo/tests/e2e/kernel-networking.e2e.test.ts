import { test, expect } from '@playwright/test';
import { bootKernel, runScript } from './_kernel-helpers';

/**
 * Gate G3 — the VM reaches the real internet (HTTP + HTTPS) through ETI's own
 * hardened WISP proxy (started by playwright.config webServer on :6001).
 *
 * Auto-DHCP self-configures eth0; curl fetches over HTTP and HTTPS. Asserts the
 * actual page body, not just a status code — so a refused/empty stream can't pass.
 *
 * LOCAL ONLY: needs the v86 image binaries (gitignored) + outbound internet, so it
 * doesn't run in CI (same as the other kernel e2e).
 */
test('reaches the internet over HTTP and HTTPS through the hardened proxy', async ({ page }) => {
  test.setTimeout(150_000);
  await bootKernel(page, { net: 'wisp://localhost:6001/' });

  // Give the relay link + auto-DHCP a moment, then re-assert the lease, then fetch.
  const out = await runScript(
    page,
    [
      'udhcpc -i eth0 -n -q -t 8 -T 2 >/dev/null 2>&1',
      'echo "IP=$(ip -o -4 addr show eth0 | awk \'{print $4}\')"',
      'echo "HTTP=$(curl -sS -m 20 -o /dev/null -w \'%{http_code}\' http://example.com)"',
      'echo "HTTPS=$(curl -sS -m 20 -o /dev/null -w \'%{http_code}\' https://example.com)"',
      'echo "BODY=$(curl -sS -m 20 https://example.com | grep -o -m1 \'Example Domain\')"',
    ].join('\n'),
    40_000,
  );

  expect(out, `no DHCP lease:\n${out}`).toMatch(/IP=\d+\.\d+\.\d+\.\d+/);
  expect(out, `HTTP not 200:\n${out}`).toMatch(/HTTP=200/);
  expect(out, `HTTPS not 200:\n${out}`).toMatch(/HTTPS=200/);
  expect(out, `HTTPS body not fetched (real TLS content):\n${out}`).toMatch(/BODY=Example Domain/);
});
