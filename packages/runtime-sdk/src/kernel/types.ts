export interface V86Like {
  add_listener(event: 'serial0-output-byte', cb: (byte: number) => void): void;
  add_listener(event: string, cb: (...args: any[]) => void): void;
  serial0_send(data: string): void;
  stop(): void;
  /** Full VM snapshot (memory + devices). Present on real v86; optional for fakes. */
  save_state?(): Promise<ArrayBuffer>;
  /** Restore a snapshot produced by save_state(). */
  restore_state?(state: ArrayBuffer): Promise<void>;
}

export type V86Factory = (config: Record<string, unknown>) => V86Like;

export interface KernelSessionOptions {
  /** Base URL where v86 binaries + image are served. Default '/kernel'. */
  assetBase?: string;
  /** Image filename under assetBase. Default 'substrate.iso'. */
  imageFile?: string;
  /** Override the v86 image config entirely (e.g. bzimage+initrd). Default { cdrom: { url } }. */
  imageConfig?: Record<string, unknown>;
  /** VM RAM in MB. Default 256. */
  memoryMB?: number;
  /** Called with each decoded output chunk from the kernel serial console. */
  onOutput: (chunk: string) => void;
  /** Regex that signals "shell is ready". Default busybox root prompt. */
  promptPattern?: RegExp;
  /** Reject boot() if no prompt is seen within this many ms. Default 0 (disabled). */
  bootTimeoutMs?: number;
  /**
   * If set, boot() warm-restores this snapshot instead of cold-booting.
   * May be an ArrayBuffer or an async thunk (resolved at boot; null/undefined
   * → fall through to a normal cold boot).
   */
  initialState?: ArrayBuffer | (() => Promise<ArrayBuffer | null | undefined>);
  /** DI: builds the emulator. Default `new (globalThis as any).V86(config)`. */
  createEmulator?: V86Factory;
  /** DI: time source for boot timing. Default performance.now. */
  now?: () => number;
}
