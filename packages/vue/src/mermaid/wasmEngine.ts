// wasmEngine.ts — the first-party mermaid parser engine backed by the
// hikari-wasm-mermaid component (Rust, pest-driven, the semantic reference
// hikari's TS port was a mirror of), loaded through the tairitsu host client
// (stage 3).
//
// The wasm component's parse() returns a `parse-result` **record** — its `json`
// field carries the JSON-serialized MermaidDiagram, or is absent when the
// component could not recognize the diagram. (The QR component instead returns a
// `result<T, E>`, so its adapter unwraps by throwing; this one unwraps by
// reading the optional field.) This engine deserializes the JSON back into the
// TS MermaidDoc shape.
//
// The facade is SYNCHRONOUS (user ruling: callers do not change). The host
// client's synchronous door (`createSurface`) is what makes that possible. The
// wrapper is loaded with a DYNAMIC import so a broken artifact degrades this
// engine instead of aborting the module graph that hosts it: a static import is
// evaluated before this file's body runs, so no `try` here could ever catch its
// failure and the whole page went blank (#1498).
import { MERMAID_CAPABILITIES, MERMAID_DECLARATION_PUBLISHED } from "./declare-caps";
import {
  createSurface,
  HostClientError,
  type HostComponent,
} from "@celestia-island/tairitsu-host-client";

import type { MermaidDoc } from "./types";
import type { MermaidParserEngine } from "./engine";

/** The component's `celestia:hikari-mermaid/types` `parse-result` record. */
export interface MermaidParseResult {
  /** JSON-serialized MermaidDiagram; absent when unrecognized. */
  json?: string;
}

/** Thrown when `parse` is called before the component is usable. */
export class MermaidNotReadyError extends Error {
  constructor(cause?: unknown) {
    super(
      "the Mermaid component is not loaded; await mermaidReady (or render again once it resolves)",
      { cause },
    );
    this.name = "MermaidNotReadyError";
  }
}

let surface: HostComponent | undefined;
let loadFailure: MermaidNotReadyError | undefined;
let loadPromise: Promise<void> | undefined;

/** Start loading; cached so every caller shares one attempt. */
function ensureLoadedOnce(): Promise<void> {
  if (!loadPromise) {
    loadPromise = import("../wasm/mermaid/hikari_wasm_mermaid.js")
      .then((wrapper) =>
        createSurface(
          wrapper as unknown as Record<string, unknown>,
          // Hand the declaration to the door, don't just publish it: with the
          // parameter omitted it defaults to `{}`, so the door's own refusal
          // (`sync-door-cannot-provide`) can never fire and a wrong declaration
          // would pass unnoticed. Passing it makes the declaration checkable.
          MERMAID_CAPABILITIES,
        ),
      )
      .then((built) => {
        surface = built;
      })
      .catch((error: unknown) => {
        // Kept as the component's own error type so a caller can recognise it,
        // and re-thrown so the ready promise REJECTS: resolving here would tell
        // a waiting host the component is usable when it is not (measured — the
        // facade stayed silent and every later call returned nothing).
        loadFailure = new MermaidNotReadyError(error);
        throw loadFailure;
      });
  }
  return loadPromise;
}

/** Resolves once the component is usable; rejects if it could not be built. */
export const mermaidReady: Promise<void> = ensureLoadedOnce().then(() => {
  if (!surface) throw loadFailure ?? new MermaidNotReadyError();
});

/** Keeps the declaration module live for bundlers that honour `sideEffects`. */
export const mermaidCapabilities = MERMAID_CAPABILITIES;
void MERMAID_DECLARATION_PUBLISHED;

mermaidReady.catch(() => {
  // Consumed by callers that care; a rejected module-level promise nobody
  // handles would be an unhandled rejection.
});

/** Check whether the wasm component handles this diagram type. */
function wasmHandles(source: string): boolean {
  // Second wave: graph/flowchart + pie/gantt/sequence.
  return /^\s*(graph|flowchart|pie|gantt|sequenceDiagram|classDiagram|quadrantChart)\b/i.test(source);
}

export const wasmMermaidEngine: MermaidParserEngine = {
  parse(source: string): MermaidDoc | null {
    if (!surface) throw loadFailure ?? new MermaidNotReadyError();
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
      // The record (not a result): an absent `json` means "not recognized".
      const result = surface.call<MermaidParseResult | undefined>("parse", normalized);
      const json = result?.json;
      if (json) {
        try {
          return JSON.parse(json) as MermaidDoc;
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

export { HostClientError };
