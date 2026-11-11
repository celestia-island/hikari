import { describe, expect, it } from "vitest";

import { MermaidParseError, parseFlowchart, parseStateDiagram } from "../../mermaid/parseGraph";
import { parseSequence } from "../../mermaid/parseSequence";
import { parsePie } from "../../mermaid/parsePie";
import { parseGantt } from "../../mermaid/parseGantt";
import { parseClassDiagram } from "../../mermaid/parseClass";
import { parseQuadrant } from "../../mermaid/parseQuadrant";
import { parseMermaid } from "../../mermaid/parse";
import { mermaidParser } from "../../mermaid";

/**
 * Parser goldens — every case mirrors a semantic the Rust reference
 * (ratatui-markdown `src/mermaid/`, pest grammar v0.3.6) pins: mandatory
 * header, chain fan-out, shape table, arrow search order, relationship
 * pattern precedence, and the acceptance/rejection conditions per type.
 * When a case here changes, check the Rust side before changing this.
 */

describe("parseFlowchart", () => {
  it("parses header, shapes, labels and chain fan-out", () => {
    const doc = parseFlowchart([
      "graph TD",
      "A[Start] --> B{Choice}",
      "B -->|yes| C((Ok))",
      "A --- D(Plain)",
    ].join("\n"));
    expect(doc.kind).toBe("graph");
    expect(doc.variant).toBe("flowchart");
    expect(doc.direction).toBe("TD");
    expect(doc.nodes).toEqual([
      { id: "A", label: "Start", shape: "rect" },
      { id: "B", label: "Choice", shape: "diamond" },
      { id: "C", label: "Ok", shape: "circle" },
      { id: "D", label: "Plain", shape: "rounded" },
    ]);
    expect(doc.edges).toEqual([
      { source: "A", target: "B", label: null, edgeType: "arrow" },
      { source: "B", target: "C", label: "yes", edgeType: "arrow" },
      { source: "A", target: "D", label: null, edgeType: "line" },
    ]);
  });

  it("fans A --> B --> C into pairwise edges and treats TB as TD", () => {
    const doc = parseFlowchart("flowchart TB\nA --> B --> C");
    expect(doc.direction).toBe("TD");
    expect(doc.edges.map((e) => `${e.source}->${e.target}`)).toEqual(["A->B", "B->C"]);
  });

  it("requires the keyword AND the direction (pest header rule)", () => {
    expect(() => parseFlowchart("graph\nA --> B")).toThrow(MermaidParseError);
    expect(() => parseFlowchart("flowchart\nA --> B")).toThrow(MermaidParseError);
  });

  it("rejects the whole file on a broken statement (pest has no partial accept)", () => {
    expect(() => parseFlowchart("graph LR\nA --> B\n-> broken")).toThrow(MermaidParseError);
    expect(() => parseFlowchart("graph LR\nA -->")).toThrow(MermaidParseError);
  });

  it("a bare nodedef declares; a later shape refines label and shape", () => {
    const doc = parseFlowchart("graph LR\nA\nA[Label]");
    expect(doc.nodes).toEqual([{ id: "A", label: "Label", shape: "rect" }]);
    expect(doc.edges).toEqual([]);
  });

  it("skips % comments and blank lines; ids are [A-Za-z_][A-Za-z0-9_]*", () => {
    const doc = parseFlowchart("graph LR\n% a comment\n\n_ok1 --> Node2x");
    expect(doc.nodes.map((n) => n.id)).toEqual(["_ok1", "Node2x"]);
  });

  it("labels may contain spaces and edge-ish glyphs inside brackets", () => {
    const doc = parseFlowchart('graph LR\nA[Check "x --> y"] --> B');
    expect(doc.nodes[0].label).toBe('Check "x --> y"');
  });
});

