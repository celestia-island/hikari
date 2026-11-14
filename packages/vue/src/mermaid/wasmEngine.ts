// wasmEngine.ts — the first-party mermaid parser engine backed by the
// hikari-wasm-mermaid component (Rust, pest-driven, the semantic reference
// hikari's TS port was a mirror of).
//
// The wasm component's parse() returns the JSON-serialized MermaidDiagram;
// this engine deserializes it back into the TS MermaidDoc shape. When the
// component supports only the graph subset (this first wave), the TS
// fallback parser handles the remaining diagram types — the dispatch is
// invisible to callers.

import type { MermaidDoc } from "./types";
import type { MermaidParserEngine } from "./engine";
import { parseMermaid } from "./parse";
import { parse } from "../wasm/mermaid/hikari_wasm_mermaid.js";

/** Check whether the wasm component handles this diagram type. */
function wasmHandles(source: string): boolean {
  // First wave: graph/flowchart only.
  return /^\s*(graph|flowchart)\b/i.test(source);
}

export const wasmMermaidEngine: MermaidParserEngine = {
  parse(source: string): MermaidDoc | null {
    if (wasmHandles(source)) {
      const result = parse(source);
      if (result.json) {
        try {
          return JSON.parse(result.json) as MermaidDoc;
        } catch {
          return null;
        }
      }
      return null;
    }
    // Fall back to the TS parser for diagram types the wasm component
    // does not cover yet (sequence/class/gantt/pie/quadrant).
    try {
      return parseMermaid(source);
    } catch {
      return null;
    }
  },
};
