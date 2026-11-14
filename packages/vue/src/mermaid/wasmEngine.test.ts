// @vitest-environment node
import { describe, expect, it } from "vitest";

import type { MermaidClassDoc, MermaidGraphDoc, MermaidPieDoc, MermaidQuadrantDoc, MermaidSequenceDoc } from "./types";
import { wasmMermaidEngine } from "./wasmEngine";

describe("wasmMermaidEngine", () => {
  it("parses a graph through the wasm component", () => {
    const doc = wasmMermaidEngine.parse("graph TD\n  A --> B\n  B --> C") as MermaidGraphDoc;
    expect(doc).not.toBeNull();
    expect(doc!.kind).toBe("graph");
    expect(doc!.direction).toBe("TD");
    expect(doc!.nodes.map((n) => n.id)).toEqual(["A", "B", "C"]);
    expect(doc!.edges).toHaveLength(2);
  });

  it("serializes shapes to the TS contract literals", () => {
    const doc = wasmMermaidEngine.parse("flowchart LR\n  S[Start] --> D{Check}") as MermaidGraphDoc;
    expect(doc).not.toBeNull();
    const shapes = doc!.nodes.map((n) => n.shape);
    expect(shapes).toContain("rect");
    expect(shapes).toContain("diamond");
  });

  it("returns null on non-diagram input", () => {
    expect(wasmMermaidEngine.parse("this is not a diagram")).toBeNull();
  });

  it("parses a sequence diagram through the wasm component", () => {
    const doc = wasmMermaidEngine.parse(
      "sequenceDiagram\n  Alice->>Bob: Hello\n  Bob-->>Alice: Hi",
    ) as MermaidSequenceDoc;
    expect(doc).not.toBeNull();
    expect(doc!.kind).toBe("sequence");
    expect(doc!.participants).toContain("Alice");
    expect(doc!.messages).toHaveLength(2);
    // Arrow kind mapping: ->> = solid-open, -->> = dotted-open.
    expect(doc!.messages[0]!.arrowKind).toBe("solid-open");
    expect(doc!.messages[1]!.arrowKind).toBe("dotted-open");
  });

  it("parses a pie chart through the wasm component", () => {
    const doc = wasmMermaidEngine.parse(
      'pie\n  title Sales\n  "Alpha" : 40\n  "Beta" : 60',
    ) as MermaidPieDoc;
    expect(doc).not.toBeNull();
    expect(doc!.kind).toBe("pie");
    expect(doc!.title).toBe("Sales");
    expect(doc!.slices).toHaveLength(2);
    // Slices serialize as objects with label/value, not tuples.
    expect(doc!.slices[0]!.label).toBe("Alpha");
    expect(doc!.slices[0]!.value).toBe(40);
  });

  it("parses a class diagram through the wasm component", () => {
    const doc = wasmMermaidEngine.parse(
      "classDiagram\n  class Animal {\n    +name: String\n    +speak() void\n  }\n  Dog <|-- Animal",
    ) as MermaidClassDoc;
    expect(doc).not.toBeNull();
    expect(doc!.kind).toBe("class");
    expect(doc!.classes).toHaveLength(1);
    expect(doc!.classes[0]!.name).toBe("Animal");
    // Members split: +name is an attribute, +speak() is a method.
    expect(doc!.classes[0]!.attributes).toHaveLength(1);
    expect(doc!.classes[0]!.methods).toHaveLength(1);
    expect(doc!.classes[0]!.methods[0]!.name).toBe("speak");
    // Relationship: <|-- maps to inheritance.
    expect(doc!.relationships).toHaveLength(1);
    expect(doc!.relationships[0]!.relType).toBe("inheritance");
    expect(doc!.relationships[0]!.from).toBe("Dog");
    expect(doc!.relationships[0]!.to).toBe("Animal");
  });

  it("parses a quadrant chart through the wasm component", () => {
    const doc = wasmMermaidEngine.parse(
      "quadrantChart\n  x-axis Low --> High\n  y-axis Bottom --> Top\n  quadrant-1 Growth\n  Point A: [0.5, 0.7]",
    ) as MermaidQuadrantDoc;
    expect(doc).not.toBeNull();
    expect(doc!.kind).toBe("quadrant");
    expect(doc!.xAxisLeft).toBe("Low");
    expect(doc!.xAxisRight).toBe("High");
    expect(doc!.quadrants[0]).toBe("Growth");
    expect(doc!.points).toHaveLength(1);
    expect(doc!.points[0]!.label).toBe("Point A");
    expect(doc!.points[0]!.x).toBeCloseTo(0.5, 5);
  });

  it("parses a gantt chart through the wasm component", () => {
    const doc = wasmMermaidEngine.parse(
      "gantt\n  title Project\n  section Design\n  Task1 :a1, 5d",
    );
    expect(doc).not.toBeNull();
    expect(doc!.kind).toBe("gantt");
  });
});
