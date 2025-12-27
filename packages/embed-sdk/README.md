<!--
  ╔══════════════════════════════════════════════════════════╗
  ║               EDWARDS TECH INNOVATION                    ║
  ║                                                          ║
  ╚══════════════════════════════════════════════════════════╝
   Business Unit : DruOS-Core
   Module        : Embed SDK Documentation
   Author        : Andrew "Dru" Edwards
   Umbrella      : Edwards Tech Innovation
   Notice        : © 2025 All rights reserved.
  ============================================================
-->

# @druos/embed-sdk

JavaScript SDK for embedding DruOS DevTools Sandbox into your web applications.

## 🚀 Quick Start

```bash
npm install @druos/embed-sdk
```

```javascript
import { createDevtoolsSandbox } from '@druos/embed-sdk';

// Create a sandbox
const sandbox = await createDevtoolsSandbox({
  container: document.getElementById('sandbox'),
  template: 'devtools-sandbox',
  defaultCommand: 'echo "Hello, World!"',
  onEvent: (event) => {
    console.log('Sandbox event:', event);
  }
});

// Execute commands
await sandbox.execute('ls -la');

// Get metrics
const metrics = await sandbox.getMetrics();
console.log('Commands executed:', metrics.commandCount);

// Cleanup when done
await sandbox.destroy();
```

## 📦 Installation

### NPM
```bash
npm install @druos/embed-sdk
```

### Yarn
```bash
yarn add @druos/embed-sdk
```

### CDN
```html
<script src="https://cdn.druos.dev/embed-sdk/latest/index.js"></script>
```

## 🎯 Basic Usage

### Minimal Setup
```javascript
import { quickEmbed } from '@druos/embed-sdk';

// Embed with minimal config
const sandbox = await quickEmbed('my-sandbox-container');
```

### Full Configuration
```javascript
import { createDevtoolsSandbox } from '@druos/embed-sdk';

const sandbox = await createDevtoolsSandbox({
  // Required
  container: document.getElementById('sandbox'),
  
  // Optional
  template: 'devtools-sandbox',              // or 'education-lab', 'ai-sandbox'
  endpoint: 'https://sandbox.druos.dev',     // Custom endpoint
  tenantId: 'customer-123',                  // Multi-tenant ID
  userId: 'user-456',                        // User tracking
  
  // Customization
  defaultCommand: 'my-cli --help',           // Run on startup
  env: {                                      // Environment variables
    API_KEY: 'demo-key',
    DEBUG: 'true'
  },
  
  // Resource limits
  limits: {
    maxRuntimeMs: 600000,                    // 10 minutes
    maxCommands: 100,
    maxHttpCalls: 50
  },
  
  // Styling
  style: {
    width: '100%',
    height: '600px',
    theme: 'dark'
  },
  
  // File overlay
  overlay: [
    {
      path: '/home/user/demo.sh',
      content: '#!/bin/bash\necho "Welcome!"'
    }
  ],
  
  // Event handler
  onEvent: (event) => {
    analytics.track('sandbox_event', event);
  }
});
```

## 📊 Event Tracking

### Event Types
```javascript
// Listen to all events
onEvent: (event) => {
  switch(event.type) {
    case 'sandbox_started':
      console.log('Sandbox started');
      break;
      
    case 'command_executed':
      console.log('Command:', event.data.command);
      console.log('Exit code:', event.data.exitCode);
      break;
      
    case 'http_request':
      console.log('HTTP request to:', event.data.url);
      break;
      
    case 'limit_reached':
      console.log('Limit reached:', event.data.limitType);
      break;
      
    case 'error':
      console.error('Error:', event.data.error);
      break;
  }
}
```

### Analytics Integration
```javascript
// Google Analytics
onEvent: (event) => {
  gtag('event', 'sandbox_interaction', {
    event_category: 'sandbox',
    event_label: event.type,
    value: event.data?.command
  });
}

// Segment
onEvent: (event) => {
  analytics.track('Sandbox Event', {
    type: event.type,
    sessionId: event.sessionId,
    ...event.data
  });
}

// Custom Backend
onEvent: async (event) => {
  await fetch('/api/sandbox-events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(event)
  });
}
```

## 🎮 Sandbox Control

### Execute Commands
```javascript
// Run a single command
await sandbox.execute('npm install');

// Run multiple commands
await sandbox.execute('cd /app && npm test');

// Run with pipes
await sandbox.execute('cat file.txt | grep error');
```

### Environment Variables
```javascript
// Update environment
await sandbox.updateEnv({
  NODE_ENV: 'production',
  API_URL: 'https://api.example.com'
});
```

### Reset Sandbox
```javascript
// Reset to initial state
await sandbox.reset();
```

### Get Metrics
```javascript
const metrics = await sandbox.getMetrics();
console.log({
  commands: metrics.commandCount,
  httpRequests: metrics.httpRequestCount,
  storageOps: metrics.storageOperationCount
});
```

## 🔒 Usage Limits

### Setting Limits
```javascript
const sandbox = await createDevtoolsSandbox({
  container: element,
  limits: {
    maxRuntimeMs: 300000,      // 5 minutes
    maxCommands: 50,            // 50 commands
    maxHttpCalls: 20,           // 20 HTTP requests
    maxStorageOps: 100,         // 100 storage operations
    maxMemoryBytes: 52428800    // 50MB
  },
  onEvent: (event) => {
    if (event.type === 'limit_reached') {
      alert(`Limit reached: ${event.data.limitType}`);
    }
  }
});
```

