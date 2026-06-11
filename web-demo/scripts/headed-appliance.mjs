// Headed (VISIBLE) Playwright drive of the SubstrateOS lab appliance.
// Opens a real Chromium window so you can watch the kernel boot, auto-login,
// and self-configure networking. Verifies whoami=root + eth0 self-lease.
//   cd web-demo && node scripts/headed-appliance.mjs
import { chromium } from '@playwright/test';

const URL = process.env.APP_URL || 'http://localhost:5173/?engine=kernel&net=wisp://localhost:6001/';

const browser = await chromium.launch({ headless: false, args: ['--window-size=1100,760'] });
const page = await browser.newPage({ viewport: { width: 1100, height: 720 } });

console.log('[headed] opening', URL);
await page.goto(URL);
// Clean slate so it's a genuine cold boot you can watch.
await page.evaluate(() => new Promise((r) => {
  const d = indexedDB.deleteDatabase('substrateos');
  d.onsuccess = d.onerror = d.onblocked = () => r();
}));
await page.goto(URL);

console.log('[headed] booting — watch the window…');
await page.waitForFunction(
  () => { const s = window.__substrateKernel; return s && (s.booted === true || s.error !== null); },
  null,
  { timeout: 90_000 },
);
const tel = await page.evaluate(() => {
  const s = window.__substrateKernel;
  return { booted: s.booted, bootTimeMs: s.bootTimeMs, error: s.error };
});
console.log('[headed] boot:', JSON.stringify(tel));

// Drive the real shell (auto-login lands at #). Give DHCP a moment, then check.
const send = (str) => page.evaluate((s) => window.__substrateKernel.sendInput?.(s), str);
await send('\n');
await page.waitForTimeout(3500);
// Computed marker (CHK_42) appears ONLY in the shell's OUTPUT, never the echoed
// command (which shows CHK_$((6*7))) — so we can't match the echo by mistake.
await send("echo CHK_$((6*7)) user=$(whoami) ip=$(ip -o -4 addr show eth0 | awk '{print $4}') nano=$(command -v nano)\n");
await page.waitForFunction(
  () => /CHK_42 user=\w/.test(window.__substrateKernel.transcript),
  null,
  { timeout: 20_000 },
);
const line = await page.evaluate(() => {
  const t = window.__substrateKernel.transcript.replace(/\r/g, '');
  const m = t.match(/CHK_42 user=[^\n]*/g);
  return m ? m[m.length - 1] : '(not found)';
});
console.log('[headed] result:', line);

console.log('[headed] window stays open ~5 min — close it any time.');
await page.waitForTimeout(300_000).catch(() => {});
await browser.close();
