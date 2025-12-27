# SubstrateOS Deployment Guide

## Option 1: Vercel (Recommended)

### Quick Deploy
1. Go to https://vercel.com/new
2. Import from GitHub: `Dru-Edwards/SubstrateOS`
3. Framework: Other
4. Root Directory: `web-demo`
5. Build Command: `pnpm build`
6. Output Directory: `dist`
7. Click Deploy

### Manual Deploy
```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
cd SubstrateOS
vercel
```

### Custom Domain
1. Go to Project Settings → Domains
2. Add `substrateos.dev` (or your domain)
3. Update DNS records as shown

---

## Option 2: Netlify

### Quick Deploy
1. Go to https://app.netlify.com/start
2. Connect GitHub: `Dru-Edwards/SubstrateOS`
3. Build settings auto-detected from `netlify.toml`
4. Click Deploy

### Manual Deploy
```bash
# Install Netlify CLI
npm i -g netlify-cli

# Login
netlify login

# Deploy
cd SubstrateOS
netlify deploy --prod
```

---

## Option 3: GitHub Pages

### Enable Pages
1. Go to repo Settings → Pages
2. Source: GitHub Actions
3. Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pages: write
      id-token: write
    
    steps:
      - uses: actions/checkout@v4
      
      - uses: pnpm/action-setup@v2
        with:
          version: 8
          
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
          
      - run: pnpm install
      - run: pnpm build
        working-directory: web-demo
        
      - uses: actions/configure-pages@v4
      
      - uses: actions/upload-pages-artifact@v3
        with:
          path: web-demo/dist
          
      - uses: actions/deploy-pages@v4
```

---

## Environment Variables

Set these in your deployment platform:

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_LEMON_SQUEEZY_API_KEY` | Lemon Squeezy API key | For license validation |
| `VITE_LEMON_SQUEEZY_STORE_ID` | Your store ID | For checkout links |

---

## Post-Deployment Checklist

- [ ] Verify landing page loads
- [ ] Test terminal demo works
- [ ] Verify Lemon Squeezy checkout link
- [ ] Check tier demos load correctly
- [ ] Test on mobile devices
- [ ] Set up custom domain
- [ ] Enable HTTPS (automatic on Vercel/Netlify)
- [ ] Configure analytics (optional)
