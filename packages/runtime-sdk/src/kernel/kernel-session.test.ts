import { describe, it, expect, vi } from 'vitest';
import { KernelSession } from './kernel-session';
import type { V86Like } from './types';

function makeFakeEmu() {
  const listeners: Record<string, (b: number) => void> = {};
  const emu: V86Like = {
    add_listener: vi.fn((ev: string, cb: (b: number) => void) => { listeners[ev] = cb; }),
    serial0_send: vi.fn(),
    stop: vi.fn(),
  };
  return { emu, emit: (s: string) => { for (const ch of s) listeners['serial0-output-byte']?.(ch.charCodeAt(0)); } };
}

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
