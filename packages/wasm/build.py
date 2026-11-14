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
        subprocess.run(["jco", "transpile", str(wasm), "-o", str(out)], check=True)
        size = sum(f.stat().st_size for f in out.rglob("*") if f.is_file())
        print(f"── {comp} → {out} ({size // 1024}KB)")
    print("done")
    return 0


if __name__ == "__main__":
    sys.exit(main())
