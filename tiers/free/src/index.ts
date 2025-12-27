/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║               SUBSTRATEOS FREE TIER                      ║
 * ╚══════════════════════════════════════════════════════════╝
 * 
 * Browser-native Linux playground for learning and experimentation.
 * 
 * Features:
 * - 50+ shell commands
 * - SQLite database
 * - Interactive tutorials
 * - Persistent filesystem (50MB)
 * 
 * Price: $0 (Free forever)
 */

// Re-export core runtime (subset for free tier)
export { SubstrateOS } from '@substrateos/runtime';
export { VirtualFileSystem } from '@substrateos/runtime';

// Tier configuration
export const TIER = 'free' as const;
export const TIER_CONFIG = {
  name: 'SubstrateOS Free',
  price: '$0',
  features: {
    shell: true,
    sqlite: true,
    tutorials: true,
    filesystem: {
      maxSize: 50 * 1024 * 1024, // 50MB
      persistent: true,
    },
    workspaces: {
      max: 1,
    },
    python: false,
    nodejs: false,
    agentSdk: false,
    embedding: false,
  },
  restrictions: {
    blockedCommands: ['apt install python', 'apt install nodejs'],
  },
  upgradePrompts: {
    python: 'Upgrade to Developer ($9/mo) for Python support',
    nodejs: 'Upgrade to Developer ($9/mo) for Node.js support',
    agentSdk: 'Upgrade to Pro ($19/mo) for Agent SDK',
  },
};

/**
 * Check if a feature is available in this tier
 */
export function hasFeature(feature: keyof typeof TIER_CONFIG.features): boolean {
  const value = TIER_CONFIG.features[feature];
  if (typeof value === 'boolean') return value;
  return value !== undefined;
}

/**
 * Get upgrade message for a feature
 */
export function getUpgradeMessage(feature: string): string | null {
  return (TIER_CONFIG.upgradePrompts as Record<string, string>)[feature] || null;
}

/**
 * Initialize SubstrateOS with Free tier configuration
 */
export async function createFreeOS(container?: HTMLElement): Promise<any> {
  const { SubstrateOS } = await import('@substrateos/runtime');
  
  const os = new SubstrateOS({
    container,
    tier: 'free',
    filesystem: {
      maxSize: TIER_CONFIG.features.filesystem.maxSize,
    },
  });

  // Apply tier restrictions
  os.on('beforeCommand', (cmd: string) => {
    for (const blocked of TIER_CONFIG.restrictions.blockedCommands) {
      if (cmd.startsWith(blocked)) {
        const feature = blocked.includes('python') ? 'python' : 'nodejs';
        throw new Error(getUpgradeMessage(feature) || 'Feature not available');
      }
    }
  });

  await os.boot();
  return os;
}

// Default export
export default {
  TIER,
  TIER_CONFIG,
  hasFeature,
  getUpgradeMessage,
  createFreeOS,
};
