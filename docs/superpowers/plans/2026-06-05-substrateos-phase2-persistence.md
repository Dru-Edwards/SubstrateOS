# SubstrateOS Phase 2 — Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Persist the kernel VM across page reloads — snapshot VM state to IndexedDB and warm-restore on next load — so files/changes survive (the initramfs rootfs is otherwise volatile).

**Architecture:** v86 exposes `save_state(): Promise<ArrayBuffer>` and `restore_state(buf)`. `KernelSession` gains `saveState()` and an `initialState` option (restore-on-boot). A small IndexedDB helper stores the snapshot blob keyed by image id. `main.ts` loads any saved snapshot → passes as `initialState` (warm boot, skips cold boot) and saves a snapshot on an explicit trigger (snapshot button + `beforeunload`).

**Tech Stack:** TypeScript, vitest (SDK unit tests with a fake emu), `fake-indexeddb` or web-demo e2e for the store, Playwright (Gate G2), v86 save/restore.

**Branch:** continue on `feat/kernel-spike`. Commits local, `-c commit.gpgsign=false`, never pushed.

**Gate G2:** A Playwright e2e: boot kernel → `echo persisted > /root/x` → trigger snapshot (saved to IndexedDB) → reload page → warm-restore → `cat /root/x` prints `persisted`. Warm-boot (restore) completes in < 2s.

---

## Task 1: KernelSession.saveState() + initialState restore (SDK, TDD)

**Files:** modify `packages/runtime-sdk/src/kernel/{types.ts,kernel-session.ts}`; tests in `kernel-session.test.ts`.

- `V86Like` gains OPTIONAL `save_state?(): Promise<ArrayBuffer>` and `restore_state?(s: ArrayBuffer): Promise<void>` (optional so existing fake emus/tests still satisfy the type).
- `KernelSessionOptions` gains `initialState?: ArrayBuffer`.
- `KernelSession.saveState(): Promise<ArrayBuffer>` — throws if `!this.emu?.save_state`; else returns `this.emu.save_state()`.
- `boot()`: if `this.opts.initialState` is set, after creating the emulator `await this.emu.restore_state(initialState)`, then mark booted immediately (`bootTimeMs` = restore elapsed via injected `now`), resolve, and `serial0_send('\n')` to elicit a fresh prompt. If not set, the existing cold-boot prompt-detection path runs unchanged.
- Tests (fake emu adds `save_state`/`restore_state` vi.fns): (a) `saveState()` forwards to `emu.save_state` and returns its value; (b) `saveState()` throws before boot; (c) boot with `initialState` calls `restore_state(buf)`, resolves booted without waiting for a prompt, and sends a newline; (d) boot without `initialState` still uses prompt detection (existing tests stay green).

## Task 2: IndexedDB snapshot store (TDD)

**Files:** create `packages/runtime-sdk/src/kernel/snapshot-store.ts` (+ test). Use the IndexedDB API; test with `fake-indexeddb` (add as devDep ONLY if the store mismatch allows — otherwise put this helper + its test in `web-demo` and cover it via the Gate-G2 e2e instead).
- `saveSnapshot(key: string, bytes: ArrayBuffer): Promise<void>` and `loadSnapshot(key: string): Promise<ArrayBuffer | null>` against a `substrateos` DB / `snapshots` store.
- Key by a stable image id (e.g. `'buildroot-6.6'`).

## Task 3: Wire persistence into main.ts

**Files:** modify `web-demo/src/main.ts`.
- In `attachKernel`: `await loadSnapshot(IMAGE_KEY)`; if present, pass `initialState` to `KernelSession`. Expose `kernelTelemetry.saveSnapshot = async () => saveSnapshot(IMAGE_KEY, await session.saveState())`.
- Add a "Snapshot" affordance (button or `beforeunload` handler) that calls the save path. Guard all of it behind kernel mode.

## Task 4: Gate G2 e2e

**Files:** create `web-demo/tests/e2e/kernel-persistence.e2e.test.ts`.
- Boot (`?engine=kernel`), wait booted, `sendInput('echo persisted > /root/x\n')`, trigger snapshot via the telemetry hook, reload, wait warm-restore, `sendInput('cat /root/x\n')`, assert transcript contains `persisted`. Assert warm-boot < 2s.

**Acceptance:** G2 e2e green; existing 17 vitest + 22 e2e still green; build clean.
