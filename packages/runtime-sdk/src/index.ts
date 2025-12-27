/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║               EDWARDS TECH INNOVATION                    ║
 * ║                                                          ║
 * ╚══════════════════════════════════════════════════════════╝
 *  Business Unit : SubstrateOS-Core
 *  Module        : WebAssembly Linux DevKit Platform
 *  Author        : Andrew "Dru" Edwards
 *  Umbrella      : Edwards Tech Innovation
 *  Notice        : © 2025 All rights reserved.
 * ============================================================
 */

/**
 * SubstrateOS Runtime SDK
 * Main entry point for the browser runtime
 */

// Re-export everything from runtime module
export * from './runtime';

// Re-export shell module
export * from './shell';

// Re-export extensions module
export * from './extensions';

// Re-export persistence module (explicit to avoid conflicts)
export { 
  SubstrateOSPersistence, 
  getPersistence, 
  type PersistedFile, 
  type KeyValueEntry,
  type InstalledPackage as PersistedPackage,
  type SessionLock,
  type WorkspaceExport,
  type MigrationContext,
} from './persistence';

// Re-export licensing module
export {
  LicenseManager,
  getLicenseManager,
  requireFeature,
  checkFeature,
  type LicenseTier,
  type LicenseInfo,
  type LicenseFeatures,
  type LicenseValidationResult,
} from './licensing';

/**
 * Metrics collected by the SubstrateOS Runtime
 */
export interface SubstrateOSMetrics {
  bootTimeMs?: number;
  commandsExecuted?: number;
  deviceCalls?: Record<string, number>;
  errorsCount?: number;
}
