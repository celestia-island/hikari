// wasm syntax highlighting — single source of truth, lazily loaded.
//
// The pest-driven Rust wasm component (hikari-wasm-highlight) handles
// all supported languages. The 2.9MB component is code-split by Vite
// via dynamic import() — it loads on the first highlight() call, not
// at bundle initialization. Until loaded, code renders as plain text
// (same UX as the old hljs lazy loading, but with a single Rust wasm
// module instead of 85 JS grammar chunks).

import { ref } from "vue";

type WasmHighlightFn = (code: string, language: string) => string | null;

// Module-level state: the loaded wasm function (null until loaded).
let wasmFn: WasmHighlightFn | null = null;
let loadPromise: Promise<WasmHighlightFn> | null = null;

// Reactive version — bumped when the module finishes loading so
// computed/render effects re-run and replace plain text with color.
const version = ref(0);

/** Load the wasm module on first use; cached thereafter. */
function ensureLoaded(): Promise<WasmHighlightFn> {
  if (wasmFn) return Promise.resolve(wasmFn);
  if (!loadPromise) {
    loadPromise = import("../wasm/highlight/hikari_wasm_highlight.js")
      .then((mod) => {
        wasmFn = mod.highlight as WasmHighlightFn;
        version.value += 1;
        return wasmFn;
      })
      .catch(() => {
        // Module failed to load — stay plaintext forever.
        loadPromise = null;
        return null as unknown as WasmHighlightFn;
      });
  }
  return loadPromise;
}

/** Common aliases → canonical language ids. */
const ALIASES: Record<string, string> = {
  ts: "typescript", tsx: "typescript", mts: "typescript", cts: "typescript",
  js: "javascript", jsx: "javascript", mjs: "javascript", cjs: "javascript",
  py: "python", python3: "python", ipython: "python",
  sh: "bash", shell: "bash", zsh: "bash", fish: "bash",
  yml: "yaml",
  md: "markdown",
  rs: "rust", golang: "go",
  html: "xml", htm: "xml", svg: "xml", xhtml: "xml", vue: "xml",
  cs: "csharp",
  kt: "kotlin",
  rb: "ruby", pl: "perl",
  ps1: "powershell",
  plaintext: "plaintext", text: "plaintext", txt: "plaintext", log: "plaintext",
};

function normalize(lang: string): string {
  const l = lang.trim().toLowerCase().replace(/^\./, "");
  return ALIASES[l] ?? l;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Highlight `code` in `lang`; plain text until the wasm module loads. */
export function highlight(code: string, lang?: string): string {
  // Establish reactivity — re-runs when the module finishes loading.
  void version.value;

  const name = lang ? normalize(lang) : "";
  if (name && wasmFn) {
    const result = wasmFn(code, name);
    if (result !== null) return result;
  }
  // Trigger the lazy load (first call only); render plain text for now.
  if (!wasmFn && !loadPromise) {
    void ensureLoaded();
  }
  return escapeHtml(code);
}

/** Path-based language detection (file extension → language id). */
export function languageForPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return ALIASES[ext] ?? ext;
}

export function useHighlight() {
  return { highlight, version };
}
