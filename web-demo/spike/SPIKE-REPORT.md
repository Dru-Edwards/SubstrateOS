# SubstrateOS — Phase 0 Kernel Spike Report

> **UPDATE 2026-06-05 — Phase 1 Gate G1 PASSED.** The real kernel path is built:
> `KernelSession` (`@substrateos/runtime`) boots a **modern Buildroot 6.6** image
> (`bzImage` + `rootfs.cpio.gz`, `console=ttyS0`) in the browser via `?engine=kernel`,
> and the Playwright gate `web-demo/tests/e2e/kernel-boot.e2e.test.ts` is green
> (`uname` ≥ 5). The image is reproduced by `image/build.sh` (native WSL Buildroot).
> Default engine stays `sim` until a later phase. See the program spec for Phases 2–6.

**Date:** 2026-06-03
**Branch:** `feat/kernel-spike` (local only, never pushed)
**Goal:** Prove that a *real Linux kernel* can boot in-browser and pipe its TTY
through SubstrateOS's existing terminal layer (xterm.js) — de-risking the
"true Linux kernel" completion path before committing to the full build.

---

## Result: PROVEN ✅

A genuine Linux kernel booted in a real browser (via Playwright) and reached an
interactive shell wired to xterm.js — the same terminal `web-demo/src/main.ts`
already uses. This is a real kernel, not a command simulator.

### Evidence (captured live from the running VM)

```
Welcome to Buildroot
(none) login: root

/root% uname -a
Linux (none) 2.6.34.14 #55 Fri Jul 11 09:36:45 CEST 2014 i686 GNU/Linux

/root% cat /proc/version
Linux version 2.6.34.14 (gcc version 4.9.0 20140604) #55 ...

/root% free -m
             total    used    free
Mem:           124       6     117      <- matches the 128MB allocated to the VM

/root% nproc
-sh: nproc: not found                    <- real busybox: real "command not found"
```

Real kernel, real syscalls, real `/proc` accounting, interactive stdin/stdout.
Screenshot artifact: `substrateos-v86-spike-proof.png`.

---

## What was built

- `web-demo/spike/index.html` — self-contained spike: loads the v86 engine,
  boots `linux.iso`, binds `serial0` output → `xterm.js`, and binds xterm
  keystrokes → kernel TTY. Exposes `window.__spike` telemetry for automated reads.
- `web-demo/spike/assets/` — vendored prebuilt engine + a real bootable image:
  | file | size | what |
  |---|---|---|
  | `v86.wasm` | 2.0 MB | x86→WASM JIT engine |
  | `libv86.js` | 340 KB | loader/API |
  | `seabios.bin` + `vgabios.bin` | 165 KB | BIOS |
  | `linux.iso` | 5.4 MB | **real** ISO-9660 Buildroot image (CD001 magic verified) |
- Served same-origin via `python -m http.server` (avoids vite HTML transforms + CORS).

## Measured (this image, localhost, Chromium via Playwright)

- **First kernel serial byte:** ~3.85 s after page load (includes WASM instantiate
  + BIOS + 5.4MB ISO fetch).
- **Boot to login prompt:** within the observation window (single-digit to low-teens
  seconds, typical for this image). *Not precisely instrumented — measure properly
  in Phase 1.* [confidence: probable]
- **First-load payload:** ~8 MB total (cacheable; subsequent loads near-instant).

## Honest caveats (do not skip)

1. **Demo image is ancient.** `linux.iso` is copy.sh's tiny 2.6.34 / i686 demo —
   chosen only because it boots fast and proves the pipeline. The **product** needs
   a purpose-built modern image (Buildroot/Alpine, recent LTS kernel, busybox or
   real coreutils, python/git via packages). That image build is a Phase 1 task.
2. **v86 is 32-bit only, ~Pentium-4 perf.** Acceptable for education / agent-sandbox
   / playground tiers. Not for heavy 64-bit workloads — that's the CheerpX/Enterprise
   conversation (see below).
3. **Networking not exercised** in this spike. v86 networking = NE2000 → WebSocket
   proxy you host. Proven technology, but it's a Phase 3 build, not free.
4. **Persistence not exercised.** v86 supports state save/restore + 9p/block FS;
   wiring it to IndexedDB (replacing the current sim VFS) is Phase 2.

---

## Verdict on the substrate decision (D1)

The spike confirms the recommendation: **v86 satisfies the literal "true Linux
kernel" standard** (it runs the real kernel), is **BSD/OSS (you own and sell it
with no license entanglement)**, and boots fast enough to feel instant after cache.
Its limits (32-bit, perf) map cleanly to a premium/Enterprise escape hatch on
CheerpX if a customer ever needs 64-bit/throughput.

Recommended: **adopt v86 as the SubstrateOS kernel substrate.** Evaluate CheerpX
only as an optional Enterprise-tier engine (pricing inquiry drafted separately).
Track WASM-native kernel ports (WasmLinux / mainline wasm-arch) as the 2.0 target.

## Next (Phase 1, ~3–5 weeks)

1. Build a modern product image (Buildroot/Alpine + recent kernel + toolset).
2. Replace the simulated command interpreter in `runtime-sdk` with the v86 TTY
   bridge; keep xterm.js, tabs, and the surrounding UI.
3. Instrument real boot metrics; add a boot-state snapshot so warm loads skip cold boot.
4. Keep the Lemon Squeezy store in TEST mode until Phase 4 truth-aligns the tiers.
