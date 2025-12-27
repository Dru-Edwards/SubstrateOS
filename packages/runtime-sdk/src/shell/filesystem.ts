/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║               EDWARDS TECH INNOVATION                    ║
 * ╚══════════════════════════════════════════════════════════╝
 *  SubstrateOS Virtual Filesystem
 */

import { SubstrateOSPersistence, PersistedFile } from '../persistence';

export interface FileNode {
  name: string;
  type: 'file' | 'directory' | 'symlink';
  permissions: string;
  owner: string;
  group: string;
  size: number;
  modified: Date;
  content?: string;
  children?: Map<string, FileNode>;
  target?: string; // For symlinks
}

export interface FileSystemOptions {
  persistKey?: string;
  enablePersistence?: boolean;
}

/**
 * Virtual Filesystem for SubstrateOS
 */
export class VirtualFileSystem {
  private root: FileNode;
  private cwd: string = '/home/user';
  private user: string = 'user';
  private hostname: string = 'substrateos';
  private persistKey?: string;
  private persistence: SubstrateOSPersistence | null = null;
  private persistenceReady: Promise<void> | null = null;

  constructor(options: FileSystemOptions = {}) {
    this.persistKey = options.persistKey;
    this.root = this.createDefaultFileSystem();
    
    // Initialize IndexedDB persistence if enabled
    if (options.enablePersistence !== false && typeof indexedDB !== 'undefined') {
      this.persistence = new SubstrateOSPersistence(options.persistKey || 'default');
      this.persistenceReady = this.initPersistence();
    } else {
      this.loadPersisted(); // Fallback to localStorage
    }
  }

  /**
   * Initialize IndexedDB persistence and restore files
   */
  private async initPersistence(): Promise<void> {
    if (!this.persistence) return;
    
    try {
      await this.persistence.init();
      await this.restorePersistedFiles();
    } catch (e) {
      console.warn('Failed to initialize persistence:', e);
    }
  }

  /**
   * Restore persisted files from IndexedDB
   */
  private async restorePersistedFiles(): Promise<void> {
    if (!this.persistence) return;

    try {
      const files = await this.persistence.getAllFiles();
      
      for (const file of files) {
        // Only restore files in user-writable areas
        if (file.path.startsWith('/home/user') || file.path.startsWith('/tmp')) {
          this.restoreFileNode(file);
        }
      }
    } catch (e) {
      console.warn('Failed to restore persisted files:', e);
    }
  }

  /**
   * Restore a single file node from persisted data
   */
  private restoreFileNode(file: PersistedFile): void {
    const parts = file.path.split('/').filter(p => p);
    let current = this.root;

    // Create parent directories if needed
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!current.children) {
        current.children = new Map();
      }
      
