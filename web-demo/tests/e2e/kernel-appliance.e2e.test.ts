import { test, expect } from '@playwright/test';
import { bootKernel, runChecks } from './_kernel-helpers';

/**
 * Lab-appliance gate: a cold boot must reach a usable ROOT SHELL with no manual
 * login (the education/embeds product needs "just works on load").
 *
 * Network-independent on purpose — auto-login doesn't need the WISP relay, so this
 * runs without the proxy. (Auto-DHCP / networking has its own Gate-G3 test that
 * brings up the relay.) The `42` marker is COMPUTED by the shell, so a boot-log
 * echo can't satisfy it.
 */
test('lab appliance: cold boot lands at a root shell with no manual login', async ({ page }) => {
  test.setTimeout(120_000);
  await bootKernel(page); // navigates ?engine=kernel, waits for booted (auto-login → no login prompt)

  const r = await runChecks(page, [
    { name: 'autologin_root', expr: '$(whoami)', want: 'root' },
    { name: 'real_shell', expr: '$(echo $((6*7)))', want: '42' },
    { name: 'editor_nano', expr: '$(command -v nano >/dev/null && echo yes)', want: 'yes' },
  ]);

  const fails = Object.entries(r).filter(([, v]) => !v.pass).map(([k, v]) => `${k}=[${v.got}]`);
  expect(fails, `failed: ${fails.join(', ')}`).toEqual([]);
});
