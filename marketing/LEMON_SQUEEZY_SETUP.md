# Lemon Squeezy Product Setup Guide

## Quick Setup Checklist

### 1. Create Products in Lemon Squeezy Dashboard

Go to: https://app.lemonsqueezy.com/products

#### Product: SubstrateOS Free
- **Name:** SubstrateOS Free
- **Price:** $0 (Free)
- **Type:** Digital Download
- **Description:** Browser-native Linux shell with 75+ commands, SQLite, and 50MB storage
- **Slug:** `substrateos-free`

#### Product: SubstrateOS Developer
- **Name:** SubstrateOS Developer
- **Variants:**
  - Monthly: $9/month (recurring)
  - Annual: $90/year (recurring, save $18)
- **Type:** Subscription
- **Description:** Full development environment with Python 3.12, Node.js 20, Git, and 200MB storage
- **Slug:** `substrateos-developer`

#### Product: SubstrateOS Pro
- **Name:** SubstrateOS Pro
- **Variants:**
  - Monthly: $19/month (recurring)
  - Annual: $190/year (recurring, save $38)
- **Type:** Subscription
- **Description:** AI Agent SDK with 11 tools, agent memory, full networking, and 500MB storage
- **Slug:** `substrateos-pro`

#### Product: SubstrateOS Classroom
- **Name:** SubstrateOS Classroom
- **Price:** $299/year (recurring)
- **Type:** Subscription
- **Description:** Educational tier with instructor dashboard, 25 student seats, and learning tools
- **Slug:** `substrateos-classroom`
- **Note:** Add per-seat pricing for additional students ($9/student/year)

#### Product: SubstrateOS Enterprise
- **Name:** SubstrateOS Enterprise
- **Price:** Contact Sales (or $25,000 starting)
- **Type:** Subscription
- **Description:** Full enterprise features with SSO, audit logging, compliance, and SLA
- **Slug:** `substrateos-enterprise`

---

### 2. Configure Webhooks

Go to: https://app.lemonsqueezy.com/settings/webhooks

Create a webhook with these events:
- `order_created`
- `subscription_created`
- `subscription_updated`
- `subscription_cancelled`
- `license_key_created`

**Webhook URL:** `https://your-api.com/api/lemon-squeezy/webhook`

**Signing Secret:** Save this - you'll need it for verification

---

### 3. Enable License Keys

For each paid product, enable license keys:
1. Go to Product → Settings → License Keys
2. Enable "Generate license keys"
3. Set activation limit: 3 devices
4. Set expiration: Based on subscription

---

### 4. Checkout Links

Your main checkout link:
```
https://edwardstech.lemonsqueezy.com/checkout/buy/52e14b1e-ba38-4f14-b1b2-a6b0e5397624
```

**Embed overlay on your site:**
```html
<a href="https://edwardstech.lemonsqueezy.com/checkout/buy/52e14b1e-ba38-4f14-b1b2-a6b0e5397624?embed=1" 
   class="lemonsqueezy-button">Buy SubstrateOS</a>
<script src="https://assets.lemonsqueezy.com/lemon.js" defer></script>
```

**Direct product links (update with your actual product IDs):**
```
# Free (no checkout needed)
https://substrateos.dev/free

# Developer
https://edwardstech.lemonsqueezy.com/checkout/buy/{DEVELOPER_VARIANT_ID}

# Pro
https://edwardstech.lemonsqueezy.com/checkout/buy/{PRO_VARIANT_ID}

# Classroom
https://edwardstech.lemonsqueezy.com/checkout/buy/{CLASSROOM_VARIANT_ID}

# Enterprise
https://edwardstech.lemonsqueezy.com/checkout/buy/{ENTERPRISE_VARIANT_ID}
```

---

### 5. API Integration

Get your API key from: https://app.lemonsqueezy.com/settings/api

```typescript
// Example: Verify license key
const response = await fetch('https://api.lemonsqueezy.com/v1/licenses/validate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    license_key: 'YOUR_LICENSE_KEY',
    instance_name: 'SubstrateOS Browser Instance'
  })
});

const data = await response.json();
// data.valid === true means license is active
// data.license_key.activation_limit shows max activations
// data.meta.product_name shows which tier
```

---

### 6. Test Mode

Before going live:
1. Enable test mode in Lemon Squeezy
2. Use test card: `4242 4242 4242 4242`
3. Any future expiry, any CVC
4. Test the full flow

---

## Product JSON Reference

See `lemon-squeezy-products.json` for the full product configuration including:
- All variant IDs
- Pricing details
- Feature lists
- API tool definitions

---

## Support

- Lemon Squeezy Docs: https://docs.lemonsqueezy.com
- API Reference: https://docs.lemonsqueezy.com/api
- Webhooks: https://docs.lemonsqueezy.com/webhooks
