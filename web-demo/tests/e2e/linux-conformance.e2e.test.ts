import { test, expect, type Page } from '@playwright/test';
import { bootKernel, runChecks, probeCommands, type Check } from './_kernel-helpers';

/**
 * Linux distro conformance suite.
 *
 * Boots the real kernel ONCE (serial mode) and verifies a user can do the same
 * core tasks they would on any Linux box. Six domains are hard assertions (they
 * MUST behave like Linux). Two audits report the command matrix and the known
 * capability gaps (networking transport, packages, languages) without failing —
 * those are roadmap items (Phase 3+), not regressions.
 */

let page: Page;

test.describe.serial('Linux distro conformance', () => {
  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await bootKernel(page);
  });
  test.afterAll(async () => { await page?.close(); });

  async function assertAll(checks: Check[]) {
    const r = await runChecks(page, checks);
    const failures = Object.entries(r).filter(([, v]) => !v.pass).map(([k, v]) => `${k}=[${v.got}]`);
    expect(failures, `failed checks: ${failures.join(', ')}`).toEqual([]);
  }

  test('filesystem & navigation', async () => {
    await assertAll([
      { name: 'pwd', expr: '$(cd /etc && pwd)', want: '/etc' },
      { name: 'mkdirrmdir', expr: '$(mkdir -p /tmp/cf/a/b && rmdir /tmp/cf/a/b && echo ok)', want: 'ok' },
      { name: 'cp', expr: '$(echo z > /tmp/cf1; cp /tmp/cf1 /tmp/cf2; cat /tmp/cf2)', want: 'z' },
      { name: 'mv', expr: '$(echo m > /tmp/cfm; mv /tmp/cfm /tmp/cfm2; cat /tmp/cfm2)', want: 'm' },
      { name: 'rm', expr: '$(touch /tmp/cfr; rm /tmp/cfr; [ -e /tmp/cfr ] || echo gone)', want: 'gone' },
      { name: 'symlink', expr: '$(ln -sf /etc/passwd /tmp/cfl; readlink /tmp/cfl)', want: '/etc/passwd' },
      { name: 'find', expr: '$(find /etc -name passwd 2>/dev/null | head -1)', want: '/etc/passwd' },
      { name: 'glob', expr: '$(cd /tmp; touch gg1 gg2; ls gg* | wc -l)', want: '2' },
      { name: 'du', expr: '$(du -s /etc >/dev/null 2>&1 && echo ok)', want: 'ok' },
      // NOTE: `df /` errors on the initramfs rootfs (busybox quirk); `df` and `df /tmp` work.
      { name: 'df', expr: '$(df /tmp >/dev/null 2>&1 && echo ok)', want: 'ok' },
    ]);
  });

  test('text processing', async () => {
    await assertAll([
      { name: 'grep', expr: "$(printf 'a\\nbb\\nc\\n' | grep bb)", want: 'bb' },
      { name: 'sed', expr: '$(echo foo | sed s/o/0/g)', want: 'f00' },
      { name: 'awk', expr: "$(echo '1 2 3' | awk '{print $1+$3}')", want: '4' },
      { name: 'cut', expr: '$(echo a-b-c | cut -d- -f3)', want: 'c' },
      { name: 'sort', expr: "$(printf '3\\n1\\n2\\n' | sort | tr -d '\\n')", want: '123' },
      { name: 'uniq', expr: "$(printf 'a\\na\\nb\\n' | uniq | wc -l)", want: '2' },
      { name: 'wcwords', expr: "$(printf 'a b c' | wc -w)", want: '3' },
      { name: 'head', expr: '$(seq 5 | head -1)', want: '1' },
      { name: 'tail', expr: '$(seq 5 | tail -1)', want: '5' },
      { name: 'tr', expr: '$(echo abc | tr a-z A-Z)', want: 'ABC' },
      { name: 'tee', expr: '$(echo tt | tee /tmp/cft >/dev/null; cat /tmp/cft)', want: 'tt' },
    ]);
  });

  test('shell scripting', async () => {
    await assertAll([
      { name: 'arithmod', expr: '$(echo $((10%3)))', want: '1' },
      { name: 'forloop', expr: '$(for i in 1 2 3; do printf %s $i; done)', want: '123' },
      { name: 'whileloop', expr: '$(i=0; while [ $i -lt 4 ]; do i=$((i+1)); done; echo $i)', want: '4' },
      { name: 'case', expr: '$(x=2; case $x in 2) echo two;; *) echo no;; esac)', want: 'two' },
      { name: 'func', expr: '$(g() { echo $(($1*2)); }; g 21)', want: '42' },
      { name: 'andor', expr: '$(false || echo fallback)', want: 'fallback' },
      { name: 'exitcode', expr: '$(sh -c "exit 7"; echo $?)', want: '7' },
      { name: 'strlen', expr: '$(s=hello; echo ${#s})', want: '5' },
      { name: 'strstrip', expr: '$(s=hello; echo ${s%llo})', want: 'he' },
      { name: 'param', expr: "$(set -- a b c; echo $2)", want: 'b' },
      { name: 'heredoc', expr: '$(cat <<EOF\nhd\nEOF\n)', want: 'hd' },
    ]);
  });

  test('permissions & users', async () => {
    await assertAll([
      { name: 'chmod644', expr: '$(touch /tmp/cfp; chmod 644 /tmp/cfp; ls -l /tmp/cfp | cut -c1-10)', want: '-rw-r--r--' },
      { name: 'chmodx', expr: '$(printf \'#!/bin/sh\\necho ran\\n\' > /tmp/cfx; chmod +x /tmp/cfx; /tmp/cfx)', want: 'ran' },
      { name: 'noexec', expr: '$(echo nope > /tmp/cfn; chmod 644 /tmp/cfn; /tmp/cfn 2>/dev/null || echo denied)', want: 'denied' },
      { name: 'whoami', expr: '$(whoami)', want: 'root' },
      { name: 'uid', expr: '$(id -u)', want: '0' },
      { name: 'chown', expr: '$(touch /tmp/cfo; chown root /tmp/cfo && echo ok)', want: 'ok' },
    ]);
  });

  test('processes & system', async () => {
    await assertAll([
      { name: 'uname', expr: '$(uname -s)', want: 'Linux' },
      { name: 'bgkill', expr: '$(sleep 30 & p=$!; kill $p 2>/dev/null && echo killed)', want: 'killed' },
      { name: 'ps', expr: '$(ps >/dev/null 2>&1 && echo ok)', want: 'ok' },
      { name: 'procfs', expr: '$(cat /proc/sys/kernel/ostype)', want: 'Linux' },
      { name: 'uptime', expr: '$(grep -c . /proc/uptime)', want: '1' },
      { name: 'envvar', expr: '$(export FOO=bar; env | grep ^FOO=)', want: 'FOO=bar' },
      { name: 'mount', expr: '$(mount >/dev/null 2>&1 && echo ok)', want: 'ok' },
      { name: 'date', expr: '$(date +%Y | cut -c1-2)', want: '20' },
    ]);
  });

  test('archives & compression', async () => {
    await assertAll([
      { name: 'tar', expr: '$(echo h1 > /tmp/ta.txt; tar -cf /tmp/ta.tar -C /tmp ta.txt; rm /tmp/ta.txt; tar -xf /tmp/ta.tar -C /tmp; cat /tmp/ta.txt)', want: 'h1' },
      // busybox tar has no -z; gzipped tarballs work via the portable pipe idiom.
      { name: 'targz_pipe', expr: '$(echo h2 > /tmp/tg.txt; tar -cf - -C /tmp tg.txt | gzip > /tmp/tg.tgz; zcat /tmp/tg.tgz | tar -tf -)', want: 'tg.txt' },
      { name: 'gzip', expr: '$(echo g3 > /tmp/gz.txt; gzip /tmp/gz.txt; gunzip /tmp/gz.txt.gz; cat /tmp/gz.txt)', want: 'g3' },
      { name: 'zcat', expr: '$(echo g4 | gzip -c | zcat)', want: 'g4' },
    ]);
  });

  // ---- Audit 1: command availability matrix (reports; asserts only the core set) ----
  test('command availability audit', async () => {
    const core = 'sh ls cat echo cd pwd mkdir rm cp mv touch ln find chmod chown grep sed awk cut sort uniq wc head tail tr tee diff vi tar gzip gunzip ps kill top uname hostname date env whoami id mount free which xargs sleep seq printf test du df';
    const extra = 'stat nano bzip2 zip groups sudo curl ss nc ssh wget ping ifconfig ip route netstat nslookup apt opkg apk pip python python3 node npm gcc cc make git perl ruby lua crond fdisk blkid md5sum sha256sum bc';
    const all = (core + ' ' + extra).split(/\s+/);
    const { have, miss } = await probeCommands(page, all);
    // eslint-disable-next-line no-console
    console.log(`[CONFORMANCE] commands present: ${have.length}/${all.length}\n  HAVE: ${have.join(' ')}\n  MISS: ${miss.join(' ')}`);
    // The core POSIX toolset MUST be present.
    const coreMiss = core.split(/\s+/).filter((c) => miss.includes(c));
    expect(coreMiss, `core commands missing: ${coreMiss.join(', ')}`).toEqual([]);
  });

  // ---- Audit 2: extended capability gaps (reports only — Phase 3+ roadmap) ----
  test('extended capability audit (gaps are roadmap, not failures)', async () => {
    const r = await runChecks(page, [
      { name: 'net_iface', expr: "$(ip -o link show 2>/dev/null | grep -vc ' lo:')", want: '__report__' },
      { name: 'net_http', expr: '$(wget -T 2 -q -O - http://example.com 2>/dev/null | head -c 10 || echo NONE)', want: '__report__' },
      { name: 'pkg_mgr', expr: '$(for p in apt opkg apk; do command -v $p >/dev/null 2>&1 && echo $p; done | head -1)', want: '__report__' },
      { name: 'languages', expr: '$(for p in python python3 node perl gcc make; do command -v $p >/dev/null 2>&1 && printf "%s " $p; done)', want: '__report__' },
    ]);
    // eslint-disable-next-line no-console
    console.log(`[CONFORMANCE] extended capabilities (reported, not asserted):\n  network interfaces: ${r.net_iface.got}\n  network HTTP transport: ${r.net_http.got || '(none — needs Phase 3 proxy)'}\n  package manager: ${r.pkg_mgr.got || '(none)'}\n  languages/compilers: ${r.languages.got || '(none)'}`);
    expect(true).toBe(true);
  });
});
