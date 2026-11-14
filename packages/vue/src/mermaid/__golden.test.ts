// @vitest-environment node
// Golden snapshot tests: the wasm component's output is pinned as the
// golden file — it IS the reference implementation now (the TS parsers
// were the original oracle, retired when the Rust side proved stable).
// Any change to the wasm output shows up as a snapshot diff for review.

import { describe, expect, it } from "vitest";

import { wasmMermaidEngine } from "./wasmEngine";

const CASES: Array<{ name: string; source: string }> = [
  { name: "graph-basic", source: "graph TD\n  A --> B\n  B --> C" },
  { name: "flowchart-shaped", source: "flowchart LR\n  S[Start] --> M{Check} --> E" },
  { name: "sequence-basic", source: "sequenceDiagram\n  Alice->>Bob: Hello\n  Bob-->>Alice: Hi" },
  { name: "sequence-arrows", source: "sequenceDiagram\n  A->B: solid\n  B-->C: dotted\n  C->>D: solid-open" },
  { name: "pie-basic", source: 'pie\n  title Sales\n  "Alpha" : 40\n  "Beta" : 60' },
  { name: "gantt-basic", source: "gantt\n  title Project\n  section Design\n  Task1 :a1, 5d" },
  { name: "class-basic", source: "classDiagram\n  class Animal {\n    +name: String\n    +speak() void\n  }\n  Dog <|-- Animal" },
  { name: "quadrant-basic", source: "quadrantChart\n  x-axis Low --> High\n  y-axis Bottom --> Top\n  Point A: [0.5, 0.7]" },
];

describe("mermaid golden snapshots (wasm is the reference)", () => {
  for (const { name, source } of CASES) {
    it(`mermaid: ${name}`, () => {
      const doc = wasmMermaidEngine.parse(source);
      expect(doc).not.toBeNull();
      // Pin the full JSON output — any semantic change is a snapshot diff.
      expect(JSON.parse(JSON.stringify(doc))).toMatchSnapshot();
    });
  }
});
