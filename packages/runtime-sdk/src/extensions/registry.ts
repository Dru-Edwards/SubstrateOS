/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║               EDWARDS TECH INNOVATION                    ║
 * ╚══════════════════════════════════════════════════════════╝
 *  SubstrateOS Package Registry
 *  
 *  Registry for discovering and distributing SubstrateOS extensions.
 *  Supports multiple sources: official registry, GitHub, CDN URLs.
 */

import { ExtensionManifest } from './extension-api';

/**
 * Registry package entry
 */
export interface RegistryPackage {
  name: string;
  versions: RegistryVersion[];
  latest: string;
  description: string;
  author?: string;
  license?: string;
  homepage?: string;
  repository?: string;
  keywords?: string[];
  downloads?: number;
  created: string;
  updated: string;
}

/**
 * Package version info
 */
export interface RegistryVersion {
  version: string;
  url: string;
  sha256?: string;
  size?: number;
  dependencies?: Record<string, string>;
  published: string;
}

/**
 * Registry search options
 */
export interface SearchOptions {
  limit?: number;
  offset?: number;
  sort?: 'name' | 'downloads' | 'updated';
  order?: 'asc' | 'desc';
}

/**
 * Registry client for SubstrateOS packages
 */
export class SubstrateOSRegistry {
  private baseUrl: string;
  private cache: Map<string, RegistryPackage> = new Map();
  private cacheExpiry = 5 * 60 * 1000; // 5 minutes
  private cacheTimestamps: Map<string, number> = new Map();

  constructor(baseUrl = 'https://registry.substrateos.dev/api/v1') {
    this.baseUrl = baseUrl;
  }

  /**
   * Search for packages
   */
  async search(query: string, options: SearchOptions = {}): Promise<RegistryPackage[]> {
    const params = new URLSearchParams({
      q: query,
      limit: String(options.limit || 20),
      offset: String(options.offset || 0),
      sort: options.sort || 'downloads',
      order: options.order || 'desc'
    });

    try {
      const response = await fetch(`${this.baseUrl}/search?${params}`);
      if (!response.ok) {
        throw new Error(`Registry error: ${response.statusText}`);
      }
      return response.json();
    } catch (error) {
      // Return mock data if registry unavailable
      return this.getMockPackages(query);
    }
  }

  /**
   * Get package info
   */
  async getPackage(name: string): Promise<RegistryPackage | null> {
    // Check cache
    if (this.cache.has(name)) {
      const timestamp = this.cacheTimestamps.get(name) || 0;
      if (Date.now() - timestamp < this.cacheExpiry) {
        return this.cache.get(name)!;
      }
    }

    try {
      const response = await fetch(`${this.baseUrl}/packages/${encodeURIComponent(name)}`);
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`Registry error: ${response.statusText}`);
      }
      