describe("parseStateDiagram", () => {
  it("maps [*] to start/end circles and states to rounded nodes", () => {
    const doc = parseStateDiagram("stateDiagram-v2\n[*] --> S1\nS1 --> S2\nS2 --> [*]");
    expect(doc.variant).toBe("state");
    expect(doc.direction).toBe("TD");
    expect(doc.nodes).toEqual([
      { id: "__start__", label: "●", shape: "circle" },
      { id: "S1", label: "S1", shape: "rounded" },
      { id: "S2", label: "S2", shape: "rounded" },
      { id: "__end__", label: "●", shape: "circle" },
    ]);
    expect(doc.edges).toHaveLength(3);
    expect(doc.edges[0]).toEqual({ source: "__start__", target: "S1", label: null, edgeType: "arrow" });
  });

  it("supports --- links; state \"Label\" as ID lines are skipped (Rust parity: states materialize from transitions)", () => {
    const doc = parseStateDiagram('stateDiagram-v2\nstate "Waiting" as W\nW --- X');
    expect(doc.nodes[0]).toEqual({ id: "W", label: "W", shape: "rounded" });
    expect(doc.edges[0].edgeType).toBe("line");
  });
});

describe("parseSequence", () => {
  it("declares lanes in order and auto-declares message participants", () => {
    const doc = parseSequence([
      "sequenceDiagram",
      "participant Alice",
      "Bob ->> Alice: hello there",
      "Alice -->> Bob: hi",
    ].join("\n"));
    expect(doc.participants).toEqual(["Alice", "Bob"]);
    expect(doc.messages).toEqual([
      { from: "Bob", to: "Alice", text: "hello there", arrowKind: "solid-open" },
      { from: "Alice", to: "Bob", text: "hi", arrowKind: "dotted-open" },
    ]);
  });

  it("longer arrow tokens win (-->> is never read as ->)", () => {
    expect(parseSequence("sequenceDiagram\nA -->> B: x").messages[0].arrowKind).toBe("dotted-open");
    expect(parseSequence("sequenceDiagram\nA -> B: x").messages[0].arrowKind).toBe("solid");
    expect(parseSequence("sequenceDiagram\nA --> B: x").messages[0].arrowKind).toBe("dotted");
  });

  it("no participants is not a sequence diagram", () => {
    expect(() => parseSequence("sequenceDiagram")).toThrow(MermaidParseError);
  });
});

describe("parsePie", () => {
  it("parses title, quoted and unquoted slices", () => {
    const doc = parsePie(['pie title Delivery', '"Dogs": 38', "Cats: 62"].join("\n"));
    expect(doc.title).toBe("Delivery");
    expect(doc.slices).toEqual([
      { label: "Dogs", value: 38 },
      { label: "Cats", value: 62 },
    ]);
  });

  it("a separate title line wins later; invalid values drop; no slices is fatal", () => {
    const doc = parsePie(["pie", "title T2", 'x: "not a number"', '"ok": 3'].join("\n"));
    expect(doc.title).toBe("T2");
    expect(doc.slices).toEqual([{ label: "ok", value: 3 }]);
    expect(() => parsePie("pie")).toThrow(MermaidParseError);
  });

  it("unquoted labels split on the LAST colon (rfind parity)", () => {
    const doc = parsePie("pie\na:b: 5");
    expect(doc.slices).toEqual([{ label: "a:b", value: 5 }]);
  });
});

describe("parseGantt", () => {
  it("parses title, sections, ids, deps and durations", () => {
    const doc = parseGantt([
      "gantt",
      "title Sprint",
      "dateFormat YYYY-MM-DD",
      "section Build",
      "Design : t1, 2d",
      "Implement : t2, after t1, 5d",
      "section Test",
      "QA : t3, after t2, 3d",
    ].join("\n"));
    expect(doc.title).toBe("Sprint");
    expect(doc.sections).toEqual([
      {
        name: "Build",
        tasks: [
          { name: "Design", id: "t1", deps: [], duration: "2d" },
          { name: "Implement", id: "t2", deps: ["t1"], duration: "5d" },
        ],
      },
      { name: "Test", tasks: [{ name: "QA", id: "t3", deps: ["t2"], duration: "3d" }] },
    ]);
  });

  it("tasks before any section land in an anonymous section", () => {
    const doc = parseGantt("gantt\nSetup : s0, 1d");
    expect(doc.sections).toEqual([{ name: "", tasks: [{ name: "Setup", id: "s0", deps: [], duration: "1d" }] }]);
  });

  it("no tasks is fatal", () => {
    expect(() => parseGantt("gantt\ntitle only")).toThrow(MermaidParseError);
  });
});

