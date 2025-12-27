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

import './style.css';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import { SubstrateOSRuntime, SubstrateOSMetrics, SubstrateOSShell } from '@substrateos/runtime';
import { hostLogDevice, httpDevice, createStoreDevice } from '@substrateos/device-protocols';

// Store logs in memory for observability
const logHistory: any[] = [];
const MAX_LOGS = 100;

// Terminal tab management
interface TerminalTab {
  id: number;
  terminal: Terminal;
  fitAddon: FitAddon;
  shell: SubstrateOSShell;
  element: HTMLElement;
  inputBuffer: string;
}

let terminals: TerminalTab[] = [];
let activeTabId = 0;
let nextTabId = 1;

// Update UI status
function updateStatus(text: string, className?: string) {
  const statusEl = document.getElementById('status');
  const statusText = document.getElementById('status-text');
  if (statusEl && statusText) {
    statusText.textContent = text;
    statusEl.className = `status-badge ${className || ''}`;
  }
}

// Update loading status
function updateLoadingStatus(text: string) {
  const loadingStatus = document.getElementById('loading-status');
  if (loadingStatus) {
    loadingStatus.textContent = text;
  }
}

// Add log entry to panel
function addLog(entry: any) {
  // Store in history
  logHistory.push(entry);
  if (logHistory.length > MAX_LOGS) {
    logHistory.shift();
  }
  
  const logsPanel = document.getElementById('log-list');
  if (!logsPanel) return;
  
  // Remove empty state if present
  const emptyState = logsPanel.querySelector('.empty-state');
  if (emptyState) emptyState.remove();
  
  const logEntry = document.createElement('div');
  logEntry.className = `log-entry ${entry.level}`;
  
  const timestamp = new Date(entry.timestamp).toLocaleTimeString();
  logEntry.innerHTML = `
    <span class="log-time">${timestamp}</span>
    <span class="log-category">[${entry.category}]</span>
    <span class="log-message">${entry.message}</span>
  `;
  
  logsPanel.appendChild(logEntry);
  logsPanel.scrollTop = logsPanel.scrollHeight;
  
  // Keep only recent logs in DOM
  while (logsPanel.children.length > MAX_LOGS) {
    logsPanel.removeChild(logsPanel.firstChild!);
  }
}

// Setup tab switching
function setupTabs() {
  const tabs = document.querySelectorAll('.sidebar-tab');
  const panels = document.querySelectorAll('.sidebar-panel');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetPanel = tab.getAttribute('data-panel');
      
      // Update active tab
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      // Update active panel
      panels.forEach(p => p.classList.remove('active'));
      const panel = document.getElementById(targetPanel || '');
      if (panel) panel.classList.add('active');
    });
  });
}

// Update device list with new design
function updateDeviceList(devices: { name: string; icon: string; desc: string }[]) {
  const deviceList = document.getElementById('device-list');
  if (!deviceList) return;
  
  deviceList.innerHTML = devices.map(device => `
    <div class="device-card">
      <div class="device-icon">${device.icon}</div>
      <div class="device-info">
        <div class="device-name">${device.name}</div>
        <div class="device-desc">${device.desc}</div>
      </div>
      <div class="device-status"></div>
    </div>
  `).join('');
}

// Update metrics panel with new design
function updateMetrics(metrics: SubstrateOSMetrics) {
  const bootEl = document.getElementById('metric-boot');
  const commandsEl = document.getElementById('metric-commands');
  const deviceCallsEl = document.getElementById('metric-device-calls');
  const errorsEl = document.getElementById('metric-errors');
  
  const errorCount = logHistory.filter(l => l.level === 'error').length;
  const totalDeviceCalls = Object.values(metrics.deviceCalls || {}).reduce((a, b) => a + b, 0);
  
  if (bootEl) bootEl.textContent = `${metrics.bootTimeMs || 0}ms`;
  if (commandsEl) commandsEl.textContent = String(metrics.commandsExecuted || 0);
  if (deviceCallsEl) deviceCallsEl.textContent = String(totalDeviceCalls);
  if (errorsEl) {
    errorsEl.textContent = String(errorCount);
    errorsEl.className = `metric-value ${errorCount > 0 ? 'error' : ''}`;
  }
}

// Setup quick commands
function setupQuickCommands(sendCommand: (cmd: string) => void) {
  const quickCmds = document.querySelectorAll('.quick-cmd');
  quickCmds.forEach(btn => {
    btn.addEventListener('click', () => {
      const cmd = btn.getAttribute('data-cmd');
      if (cmd) {
        sendCommand(cmd + '\n');
      }
    });
  });
}