### Handling Limit Events
```javascript
onEvent: (event) => {
  if (event.type === 'limit_reached') {
    switch(event.data.limitType) {
      case 'runtime':
        showMessage('Session time limit reached');
        break;
      case 'commands':
        showMessage('Command limit reached');
        break;
      case 'http':
        showMessage('HTTP request limit reached');
        break;
    }
  }
}
```

## 🎨 Customization

### Themes
```javascript
// Dark theme
style: {
  theme: 'dark'
}

// Light theme
style: {
  theme: 'light'
}
```

### Custom Dimensions
```javascript
style: {
  width: '800px',
  height: '600px'
}
```

### Preloaded Files
```javascript
overlay: [
  {
    path: '/home/user/.bashrc',
    content: 'alias ll="ls -la"\nalias dev="npm run dev"'
  },
  {
    path: '/home/user/README.md',
    content: '# Welcome to the Sandbox\n\nTry running `demo.sh`!'
  },
  {
    path: '/home/user/demo.sh',
    content: '#!/bin/bash\necho "Running demo..."\nnpm test'
  }
]
```

## 🏢 Multi-Tenant Usage

### Tenant Configuration
```javascript
const sandbox = await createDevtoolsSandbox({
  container: element,
  tenantId: 'customer-123',
  userId: 'user-456',
  endpoint: 'https://sandbox.myapp.com',
  
  // Tenant-specific limits
  limits: getTenantLimits('customer-123'),
  
  // Tenant-specific environment
  env: getTenantEnv('customer-123'),
  
  onEvent: (event) => {
    // Track per tenant
    trackUsage(event.tenantId, event);
  }
});
```

## 📈 Usage Tracking

### Backend Integration
```javascript
// Track usage for billing
onEvent: async (event) => {
  if (event.type === 'sandbox_stopped') {
    await fetch('/api/usage', {
      method: 'POST',
      body: JSON.stringify({
        tenantId: event.tenantId,
        duration: event.data.duration,
        commands: event.metrics.commandCount,
        httpCalls: event.metrics.httpRequestCount
      })
    });
  }
}
```

### Conversion Tracking
```javascript
onEvent: (event) => {
  // Track meaningful actions
  if (event.type === 'command_executed') {
    if (event.data.command.includes('deploy')) {
      recordConversion('sandbox_to_deploy');
    }
    if (event.data.command.includes('purchase')) {
      recordConversion('sandbox_to_purchase');
    }
  }
}
```

## 🐛 Error Handling

```javascript
try {
  const sandbox = await createDevtoolsSandbox({
    container: element,
    onEvent: (event) => {
      if (event.type === 'error') {
        console.error('Sandbox error:', event.data.error);
        // Log to error tracking service
        Sentry.captureException(new Error(event.data.error));
      }
    }
  });
} catch (error) {
  console.error('Failed to create sandbox:', error);
  // Show fallback UI
  showFallbackContent();
}
```

## 📝 TypeScript Support

```typescript
import { 
  createDevtoolsSandbox, 
  DruOSDevtoolsOptions,
  DruOSUsageEvent,
  DruOSSandboxHandle 
} from '@druos/embed-sdk';

const options: DruOSDevtoolsOptions = {
  container: document.getElementById('sandbox') as HTMLElement,
  template: 'devtools-sandbox',
  onEvent: (event: DruOSUsageEvent) => {
    console.log(event.type);
  }
};

const sandbox: DruOSSandboxHandle = await createDevtoolsSandbox(options);
```

## 🔗 API Reference

### createDevtoolsSandbox(options)
Creates a new sandbox instance.

**Parameters:**
- `options: DruOSDevtoolsOptions` - Configuration options

**Returns:**
- `Promise<DruOSSandboxHandle>` - Sandbox control handle

### quickEmbed(containerId, options?)
Quick helper for embedding with minimal config.

**Parameters:**
- `containerId: string` - ID of container element
- `options?: Partial<DruOSDevtoolsOptions>` - Optional configuration

**Returns:**
- `Promise<DruOSSandboxHandle>` - Sandbox control handle

### DruOSSandboxHandle
- `sessionId: string` - Unique session identifier
- `execute(command: string): Promise<void>` - Execute a command
- `getMetrics(): Promise<Metrics>` - Get current metrics
- `reset(): Promise<void>` - Reset sandbox state
- `updateEnv(env: Record<string, string>): Promise<void>` - Update environment
- `destroy(): Promise<void>` - Cleanup and destroy

## 📦 Examples

### Documentation Site
```javascript
// In your docs site
document.querySelectorAll('.code-example').forEach(async (element) => {
  const code = element.textContent;
  const container = element.parentElement;
  
  const sandbox = await createDevtoolsSandbox({
    container,
    defaultCommand: code,
    style: { height: '400px' }
  });
});
```

### Product Demo
```javascript
// Interactive product demo
const sandbox = await createDevtoolsSandbox({
  container: document.getElementById('demo'),
  overlay: [
    { path: '/app/config.json', content: demoConfig },
    { path: '/app/demo.js', content: demoScript }
  ],
  defaultCommand: 'node /app/demo.js',
  onEvent: trackDemoInteraction
});
```

### Training Platform
```javascript
// Educational environment
const sandbox = await createDevtoolsSandbox({
  container: document.getElementById('lesson'),
  template: 'education-lab',
  overlay: lessonFiles,
  limits: { maxRuntimeMs: 1800000 }, // 30 minutes
  onEvent: trackStudentProgress
});
```

## 🆘 Support

- **Documentation**: https://docs.druos.dev/embed
- **Issues**: https://github.com/edwards-tech/druos-core/issues
- **Email**: support@druos.dev
- **Discord**: https://discord.gg/druos

## 📄 License

Apache-2.0 © Edwards Tech Innovation
