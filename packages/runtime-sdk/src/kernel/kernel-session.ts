import type { KernelSessionOptions, V86Like, V86Factory } from './types';

export class KernelSession {
  private opts: Required<Pick<KernelSessionOptions, 'assetBase' | 'imageFile' | 'memoryMB' | 'promptPattern' | 'now'>> & KernelSessionOptions;
  private emu: V86Like | null = null;
  private buffer = '';
  private _booted = false;
  private t0 = 0;

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
    this.t0 = this.opts.now();
    this.emu = factory(this.buildConfig());

    return new Promise((resolve) => {
      this.emu!.add_listener('serial0-output-byte', (byte: number) => {
        const ch = String.fromCharCode(byte);
        this.opts.onOutput(ch);
        this.buffer += ch;
        if (this.buffer.length > 8000) this.buffer = this.buffer.slice(-4000);
        if (!this._booted && this.opts.promptPattern.test(this.buffer)) {
          this._booted = true;
          resolve({ bootTimeMs: Math.round(this.opts.now() - this.t0) });
        }
      });
    });
  }

  get booted(): boolean { return this._booted; }

  sendInput(data: string): void {
    if (!this.emu) throw new Error('KernelSession not booted');
    this.emu.serial0_send(data);
  }

  dispose(): void {
    this.emu?.stop();
    this.emu = null;
  }
}
