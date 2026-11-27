import { describe, it, expect } from "vitest";
import { buildBoardModel, heuristicTextWidth } from "../../mermaid/layout";
import { wasmMermaidEngine, mermaidReady } from "../../mermaid/wasmEngine";

const LINES = [
  "flowchart TD",
  "N1[one]",
  "K[mid]",
  "C[client]",
  "P[mid-two]",
  "N0[n-two]",
  "T[agent]",
  "subgraph G[g]",
  "N0",
  "P",
  "N1",
  "end",
  "P --> N0",
  "N1 --> K",
  "K --> C",
  "C --> G",
  "N0 --> T",
];

describe("a cyclic cluster edge does not run down a member's lane", () => {
  it("routes around the side instead of through the ranks (no lane)", async () => {
    await mermaidReady;
    // G = { N0, P, N1 }, listed N0-first. The FIRST expansion (C→N0) skips a
    // rank and would have a lane; a LATER expansion (C→N1) closes the cycle
    // N1→K→C, so the doc edge IS a back edge by its own expansion. What the
    // pin actually holds today is the frame end: `anchorTo: "nearest"` and no
    // lane junctions on the rendered edge — the arrow lands on the frame and
    // nothing routes it through the ranks. (The back flag itself is inert for
    // a cluster edge while the frame-end checks stand; see layout.ts.)
    const m = buildBoardModel(wasmMermaidEngine.parse(LINES.join("\n"))!, heuristicTextWidth);
    const into = m.edges.find((e) => e.from === "n:C" && e.to === "g:G")!;
    expect(into.via ?? []).toEqual([]);
    // and it is still the cluster frame that receives the arrow
    expect(into.anchorTo).toBe("nearest");
    // while the unrelated plain edges keep their forward docking
    expect(m.edges.find((e) => e.from === "n:P" && e.to === "n:N0")).toMatchObject({ anchorFrom: "bottom", anchorTo: "top" });
  });
});
