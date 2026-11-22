#!/usr/bin/env python3
"""Build the hikari wasm components and generate JS bindings.

For each component under packages/wasm/:
  1. cargo build --target wasm32-wasip2 --release
  2. jco transpile → JS bindings
  3. copy bindings into packages/vue/src/wasm/ (consumed by the Vue layer)

Usage: python3 packages/wasm/build.py [component ...]
"""
import pathlib
import shutil
import subprocess
import sys

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent.parent
VUE_DST = ROOT / "packages" / "vue" / "src" / "wasm"


def main() -> int:
    comps = sys.argv[1:] or [d.name for d in HERE.iterdir() if (d / "Cargo.toml").exists()]
    for comp in comps:
        crate_dir = HERE / comp
        if not (crate_dir / "Cargo.toml").exists():
            print(f"skip {comp} (no Cargo.toml)")
            continue
        crate_name = comp.replace("-", "_")
        print(f"── building {comp}...")
        subprocess.run(
            ["cargo", "build", "--target", "wasm32-wasip2", "--release",
             "-p", f"hikari-wasm-{comp}"],
            cwd=ROOT, check=True,
        )
        wasm = ROOT / "target" / "wasm32-wasip2" / "release" / f"hikari_wasm_{crate_name}.wasm"
        if not wasm.exists():
            print(f"ERROR: no wasm for {comp} at {wasm}")
            return 1
        out = VUE_DST / comp
        if out.exists():
            shutil.rmtree(out)
        out.mkdir(parents=True)
        # `--base64-cutoff`: inline the core wasm into the JS instead of
        # emitting a sibling `.core.wasm`. The Vue package ships these files
        # verbatim and its test environments resolve them as modules, not as
        # fetchable assets — without inlining, every consumer would need a
        # `.core.wasm` fetch that vitest/jsdom cannot satisfy (measured: the
        # whole component suite failed with `The URL must be of scheme file`).
        # 1 GiB inlines every core module this suite emits (the largest is well
        # under 10 MB). Do NOT "simplify" this to `1 << 40`: jco accepts the
        # value and silently falls back to external `.core.wasm` fetches for it.
        # The boundary is unsigned 2^32 — measured: 4294967295 inlines,
        # 4294967296 emits three core files, both with rc=0 and no warning.
        # That silent fallback is exactly how the first regeneration broke
        # every component test.
        subprocess.run(
            ["jco", "transpile", str(wasm), "-o", str(out),
             "--base64-cutoff", "1073741824"],
            check=True,
        )
        size = sum(f.stat().st_size for f in out.rglob("*") if f.is_file())
        print(f"── {comp} → {out} ({size // 1024}KB)")
    print("done")
    return 0


if __name__ == "__main__":
    sys.exit(main())
