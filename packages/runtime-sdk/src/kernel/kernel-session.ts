import type { KernelSessionOptions, V86Like, V86Factory } from './types';

export class KernelSession {
  private opts: Required<Pick<KernelSessionOptions, 'assetBase' | 'imageFile' | 'memoryMB' | 'promptPattern' | 'now'>> & KernelSessionOptions;
  private emu: V86Like | null = null;

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
    this.emu = factory(this.buildConfig());
    return { bootTimeMs: 0 }; // completed in a later task
  }

  sendInput(_data: string): void { /* later task */ }
  get booted(): boolean { return false; /* later task */ }
  dispose(): void { /* later task */ }
}
