/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║               EDWARDS TECH INNOVATION                    ║
 * ╚══════════════════════════════════════════════════════════╝
 *  SubstrateOS IndexedDB Persistence Layer
 *  
 *  Features:
 *  - Schema versioning with migrations
 *  - Multi-tab session locking
 *  - Import/export workspace
 *  - Storage quota handling
 */

const DB_NAME = 'SubstrateOS';
const DB_VERSION = 2; // Bump when schema changes

// Current schema version (separate from DB version)
const SCHEMA_VERSION = 1;

// Store names
const STORES = {
  FILESYSTEM: 'filesystem',
  KEYVALUE: 'keyvalue',
  PACKAGES: 'packages',
  CONFIG: 'config',
  SESSION: 'session',
} as const;

// Session lock timeout (30 seconds)
const SESSION_LOCK_TIMEOUT = 30000;
const SESSION_HEARTBEAT_INTERVAL = 10000;

export interface PersistedFile {
  path: string;
  content: string;
  type: 'file' | 'directory';
  permissions: string;
  owner: string;
  modified: number;
  size: number;
}

export interface KeyValueEntry {
  key: string;
  value: string;
  created: number;
  modified: number;
}

export interface InstalledPackage {
  name: string;
  version: string;
  installed: number;
  files: string[];
}

export interface SessionLock {
  id: string;
  instanceId: string;
  timestamp: number;
  tabId: string;
}

export interface WorkspaceExport {
  version: number;
  exportedAt: number;
  files: PersistedFile[];
  keyValues: KeyValueEntry[];
  packages: InstalledPackage[];
  config: Record<string, unknown>;
}

export interface MigrationContext {
  getConfig: <T>(key: string) => Promise<T | null>;
  setConfig: (key: string, value: unknown) => Promise<void>;
  getAllFiles: () => Promise<PersistedFile[]>;
  saveFile: (file: PersistedFile) => Promise<void>;
  deleteFile: (path: string) => Promise<void>;
}

type MigrationFn = (ctx: MigrationContext) => Promise<void>;

/**
 * Migration registry - add new migrations here
 */
const migrations: Record<number, MigrationFn> = {
  // Example: Migration from schema 1 to 2
  // 1: async (ctx) => {
  //   // Migrate old file format to new format
  //   const files = await ctx.getAllFiles();
  //   for (const file of files) {
  //     if (!file.permissions) {
  //       file.permissions = '-rw-r--r--';
  //       await ctx.saveFile(file);
  //     }
  //   }
  // },
};

/**
 * IndexedDB-based persistence for SubstrateOS
 */
export class SubstrateOSPersistence {
  private db: IDBDatabase | null = null;
  private dbPromise: Promise<IDBDatabase> | null = null;
  private namespace: string;
  private instanceId: string;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private isReadOnly: boolean = false;

  constructor(namespace: string = 'default') {
    this.namespace = namespace;
    this.instanceId = this.generateInstanceId();
  }

  private generateInstanceId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Initialize the database connection
   */
  async init(): Promise<void> {
    if (this.db) return;
    if (this.dbPromise) {
      await this.dbPromise;
      return;
    }

    this.dbPromise = this.openDatabase();
    this.db = await this.dbPromise;
    
    // Run migrations after DB is open
    await this.runMigrations();
    
    // Acquire session lock
    await this.acquireSessionLock();
    
    // Start heartbeat
    this.startHeartbeat();
  }

