/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║               EDWARDS TECH INNOVATION                    ║
 * ╚══════════════════════════════════════════════════════════╝
 *  SubstrateOS License Management
 *  
 *  Lemon Squeezy integration for license validation,
 *  feature gating, and subscription management.
 */

// ==================== TYPES ====================

export type LicenseTier = 'free' | 'developer' | 'pro' | 'education' | 'enterprise';

export interface LicenseInfo {
  tier: LicenseTier;
  key: string | null;
  email: string | null;
  valid: boolean;
  expiresAt: Date | null;
  features: LicenseFeatures;
  trialDaysRemaining: number | null;
  meta: {
    productId?: string;
    variantId?: string;
    customerId?: string;
    orderId?: string;
  };
}

export interface LicenseFeatures {
  // Runtimes
  pythonRuntime: boolean;
  nodeRuntime: boolean;
  sqliteAdvanced: boolean;
  
  // Agent SDK
  agentSdk: boolean;
  agentMemory: boolean;
  agentFetch: boolean;
  agentToolCalls: number; // -1 = unlimited
  
  // Workspaces
  multiWorkspace: boolean;
  maxWorkspaces: number;
  workspaceSync: boolean;
  
  // Embedding
  embedAccess: boolean;
  embedCustomBranding: boolean;
  embedWhitelabel: boolean;
  
  // Enterprise
  ssoIntegration: boolean;
  auditLogging: boolean;
  safeModePresets: boolean;
  prioritySupport: boolean;
  
  // Classroom
  studentSeats: number;
  instructorDashboard: boolean;
  lessonBuilder: boolean;
}

export interface LicenseValidationResult {
  valid: boolean;
  license?: LicenseInfo;
  error?: string;
}

// ==================== FEATURE SETS ====================

const FREE_FEATURES: LicenseFeatures = {
  pythonRuntime: false,
  nodeRuntime: false,
  sqliteAdvanced: false,
  agentSdk: false,
  agentMemory: false,
  agentFetch: false,
  agentToolCalls: 0,
  multiWorkspace: false,
  maxWorkspaces: 1,
  workspaceSync: false,
  embedAccess: false,
  embedCustomBranding: false,
  embedWhitelabel: false,
  ssoIntegration: false,
  auditLogging: false,
  safeModePresets: false,
  prioritySupport: false,
  studentSeats: 0,
  instructorDashboard: false,
  lessonBuilder: false,
};

const DEVELOPER_FEATURES: LicenseFeatures = {
  pythonRuntime: true,
  nodeRuntime: true,
  sqliteAdvanced: true,
  agentSdk: false,
  agentMemory: false,
  agentFetch: false,
  agentToolCalls: 0,
  multiWorkspace: true,
  maxWorkspaces: 3,
  workspaceSync: false,
  embedAccess: true,
  embedCustomBranding: false,
  embedWhitelabel: false,
  ssoIntegration: false,
  auditLogging: false,
  safeModePresets: false,
  prioritySupport: false,
  studentSeats: 0,
  instructorDashboard: false,
  lessonBuilder: false,
};

const PRO_FEATURES: LicenseFeatures = {
  pythonRuntime: true,
  nodeRuntime: true,
  sqliteAdvanced: true,
  agentSdk: true,
  agentMemory: true,
  agentFetch: true,
  agentToolCalls: -1, // unlimited
  multiWorkspace: true,
  maxWorkspaces: 10,
  workspaceSync: true,
  embedAccess: true,
  embedCustomBranding: true,
  embedWhitelabel: false,
  ssoIntegration: false,
  auditLogging: false,
  safeModePresets: true,
  prioritySupport: false,
  studentSeats: 0,
  instructorDashboard: false,
  lessonBuilder: false,
};

const EDUCATION_FEATURES: LicenseFeatures = {
  pythonRuntime: true,
  nodeRuntime: true,
  sqliteAdvanced: true,
  agentSdk: false,
  agentMemory: false,
  agentFetch: false,
  agentToolCalls: 0,
  multiWorkspace: true,
  maxWorkspaces: 50,
  workspaceSync: true,
  embedAccess: true,
  embedCustomBranding: true,
  embedWhitelabel: false,
  ssoIntegration: false,
  auditLogging: true,
  safeModePresets: true,
  prioritySupport: false,
  studentSeats: 100, // configurable
  instructorDashboard: true,
  lessonBuilder: true,
};

