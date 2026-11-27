/**
 * hkMermaidParse.test.ts — wasm engine behavior tests.
 *
 * The TS parsers were the original reference; the Rust wasm component
 * IS the reference now. These tests validate the wasm engine's key
 * observable behaviors; the golden snapshot tests (__golden.test.ts)
 * pin the full output for regression detection.
 */

import { describe, expect, it } from "vitest";

import type { MermaidDoc, MermaidGraphDoc, MermaidSequenceDoc } from "../../mermaid/types";
import { wasmMermaidEngine, mermaidReady } from "../../mermaid/wasmEngine";

function mustParse(src: string): MermaidDoc {
  const doc = wasmMermaidEngine.parse(src);
  if (!doc) throw new Error(`unexpected null: ${src.split("\n")[0]}`);
  return doc;
}

describe("parseFlowchart", () => {
  it("parses direction, nodes and edges", async () => {
    await mermaidReady;
    const doc = mustParse("graph TD\n  A --> B\n  B --> C");
    expect(doc.kind).toBe("graph");
    if (doc.kind === "graph") {
      expect(doc.direction).toBe("TD");
      expect(doc.nodes.map((n) => n.id)).toEqual(["A", "B", "C"]);
      expect(doc.edges).toHaveLength(2);
    }
  });

  it("parses node shapes", async () => {
    await mermaidReady;
    const doc = mustParse("flowchart LR\n  S[Start] --> D{Check}");
    if (doc.kind === "graph") {
      expect(doc.nodes.map((n) => n.shape)).toContain("rect");
      expect(doc.nodes.map((n) => n.shape)).toContain("diamond");
    }
  });

  it("parses edge labels", async () => {
    await mermaidReady;
    const doc = mustParse("graph TD\n  A -->|yes| B");
    if (doc.kind === "graph") {
      expect(doc.edges[0]?.label).toBe("yes");
    }
  });

  it("rejects non-diagram input", async () => {
    await mermaidReady;
    expect(wasmMermaidEngine.parse("this is not a diagram")).toBeNull();
  });
});

describe("parseSequence", () => {
  it("declares participants and messages", async () => {
    await mermaidReady;
    const doc = mustParse("sequenceDiagram\n  Alice->>Bob: Hello\n  Bob-->>Alice: Hi");
    expect(doc.kind).toBe("sequence");
    if (doc.kind === "sequence") {
      expect(doc.participants).toContain("Alice");
      expect(doc.participants).toContain("Bob");
      expect(doc.messages).toHaveLength(2);
      expect(doc.messages[0]?.arrowKind).toBe("solid-open");
      expect(doc.messages[1]?.arrowKind).toBe("dotted-open");
    }
  });

  it("longer arrow tokens win", async () => {
    await mermaidReady;
    const doc = mustParse("sequenceDiagram\nA -->> B: x");
    if (doc.kind === "sequence") {
      expect(doc.messages[0]?.arrowKind).toBe("dotted-open");
    }
  });
});

describe("parsePie", () => {
  it("parses title and slices", async () => {
    await mermaidReady;
    const doc = mustParse('pie\n  title Sales\n  "Alpha" : 40\n  "Beta" : 60');
    expect(doc.kind).toBe("pie");
  });
});

describe("parseClassDiagram", () => {
  it("parses class members and relationships", async () => {
    await mermaidReady;
    const doc = mustParse("classDiagram\n  class Animal {\n    +name: String\n  }\n  Dog <|-- Animal");
    expect(doc.kind).toBe("class");
  });
});

describe("parseGantt", () => {
  it("parses sections and tasks", async () => {
    await mermaidReady;
    const doc = mustParse("gantt\n  title Project\n  section Design\n  Task1 :a1, 5d");
    expect(doc.kind).toBe("gantt");
  });
});

describe("parseQuadrant", () => {
  it("parses axes and points", async () => {
    await mermaidReady;
    const doc = mustParse("quadrantChart\n  x-axis Low --> High\n  Point A: [0.5, 0.7]");
    expect(doc.kind).toBe("quadrant");
  });
});