describe("parseClassDiagram", () => {
  it("parses member blocks, visibility, methods vs attributes", () => {
    const doc = parseClassDiagram([
      "classDiagram",
      "class BankAccount {",
      "  +String owner",
      "  -balance: f64",
      "  +deposit(amount: f64): Result",
      "}",
    ].join("\n"));
    expect(doc.classes).toEqual([
      {
        name: "BankAccount",
        attributes: [
          { visibility: "public", name: "String owner", typeInfo: "", isMethod: false },
          { visibility: "private", name: "balance", typeInfo: "f64", isMethod: false },
        ],
        methods: [{ visibility: "public", name: "deposit", typeInfo: "Result", isMethod: true }],
      },
    ]);
  });

  it("relationship patterns probe in order (<|-- before ..)", () => {
    const doc = parseClassDiagram([
      "classDiagram",
      "class A {",
      "}",
      "class B {",
      "}",
      "A <|-- B",
      "A ..> B",
    ].join("\n"));
    expect(doc.relationships).toEqual([
      { from: "A", to: "B", relType: "inheritance", label: null },
      { from: "A", to: "B", relType: "dependency", label: null },
    ]);
  });

  it("one-line class bodies split on ; and relationships may carry labels", () => {
    const doc = parseClassDiagram([
      "classDiagram",
      "class Point { +x: i32; +y(): void }",
      "Point --> Vertex : owns",
    ].join("\n"));
    const point = doc.classes[0];
    expect(point.attributes).toEqual([{ visibility: "public", name: "x", typeInfo: "i32", isMethod: false }]);
    expect(point.methods).toEqual([{ visibility: "public", name: "y", typeInfo: "void", isMethod: true }]);
    expect(doc.relationships[0]).toEqual({
      from: "Point",
      to: "Vertex",
      relType: "directed-association",
      label: "owns",
    });
  });

  it("no class blocks is fatal (bare relationships are not renderable)", () => {
    expect(() => parseClassDiagram("classDiagram\nA --> B")).toThrow(MermaidParseError);
  });
});

describe("parseQuadrant", () => {
  it("parses axes, quadrant captions and points", () => {
    const doc = parseQuadrant([
      "quadrantChart",
      "title Reach vs Engagement",
      "x-axis Low reach --> High reach",
      "y-axis Low engagement --> High engagement",
      "quadrant-1 Grow",
      "quadrant-2 Keep",
      "point-a: [0.3, 0.6]",
      "point-b: [0.78, 0.82]",
    ].join("\n"));
    expect(doc.title).toBe("Reach vs Engagement");
    expect(doc.xAxisLeft).toBe("Low reach");
    expect(doc.xAxisRight).toBe("High reach");
    expect(doc.yAxisBottom).toBe("Low engagement");
    expect(doc.yAxisTop).toBe("High engagement");
    expect(doc.quadrants).toEqual(["Grow", "Keep", null, null]);
    expect(doc.points).toEqual([
      { label: "point-a", x: 0.3, y: 0.6 },
      { label: "point-b", x: 0.78, y: 0.82 },
    ]);
  });

  it("bare quadrant-N lines get QN captions; axes default to Low/High; no points is fatal", () => {
    const doc = parseQuadrant("quadrantChart\nquadrant-3\np: [0.5, 0.5]");
    expect(doc.quadrants[2]).toBe("Q3");
    expect(doc.xAxisLeft).toBe("Low");
    expect(doc.xAxisRight).toBe("High");
    expect(doc.yAxisBottom).toBe("Low");
    expect(doc.yAxisTop).toBe("High");
    expect(() => parseQuadrant("quadrantChart\nquadrant-3")).toThrow(MermaidParseError);
    expect(() => parseQuadrant("quadrantChart")).toThrow(MermaidParseError);
  });
});