const ENTERPRISE_FEATURES: LicenseFeatures = {
  pythonRuntime: true,
  nodeRuntime: true,
  sqliteAdvanced: true,
  agentSdk: true,
  agentMemory: true,
  agentFetch: true,
  agentToolCalls: -1,
  multiWorkspace: true,
  maxWorkspaces: -1, // unlimited
  workspaceSync: true,
  embedAccess: true,
  embedCustomBranding: true,
  embedWhitelabel: true,
  ssoIntegration: true,
  auditLogging: true,
  safeModePresets: true,
  prioritySupport: true,
  studentSeats: -1, // unlimited
  instructorDashboard: true,
  lessonBuilder: true,
};

const FEATURE_SETS: Record<LicenseTier, LicenseFeatures> = {
  free: FREE_FEATURES,
  developer: DEVELOPER_FEATURES,
  pro: PRO_FEATURES,
  education: EDUCATION_FEATURES,
  enterprise: ENTERPRISE_FEATURES,
};

// ==================== LICENSE MANAGER ====================

const STORAGE_KEY = 'substrateos_license';
const TRIAL_KEY = 'substrateos_trial_start';
const TRIAL_DAYS = 14;

// Lemon Squeezy API (configure via environment)
const LEMON_SQUEEZY_API = 'https://api.lemonsqueezy.com/v1';

export class LicenseManager {
  private license: LicenseInfo;
  private validateEndpoint: string | null = null;

  constructor() {
    this.license = this.loadLicense();
  }

  /**
   * Configure the license validation endpoint
   * For self-hosted validation proxy
   */
  setValidationEndpoint(url: string): void {
    this.validateEndpoint = url;
  }

  /**
   * Get current license info
   */
  getLicense(): LicenseInfo {
    return { ...this.license };
  }

  /**
   * Check if a feature is enabled
   */
  hasFeature(feature: keyof LicenseFeatures): boolean {
    const value = this.license.features[feature];
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    return false;
  }

  /**
   * Get feature limit (for numeric features)
   */
  getFeatureLimit(feature: keyof LicenseFeatures): number {
    const value = this.license.features[feature];
    return typeof value === 'number' ? value : 0;
  }

  /**
   * Check if user is on a trial
   */
  isOnTrial(): boolean {
    return this.license.trialDaysRemaining !== null && this.license.trialDaysRemaining > 0;
  }

