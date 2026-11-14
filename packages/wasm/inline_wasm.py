#!/usr/bin/env python3
"""Post-process jco output: inline the main .core.wasm as base64.

jco's --base64-cutoff only inlines the WASI shim modules; the main
component wasm still references a file URL which fails in happy-dom
test environments. This script replaces the fetchCompile(new URL(...))
call with base64Compile(...) for the main module, making the entire
component self-contained in a single .js file.
"""
import base64
import pathlib
import re
import sys

def process(js_path: pathlib.Path) -> None:
    wasm_path = js_path.parent / (js_path.stem + ".core.wasm")
    if not wasm_path.exists():
        print(f"  no .core.wasm to inline for {js_path.name}")
        return
    s = js_path.read_text(encoding="utf-8")
    b64 = base64.b64encode(wasm_path.read_bytes()).decode("ascii")
    # Replace: fetchCompile(_jcoFetchCompileContext, new URL("./x.core.wasm", import.meta.url))
    # With:    base64Compile(_jcoBase64CompileContext, "<b64>")
    pattern = rf'fetchCompile\(_jcoFetchCompileContext,\s*new URL\("\./{re.escape(wasm_path.name)}",\s*import\.meta\.url\)\)'
    replacement = f'base64Compile(_jcoBase64CompileContext, "{b64}")'
    s2 = re.sub(pattern, replacement, s)
    if s2 == s:
        print(f"  WARNING: no fetchCompile pattern found in {js_path.name}")
        return
    js_path.write_text(s2, encoding="utf-8")
    wasm_path.unlink()
    print(f"  inlined {wasm_path.name} ({wasm_path.stat().st_size // 1024 if wasm_path.exists() else len(b64) // 1024}KB b64) into {js_path.name}")

if __name__ == "__main__":
    for path in sys.argv[1:]:
        process(pathlib.Path(path))
