// wasmHighlight.ts — the wasm-backed syntax highlighting engine.
//
// Wraps hikari-wasm-highlight (the pest-driven Rust component) and
// produces hljs-compatible HTML. Unsupported languages return null
// (callers render escaped plain text).

import { highlight as wasmHighlightFn, languages as wasmLanguages } from "../wasm/highlight/hikari_wasm_highlight.js";

export type HighlightResult = string | null;

/** The set of languages the wasm component currently supports. */
export function wasmSupportedLanguages(): Set<string> {
  return new Set(wasmLanguages());
}

/** Highlight through the wasm component; null when unsupported. */
export function wasmHighlight(code: string, language: string): HighlightResult {
  const result = wasmHighlightFn(code, language);
  return result?.html ?? null;
}
