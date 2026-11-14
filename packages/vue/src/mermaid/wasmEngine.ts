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

import { parse } from "../wasm/mermaid/hikari_wasm_mermaid.js";

/** Check whether the wasm component handles this diagram type. */
function wasmHandles(source: string): boolean {
  // Second wave: graph/flowchart + pie/gantt/sequence.
  return /^\s*(graph|flowchart|pie|gantt|sequenceDiagram|classDiagram|quadrantChart)\b/i.test(source);
}

export const wasmMermaidEngine: MermaidParserEngine = {
  parse(source: string): MermaidDoc | null {
    // State diagrams parse into the same graph shape; the pest grammar
    // only speaks "graph"/"flowchart", so rewrite the keyword.
    const normalized = /^\s*stateDiagram/i.test(source)
      ? source
          .replace(/^\s*stateDiagram(-v\d+)?/, "graph TD")
          .replace(/\[\*\]/g, "STATE_START_END")
          // State transition labels: `A --> B : label` → `A -->|label| B`
          .replace(/^(\s*)(\S+)\s+(-->|--)\s+(\S+)\s*:\s*(.+)$/gm, "$1$2 $3|$5| $4")
      : source;
    if (wasmHandles(normalized)) {
      const result = parse(normalized);
      if (result.json) {
        try {
          return JSON.parse(result.json) as MermaidDoc;
        } catch {
          return null;
        }
      }
      return null;
    }
    // Wasm didn't recognize the diagram — return null (callers render
    // the source as a plain code block).
    return null;
  },
};
