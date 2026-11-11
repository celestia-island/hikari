/**
 * parseGraph.ts — flowchart / graph / stateDiagram parser.
 *
 * A scanner-based TS mirror of the pest grammar in ratatui-markdown
 * (`src/mermaid/grammar.pest`):
 *
 *   file     = kw ~ sp+ ~ direction ~ sp* ~ (nl | EOI) ~ stmts
 *   stmts    = (nl* ~ stmt)+ ~ nl*  |  nl*
 *   stmt     = sp* ~ (chain | nodedef | comment)
 *   chain    = nref ~ sp* ~ edge ~ sp* ~ nref ~ (sp* ~ edge ~ sp* ~ nref)*
 *   nodedef  = nid ~ sp* ~ shape?
 *   nref     = nid ~ sp* ~ shape?
 *   nid      = (ALPHA | "_") (ALPHANUM | "_")*
 *   shape    = "((" t "))" | "[" t "]" | "(" t ")" | "{" t "}"
 *   edge     = ("-->" | "---") ~ (sp* ~ "|" t "|")?
 *   comment  = "%" ~ (!nl ~ ANY)*
 *
 * Ported rules that matter for fidelity:
 *  - the keyword AND the direction are mandatory (the Rust grammar fails
 *    the whole file without them);
 *  - a statement that fails to scan rejects the WHOLE diagram (pest has
 *    no partial-accept), the caller then falls back to the code block;
 *  - `A --> B --> C` chains fan out pairwise edges A→B, B→C;
 *  - a bare `A[text]` nodedef declares/updates the node without edges;
 *  - labels/shape text may contain anything except their closing
 *    delimiter and a newline.
 *
 * State diagrams (`stateDiagram-v2`) share the node-edge shape and are
 * parsed line-oriented the way ratatui-markdown's `parse_state_diagram`
 * does: `[*]` becomes the `__start__`/`__end__` circles, everything else
 * a rounded state node.
 */

import type { MermaidEdge, MermaidEdgeType, MermaidGraphDoc, MermaidNode, MermaidNodeShape } from "./types";

export class MermaidParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MermaidParseError";
  }
}

const NID_RE = /[A-Za-z_][A-Za-z0-9_]*/y;

interface ShapeInfo {
  shape: MermaidNodeShape;
  label: string | null;
}

interface EdgeInfo {
  edgeType: MermaidEdgeType;
  label: string | null;
}

/** Cursor over one statement line (pest scans the file linearly; the TS
 * port scans statement-by-statement, which the line-oriented grammar
 * makes equivalent). */
class LineScanner {
  pos = 0;
  constructor(readonly line: string) {}

  eof(): boolean {
    return this.pos >= this.line.length;
  }

  /** `sp*` — spaces and tabs only (newlines are handled by the caller). */
  skipSpaces(): void {
    while (this.pos < this.line.length && (this.line[this.pos] === " " || this.line[this.pos] === "\t")) {
      this.pos += 1;
    }
  }

  /** `nid` — anchored identifier; null when the cursor is not on one. */
  nid(): string | null {
    NID_RE.lastIndex = this.pos;
    const m = NID_RE.exec(this.line);
    if (!m) return null;
    this.pos = NID_RE.lastIndex;
    return m[0];
  }

  /** `shape?` — one of the four bracketed forms, when present. */
  shape(): ShapeInfo | null {
    const l = this.line;
    const at = (s: string): boolean => l.startsWith(s, this.pos);
    const closers: Array<[string, MermaidNodeShape, string]> = [
      ["((", "circle", "))"],
      ["[", "rect", "]"],
      ["(", "rounded", ")"],
      ["{", "diamond", "}"],
    ];
    for (const [open, shape, close] of closers) {
      if (!at(open)) continue;
      const end = l.indexOf(close, this.pos + open.length);
      // stxt excludes newlines by construction — the line has none.
      if (end < 0) throw new MermaidParseError(`unclosed shape bracket in "${l}"`);
      const text = l.slice(this.pos + open.length, end).trim();
      this.pos = end + close.length;
      return { shape, label: text === "" ? null : text };
    }
    return null;
  }

  /** `edge` — `-->` / `---` with the optional `|label|` suffix. */
  edge(): EdgeInfo | null {
    const l = this.line;
    let edgeType: MermaidEdgeType | null = null;
    if (l.startsWith("-->", this.pos)) {
      edgeType = "arrow";
      this.pos += 3;
    } else if (l.startsWith("---", this.pos)) {
      edgeType = "line";
      this.pos += 3;
    } else {
      return null;
    }
    let label: string | null = null;
    const save = this.pos;
    this.skipSpaces();
    if (this.pos < l.length && l[this.pos] === "|") {
      const end = l.indexOf("|", this.pos + 1);
      if (end < 0) {
        // `lbl` has no closing bar on this line → not a label; rewind so
        // the caller sees a bare edge (and fails on the junk instead of
        // silently eating it).
        this.pos = save;
      } else {
        const text = l.slice(this.pos + 1, end).trim();
        label = text === "" ? null : text;
        this.pos = end + 1;
      }
    } else {
      this.pos = save;
    }
    return { edgeType, label };
  }
}

