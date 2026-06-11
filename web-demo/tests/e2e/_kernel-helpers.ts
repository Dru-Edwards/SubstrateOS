import type { Page } from '@playwright/test';

/**
 * Shared helpers for driving the real v86 Linux kernel from Playwright.
 *
 * Input is delivered over the serial TTY, which is in canonical mode with a
 * ~255-char line limit (MAX_CANON). So scripts are base64-encoded and uploaded
 * in <200-char chunks appended to a file, then decoded and run — this survives
 * arbitrary length, quoting, and newlines.
 */

export async function bootKernel(page: Page, opts: { net?: string } = {}): Promise<void> {
  const q = opts.net ? `&net=${encodeURIComponent(opts.net)}` : '';
  await page.goto(`/?engine=kernel${q}`);
  await page.waitForFunction(
    () => { const s = (window as any).__substrateKernel; return !!s && (s.booted === true || s.error !== null); },
    null,
    { timeout: 90_000 },
  );
  const err = await page.evaluate(() => (window as any).__substrateKernel.error);
  if (err) throw new Error('kernel boot failed: ' + err);
  // Cold boot lands at a login prompt; warm restore lands already logged in.
  await page.evaluate(async () => {
    const s = (window as any).__substrateKernel;
    if (/login:\s*$/.test(s.transcript)) {
      s.sendInput('root\n');
      await new Promise((f) => setTimeout(f, 1500));
    }
    s.sendInput('\n');
    await new Promise((f) => setTimeout(f, 400));
  });
}

/** Run a shell script in the VM and return the stdout between unique markers. */
export async function runScript(page: Page, script: string, waitMs = 25_000): Promise<string> {
  return page.evaluate(
    async ({ src, waitMs }) => {
      const s = (window as any).__substrateKernel;
      const id = 'MK' + Math.floor(performance.now()).toString(36) + Math.floor(Math.random() * 1e9).toString(36);
      const full = `echo ${id}_S\n${src}\necho ${id}_E\n`;
      const b64 = btoa(full);
      s.sendInput(': > /tmp/run.b64\n');
      await new Promise((f) => setTimeout(f, 120));
      for (let i = 0; i < b64.length; i += 150) {
        s.sendInput("printf %s '" + b64.slice(i, i + 150) + "' >> /tmp/run.b64\n");
        await new Promise((f) => setTimeout(f, 55));
      }
      await new Promise((f) => setTimeout(f, 200));
      s.sendInput('base64 -d /tmp/run.b64 | sh\n');
      const deadline = performance.now() + waitMs;
      while (performance.now() < deadline) {
        if (s.transcript.includes(id + '_E')) break;
        await new Promise((f) => setTimeout(f, 200));
      }
      const t: string = s.transcript;
      const a = t.lastIndexOf(id + '_S');
      const b = t.lastIndexOf(id + '_E');
      return a >= 0 && b > a ? t.slice(a + id.length + 2, b) : '';
    },
    { src: script, waitMs },
  );
}

export interface Check { name: string; expr: string; want: string }
export interface CheckResult { got: string; pass: boolean }

/**
 * Run a batch of equality checks. Each `expr` is shell that produces a value
 * (e.g. "$(cd /etc && pwd)") compared against `want`. Avoid double-quotes inside
 * `expr` (it is wrapped in double-quotes); use single-quotes within $() instead.
 */
export async function runChecks(page: Page, checks: Check[]): Promise<Record<string, CheckResult>> {
  const lines = ['ck() { if [ "$2" = "$3" ]; then echo "PASS__$1"; else echo "FAIL__$1__[$2]"; fi; }'];
  for (const c of checks) lines.push(`ck ${c.name} "${c.expr}" '${c.want}'`);
  const out = await runScript(page, lines.join('\n'));
  const res: Record<string, CheckResult> = {};
  for (const c of checks) {
    if (new RegExp(`PASS__${c.name}(?:\\s|$)`, 'm').test(out)) {
      res[c.name] = { got: c.want, pass: true };
    } else {
      const m = out.match(new RegExp(`FAIL__${c.name}__\\[([^\\]]*)\\]`));
      res[c.name] = { got: m ? m[1] : '(no output)', pass: false };
    }
  }
  return res;
}

/** Which of `cmds` are present (command -v). Returns { have, miss }. */
export async function probeCommands(page: Page, cmds: string[]): Promise<{ have: string[]; miss: string[] }> {
  const out = await runScript(
    page,
    `for c in ${cmds.join(' ')}; do command -v "$c" >/dev/null 2>&1 && echo "H_$c" || echo "M_$c"; done`,
  );
  const have: string[] = [];
  const miss: string[] = [];
  for (const c of cmds) {
    if (new RegExp(`H_${c}(?:\\s|$)`, 'm').test(out)) have.push(c);
    else miss.push(c);
  }
  return { have, miss };
}
