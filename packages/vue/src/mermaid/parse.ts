/**
 * parse.ts — entry dispatch, mirroring ratatui-markdown's `render_mermaid`
 * first-line switch: the diagram type is decided by the FIRST
 * non-empty line's leading keyword, and each parser owns its own
 * acceptance/rejection. Any parser error propagates as
 * MermaidParseError so callers can fall back to the plain code block.
 *
 * Documented deviation: leading `%%` / blank lines are skipped here,
 * while the Rust switch reads the literal first line (a `%%`-led doc
 * falls back there). Deliberate — meta comments before the diagram are
 * common in agent output and every branch's own header check still
 * gates the content.
 */

import type { MermaidDoc } from "./types";
import { MermaidParseError, parseFlowchart, parseStateDiagram } from "./parseGraph";
import { parseSequence } from "./parseSequence";
import { parsePie } from "./parsePie";
import { parseGantt } from "./parseGantt";
import { parseClassDiagram } from "./parseClass";
import { parseQuadrant } from "./parseQuadrant";

export { MermaidParseError };

/** The first line that is neither blank nor a `%%` meta comment. */
function headLine(source: string): string {
  for (const raw of source.split(/\r\n|\n/)) {
    const line = raw.trim();
    if (line === "" || line.startsWith("%%")) continue;
    return line;
  }
  return "";
}

export function parseMermaid(source: string): MermaidDoc {
  const head = headLine(source);

  // The grammar's `sp` is space OR tab — headers separated by tabs are
  // valid mermaid and must not fall back (same rule as the flowchart
  // header regex in parseGraph).
  const graphHead = /^(graph|flowchart)[ \t]/.test(head);
  if (graphHead) return parseFlowchart(source);
  if (head.startsWith("stateDiagram")) return parseStateDiagram(source);
  if (head.startsWith("sequenceDiagram")) return parseSequence(source);
  if (head.startsWith("classDiagram")) return parseClassDiagram(source);
  if (head.startsWith("pie")) return parsePie(source);
  if (head === "gantt" || head.startsWith("gantt ")) return parseGantt(source);
  if (head.startsWith("quadrantChart")) return parseQuadrant(source);

  throw new MermaidParseError(`unsupported mermaid diagram type: ${JSON.stringify(head)}`);
}
