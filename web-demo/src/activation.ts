/**
 * SubstrateOS License Activation UI
 * 
 * Provides a modal for users to enter their license key
 * and manage their subscription.
 */

import { getLicenseManager, type LicenseInfo } from '@substrateos/runtime';

export interface ActivationUIOptions {
  container?: HTMLElement;
  onActivated?: (license: LicenseInfo) => void;
  checkoutUrl?: string;
}

export class ActivationUI {
  private modal: HTMLDivElement | null = null;
  private manager = getLicenseManager();
  private options: ActivationUIOptions;

  constructor(options: ActivationUIOptions = {}) {
    this.options = {
      checkoutUrl: 'https://edwardstech.lemonsqueezy.com/checkout/buy/52e14b1e-ba38-4f14-b1b2-a6b0e5397624',
      ...options,
    };
  }

  /**
   * Show the activation modal
   */
  show(): void {
    if (this.modal) return;

    this.modal = document.createElement('div');
    this.modal.className = 'substrateos-activation-modal';
    this.modal.innerHTML = this.renderModal();
    document.body.appendChild(this.modal);

    this.attachStyles();
    this.attachEvents();
  }

  /**
   * Hide the activation modal
   */
  hide(): void {
    if (this.modal) {
      this.modal.remove();
      this.modal = null;
    }
  }

  /**
   * Show current license status
   */
  showStatus(): void {
    const license = this.manager.getLicense();
    const status = this.modal?.querySelector('.license-status');
    if (status) {
      status.innerHTML = this.renderStatus(license);
    }
  }

  private renderModal(): string {
    const license = this.manager.getLicense();
    
    return `
      <div class="activation-backdrop" onclick="this.parentElement.remove()"></div>
      <div class="activation-content">
        <button class="close-btn" onclick="this.closest('.substrateos-activation-modal').remove()">×</button>
        
        <div class="activation-header">
          <h2>🔐 SubstrateOS License</h2>
          <p>Unlock premium features with a license key</p>
        </div>

        <div class="license-status">
          ${this.renderStatus(license)}
        </div>

        ${license.tier === 'free' ? this.renderActivationForm() : this.renderManagement(license)}
        
        <div class="activation-footer">
          <a href="${this.options.checkoutUrl}" target="_blank" class="buy-btn">
            🍋 Buy SubstrateOS
          </a>
          <span class="tier-links">
            <a href="${this.options.checkoutUrl}?variant=developer" target="_blank">Developer $9/mo</a> •
            <a href="${this.options.checkoutUrl}?variant=pro" target="_blank">Pro $19/mo</a>
          </span>
        </div>
      </div>
    `;
  }

  private renderStatus(license: LicenseInfo): string {
    const tierColors: Record<string, string> = {
      free: '#6b7280',
      developer: '#3b82f6',
      pro: '#8b5cf6',
      education: '#22c55e',
      enterprise: '#f59e0b',
    };

    const tierNames: Record<string, string> = {
      free: 'Free',
      developer: 'Developer',
      pro: 'Pro',
      education: 'Classroom',
      enterprise: 'Enterprise',
    };

    let statusHtml = `
      <div class="status-badge" style="background: ${tierColors[license.tier]}">
        ${tierNames[license.tier]} Tier
      </div>
    `;

    if (license.trialDaysRemaining) {
      statusHtml += `
        <div class="trial-warning">
          ⏱️ Trial: ${license.trialDaysRemaining} days remaining
        </div>
      `;
    }

    if (license.expiresAt) {
      const expires = new Date(license.expiresAt).toLocaleDateString();
      statusHtml += `<div class="expires">Expires: ${expires}</div>`;
    }

    if (license.email) {
      statusHtml += `<div class="email">Licensed to: ${license.email}</div>`;
    }

    return statusHtml;
  }

  private renderActivationForm(): string {
    return `
      <form class="activation-form" id="activation-form">
        <div class="form-group">
          <label for="email">Email</label>
          <input type="email" id="license-email" placeholder="your@email.com" required>
        </div>
        <div class="form-group">
          <label for="license-key">License Key</label>
          <input type="text" id="license-key" placeholder="XXXX-XXXX-XXXX-XXXX" required>
        </div>
        <button type="submit" class="activate-btn">Activate License</button>
        <div class="error-message" id="activation-error"></div>
      </form>
      
      <div class="trial-section">
        <p>Want to try Pro features first?</p>
        <button class="trial-btn" id="start-trial">Start 14-Day Free Trial</button>
      </div>
    `;
  }

  private renderManagement(license: LicenseInfo): string {
    return `
      <div class="license-management">
        <h3>License Details</h3>
        <table class="license-details">
          <tr><td>Tier:</td><td>${license.tier}</td></tr>
          ${license.key ? `<tr><td>Key:</td><td>${license.key.substring(0, 8)}...</td></tr>` : ''}
          ${license.email ? `<tr><td>Email:</td><td>${license.email}</td></tr>` : ''}
        </table>
        
        <h3>Features</h3>
        <ul class="feature-list">
          ${license.features.pythonRuntime ? '<li>✅ Python 3.12</li>' : '<li>❌ Python</li>'}
          ${license.features.nodeRuntime ? '<li>✅ Node.js 20</li>' : '<li>❌ Node.js</li>'}
          ${license.features.agentSdk ? '<li>✅ Agent SDK</li>' : '<li>❌ Agent SDK</li>'}
          ${license.features.multiWorkspace ? `<li>✅ ${license.features.maxWorkspaces} Workspaces</li>` : '<li>❌ Multi-workspace</li>'}
        </ul>
        
        <button class="deactivate-btn" id="deactivate-license">Deactivate License</button>
      </div>
    `;
  }