describe("parseMermaid dispatch", () => {
  it("routes by the first non-empty line", () => {
    expect(parseMermaid("graph TD\nA --> B").kind).toBe("graph");
    expect(parseMermaid("%% meta\nsequenceDiagram\nA -> B: x").kind).toBe("sequence");
    expect(parseMermaid("stateDiagram-v2\n[*] --> S").kind).toBe("graph");
    expect(parseMermaid("classDiagram\nclass A {\n}").kind).toBe("class");
    expect(parseMermaid('pie\n"x": 1').kind).toBe("pie");
    expect(parseMermaid("gantt\nT : t, 1d").kind).toBe("gantt");
    expect(parseMermaid("quadrantChart\np: [0.4, 0.7]").kind).toBe("quadrant");
  });

  it("unknown types are rejected (never silently guessed)", () => {
    expect(() => parseMermaid("mindmap\nroot")).toThrow(MermaidParseError);
    expect(() => parseMermaid("")).toThrow(MermaidParseError);
  });
});

describe("mermaidParser engine wrapper", () => {
  it("returns the doc on success and null on any failure", () => {
    expect(mermaidParser.parse("graph TD\nA --> B")?.kind).toBe("graph");
    expect(mermaidParser.parse("graph TD\nA -->")).toBeNull();
    expect(mermaidParser.parse("nothing recognizable")).toBeNull();
  });
});

// ── R2/R3 fix regression pins ────────────────────────────────────────

describe("pest stxt union stop-set parity (R2 finding 3)", () => {
  it("labels containing a FOREIGN closer reject the whole file", () => {
    expect(() => parseFlowchart("graph TD\nA[x)y] --> B")).toThrow(MermaidParseError);
    expect(() => parseFlowchart("graph TD\nA[B((C))] --> B")).toThrow(MermaidParseError);
    expect(() => parseFlowchart("graph TD\nC((a)b)) --> D")).toThrow(MermaidParseError);
  });

  it("circ failure falls back to the rounded reading, exactly like the ordered choice", () => {
    const doc = parseFlowchart("graph LR\nA((text) --> B");
    expect(doc.nodes[0]).toEqual({ id: "A", label: "(text", shape: "rounded" });
    expect(doc.edges[0].target).toBe("B");
  });
});

describe("dispatch latitude (R2 finding 4)", () => {
  it("tab-separated graph/flowchart headers dispatch like spaced ones", () => {
    expect(parseMermaid("graph\tTD\nA --> B").kind).toBe("graph");
    expect(parseMermaid("flowchart\tLR\nA --> B").kind).toBe("graph");
  });
});

describe("state parity (R2 finding 5)", () => {
  it("bare state-id lines contribute nothing (Rust: transitions only)", () => {
    const doc = parseStateDiagram("stateDiagram-v2\nW --- X\nY");
    expect(doc.nodes.map((n) => n.id)).toEqual(["W", "X"]);
  });
});

describe("numeric acceptance parity (R2 finding 9)", () => {
  it("pie rejects hex and non-decimal values the way Rust f64 parse does", () => {
    const doc = parsePie('pie\n"hex": 0x10\n"ok": 2');
    expect(doc.slices).toEqual([{ label: "ok", value: 2 }]);
  });

  it("quadrant rejects empty coords instead of coercing to (0,0)", () => {
    expect(() => parseQuadrant("quadrantChart\np: [, ]")).toThrow(MermaidParseError);
  });
});
