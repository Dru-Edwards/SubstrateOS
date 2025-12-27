# SubstrateOS Free

<p align="center">
  <img src="https://substrateos.dev/assets/logo.svg" width="120" alt="SubstrateOS">
</p>

<p align="center">
  <strong>Browser-Native Linux Playground</strong><br>
  Learn Linux, SQL, and command-line basics — no installation required.
</p>

<p align="center">
  <a href="https://substrateos.dev/demo">Try Demo</a> •
  <a href="https://substrateos.dev/docs">Documentation</a> •
  <a href="https://substrateos.dev/pricing">Upgrade</a>
</p>

---

## 💰 Price

**$0** — Free forever. No credit card required.

---

## ✨ Features

### 🖥️ Full Linux Shell
50+ built-in commands with tab completion and history:

```bash
# Navigate the filesystem
ls -la /home/user
cd projects && pwd

# Search and filter
grep -r "TODO" . | head -5
find . -name "*.txt" -mtime -7

# Text processing
cat file.txt | sort | uniq -c | sort -rn
```

**Available Commands:**
| Category | Commands |
|----------|----------|
| **Navigation** | `cd`, `ls`, `pwd`, `tree`, `pushd`, `popd` |
| **Files** | `cat`, `touch`, `cp`, `mv`, `rm`, `mkdir`, `rmdir` |
| **Search** | `grep`, `find`, `which`, `locate` |
| **Text** | `head`, `tail`, `wc`, `sort`, `uniq`, `cut`, `tr` |
| **System** | `echo`, `env`, `export`, `alias`, `history`, `clear` |
| **Fun** | `cowsay`, `fortune`, `figlet`, `neofetch`, `sl` |

### 📁 Persistent Filesystem
Your files survive browser refresh and device reboots:

```bash
# Create project structure
mkdir -p ~/projects/myapp/{src,docs,tests}

# Write files
echo "# My Project" > ~/projects/myapp/README.md

# Your files are here next time you visit!
```

- **50MB storage** included
- Stored in browser's IndexedDB
- Private to your device

### 🗄️ SQLite Database
Full SQL support with persistent storage:

```bash
# Create a table
sql CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, email TEXT);

# Insert data
sql INSERT INTO users (name, email) VALUES ('Alice', 'alice@example.com');

# Query data
sql SELECT * FROM users WHERE name LIKE 'A%';
```

### 📚 Interactive Tutorials
Learn at your own pace:

```bash
# Start learning
learn

# Available lessons:
#  1. Navigation Basics
#  2. Working with Files
#  3. Text Processing
#  4. Shell Scripting Basics
#  5. SQL Fundamentals

# Direct lesson access
tutorial navigation
tutorial files
```

### 🎨 Fun Commands
```bash
# ASCII art
figlet "Hello World"
cowsay "Moo!"

# System info
neofetch

# Random wisdom
fortune
```

---

## 🚀 Quick Start

### Option 1: Try Online
Visit [substrateos.dev/demo](https://substrateos.dev/demo) — works instantly in your browser.

### Option 2: Embed in Your Site
```html
<iframe 
  src="https://substrateos.dev/embed/free" 
  width="800" 
  height="500"
  style="border: 1px solid #333; border-radius: 8px;"
></iframe>
```

---

## 📊 Free vs Paid Comparison

| Feature | Free | Developer ($9/mo) | Pro ($19/mo) |
|---------|:----:|:-----------------:|:------------:|
| Shell commands | ✅ 50+ | ✅ 50+ | ✅ 50+ |
| SQLite database | ✅ | ✅ | ✅ |
| Tutorials | ✅ | ✅ | ✅ |
| Storage | 50MB | 200MB | 500MB |
| Python runtime | ❌ | ✅ | ✅ |
| Node.js runtime | ❌ | ✅ | ✅ |
| Website embedding | ❌ | ✅ | ✅ |
| Workspaces | 1 | 3 | 10 |
| Agent SDK | ❌ | ❌ | ✅ |
| Custom branding | ❌ | ❌ | ✅ |

---

## 🎓 Perfect For

- **Students** learning Linux basics
- **Bootcamp attendees** practicing command-line skills
- **Developers** who need a quick terminal without setup
- **Teachers** demonstrating shell concepts
- **Anyone** curious about Linux

---

## ⬆️ Ready for More?

Need Python, Node.js, or AI agent capabilities?

<p align="center">
  <a href="https://substrateos.dev/pricing">
    <strong>View All Plans →</strong>
  </a>
</p>

---

## 📞 Support

- **Documentation:** [substrateos.dev/docs](https://substrateos.dev/docs)
- **Community:** [Discord](https://discord.gg/substrateos)
- **Issues:** [GitHub](https://github.com/substrateos/substrateos/issues)