  private attachStyles(): void {
    if (document.getElementById('substrateos-activation-styles')) return;

    const style = document.createElement('style');
    style.id = 'substrateos-activation-styles';
    style.textContent = `
      .substrateos-activation-modal {
        position: fixed;
        inset: 0;
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      }
      .activation-backdrop {
        position: absolute;
        inset: 0;
        background: rgba(0, 0, 0, 0.7);
      }
      .activation-content {
        position: relative;
        background: #1a1a2e;
        border-radius: 12px;
        padding: 24px;
        max-width: 420px;
        width: 90%;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
        color: #e4e4e7;
      }
      .close-btn {
        position: absolute;
        top: 12px;
        right: 12px;
        background: none;
        border: none;
        color: #6b7280;
        font-size: 24px;
        cursor: pointer;
      }
      .close-btn:hover { color: #fff; }
      .activation-header { text-align: center; margin-bottom: 20px; }
      .activation-header h2 { margin: 0 0 8px; }
      .activation-header p { color: #a1a1aa; margin: 0; }
      .license-status {
        background: #27272a;
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 20px;
        text-align: center;
      }
      .status-badge {
        display: inline-block;
        padding: 6px 16px;
        border-radius: 20px;
        font-weight: 600;
        color: white;
        margin-bottom: 8px;
      }
      .trial-warning { color: #fbbf24; margin-top: 8px; }
      .expires, .email { color: #a1a1aa; font-size: 13px; margin-top: 4px; }
      .form-group { margin-bottom: 16px; }
      .form-group label { display: block; margin-bottom: 6px; font-size: 14px; }
      .form-group input {
        width: 100%;
        padding: 10px 12px;
        background: #27272a;
        border: 1px solid #3f3f46;
        border-radius: 6px;
        color: #fff;
        font-size: 14px;
      }
      .form-group input:focus {
        outline: none;
        border-color: #8b5cf6;
      }
      .activate-btn, .trial-btn, .deactivate-btn {
        width: 100%;
        padding: 12px;
        border: none;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        margin-top: 8px;
      }
      .activate-btn {
        background: linear-gradient(135deg, #8b5cf6, #3b82f6);
        color: white;
      }
      .activate-btn:hover { opacity: 0.9; }
      .trial-btn {
        background: transparent;
        border: 1px solid #3f3f46;
        color: #a1a1aa;
      }
      .trial-btn:hover { border-color: #8b5cf6; color: #fff; }
      .deactivate-btn {
        background: #dc2626;
        color: white;
      }
      .error-message {
        color: #ef4444;
        font-size: 13px;
        margin-top: 8px;
        display: none;
      }
      .error-message.show { display: block; }
      .trial-section {
        margin-top: 20px;
        padding-top: 20px;
        border-top: 1px solid #3f3f46;
        text-align: center;
      }
      .trial-section p { color: #a1a1aa; margin-bottom: 12px; }
      .license-management h3 { margin: 16px 0 8px; font-size: 14px; }
      .license-details {
        width: 100%;
        font-size: 13px;
      }
      .license-details td { padding: 4px 0; }
      .license-details td:first-child { color: #a1a1aa; }
      .feature-list {
        list-style: none;
        padding: 0;
        margin: 0;
        font-size: 13px;
      }
      .feature-list li { padding: 4px 0; }
      .activation-footer {
        margin-top: 20px;
        padding-top: 20px;
        border-top: 1px solid #3f3f46;
        text-align: center;
      }
      .buy-btn {
        display: inline-block;
        background: linear-gradient(135deg, #fbbf24, #f59e0b);
        color: #18181b;
        padding: 10px 24px;
        border-radius: 6px;
        text-decoration: none;
        font-weight: 600;
        margin-bottom: 12px;
      }
      .buy-btn:hover { opacity: 0.9; }
      .tier-links { font-size: 12px; color: #6b7280; }
      .tier-links a { color: #8b5cf6; text-decoration: none; }
    `;
    document.head.appendChild(style);
  }

  private attachEvents(): void {
    const form = document.getElementById('activation-form');
    const trialBtn = document.getElementById('start-trial');
    const deactivateBtn = document.getElementById('deactivate-license');

    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = (document.getElementById('license-email') as HTMLInputElement).value;
      const key = (document.getElementById('license-key') as HTMLInputElement).value;
      const errorEl = document.getElementById('activation-error');

      try {
        const result = await this.manager.activate(email, key);
        if (result.valid && result.license) {
          this.options.onActivated?.(result.license);
          this.hide();
          alert('✅ License activated successfully!');
        } else {
          if (errorEl) {
            errorEl.textContent = result.error || 'Activation failed';
            errorEl.classList.add('show');
          }
        }
      } catch (err) {
        if (errorEl) {
          errorEl.textContent = 'Network error. Please try again.';
          errorEl.classList.add('show');
        }
      }
    });

    trialBtn?.addEventListener('click', () => {
      this.manager.startTrial();
      const license = this.manager.getLicense();
      this.options.onActivated?.(license);
      this.hide();
      alert('🎉 14-day Pro trial started!');
    });

    deactivateBtn?.addEventListener('click', () => {
      if (confirm('Are you sure you want to deactivate your license?')) {
        this.manager.deactivate();
        this.hide();
        alert('License deactivated. You are now on the Free tier.');
      }
    });
  }
}

// Global function for easy access
export function showActivation(options?: ActivationUIOptions): void {
  const ui = new ActivationUI(options);
  ui.show();
}

export default ActivationUI;