// Setup header buttons
function setupHeaderButtons(onRestart: () => void) {
  const restartBtn = document.getElementById('btn-restart');
  const fullscreenBtn = document.getElementById('btn-fullscreen');
  
  if (restartBtn) {
    restartBtn.addEventListener('click', onRestart);
  }
  
  if (fullscreenBtn) {
    fullscreenBtn.addEventListener('click', () => {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        document.documentElement.requestFullscreen();
      }
    });
  }
}

// Create device callbacks for shell
function createDeviceCallbacks() {
  return {
    http: async (method: string, url: string, body?: string) => {
      addLog({ timestamp: Date.now(), level: 'info', category: 'http', message: `${method} ${url}` });
      try {
        const response = await fetch(url, { method, body: body || undefined });
        const text = await response.text();
        return `HTTP ${response.status} ${response.statusText}\n${text.substring(0, 1000)}`;
      } catch (e) {
        throw new Error(`Request failed: ${(e as Error).message}`);
      }
    },
    store: async (op: string, key?: string, value?: string) => {
      const prefix = 'substrateos:';
      if (op === 'put' && key) {
        localStorage.setItem(prefix + key, value || '');
        addLog({ timestamp: Date.now(), level: 'info', category: 'store', message: `put ${key}` });
        return `OK`;
      } else if (op === 'get' && key) {
        const val = localStorage.getItem(prefix + key);
        addLog({ timestamp: Date.now(), level: 'info', category: 'store', message: `get ${key}` });
        return val !== null ? val : `(nil)`;
      } else if (op === 'delete' && key) {
        localStorage.removeItem(prefix + key);
        addLog({ timestamp: Date.now(), level: 'info', category: 'store', message: `delete ${key}` });
        return `OK`;
      } else if (op === 'list') {
        const keys = Object.keys(localStorage).filter(k => k.startsWith(prefix));
        return keys.map(k => k.slice(prefix.length)).join('\n') || '(empty)';
      }
      return 'Unknown operation';
    },
    log: (message: string) => {
      addLog({ timestamp: Date.now(), level: 'info', category: 'hostlog', message });
    }
  };
}

