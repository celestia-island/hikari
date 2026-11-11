/**
 * engine.ts — the host-engine discovery contract (the hljs convention,
 * applied to mermaid parsing).
 *
 * hikari components never bundle the mermaid parser: a host that wants
 * diagram rendering installs an engine on `globalThis.hkMermaidParser`
 * (exactly how hosts install `globalThis.hljs` for syntax highlighting).
 * The convention is not reactive — register at boot, before the first
 * markdown body renders (chest wires it in main.ts next to the hljs
 * lines).
 *
 * hikari ships a first-party engine (the pest-semantics TS port behind
 * the `@celestia-island/hikari/mermaid` subpath) a host may register;
 * a future wasm build of the Rust parser can take its place without a
 * single component change.
 */

import type { MermaidDoc } from "./types";
import { asIndexable } from "../utils/typing";

export interface MermaidParserEngine {
  /** Parse mermaid source; null/throw on failure (callers fall back to
   * the plain code block either way). */
  parse(source: string): MermaidDoc | null;
}

export const MERMAID_ENGINE_GLOBAL = "hkMermaidParser";

/** The engine probe used by HkMermaidDiagram / HkMarkdownRenderer. */
export function getMermaidEngine(): MermaidParserEngine | null {
  const engine = asIndexable(globalThis)[MERMAID_ENGINE_GLOBAL] as Partial<MermaidParserEngine> | undefined;
  return engine && typeof engine.parse === "function" ? (engine as MermaidParserEngine) : null;
}

/** Test seam: set/clear the global the way a host would. */
export function setMermaidEngineForTests(engine: MermaidParserEngine | null): void {
  const g = asIndexable(globalThis);
  if (engine) g[MERMAID_ENGINE_GLOBAL] = engine;
  else delete g[MERMAID_ENGINE_GLOBAL];
}