/** `ensure_node` from types.rs — declare or refine (label/shape) a node. */
function ensureNode(
  nodes: MermaidNode[],
  map: Map<string, number>,
  id: string,
  label: string | null,
  shape: MermaidNodeShape | null,
): void {
  const idx = map.get(id);
  if (idx !== undefined) {
    if (label !== null && label !== "") nodes[idx].label = label;
    if (shape !== null) nodes[idx].shape = shape;
    return;
  }
  map.set(id, nodes.length);
  nodes.push({ id, label: label ?? id, shape: shape ?? "rect" });
}

/** Parse a `graph TD` / `flowchart LR` document. Throws MermaidParseError. */
export function parseFlowchart(source: string): MermaidGraphDoc {
  const lines = source.split(/\r\n|\n/);

  // Header: `kw sp+ direction sp* (nl | EOI)`.
  const head = lines[0] ?? "";
  const headMatch = /^(graph|flowchart)[ \t]+(TD|TB|BT|LR|RL)[ \t]*$/.exec(head);
  if (!headMatch) {
    throw new MermaidParseError(
      `expected "graph|flowchart TD|TB|BT|LR|RL" header, got ${JSON.stringify(head)}`,
    );
  }
  const direction = headMatch[2] === "TB" ? "TD" : (headMatch[2] as MermaidGraphDoc["direction"]);

  const nodes: MermaidNode[] = [];
  const edges: MermaidEdge[] = [];
  const map = new Map<string, number>();

  for (let i = 1; i < lines.length; i += 1) {
    const raw = lines[i];
    // stmt = sp* ~ stmt_inner ~ sp* ; comment = "%" ...
    const line = raw.trim();
    if (line === "" || line.startsWith("%")) continue;

    const sc = new LineScanner(line);
    sc.skipSpaces();

    // One chain/nodedef scan pass; nrefs and edges interleave.
    const refs: Array<{ id: string; label: string | null; shape: MermaidNodeShape | null }> = [];
    const edgeInfos: EdgeInfo[] = [];
    for (;;) {
      const id = sc.nid();
      if (!id) throw new MermaidParseError(`expected node id in "${line}"`);
      sc.skipSpaces();
      const shape = sc.shape();
      if (shape) sc.skipSpaces();
      refs.push({ id, label: shape?.label ?? null, shape: shape?.shape ?? null });
      const edge = sc.edge();
      if (!edge) break;
      edgeInfos.push(edge);
      sc.skipSpaces();
      if (sc.eof()) throw new MermaidParseError(`edge without a target in "${line}"`);
    }
    if (!sc.eof()) throw new MermaidParseError(`trailing junk after statement "${line}"`);

    // Register every referenced node (nodedefs and chain ends alike).
    for (const r of refs) ensureNode(nodes, map, r.id, r.label, r.shape);

    // Pairwise edges along the chain.
    for (let e = 0; e < edgeInfos.length && e + 1 < refs.length; e += 1) {
      edges.push({
        source: refs[e].id,
        target: refs[e + 1].id,
        label: edgeInfos[e].label,
        edgeType: edgeInfos[e].edgeType,
      });
    }
  }

  if (nodes.length === 0) throw new MermaidParseError("diagram has no nodes");
  return { kind: "graph", variant: "flowchart", direction, nodes, edges };
}

/** Parse a `stateDiagram-v2` document (line-oriented, per the Rust port). */
export function parseStateDiagram(source: string): MermaidGraphDoc {
  const nodes: MermaidNode[] = [];
  const edges: MermaidEdge[] = [];
  const seen = new Set<string>();

  const push = (id: string, label: string, shape: MermaidNodeShape): string => {
    if (!seen.has(id)) {
      seen.add(id);
      nodes.push({ id, label, shape });
    }
    return id;
  };

  for (const raw of source.split(/\r\n|\n/)) {
    const line = raw.trim();
    if (
      line === "" ||
      line.startsWith("stateDiagram") ||
      line.startsWith("state ") ||
      line.startsWith("note ")
    ) {
      continue;
    }

    const arrowIdx = line.indexOf("-->");
    const arrow: { pos: number; kind: MermaidEdgeType } | null =
      arrowIdx >= 0
        ? { pos: arrowIdx, kind: "arrow" }
        : (() => {
            const p = line.indexOf("---");
            return p >= 0 ? { pos: p, kind: "line" } : null;
          })();

    if (arrow) {
      const fromRaw = line.slice(0, arrow.pos).trim();
      const toRaw = line.slice(arrow.pos + 3).trim();
      if (fromRaw === "" || toRaw === "") continue;

      const from = fromRaw === "[*]"
        ? push("__start__", "●", "circle")
        : push(fromRaw, fromRaw, "rounded");
      const to = toRaw === "[*]" ? push("__end__", "●", "circle") : push(toRaw, toRaw, "rounded");
      edges.push({ source: from, target: to, label: null, edgeType: arrow.kind });
      continue;
    }

    // NOTE: `state "Label" as ID` and `state ID` lines are SKIPPED, not
    // parsed — the Rust reference skips every "state " line the same way
    // (states materialize from transition lines instead).
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(line)) {
      push(line, line, "rounded");
    }
  }

  if (nodes.length === 0) throw new MermaidParseError("state diagram has no states");
  return { kind: "graph", variant: "state", direction: "TD", nodes, edges };
}
