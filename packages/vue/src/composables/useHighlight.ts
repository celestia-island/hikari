// wasm syntax highlighting — single source of truth.
//
// The pest-driven Rust wasm component (hikari-wasm-highlight) handles
// all supported languages synchronously; unsupported languages render
// as plain text. No lazy loading, no hljs fallback, no flash of
// unstyled code.

import { wasmHighlight } from "./wasmHighlight";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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
  cs: "csharp", fs: "fsharp",
  kt: "kotlin",
  rb: "ruby", pl: "perl",
  ps1: "powershell",
  plaintext: "plaintext", text: "plaintext", txt: "plaintext", log: "plaintext",
};

function normalize(lang: string): string {
  const l = lang.trim().toLowerCase().replace(/^\./, "");
  return ALIASES[l] ?? l;
}

/** Highlight `code` in `lang`; unsupported languages render as plain text. */
export function highlight(code: string, lang?: string): string {
  const name = lang ? normalize(lang) : "";
  if (name) {
    const result = wasmHighlight(code, name);
    if (result !== null) return result;
  }
  return escapeHtml(code);
}

/** Path-based language detection (file extension → language id). */
export function languageForPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return ALIASES[ext] ?? ext;
}

export function useHighlight() {
  return { highlight };
}
