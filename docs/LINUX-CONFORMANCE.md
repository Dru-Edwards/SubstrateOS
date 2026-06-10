# SubstrateOS — Linux Distro Conformance Report

**Date:** 2026-06-10 · **Image:** Buildroot 2024.02.10, Linux 6.6.32 (i686), BusyBox 1.36.1
**Suite:** `web-demo/tests/e2e/linux-conformance.e2e.test.ts` (+ `_kernel-helpers.ts`)
**Run:** `cd web-demo && pnpm exec playwright test linux-conformance.e2e.test.ts`

## Verdict

**For everyday interactive Linux use, SubstrateOS behaves like a real Linux box.** All six
core-task domains pass (~55 functional checks): filesystem, text processing, shell scripting,
permissions, processes/system, and archives. A user can navigate, edit-via-redirection, script,
manage files/permissions, run processes, and pack/unpack archives exactly as on any distro.

The gaps to *full* distro parity are **capability gaps, not correctness gaps** — the kernel and
userland are genuine; what's missing is networking transport, a package manager, and language
runtimes. Those are roadmap items (Phase 3+), not bugs.

## What works (hard-asserted — must behave like Linux)

| Domain | Verified |
|---|---|
| **Filesystem & navigation** | `cd/pwd`, `mkdir -p/rmdir`, `cp/mv/rm`, symlinks (`ln -s`/`readlink`), `find`, globbing, `du`, `df` |
| **Text processing** | `grep`, `sed`, `awk`, `cut`, `sort`, `uniq`, `wc`, `head/tail`, `tr`, `tee`, pipes, redirection (`>`/`>>`/`<`) |
| **Shell scripting** | arithmetic `$(())`, `for`/`while`/`if`/`case`, functions, `&&`/`\|\|`, exit codes, `$?`, string ops `${#s}`/`${s%x}`, positional params, heredocs, executable `.sh` scripts |
| **Permissions & users** | `chmod` (incl. `+x` and exec-deny enforcement), `chown`, `whoami`/`id` (root, uid 0) |
| **Processes & system** | `uname`, background jobs + `kill`, `ps`, `/proc` (ostype, uptime), env vars, `mount`, `date` |
| **Archives & compression** | `tar` create/extract, `gzip`/`gunzip`/`zcat`, gzipped tarballs via the `tar -c \| gzip` pipe |

## Command availability — 63 / 88 probed present

**Present (63):** sh ls cat echo cd pwd mkdir rm cp mv touch ln find chmod chown grep sed awk cut
sort uniq wc head tail tr tee diff vi tar gzip gunzip ps kill top uname hostname date env whoami id
mount free which xargs sleep seq printf test du df wget ping ifconfig ip route netstat nslookup
crond fdisk blkid md5sum sha256sum bc

**Missing (25):** stat nano bzip2 zip groups sudo curl ss nc ssh apt opkg apk pip python python3 node
npm gcc cc make git perl ruby lua

## Gap analysis → path to full parity

| Gap | Severity | What it blocks | Path to close |
|---|---|---|---|
| **Networking transport** | High | `wget`/`ping`/`curl`/`git`/`ssh` reaching anything (tools + 2 NICs exist, but no link) | **Phase 3**: NE2000 → WebSocket-proxy bridge (ETI-hosted). Unblocks real `apt`/`git`/`curl`. |
| **No package manager** | High | installing anything at runtime (`apt`/`opkg`/`apk`) | Add an `opkg`/`apk` feed (needs networking) **or** bake a curated package set into the image. |
| **No language runtimes** | High | `python`/`node`/`perl`/`gcc`/`make` (dev work) | Build them into the Buildroot image (Python/Perl are Buildroot packages) **or** ship as installable packages once networking lands. |
| **Minor missing utils** | Low | `stat`, `sudo`, `groups`, `zip`, `bzip2`, `nano`, `curl`, `nc`, `ssh` | Enable the BusyBox applets / add Buildroot packages — a defconfig change + rebuild. |
| **BusyBox idiom quirks** | Low | `tar -z` (no gzip flag), `df /` errors on the initramfs root | Document the portable idioms (`tar -c \| gzip`, `df`/`df /tmp`), or enable `CONFIG_FEATURE_TAR_GZIP` + investigate rootfs `df`. |

## How the suite works (and why)

Input reaches the kernel over the serial TTY, which is canonical-mode with a ~255-char line
limit (`MAX_CANON`). So `runScript()` base64-encodes each script and uploads it in <200-char
chunks appended to a file, then `base64 -d | sh`. This survives arbitrary length, quoting, and
newlines — the only reliable way to drive non-trivial shell from the browser until a richer
host↔guest channel (e.g. 9p) is wired.

## Re-running

```bash
cd web-demo
pnpm exec playwright test linux-conformance.e2e.test.ts            # full suite
pnpm exec playwright test linux-conformance.e2e.test.ts --reporter=list   # see the matrix
```

The 6 core domains are a **regression gate** (fail if the platform stops behaving like Linux).
The two audits print the command matrix and extended-capability gaps each run.