describe("stateDiagram", () => {
  it("parses state transitions as graph", async () => {
    await mermaidReady;
    const doc = wasmMermaidEngine.parse("stateDiagram-v2\n  [*] --> Active\n  Active --> [*]");
    expect(doc).not.toBeNull();
    expect(doc!.kind).toBe("graph");
  });

  /// `[*]` is two DIFFERENT pseudostates (initial and final). The old blanket
  /// replace mapped both to one literal node, so the layout merged them into a
  /// single labelled box with every edge pointing at it.
  /// MUT: collapsing either rewrite back to one id never passes — the two
  /// circle assertions below catch it.
  /// A composite state is a CLUSTER with its own initial/final markers: the
  /// frame must exist, its members must be listed, and the nested `[*]` must
  /// NOT merge with the top-level one (that merge is the defect the flat
  /// rewrite removed, and a global id would reintroduce it one level down).
  ///
  /// MUT: dropping the scope suffix from the pseudostate ids merges the four
  /// circles into two — the distinct-id assertion catches it.
  it("renders a composite state as a cluster with its own pseudostates", async () => {
    await mermaidReady;
    const doc = wasmMermaidEngine.parse(
      "stateDiagram-v2\n  [*] --> Idle\n  state Working {\n    [*] --> Busy\n    Busy --> Done\n    Done --> [*]\n  }\n  Idle --> Working\n  Working --> [*]",
    );
    expect(doc).not.toBeNull();
    const g = doc as unknown as {
      nodes: Array<{ id: string; shape: string }>;
      groups: Array<{ id: string; members: string[] }>;
      edges: Array<{ source: string; target: string }>;
    };
    // The frame exists and holds the composite's own states.
    expect(g.groups.map((x) => x.id)).toEqual(["Working"]);
    expect(g.groups[0].members).toContain("Busy");
    expect(g.groups[0].members).toContain("Done");
    // Four DISTINCT circles: the outer pair and the composite's pair.
    const circles = g.nodes.filter((n) => n.shape === "circle");
    expect(circles.length).toBe(4);
    expect(new Set(circles.map((n) => n.id)).size).toBe(4);
    // The outer flow still runs Idle → Working, and the composite is a node
    // edges can target (it is a container, not a plain box).
    expect(g.edges.some((e) => e.source === "Idle" && e.target === "Working")).toBe(true);
  });

  it("keeps the initial and final pseudostates apart, as circles", async () => {
    await mermaidReady;
    const doc = wasmMermaidEngine.parse("stateDiagram-v2\n  [*] --> Idle\n  Idle --> Running\n  Running --> [*]");
    expect(doc).not.toBeNull();
    const g = doc as unknown as { nodes: Array<{ id: string; label: string; shape: string }>; edges: Array<{ source: string; target: string }> };
    const circles = g.nodes.filter((n) => n.shape === "circle");
    expect(circles.length, "one circle for the start and one for the end").toBe(2);
    expect(new Set(circles.map((n) => n.id)).size).toBe(2);
    // The pseudostates carry no text (mermaid draws a bare circle).
    for (const c of circles) expect(c.label).toBe("");
    // …and they are NOT the same node the transitions run through.
    const ids = g.nodes.map((n) => n.id);
    expect(ids).toContain("Idle");
    expect(ids).toContain("Running");
    // The start has no incoming edge; the end has no outgoing edge.
    const sources = g.edges.map((e) => e.source);
    const targets = g.edges.map((e) => e.target);
    const [start, end] = [circles[0].id, circles[1].id].sort();
    void start;
    void end;
    const startNode = circles.find((c) => !targets.includes(c.id));
    const endNode = circles.find((c) => !sources.includes(c.id));
    expect(startNode, "a start pseudostate with no incoming edge").toBeTruthy();
    expect(endNode, "an end pseudostate with no outgoing edge").toBeTruthy();
    expect(startNode!.id).not.toBe(endNode!.id);
  });
});
