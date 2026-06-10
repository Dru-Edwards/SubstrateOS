#!/usr/bin/env bash
# SubstrateOS — native Buildroot image build for v86 (run inside Ubuntu WSL).
#
# Produces a modern 32-bit Linux (bzImage + rootfs.cpio.gz) and copies both into
# web-demo/public/kernel/ for KernelSession to boot.
#
# Prereqs (one-time, needs sudo in an interactive terminal):
#   sudo apt update && sudo apt install -y cpio unzip bzip2 patch perl
#
# Builds in the WSL-native filesystem (~/), NOT on /mnt/g (9p is slow + breaks
# symlinks/permissions). Only the defconfig and final artifacts cross the mount.
set -euo pipefail

# Buildroot refuses to build if $PATH contains spaces. Under WSL the Windows PATH
# (full of "Program Files"-style entries) is appended to the Linux PATH, so strip
# down to a clean Linux-only PATH for the build.
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

BR_VER="2024.02.10"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
WORK="$HOME/substrateos-image-build"
KERNEL_OUT="$REPO_ROOT/web-demo/public/kernel"

echo "==> repo:   $REPO_ROOT"
echo "==> build:  $WORK (native fs)"
echo "==> output: $KERNEL_OUT"

# Fail early with a clear message if a host tool is missing.
for t in cpio gcc make wget rsync bc perl; do
  command -v "$t" >/dev/null || { echo "MISSING host tool: $t  (run: sudo apt install -y cpio unzip bzip2 patch perl)"; exit 2; }
done

mkdir -p "$WORK"
cd "$WORK"
if [ ! -d "buildroot-$BR_VER" ]; then
  echo "==> downloading buildroot $BR_VER"
  wget -q "https://buildroot.org/downloads/buildroot-$BR_VER.tar.gz"
  tar xzf "buildroot-$BR_VER.tar.gz"
fi
cd "buildroot-$BR_VER"

cp "$REPO_ROOT/image/substrate_defconfig" configs/substrate_defconfig
make substrate_defconfig
# Point Buildroot at the post-build hook (absolute path; can't live in defconfig).
sed -i "s/\r$//" "$REPO_ROOT/image/post-build.sh" 2>/dev/null || true
echo "BR2_ROOTFS_POST_BUILD_SCRIPT=\"$REPO_ROOT/image/post-build.sh\"" >> .config
make olddefconfig
echo "==> building (this takes a while: toolchain + kernel + rootfs)"
make -j"$(nproc)"

OUT="output/images"
echo "==> artifacts:"
ls -la "$OUT"

mkdir -p "$KERNEL_OUT"
cp "$OUT/bzImage" "$KERNEL_OUT/bzImage"
cp "$OUT/rootfs.cpio.gz" "$KERNEL_OUT/rootfs.cpio.gz"
echo "==> copied bzImage + rootfs.cpio.gz -> $KERNEL_OUT"
echo "DONE"
