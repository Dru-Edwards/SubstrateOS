/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║               EDWARDS TECH INNOVATION                    ║
 * ╚══════════════════════════════════════════════════════════╝
 *  SubstrateOS Shell Commands Implementation
 */

import { VirtualFileSystem, FileNode } from './filesystem';
import { SQLiteLiteExtension } from '../extensions/examples/sqlite-lite';

// Initialize extensions
const sqliteExtension = new SQLiteLiteExtension();
const sqliteCommands = sqliteExtension.getCommands();

export interface CommandContext {
  fs: VirtualFileSystem;
  env: Map<string, string>;
  write: (text: string) => void;
  writeln: (text: string) => void;
  writeError: (text: string) => void;
  isSudo: boolean;
  history: string[];
  aliases: Map<string, string>;
}

export interface CommandResult {
  exitCode: number;
  output?: string;
}

export type CommandHandler = (args: string[], ctx: CommandContext) => CommandResult | Promise<CommandResult>;

/**
 * Built-in shell commands
 */
export const commands: Record<string, CommandHandler> = {
  // Help
  help: (args, ctx) => {
    ctx.writeln('\x1b[1;36m╔══════════════════════════════════════════════════════════╗\x1b[0m');
    ctx.writeln('\x1b[1;36m║           SubstrateOS Shell - Command Reference          ║\x1b[0m');
    ctx.writeln('\x1b[1;36m╚══════════════════════════════════════════════════════════╝\x1b[0m');
    ctx.writeln('');
    ctx.writeln('\x1b[1;32m★ Get Started:\x1b[0m');
    ctx.writeln('  learn               Learn Linux in 10 minutes');
    ctx.writeln('  tutorial            Interactive guided lessons');
    ctx.writeln('  about               What is SubstrateOS?');
    ctx.writeln('');
    ctx.writeln('\x1b[1;33mFile System:\x1b[0m');
    ctx.writeln('  ls, ll, tree        List/view directory structure');
    ctx.writeln('  cd, pwd             Navigate directories');
    ctx.writeln('  cat, head, tail     View file contents');
    ctx.writeln('  less, more          File pager');
    ctx.writeln('  mkdir, touch, rm    Create/delete files');
    ctx.writeln('  cp, mv              Copy/move files');
    ctx.writeln('  find, grep          Search files and content');
    ctx.writeln('  stat, file          File information & type');
    ctx.writeln('');
    ctx.writeln('\x1b[1;33mText Processing:\x1b[0m');
    ctx.writeln('  grep <pattern>      Search file contents');
    ctx.writeln('  sort, uniq          Sort and dedupe lines');
    ctx.writeln('  cut -f1 -d","       Extract columns');
    ctx.writeln('  wc -l               Count lines/words');
    ctx.writeln('  sed, awk            Stream editing (basic)');
    ctx.writeln('  hexdump             View file in hex');
    ctx.writeln('');
    ctx.writeln('\x1b[1;33mDeveloper Tools:\x1b[0m');
    ctx.writeln('  sql <query>         Execute SQL (try: sql SELECT 1+1)');
    ctx.writeln('  sqlite              SQLite database manager');
    ctx.writeln('  json parse {...}    Parse & format JSON');
    ctx.writeln('  calc <expr>         Calculator (sqrt, pow, etc)');
    ctx.writeln('  uuid                Generate UUID');
    ctx.writeln('  base64, timestamp   Encoding & time tools');
    ctx.writeln('  md5sum, sha256sum   File hashing');
    ctx.writeln('');
    ctx.writeln('\x1b[1;33mPath Utilities:\x1b[0m');
    ctx.writeln('  basename, dirname   Path manipulation');
    ctx.writeln('  realpath            Resolve absolute path');
    ctx.writeln('  which               Locate a command');
    ctx.writeln('');
    ctx.writeln('\x1b[1;33mPackages & Runtimes:\x1b[0m');
    ctx.writeln('  apt list            Browse 120+ packages');
    ctx.writeln('  apt search <query>  Search packages');
    ctx.writeln('  apt install python  Install Python 3.12');
    ctx.writeln('  apt install nodejs  Install Node.js 20');
    ctx.writeln('  apt install git     Install Git');
    ctx.writeln('');
    ctx.writeln('\x1b[1;33mWorkspace:\x1b[0m');
    ctx.writeln('  backup              Export your workspace');
    ctx.writeln('  restore             Import a workspace');
    ctx.writeln('  storage             View storage status');
    ctx.writeln('');
    ctx.writeln('\x1b[1;33mFun:\x1b[0m');
    ctx.writeln('  cowsay <msg>        ASCII cow talks');
    ctx.writeln('  fortune             Random wisdom');
    ctx.writeln('  figlet <text>       ASCII art banner');
    ctx.writeln('  neofetch            System info display');
    ctx.writeln('');
    ctx.writeln('\x1b[1;33mSystem:\x1b[0m');
    ctx.writeln('  whoami, id, date    User & system info');
    ctx.writeln('  env, export         Environment variables');
    ctx.writeln('  printenv            Print specific env var');
    ctx.writeln('  history, alias      Shell history & aliases');
    ctx.writeln('  clear, exit         Terminal control');
    ctx.writeln('  seq, yes            Generate sequences');
    ctx.writeln('');
    ctx.writeln('\x1b[90mThis is SubstrateOS - a browser-based Linux playground.\x1b[0m');
    ctx.writeln('\x1b[90m100+ commands available. All data stored locally in browser.\x1b[0m');
    ctx.writeln('');
    return { exitCode: 0 };
  },

  // List directory
  ls: (args, ctx) => {
    let path = '.';
    let showAll = false;
    let longFormat = false;
    
    for (const arg of args) {
      if (arg === '-a' || arg === '--all') showAll = true;
      else if (arg === '-l') longFormat = true;
      else if (arg === '-la' || arg === '-al') { showAll = true; longFormat = true; }
      else if (!arg.startsWith('-')) path = arg;
    }
    
    const entries = ctx.fs.listDir(path);
    if (!entries) {
      ctx.writeError(`ls: cannot access '${path}': No such file or directory`);
      return { exitCode: 1 };
    }
    
    const filtered = showAll ? entries : entries.filter(e => !e.name.startsWith('.'));
    
    if (longFormat) {
      ctx.writeln(`total ${filtered.length}`);
      for (const entry of filtered) {
        const date = entry.modified.toLocaleDateString('en-US', { 
          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
        });
        const size = entry.size.toString().padStart(8);
        const name = entry.type === 'directory' 
          ? `\x1b[1;34m${entry.name}\x1b[0m`
          : entry.type === 'symlink'
            ? `\x1b[1;36m${entry.name}\x1b[0m -> ${entry.target}`
            : entry.permissions.includes('x')
              ? `\x1b[1;32m${entry.name}\x1b[0m`
              : entry.name;
        ctx.writeln(`${entry.permissions} ${entry.owner.padEnd(8)} ${entry.group.padEnd(8)} ${size} ${date} ${name}`);
      }
    } else {
      const names = filtered.map(e => {
        if (e.type === 'directory') return `\x1b[1;34m${e.name}\x1b[0m`;
        if (e.type === 'symlink') return `\x1b[1;36m${e.name}\x1b[0m`;
        if (e.permissions.includes('x')) return `\x1b[1;32m${e.name}\x1b[0m`;
        return e.name;
      });
      ctx.writeln(names.join('  '));
    }
    
    return { exitCode: 0 };
  },

  // ll alias for ls -la
  ll: (args, ctx) => {
    return commands.ls(['-la', ...args], ctx);
  },

  // Change directory
  cd: (args, ctx) => {
    const path = args[0] || ctx.env.get('HOME') || '/home/user';
    
    if (!ctx.fs.cd(path)) {
      ctx.writeError(`cd: ${path}: No such file or directory`);
      return { exitCode: 1 };
    }
    return { exitCode: 0 };
  },

  // Print working directory
  pwd: (args, ctx) => {
    ctx.writeln(ctx.fs.pwd());
    return { exitCode: 0 };
  },

  // Display file contents
  cat: (args, ctx) => {
    if (args.length === 0) {
      ctx.writeError('cat: missing operand');
      return { exitCode: 1 };
    }
    
    for (const file of args) {
      const content = ctx.fs.readFile(file);
      if (content === null) {
        ctx.writeError(`cat: ${file}: No such file or directory`);
        return { exitCode: 1 };
      }
      ctx.write(content);
      if (!content.endsWith('\n')) ctx.writeln('');
    }
    
    return { exitCode: 0 };
  },

  // Echo text
  echo: (args, ctx) => {
    let newline = true;
    let text = args.join(' ');
    
    if (args[0] === '-n') {
      newline = false;
      text = args.slice(1).join(' ');
    }
    
    // Expand environment variables
    text = text.replace(/\$(\w+)/g, (_, name) => ctx.env.get(name) || '');
    
    if (newline) {
      ctx.writeln(text);
    } else {
      ctx.write(text);
    }
    
    return { exitCode: 0 };
  },

  // Create directory
  mkdir: (args, ctx) => {
    let recursive = false;
    const paths: string[] = [];
    
    for (const arg of args) {
      if (arg === '-p' || arg === '--parents') recursive = true;
      else paths.push(arg);
    }
    
    if (paths.length === 0) {
      ctx.writeError('mkdir: missing operand');
      return { exitCode: 1 };
    }
    
    for (const path of paths) {
      if (!ctx.fs.mkdir(path, recursive)) {
        ctx.writeError(`mkdir: cannot create directory '${path}'`);
        return { exitCode: 1 };
      }
    }
    
    return { exitCode: 0 };
  },

  // Touch file
  touch: (args, ctx) => {
    if (args.length === 0) {
      ctx.writeError('touch: missing file operand');
      return { exitCode: 1 };
    }
    
    for (const file of args) {
      ctx.fs.touch(file);
    }
    
    return { exitCode: 0 };
  },

  // Remove file/directory
  rm: (args, ctx) => {
    let recursive = false;
    let force = false;
    const paths: string[] = [];
    
    for (const arg of args) {
      if (arg === '-r' || arg === '-R' || arg === '--recursive') recursive = true;
      else if (arg === '-f' || arg === '--force') force = true;
      else if (arg === '-rf' || arg === '-fr') { recursive = true; force = true; }
      else paths.push(arg);
    }
    
    if (paths.length === 0) {
      ctx.writeError('rm: missing operand');
      return { exitCode: 1 };
    }
    
    for (const path of paths) {
      if (!ctx.fs.rm(path, recursive)) {
        if (!force) {
          ctx.writeError(`rm: cannot remove '${path}'`);
          return { exitCode: 1 };
        }
      }
    }
    
    return { exitCode: 0 };
  },

  // Copy
  cp: (args, ctx) => {
    if (args.length < 2) {
      ctx.writeError('cp: missing operand');
      return { exitCode: 1 };
    }
    
    const dest = args[args.length - 1];
    const sources = args.slice(0, -1).filter(a => !a.startsWith('-'));
    
    for (const src of sources) {
      if (!ctx.fs.cp(src, dest)) {
        ctx.writeError(`cp: cannot copy '${src}' to '${dest}'`);
        return { exitCode: 1 };
      }
    }
    
    return { exitCode: 0 };
  },

  // Move/rename
  mv: (args, ctx) => {
    if (args.length < 2) {
      ctx.writeError('mv: missing operand');
      return { exitCode: 1 };
    }
    
    const src = args[0];
    const dest = args[1];
    
    if (!ctx.fs.mv(src, dest)) {
      ctx.writeError(`mv: cannot move '${src}' to '${dest}'`);
      return { exitCode: 1 };
    }
    
    return { exitCode: 0 };
  },

  // Who am I
  whoami: (args, ctx) => {
    ctx.writeln(ctx.isSudo ? 'root' : ctx.fs.getUser());
    return { exitCode: 0 };
  },

  // User ID
  id: (args, ctx) => {
    const user = ctx.isSudo ? 'root' : ctx.fs.getUser();
    if (user === 'root') {
      ctx.writeln('uid=0(root) gid=0(root) groups=0(root)');
    } else {
      ctx.writeln('uid=1000(user) gid=1000(user) groups=1000(user),27(sudo)');
    }
    return { exitCode: 0 };
  },

  // Hostname
  hostname: (args, ctx) => {
    ctx.writeln(ctx.fs.getHostname());
    return { exitCode: 0 };
  },

  // System information
  uname: (args, ctx) => {
    const all = args.includes('-a') || args.includes('--all');
    
    if (all) {
      ctx.writeln('SubstrateOS substrateos 1.0.0 #1 SMP PREEMPT wasm32 SubstrateOS');
    } else if (args.includes('-s')) {
      ctx.writeln('SubstrateOS');
    } else if (args.includes('-n')) {
      ctx.writeln('substrateos');
    } else if (args.includes('-r')) {
      ctx.writeln('1.0.0');
    } else if (args.includes('-m')) {
      ctx.writeln('wasm32');
    } else {
      ctx.writeln('SubstrateOS');
    }
    
    return { exitCode: 0 };
  },

  // Date
  date: (args, ctx) => {
    const now = new Date();
    ctx.writeln(now.toString());
    return { exitCode: 0 };
  },

  // Uptime
  uptime: (args, ctx) => {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const mins = now.getMinutes().toString().padStart(2, '0');
    ctx.writeln(` ${hours}:${mins}:00 up 0 min,  1 user,  load average: 0.00, 0.00, 0.00`);
    return { exitCode: 0 };
  },

  // Free memory
  free: (args, ctx) => {
    const human = args.includes('-h') || args.includes('--human');
    
    ctx.writeln('              total        used        free      shared  buff/cache   available');
    if (human) {
      ctx.writeln('Mem:          256Mi        56Mi       180Mi       0.0Ki        20Mi       200Mi');
      ctx.writeln('Swap:           0B          0B          0B');
    } else {
      ctx.writeln('Mem:         262144       57344      184320           0       20480      204800');
      ctx.writeln('Swap:             0           0           0');
    }
    
    return { exitCode: 0 };
  },

  // Disk free
  df: (args, ctx) => {
    const human = args.includes('-h') || args.includes('--human');
    
    ctx.writeln('Filesystem      Size  Used Avail Use% Mounted on');
    if (human) {
      ctx.writeln('substrateos     256M   10M  246M   4% /');
      ctx.writeln('devtmpfs        128M     0  128M   0% /dev');
      ctx.writeln('tmpfs           128M     0  128M   0% /tmp');
    } else {
      ctx.writeln('substrateos   262144  10240 251904   4% /');
      ctx.writeln('devtmpfs      131072      0 131072   0% /dev');
      ctx.writeln('tmpfs         131072      0 131072   0% /tmp');
    }
    
    return { exitCode: 0 };
  },

  // Process list
  ps: (args, ctx) => {
    ctx.writeln('  PID TTY          TIME CMD');
    ctx.writeln('    1 pts/0    00:00:00 init');
    ctx.writeln('    2 pts/0    00:00:00 sh');
    ctx.writeln('    3 pts/0    00:00:00 ps');
    return { exitCode: 0 };
  },

  // Clear screen
  clear: (args, ctx) => {
    ctx.write('\x1b[2J\x1b[H');
    return { exitCode: 0 };
  },

  // Environment variables
  env: (args, ctx) => {
    for (const [key, value] of ctx.env) {
      ctx.writeln(`${key}=${value}`);
    }
    return { exitCode: 0 };
  },

  // Export environment variable
  export: (args, ctx) => {
    for (const arg of args) {
      const match = arg.match(/^(\w+)=(.*)$/);
      if (match) {
        ctx.env.set(match[1], match[2]);
      } else if (ctx.env.has(arg)) {
        // Already exported
      } else {
        ctx.writeError(`export: '${arg}': not a valid identifier`);
      }
    }
    return { exitCode: 0 };
  },

  // Alias
  alias: (args, ctx) => {
    if (args.length === 0) {
      for (const [name, cmd] of ctx.aliases) {
        ctx.writeln(`alias ${name}='${cmd}'`);
      }
    } else {
      for (const arg of args) {
        const match = arg.match(/^(\w+)=(.*)$/);
        if (match) {
          ctx.aliases.set(match[1], match[2]);
        }
      }
    }
    return { exitCode: 0 };
  },

  // History
  history: (args, ctx) => {
    ctx.history.forEach((cmd, i) => {
      ctx.writeln(`  ${(i + 1).toString().padStart(4)}  ${cmd}`);
    });
    return { exitCode: 0 };
  },

  // Which command
  which: (args, ctx) => {
    if (args.length === 0) {
      ctx.writeError('which: missing argument');
      return { exitCode: 1 };
    }
    
    const cmd = args[0];
    const paths = ['/bin', '/sbin', '/usr/bin', '/usr/sbin', '/usr/local/bin'];
    
    for (const dir of paths) {
      const fullPath = `${dir}/${cmd}`;
      if (ctx.fs.exists(fullPath)) {
        ctx.writeln(fullPath);
        return { exitCode: 0 };
      }
    }
    
    ctx.writeError(`which: no ${cmd} in (${paths.join(':')})`);
    return { exitCode: 1 };
  },

  // Man pages
  man: (args, ctx) => {
    if (args.length === 0) {
      ctx.writeError('What manual page do you want?');
      return { exitCode: 1 };
    }
    
    const cmd = args[0];
    const manPages: Record<string, string> = {
      ls: 'LS(1)\n\nNAME\n       ls - list directory contents\n\nSYNOPSIS\n       ls [OPTION]... [FILE]...\n\nDESCRIPTION\n       List information about the FILEs.\n\n       -a, --all\n              do not ignore entries starting with .\n\n       -l     use a long listing format\n',
      cd: 'CD(1)\n\nNAME\n       cd - change the shell working directory\n\nSYNOPSIS\n       cd [dir]\n\nDESCRIPTION\n       Change the current directory to dir.\n',
      cat: 'CAT(1)\n\nNAME\n       cat - concatenate files and print on the standard output\n\nSYNOPSIS\n       cat [FILE]...\n\nDESCRIPTION\n       Concatenate FILE(s) to standard output.\n',
      sudo: 'SUDO(8)\n\nNAME\n       sudo - execute a command as another user\n\nSYNOPSIS\n       sudo [command]\n\nDESCRIPTION\n       sudo allows a permitted user to execute a command as the\n       superuser or another user.\n',
      echo: 'ECHO(1)\n\nNAME\n       echo - display a line of text\n\nSYNOPSIS\n       echo [STRING]...\n\nDESCRIPTION\n       Echo the STRING(s) to standard output.\n\n       -n     do not output the trailing newline\n',
    };
    
    if (manPages[cmd]) {
      ctx.writeln(manPages[cmd]);
    } else {
      ctx.writeError(`No manual entry for ${cmd}`);
      return { exitCode: 1 };
    }
    
    return { exitCode: 0 };
  },

  // Sudo - execute as superuser
  sudo: (args, ctx) => {
    if (args.length === 0) {
      ctx.writeError('usage: sudo command');
      return { exitCode: 1 };
    }
    
    // In SubstrateOS, sudo always succeeds (user has NOPASSWD)
    ctx.writeln(`\x1b[33m[sudo] executing as root\x1b[0m`);
    
    // Return special result to indicate sudo context
    return { exitCode: 0, output: '__SUDO__' };
  },

  // Su - switch user
  su: (args, ctx) => {
    const user = args[0] || 'root';
    ctx.writeln(`\x1b[33m[su] switched to ${user}\x1b[0m`);
    return { exitCode: 0 };
  },

  // Chmod
  chmod: (args, ctx) => {
    if (args.length < 2) {
      ctx.writeError('chmod: missing operand');
      return { exitCode: 1 };
    }
    
    const mode = args[0];
    const file = args[1];
    
    if (!ctx.fs.exists(file)) {
      ctx.writeError(`chmod: cannot access '${file}': No such file or directory`);
      return { exitCode: 1 };
    }
    
    ctx.writeln(`\x1b[90m[chmod] mode ${mode} applied to ${file}\x1b[0m`);
    return { exitCode: 0 };
  },

  // Chown
  chown: (args, ctx) => {
    if (!ctx.isSudo) {
      ctx.writeError('chown: Operation not permitted');
      return { exitCode: 1 };
    }
    
    if (args.length < 2) {
      ctx.writeError('chown: missing operand');
      return { exitCode: 1 };
    }
    
    const owner = args[0];
    const file = args[1];
    
    ctx.writeln(`\x1b[90m[chown] owner ${owner} set for ${file}\x1b[0m`);
    return { exitCode: 0 };
  },

  // Head
  head: (args, ctx) => {
    let lines = 10;
    let file = '';
    
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '-n' && args[i + 1]) {
        lines = parseInt(args[i + 1], 10);
        i++;
      } else if (!args[i].startsWith('-')) {
        file = args[i];
      }
    }
    
    if (!file) {
      ctx.writeError('head: missing file operand');
      return { exitCode: 1 };
    }
    
    const content = ctx.fs.readFile(file);
    if (content === null) {
      ctx.writeError(`head: cannot open '${file}' for reading`);
      return { exitCode: 1 };
    }
    
    const fileLines = content.split('\n');
    ctx.writeln(fileLines.slice(0, lines).join('\n'));
    
    return { exitCode: 0 };
  },

  // Tail
  tail: (args, ctx) => {
    let lines = 10;
    let file = '';
    
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '-n' && args[i + 1]) {
        lines = parseInt(args[i + 1], 10);
        i++;
      } else if (!args[i].startsWith('-')) {
        file = args[i];
      }
    }
    
    if (!file) {
      ctx.writeError('tail: missing file operand');
      return { exitCode: 1 };
    }
    
    const content = ctx.fs.readFile(file);
    if (content === null) {
      ctx.writeError(`tail: cannot open '${file}' for reading`);
      return { exitCode: 1 };
    }
    
    const fileLines = content.split('\n');
    ctx.writeln(fileLines.slice(-lines).join('\n'));
    
    return { exitCode: 0 };
  },

  // Word count
  wc: (args, ctx) => {
    if (args.length === 0) {
      ctx.writeError('wc: missing file operand');
      return { exitCode: 1 };
    }
    
    const file = args.filter(a => !a.startsWith('-'))[0];
    const content = ctx.fs.readFile(file);
    
    if (content === null) {
      ctx.writeError(`wc: ${file}: No such file or directory`);
      return { exitCode: 1 };
    }
    
    const lines = content.split('\n').length;
    const words = content.split(/\s+/).filter(w => w).length;
    const chars = content.length;
    
    ctx.writeln(`  ${lines}   ${words}  ${chars} ${file}`);
    return { exitCode: 0 };
  },

  // Grep
  grep: (args, ctx) => {
    if (args.length < 2) {
      ctx.writeError('grep: missing pattern or file');
      return { exitCode: 1 };
    }
    
    const pattern = args[0];
    const file = args[1];
    const content = ctx.fs.readFile(file);
    
    if (content === null) {
      ctx.writeError(`grep: ${file}: No such file or directory`);
      return { exitCode: 1 };
    }
    
    const regex = new RegExp(pattern, 'gi');
    const matches = content.split('\n').filter(line => regex.test(line));
    
    if (matches.length > 0) {
      matches.forEach(line => {
        ctx.writeln(line.replace(regex, '\x1b[1;31m$&\x1b[0m'));
      });
      return { exitCode: 0 };
    }
    
    return { exitCode: 1 };
  },

  // Sort
  sort: (args, ctx) => {
    if (args.length === 0) {
      ctx.writeError('sort: missing file operand');
      return { exitCode: 1 };
    }
    
    const reverse = args.includes('-r');
    const file = args.filter(a => !a.startsWith('-'))[0];
    const content = ctx.fs.readFile(file);
    
    if (content === null) {
      ctx.writeError(`sort: ${file}: No such file or directory`);
      return { exitCode: 1 };
    }
    
    const lines = content.split('\n').sort();
    if (reverse) lines.reverse();
    ctx.writeln(lines.join('\n'));
    
    return { exitCode: 0 };
  },

  // Exit
  exit: (args, ctx) => {
    ctx.writeln('logout');
    return { exitCode: parseInt(args[0], 10) || 0 };
  },

  // True/false
  true: () => ({ exitCode: 0 }),
  false: () => ({ exitCode: 1 }),

  // Sleep
  sleep: async (args, ctx) => {
    const seconds = parseFloat(args[0]) || 1;
    await new Promise(resolve => setTimeout(resolve, seconds * 1000));
    return { exitCode: 0 };
  },

  // Neofetch-style system info
  neofetch: (args, ctx) => {
    ctx.writeln('\x1b[1;36m ____        _         _             _        ___  ____  \x1b[0m');
    ctx.writeln('\x1b[1;36m/ ___| _   _| |__  ___| |_ _ __ __ _| |_ ___ / _ \\/ ___| \x1b[0m');
    ctx.writeln('\x1b[1;36m\\___ \\| | | | \'_ \\/ __| __| \'__/ _` | __/ _ \\ | | \\___ \\ \x1b[0m');
    ctx.writeln('\x1b[1;36m ___) | |_| | |_) \\__ \\ |_| | | (_| | ||  __/ |_| |___) |\x1b[0m');
    ctx.writeln('\x1b[1;36m|____/ \\__,_|_.__/|___/\\__|_|  \\__,_|\\__\\___|\\___/|____/ \x1b[0m');
    ctx.writeln('');
    ctx.writeln(`\x1b[1;36m user\x1b[0m@\x1b[1;36msubstrateos\x1b[0m`);
    ctx.writeln(' ─────────────────────');
    ctx.writeln(` \x1b[1;36mOS\x1b[0m: SubstrateOS 1.0.0 Browser Edition`);
    ctx.writeln(` \x1b[1;36mHost\x1b[0m: WebAssembly Virtual Machine`);
    ctx.writeln(` \x1b[1;36mKernel\x1b[0m: SubstrateOS wasm32 1.0.0`);
    ctx.writeln(` \x1b[1;36mShell\x1b[0m: subsh 1.0.0`);
    ctx.writeln(` \x1b[1;36mTerminal\x1b[0m: xterm.js`);
    ctx.writeln(` \x1b[1;36mCPU\x1b[0m: WebAssembly vCPU`);
    ctx.writeln(` \x1b[1;36mMemory\x1b[0m: 56MiB / 256MiB`);
    ctx.writeln('');
    ctx.writeln(' \x1b[40m  \x1b[41m  \x1b[42m  \x1b[43m  \x1b[44m  \x1b[45m  \x1b[46m  \x1b[47m  \x1b[0m');
    ctx.writeln('');
    ctx.writeln(' \x1b[90mby Andrew "Dru" Edwards\x1b[0m');
    ctx.writeln('');
    return { exitCode: 0 };
  },

  // APT package manager
  apt: (args, ctx) => {
    if (args.length === 0) {
      ctx.writeln('\x1b[1;36mSubstrateOS Package Manager (apt)\x1b[0m');
      ctx.writeln('');
      ctx.writeln('Usage: apt <command> [packages]');
      ctx.writeln('');
      ctx.writeln('Commands:');
      ctx.writeln('  list              List available packages');
      ctx.writeln('  search <query>    Search for packages');
      ctx.writeln('  install <pkg>     Install a package');
      ctx.writeln('  remove <pkg>      Remove a package');
      ctx.writeln('  update            Update package lists');
      ctx.writeln('  upgrade           Upgrade installed packages');
      ctx.writeln('  show <pkg>        Show package details');
      ctx.writeln('');
      ctx.writeln('\x1b[90mNote: SubstrateOS uses browser-based extensions loaded via URLs.\x1b[0m');
      ctx.writeln('\x1b[90mPackages are JavaScript modules that extend the shell.\x1b[0m');
      return { exitCode: 0 };
    }

    const cmd = args[0];
    const pkgName = args[1];

    const packages = [
      // ═══════════════════════════════════════════════════════════════
      // CORE SYSTEM PACKAGES (Pre-installed)
      // ═══════════════════════════════════════════════════════════════
      { name: 'coreutils', ver: '9.4.0', desc: 'GNU core utilities (ls, cp, mv, rm, cat, etc.)', installed: true, category: 'core' },
      { name: 'bash', ver: '5.2.0', desc: 'Bourne Again SHell', installed: true, category: 'core' },
      { name: 'grep', ver: '3.11', desc: 'Pattern matching utility', installed: true, category: 'core' },
      { name: 'sed', ver: '4.9', desc: 'Stream editor for filtering and transforming text', installed: true, category: 'core' },
      { name: 'awk', ver: '5.2.0', desc: 'Pattern scanning and processing language', installed: true, category: 'core' },
      { name: 'findutils', ver: '4.9.0', desc: 'Find files (find, xargs, locate)', installed: true, category: 'core' },
      
      // ═══════════════════════════════════════════════════════════════
      // PROGRAMMING LANGUAGES & RUNTIMES
      // ═══════════════════════════════════════════════════════════════
      { name: 'python', ver: '3.12.0', desc: 'Python 3.12 interpreter (Pyodide WASM)', installed: false, category: 'language' },
      { name: 'python3', ver: '3.12.0', desc: 'Python 3.12 with pip and venv', installed: false, category: 'language' },
      { name: 'nodejs', ver: '20.10.0', desc: 'Node.js JavaScript runtime (QuickJS)', installed: false, category: 'language' },
      { name: 'node', ver: '20.10.0', desc: 'Node.js with npm package manager', installed: false, category: 'language' },
      { name: 'typescript', ver: '5.3.0', desc: 'TypeScript compiler and language', installed: false, category: 'language' },
      { name: 'deno', ver: '1.38.0', desc: 'Secure JavaScript/TypeScript runtime', installed: false, category: 'language' },
      { name: 'ruby', ver: '3.2.0', desc: 'Ruby interpreter (via wasm-ruby)', installed: false, category: 'language' },
      { name: 'lua', ver: '5.4.6', desc: 'Lua scripting language (Fengari)', installed: false, category: 'language' },
      { name: 'php', ver: '8.3.0', desc: 'PHP interpreter (php-wasm)', installed: false, category: 'language' },
      { name: 'rust', ver: '1.74.0', desc: 'Rust compiler (limited WASM support)', installed: false, category: 'language' },
      { name: 'go', ver: '1.21.0', desc: 'Go compiler (TinyGo WASM)', installed: false, category: 'language' },
      { name: 'clang', ver: '17.0.0', desc: 'C/C++ compiler (Emscripten)', installed: false, category: 'language' },
      { name: 'gcc', ver: '13.2.0', desc: 'GNU C Compiler (via Emscripten)', installed: false, category: 'language' },
      
      // ═══════════════════════════════════════════════════════════════
      // PYTHON PACKAGES (pip-installable after python)
      // ═══════════════════════════════════════════════════════════════
      { name: 'python-numpy', ver: '1.26.0', desc: 'NumPy scientific computing', installed: false, category: 'python' },
      { name: 'python-pandas', ver: '2.1.0', desc: 'Pandas data analysis library', installed: false, category: 'python' },
      { name: 'python-matplotlib', ver: '3.8.0', desc: 'Matplotlib plotting library', installed: false, category: 'python' },
      { name: 'python-scipy', ver: '1.11.0', desc: 'SciPy scientific library', installed: false, category: 'python' },
      { name: 'python-scikit-learn', ver: '1.3.0', desc: 'Scikit-learn machine learning', installed: false, category: 'python' },
      { name: 'python-requests', ver: '2.31.0', desc: 'HTTP library for Python', installed: false, category: 'python' },
      { name: 'python-flask', ver: '3.0.0', desc: 'Flask web framework', installed: false, category: 'python' },
      { name: 'python-django', ver: '5.0.0', desc: 'Django web framework', installed: false, category: 'python' },
      { name: 'python-fastapi', ver: '0.104.0', desc: 'FastAPI async web framework', installed: false, category: 'python' },
      { name: 'python-pytest', ver: '7.4.0', desc: 'Pytest testing framework', installed: false, category: 'python' },
      { name: 'python-black', ver: '23.11.0', desc: 'Black code formatter', installed: false, category: 'python' },
      { name: 'python-mypy', ver: '1.7.0', desc: 'MyPy static type checker', installed: false, category: 'python' },
      { name: 'python-pillow', ver: '10.1.0', desc: 'Pillow image processing', installed: false, category: 'python' },
      { name: 'python-beautifulsoup', ver: '4.12.0', desc: 'BeautifulSoup HTML parser', installed: false, category: 'python' },
      { name: 'python-sympy', ver: '1.12', desc: 'SymPy symbolic mathematics', installed: false, category: 'python' },
      
      // ═══════════════════════════════════════════════════════════════
      // NODE.JS PACKAGES (npm-installable after nodejs)
      // ═══════════════════════════════════════════════════════════════
      { name: 'npm', ver: '10.2.0', desc: 'Node Package Manager', installed: false, category: 'node' },
      { name: 'yarn', ver: '4.0.0', desc: 'Yarn package manager', installed: false, category: 'node' },
      { name: 'pnpm', ver: '8.10.0', desc: 'Fast, disk space efficient package manager', installed: false, category: 'node' },
      { name: 'node-express', ver: '4.18.0', desc: 'Express.js web framework', installed: false, category: 'node' },
      { name: 'node-react', ver: '18.2.0', desc: 'React UI library', installed: false, category: 'node' },
      { name: 'node-vue', ver: '3.3.0', desc: 'Vue.js framework', installed: false, category: 'node' },
      { name: 'node-svelte', ver: '4.2.0', desc: 'Svelte compiler', installed: false, category: 'node' },
      { name: 'node-next', ver: '14.0.0', desc: 'Next.js React framework', installed: false, category: 'node' },
      { name: 'node-vite', ver: '5.0.0', desc: 'Vite build tool', installed: false, category: 'node' },
      { name: 'node-esbuild', ver: '0.19.0', desc: 'esbuild bundler', installed: false, category: 'node' },
      { name: 'node-webpack', ver: '5.89.0', desc: 'Webpack module bundler', installed: false, category: 'node' },
      { name: 'node-jest', ver: '29.7.0', desc: 'Jest testing framework', installed: false, category: 'node' },
      { name: 'node-mocha', ver: '10.2.0', desc: 'Mocha test framework', installed: false, category: 'node' },
      { name: 'node-eslint', ver: '8.54.0', desc: 'ESLint JavaScript linter', installed: false, category: 'node' },
      { name: 'node-prettier', ver: '3.1.0', desc: 'Prettier code formatter', installed: false, category: 'node' },
      { name: 'node-tailwindcss', ver: '3.3.0', desc: 'Tailwind CSS framework', installed: false, category: 'node' },
      { name: 'node-prisma', ver: '5.6.0', desc: 'Prisma ORM', installed: false, category: 'node' },
      { name: 'node-axios', ver: '1.6.0', desc: 'Axios HTTP client', installed: false, category: 'node' },
      { name: 'node-lodash', ver: '4.17.0', desc: 'Lodash utility library', installed: false, category: 'node' },
      { name: 'node-dayjs', ver: '1.11.0', desc: 'Day.js date library', installed: false, category: 'node' },
      
      // ═══════════════════════════════════════════════════════════════
      // VERSION CONTROL & COLLABORATION
      // ═══════════════════════════════════════════════════════════════
      { name: 'git', ver: '2.43.0', desc: 'Git version control (isomorphic-git)', installed: false, category: 'vcs' },
      { name: 'gh', ver: '2.40.0', desc: 'GitHub CLI', installed: false, category: 'vcs' },
      { name: 'gitui', ver: '0.24.0', desc: 'Terminal UI for git', installed: false, category: 'vcs' },
      { name: 'diff', ver: '3.5.0', desc: 'File comparison utility', installed: true, category: 'vcs' },
      { name: 'patch', ver: '2.7.6', desc: 'Apply diff patches', installed: false, category: 'vcs' },
      
      // ═══════════════════════════════════════════════════════════════
      // TEXT EDITORS & IDE TOOLS
      // ═══════════════════════════════════════════════════════════════
      { name: 'nano', ver: '7.2', desc: 'Nano text editor', installed: true, category: 'editor' },
      { name: 'vim', ver: '9.0', desc: 'Vi IMproved text editor', installed: false, category: 'editor' },
      { name: 'neovim', ver: '0.9.4', desc: 'Neovim modern vim fork', installed: false, category: 'editor' },
      { name: 'micro', ver: '2.0.13', desc: 'Micro modern terminal editor', installed: false, category: 'editor' },
      { name: 'emacs', ver: '29.1', desc: 'GNU Emacs editor', installed: false, category: 'editor' },
      { name: 'code-server', ver: '4.19.0', desc: 'VS Code in the browser', installed: false, category: 'editor' },
      
      // ═══════════════════════════════════════════════════════════════
      // DATABASE TOOLS
      // ═══════════════════════════════════════════════════════════════
      { name: 'sqlite3', ver: '3.44.0', desc: 'SQLite database engine (sql.js)', installed: true, category: 'database' },
      { name: 'postgresql-client', ver: '16.1', desc: 'PostgreSQL client (pg-wasm)', installed: false, category: 'database' },
      { name: 'mysql-client', ver: '8.2.0', desc: 'MySQL client tools', installed: false, category: 'database' },
      { name: 'redis-cli', ver: '7.2.0', desc: 'Redis command line client', installed: false, category: 'database' },
      { name: 'mongodb-tools', ver: '100.9.0', desc: 'MongoDB shell and tools', installed: false, category: 'database' },
      { name: 'duckdb', ver: '0.9.2', desc: 'DuckDB analytics database', installed: false, category: 'database' },
      
      // ═══════════════════════════════════════════════════════════════
      // NETWORKING & HTTP TOOLS
      // ═══════════════════════════════════════════════════════════════
      { name: 'curl', ver: '8.4.0', desc: 'Command line URL transfer', installed: false, category: 'network' },
      { name: 'wget', ver: '1.21.4', desc: 'Non-interactive network downloader', installed: false, category: 'network' },
      { name: 'httpie', ver: '3.2.2', desc: 'Modern HTTP client (http command)', installed: false, category: 'network' },
      { name: 'netcat', ver: '1.10', desc: 'TCP/IP swiss army knife', installed: false, category: 'network' },
      { name: 'ssh', ver: '9.5', desc: 'OpenSSH client (WebSocket proxy)', installed: false, category: 'network' },
      { name: 'rsync', ver: '3.2.7', desc: 'Remote file sync utility', installed: false, category: 'network' },
      
      // ═══════════════════════════════════════════════════════════════
      // DATA PROCESSING & JSON/YAML
      // ═══════════════════════════════════════════════════════════════
      { name: 'jq', ver: '1.7', desc: 'JSON processor (command-line)', installed: false, category: 'data' },
      { name: 'yq', ver: '4.40.0', desc: 'YAML processor (like jq)', installed: false, category: 'data' },
      { name: 'csvkit', ver: '1.3.0', desc: 'CSV processing utilities', installed: false, category: 'data' },
      { name: 'xmlstarlet', ver: '1.6.1', desc: 'XML processing toolkit', installed: false, category: 'data' },
      { name: 'pandoc', ver: '3.1.9', desc: 'Universal document converter', installed: false, category: 'data' },
      { name: 'markdown', ver: '3.5.0', desc: 'Markdown to HTML converter', installed: false, category: 'data' },
      
      // ═══════════════════════════════════════════════════════════════
      // BUILD & AUTOMATION TOOLS
      // ═══════════════════════════════════════════════════════════════
      { name: 'make', ver: '4.4.1', desc: 'GNU Make build automation', installed: false, category: 'build' },
      { name: 'cmake', ver: '3.28.0', desc: 'CMake build system', installed: false, category: 'build' },
      { name: 'ninja', ver: '1.11.1', desc: 'Ninja build system', installed: false, category: 'build' },
      { name: 'just', ver: '1.16.0', desc: 'Just command runner', installed: false, category: 'build' },
      { name: 'task', ver: '3.32.0', desc: 'Task runner / build tool', installed: false, category: 'build' },
      { name: 'docker-cli', ver: '24.0.7', desc: 'Docker CLI (remote only)', installed: false, category: 'build' },
      
      // ═══════════════════════════════════════════════════════════════
      // COMPRESSION & ARCHIVING
      // ═══════════════════════════════════════════════════════════════
      { name: 'tar', ver: '1.35', desc: 'Tape archive utility', installed: true, category: 'archive' },
      { name: 'gzip', ver: '1.13', desc: 'GNU zip compression', installed: true, category: 'archive' },
      { name: 'bzip2', ver: '1.0.8', desc: 'Block-sorting compression', installed: false, category: 'archive' },
      { name: 'xz', ver: '5.4.5', desc: 'XZ compression utility', installed: false, category: 'archive' },
      { name: 'zip', ver: '3.0', desc: 'ZIP archive creator', installed: false, category: 'archive' },
      { name: 'unzip', ver: '6.0', desc: 'ZIP archive extractor', installed: false, category: 'archive' },
      { name: '7zip', ver: '23.01', desc: '7-Zip archiver', installed: false, category: 'archive' },
      
      // ═══════════════════════════════════════════════════════════════
      // SECURITY & CRYPTOGRAPHY
      // ═══════════════════════════════════════════════════════════════
      { name: 'openssl', ver: '3.2.0', desc: 'OpenSSL cryptography toolkit', installed: false, category: 'security' },
      { name: 'gpg', ver: '2.4.3', desc: 'GnuPG encryption', installed: false, category: 'security' },
      { name: 'age', ver: '1.1.1', desc: 'Simple file encryption', installed: false, category: 'security' },
      { name: 'pass', ver: '1.7.4', desc: 'Password manager', installed: false, category: 'security' },
      { name: 'jwt-cli', ver: '6.0.0', desc: 'JWT token decoder/encoder', installed: false, category: 'security' },
      
      // ═══════════════════════════════════════════════════════════════
      // MONITORING & SYSTEM TOOLS
      // ═══════════════════════════════════════════════════════════════
      { name: 'htop', ver: '3.2.2', desc: 'Interactive process viewer', installed: false, category: 'system' },
      { name: 'btop', ver: '1.2.13', desc: 'Resource monitor (btop++)', installed: false, category: 'system' },
      { name: 'ncdu', ver: '2.3', desc: 'NCurses disk usage analyzer', installed: false, category: 'system' },
      { name: 'tree', ver: '2.1.1', desc: 'Directory tree viewer', installed: true, category: 'system' },
      { name: 'watch', ver: '4.0.4', desc: 'Execute program periodically', installed: false, category: 'system' },
      { name: 'tmux', ver: '3.3a', desc: 'Terminal multiplexer', installed: false, category: 'system' },
      { name: 'screen', ver: '4.9.1', desc: 'Screen manager', installed: false, category: 'system' },
      
      // ═══════════════════════════════════════════════════════════════
      // FUN & EDUCATIONAL
      // ═══════════════════════════════════════════════════════════════
      { name: 'cowsay', ver: '3.8.3', desc: 'Speaking cow ASCII art', installed: true, category: 'fun' },
      { name: 'fortune', ver: '1.0.0', desc: 'Random quotes and sayings', installed: true, category: 'fun' },
      { name: 'figlet', ver: '2.2.5', desc: 'ASCII art text banners', installed: true, category: 'fun' },
      { name: 'lolcat', ver: '100.0.1', desc: 'Rainbow text output', installed: false, category: 'fun' },
      { name: 'sl', ver: '5.05', desc: 'Steam locomotive animation', installed: false, category: 'fun' },
      { name: 'cmatrix', ver: '2.0', desc: 'Matrix screen effect', installed: false, category: 'fun' },
      { name: 'asciiquarium', ver: '1.1', desc: 'ASCII aquarium', installed: false, category: 'fun' },
      { name: 'pipes', ver: '1.3.0', desc: 'Animated pipes screensaver', installed: false, category: 'fun' },
      
      // ═══════════════════════════════════════════════════════════════
      // AI & MACHINE LEARNING
      // ═══════════════════════════════════════════════════════════════
      { name: 'ollama', ver: '0.1.17', desc: 'Run LLMs locally (WebGPU)', installed: false, category: 'ai' },
      { name: 'transformers-js', ver: '2.10.0', desc: 'Hugging Face Transformers.js', installed: false, category: 'ai' },
      { name: 'onnx-runtime', ver: '1.16.3', desc: 'ONNX Runtime for inference', installed: false, category: 'ai' },
      { name: 'tensorflow-js', ver: '4.14.0', desc: 'TensorFlow.js ML library', installed: false, category: 'ai' },
      { name: 'langchain-js', ver: '0.0.200', desc: 'LangChain for JS', installed: false, category: 'ai' },
      
      // ═══════════════════════════════════════════════════════════════
      // SUBSTRATEOS EXTENSIONS
      // ═══════════════════════════════════════════════════════════════
      { name: '@substrateos/python', ver: '1.0.0', desc: 'Official Python runtime extension', installed: false, category: 'substrateos' },
      { name: '@substrateos/nodejs', ver: '1.0.0', desc: 'Official Node.js runtime extension', installed: false, category: 'substrateos' },
      { name: '@substrateos/git', ver: '1.0.0', desc: 'Git with GitHub integration', installed: false, category: 'substrateos' },
      { name: '@substrateos/docker', ver: '1.0.0', desc: 'Container-like isolation', installed: false, category: 'substrateos' },
      { name: '@substrateos/web-server', ver: '1.0.0', desc: 'Built-in HTTP server', installed: false, category: 'substrateos' },
      { name: '@substrateos/ai-agent', ver: '1.0.0', desc: 'AI Agent SDK tools', installed: false, category: 'substrateos' },
      { name: '@substrateos/classroom', ver: '1.0.0', desc: 'Educational/classroom mode', installed: false, category: 'substrateos' },
    ];

    // Get unique categories
    const categories = [...new Set(packages.map(p => p.category))];
    
    switch (cmd) {
      case 'list':
        const listFilter = args[1];
        let filteredPkgs = packages;
        
        if (listFilter === '--installed') {
          filteredPkgs = packages.filter(p => p.installed);
          ctx.writeln('\x1b[1;36mInstalled Packages:\x1b[0m');
        } else if (listFilter && listFilter.startsWith('--category=')) {
          const cat = listFilter.replace('--category=', '');
          filteredPkgs = packages.filter(p => p.category === cat);
          ctx.writeln(`\x1b[1;36mPackages in category: ${cat}\x1b[0m`);
        } else if (listFilter === '--categories') {
          ctx.writeln('\x1b[1;36mAvailable Categories:\x1b[0m');
          ctx.writeln('');
          const catCounts: Record<string, { total: number; installed: number }> = {};
          packages.forEach(p => {
            if (!catCounts[p.category]) catCounts[p.category] = { total: 0, installed: 0 };
            catCounts[p.category].total++;
            if (p.installed) catCounts[p.category].installed++;
          });
          for (const [cat, counts] of Object.entries(catCounts).sort()) {
            ctx.writeln(`  \x1b[1;33m${cat.padEnd(15)}\x1b[0m ${counts.total} packages (${counts.installed} installed)`);
          }
          ctx.writeln('');
          ctx.writeln('\x1b[90mUsage: apt list --category=<name>\x1b[0m');
          return { exitCode: 0 };
        } else {
          ctx.writeln('\x1b[1;36m╔══════════════════════════════════════════════════════════╗\x1b[0m');
          ctx.writeln('\x1b[1;36m║           SubstrateOS Package Registry                   ║\x1b[0m');
          ctx.writeln('\x1b[1;36m╚══════════════════════════════════════════════════════════╝\x1b[0m');
        }
        ctx.writeln('');
        
        // Group by category
        const grouped: Record<string, typeof packages> = {};
        filteredPkgs.forEach(p => {
          if (!grouped[p.category]) grouped[p.category] = [];
          grouped[p.category].push(p);
        });
        
        for (const [cat, pkgs] of Object.entries(grouped).sort()) {
          const catNames: Record<string, string> = {
            'core': '🔧 Core System',
            'language': '💻 Languages & Runtimes',
            'python': '🐍 Python Packages',
            'node': '📦 Node.js Packages',
            'vcs': '🔀 Version Control',
            'editor': '📝 Text Editors',
            'database': '🗄️ Databases',
            'network': '🌐 Networking',
            'data': '📊 Data Processing',
            'build': '🏗️ Build Tools',
            'archive': '📁 Compression',
            'security': '🔐 Security',
            'system': '⚙️ System Tools',
            'fun': '🎮 Fun & Educational',
            'ai': '🤖 AI & ML',
            'substrateos': '⭐ SubstrateOS Extensions',
          };
          ctx.writeln(`\x1b[1;33m${catNames[cat] || cat}\x1b[0m`);
          for (const pkg of pkgs) {
            const status = pkg.installed ? '\x1b[1;32m✓\x1b[0m' : ' ';
            ctx.writeln(`  ${status} \x1b[1;32m${pkg.name.padEnd(25)}\x1b[0m ${pkg.ver.padEnd(10)} ${pkg.desc}`);
          }
          ctx.writeln('');
        }
        
        const installed = packages.filter(p => p.installed).length;
        ctx.writeln(`\x1b[90m${packages.length} packages available, ${installed} installed\x1b[0m`);
        ctx.writeln('\x1b[90mUsage: apt list --installed | apt list --categories | apt search <query>\x1b[0m');
        return { exitCode: 0 };

      case 'search':
        const query = (args.slice(1).join(' ') || '').toLowerCase();
        if (!query) {
          ctx.writeError('Usage: apt search <query>');
          return { exitCode: 1 };
        }
        const searchResults = packages.filter(p => 
          p.name.toLowerCase().includes(query) || 
          p.desc.toLowerCase().includes(query) ||
          p.category.toLowerCase().includes(query)
        );
        
        if (searchResults.length === 0) {
          ctx.writeln(`No packages found matching "${query}"`);
          return { exitCode: 0 };
        }
        
        ctx.writeln(`\x1b[1mSearch results for "${query}":\x1b[0m`);
        ctx.writeln('');
        for (const pkg of searchResults) {
          const status = pkg.installed ? '\x1b[1;32m[installed]\x1b[0m' : '';
          ctx.writeln(`\x1b[1;32m${pkg.name}\x1b[0m/${pkg.ver} ${status}`);
          ctx.writeln(`  ${pkg.desc}`);
        }
        ctx.writeln('');
        ctx.writeln(`\x1b[90m${searchResults.length} packages found\x1b[0m`);
        return { exitCode: 0 };

      case 'install':
        if (!pkgName) {
          ctx.writeError('E: No packages specified');
          return { exitCode: 1 };
        }
        ctx.writeln('Reading package lists... Done');
        ctx.writeln('Building dependency tree... Done');
        ctx.writeln(`The following NEW packages will be installed:`);
        ctx.writeln(`  ${pkgName}`);
        ctx.writeln('');
        ctx.writeln('\x1b[33mNote: Use the Extension API to install packages:\x1b[0m');
        ctx.writeln(`\x1b[33m  substrateos.install("${pkgName}")\x1b[0m`);
        return { exitCode: 0 };

      case 'remove':
        ctx.writeln(`Removing ${pkgName || 'package'}...`);
        return { exitCode: 0 };

      case 'update':
        ctx.writeln('Hit:1 https://registry.substrateos.dev substrateos InRelease');
        ctx.writeln('Reading package lists... Done');
        return { exitCode: 0 };

      case 'upgrade':
        ctx.writeln('Reading package lists... Done');
        ctx.writeln('0 upgraded, 0 newly installed, 0 to remove.');
        return { exitCode: 0 };

      case 'show':
        const pkg = packages.find(p => p.name === pkgName);
        if (pkg) {
          ctx.writeln(`Package: ${pkg.name}`);
          ctx.writeln(`Version: ${pkg.ver}`);
          ctx.writeln(`Description: ${pkg.desc}`);
        } else {
          ctx.writeError(`N: Unable to locate package ${pkgName}`);
          return { exitCode: 1 };
        }
        return { exitCode: 0 };

      default:
        ctx.writeError(`E: Invalid operation ${cmd}`);
        return { exitCode: 1 };
    }
  },

  // apt-get alias
  'apt-get': (args, ctx) => commands.apt(args, ctx),

  // dpkg package manager
  dpkg: (args, ctx) => {
    if (args.length === 0) {
      ctx.writeln('Usage: dpkg <command> [options]');
      ctx.writeln('');
      ctx.writeln('Commands:');
      ctx.writeln('  -l, --list              List installed packages');
      ctx.writeln('  -i, --install <pkg>     Install a package');
      ctx.writeln('  -r, --remove <pkg>      Remove a package');
      ctx.writeln('  -s, --status <pkg>      Show package status');
      return { exitCode: 0 };
    }

    const cmd = args[0];
    switch (cmd) {
      case '-l':
      case '--list':
        ctx.writeln('Desired=Unknown/Install/Remove/Purge/Hold');
        ctx.writeln('| Status=Not/Inst/Conf-files/Unpacked/halF-conf/Half-inst');
        ctx.writeln('||/ Name                 Version      Description');
        ctx.writeln('+++-====================-============-====================');
        ctx.writeln('ii  substrateos-core     1.0.0        SubstrateOS Core System');
        ctx.writeln('ii  substrateos-shell    1.0.0        SubstrateOS Shell (subsh)');
        ctx.writeln('ii  substrateos-devices  1.0.0        SubstrateOS Device Protocols');
        return { exitCode: 0 };

      case '-s':
      case '--status':
        ctx.writeln(`Package: ${args[1] || 'substrateos-core'}`);
        ctx.writeln('Status: install ok installed');
        ctx.writeln('Priority: required');
        ctx.writeln('Section: base');
        return { exitCode: 0 };

      default:
        return { exitCode: 0 };
    }
  },

  // yum/dnf - Red Hat style package managers
  yum: (args, ctx) => {
    ctx.writeln('\x1b[33mSubstrateOS uses apt-style package management.\x1b[0m');
    ctx.writeln('Try: apt ' + args.join(' '));
    return { exitCode: 0 };
  },
  dnf: (args, ctx) => commands.yum(args, ctx),

  // pacman - Arch style
  pacman: (args, ctx) => {
    ctx.writeln('\x1b[33mSubstrateOS uses apt-style package management.\x1b[0m');
    ctx.writeln('Try: apt ' + args.join(' '));
    return { exitCode: 0 };
  },

  // sh/bash shell
  sh: (args, ctx) => {
    if (args.length === 0) {
      ctx.writeln('\x1b[90mSubstrateOS Shell (subsh) - POSIX-compatible shell\x1b[0m');
      ctx.writeln('');
      ctx.writeln('Usage: sh [options] [script.sh] [args...]');
      ctx.writeln('');
      ctx.writeln('Options:');
      ctx.writeln('  -c <command>    Execute command string');
      ctx.writeln('  -x              Enable debug mode');
      ctx.writeln('');
      ctx.writeln('\x1b[90mNote: Interactive shell is already running.\x1b[0m');
      return { exitCode: 0 };
    }

    if (args[0] === '-c' && args[1]) {
      ctx.writeln(`\x1b[90m$ ${args[1]}\x1b[0m`);
      return { exitCode: 0 };
    }

    const script = args[0];
    const content = ctx.fs.readFile(script);
    if (content === null) {
      ctx.writeError(`sh: ${script}: No such file or directory`);
      return { exitCode: 127 };
    }

    ctx.writeln(`\x1b[90m[sh] Executing: ${script}\x1b[0m`);
    return { exitCode: 0 };
  },
  bash: (args, ctx) => commands.sh(args, ctx),
  zsh: (args, ctx) => commands.sh(args, ctx),

  // Version command
  version: (args, ctx) => {
    ctx.writeln('\x1b[1;36mSubstrateOS 1.0.0\x1b[0m (Browser Edition)');
    ctx.writeln('');
    ctx.writeln('A sandboxed, browser-based pseudo-Linux environment');
    ctx.writeln('powered by WebAssembly for client-side execution.');
    ctx.writeln('');
    ctx.writeln('Components:');
    ctx.writeln('  Runtime SDK      1.0.0');
    ctx.writeln('  Device Protocols 1.0.0');
    ctx.writeln('  Shell (subsh)    1.0.0');
    ctx.writeln('  Extension API    1.0.0');
    ctx.writeln('');
    ctx.writeln('Copyright (c) 2025 Edwards Tech Innovation');
    ctx.writeln('https://substrateos.dev');
    return { exitCode: 0 };
  },

  // About SubstrateOS
  about: (args, ctx) => {
    ctx.writeln('');
    ctx.writeln('\x1b[1;36m╔══════════════════════════════════════════════════════════╗\x1b[0m');
    ctx.writeln('\x1b[1;36m║                  About SubstrateOS                       ║\x1b[0m');
    ctx.writeln('\x1b[1;36m╚══════════════════════════════════════════════════════════╝\x1b[0m');
    ctx.writeln('');
    ctx.writeln('\x1b[1;33m"The browser-native Linux playground for building,\x1b[0m');
    ctx.writeln('\x1b[1;33m teaching, and experimenting with WASM."\x1b[0m');
    ctx.writeln('');
    ctx.writeln('SubstrateOS is a \x1b[1msandboxed, browser-based pseudo-Linux\x1b[0m environment.');
    ctx.writeln('No installs. No VMs. No risk. Runs on any device with a browser.');
    ctx.writeln('');
    ctx.writeln('\x1b[1;33mPerfect for:\x1b[0m');
    ctx.writeln('  • Learning Linux basics without breaking anything');
    ctx.writeln('  • Building and demoing browser-based micro-apps');
    ctx.writeln('  • Running WASM tools in a safe sandbox');
    ctx.writeln('  • AI agents that need safe command execution');
    ctx.writeln('');
    ctx.writeln('\x1b[1;33mGet Started:\x1b[0m');
    ctx.writeln('  Run \x1b[33mtutorial\x1b[0m     - Interactive beginner lesson');
    ctx.writeln('  Run \x1b[33mhelp\x1b[0m         - Available commands');
    ctx.writeln('  Run \x1b[33mapt list\x1b[0m     - Available packages');
    ctx.writeln('  Run \x1b[33mextend\x1b[0m       - Extension API example');
    ctx.writeln('');
    ctx.writeln('\x1b[90mby Andrew "Dru" Edwards - Edwards Tech Innovation\x1b[0m');
    ctx.writeln('');
    return { exitCode: 0 };
  },

  // Cowsay - fun ASCII cow
  cowsay: (args, ctx) => {
    const message = args.join(' ') || 'Moo!';
    const border = '_'.repeat(message.length + 2);
    ctx.writeln(` ${border}`);
    ctx.writeln(`< ${message} >`);
    ctx.writeln(` ${'-'.repeat(message.length + 2)}`);
    ctx.writeln('        \\   ^__^');
    ctx.writeln('         \\  (oo)\\_______');
    ctx.writeln('            (__)\\       )\\/\\');
    ctx.writeln('                ||----w |');
    ctx.writeln('                ||     ||');
    return { exitCode: 0 };
  },

  // Fortune - random quotes
  fortune: (args, ctx) => {
    const fortunes = [
      'The best way to predict the future is to create it.',
      'In the middle of difficulty lies opportunity. - Einstein',
      'The only way to do great work is to love what you do. - Jobs',
      'Talk is cheap. Show me the code. - Torvalds',
      'Simplicity is the ultimate sophistication. - da Vinci',
      'First, solve the problem. Then, write the code. - John Johnson',
      'Any fool can write code that a computer can understand.',
      'Good code is its own best documentation. - Steve McConnell',
      'The quieter you become, the more you can hear.',
      'Make it work, make it right, make it fast. - Kent Beck',
    ];
    const fortune = fortunes[Math.floor(Math.random() * fortunes.length)];
    ctx.writeln('');
    ctx.writeln(`  \x1b[1;33m"${fortune}"\x1b[0m`);
    ctx.writeln('');
    return { exitCode: 0 };
  },

  // Figlet - ASCII art text
  figlet: (args, ctx) => {
    const text = args.join(' ') || 'Hello';
    // Simple block letters
    const letters: Record<string, string[]> = {
      'H': ['█   █', '█▀▀▀█', '█   █'],
      'E': ['█▀▀▀', '█▀▀ ', '█▄▄▄'],
      'L': ['█   ', '█   ', '█▄▄▄'],
      'O': ['▄▀▀▄', '█  █', ' ▀▀ '],
      ' ': ['   ', '   ', '   '],
    };
    ctx.writeln('');
    for (let row = 0; row < 3; row++) {
      let line = '';
      for (const char of text.toUpperCase()) {
        line += (letters[char] || letters[' '])[row] + ' ';
      }
      ctx.writeln(`  \x1b[1;36m${line}\x1b[0m`);
    }
    ctx.writeln('');
    return { exitCode: 0 };
  },

  // Tutorial - interactive lesson
  tutorial: (args, ctx) => {
    ctx.writeln('');
    ctx.writeln('\x1b[1;36m╔══════════════════════════════════════════════════════════╗\x1b[0m');
    ctx.writeln('\x1b[1;36m║           SubstrateOS Tutorial - Linux Basics            ║\x1b[0m');
    ctx.writeln('\x1b[1;36m╚══════════════════════════════════════════════════════════╝\x1b[0m');
    ctx.writeln('');
    ctx.writeln('\x1b[1;33mLesson 1: Navigating the Filesystem\x1b[0m');
    ctx.writeln('');
    ctx.writeln('  \x1b[1mpwd\x1b[0m   - Print Working Directory (where am I?)');
    ctx.writeln('  \x1b[1mls\x1b[0m    - List files in current directory');
    ctx.writeln('  \x1b[1mcd\x1b[0m    - Change Directory (cd /home, cd ..)');
    ctx.writeln('');
    ctx.writeln('\x1b[1;33mTry it now:\x1b[0m');
    ctx.writeln('  1. Type \x1b[33mpwd\x1b[0m and press Enter');
    ctx.writeln('  2. Type \x1b[33mls\x1b[0m to see files');
    ctx.writeln('  3. Type \x1b[33mcd /\x1b[0m to go to root');
    ctx.writeln('  4. Type \x1b[33mls\x1b[0m to see root directories');
    ctx.writeln('');
    ctx.writeln('\x1b[1;33mLesson 2: Working with Files\x1b[0m');
    ctx.writeln('');
    ctx.writeln('  \x1b[1mcat\x1b[0m   - Display file contents (cat file.txt)');
    ctx.writeln('  \x1b[1mtouch\x1b[0m - Create empty file (touch myfile.txt)');
    ctx.writeln('  \x1b[1mecho\x1b[0m  - Print text (echo "Hello World")');
    ctx.writeln('  \x1b[1mmkdir\x1b[0m - Make directory (mkdir myfolder)');
    ctx.writeln('');
    ctx.writeln('\x1b[1;33mTry it:\x1b[0m');
    ctx.writeln('  1. Type \x1b[33mtouch hello.txt\x1b[0m');
    ctx.writeln('  2. Type \x1b[33mls\x1b[0m to see your new file');
    ctx.writeln('');
    ctx.writeln('\x1b[1;33mLesson 3: Fun Commands\x1b[0m');
    ctx.writeln('');
    ctx.writeln('  \x1b[1mcowsay\x1b[0m  - Make a cow say something');
    ctx.writeln('  \x1b[1mfortune\x1b[0m - Get a random quote');
    ctx.writeln('  \x1b[1mneofetch\x1b[0m - Show system info');
    ctx.writeln('');
    ctx.writeln('\x1b[90mTip: Type "help" to see all available commands!\x1b[0m');
    ctx.writeln('');
    return { exitCode: 0 };
  },

  // Extend - Extension API example
  extend: (args, ctx) => {
    ctx.writeln('');
    ctx.writeln('\x1b[1;36m╔══════════════════════════════════════════════════════════╗\x1b[0m');
    ctx.writeln('\x1b[1;36m║              SubstrateOS Extension API                   ║\x1b[0m');
    ctx.writeln('\x1b[1;36m╚══════════════════════════════════════════════════════════╝\x1b[0m');
    ctx.writeln('');
    ctx.writeln('\x1b[1;33mAdd custom commands to SubstrateOS:\x1b[0m');
    ctx.writeln('');
    ctx.writeln('\x1b[32m// Add a simple command\x1b[0m');
    ctx.writeln('\x1b[36msubstrate.extend({\x1b[0m');
    ctx.writeln('\x1b[36m  command: "hello",\x1b[0m');
    ctx.writeln('\x1b[36m  run(args) {\x1b[0m');
    ctx.writeln('\x1b[36m    return "Hello from WASM-land!"\x1b[0m');
    ctx.writeln('\x1b[36m  }\x1b[0m');
    ctx.writeln('\x1b[36m});\x1b[0m');
    ctx.writeln('');
    ctx.writeln('\x1b[32m// Add a command with arguments\x1b[0m');
    ctx.writeln('\x1b[36msubstrate.extend({\x1b[0m');
    ctx.writeln('\x1b[36m  command: "greet",\x1b[0m');
    ctx.writeln('\x1b[36m  run(args) {\x1b[0m');
    ctx.writeln('\x1b[36m    const name = args[0] || "World";\x1b[0m');
    ctx.writeln('\x1b[36m    return `Hello, ${name}!`;\x1b[0m');
    ctx.writeln('\x1b[36m  }\x1b[0m');
    ctx.writeln('\x1b[36m});\x1b[0m');
    ctx.writeln('');
    ctx.writeln('\x1b[32m// Install from URL\x1b[0m');
    ctx.writeln('\x1b[36msubstrate.install("https://example.com/my-extension.js");\x1b[0m');
    ctx.writeln('');
    ctx.writeln('\x1b[1;33mFrom JavaScript:\x1b[0m');
    ctx.writeln('');
    ctx.writeln('\x1b[36mimport { SubstrateOSShell } from "@substrateos/runtime";\x1b[0m');
    ctx.writeln('');
    ctx.writeln('\x1b[36mconst shell = new SubstrateOSShell();\x1b[0m');
    ctx.writeln('\x1b[36mshell.registerCommand("myCmd", async (args, ctx) => {\x1b[0m');
    ctx.writeln('\x1b[36m  ctx.writeln("My custom command!");\x1b[0m');
    ctx.writeln('\x1b[36m  return { exitCode: 0 };\x1b[0m');
    ctx.writeln('\x1b[36m});\x1b[0m');
    ctx.writeln('');
    ctx.writeln('\x1b[90mSee: https://substrateos.dev/docs/extensions\x1b[0m');
    ctx.writeln('');
    return { exitCode: 0 };
  },

  // JSON parser/viewer - developer-grade extension
  json: (args, ctx) => {
    if (args.length === 0) {
      ctx.writeln('\x1b[1;36mJSON Parser & Viewer\x1b[0m');
      ctx.writeln('');
      ctx.writeln('Usage: json <command> [args]');
      ctx.writeln('');
      ctx.writeln('Commands:');
      ctx.writeln('  json parse \'{"key":"value"}\'  Parse and pretty-print JSON');
      ctx.writeln('  json get <file>              Read and parse JSON file');
      ctx.writeln('  json query <path> <data>     Query with JSONPath (e.g., .name)');
      ctx.writeln('  json validate <data>         Check if valid JSON');
      ctx.writeln('');
      return { exitCode: 0 };
    }

    const cmd = args[0];
    const data = args.slice(1).join(' ');

    switch (cmd) {
      case 'parse':
      case 'pretty':
        try {
          const parsed = JSON.parse(data);
          const pretty = JSON.stringify(parsed, null, 2);
          pretty.split('\n').forEach(line => {
            // Colorize JSON
            line = line.replace(/"([^"]+)":/g, '\x1b[1;33m"$1"\x1b[0m:');
            line = line.replace(/: "([^"]+)"/g, ': \x1b[1;32m"$1"\x1b[0m');
            line = line.replace(/: (\d+)/g, ': \x1b[1;36m$1\x1b[0m');
            line = line.replace(/: (true|false)/g, ': \x1b[1;35m$1\x1b[0m');
            line = line.replace(/: (null)/g, ': \x1b[1;31m$1\x1b[0m');
            ctx.writeln(line);
          });
        } catch (e) {
          ctx.writeError(`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`);
          return { exitCode: 1 };
        }
        break;

      case 'validate':
        try {
          JSON.parse(data);
          ctx.writeln('\x1b[1;32m✓ Valid JSON\x1b[0m');
        } catch (e) {
          ctx.writeln('\x1b[1;31m✗ Invalid JSON\x1b[0m');
          ctx.writeError(e instanceof Error ? e.message : String(e));
          return { exitCode: 1 };
        }
        break;

      case 'query':
        try {
          const [path, ...jsonParts] = args.slice(1);
          const jsonData = JSON.parse(jsonParts.join(' '));
          const keys = path.replace(/^\./, '').split('.');
          let result = jsonData;
          for (const key of keys) {
            if (key && result !== undefined) {
              result = result[key];
            }
          }
          ctx.writeln(JSON.stringify(result, null, 2));
        } catch (e) {
          ctx.writeError(`Query failed: ${e instanceof Error ? e.message : String(e)}`);
          return { exitCode: 1 };
        }
        break;

      default:
        ctx.writeError(`Unknown json command: ${cmd}`);
        return { exitCode: 1 };
    }
    return { exitCode: 0 };
  },

  // Calculator - developer-grade extension
  calc: (args, ctx) => {
    if (args.length === 0) {
      ctx.writeln('\x1b[1;36mSubstrateOS Calculator\x1b[0m');
      ctx.writeln('');
      ctx.writeln('Usage: calc <expression>');
      ctx.writeln('');
      ctx.writeln('Examples:');
      ctx.writeln('  calc 2 + 2');
      ctx.writeln('  calc (10 * 5) / 2');
      ctx.writeln('  calc sqrt(16)');
      ctx.writeln('  calc pow(2, 8)');
      ctx.writeln('  calc sin(3.14159 / 2)');
      ctx.writeln('');
      ctx.writeln('Functions: sqrt, pow, sin, cos, tan, log, abs, floor, ceil, round');
      return { exitCode: 0 };
    }

    const expr = args.join(' ')
      .replace(/sqrt/g, 'Math.sqrt')
      .replace(/pow/g, 'Math.pow')
      .replace(/sin/g, 'Math.sin')
      .replace(/cos/g, 'Math.cos')
      .replace(/tan/g, 'Math.tan')
      .replace(/log/g, 'Math.log')
      .replace(/abs/g, 'Math.abs')
      .replace(/floor/g, 'Math.floor')
      .replace(/ceil/g, 'Math.ceil')
      .replace(/round/g, 'Math.round')
      .replace(/pi/gi, 'Math.PI')
      .replace(/e(?![a-z])/gi, 'Math.E');

    try {
      // Safe eval for math only
      if (!/^[\d\s+\-*/().Math,a-zA-Z]+$/.test(expr)) {
        throw new Error('Invalid characters in expression');
      }
      const result = Function(`"use strict"; return (${expr})`)();
      ctx.writeln(`\x1b[1;32m= ${result}\x1b[0m`);
    } catch (e) {
      ctx.writeError(`Error: ${e instanceof Error ? e.message : String(e)}`);
      return { exitCode: 1 };
    }
    return { exitCode: 0 };
  },

  // Learn Linux in 10 Minutes - killer tutorial
  learn: (args, ctx) => {
    ctx.writeln('');
    ctx.writeln('\x1b[1;36m╔══════════════════════════════════════════════════════════╗\x1b[0m');
    ctx.writeln('\x1b[1;36m║         Learn Linux in 10 Minutes 🐧                     ║\x1b[0m');
    ctx.writeln('\x1b[1;36m╚══════════════════════════════════════════════════════════╝\x1b[0m');
    ctx.writeln('');
    ctx.writeln('\x1b[1;33mMinute 1-2: Where Am I?\x1b[0m');
    ctx.writeln('  \x1b[1mpwd\x1b[0m     Print your current location');
    ctx.writeln('  \x1b[1mls\x1b[0m      List what\'s here');
    ctx.writeln('  \x1b[1mls -la\x1b[0m  List with details (permissions, size)');
    ctx.writeln('');
    ctx.writeln('\x1b[1;33mMinute 3-4: Moving Around\x1b[0m');
    ctx.writeln('  \x1b[1mcd /\x1b[0m       Go to root directory');
    ctx.writeln('  \x1b[1mcd ~\x1b[0m       Go to home directory');
    ctx.writeln('  \x1b[1mcd ..\x1b[0m      Go up one level');
    ctx.writeln('  \x1b[1mcd foldername\x1b[0m  Enter a folder');
    ctx.writeln('');
    ctx.writeln('\x1b[1;33mMinute 5-6: Creating Things\x1b[0m');
    ctx.writeln('  \x1b[1mtouch file.txt\x1b[0m     Create empty file');
    ctx.writeln('  \x1b[1mmkdir myfolder\x1b[0m     Create folder');
    ctx.writeln('  \x1b[1mecho "hi" > f.txt\x1b[0m  Write text to file');
    ctx.writeln('');
    ctx.writeln('\x1b[1;33mMinute 7-8: Reading Files\x1b[0m');
    ctx.writeln('  \x1b[1mcat file.txt\x1b[0m   Show file contents');
    ctx.writeln('  \x1b[1mhead file.txt\x1b[0m  Show first 10 lines');
    ctx.writeln('  \x1b[1mtail file.txt\x1b[0m  Show last 10 lines');
    ctx.writeln('');
    ctx.writeln('\x1b[1;33mMinute 9-10: Deleting & Moving\x1b[0m');
    ctx.writeln('  \x1b[1mrm file.txt\x1b[0m       Delete file');
    ctx.writeln('  \x1b[1mrm -r folder\x1b[0m      Delete folder');
    ctx.writeln('  \x1b[1mmv old.txt new.txt\x1b[0m  Rename/move file');
    ctx.writeln('  \x1b[1mcp a.txt b.txt\x1b[0m    Copy file');
    ctx.writeln('');
    ctx.writeln('\x1b[1;32m🎉 Congratulations! You know Linux basics!\x1b[0m');
    ctx.writeln('');
    ctx.writeln('\x1b[90mNext: Type "help" to see all commands, or "neofetch" for fun!\x1b[0m');
    ctx.writeln('');
    return { exitCode: 0 };
  },

  // Base64 encode/decode - developer utility
  base64: (args, ctx) => {
    if (args.length < 2) {
      ctx.writeln('Usage: base64 <encode|decode> <text>');
      return { exitCode: 1 };
    }
    const cmd = args[0];
    const text = args.slice(1).join(' ');
    
    try {
      if (cmd === 'encode') {
        ctx.writeln(btoa(text));
      } else if (cmd === 'decode') {
        ctx.writeln(atob(text));
      } else {
        ctx.writeError('Use: base64 encode <text> or base64 decode <encoded>');
        return { exitCode: 1 };
      }
    } catch (e) {
      ctx.writeError(`Error: ${e instanceof Error ? e.message : String(e)}`);
      return { exitCode: 1 };
    }
    return { exitCode: 0 };
  },

  // UUID generator
  uuid: (args, ctx) => {
    const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
    ctx.writeln(uuid);
    return { exitCode: 0 };
  },

  // Timestamp converter
  timestamp: (args, ctx) => {
    if (args.length === 0) {
      const now = Date.now();
      ctx.writeln(`Unix timestamp: ${Math.floor(now / 1000)}`);
      ctx.writeln(`ISO format:     ${new Date(now).toISOString()}`);
      ctx.writeln(`Local time:     ${new Date(now).toLocaleString()}`);
    } else {
      const ts = parseInt(args[0]);
      if (isNaN(ts)) {
        ctx.writeError('Invalid timestamp');
        return { exitCode: 1 };
      }
      const date = new Date(ts > 9999999999 ? ts : ts * 1000);
      ctx.writeln(`ISO format:  ${date.toISOString()}`);
      ctx.writeln(`Local time:  ${date.toLocaleString()}`);
    }
    return { exitCode: 0 };
  },

  // Embed SubstrateOS documentation
  embed: (args, ctx) => {
    ctx.writeln('');
    ctx.writeln('\x1b[1;36m╔══════════════════════════════════════════════════════════╗\x1b[0m');
    ctx.writeln('\x1b[1;36m║           Embed SubstrateOS in Your Website              ║\x1b[0m');
    ctx.writeln('\x1b[1;36m╚══════════════════════════════════════════════════════════╝\x1b[0m');
    ctx.writeln('');
    ctx.writeln('\x1b[1;33mQuick Embed (iframe):\x1b[0m');
    ctx.writeln('');
    ctx.writeln('\x1b[32m  <iframe\x1b[0m');
    ctx.writeln('\x1b[32m    src="https://substrateos.dev/embed"\x1b[0m');
    ctx.writeln('\x1b[32m    width="800" height="500"\x1b[0m');
    ctx.writeln('\x1b[32m  ></iframe>\x1b[0m');
    ctx.writeln('');
    ctx.writeln('\x1b[1;33mEmbed SDK:\x1b[0m');
    ctx.writeln('');
    ctx.writeln('\x1b[36m  npm install @substrateos/embed\x1b[0m');
    ctx.writeln('');
    ctx.writeln('\x1b[32m  import { SubstrateOS } from "@substrateos/embed";\x1b[0m');
    ctx.writeln('');
    ctx.writeln('\x1b[32m  const os = new SubstrateOS("#container", {\x1b[0m');
    ctx.writeln('\x1b[32m    theme: "dark",\x1b[0m');
    ctx.writeln('\x1b[32m    welcomeMessage: "Welcome!",\x1b[0m');
    ctx.writeln('\x1b[32m    initialCommands: ["learn"],\x1b[0m');
    ctx.writeln('\x1b[32m  });\x1b[0m');
    ctx.writeln('');
    ctx.writeln('\x1b[1;33mUse Cases:\x1b[0m');
    ctx.writeln('  • Interactive coding tutorials');
    ctx.writeln('  • Demo sandboxes for CLI tools');
    ctx.writeln('  • AI agent shells');
    ctx.writeln('  • Educational platforms');
    ctx.writeln('');
    ctx.writeln('\x1b[90mSee: https://substrateos.dev/docs/embedding\x1b[0m');
    ctx.writeln('');
    return { exitCode: 0 };
  },

  // Persist command - show persistence info
  persist: (args, ctx) => {
    ctx.writeln('');
    ctx.writeln('\x1b[1;36mSubstrateOS Persistence\x1b[0m');
    ctx.writeln('');
    ctx.writeln('SubstrateOS uses IndexedDB for persistent storage:');
    ctx.writeln('');
    ctx.writeln('\x1b[1;33m1. Key-Value Store:\x1b[0m');
    ctx.writeln('   \x1b[36mstore put mykey "my value"\x1b[0m  Save a value');
    ctx.writeln('   \x1b[36mstore get mykey\x1b[0m            Retrieve a value');
    ctx.writeln('   \x1b[36mstore list\x1b[0m                 List all keys');
    ctx.writeln('');
    ctx.writeln('\x1b[1;33m2. File System:\x1b[0m');
    ctx.writeln('   Files persist in browser storage');
    ctx.writeln('   Use \x1b[36mecho "text" > file.txt\x1b[0m to save');
    ctx.writeln('');
    ctx.writeln('\x1b[1;33m3. Installed Packages:\x1b[0m');
    ctx.writeln('   Packages install to \x1b[36m/usr/local/lib\x1b[0m');
    ctx.writeln('   State persists across sessions');
    ctx.writeln('');
    ctx.writeln('\x1b[90mNote: Data is stored locally in your browser.\x1b[0m');
    ctx.writeln('\x1b[90mClearing browser data will reset SubstrateOS.\x1b[0m');
    ctx.writeln('');
    return { exitCode: 0 };
  },

  // Backup workspace command
  backup: (args, ctx) => {
    ctx.writeln('');
    ctx.writeln('\x1b[1;36mBackup Workspace\x1b[0m');
    ctx.writeln('');
    ctx.writeln('Export your SubstrateOS workspace for backup or sharing.');
    ctx.writeln('');
    ctx.writeln('\x1b[1;33mUsage:\x1b[0m');
    ctx.writeln('  backup              Show this help');
    ctx.writeln('  backup download     Download workspace as JSON file');
    ctx.writeln('  backup show         Preview what will be exported');
    ctx.writeln('');
    ctx.writeln('\x1b[1;33mWhat gets exported:\x1b[0m');
    ctx.writeln('  • All files in /home/user');
    ctx.writeln('  • Key-value store entries');
    ctx.writeln('  • Installed package list');
    ctx.writeln('  • User configuration');
    ctx.writeln('');
    ctx.writeln('\x1b[90mNote: Use the browser\'s file download dialog to save.\x1b[0m');
    ctx.writeln('\x1b[90mThe exported JSON can be imported on any SubstrateOS instance.\x1b[0m');
    ctx.writeln('');

    if (args[0] === 'download') {
      ctx.writeln('\x1b[33mDownloading workspace...\x1b[0m');
      ctx.writeln('\x1b[90m(Check your browser downloads folder)\x1b[0m');
      // Note: Actual download is triggered via the UI/runtime
      // This command just signals the intent
    } else if (args[0] === 'show') {
      ctx.writeln('\x1b[1mBackup Preview:\x1b[0m');
      ctx.writeln('  Files: /home/user/*');
      ctx.writeln('  Format: JSON');
      ctx.writeln('  Compatibility: SubstrateOS v1+');
    }

    return { exitCode: 0 };
  },

  // Restore workspace command  
  restore: (args, ctx) => {
    ctx.writeln('');
    ctx.writeln('\x1b[1;36mRestore Workspace\x1b[0m');
    ctx.writeln('');
    ctx.writeln('Import a previously exported SubstrateOS workspace.');
    ctx.writeln('');
    ctx.writeln('\x1b[1;33mUsage:\x1b[0m');
    ctx.writeln('  restore              Show this help');
    ctx.writeln('  restore file         Open file picker to import');
    ctx.writeln('  restore --overwrite  Overwrite existing files');
    ctx.writeln('');
    ctx.writeln('\x1b[1;33mOptions:\x1b[0m');
    ctx.writeln('  --overwrite    Replace existing files/keys');
    ctx.writeln('  --files-only   Only import filesystem');
    ctx.writeln('  --keys-only    Only import key-value store');
    ctx.writeln('');
    ctx.writeln('\x1b[90mNote: Use the browser\'s file picker to select a .json file.\x1b[0m');
    ctx.writeln('');

    if (args[0] === 'file') {
      ctx.writeln('\x1b[33mOpening file picker...\x1b[0m');
      ctx.writeln('\x1b[90m(Select a SubstrateOS workspace JSON file)\x1b[0m');
    }

    return { exitCode: 0 };
  },

  // Storage status command
  storage: (args, ctx) => {
    ctx.writeln('');
    ctx.writeln('\x1b[1;36mStorage Status\x1b[0m');
    ctx.writeln('');
    ctx.writeln('\x1b[1;33mBrowser Storage:\x1b[0m');
    ctx.writeln('  Type: IndexedDB (persistent)');
    ctx.writeln('  Location: Local to this browser & device');
    ctx.writeln('  Sync: None (local only)');
    ctx.writeln('');
    ctx.writeln('\x1b[1;33mData Stored:\x1b[0m');
    ctx.writeln('  • Filesystem (/home/user, /tmp)');
    ctx.writeln('  • Key-value pairs (store command)');
    ctx.writeln('  • Installed packages');
    ctx.writeln('  • Configuration');
    ctx.writeln('');
    ctx.writeln('\x1b[1;33mCommands:\x1b[0m');
    ctx.writeln('  \x1b[36mexport download\x1b[0m  Backup your workspace');
    ctx.writeln('  \x1b[36mimport file\x1b[0m     Restore a backup');
    ctx.writeln('');
    ctx.writeln('\x1b[1;31m⚠ Warning:\x1b[0m Clearing browser data will delete everything!');
    ctx.writeln('\x1b[90mRegularly export your workspace to avoid data loss.\x1b[0m');
    ctx.writeln('');
    return { exitCode: 0 };
  },

  // ═══════════════════════════════════════════════════════════════
  // ADDITIONAL DEVELOPER COMMANDS
  // ═══════════════════════════════════════════════════════════════

  // Tree - directory tree view
  tree: (args, ctx) => {
    let path = '.';
    let maxDepth = 3;
    let showAll = false;
    
    for (const arg of args) {
      if (arg === '-a') showAll = true;
      else if (arg.startsWith('-L')) maxDepth = parseInt(arg.slice(2)) || 3;
      else if (!arg.startsWith('-')) path = arg;
    }
    
    const printTree = (dir: string, prefix: string, depth: number): void => {
      if (depth > maxDepth) return;
      
      const entries = ctx.fs.listDir(dir);
      if (!entries) return;
      
      const filtered = showAll ? entries : entries.filter(e => !e.name.startsWith('.'));
      
      filtered.forEach((entry, i) => {
        const isLast = i === filtered.length - 1;
        const connector = isLast ? '└── ' : '├── ';
        const nextPrefix = prefix + (isLast ? '    ' : '│   ');
        
        const name = entry.type === 'directory' 
          ? `\x1b[1;34m${entry.name}\x1b[0m`
          : entry.name;
        
        ctx.writeln(`${prefix}${connector}${name}`);
        
        if (entry.type === 'directory') {
          const subPath = dir === '.' ? entry.name : `${dir}/${entry.name}`;
          printTree(subPath, nextPrefix, depth + 1);
        }
      });
    };
    
    ctx.writeln(`\x1b[1;34m${path}\x1b[0m`);
    printTree(path, '', 1);
    
    return { exitCode: 0 };
  },

  // Find - search for files
  find: (args, ctx) => {
    if (args.length === 0) {
      ctx.writeln('Usage: find <path> [-name <pattern>] [-type <f|d>]');
      return { exitCode: 1 };
    }
    
    let searchPath = args[0] || '.';
    let namePattern = '';
    let typeFilter = '';
    
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '-name' && args[i + 1]) {
        namePattern = args[i + 1].replace(/\*/g, '.*');
        i++;
      } else if (args[i] === '-type' && args[i + 1]) {
        typeFilter = args[i + 1];
        i++;
      }
    }
    
    const findFiles = (dir: string): void => {
      const entries = ctx.fs.listDir(dir);
      if (!entries) return;
      
      for (const entry of entries) {
        const fullPath = dir === '.' ? entry.name : `${dir}/${entry.name}`;
        
        // Type filter
        if (typeFilter === 'f' && entry.type === 'directory') continue;
        if (typeFilter === 'd' && entry.type !== 'directory') continue;
        
        // Name filter
        if (namePattern) {
          const regex = new RegExp('^' + namePattern + '$', 'i');
          if (!regex.test(entry.name)) {
            if (entry.type === 'directory') findFiles(fullPath);
            continue;
          }
        }
        
        ctx.writeln(fullPath);
        
        if (entry.type === 'directory') {
          findFiles(fullPath);
        }
      }
    };
    
    findFiles(searchPath);
    return { exitCode: 0 };
  },

  // Less/More - pager (simplified)
  less: (args, ctx) => {
    if (args.length === 0) {
      ctx.writeError('less: missing file operand');
      return { exitCode: 1 };
    }
    
    const content = ctx.fs.readFile(args[0]);
    if (content === null) {
      ctx.writeError(`less: ${args[0]}: No such file or directory`);
      return { exitCode: 1 };
    }
    
    ctx.writeln(content);
    ctx.writeln('\x1b[7m(END)\x1b[0m');
    return { exitCode: 0 };
  },
  more: (args, ctx) => commands.less(args, ctx),

  // Tee - read from stdin and write to file
  tee: (args, ctx) => {
    if (args.length === 0) {
      ctx.writeln('Usage: command | tee <file>');
      ctx.writeln('Note: In SubstrateOS, use: echo "text" | tee file.txt');
      return { exitCode: 0 };
    }
    ctx.writeln('\x1b[90m[tee] Output would be written to: ' + args[0] + '\x1b[0m');
    return { exitCode: 0 };
  },

  // Cut - remove sections from each line
  cut: (args, ctx) => {
    let delimiter = '\t';
    let fields: number[] = [];
    let file = '';
    
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '-d' && args[i + 1]) {
        delimiter = args[i + 1];
        i++;
      } else if (args[i] === '-f' && args[i + 1]) {
        fields = args[i + 1].split(',').map(f => parseInt(f) - 1);
        i++;
      } else if (!args[i].startsWith('-')) {
        file = args[i];
      }
    }
    
    if (!file) {
      ctx.writeln('Usage: cut -d<delimiter> -f<fields> <file>');
      ctx.writeln('Example: cut -d, -f1,3 data.csv');
      return { exitCode: 1 };
    }
    
    const content = ctx.fs.readFile(file);
    if (content === null) {
      ctx.writeError(`cut: ${file}: No such file or directory`);
      return { exitCode: 1 };
    }
    
    const lines = content.split('\n');
    for (const line of lines) {
      if (!line) continue;
      const parts = line.split(delimiter);
      const selected = fields.length > 0 
        ? fields.map(f => parts[f] || '').join(delimiter)
        : line;
      ctx.writeln(selected);
    }
    
    return { exitCode: 0 };
  },

  // Uniq - report or omit repeated lines
  uniq: (args, ctx) => {
    const countMode = args.includes('-c');
    const file = args.filter(a => !a.startsWith('-'))[0];
    
    if (!file) {
      ctx.writeln('Usage: uniq [-c] <file>');
      return { exitCode: 1 };
    }
    
    const content = ctx.fs.readFile(file);
    if (content === null) {
      ctx.writeError(`uniq: ${file}: No such file or directory`);
      return { exitCode: 1 };
    }
    
    const lines = content.split('\n');
    const counts: Map<string, number> = new Map();
    
    for (const line of lines) {
      counts.set(line, (counts.get(line) || 0) + 1);
    }
    
    for (const [line, count] of counts) {
      if (countMode) {
        ctx.writeln(`${count.toString().padStart(7)} ${line}`);
      } else {
        ctx.writeln(line);
      }
    }
    
    return { exitCode: 0 };
  },

  // Tr - translate characters
  tr: (args, ctx) => {
    if (args.length < 2) {
      ctx.writeln('Usage: echo "text" | tr <set1> <set2>');
      ctx.writeln('Example: echo "hello" | tr a-z A-Z');
      return { exitCode: 1 };
    }
    ctx.writeln('\x1b[90m[tr] Character translation (pipe input required)\x1b[0m');
    return { exitCode: 0 };
  },

  // Xargs - build and execute command lines
  xargs: (args, ctx) => {
    ctx.writeln('Usage: command | xargs <cmd>');
    ctx.writeln('Example: find . -name "*.txt" | xargs cat');
    ctx.writeln('\x1b[90mNote: xargs works with piped input in SubstrateOS\x1b[0m');
    return { exitCode: 0 };
  },

  // Rev - reverse lines
  rev: (args, ctx) => {
    const file = args[0];
    if (!file) {
      ctx.writeln('Usage: rev <file>');
      return { exitCode: 1 };
    }
    
    const content = ctx.fs.readFile(file);
    if (content === null) {
      ctx.writeError(`rev: ${file}: No such file or directory`);
      return { exitCode: 1 };
    }
    
    const lines = content.split('\n');
    for (const line of lines) {
      ctx.writeln(line.split('').reverse().join(''));
    }
    
    return { exitCode: 0 };
  },

  // Seq - print sequence of numbers
  seq: (args, ctx) => {
    let start = 1;
    let end = 10;
    let step = 1;
    
    if (args.length === 1) {
      end = parseInt(args[0]);
    } else if (args.length === 2) {
      start = parseInt(args[0]);
      end = parseInt(args[1]);
    } else if (args.length >= 3) {
      start = parseInt(args[0]);
      step = parseInt(args[1]);
      end = parseInt(args[2]);
    }
    
    for (let i = start; step > 0 ? i <= end : i >= end; i += step) {
      ctx.writeln(String(i));
    }
    
    return { exitCode: 0 };
  },

  // Yes - output a string repeatedly
  yes: (args, ctx) => {
    const text = args.join(' ') || 'y';
    for (let i = 0; i < 10; i++) { // Limited to 10 for safety
      ctx.writeln(text);
    }
    ctx.writeln('\x1b[90m... (output limited to 10 lines)\x1b[0m');
    return { exitCode: 0 };
  },

  // Hexdump - display file in hex
  hexdump: (args, ctx) => {
    const file = args.filter(a => !a.startsWith('-'))[0];
    if (!file) {
      ctx.writeln('Usage: hexdump <file>');
      return { exitCode: 1 };
    }
    
    const content = ctx.fs.readFile(file);
    if (content === null) {
      ctx.writeError(`hexdump: ${file}: No such file or directory`);
      return { exitCode: 1 };
    }
    
    const bytes = new TextEncoder().encode(content);
    for (let i = 0; i < Math.min(bytes.length, 256); i += 16) {
      const offset = i.toString(16).padStart(8, '0');
      const hex = Array.from(bytes.slice(i, i + 16))
        .map(b => b.toString(16).padStart(2, '0'))
        .join(' ');
      const ascii = Array.from(bytes.slice(i, i + 16))
        .map(b => b >= 32 && b < 127 ? String.fromCharCode(b) : '.')
        .join('');
      ctx.writeln(`${offset}  ${hex.padEnd(48)}  |${ascii}|`);
    }
    
    if (bytes.length > 256) {
      ctx.writeln('\x1b[90m... (truncated, showing first 256 bytes)\x1b[0m');
    }
    
    return { exitCode: 0 };
  },

  // Stat - display file status
  stat: (args, ctx) => {
    const file = args[0];
    if (!file) {
      ctx.writeln('Usage: stat <file>');
      return { exitCode: 1 };
    }
    
    const entries = ctx.fs.listDir('.');
    const entry = entries?.find(e => e.name === file);
    
    if (!entry) {
      ctx.writeError(`stat: cannot stat '${file}': No such file or directory`);
      return { exitCode: 1 };
    }
    
    ctx.writeln(`  File: ${file}`);
    ctx.writeln(`  Size: ${entry.size}\t\tBlocks: ${Math.ceil(entry.size / 512)}\t${entry.type}`);
    ctx.writeln(`Access: (${entry.permissions})\tUid: 1000\tGid: 1000`);
    ctx.writeln(`Access: ${entry.modified.toISOString()}`);
    ctx.writeln(`Modify: ${entry.modified.toISOString()}`);
    ctx.writeln(`Change: ${entry.modified.toISOString()}`);
    
    return { exitCode: 0 };
  },

  // File - determine file type
  file: (args, ctx) => {
    const file = args[0];
    if (!file) {
      ctx.writeln('Usage: file <filename>');
      return { exitCode: 1 };
    }
    
    const content = ctx.fs.readFile(file);
    if (content === null) {
      ctx.writeError(`file: ${file}: No such file or directory`);
      return { exitCode: 1 };
    }
    
    // Simple file type detection
    if (file.endsWith('.json')) {
      ctx.writeln(`${file}: JSON text`);
    } else if (file.endsWith('.js') || file.endsWith('.ts')) {
      ctx.writeln(`${file}: JavaScript/TypeScript source`);
    } else if (file.endsWith('.py')) {
      ctx.writeln(`${file}: Python script`);
    } else if (file.endsWith('.md')) {
      ctx.writeln(`${file}: Markdown document`);
    } else if (file.endsWith('.html')) {
      ctx.writeln(`${file}: HTML document`);
    } else if (file.endsWith('.css')) {
      ctx.writeln(`${file}: CSS stylesheet`);
    } else if (file.endsWith('.sh')) {
      ctx.writeln(`${file}: Bourne shell script`);
    } else if (content.startsWith('{') || content.startsWith('[')) {
      ctx.writeln(`${file}: JSON data`);
    } else if (content.startsWith('<!DOCTYPE') || content.startsWith('<html')) {
      ctx.writeln(`${file}: HTML document`);
    } else {
      ctx.writeln(`${file}: ASCII text`);
    }
    
    return { exitCode: 0 };
  },

  // Dirname / Basename - path manipulation
  dirname: (args, ctx) => {
    const path = args[0];
    if (!path) {
      ctx.writeln('Usage: dirname <path>');
      return { exitCode: 1 };
    }
    const parts = path.split('/');
    parts.pop();
    ctx.writeln(parts.join('/') || '.');
    return { exitCode: 0 };
  },

  basename: (args, ctx) => {
    const path = args[0];
    if (!path) {
      ctx.writeln('Usage: basename <path>');
      return { exitCode: 1 };
    }
    const parts = path.split('/');
    ctx.writeln(parts[parts.length - 1] || path);
    return { exitCode: 0 };
  },

  // Realpath - resolve absolute path
  realpath: (args, ctx) => {
    const path = args[0];
    if (!path) {
      ctx.writeln('Usage: realpath <path>');
      return { exitCode: 1 };
    }
    const cwd = ctx.fs.pwd();
    if (path.startsWith('/')) {
      ctx.writeln(path);
    } else {
      ctx.writeln(`${cwd}/${path}`.replace(/\/+/g, '/'));
    }
    return { exitCode: 0 };
  },

  // Printenv - print environment variables
  printenv: (args, ctx) => {
    if (args.length === 0) {
      for (const [key, value] of ctx.env) {
        ctx.writeln(`${key}=${value}`);
      }
    } else {
      const value = ctx.env.get(args[0]);
      if (value) {
        ctx.writeln(value);
      } else {
        return { exitCode: 1 };
      }
    }
    return { exitCode: 0 };
  },

  // Source / . - execute script in current shell
  source: (args, ctx) => {
    const script = args[0];
    if (!script) {
      ctx.writeln('Usage: source <script>');
      return { exitCode: 1 };
    }
    
    const content = ctx.fs.readFile(script);
    if (content === null) {
      ctx.writeError(`source: ${script}: No such file or directory`);
      return { exitCode: 1 };
    }
    
    ctx.writeln(`\x1b[90m[source] Would execute: ${script}\x1b[0m`);
    return { exitCode: 0 };
  },
  '.': (args, ctx) => commands.source(args, ctx),

  // Md5sum / Sha256sum - hash files
  md5sum: (args, ctx) => {
    const file = args[0];
    if (!file) {
      ctx.writeln('Usage: md5sum <file>');
      return { exitCode: 1 };
    }
    
    const content = ctx.fs.readFile(file);
    if (content === null) {
      ctx.writeError(`md5sum: ${file}: No such file`);
      return { exitCode: 1 };
    }
    
    // Simple hash simulation (not real MD5)
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      hash = ((hash << 5) - hash) + content.charCodeAt(i);
      hash |= 0;
    }
    const fakeHash = Math.abs(hash).toString(16).padStart(32, '0').slice(0, 32);
    ctx.writeln(`${fakeHash}  ${file}`);
    
    return { exitCode: 0 };
  },

  sha256sum: (args, ctx) => {
    const file = args[0];
    if (!file) {
      ctx.writeln('Usage: sha256sum <file>');
      return { exitCode: 1 };
    }
    
    const content = ctx.fs.readFile(file);
    if (content === null) {
      ctx.writeError(`sha256sum: ${file}: No such file`);
      return { exitCode: 1 };
    }
    
    // Simple hash simulation (not real SHA256)
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      hash = ((hash << 7) - hash) + content.charCodeAt(i);
      hash |= 0;
    }
    const fakeHash = Math.abs(hash).toString(16).padStart(64, '0').slice(0, 64);
    ctx.writeln(`${fakeHash}  ${file}`);
    
    return { exitCode: 0 };
  },

  // SQLite-Lite extension commands
  sqlite: sqliteCommands.sqlite,
  sql: sqliteCommands.sql,
};
