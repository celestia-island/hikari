/**
 * index.ts — the `@celestia-island/hikari/mermaid` subpath.
 *
 * The first-party mermaid parser engine (pest-semantics TS port of the
 * family's ratatui-markdown grammar). Hosts import THIS subpath and
 * register the engine on the global the components probe:
 *
 *   import { mermaidParser } from "@celestia-island/hikari/mermaid";
 *   (globalThis as Record<string, unknown>).hkMermaidParser = mermaidParser;
 *
 * Kept OUT of the component import graph on purpose: a bundle that never
 * registers the engine never pays for the parser (the same economy the
 * hljs convention gives syntax highlighting).
 */

import type { MermaidDoc } from "./types";
import type { MermaidParserEngine } from "./engine";
import { MermaidParseError, parseMermaid } from "./parse";

export { MermaidParseError, parseMermaid };
export { wasmMermaidEngine } from "./wasmEngine";
export type {
  MermaidDoc,
  MermaidGraphDoc,
  MermaidSequenceDoc,
  MermaidClassDoc,
  MermaidGanttDoc,
  MermaidPieDoc,
  MermaidQuadrantDoc,
  MermaidDirection,
  MermaidEdge,
  MermaidEdgeType,
  MermaidNode,
  MermaidNodeShape,
  SequenceMessage,
  SeqArrowKind,
  ClassDefinition,
  ClassMember,
  ClassRelationship,
  ClassRelationshipType,
  ClassVisibility,
  GanttSection,
  GanttTask,
  QuadrantPoint,
} from "./types";
export type { MermaidParserEngine } from "./engine";

/** The engine a host registers on `globalThis.hkMermaidParser`. */
export const mermaidParser: MermaidParserEngine = {
  parse(source: string): MermaidDoc | null {
    try {
      return parseMermaid(source);
    } catch {
      return null;
    }
  },
};
