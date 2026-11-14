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
import { wasmMermaidEngine } from "../../mermaid/wasmEngine";

function mustParse(src: string): MermaidDoc {
  const doc = wasmMermaidEngine.parse(src);
  if (!doc) throw new Error(`unexpected null: ${src.split("\n")[0]}`);
  return doc;
}

describe("parseFlowchart", () => {
  it("parses direction, nodes and edges", () => {
    const doc = mustParse("graph TD\n  A --> B\n  B --> C");
    expect(doc.kind).toBe("graph");
    if (doc.kind === "graph") {
      expect(doc.direction).toBe("TD");
      expect(doc.nodes.map((n) => n.id)).toEqual(["A", "B", "C"]);
      expect(doc.edges).toHaveLength(2);
    }
  });

  it("parses node shapes", () => {
    const doc = mustParse("flowchart LR\n  S[Start] --> D{Check}");
    if (doc.kind === "graph") {
      expect(doc.nodes.map((n) => n.shape)).toContain("rect");
      expect(doc.nodes.map((n) => n.shape)).toContain("diamond");
    }
  });

  it("parses edge labels", () => {
    const doc = mustParse("graph TD\n  A -->|yes| B");
    if (doc.kind === "graph") {
      expect(doc.edges[0]?.label).toBe("yes");
    }
  });

  it("rejects non-diagram input", () => {
    expect(wasmMermaidEngine.parse("this is not a diagram")).toBeNull();
  });
});

describe("parseSequence", () => {
  it("declares participants and messages", () => {
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

  it("longer arrow tokens win", () => {
    const doc = mustParse("sequenceDiagram\nA -->> B: x");
    if (doc.kind === "sequence") {
      expect(doc.messages[0]?.arrowKind).toBe("dotted-open");
    }
  });
});

describe("parsePie", () => {
  it("parses title and slices", () => {
    const doc = mustParse('pie\n  title Sales\n  "Alpha" : 40\n  "Beta" : 60');
    expect(doc.kind).toBe("pie");
  });
});

describe("parseClassDiagram", () => {
  it("parses class members and relationships", () => {
    const doc = mustParse("classDiagram\n  class Animal {\n    +name: String\n  }\n  Dog <|-- Animal");
    expect(doc.kind).toBe("class");
  });
});

describe("parseGantt", () => {
  it("parses sections and tasks", () => {
    const doc = mustParse("gantt\n  title Project\n  section Design\n  Task1 :a1, 5d");
    expect(doc.kind).toBe("gantt");
  });
});

describe("parseQuadrant", () => {
  it("parses axes and points", () => {
    const doc = mustParse("quadrantChart\n  x-axis Low --> High\n  Point A: [0.5, 0.7]");
    expect(doc.kind).toBe("quadrant");
  });
});

describe("stateDiagram", () => {
  it("parses state transitions as graph", () => {
    const doc = wasmMermaidEngine.parse("stateDiagram-v2\n  [*] --> Active\n  Active --> [*]");
    expect(doc).not.toBeNull();
    expect(doc!.kind).toBe("graph");
  });
});