  private openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB not available'));
        return;
      }

      const request = indexedDB.open(`${DB_NAME}_${this.namespace}`, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Filesystem store
        if (!db.objectStoreNames.contains(STORES.FILESYSTEM)) {
          const fsStore = db.createObjectStore(STORES.FILESYSTEM, { keyPath: 'path' });
          fsStore.createIndex('type', 'type', { unique: false });
          fsStore.createIndex('modified', 'modified', { unique: false });
        }

        // Key-value store
        if (!db.objectStoreNames.contains(STORES.KEYVALUE)) {
          const kvStore = db.createObjectStore(STORES.KEYVALUE, { keyPath: 'key' });
          kvStore.createIndex('modified', 'modified', { unique: false });
        }

        // Installed packages
        if (!db.objectStoreNames.contains(STORES.PACKAGES)) {
          const pkgStore = db.createObjectStore(STORES.PACKAGES, { keyPath: 'name' });
          pkgStore.createIndex('installed', 'installed', { unique: false });
        }

        // Config store
        if (!db.objectStoreNames.contains(STORES.CONFIG)) {
          db.createObjectStore(STORES.CONFIG, { keyPath: 'key' });
        }

        // Session store (for multi-tab locking)
        if (!db.objectStoreNames.contains(STORES.SESSION)) {
          db.createObjectStore(STORES.SESSION, { keyPath: 'id' });
        }
      };
    });
  }

  // ==================== MIGRATIONS ====================

  private async runMigrations(): Promise<void> {
    const currentVersion = await this.getConfig<number>('schemaVersion') || 0;
    
    if (currentVersion >= SCHEMA_VERSION) {
      return; // Already up to date
    }

    console.log(`[SubstrateOS] Running migrations from v${currentVersion} to v${SCHEMA_VERSION}`);

    const migrationContext: MigrationContext = {
      getConfig: this.getConfig.bind(this),
      setConfig: this.setConfig.bind(this),
      getAllFiles: this.getAllFiles.bind(this),
      saveFile: this.saveFile.bind(this),
      deleteFile: this.deleteFile.bind(this),
    };

    for (let v = currentVersion + 1; v <= SCHEMA_VERSION; v++) {
      const migrationFn = migrations[v];
      if (migrationFn) {
        console.log(`[SubstrateOS] Applying migration v${v}`);
        try {
          await migrationFn(migrationContext);
        } catch (e) {
          console.error(`[SubstrateOS] Migration v${v} failed:`, e);
          throw new Error(`Migration v${v} failed: ${e}`);
        }
      }
    }

    await this.setConfig('schemaVersion', SCHEMA_VERSION);
    console.log(`[SubstrateOS] Migrations complete. Now at v${SCHEMA_VERSION}`);
  }

  // ==================== SESSION LOCKING ====================

  private async acquireSessionLock(): Promise<void> {
    const store = await this.getStore(STORES.SESSION, 'readwrite');
    const now = Date.now();
    const tabId = this.getTabId();

    return new Promise((resolve, reject) => {
      const request = store.get('lock');
      
      request.onsuccess = async () => {
        const existingLock = request.result as SessionLock | undefined;
        
        if (existingLock && existingLock.instanceId !== this.instanceId) {
          const lockAge = now - existingLock.timestamp;
          
          if (lockAge < SESSION_LOCK_TIMEOUT) {
            // Another tab has an active lock
            console.warn('[SubstrateOS] Another tab has an active session. Running in read-only mode.');
            this.isReadOnly = true;
            resolve();
            return;
          }
          // Lock is stale, we can take over
          console.log('[SubstrateOS] Taking over stale session lock');
        }

        // Acquire lock
        const newLock: SessionLock = {
          id: 'lock',
          instanceId: this.instanceId,
          timestamp: now,
          tabId,
        };

        const putRequest = store.put(newLock);
        putRequest.onsuccess = () => {
          this.isReadOnly = false;
          resolve();
        };
        putRequest.onerror = () => reject(putRequest.error);
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  private getTabId(): string {
    if (typeof sessionStorage !== 'undefined') {
      let tabId = sessionStorage.getItem('substrateos_tab_id');
      if (!tabId) {
        tabId = `tab-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        sessionStorage.setItem('substrateos_tab_id', tabId);
      }
      return tabId;
    }
    return 'unknown';
  }

  private startHeartbeat(): void {
    if (this.heartbeatTimer) return;
    
    this.heartbeatTimer = setInterval(async () => {
      if (!this.isReadOnly) {
        await this.updateSessionHeartbeat();
      }
    }, SESSION_HEARTBEAT_INTERVAL);

    // Also update on visibility change
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && !this.isReadOnly) {
          this.updateSessionHeartbeat();
        }
      });
    }
  }

  private async updateSessionHeartbeat(): Promise<void> {
    try {
      const store = await this.getStore(STORES.SESSION, 'readwrite');
      const lock: SessionLock = {
        id: 'lock',
        instanceId: this.instanceId,
        timestamp: Date.now(),
        tabId: this.getTabId(),
      };
      store.put(lock);
    } catch (e) {
      console.warn('[SubstrateOS] Failed to update session heartbeat:', e);
    }
  }

  /**
   * Check if this session is read-only (another tab has the lock)
   */
  isSessionReadOnly(): boolean {
    return this.isReadOnly;
  }

  /**
   * Try to acquire write access (useful for "Take Over" button)
   */
  async forceAcquireLock(): Promise<boolean> {
    const store = await this.getStore(STORES.SESSION, 'readwrite');
    const lock: SessionLock = {
      id: 'lock',
      instanceId: this.instanceId,
      timestamp: Date.now(),
      tabId: this.getTabId(),
    };

    return new Promise((resolve) => {
      const request = store.put(lock);
      request.onsuccess = () => {
        this.isReadOnly = false;
        resolve(true);
      };
      request.onerror = () => resolve(false);
    });
  }

  private async getStore(storeName: string, mode: IDBTransactionMode = 'readonly'): Promise<IDBObjectStore> {
    await this.init();
    const tx = this.db!.transaction(storeName, mode);
    return tx.objectStore(storeName);
  }

  // ==================== STORAGE QUOTA ====================

  /**
   * Check storage usage and quota
   */
  async checkStorageQuota(): Promise<{ usage: number; quota: number; percentUsed: number } | null> {
    if (typeof navigator !== 'undefined' && 'storage' in navigator && 'estimate' in navigator.storage) {
      try {
        const estimate = await navigator.storage.estimate();
        const usage = estimate.usage || 0;
        const quota = estimate.quota || 0;
        return {
          usage,
          quota,
          percentUsed: quota > 0 ? (usage / quota) * 100 : 0,
        };
      } catch (e) {
        console.warn('[SubstrateOS] Could not estimate storage:', e);
      }
    }
    return null;
  }

  /**
   * Check if we're approaching storage limits
   */
  async isStorageLow(): Promise<boolean> {
    const quota = await this.checkStorageQuota();
    return quota ? quota.percentUsed > 80 : false;
  }

  // ==================== FILESYSTEM OPERATIONS ====================

  /**
   * Save a file or directory to persistence
   */
  async saveFile(file: PersistedFile): Promise<void> {
    const store = await this.getStore(STORES.FILESYSTEM, 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put(file);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get a file or directory from persistence
   */
  async getFile(path: string): Promise<PersistedFile | null> {
    const store = await this.getStore(STORES.FILESYSTEM);
    return new Promise((resolve, reject) => {
      const request = store.get(path);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Delete a file or directory from persistence
   */
  async deleteFile(path: string): Promise<void> {
    const store = await this.getStore(STORES.FILESYSTEM, 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.delete(path);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get all files under a path prefix
   */
  async getFilesUnderPath(pathPrefix: string): Promise<PersistedFile[]> {
    const store = await this.getStore(STORES.FILESYSTEM);
    return new Promise((resolve, reject) => {
      const files: PersistedFile[] = [];
      const request = store.openCursor();
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          const file = cursor.value as PersistedFile;
          if (file.path.startsWith(pathPrefix)) {
            files.push(file);
          }
          cursor.continue();
        } else {
          resolve(files);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get all persisted files
   */
  async getAllFiles(): Promise<PersistedFile[]> {
    const store = await this.getStore(STORES.FILESYSTEM);
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  // ==================== KEY-VALUE OPERATIONS ====================

  /**
   * Set a key-value pair
   */
  async kvSet(key: string, value: string): Promise<void> {
    const store = await this.getStore(STORES.KEYVALUE, 'readwrite');
    const now = Date.now();
    const existing = await this.kvGet(key);
    
    const entry: KeyValueEntry = {
      key,
      value,
      created: existing?.created || now,
      modified: now,
    };

    return new Promise((resolve, reject) => {
      const request = store.put(entry);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get a value by key
   */
  async kvGet(key: string): Promise<KeyValueEntry | null> {
    const store = await this.getStore(STORES.KEYVALUE);
    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Delete a key
   */
  async kvDelete(key: string): Promise<void> {
    const store = await this.getStore(STORES.KEYVALUE, 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * List all keys
   */
  async kvList(): Promise<string[]> {
    const store = await this.getStore(STORES.KEYVALUE);
    return new Promise((resolve, reject) => {
      const request = store.getAllKeys();
      request.onsuccess = () => resolve(request.result as string[]);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get all key-value entries
   */
  async kvGetAll(): Promise<KeyValueEntry[]> {
    const store = await this.getStore(STORES.KEYVALUE);
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  // ==================== PACKAGE OPERATIONS ====================

  /**
   * Save an installed package
   */
  async savePackage(pkg: InstalledPackage): Promise<void> {
    const store = await this.getStore(STORES.PACKAGES, 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put(pkg);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get an installed package
   */
  async getPackage(name: string): Promise<InstalledPackage | null> {
    const store = await this.getStore(STORES.PACKAGES);
    return new Promise((resolve, reject) => {
      const request = store.get(name);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Remove an installed package
   */
  async removePackage(name: string): Promise<void> {
    const store = await this.getStore(STORES.PACKAGES, 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.delete(name);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * List all installed packages
   */
  async listPackages(): Promise<InstalledPackage[]> {
    const store = await this.getStore(STORES.PACKAGES);
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  // ==================== CONFIG OPERATIONS ====================

  /**
   * Set a config value
   */
  async setConfig(key: string, value: unknown): Promise<void> {
    const store = await this.getStore(STORES.CONFIG, 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put({ key, value });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get a config value
   */
  async getConfig<T = unknown>(key: string): Promise<T | null> {
    const store = await this.getStore(STORES.CONFIG);
    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? result.value : null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // ==================== UTILITY ====================

  /**
   * Clear all data
   */
  async clearAll(): Promise<void> {
    await this.init();
    const tx = this.db!.transaction(
      [STORES.FILESYSTEM, STORES.KEYVALUE, STORES.PACKAGES, STORES.CONFIG],
      'readwrite'
    );

    await Promise.all([
      new Promise<void>((resolve, reject) => {
        const req = tx.objectStore(STORES.FILESYSTEM).clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      }),
      new Promise<void>((resolve, reject) => {
        const req = tx.objectStore(STORES.KEYVALUE).clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      }),
      new Promise<void>((resolve, reject) => {
        const req = tx.objectStore(STORES.PACKAGES).clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      }),
      new Promise<void>((resolve, reject) => {
        const req = tx.objectStore(STORES.CONFIG).clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      }),
    ]);
  }

  /**
   * Get storage usage stats
   */
  async getStats(): Promise<{ files: number; keys: number; packages: number }> {
    await this.init();
    const tx = this.db!.transaction(
      [STORES.FILESYSTEM, STORES.KEYVALUE, STORES.PACKAGES],
      'readonly'
    );

    const [files, keys, packages] = await Promise.all([
      new Promise<number>((resolve, reject) => {
        const req = tx.objectStore(STORES.FILESYSTEM).count();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
      new Promise<number>((resolve, reject) => {
        const req = tx.objectStore(STORES.KEYVALUE).count();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
      new Promise<number>((resolve, reject) => {
        const req = tx.objectStore(STORES.PACKAGES).count();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
    ]);

    return { files, keys, packages };
  }

  // ==================== IMPORT/EXPORT ====================

  /**
   * Export workspace as JSON (for download)
   */
  async exportWorkspace(paths: string[] = ['/home/user']): Promise<WorkspaceExport> {
    await this.init();

    // Get files under specified paths
    const allFiles = await this.getAllFiles();
    const files = allFiles.filter(f => 
      paths.some(p => f.path.startsWith(p))
    );

    // Get all key-value entries
    const keyValues = await this.kvGetAll();

    // Get all packages
    const packages = await this.listPackages();

    // Get config (excluding internal keys)
    const configStore = await this.getStore(STORES.CONFIG);
    const configEntries = await new Promise<Record<string, unknown>>((resolve, reject) => {
      const request = configStore.getAll();
      request.onsuccess = () => {
        const config: Record<string, unknown> = {};
        for (const entry of request.result || []) {
          if (!entry.key.startsWith('_') && entry.key !== 'schemaVersion') {
            config[entry.key] = entry.value;
          }
        }
        resolve(config);
      };
      request.onerror = () => reject(request.error);
    });

    return {
      version: SCHEMA_VERSION,
      exportedAt: Date.now(),
      files,
      keyValues,
      packages,
      config: configEntries,
    };
  }

  /**
   * Export workspace and trigger download
   */
  async downloadWorkspace(filename: string = 'substrateos-workspace.json'): Promise<void> {
    const workspace = await this.exportWorkspace();
    const json = JSON.stringify(workspace, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Import workspace from JSON
   */
  async importWorkspace(workspace: WorkspaceExport, options: {
    overwrite?: boolean;
    importFiles?: boolean;
    importKeyValues?: boolean;
    importPackages?: boolean;
    importConfig?: boolean;
  } = {}): Promise<{ imported: number; skipped: number; errors: string[] }> {
    const {
      overwrite = false,
      importFiles = true,
      importKeyValues = true,
      importPackages = true,
      importConfig = true,
    } = options;

    const result = { imported: 0, skipped: 0, errors: [] as string[] };

    // Validate version
    if (workspace.version > SCHEMA_VERSION) {
      result.errors.push(`Workspace version ${workspace.version} is newer than current schema ${SCHEMA_VERSION}`);
      return result;
    }

    // Import files
    if (importFiles && workspace.files) {
      for (const file of workspace.files) {
        try {
          if (!overwrite) {
            const existing = await this.getFile(file.path);
            if (existing) {
              result.skipped++;
              continue;
            }
          }
          await this.saveFile(file);
          result.imported++;
        } catch (e) {
          result.errors.push(`Failed to import file ${file.path}: ${e}`);
        }
      }
    }

    // Import key-values
    if (importKeyValues && workspace.keyValues) {
      for (const kv of workspace.keyValues) {
        try {
          if (!overwrite) {
            const existing = await this.kvGet(kv.key);
            if (existing) {
              result.skipped++;
              continue;
            }
          }
          await this.kvSet(kv.key, kv.value);
          result.imported++;
        } catch (e) {
          result.errors.push(`Failed to import key ${kv.key}: ${e}`);
        }
      }
    }

    // Import packages
    if (importPackages && workspace.packages) {
      for (const pkg of workspace.packages) {
        try {
          if (!overwrite) {
            const existing = await this.getPackage(pkg.name);
            if (existing) {
              result.skipped++;
              continue;
            }
          }
          await this.savePackage(pkg);
          result.imported++;
        } catch (e) {
          result.errors.push(`Failed to import package ${pkg.name}: ${e}`);
        }
      }
    }

    // Import config
    if (importConfig && workspace.config) {
      for (const [key, value] of Object.entries(workspace.config)) {
        try {
          await this.setConfig(key, value);
          result.imported++;
        } catch (e) {
          result.errors.push(`Failed to import config ${key}: ${e}`);
        }
      }
    }

    return result;
  }

  /**
   * Import workspace from File object (for file input)
   */
  async importWorkspaceFromFile(file: File, options?: Parameters<typeof this.importWorkspace>[1]): Promise<ReturnType<typeof this.importWorkspace>> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const json = e.target?.result as string;
          const workspace = JSON.parse(json) as WorkspaceExport;
          const result = await this.importWorkspace(workspace, options);
          resolve(result);
        } catch (err) {
          reject(new Error(`Failed to parse workspace file: ${err}`));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  /**
   * Close the database connection
   */
  close(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.db) {
      this.db.close();
      this.db = null;
      this.dbPromise = null;
    }
  }
}

// Singleton instance for default namespace
let defaultInstance: SubstrateOSPersistence | null = null;

export function getPersistence(namespace?: string): SubstrateOSPersistence {
  if (namespace) {
    return new SubstrateOSPersistence(namespace);
  }
  if (!defaultInstance) {
    defaultInstance = new SubstrateOSPersistence();
  }
  return defaultInstance;
}

export default SubstrateOSPersistence;
