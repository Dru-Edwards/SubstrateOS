import type { KernelSessionOptions, V86Like, V86Factory } from './types';

export class KernelSession {
  private opts: Required<Pick<KernelSessionOptions, 'assetBase' | 'imageFile' | 'memoryMB' | 'promptPattern' | 'now'>> & KernelSessionOptions;
  private emu: V86Like | null = null;
  private tail = '';
  private _booted = false;
  private t0 = 0;
  private bootMs = 0;
  private resolveBoot: ((v: { bootTimeMs: number }) => void) | null = null;
  private rejectBoot: ((e: Error) => void) | null = null;
  private bootTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(opts: KernelSessionOptions) {
    this.opts = {
      assetBase: '/kernel',
      imageFile: 'substrate.iso',
      memoryMB: 256,
      promptPattern: /\/\s?#\s?$/,
      now: () => (typeof performance !== 'undefined' ? performance.now() : Date.now()),
      ...opts,
    };
  }

  private buildConfig(initialState?: ArrayBuffer): Record<string, unknown> {
    const base = this.opts.assetBase;
    const image = this.opts.imageConfig ?? { cdrom: { url: `${base}/${this.opts.imageFile}` } };
    return {
      wasm_path: `${base}/v86.wasm`,
      bios: { url: `${base}/seabios.bin` },
      vga_bios: { url: `${base}/vgabios.bin` },
      memory_size: this.opts.memoryMB * 1024 * 1024,
      vga_memory_size: 8 * 1024 * 1024,
      autostart: true,
      disable_keyboard: true,
      disable_mouse: true,
      // Real networking via a WISP relay (the emulated NE2000 ↔ relay bridge).
      ...(this.opts.networkRelayUrl ? { network_relay_url: this.opts.networkRelayUrl } : {}),
      // Warm restore must go through v86's own init (it calls restore_state at the
      // right point). Calling restore_state on a fresh emulator throws ("set_state"
      // on undefined) — so the snapshot is handed to v86 as initial_state instead.
      ...(initialState ? { initial_state: { buffer: initialState } } : {}),
      ...image,
    };
  }

  private defaultFactory: V86Factory = (config) => new (globalThis as any).V86(config);

  async boot(): Promise<{ bootTimeMs: number }> {
    const factory = this.opts.createEmulator ?? this.defaultFactory;
    // Resolve any warm-restore snapshot BEFORE building the config — v86 restores
    // it during its own init via initial_state (see buildConfig).
    const initOpt = this.opts.initialState;
    const initialState = (typeof initOpt === 'function' ? await initOpt() : initOpt) ?? undefined;

    this.t0 = this.opts.now();
    this.emu = factory(this.buildConfig(initialState));
    const emu = this.emu;

    const timeoutMs = this.opts.bootTimeoutMs ?? 0;
    const armTimeout = () => {
      if (timeoutMs > 0) {
        this.bootTimer = setTimeout(() => {
          this.bootTimer = null;
          this.failBoot(new Error(`KernelSession boot timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }
    };

    // Stream serial output for both cold and warm boot. On cold boot, a prompt
    // match resolves boot(); on warm boot we resolve on 'emulator-ready'.
    emu.add_listener('serial0-output-byte', (byte: number) => {
      // Ignore output that arrives after dispose() — the emulator may still
      // emit a final byte or two before it fully stops.
      if (!this.emu) return;
      const ch = String.fromCharCode(byte);
      this.opts.onOutput(ch);
      // Keep only a short rolling tail for prompt detection — the prompt is
      // always at the end of the stream, so a small window suffices.
      this.tail = (this.tail + ch).slice(-256);
      if (this._booted) return;
      // Fail fast on a kernel panic instead of waiting for a prompt that will
      // never appear (otherwise boot() only fails at the bootTimeout, if any).
      if (/Kernel panic/i.test(this.tail)) {
        this.failBoot(new Error('KernelSession: kernel panic during boot'));
        return;
      }
      if (this.opts.promptPattern.test(this.tail)) {
        this.markBooted();
      }
    });

    // Warm restore: v86 restored the snapshot during init (initial_state) and
    // fires 'emulator-ready' when the VM is live again. Resolve on that, then
    // nudge the restored shell for a fresh prompt.
    if (initialState) {
      emu.add_listener('emulator-ready', () => {
        if (this._booted) return;
        this.markBooted();
        emu.serial0_send('\n');
      });
    }

    // Resolve when the prompt appears (cold) or 'emulator-ready' fires (warm),
    // or reject on timeout.
    return new Promise((resolve, reject) => {
      if (this._booted) { resolve({ bootTimeMs: this.bootMs }); return; }
      this.resolveBoot = resolve;
      this.rejectBoot = reject;
      armTimeout();
    });
  }

  private markBooted(): void {
    if (this._booted) return;
    this._booted = true;
    this.bootMs = Math.round(this.opts.now() - this.t0);
    this.clearBootTimer();
    this.resolveBoot?.({ bootTimeMs: this.bootMs });
    this.resolveBoot = null;
    this.rejectBoot = null;
  }

  private failBoot(err: Error): void {
    if (this._booted) return;
    this.clearBootTimer();
    this.rejectBoot?.(err);
    this.resolveBoot = null;
    this.rejectBoot = null;
  }

  get booted(): boolean { return this._booted; }

  /** Capture a full VM snapshot (memory + devices) for persistence. */
  async saveState(): Promise<ArrayBuffer> {
    if (!this.emu?.save_state) throw new Error('KernelSession not started (call boot() first)');
    return this.emu.save_state();
  }

  sendInput(data: string): void {
    if (!this.emu) throw new Error('KernelSession not started (call boot() first)');
    this.emu.serial0_send(data);
  }

  dispose(): void {
    this.clearBootTimer();
    this.emu?.stop();
    this.emu = null;
  }

  private clearBootTimer(): void {
    if (this.bootTimer) {
      clearTimeout(this.bootTimer);
      this.bootTimer = null;
    }
  }
}