      const pkg = await response.json();
      this.cache.set(name, pkg);
      this.cacheTimestamps.set(name, Date.now());
      return pkg;
      
    } catch (error) {
      // Return mock data if registry unavailable
      return this.getMockPackage(name);
    }
  }

  /**
   * Get specific version
   */
  async getVersion(name: string, version: string): Promise<RegistryVersion | null> {
    const pkg = await this.getPackage(name);
    if (!pkg) return null;
    
    if (version === 'latest') {
      return pkg.versions.find(v => v.version === pkg.latest) || null;
    }
    
    return pkg.versions.find(v => v.version === version) || null;
  }

  /**
   * Get download URL
   */
  async getDownloadUrl(name: string, version = 'latest'): Promise<string | null> {
    const ver = await this.getVersion(name, version);
    return ver?.url || null;
  }

  /**
   * List popular packages
   */
  async getPopular(limit = 10): Promise<RegistryPackage[]> {
    return this.search('', { limit, sort: 'downloads' });
  }

  /**
   * List recent packages
   */
  async getRecent(limit = 10): Promise<RegistryPackage[]> {
    return this.search('', { limit, sort: 'updated' });
  }

  /**
   * Mock packages for offline/demo mode
   */
  private getMockPackages(query: string): RegistryPackage[] {
    const mockPackages = this.getAllMockPackages();
    
    if (!query) return mockPackages;
    
    return mockPackages.filter(pkg => 
      pkg.name.includes(query) ||
      pkg.description.toLowerCase().includes(query.toLowerCase()) ||
      pkg.keywords?.some(k => k.includes(query))
    );
  }

  /**
   * Get mock package by name
   */
  private getMockPackage(name: string): RegistryPackage | null {
    return this.getAllMockPackages().find(p => p.name === name) || null;
  }

  /**
   * All mock packages for demo
   */
  private getAllMockPackages(): RegistryPackage[] {
    const now = new Date().toISOString();
    
    return [
      {
        name: '@substrateos/python',
        versions: [{ version: '1.0.0', url: 'https://cdn.substrateos.dev/pkg/python/1.0.0.js', published: now }],
        latest: '1.0.0',
        description: 'Python 3.11 interpreter powered by Pyodide WebAssembly',
        author: 'SubstrateOS Team',
        license: 'MIT',
        keywords: ['python', 'interpreter', 'pyodide', 'wasm'],
        downloads: 15420,
        created: now,
        updated: now
      },
      {
        name: '@substrateos/nodejs',
        versions: [{ version: '1.0.0', url: 'https://cdn.substrateos.dev/pkg/nodejs/1.0.0.js', published: now }],
        latest: '1.0.0',
        description: 'Node.js runtime for JavaScript execution',
        author: 'SubstrateOS Team',
        license: 'MIT',
        keywords: ['node', 'nodejs', 'javascript', 'runtime'],
        downloads: 12350,
        created: now,
        updated: now
      },
      {
        name: '@substrateos/git',
        versions: [{ version: '1.0.0', url: 'https://cdn.substrateos.dev/pkg/git/1.0.0.js', published: now }],
        latest: '1.0.0',
        description: 'Git version control using isomorphic-git',
        author: 'SubstrateOS Team',
        license: 'MIT',
        keywords: ['git', 'vcs', 'version-control', 'isomorphic-git'],
        downloads: 8930,
        created: now,
        updated: now
      },
      {
        name: '@substrateos/sqlite',
        versions: [{ version: '1.0.0', url: 'https://cdn.substrateos.dev/pkg/sqlite/1.0.0.js', published: now }],
        latest: '1.0.0',
        description: 'SQLite database using sql.js WebAssembly',
        author: 'SubstrateOS Team',
        license: 'MIT',
        keywords: ['sqlite', 'database', 'sql', 'wasm'],
        downloads: 7820,
        created: now,
        updated: now
      },
      {
        name: '@substrateos/code-editor',
        versions: [{ version: '1.0.0', url: 'https://cdn.substrateos.dev/pkg/code-editor/1.0.0.js', published: now }],
        latest: '1.0.0',
        description: 'Monaco-based code editor with syntax highlighting',
        author: 'SubstrateOS Team',
        license: 'MIT',
        keywords: ['editor', 'monaco', 'code', 'syntax', 'ide'],
        downloads: 6540,
        created: now,
        updated: now
      },
      {
        name: '@substrateos/webgl',
        versions: [{ version: '1.0.0', url: 'https://cdn.substrateos.dev/pkg/webgl/1.0.0.js', published: now }],
        latest: '1.0.0',
        description: 'WebGL 2.0 3D graphics with Three.js integration',
        author: 'SubstrateOS Team',
        license: 'MIT',
        keywords: ['webgl', 'graphics', '3d', 'threejs', 'games'],
        downloads: 5430,
        created: now,
        updated: now
      },
      {
        name: '@substrateos/canvas',
        versions: [{ version: '1.0.0', url: 'https://cdn.substrateos.dev/pkg/canvas/1.0.0.js', published: now }],
        latest: '1.0.0',
        description: 'HTML5 Canvas 2D graphics API',
        author: 'SubstrateOS Team',
        license: 'MIT',
        keywords: ['canvas', 'graphics', '2d', 'drawing', 'games'],
        downloads: 4210,
        created: now,
        updated: now
      },
      {
        name: '@substrateos/audio',
        versions: [{ version: '1.0.0', url: 'https://cdn.substrateos.dev/pkg/audio/1.0.0.js', published: now }],
        latest: '1.0.0',
        description: 'Web Audio API for sound synthesis and playback',
        author: 'SubstrateOS Team',
        license: 'MIT',
        keywords: ['audio', 'sound', 'music', 'webaudio'],
        downloads: 3890,
        created: now,
        updated: now
      },
      {
        name: '@substrateos/gamepad',
        versions: [{ version: '1.0.0', url: 'https://cdn.substrateos.dev/pkg/gamepad/1.0.0.js', published: now }],
        latest: '1.0.0',
        description: 'Gamepad API for controller input',
        author: 'SubstrateOS Team',
        license: 'MIT',
        keywords: ['gamepad', 'controller', 'input', 'games'],
        downloads: 2340,
        created: now,
        updated: now
      },
      {
        name: '@substrateos/markdown',
        versions: [{ version: '1.0.0', url: 'https://cdn.substrateos.dev/pkg/markdown/1.0.0.js', published: now }],
        latest: '1.0.0',
        description: 'Markdown parser and renderer',
        author: 'SubstrateOS Team',
        license: 'MIT',
        keywords: ['markdown', 'parser', 'renderer', 'md'],
        downloads: 1980,
        created: now,
        updated: now
      },
      {
        name: '@substrateos/crypto',
        versions: [{ version: '1.0.0', url: 'https://cdn.substrateos.dev/pkg/crypto/1.0.0.js', published: now }],
        latest: '1.0.0',
        description: 'Cryptographic utilities using Web Crypto API',
        author: 'SubstrateOS Team',
        license: 'MIT',
        keywords: ['crypto', 'encryption', 'hashing', 'security'],
        downloads: 1650,
        created: now,
        updated: now
      },
      {
        name: '@substrateos/terminal-themes',
        versions: [{ version: '1.0.0', url: 'https://cdn.substrateos.dev/pkg/terminal-themes/1.0.0.js', published: now }],
        latest: '1.0.0',
        description: 'Color themes for the SubstrateOS terminal',
        author: 'Community',
        license: 'MIT',
        keywords: ['themes', 'terminal', 'colors', 'ui'],
        downloads: 1420,
        created: now,
        updated: now
      }
    ];
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    this.cacheTimestamps.clear();
  }
}

