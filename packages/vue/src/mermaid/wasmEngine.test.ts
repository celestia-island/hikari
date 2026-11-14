// @vitest-environment node
import { describe, expect, it } from "vitest";

import type { MermaidGraphDoc } from "./types";
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

  it("falls through to the TS parser for sequence diagrams", () => {
    const doc = wasmMermaidEngine.parse(
      "sequenceDiagram\n  Alice->>Bob: Hello\n  Bob-->>Alice: Hi",
    );
    expect(doc).not.toBeNull();
    expect(doc!.kind).toBe("sequence");
  });
});
