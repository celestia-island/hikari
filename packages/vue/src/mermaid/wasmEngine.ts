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
        // Clear the cached attempt so the next call retries, matching
        // `useHighlight`: a transient failure (a 404, a dropped connection)
        // otherwise degrades this component for the rest of the session.
        loadPromise = undefined;
        throw loadFailure;
      });
  }
  return loadPromise;
}

/** Resolves once the component is usable; rejects if it could not be built. */
export function whenMermaidReady(): Promise<void> {
  const attempt = ensureLoadedOnce().then(() => {
    if (!surface) throw loadFailure ?? new MermaidNotReadyError();
  });
  // Mark it handled. A caller that awaits sees the rejection; a caller that
  // only *triggers* a retry (the entry point firing `ensureLoadedOnce` on the
  // way to its own throw) must not leave a rejection nobody owns — measured: two
  // retries from a failing load surfaced as two unhandled rejections.
  attempt.catch(() => {});
  return attempt;
}

/** Snapshot of the first attempt, kept for callers that only want a value. */
export const mermaidReady: Promise<void> = whenMermaidReady();

/** Keeps the declaration module live for bundlers that honour `sideEffects`. */
export const mermaidCapabilities = MERMAID_CAPABILITIES;
void MERMAID_DECLARATION_PUBLISHED;

mermaidReady.catch(() => {
  // Consumed by callers that care; a rejected module-level promise nobody
  // handles would be an unhandled rejection.
});

/**
 * Rewrite a `stateDiagram` into the flowchart grammar the pest parser speaks.
 *
 * Two rewrites carry real semantics:
 *
 *  - `[*]` is TWO different pseudostates — the initial marker and the final
 *    marker. The old blanket replace mapped both to one literal node, so a
 *    diagram read `… --> STATE_START_END` at the top AND at the bottom and the
 *    layout merged them into a single labelled box between the two (the audit
 *    recorded it as "«[*]» start and end collapse into one frame"). They now
 *    get distinct ids AND a circle shape with an empty label, which is what
 *    mermaid draws;
 *  - `A --> B : label` becomes `A -->|label| B` (the flowchart's caption form),
 *    which is the only shape the grammar can carry.
 */
export function normalizeStateDiagram(source: string): string {
  const out: string[] = [];
  // Scope depth is what gives each pseudostate its OWN node: `[*]` is the
  // initial marker of ITS container, so a composite's `[*]` must not merge
  // with the top-level one (merging is the defect this rewrite exists to
  // remove, and it reappears one level down if the id is global).
  let depth = 0;
  for (const raw of source.split("\n")) {
    const line = raw.replace(/^\s*stateDiagram(-v\d+)?/, "graph TD");

    // Composite state header → a cluster: `state Working {` becomes
    // `subgraph Working["Working"]`, so the frame is drawn and edges into the
    // composite land on it.
    const composite = /^(\s*)state\s+([A-Za-z0-9_]+)\s*\{\s*$/.exec(line);
    if (composite) {
      depth += 1;
      out.push(`${composite[1]}subgraph ${composite[2]}["${composite[2]}"]`);
      continue;
    }
    // A statement-level `}` closes the composite (or the diagram body).
    if (/^\s*\}\s*$/.test(line)) {
      depth = Math.max(0, depth - 1);
      out.push(line.replace("}", "end"));
      continue;
    }

    const scope = depth > 0 ? `_${depth}` : "";
    const START = `__hk_state_start${scope}`;
    const END = `__hk_state_end${scope}`;
    const rewritten = line
      // `[*] --> X` is the initial marker; `X --> [*]` is the final one.
      // Both directions are handled before any leftover `[*]` so a line with
      // one on each side still yields two distinct pseudostates.
      .replace(/\[\*\](\s*(?:-->|--)\s*)/g, `${START}((""))$1`)
      .replace(/((?:-->|--)\s*)\[\*\]/g, `$1${END}((""))`)
      .replace(/\[\*\]/g, `${START}((""))`)
      // State transition labels: `A --> B : label` → `A -->|label| B`
      .replace(/^(\s*)(\S+)\s+(-->|--)\s+(\S+)\s*:\s*(.+)$/, "$1$2 $3|$5| $4");
    out.push(rewritten);
  }
  return out.join("\n");
}

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
    const normalized = /^\s*stateDiagram/i.test(source) ? normalizeStateDiagram(source) : source;
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