  /**
   * Start a pro trial
   */
  startTrial(): void {
    const trialStart = localStorage.getItem(TRIAL_KEY);
    if (trialStart) {
      console.warn('Trial already started');
      return;
    }

    localStorage.setItem(TRIAL_KEY, Date.now().toString());
    this.license = {
      tier: 'pro',
      key: null,
      email: null,
      valid: true,
      expiresAt: new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000),
      features: PRO_FEATURES,
      trialDaysRemaining: TRIAL_DAYS,
      meta: {},
    };
    this.saveLicense();
  }

  /**
   * Activate a license key
   */
  async activate(email: string, licenseKey: string): Promise<LicenseValidationResult> {
    try {
      // Validate with Lemon Squeezy (or your proxy)
      const result = await this.validateWithLemonSqueezy(licenseKey);
      
      if (!result.valid) {
        return { valid: false, error: result.error || 'Invalid license key' };
      }

      // Determine tier from product
      const tier = this.getTierFromProduct(result.meta?.productId || '');
      
      this.license = {
        tier,
        key: licenseKey,
        email,
        valid: true,
        expiresAt: result.expiresAt ? new Date(result.expiresAt) : null,
        features: FEATURE_SETS[tier],
        trialDaysRemaining: null,
        meta: result.meta || {},
      };

      this.saveLicense();
      localStorage.removeItem(TRIAL_KEY); // Clear trial

      return { valid: true, license: this.license };
    } catch (e: unknown) {
      return { valid: false, error: `Validation failed: ${e}` };
    }
  }

  /**
   * Deactivate current license
   */
  deactivate(): void {
    this.license = this.createFreeLicense();
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(TRIAL_KEY);
  }

  /**
   * Refresh license status (check expiration, etc.)
   */
  async refresh(): Promise<void> {
    // Check trial expiration
    const trialStart = localStorage.getItem(TRIAL_KEY);
    if (trialStart) {
      const elapsed = Date.now() - parseInt(trialStart);
      const remaining = TRIAL_DAYS - Math.floor(elapsed / (24 * 60 * 60 * 1000));
      
      if (remaining <= 0) {
        // Trial expired
        this.license = this.createFreeLicense();
        this.saveLicense();
      } else {
        this.license.trialDaysRemaining = remaining;
      }
    }

    // Check license expiration
    if (this.license.expiresAt && new Date() > this.license.expiresAt) {
      this.license = this.createFreeLicense();
      this.saveLicense();
    }

    // Re-validate active license
    if (this.license.key) {
      const result = await this.validateWithLemonSqueezy(this.license.key);
      if (!result.valid) {
        this.license = this.createFreeLicense();
        this.saveLicense();
      }
    }
  }

  // ==================== PRIVATE METHODS ====================

  private loadLicense(): LicenseInfo {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Restore dates
        if (parsed.expiresAt) parsed.expiresAt = new Date(parsed.expiresAt);
        return parsed;
      }
    } catch (e) {
      console.warn('Failed to load license:', e);
    }

    // Check for active trial
    const trialStart = localStorage.getItem(TRIAL_KEY);
    if (trialStart) {
      const elapsed = Date.now() - parseInt(trialStart);
      const remaining = TRIAL_DAYS - Math.floor(elapsed / (24 * 60 * 60 * 1000));
      
      if (remaining > 0) {
        return {
          tier: 'pro',
          key: null,
          email: null,
          valid: true,
          expiresAt: new Date(parseInt(trialStart) + TRIAL_DAYS * 24 * 60 * 60 * 1000),
          features: PRO_FEATURES,
          trialDaysRemaining: remaining,
          meta: {},
        };
      }
    }

    return this.createFreeLicense();
  }

  private saveLicense(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.license));
  }

  private createFreeLicense(): LicenseInfo {
    return {
      tier: 'free',
      key: null,
      email: null,
      valid: true,
      expiresAt: null,
      features: FREE_FEATURES,
      trialDaysRemaining: null,
      meta: {},
    };
  }

  private async validateWithLemonSqueezy(
    licenseKey: string
  ): Promise<{ valid: boolean; error?: string; expiresAt?: string; meta?: Record<string, string> }> {
    // Use custom endpoint or direct Lemon Squeezy API
    const endpoint = this.validateEndpoint || `${LEMON_SQUEEZY_API}/licenses/validate`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          license_key: licenseKey,
        }),
      });

      if (!response.ok) {
        return { valid: false, error: `HTTP ${response.status}` };
      }

      const data = await response.json();
      
      // Lemon Squeezy response format
      if (data.valid || data.license_key?.status === 'active') {
        return {
          valid: true,
          expiresAt: data.license_key?.expires_at,
          meta: {
            productId: data.meta?.product_id?.toString(),
            variantId: data.meta?.variant_id?.toString(),
            customerId: data.meta?.customer_id?.toString(),
            orderId: data.meta?.order_id?.toString(),
          },
        };
      }

      return { valid: false, error: data.error || 'License not valid' };
    } catch (e: unknown) {
      // Offline mode: trust cached license
      console.warn('License validation failed (offline?):', e);
      return { valid: this.license.valid, error: 'Offline validation' };
    }
  }

  private getTierFromProduct(productId: string): LicenseTier {
    // Map Lemon Squeezy product IDs to tiers
    // Configure these when you create products
    const productMap: Record<string, LicenseTier> = {
      // Example mappings - replace with real IDs
      'prod_developer': 'developer',
      'prod_pro': 'pro',
      'prod_education': 'education',
      'prod_enterprise': 'enterprise',
    };

    return productMap[productId] || 'developer';
  }
}

// ==================== SINGLETON ====================

let licenseManager: LicenseManager | null = null;

export function getLicenseManager(): LicenseManager {
  if (!licenseManager) {
    licenseManager = new LicenseManager();
  }
  return licenseManager;
}

// ==================== FEATURE GATE DECORATOR ====================

/**
 * Check if feature is available, throw if not
 */
export function requireFeature(feature: keyof LicenseFeatures): void {
  const manager = getLicenseManager();
  if (!manager.hasFeature(feature)) {
    const license = manager.getLicense();
    throw new Error(
      `Feature '${feature}' requires ${license.tier === 'free' ? 'a paid license' : 'an upgraded license'}. ` +
      `Current tier: ${license.tier}. Upgrade at https://substrateos.dev/pricing`
    );
  }
}

/**
 * Check feature availability without throwing
 */
export function checkFeature(feature: keyof LicenseFeatures): boolean {
  return getLicenseManager().hasFeature(feature);
}

export default LicenseManager;
