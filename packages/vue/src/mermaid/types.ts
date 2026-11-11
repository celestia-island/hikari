/**
 * types.ts — the Mermaid AST contract shared by every parser and the
 * board renderer.
 *
 * This is a faithful TS mirror of `ratatui-markdown`'s `mermaid/types.rs`
 * (the family's pest-driven Rust parser, v0.3.6). The Rust side stays the
 * semantic reference: when a syntax question arises, ratatui-markdown's
 * grammar wins, and the golden fixtures in `__tests__/hkMermaidParse.test.ts`
 * exist to keep the two implementations honest.
 *
 * Framework-free on purpose: no Vue imports, safe in pure computation
 * modules (same rule as components/nodeCanvasTypes.ts).
 */

// ── Shared primitives ────────────────────────────────────────────────

/** Flow direction of a node-edge diagram. */
export type MermaidDirection = "TD" | "BT" | "LR" | "RL";

/** Node border shape (the four shapes the family grammar supports). */
export type MermaidNodeShape = "rect" | "rounded" | "diamond" | "circle";

export interface MermaidNode {
  id: string;
  label: string;
  shape: MermaidNodeShape;
}

/** `-->` (arrow) or `---` (plain line). */
export type MermaidEdgeType = "arrow" | "line";

export interface MermaidEdge {
  source: string;
  target: string;
  label: string | null;
  edgeType: MermaidEdgeType;
}

// ── Flowchart & state (both lay out as node-edge graphs) ─────────────

export interface MermaidGraphDoc {
  kind: "graph";
  /** `state` diagrams parse into the same shape; the flag only tunes
   * defaults (start/end circles), never the layout math. */
  variant: "flowchart" | "state";
  direction: MermaidDirection;
  nodes: MermaidNode[];
  edges: MermaidEdge[];
}

// ── Sequence ─────────────────────────────────────────────────────────

export type SeqArrowKind = "solid" | "dotted" | "solid-open" | "dotted-open";

export interface SequenceMessage {
  from: string;
  to: string;
  text: string;
  arrowKind: SeqArrowKind;
}

export interface MermaidSequenceDoc {
  kind: "sequence";
  participants: string[];
  messages: SequenceMessage[];
}

// ── Class ────────────────────────────────────────────────────────────

export type ClassVisibility = "public" | "private" | "protected" | "internal";

export interface ClassMember {
  visibility: ClassVisibility;
  name: string;
  typeInfo: string;
  isMethod: boolean;
}

export interface ClassDefinition {
  name: string;
  attributes: ClassMember[];
  methods: ClassMember[];
}

export type ClassRelationshipType =
  | "inheritance"
  | "composition"
  | "aggregation"
  | "implements"
  | "dependency"
  | "directed-association"
  | "association";

export interface ClassRelationship {
  from: string;
  to: string;
  relType: ClassRelationshipType;
  label: string | null;
}

export interface MermaidClassDoc {
  kind: "class";
  classes: ClassDefinition[];
  relationships: ClassRelationship[];
}

// ── Gantt ────────────────────────────────────────────────────────────

export interface GanttTask {
  name: string;
  id: string | null;
  deps: string[];
  duration: string | null;
}

export interface GanttSection {
  name: string;
  tasks: GanttTask[];
}

export interface MermaidGanttDoc {
  kind: "gantt";
  title: string | null;
  sections: GanttSection[];
}

// ── Pie ──────────────────────────────────────────────────────────────

export interface MermaidPieDoc {
  kind: "pie";
  title: string | null;
  slices: Array<{ label: string; value: number }>;
}

// ── Quadrant ─────────────────────────────────────────────────────────

export interface QuadrantPoint {
  label: string;
  x: number;
  y: number;
}

export interface MermaidQuadrantDoc {
  kind: "quadrant";
  title: string | null;
  xAxisLeft: string;
  xAxisRight: string;
  yAxisBottom: string;
  yAxisTop: string;
  /** Quadrant captions, index 0..3 = Q1..Q4 (may be null). */
  quadrants: Array<string | null>;
  points: QuadrantPoint[];
}

// ── Union ────────────────────────────────────────────────────────────

export type MermaidDoc =
  | MermaidGraphDoc
  | MermaidSequenceDoc
  | MermaidClassDoc
  | MermaidGanttDoc
  | MermaidPieDoc
  | MermaidQuadrantDoc;
