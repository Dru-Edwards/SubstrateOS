#!/bin/sh
# Buildroot post-build hook ($1 = target rootfs dir).
# Lab-appliance tweak: auto-login root on the serial console so a cold boot lands
# directly at a usable shell (no login prompt) — networking is brought up by
# BR2_SYSTEM_DHCP at boot. Replaces the getty line rather than overlaying the
# whole inittab (lower risk — leaves all sysinit lines intact).
set -e
TARGET="$1"
if [ -f "$TARGET/etc/inittab" ]; then
  sed -i 's|^ttyS0::respawn:.*|ttyS0::respawn:-/bin/sh|' "$TARGET/etc/inittab"
fi