// Create a new terminal tab
function createTerminalTab(showMotdFn?: (term: Terminal, shell: SubstrateOSShell) => void): TerminalTab {
  const id = nextTabId++;
  const container = document.getElementById('terminal-container');
  const tabsContainer = document.getElementById('terminal-tabs');
  
  if (!container || !tabsContainer) {
    throw new Error('Terminal containers not found');
  }
  
  // Create terminal pane
  const element = document.createElement('div');
  element.className = 'terminal-pane';
  element.dataset.tab = String(id);
  container.appendChild(element);
  
  // Create terminal
  const terminal = new Terminal({
    cols: 80,
    rows: 24,
    theme: {
      background: '#0d0d12',
      foreground: '#e0e0e5',
      cursor: '#6366f1',
      cursorAccent: '#0d0d12',
    },
    fontFamily: 'Consolas, Monaco, "Courier New", monospace',
    fontSize: 14,
    cursorBlink: true,
    convertEol: true,
  });
  
  const fitAddon = new FitAddon();
  const webLinksAddon = new WebLinksAddon();
  
  terminal.loadAddon(fitAddon);
  terminal.loadAddon(webLinksAddon);
  terminal.open(element);
  
  // Create shell
  const shell = new SubstrateOSShell(
    { 
      persistKey: `substrateos-tab-${id}`,
      onOutput: (text) => terminal.write(text)
    },
    createDeviceCallbacks()
  );
  
  // Create tab element
  const addBtn = tabsContainer.querySelector('.terminal-tab-add');
  const tabEl = document.createElement('div');
  tabEl.className = 'terminal-tab';
  tabEl.dataset.tab = String(id);
  tabEl.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
      <polyline points="4 17 10 11 4 5"/>
      <line x1="12" y1="19" x2="20" y2="19"/>
    </svg>
    <span>Terminal ${id + 1}</span>
    <button class="tab-close" data-tab="${id}" title="Close tab">×</button>
  `;
  tabsContainer.insertBefore(tabEl, addBtn);
  
  // Tab click handler
  tabEl.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).classList.contains('tab-close')) return;
    switchToTab(id);
  });
  
  // Close button handler
  const closeBtn = tabEl.querySelector('.tab-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeTab(id);
    });
  }
  
  const tab: TerminalTab = {
    id,
    terminal,
    fitAddon,
    shell,
    element,
    inputBuffer: ''
  };
  
  terminals.push(tab);
  
  // Setup input handling
  setupTerminalInput(tab);
  
  // Show MOTD if provided
  if (showMotdFn) {
    showMotdFn(terminal, shell);
  }
  
  // Switch to new tab
  switchToTab(id);
  
  // Fit after a short delay
  setTimeout(() => fitAddon.fit(), 50);
  
  return tab;
}

// Switch to a terminal tab
function switchToTab(id: number) {
  const tab = terminals.find(t => t.id === id);
  if (!tab) return;
  
  // Update tab styles
  document.querySelectorAll('.terminal-tab').forEach(el => {
    el.classList.toggle('active', (el as HTMLElement).dataset.tab === String(id));
  });
  
  // Update pane visibility
  document.querySelectorAll('.terminal-pane').forEach(el => {
    el.classList.toggle('active', (el as HTMLElement).dataset.tab === String(id));
  });
  
  activeTabId = id;
  tab.terminal.focus();
  tab.fitAddon.fit();
}

// Close a terminal tab
function closeTab(id: number) {
  const idx = terminals.findIndex(t => t.id === id);
  if (idx === -1) return;
  
  // Don't close last tab
  if (terminals.length === 1) return;
  
  const tab = terminals[idx];
  
  // Remove from DOM
  tab.element.remove();
  document.querySelector(`.terminal-tab[data-tab="${id}"]`)?.remove();
  
  // Dispose terminal
  tab.terminal.dispose();
  
  // Remove from array
  terminals.splice(idx, 1);
  
  // Switch to another tab if this was active
  if (activeTabId === id) {
    const newTab = terminals[Math.max(0, idx - 1)];
    if (newTab) switchToTab(newTab.id);
  }
}

// Setup terminal input handling
function setupTerminalInput(tab: TerminalTab) {
  const { terminal, shell } = tab;
  
  const showPrompt = () => {
    terminal.write(shell.getPrompt());
  };
  
  const executeCommand = async (cmd: string) => {
    await shell.execute(cmd);
    showPrompt();
  };
  
  terminal.onData((data) => {
    const code = data.charCodeAt(0);
    
    if (code === 13) { // Enter
      terminal.writeln('');
      const cmd = tab.inputBuffer.trim();
      tab.inputBuffer = '';
      if (cmd) {
        executeCommand(cmd);
      } else {
        showPrompt();
      }
    } else if (code === 127 || code === 8) { // Backspace
      if (tab.inputBuffer.length > 0) {
        tab.inputBuffer = tab.inputBuffer.slice(0, -1);
        terminal.write('\b \b');
      }
    } else if (code === 3) { // Ctrl+C
      terminal.writeln('^C');
      tab.inputBuffer = '';
      showPrompt();
    } else if (code === 12) { // Ctrl+L (clear)
      terminal.clear();
      showPrompt();
    } else if (code >= 32) { // Printable
      tab.inputBuffer += data;
      terminal.write(data);
    }
  });
  
  // Handle paste
  terminal.onKey(({ domEvent }) => {
    if (domEvent.ctrlKey && domEvent.key === 'v') {
      navigator.clipboard.readText().then(text => {
        const clean = text.replace(/[\r\n]/g, '');
        tab.inputBuffer += clean;
        terminal.write(clean);
      }).catch(() => {});
    }
  });
}

// Get active terminal
function getActiveTerminal(): TerminalTab | undefined {
  return terminals.find(t => t.id === activeTabId);
}

// MOTD display function
function showMotd(term: Terminal, shell: SubstrateOSShell) {
  term.writeln('');
  term.writeln('\x1b[1;36m   ____        _         _             _        ___  ____  \x1b[0m');
  term.writeln('\x1b[1;36m  / ___| _   _| |__  ___| |_ _ __ __ _| |_ ___ / _ \\/ ___| \x1b[0m');
  term.writeln('\x1b[1;36m  \\___ \\| | | | \'_ \\/ __| __| \'__/ _` | __/ _ \\ | | \\___ \\ \x1b[0m');
  term.writeln('\x1b[1;36m   ___) | |_| | |_) \\__ \\ |_| | | (_| | ||  __/ |_| |___) |\x1b[0m');
  term.writeln('\x1b[1;36m  |____/ \\__,_|_.__/|___/\\__|_|  \\__,_|\\__\\___|\\___/|____/ \x1b[0m');
  term.writeln('');
  term.writeln('\x1b[1;35m         S  U  B  S  T  R  A  T  E     O  S\x1b[0m');
  term.writeln('\x1b[90m              by Andrew "Dru" Edwards\x1b[0m');
  term.writeln('');
  term.writeln('\x1b[1;36m  ╔═══════════════════════════════════════════════════════╗\x1b[0m');
  term.writeln('\x1b[1;36m  ║       Welcome to SubstrateOS - Browser Linux          ║\x1b[0m');
  term.writeln('\x1b[1;36m  ║      WebAssembly-powered Linux environment            ║\x1b[0m');
  term.writeln('\x1b[1;36m  ╚═══════════════════════════════════════════════════════╝\x1b[0m');
  term.writeln('');
  term.writeln('  \x1b[90mType \x1b[1;33mhelp\x1b[0m\x1b[90m for available commands, \x1b[1;33mneofetch\x1b[0m\x1b[90m for system info\x1b[0m');
  term.writeln('');
  term.write(shell.getPrompt());
}

async function main() {
  try {
    // Setup UI
    setupTabs();
    updateStatus('Initializing', 'loading');
    updateLoadingStatus('Initializing runtime...');

  // Update device list
  updateDeviceList([
    { name: '/dev/http', icon: '🌐', desc: 'HTTP client for web requests' },
    { name: '/dev/hostlog', icon: '📋', desc: 'Host logging bridge' },
    { name: '/dev/store0', icon: '💾', desc: 'Persistent key-value storage' },
    { name: '/dev/ai0', icon: '🤖', desc: 'AI assistant bridge' }
  ]);

  // Setup first tab click handler on existing tab
  const firstTab = document.querySelector('.terminal-tab[data-tab="0"]');
  if (firstTab) {
    firstTab.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).classList.contains('tab-close')) return;
      switchToTab(0);
    });
    
    const closeBtn = firstTab.querySelector('.tab-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeTab(0);
      });
    }
  }

  // Create first terminal in existing container
  const terminalContainer = document.getElementById('terminal');
  if (!terminalContainer) {
    throw new Error('Terminal container not found');
  }
  
  const terminal = new Terminal({
    cols: 80,
    rows: 24,
    theme: {
      background: '#0d0d12',
      foreground: '#e0e0e5',
      cursor: '#6366f1',
      cursorAccent: '#0d0d12',
    },
    fontFamily: 'Consolas, Monaco, "Courier New", monospace',
    fontSize: 14,
    cursorBlink: true,
    convertEol: true,
  });
  
  const fitAddon = new FitAddon();
  const webLinksAddon = new WebLinksAddon();
  
  terminal.loadAddon(fitAddon);
  terminal.loadAddon(webLinksAddon);
  terminal.open(terminalContainer);
  
  const shell = new SubstrateOSShell(
    { 
      persistKey: 'substrateos-demo',
      onOutput: (text) => terminal.write(text)
    },
    createDeviceCallbacks()
  );
  
  // Create first tab entry
  const firstTabEntry: TerminalTab = {
    id: 0,
    terminal,
    fitAddon,
    shell,
    element: terminalContainer,
    inputBuffer: ''
  };
  terminals.push(firstTabEntry);
  
  // Setup input handling for first terminal
  setupTerminalInput(firstTabEntry);
  
  // Handle window resize
  window.addEventListener('resize', () => {
    terminals.forEach(t => t.fitAddon.fit());
  });
  
  // Setup add terminal button
  const addBtn = document.getElementById('add-terminal');
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      createTerminalTab(showMotd);
    });
  }

  // Setup quick commands to use active terminal
  setupQuickCommands((cmd) => {
    const activeTab = getActiveTerminal();
    if (activeTab) {
      activeTab.terminal.write(cmd.slice(0, -1));
      activeTab.inputBuffer = cmd.slice(0, -1);
      activeTab.terminal.writeln('');
      activeTab.inputBuffer = '';
      activeTab.shell.execute(cmd.slice(0, -1)).then(() => {
        activeTab.terminal.write(activeTab.shell.getPrompt());
      });
    }
  });

  // Setup header buttons
  setupHeaderButtons(() => {
    updateStatus('Restarting', 'loading');
    document.getElementById('loading')?.classList.remove('hidden');
    updateLoadingStatus('Restarting SubstrateOS...');
    window.location.reload();
  });

  // Boot complete - hide loading and show terminal
  updateStatus('Running', 'running');
  updateLoadingStatus('Ready!');
  setTimeout(() => {
    document.getElementById('loading')?.classList.add('hidden');
  }, 500);

  // Show welcome message
  showMotd(terminal, shell);

  // Focus terminal and fit
  terminal.focus();
  fitAddon.fit();

  // Add initial boot log
  addLog({ timestamp: Date.now(), level: 'info', category: 'system', message: 'SubstrateOS shell initialized' });
  addLog({ timestamp: Date.now(), level: 'info', category: 'kernel', message: 'Virtual filesystem mounted' });
  addLog({ timestamp: Date.now(), level: 'info', category: 'device', message: 'Device bridges initialized' });
  } catch (error) {
    console.error('Failed to initialize SubstrateOS:', error);
    updateStatus('Error', 'error');
    updateLoadingStatus(`Error: ${error instanceof Error ? error.message : String(error)}`);
    // Don't hide loading screen on error so user can see what went wrong
  }
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}
