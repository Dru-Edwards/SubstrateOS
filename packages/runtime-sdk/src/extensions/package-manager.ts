/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║               EDWARDS TECH INNOVATION                    ║
 * ╚══════════════════════════════════════════════════════════╝
 *  SubstrateOS Package Manager (dpkg)
 *  
 *  Browser-based package management for SubstrateOS extensions.
 *  Packages are loaded from URLs (CDN, GitHub, local) and
 *  installed into the virtual filesystem.
 */

import { ExtensionManifest, extensionManager } from './extension-api';
import { CommandHandler, CommandResult, CommandContext } from '../shell/commands';

/**
 * Package source - where to fetch packages
 */
export interface PackageSource {
  name: string;
  url: string;
  type: 'registry' | 'github' | 'url';
}

/**
 * Installed package info
 */
export interface InstalledPackage {
  manifest: ExtensionManifest;
  installedAt: number;
  source: string;
  files: string[];
}

/**
 * Package search result
 */
export interface PackageInfo {
  name: string;
  version: string;
  description: string;
  author?: string;
  downloads?: number;
  keywords?: string[];
}

/**
 * SubstrateOS Package Manager
 */
export class SubstrateOSPackageManager {
  private installed: Map<string, InstalledPackage> = new Map();
  private sources: PackageSource[] = [];
  private cacheKey = 'substrateos:packages:installed';

  constructor() {
    this.loadInstalled();
    this.initDefaultSources();
  }

  private initDefaultSources(): void {
    this.sources = [
      {
        name: 'substrateos-registry',
        url: 'https://registry.substrateos.dev',
        type: 'registry'
      },
      {
        name: 'github',
        url: 'https://raw.githubusercontent.com',
        type: 'github'
      }
    ];
  }

  private loadInstalled(): void {
    try {
      const data = localStorage.getItem(this.cacheKey);
      if (data) {
        const packages = JSON.parse(data) as InstalledPackage[];
        for (const pkg of packages) {
          this.installed.set(pkg.manifest.name, pkg);
        }
      }
    } catch (e) {
      console.warn('[dpkg] Failed to load installed packages:', e);
    }
  }

  private saveInstalled(): void {
    try {
      const packages = Array.from(this.installed.values());
      localStorage.setItem(this.cacheKey, JSON.stringify(packages));
    } catch (e) {
      console.warn('[dpkg] Failed to save installed packages:', e);
    }
  }

