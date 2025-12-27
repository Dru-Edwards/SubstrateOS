# SubstrateOS Quick Start Guide

## Prerequisites

- **Node.js** 18.0.0 or higher
- **pnpm** 8.0.0 or higher

## Installation

```bash
# Install pnpm if not already installed
npm install -g pnpm

# Install all dependencies
pnpm install

# Build all packages
pnpm build
```

## Running the Demo

```bash
# Start the development server
cd web-demo
pnpm dev
```

Then open http://localhost:5173 in your browser.

## Running Tests

```bash
# Run all E2E tests
cd web-demo
pnpm test:e2e
```

## Building for Production

```bash
# Build all packages
pnpm build

# The production build is in web-demo/dist/
```

## Project Structure

```
SubstrateOS/
├── packages/
│   ├── runtime-sdk/        # Core shell and runtime
│   ├── device-protocols/   # Device bridge protocols
│   └── embed-sdk/          # Embeddable SDK
├── web-demo/
│   ├── src/                # Main application source
│   ├── tests/              # E2E tests
│   └── dist/               # Production build output
├── package.json            # Root workspace config
└── pnpm-workspace.yaml     # Workspace definition
```

## Key Commands

| Command | Description |
|---------|-------------|
| `pnpm install` | Install all dependencies |
| `pnpm build` | Build all packages |
| `pnpm dev` | Start dev servers |
| `pnpm test` | Run all tests |

## Deployment

The `web-demo/dist/` folder contains the production-ready static files that can be deployed to any static hosting service (Netlify, Vercel, GitHub Pages, etc.).

```bash
# Build for production
cd web-demo
pnpm build

# Deploy the dist/ folder to your hosting service
```
