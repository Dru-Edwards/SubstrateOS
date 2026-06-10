import { describe, it, expect, vi } from 'vitest';
import { KernelSession } from './kernel-session';
import type { V86Like } from './types';

function makeFakeEmu() {
  const listeners: Record<string, (...args: any[]) => void> = {};
  const emu: V86Like = {
    add_listener: vi.fn((ev: string, cb: (...args: any[]) => void) => { listeners[ev] = cb; }),
    serial0_send: vi.fn(),
    stop: vi.fn(),
    save_state: vi.fn(async () => new ArrayBuffer(0)),
    restore_state: vi.fn(async () => {}),
  };
  return {
    emu,
    emit: (s: string) => { for (const ch of s) listeners['serial0-output-byte']?.(ch.charCodeAt(0)); },
    fire: (ev: string, ...args: any[]) => listeners[ev]?.(...args),
  };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('KernelSession', () => {
  it('builds the v86 config with vendored asset paths and memory', async () => {
    const { emu } = makeFakeEmu();
    const createEmulator = vi.fn(() => emu);
    const session = new KernelSession({ onOutput: () => {}, createEmulator, memoryMB: 256, assetBase: '/kernel' });
    void session.boot();
    expect(createEmulator).toHaveBeenCalledTimes(1);
    const cfg = createEmulator.mock.calls[0][0] as Record<string, unknown>;
    expect(cfg.wasm_path).toBe('/kernel/v86.wasm');
    expect(cfg.memory_size).toBe(256 * 1024 * 1024);
    expect((cfg.cdrom as any).url).toBe('/kernel/substrate.iso');
    expect(cfg.autostart).toBe(true);
  });

  it('streams serial output and resolves boot() with bootTimeMs when the prompt appears', async () => {
    const { emu, emit } = makeFakeEmu();
    let t = 1000;
    const now = () => t;
    const chunks: string[] = [];
    const session = new KernelSession({
      onOutput: (c) => chunks.push(c),
      createEmulator: () => emu,
      now,
    });
    const bootP = session.boot();
    expect(session.booted).toBe(false);
    emit('boot messages...\n');
    t = 1500;
    emit('\n/ # ');                 // busybox prompt
    const { bootTimeMs } = await bootP;
    expect(bootTimeMs).toBe(500);   // 1500 - 1000
    expect(session.booted).toBe(true);
    expect(chunks.join('')).toContain('/ # ');
  });

  it('forwards input to the kernel serial port', async () => {
    const { emu } = makeFakeEmu();
    const session = new KernelSession({ onOutput: () => {}, createEmulator: () => emu });
    void session.boot();
    session.sendInput('uname -a\n');
    expect(emu.serial0_send).toHaveBeenCalledWith('uname -a\n');
  });

  it('throws if input is sent before boot', () => {
    const session = new KernelSession({ onOutput: () => {}, createEmulator: () => makeFakeEmu().emu });
    expect(() => session.sendInput('x')).toThrow(/not started/i);
  });

  it('throws if input is sent after dispose', () => {
    const { emu } = makeFakeEmu();
    const session = new KernelSession({ onOutput: () => {}, createEmulator: () => emu });
    void session.boot();
    session.dispose();
    expect(() => session.sendInput('x')).toThrow(/not started/i);
  });

  it('dispose stops the emulator', async () => {
    const { emu } = makeFakeEmu();
    const session = new KernelSession({ onOutput: () => {}, createEmulator: () => emu });
    void session.boot();
    session.dispose();
    expect(emu.stop).toHaveBeenCalledTimes(1);
  });

  it('ignores serial output after dispose', () => {
    const { emu, emit } = makeFakeEmu();
    const chunks: string[] = [];
    const session = new KernelSession({ onOutput: (c) => chunks.push(c), createEmulator: () => emu });
    void session.boot();
    emit('hello');
    const before = chunks.length;
    session.dispose();
    emit('world');
    expect(chunks.length).toBe(before); // no output appended after dispose
  });

  it('uses imageConfig override instead of cdrom when provided', () => {
    const createEmulator = vi.fn(() => makeFakeEmu().emu);
    const session = new KernelSession({
      onOutput: () => {},
      createEmulator,
      imageConfig: { bzimage: { url: '/k/bzImage' }, initrd: { url: '/k/initrd' } },
    });
    void session.boot();
    const cfg = createEmulator.mock.calls[0][0] as Record<string, any>;
    expect(cfg.cdrom).toBeUndefined();
    expect(cfg.bzimage.url).toBe('/k/bzImage');
    expect(cfg.initrd.url).toBe('/k/initrd');
  });

  it('saveState() returns the emulator snapshot', async () => {
    const { emu } = makeFakeEmu();
    const snap = new ArrayBuffer(8);
    (emu.save_state as any).mockResolvedValue(snap);
    const session = new KernelSession({ onOutput: () => {}, createEmulator: () => emu });
    void session.boot();
    await expect(session.saveState()).resolves.toBe(snap);
    expect(emu.save_state).toHaveBeenCalledTimes(1);
  });

  it('saveState() throws before boot', async () => {
    const session = new KernelSession({ onOutput: () => {}, createEmulator: () => makeFakeEmu().emu });
    await expect(session.saveState()).rejects.toThrow(/not started/i);
  });

  it('boot() hands initialState to v86 as initial_state and resolves on emulator-ready', async () => {
    const { emu, fire } = makeFakeEmu();
    const state = new ArrayBuffer(16);
    const createEmulator = vi.fn(() => emu);
    let t = 100;
    const now = () => t;
    const session = new KernelSession({ onOutput: () => {}, createEmulator, initialState: state, now });
    const bootP = session.boot();
    const cfg = createEmulator.mock.calls[0][0] as Record<string, any>;
    // Restored through v86's own init via initial_state — NOT a manual restore_state.
    expect(cfg.initial_state.buffer).toBe(state);
    expect(emu.restore_state).not.toHaveBeenCalled();
    t = 130;
    fire('emulator-ready');
    const { bootTimeMs } = await bootP;
    expect(session.booted).toBe(true);
    expect(bootTimeMs).toBe(30); // 130 - 100
    expect(emu.serial0_send).toHaveBeenCalledWith('\n'); // prompt nudge
  });

  it('boot() resolves an async initialState thunk into v86 initial_state', async () => {
    const { emu, fire } = makeFakeEmu();
    const state = new ArrayBuffer(16);
    const createEmulator = vi.fn(() => emu);
    const session = new KernelSession({ onOutput: () => {}, createEmulator, initialState: async () => state });
    const bootP = session.boot();
    await tick(); // let the thunk resolve + the emulator construct
    const cfg = createEmulator.mock.calls[0][0] as Record<string, any>;
    expect(cfg.initial_state.buffer).toBe(state);
    fire('emulator-ready');
    await bootP;
    expect(session.booted).toBe(true);
  });

  it('boot() cold-boots when the initialState thunk returns null', async () => {
    const { emu, emit } = makeFakeEmu();
    const session = new KernelSession({ onOutput: () => {}, createEmulator: () => emu, initialState: async () => null });
    const bootP = session.boot();
    await tick(); // let the null thunk resolve + emulator construct + listener register
    emit('\n/ # '); // busybox prompt (default promptPattern)
    await bootP;
    expect(emu.restore_state).not.toHaveBeenCalled();
    expect(session.booted).toBe(true);
  });

  it('rejects boot() on a kernel panic instead of waiting for a prompt', async () => {
    const { emu, emit } = makeFakeEmu();
    const session = new KernelSession({ onOutput: () => {}, createEmulator: () => emu });
    const bootP = session.boot();
    emit('[    0.46] Kernel panic - not syncing: Attempted to kill the idle task!\n');
    await expect(bootP).rejects.toThrow(/panic/i);
    expect(session.booted).toBe(false);
  });

  it('rejects boot() if the prompt never appears within bootTimeoutMs', async () => {
    vi.useFakeTimers();
    try {
      const { emu } = makeFakeEmu();
      const session = new KernelSession({ onOutput: () => {}, createEmulator: () => emu, bootTimeoutMs: 5000 });
      const bootP = session.boot();
      const assertion = expect(bootP).rejects.toThrow(/timed out/i);
      await vi.advanceTimersByTimeAsync(5000);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });
});
