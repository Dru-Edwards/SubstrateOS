# web-demo/public/kernel — v86 engine + Linux image

These files are **git-ignored** (large binaries). Vite serves this directory at `/kernel/`.
`KernelSession` (in `@substrateos/runtime`) loads them at boot when the app runs with `?engine=kernel`.

## Required files

| File | Source |
|---|---|
| `v86.wasm`, `libv86.js` | v86 prebuilt (`cdn.jsdelivr.net/npm/v86/build/`) |
| `seabios.bin`, `vgabios.bin` | v86 prebuilt (`cdn.jsdelivr.net/npm/v86/bios/`) |
| `bzImage` | modern Linux 6.6 kernel — built by `image/build.sh` |
| `rootfs.cpio.gz` | gzip'd initramfs — built by `image/build.sh` |

`KernelSession` boots `bzImage` + `rootfs.cpio.gz` (initramfs) with `cmdline: console=ttyS0`.
(`substrate.iso` was the Phase-0 dev image and is no longer used.)

## Populate locally

```bash
# v86 engine + bios (from repo root)
cp web-demo/spike/assets/{v86.wasm,libv86.js,seabios.bin,vgabios.bin} web-demo/public/kernel/
# modern kernel + initramfs (Ubuntu WSL; deps: cpio unzip bzip2 patch perl)
bash image/build.sh
```

`image/build.sh` builds Buildroot 6.6 in the WSL-native filesystem and copies
`bzImage` + `rootfs.cpio.gz` into this directory.