      if (!current.children.has(part)) {
        current.children.set(part, {
          name: part,
          type: 'directory',
          permissions: 'drwxr-xr-x',
          owner: 'user',
          group: 'user',
          size: 4096,
          modified: new Date(),
          children: new Map(),
        });
      }
      current = current.children.get(part)!;
    }

    // Add the file/directory
    const name = parts[parts.length - 1];
    if (!current.children) {
      current.children = new Map();
    }

    if (file.type === 'directory') {
      if (!current.children.has(name)) {
        current.children.set(name, {
          name,
          type: 'directory',
          permissions: file.permissions,
          owner: file.owner,
          group: file.owner,
          size: 4096,
          modified: new Date(file.modified),
          children: new Map(),
        });
      }
    } else {
      current.children.set(name, {
        name,
        type: 'file',
        permissions: file.permissions,
        owner: file.owner,
        group: file.owner,
        size: file.size,
        modified: new Date(file.modified),
        content: file.content,
      });
    }
  }

  /**
   * Persist a file to IndexedDB
   */
  private async persistFile(path: string, node: FileNode): Promise<void> {
    if (!this.persistence) return;
    
    // Only persist user-writable files
    if (!path.startsWith('/home/user') && !path.startsWith('/tmp')) {
      return;
    }

    try {
      await this.persistenceReady;
      await this.persistence.saveFile({
        path,
        content: node.content || '',
        type: node.type === 'directory' ? 'directory' : 'file',
        permissions: node.permissions,
        owner: node.owner,
        modified: node.modified.getTime(),
        size: node.size,
      });
    } catch (e) {
      console.warn('Failed to persist file:', e);
    }
  }

  /**
   * Delete a file from persistence
   */
  private async unpersistFile(path: string): Promise<void> {
    if (!this.persistence) return;
    
    try {
      await this.persistenceReady;
      await this.persistence.deleteFile(path);
    } catch (e) {
      console.warn('Failed to unpersist file:', e);
    }
  }

  private createDefaultFileSystem(): FileNode {
    const now = new Date();
    
    const createDir = (name: string, children: Map<string, FileNode> = new Map()): FileNode => ({
      name,
      type: 'directory',
      permissions: 'drwxr-xr-x',
      owner: 'root',
      group: 'root',
      size: 4096,
      modified: now,
      children
    });

    const createFile = (name: string, content: string, permissions = '-rw-r--r--', owner = 'root'): FileNode => ({
      name,
      type: 'file',
      permissions,
      owner,
      group: owner,
      size: content.length,
      modified: now,
      content
    });

    const createSymlink = (name: string, target: string): FileNode => ({
      name,
      type: 'symlink',
      permissions: 'lrwxrwxrwx',
      owner: 'root',
      group: 'root',
      size: target.length,
      modified: now,
      target
    });

    // Build filesystem structure
    const root = createDir('');
    
    // /bin - Essential command binaries
    const bin = createDir('bin');
    bin.children!.set('sh', createFile('sh', '#!/bin/sh\n# SubstrateOS Shell', '-rwxr-xr-x'));
    bin.children!.set('bash', createSymlink('bash', '/bin/sh'));
    bin.children!.set('ls', createFile('ls', '#!/bin/sh\n# List directory', '-rwxr-xr-x'));
    bin.children!.set('cat', createFile('cat', '#!/bin/sh\n# Concatenate files', '-rwxr-xr-x'));
    bin.children!.set('echo', createFile('echo', '#!/bin/sh\n# Echo text', '-rwxr-xr-x'));
    bin.children!.set('pwd', createFile('pwd', '#!/bin/sh\n# Print working directory', '-rwxr-xr-x'));
    bin.children!.set('cd', createFile('cd', '#!/bin/sh\n# Change directory', '-rwxr-xr-x'));
    bin.children!.set('mkdir', createFile('mkdir', '#!/bin/sh\n# Make directory', '-rwxr-xr-x'));
    bin.children!.set('rm', createFile('rm', '#!/bin/sh\n# Remove files', '-rwxr-xr-x'));
    bin.children!.set('cp', createFile('cp', '#!/bin/sh\n# Copy files', '-rwxr-xr-x'));
    bin.children!.set('mv', createFile('mv', '#!/bin/sh\n# Move files', '-rwxr-xr-x'));
    bin.children!.set('touch', createFile('touch', '#!/bin/sh\n# Touch file', '-rwxr-xr-x'));
    bin.children!.set('chmod', createFile('chmod', '#!/bin/sh\n# Change mode', '-rwxr-xr-x'));
    bin.children!.set('chown', createFile('chown', '#!/bin/sh\n# Change owner', '-rwxr-xr-x'));
    bin.children!.set('grep', createFile('grep', '#!/bin/sh\n# Search text', '-rwxr-xr-x'));
    bin.children!.set('head', createFile('head', '#!/bin/sh\n# Show first lines', '-rwxr-xr-x'));
    bin.children!.set('tail', createFile('tail', '#!/bin/sh\n# Show last lines', '-rwxr-xr-x'));
    bin.children!.set('wc', createFile('wc', '#!/bin/sh\n# Word count', '-rwxr-xr-x'));
    bin.children!.set('sort', createFile('sort', '#!/bin/sh\n# Sort lines', '-rwxr-xr-x'));
    bin.children!.set('uniq', createFile('uniq', '#!/bin/sh\n# Unique lines', '-rwxr-xr-x'));
    bin.children!.set('date', createFile('date', '#!/bin/sh\n# Show date', '-rwxr-xr-x'));
    bin.children!.set('whoami', createFile('whoami', '#!/bin/sh\n# Current user', '-rwxr-xr-x'));
    bin.children!.set('hostname', createFile('hostname', '#!/bin/sh\n# System hostname', '-rwxr-xr-x'));
    bin.children!.set('uname', createFile('uname', '#!/bin/sh\n# System info', '-rwxr-xr-x'));
    bin.children!.set('env', createFile('env', '#!/bin/sh\n# Environment', '-rwxr-xr-x'));
    bin.children!.set('export', createFile('export', '#!/bin/sh\n# Export vars', '-rwxr-xr-x'));
    bin.children!.set('clear', createFile('clear', '#!/bin/sh\n# Clear screen', '-rwxr-xr-x'));
    bin.children!.set('true', createFile('true', '#!/bin/sh\nexit 0', '-rwxr-xr-x'));
    bin.children!.set('false', createFile('false', '#!/bin/sh\nexit 1', '-rwxr-xr-x'));
    bin.children!.set('sleep', createFile('sleep', '#!/bin/sh\n# Sleep', '-rwxr-xr-x'));
    bin.children!.set('kill', createFile('kill', '#!/bin/sh\n# Kill process', '-rwxr-xr-x'));
    bin.children!.set('ps', createFile('ps', '#!/bin/sh\n# Process status', '-rwxr-xr-x'));
    root.children!.set('bin', bin);

    // /sbin - System binaries
    const sbin = createDir('sbin');
    sbin.children!.set('init', createFile('init', '#!/bin/sh\n# Init system', '-rwxr-x---'));
    sbin.children!.set('shutdown', createFile('shutdown', '#!/bin/sh\n# Shutdown', '-rwxr-x---'));
    sbin.children!.set('reboot', createFile('reboot', '#!/bin/sh\n# Reboot', '-rwxr-x---'));
    sbin.children!.set('ifconfig', createFile('ifconfig', '#!/bin/sh\n# Network config', '-rwxr-x---'));
    root.children!.set('sbin', sbin);

    // /usr - User utilities
    const usr = createDir('usr');
    const usrBin = createDir('bin');
    usrBin.children!.set('sudo', createFile('sudo', '#!/bin/sh\n# Superuser do', '-rwsr-xr-x'));
    usrBin.children!.set('su', createFile('su', '#!/bin/sh\n# Switch user', '-rwsr-xr-x'));
    usrBin.children!.set('passwd', createFile('passwd', '#!/bin/sh\n# Change password', '-rwsr-xr-x'));
    usrBin.children!.set('id', createFile('id', '#!/bin/sh\n# User identity', '-rwxr-xr-x'));
    usrBin.children!.set('groups', createFile('groups', '#!/bin/sh\n# User groups', '-rwxr-xr-x'));
    usrBin.children!.set('which', createFile('which', '#!/bin/sh\n# Locate command', '-rwxr-xr-x'));
    usrBin.children!.set('whereis', createFile('whereis', '#!/bin/sh\n# Locate binary', '-rwxr-xr-x'));
    usrBin.children!.set('man', createFile('man', '#!/bin/sh\n# Manual pages', '-rwxr-xr-x'));
    usrBin.children!.set('less', createFile('less', '#!/bin/sh\n# Page viewer', '-rwxr-xr-x'));
    usrBin.children!.set('more', createFile('more', '#!/bin/sh\n# Page viewer', '-rwxr-xr-x'));
    usrBin.children!.set('nano', createFile('nano', '#!/bin/sh\n# Text editor', '-rwxr-xr-x'));
    usrBin.children!.set('vi', createFile('vi', '#!/bin/sh\n# Text editor', '-rwxr-xr-x'));
    usrBin.children!.set('vim', createSymlink('vim', '/usr/bin/vi'));
    usrBin.children!.set('wget', createFile('wget', '#!/bin/sh\n# Web get', '-rwxr-xr-x'));
    usrBin.children!.set('curl', createFile('curl', '#!/bin/sh\n# Transfer URL', '-rwxr-xr-x'));
    usrBin.children!.set('tar', createFile('tar', '#!/bin/sh\n# Archive', '-rwxr-xr-x'));
    usrBin.children!.set('gzip', createFile('gzip', '#!/bin/sh\n# Compress', '-rwxr-xr-x'));
    usrBin.children!.set('gunzip', createFile('gunzip', '#!/bin/sh\n# Decompress', '-rwxr-xr-x'));
    usrBin.children!.set('zip', createFile('zip', '#!/bin/sh\n# Zip files', '-rwxr-xr-x'));
    usrBin.children!.set('unzip', createFile('unzip', '#!/bin/sh\n# Unzip files', '-rwxr-xr-x'));
    usrBin.children!.set('find', createFile('find', '#!/bin/sh\n# Find files', '-rwxr-xr-x'));
    usrBin.children!.set('xargs', createFile('xargs', '#!/bin/sh\n# Build args', '-rwxr-xr-x'));
    usrBin.children!.set('awk', createFile('awk', '#!/bin/sh\n# Text processor', '-rwxr-xr-x'));
    usrBin.children!.set('sed', createFile('sed', '#!/bin/sh\n# Stream editor', '-rwxr-xr-x'));
    usrBin.children!.set('diff', createFile('diff', '#!/bin/sh\n# Compare files', '-rwxr-xr-x'));
    usrBin.children!.set('patch', createFile('patch', '#!/bin/sh\n# Apply patches', '-rwxr-xr-x'));
    usrBin.children!.set('tree', createFile('tree', '#!/bin/sh\n# Directory tree', '-rwxr-xr-x'));
    usrBin.children!.set('file', createFile('file', '#!/bin/sh\n# File type', '-rwxr-xr-x'));
    usrBin.children!.set('stat', createFile('stat', '#!/bin/sh\n# File status', '-rwxr-xr-x'));
    usrBin.children!.set('du', createFile('du', '#!/bin/sh\n# Disk usage', '-rwxr-xr-x'));
    usrBin.children!.set('df', createFile('df', '#!/bin/sh\n# Disk free', '-rwxr-xr-x'));
    usrBin.children!.set('free', createFile('free', '#!/bin/sh\n# Memory info', '-rwxr-xr-x'));
    usrBin.children!.set('top', createFile('top', '#!/bin/sh\n# Process monitor', '-rwxr-xr-x'));
    usrBin.children!.set('htop', createFile('htop', '#!/bin/sh\n# Interactive process viewer', '-rwxr-xr-x'));
    usrBin.children!.set('uptime', createFile('uptime', '#!/bin/sh\n# System uptime', '-rwxr-xr-x'));
    usrBin.children!.set('w', createFile('w', '#!/bin/sh\n# Who is logged in', '-rwxr-xr-x'));
    usrBin.children!.set('last', createFile('last', '#!/bin/sh\n# Login history', '-rwxr-xr-x'));
    usrBin.children!.set('history', createFile('history', '#!/bin/sh\n# Command history', '-rwxr-xr-x'));
    usrBin.children!.set('alias', createFile('alias', '#!/bin/sh\n# Create alias', '-rwxr-xr-x'));
    usrBin.children!.set('ssh', createFile('ssh', '#!/bin/sh\n# Secure shell', '-rwxr-xr-x'));
    usrBin.children!.set('scp', createFile('scp', '#!/bin/sh\n# Secure copy', '-rwxr-xr-x'));
    usrBin.children!.set('ping', createFile('ping', '#!/bin/sh\n# Network ping', '-rwxr-xr-x'));
    usrBin.children!.set('traceroute', createFile('traceroute', '#!/bin/sh\n# Trace route', '-rwxr-xr-x'));
    usrBin.children!.set('netstat', createFile('netstat', '#!/bin/sh\n# Network stats', '-rwxr-xr-x'));
    usrBin.children!.set('nslookup', createFile('nslookup', '#!/bin/sh\n# DNS lookup', '-rwxr-xr-x'));
    usrBin.children!.set('dig', createFile('dig', '#!/bin/sh\n# DNS query', '-rwxr-xr-x'));
    usrBin.children!.set('git', createFile('git', '#!/bin/sh\n# Version control', '-rwxr-xr-x'));
    usrBin.children!.set('make', createFile('make', '#!/bin/sh\n# Build tool', '-rwxr-xr-x'));
    usrBin.children!.set('gcc', createFile('gcc', '#!/bin/sh\n# C compiler', '-rwxr-xr-x'));
    usrBin.children!.set('python', createFile('python', '#!/bin/sh\n# Python interpreter', '-rwxr-xr-x'));
    usrBin.children!.set('python3', createSymlink('python3', '/usr/bin/python'));
    usrBin.children!.set('node', createFile('node', '#!/bin/sh\n# Node.js', '-rwxr-xr-x'));
    usrBin.children!.set('npm', createFile('npm', '#!/bin/sh\n# Node package manager', '-rwxr-xr-x'));
    usr.children!.set('bin', usrBin);
    
    const usrLib = createDir('lib');
    usr.children!.set('lib', usrLib);
    
    const usrShare = createDir('share');
    const usrShareMan = createDir('man');
    usrShare.children!.set('man', usrShareMan);
    usr.children!.set('share', usrShare);
    
    root.children!.set('usr', usr);

    // /etc - Configuration files
    const etc = createDir('etc');
    etc.children!.set('passwd', createFile('passwd', 
      'root:x:0:0:root:/root:/bin/sh\n' +
      'user:x:1000:1000:SubstrateOS User:/home/user:/bin/sh\n' +
      'nobody:x:65534:65534:nobody:/nonexistent:/usr/sbin/nologin\n'
    ));
    etc.children!.set('group', createFile('group',
      'root:x:0:\n' +
      'sudo:x:27:user\n' +
      'user:x:1000:\n'
    ));
    etc.children!.set('shadow', createFile('shadow',
      'root:!:19000:0:99999:7:::\n' +
      'user:!:19000:0:99999:7:::\n',
      '-rw-r-----', 'root'
    ));
    etc.children!.set('hostname', createFile('hostname', 'substrateos\n'));
    etc.children!.set('hosts', createFile('hosts',
      '127.0.0.1\tlocalhost\n' +
      '::1\t\tlocalhost\n' +
      '127.0.1.1\tsubstrateos\n'
    ));
    etc.children!.set('resolv.conf', createFile('resolv.conf',
      'nameserver 8.8.8.8\n' +
      'nameserver 8.8.4.4\n'
    ));
    etc.children!.set('fstab', createFile('fstab',
      '# <file system>  <mount point>  <type>  <options>  <dump>  <pass>\n' +
      'none             /proc          proc    defaults   0       0\n' +
      'none             /sys           sysfs   defaults   0       0\n' +
      'none             /dev           devtmpfs defaults  0       0\n'
    ));
    etc.children!.set('os-release', createFile('os-release',
      'NAME="SubstrateOS"\n' +
      'VERSION="1.0.0"\n' +
      'ID=substrateos\n' +
      'PRETTY_NAME="SubstrateOS 1.0.0 (Browser Edition)"\n' +
      'VERSION_ID="1.0.0"\n' +
      'HOME_URL="https://substrateos.dev"\n'
    ));
    etc.children!.set('motd', createFile('motd',
      '\n' +
      '  ╔═══════════════════════════════════════════════════════╗\n' +
      '  ║       Welcome to SubstrateOS - Browser Linux          ║\n' +
      '  ║      WebAssembly-powered Linux environment            ║\n' +
      '  ║              by Andrew "Dru" Edwards                  ║\n' +
      '  ╚═══════════════════════════════════════════════════════╝\n' +
      '\n' +
      '  Type "help" for available commands.\n' +
      '\n'
    ));
    etc.children!.set('profile', createFile('profile',
      '# System-wide profile\n' +
      'export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"\n' +
      'export HOME="/home/user"\n' +
      'export USER="user"\n' +
      'export SHELL="/bin/sh"\n' +
      'export TERM="xterm-256color"\n'
    ));
    etc.children!.set('sudoers', createFile('sudoers',
      '# sudoers file\n' +
      'root ALL=(ALL:ALL) ALL\n' +
      '%sudo ALL=(ALL:ALL) ALL\n' +
      'user ALL=(ALL) NOPASSWD: ALL\n',
      '-r--r-----', 'root'
    ));
    root.children!.set('etc', etc);

    // /home - User home directories
    const home = createDir('home');
    const userHome = createDir('user');
    userHome.owner = 'user';
    userHome.group = 'user';
    userHome.permissions = 'drwxr-xr-x';
    userHome.children!.set('.bashrc', createFile('.bashrc',
      '# ~/.bashrc\n' +
      'export PS1="\\u@\\h:\\w\\$ "\n' +
      'alias ll="ls -la"\n' +
      'alias la="ls -A"\n' +
      'alias l="ls -CF"\n',
      '-rw-r--r--', 'user'
    ));
    userHome.children!.set('.profile', createFile('.profile',
      '# ~/.profile\n' +
      'if [ -f "$HOME/.bashrc" ]; then\n' +
      '    . "$HOME/.bashrc"\n' +
      'fi\n',
      '-rw-r--r--', 'user'
    ));
    userHome.children!.set('welcome.txt', createFile('welcome.txt',
      'Welcome to SubstrateOS!\n\n' +
      'This is a WebAssembly-based Linux environment running in your browser.\n\n' +
      'Quick Start:\n' +
      '  - Type "help" for available commands\n' +
      '  - Use "ls" to list files\n' +
      '  - Use "cat" to view file contents\n' +
      '  - Use "sudo" for admin tasks\n\n' +
      'Happy hacking!\n',
      '-rw-r--r--', 'user'
    ));
    const userDocuments = createDir('Documents');
    userDocuments.owner = 'user';
    userDocuments.group = 'user';
    userHome.children!.set('Documents', userDocuments);
    
    const userDownloads = createDir('Downloads');
    userDownloads.owner = 'user';
    userDownloads.group = 'user';
    userHome.children!.set('Downloads', userDownloads);
    
    home.children!.set('user', userHome);
    root.children!.set('home', home);

    // /root - Root home
    const rootHome = createDir('root');
    rootHome.permissions = 'drwx------';
    root.children!.set('root', rootHome);

    // /var - Variable data
    const varDir = createDir('var');
    varDir.children!.set('log', createDir('log'));
    varDir.children!.set('tmp', createDir('tmp'));
    varDir.children!.set('cache', createDir('cache'));
    root.children!.set('var', varDir);

    // /tmp - Temporary files
    const tmp = createDir('tmp');
    tmp.permissions = 'drwxrwxrwt';
    root.children!.set('tmp', tmp);

    // /proc - Process info (virtual)
    const proc = createDir('proc');
    proc.children!.set('version', createFile('version', 
      'SubstrateOS version 1.0.0 (wasm32) #1 SMP PREEMPT Browser Edition\n'
    ));
    proc.children!.set('uptime', createFile('uptime', '0.00 0.00\n'));
    proc.children!.set('meminfo', createFile('meminfo',
      'MemTotal:        256000 kB\n' +
      'MemFree:         200000 kB\n' +
      'MemAvailable:    220000 kB\n' +
      'Buffers:          10000 kB\n' +
      'Cached:           30000 kB\n'
    ));
    proc.children!.set('cpuinfo', createFile('cpuinfo',
      'processor\t: 0\n' +
      'vendor_id\t: SubstrateOS\n' +
      'model name\t: WebAssembly Virtual CPU\n' +
      'cpu MHz\t\t: 1000.000\n' +
      'cache size\t: 256 KB\n'
    ));
    root.children!.set('proc', proc);

    // /sys - System info (virtual)
    root.children!.set('sys', createDir('sys'));

    // /dev - Device files
    const dev = createDir('dev');
    dev.children!.set('null', createFile('null', '', 'crw-rw-rw-'));
    dev.children!.set('zero', createFile('zero', '', 'crw-rw-rw-'));
    dev.children!.set('random', createFile('random', '', 'crw-rw-rw-'));
    dev.children!.set('urandom', createFile('urandom', '', 'crw-rw-rw-'));
    dev.children!.set('tty', createFile('tty', '', 'crw-rw-rw-'));
    dev.children!.set('console', createFile('console', '', 'crw-------'));
    dev.children!.set('http', createFile('http', '', 'crw-rw-rw-'));
    dev.children!.set('hostlog', createFile('hostlog', '', 'crw-rw-rw-'));
    dev.children!.set('store0', createFile('store0', '', 'crw-rw-rw-'));
    dev.children!.set('ai0', createFile('ai0', '', 'crw-rw-rw-'));
    root.children!.set('dev', dev);

    // /mnt and /media - Mount points
    root.children!.set('mnt', createDir('mnt'));
    root.children!.set('media', createDir('media'));

    // /opt - Optional software
    root.children!.set('opt', createDir('opt'));

    // /lib - Libraries
    root.children!.set('lib', createDir('lib'));

    return root;
  }

  private loadPersisted(): void {
    if (!this.persistKey || typeof localStorage === 'undefined') return;
    
    try {
      const saved = localStorage.getItem(`substrateos_fs_${this.persistKey}`);
      if (saved) {
        // Only restore user-created files in /home/user
        const data = JSON.parse(saved);
        // TODO: Merge persisted data
      }
    } catch (e) {
      console.warn('Failed to load persisted filesystem:', e);
    }
  }

  private persist(): void {
    if (!this.persistKey || typeof localStorage === 'undefined') return;
    
    try {
      // Only persist user-created files
      // TODO: Implement selective persistence
    } catch (e) {
      console.warn('Failed to persist filesystem:', e);
    }
  }

  // Resolve a path to absolute
  resolvePath(path: string): string {
    if (path.startsWith('/')) {
      return this.normalizePath(path);
    }
    return this.normalizePath(`${this.cwd}/${path}`);
  }

  // Normalize path (handle . and ..)
  private normalizePath(path: string): string {
    const parts = path.split('/').filter(p => p && p !== '.');
    const result: string[] = [];
    
    for (const part of parts) {
      if (part === '..') {
        result.pop();
      } else {
        result.push(part);
      }
    }
    
    return '/' + result.join('/');
  }

  // Get a node at path
  getNode(path: string): FileNode | null {
    const absPath = this.resolvePath(path);
    if (absPath === '/') return this.root;
    
    const parts = absPath.split('/').filter(p => p);
    let current: FileNode | undefined = this.root;
    
    for (const part of parts) {
      if (!current || current.type !== 'directory' || !current.children) {
        return null;
      }
      current = current.children.get(part);
    }
    
    return current || null;
  }

  // Get parent directory node
  private getParentNode(path: string): { parent: FileNode | null; name: string } {
    const absPath = this.resolvePath(path);
    const parts = absPath.split('/').filter(p => p);
    const name = parts.pop() || '';
    const parentPath = '/' + parts.join('/');
    
    return {
      parent: this.getNode(parentPath),
      name
    };
  }

  // List directory contents
  listDir(path: string = '.'): FileNode[] | null {
    const node = this.getNode(path);
    if (!node || node.type !== 'directory') return null;
    return Array.from(node.children?.values() || []);
  }

  // Read file contents
  readFile(path: string): string | null {
    const node = this.getNode(path);
    if (!node || node.type !== 'file') return null;
    return node.content || '';
  }

  // Write file contents
  writeFile(path: string, content: string): boolean {
    const { parent, name } = this.getParentNode(path);
    if (!parent || parent.type !== 'directory') return false;
    
    const existing = parent.children?.get(name);
    if (existing && existing.type === 'directory') return false;
    
    const file: FileNode = {
      name,
      type: 'file',
      permissions: '-rw-r--r--',
      owner: this.user,
      group: this.user,
      size: content.length,
      modified: new Date(),
      content
    };
    
    parent.children!.set(name, file);
    
    // Persist to IndexedDB
    const absPath = this.resolvePath(path);
    this.persistFile(absPath, file);
    
    this.persist();
    return true;
  }

  // Create directory
  mkdir(path: string, recursive = false): boolean {
    if (recursive) {
      const absPath = this.resolvePath(path);
      const parts = absPath.split('/').filter(p => p);
      let current = this.root;
      
      for (const part of parts) {
        if (!current.children) return false;
        
        let next = current.children.get(part);
        if (!next) {
          next = {
            name: part,
            type: 'directory',
            permissions: 'drwxr-xr-x',
            owner: this.user,
            group: this.user,
            size: 4096,
            modified: new Date(),
            children: new Map()
          };
          current.children.set(part, next);
        } else if (next.type !== 'directory') {
          return false;
        }
        current = next;
      }
      
      this.persist();
      return true;
    }
    
    const { parent, name } = this.getParentNode(path);
    if (!parent || parent.type !== 'directory') return false;
    if (parent.children?.has(name)) return false;
    
    parent.children!.set(name, {
      name,
      type: 'directory',
      permissions: 'drwxr-xr-x',
      owner: this.user,
      group: this.user,
      size: 4096,
      modified: new Date(),
      children: new Map()
    });
    
    this.persist();
    return true;
  }

  // Remove file or directory
  rm(path: string, recursive = false): boolean {
    const { parent, name } = this.getParentNode(path);
    if (!parent || parent.type !== 'directory') return false;
    
    const node = parent.children?.get(name);
    if (!node) return false;
    
    if (node.type === 'directory' && node.children?.size && !recursive) {
      return false; // Directory not empty
    }
    
    parent.children!.delete(name);
    
    // Unpersist from IndexedDB
    const absPath = this.resolvePath(path);
    this.unpersistFile(absPath);
    
    this.persist();
    return true;
  }

  // Copy file/directory
  cp(src: string, dest: string): boolean {
    const srcNode = this.getNode(src);
    if (!srcNode) return false;
    
    const { parent, name } = this.getParentNode(dest);
    if (!parent || parent.type !== 'directory') return false;
    
    // Clone the node
    const clone = this.cloneNode(srcNode, name);
    parent.children!.set(name, clone);
    this.persist();
    return true;
  }

  private cloneNode(node: FileNode, newName?: string): FileNode {
    const clone: FileNode = {
      ...node,
      name: newName || node.name,
      modified: new Date()
    };
    
    if (node.type === 'directory' && node.children) {
      clone.children = new Map();
      for (const [name, child] of node.children) {
        clone.children.set(name, this.cloneNode(child));
      }
    }
    
    return clone;
  }

  // Move/rename
  mv(src: string, dest: string): boolean {
    if (!this.cp(src, dest)) return false;
    return this.rm(src, true);
  }

  // Change directory
  cd(path: string): boolean {
    const absPath = this.resolvePath(path);
    const node = this.getNode(absPath);
    
    if (!node || node.type !== 'directory') return false;
    
    this.cwd = absPath;
    return true;
  }

  // Get current working directory
  pwd(): string {
    return this.cwd;
  }

  // Get current user
  getUser(): string {
    return this.user;
  }

  // Get hostname
  getHostname(): string {
    return this.hostname;
  }

  // Check if path exists
  exists(path: string): boolean {
    return this.getNode(path) !== null;
  }

  // Check if path is a directory
  isDir(path: string): boolean {
    const node = this.getNode(path);
    return node?.type === 'directory';
  }

  // Check if path is a file
  isFile(path: string): boolean {
    const node = this.getNode(path);
    return node?.type === 'file';
  }

  // Touch a file (create if not exists, update timestamp if exists)
  touch(path: string): boolean {
    const node = this.getNode(path);
    if (node) {
      node.modified = new Date();
      this.persist();
      return true;
    }
    return this.writeFile(path, '');
  }
}
