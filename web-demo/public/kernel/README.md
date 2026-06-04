# web-demo/public/kernel — v86 engine + Linux image

These files are **git-ignored** (large binaries). Vite serves this directory at `/kernel/`.
`KernelSession` (in `@substrateos/runtime`) loads them at boot when the app runs with `?engine=kernel`.

## Required files

| File | Source |
|---|---|
| `v86.wasm`, `libv86.js` | v86 prebuilt (`cdn.jsdelivr.net/npm/v86/build/`) |
| `seabios.bin`, `vgabios.bin` | v86 prebuilt (`cdn.jsdelivr.net/npm/v86/bios/`) |
| `substrate.iso` | **dev:** copy of the Phase-0 image (`web-demo/spike/assets/linux.iso`, kernel 2.6 — for wiring only). **product:** modern Buildroot 6.6 image from `image/build.sh` (Task 7). |

## Populate locally (dev image, for Tasks 5–6)

```bash
# from repo root
cp web-demo/spike/assets/{v86.wasm,libv86.js,seabios.bin,vgabios.bin} web-demo/public/kernel/
cp web-demo/spike/assets/linux.iso web-demo/public/kernel/substrate.iso
```

For the modern product image, run `bash image/build.sh` (Task 7) which writes `substrate.iso` here.
