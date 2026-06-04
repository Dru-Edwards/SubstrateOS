import type { KernelSessionOptions, V86Like, V86Factory } from './types';

export class KernelSession {
  private opts: Required<Pick<KernelSessionOptions, 'assetBase' | 'imageFile' | 'memoryMB' | 'promptPattern' | 'now'>> & KernelSessionOptions;
  private emu: V86Like | null = null;
  private tail = '';
  private _booted = false;
  private t0 = 0;
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

  private buildConfig(): Record<string, unknown> {
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
      ...image,
    };
  }

  private defaultFactory: V86Factory = (config) => new (globalThis as any).V86(config);

  async boot(): Promise<{ bootTimeMs: number }> {
    const factory = this.opts.createEmulator ?? this.defaultFactory;
    const timeoutMs = this.opts.bootTimeoutMs ?? 0;
    this.t0 = this.opts.now();
    this.emu = factory(this.buildConfig());

    return new Promise((resolve, reject) => {
      if (timeoutMs > 0) {
        this.bootTimer = setTimeout(() => {
          this.bootTimer = null;
          reject(new Error(`KernelSession boot timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }
      this.emu!.add_listener('serial0-output-byte', (byte: number) => {
        // Ignore output that arrives after dispose() — the emulator may still
        // emit a final byte or two before it fully stops.
        if (!this.emu) return;
        const ch = String.fromCharCode(byte);
        this.opts.onOutput(ch);
        // Keep only a short rolling tail for prompt detection — the prompt is
        // always at the end of the stream, so a small window is sufficient and
        // avoids carrying a large buffer whose only purpose is this regex test.
        this.tail = (this.tail + ch).slice(-256);
        if (!this._booted && this.opts.promptPattern.test(this.tail)) {
          this._booted = true;
          this.clearBootTimer();
          resolve({ bootTimeMs: Math.round(this.opts.now() - this.t0) });
        }
      });
    });
  }

  get booted(): boolean { return this._booted; }

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