/**
 * Default registry instance
 */
export const registry = new SubstrateOSRegistry();

/**
 * Resolve package specifier to URL
 */
export function resolvePackage(specifier: string): { name: string; version: string; url?: string } {
  // Handle direct URLs
  if (specifier.startsWith('http://') || specifier.startsWith('https://')) {
    return { name: specifier.split('/').pop() || 'unknown', version: 'latest', url: specifier };
  }
  
  // Handle GitHub shorthand: owner/repo or github:owner/repo
  if (specifier.startsWith('github:') || /^[\w-]+\/[\w-]+$/.test(specifier)) {
    const repo = specifier.replace('github:', '');
    return {
      name: repo,
      version: 'latest',
      url: `https://raw.githubusercontent.com/${repo}/main/dist/index.js`
    };
  }
  
  // Handle scoped packages: @scope/name@version
  const match = specifier.match(/^(@[\w-]+\/[\w-]+)(?:@(.+))?$/);
  if (match) {
    return {
      name: match[1],
      version: match[2] || 'latest'
    };
  }
  
  // Handle simple packages: name@version
  const simple = specifier.match(/^([\w-]+)(?:@(.+))?$/);
  if (simple) {
    return {
      name: simple[1],
      version: simple[2] || 'latest'
    };
  }
  
  return { name: specifier, version: 'latest' };
}