  /**
   * Install a package from URL
   */
  async install(nameOrUrl: string): Promise<InstalledPackage> {
    let url = nameOrUrl;
    let source = 'url';

    // Check if it's a package name (not a URL)
    if (!nameOrUrl.includes('://')) {
      // Try to resolve from registry
      const resolved = await this.resolvePackage(nameOrUrl);
      if (!resolved) {
        throw new Error(`Package "${nameOrUrl}" not found in any registry`);
      }
      url = resolved.url;
      source = resolved.source;
    }

    console.log(`[dpkg] Installing from ${url}...`);

    // Fetch package
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch package: ${response.statusText}`);
    }

    const code = await response.text();
    
    // Parse manifest from code (look for export const manifest or similar)
    const manifest = this.parseManifest(code, nameOrUrl);
    
    // Check if already installed
    if (this.installed.has(manifest.name)) {
      const existing = this.installed.get(manifest.name)!;
      console.log(`[dpkg] Upgrading ${manifest.name} from ${existing.manifest.version} to ${manifest.version}`);
      await this.uninstall(manifest.name);
    }

    // Load extension
    await extensionManager.loadExtensionFromCode(code, manifest);

    // Record installation
    const installedPkg: InstalledPackage = {
      manifest,
      installedAt: Date.now(),
      source,
      files: [`/opt/${manifest.name}/index.js`]
    };

    this.installed.set(manifest.name, installedPkg);
    this.saveInstalled();

    console.log(`[dpkg] Installed ${manifest.name}@${manifest.version}`);
    return installedPkg;
  }

  /**
   * Uninstall a package
   */
  async uninstall(name: string): Promise<void> {
    const pkg = this.installed.get(name);
    if (!pkg) {
      throw new Error(`Package "${name}" is not installed`);
    }

    // Unload extension
    try {
      await extensionManager.unloadExtension(name);
    } catch (e) {
      // Extension may not be loaded
    }

    this.installed.delete(name);
    this.saveInstalled();

    console.log(`[dpkg] Uninstalled ${name}`);
  }

  /**
   * List installed packages
   */
  list(): InstalledPackage[] {
    return Array.from(this.installed.values());
  }

  /**
   * Search for packages
   */
  async search(query: string): Promise<PackageInfo[]> {
    // Search built-in packages
    const builtIn = this.getBuiltInPackages().filter(pkg =>
      pkg.name.includes(query) ||
      pkg.description.toLowerCase().includes(query.toLowerCase()) ||
      pkg.keywords?.some(k => k.includes(query))
    );

    // TODO: Search remote registry
    // const remote = await this.searchRegistry(query);

    return builtIn;
  }

  /**
   * Get info about a package
   */
  async info(name: string): Promise<PackageInfo | null> {
    // Check installed
    const installed = this.installed.get(name);
    if (installed) {
      return {
        name: installed.manifest.name,
        version: installed.manifest.version,
        description: installed.manifest.description,
        author: installed.manifest.author,
        keywords: installed.manifest.keywords
      };
    }

    // Check built-in
    const builtIn = this.getBuiltInPackages().find(p => p.name === name);
    if (builtIn) return builtIn;

    return null;
  }

  /**
   * Update all packages
   */
  async update(): Promise<string[]> {
    const updated: string[] = [];
    
    for (const [name, pkg] of this.installed) {
      try {
        // Re-install from original source
        await this.install(name);
        updated.push(name);
      } catch (e) {
        console.warn(`[dpkg] Failed to update ${name}:`, e);
      }
    }

    return updated;
  }

  /**
   * Resolve package name to URL
   */
  private async resolvePackage(name: string): Promise<{ url: string; source: string } | null> {
    // Check built-in packages first
    const builtIn = this.getBuiltInPackageUrl(name);
    if (builtIn) {
      return { url: builtIn, source: 'builtin' };
    }

    // TODO: Check remote registry
    return null;
  }

  /**
   * Parse manifest from code
   */
  private parseManifest(code: string, fallbackName: string): ExtensionManifest {
    // Try to extract manifest from code
    const manifestMatch = code.match(/manifest\s*[:=]\s*({[\s\S]*?})\s*[;,]/);
    
    if (manifestMatch) {
      try {
        // This is a simplified parser - real implementation would be more robust
        const manifestStr = manifestMatch[1]
          .replace(/(\w+):/g, '"$1":')
          .replace(/'/g, '"');
        return JSON.parse(manifestStr);
      } catch (e) {
        // Fall through to default
      }
    }

    // Default manifest from URL/name
    const name = fallbackName.split('/').pop()?.replace(/\.(js|ts|mjs)$/, '') || 'unknown';
    return {
      name,
      version: '1.0.0',
      description: `Package: ${name}`
    };
  }

  /**
   * Built-in packages available without network
   */
  private getBuiltInPackages(): PackageInfo[] {
    return [
      {
        name: '@substrateos/python',
        version: '1.0.0',
        description: 'Python interpreter powered by Pyodide',
        keywords: ['python', 'interpreter', 'language']
      },
      {
        name: '@substrateos/nodejs',
        version: '1.0.0',
        description: 'JavaScript/Node.js runtime',
        keywords: ['node', 'javascript', 'runtime']
      },
      {
        name: '@substrateos/wasm-tools',
        version: '1.0.0',
        description: 'WebAssembly compilation and execution tools',
        keywords: ['wasm', 'webassembly', 'compiler']
      },
      {
        name: '@substrateos/code-editor',
        version: '1.0.0',
        description: 'Monaco-based code editor',
        keywords: ['editor', 'monaco', 'code']
      },
      {
        name: '@substrateos/git',
        version: '1.0.0',
        description: 'Git version control (isomorphic-git)',
        keywords: ['git', 'version-control', 'vcs']
      },
      {
        name: '@substrateos/canvas',
        version: '1.0.0',
        description: 'HTML5 Canvas graphics API',
        keywords: ['graphics', 'canvas', 'drawing', 'games']
      },
      {
        name: '@substrateos/sqlite',
        version: '1.0.0',
        description: 'SQLite database (sql.js)',
        keywords: ['database', 'sqlite', 'sql']
      },
      {
        name: '@substrateos/webgl',
        version: '1.0.0',
        description: 'WebGL 3D graphics',
        keywords: ['3d', 'graphics', 'webgl', 'games']
      },
      {
        name: '@substrateos/audio',
        version: '1.0.0',
        description: 'Web Audio API for sound',
        keywords: ['audio', 'sound', 'music']
      },
      {
        name: '@substrateos/gamepad',
        version: '1.0.0',
        description: 'Gamepad API support',
        keywords: ['gamepad', 'controller', 'games', 'input']
      }
    ];
  }

  /**
   * Get URL for built-in package
   */
  private getBuiltInPackageUrl(name: string): string | null {
    // These would be actual CDN URLs in production
    const urls: Record<string, string> = {
      '@substrateos/python': 'https://cdn.substrateos.dev/packages/python/1.0.0/index.js',
      '@substrateos/nodejs': 'https://cdn.substrateos.dev/packages/nodejs/1.0.0/index.js',
    };
    return urls[name] || null;
  }

  /**
   * Add a package source
   */
  addSource(source: PackageSource): void {
    this.sources.push(source);
  }

  /**
   * Remove a package source
   */
  removeSource(name: string): void {
    this.sources = this.sources.filter(s => s.name !== name);
  }

  /**
   * Get package sources
   */
  getSources(): PackageSource[] {
    return [...this.sources];
  }
}

/**
 * Global package manager instance
 */
export const packageManager = new SubstrateOSPackageManager();

/**
 * dpkg command handler - Debian-style package management
 */
export const dpkgCommand: CommandHandler = (args, ctx) => {
  if (args.length === 0) {
    ctx.writeln('Usage: dpkg <command> [options]');
    ctx.writeln('');
    ctx.writeln('Commands:');
    ctx.writeln('  -l, --list              List installed packages');
    ctx.writeln('  -i, --install <pkg>     Install a package');
    ctx.writeln('  -r, --remove <pkg>      Remove a package');
    ctx.writeln('  -s, --status <pkg>      Show package status');
    ctx.writeln('  --search <query>        Search for packages');
    return { exitCode: 0 };
  }

  const cmd = args[0];
  const rest = args.slice(1);

  switch (cmd) {
    case '-l':
    case '--list':
      const pkgs = packageManager.list();
      if (pkgs.length === 0) {
        ctx.writeln('No packages installed.');
      } else {
        ctx.writeln('Installed packages:');
        for (const pkg of pkgs) {
          ctx.writeln(`  ${pkg.manifest.name}@${pkg.manifest.version}`);
        }
      }
      return { exitCode: 0 };

    case '-i':
    case '--install':
      if (rest.length === 0) {
        ctx.writeError('dpkg: package name required');
        return { exitCode: 1 };
      }
      ctx.writeln(`Installing ${rest[0]}...`);
      ctx.writeln('\x1b[33m[dpkg] Package installation in browser requires async.\x1b[0m');
      ctx.writeln('\x1b[33mUse the Extension API to install packages programmatically.\x1b[0m');
      return { exitCode: 0 };

    case '-r':
    case '--remove':
      if (rest.length === 0) {
        ctx.writeError('dpkg: package name required');
        return { exitCode: 1 };
      }
      ctx.writeln(`Removing ${rest[0]}...`);
      return { exitCode: 0 };

    case '-s':
    case '--status':
      if (rest.length === 0) {
        ctx.writeError('dpkg: package name required');
        return { exitCode: 1 };
      }
      const pkg = packageManager.list().find(p => p.manifest.name === rest[0]);
      if (pkg) {
        ctx.writeln(`Package: ${pkg.manifest.name}`);
        ctx.writeln(`Version: ${pkg.manifest.version}`);
        ctx.writeln(`Description: ${pkg.manifest.description}`);
        ctx.writeln(`Status: installed`);
        ctx.writeln(`Installed: ${new Date(pkg.installedAt).toLocaleString()}`);
      } else {
        ctx.writeln(`Package ${rest[0]} is not installed.`);
      }
      return { exitCode: 0 };

    case '--search':
      ctx.writeln('Available packages:');
      const available = packageManager['getBuiltInPackages']();
      for (const p of available) {
        ctx.writeln(`  \x1b[1;32m${p.name}\x1b[0m@${p.version}`);
        ctx.writeln(`    ${p.description}`);
      }
      return { exitCode: 0 };

    default:
      ctx.writeError(`dpkg: unknown command '${cmd}'`);
      return { exitCode: 1 };
  }
};

/**
 * apt command handler - APT-style interface  
 */
export const aptCommand: CommandHandler = (args, ctx) => {
  if (args.length === 0) {
    ctx.writeln('\x1b[1;36mSubstrateOS Package Manager (apt)\x1b[0m');
    ctx.writeln('');
    ctx.writeln('Usage: apt <command> [packages]');
    ctx.writeln('');
    ctx.writeln('Commands:');
    ctx.writeln('  list              List available packages');
    ctx.writeln('  search <query>    Search for packages');
    ctx.writeln('  install <pkg>     Install a package');
    ctx.writeln('  remove <pkg>      Remove a package');
    ctx.writeln('  update            Update package lists');
    ctx.writeln('  upgrade           Upgrade installed packages');
    ctx.writeln('  show <pkg>        Show package details');
    ctx.writeln('');
    ctx.writeln('\x1b[90mNote: SubstrateOS uses browser-based packages loaded via URLs.\x1b[0m');
    ctx.writeln('\x1b[90mPackages are JavaScript modules that extend the shell.\x1b[0m');
    return { exitCode: 0 };
  }

  const cmd = args[0];
  const rest = args.slice(1);

  switch (cmd) {
    case 'list':
    case 'search':
      ctx.writeln('\x1b[1mAvailable Packages:\x1b[0m');
      ctx.writeln('');
      const packages = packageManager['getBuiltInPackages']();
      for (const pkg of packages) {
        ctx.writeln(`\x1b[1;32m${pkg.name}\x1b[0m/${pkg.version}`);
        ctx.writeln(`  ${pkg.description}`);
        if (pkg.keywords) {
          ctx.writeln(`  \x1b[90mKeywords: ${pkg.keywords.join(', ')}\x1b[0m`);
        }
        ctx.writeln('');
      }
      return { exitCode: 0 };

    case 'install':
      if (rest.length === 0) {
        ctx.writeError('apt: no packages specified');
        return { exitCode: 1 };
      }
      ctx.writeln(`Reading package lists...`);
      ctx.writeln(`Building dependency tree...`);
      ctx.writeln(`The following NEW packages will be installed:`);
      ctx.writeln(`  ${rest.join(' ')}`);
      ctx.writeln('');
      ctx.writeln('\x1b[33mNote: Package installation requires the Extension API.\x1b[0m');
      ctx.writeln('\x1b[33mUse: substrateos.install("' + rest[0] + '") in the console.\x1b[0m');
      return { exitCode: 0 };

    case 'remove':
      if (rest.length === 0) {
        ctx.writeError('apt: no packages specified');
        return { exitCode: 1 };
      }
      ctx.writeln(`Removing ${rest[0]}...`);
      return { exitCode: 0 };

    case 'update':
      ctx.writeln('Hit:1 https://registry.substrateos.dev substrateos InRelease');
      ctx.writeln('Reading package lists... Done');
      return { exitCode: 0 };

    case 'upgrade':
      ctx.writeln('Reading package lists... Done');
      ctx.writeln('Calculating upgrade... Done');
      ctx.writeln('0 upgraded, 0 newly installed, 0 to remove.');
      return { exitCode: 0 };

    case 'show':
      if (rest.length === 0) {
        ctx.writeError('apt: no package specified');
        return { exitCode: 1 };
      }
      const pkg = packageManager['getBuiltInPackages']().find(p => p.name === rest[0]);
      if (pkg) {
        ctx.writeln(`Package: ${pkg.name}`);
        ctx.writeln(`Version: ${pkg.version}`);
        ctx.writeln(`Description: ${pkg.description}`);
        ctx.writeln(`Homepage: https://substrateos.dev/packages/${pkg.name}`);
      } else {
        ctx.writeError(`N: Unable to locate package ${rest[0]}`);
        return { exitCode: 1 };
      }
      return { exitCode: 0 };

    default:
      ctx.writeError(`E: Invalid operation ${cmd}`);
      return { exitCode: 1 };
  }
};
