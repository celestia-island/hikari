import { describe, it, expect } from "vitest";
import { buildBoardModel, heuristicTextWidth, type MermaidBoardModel } from "../../mermaid/layout";
import { wasmMermaidEngine, mermaidReady } from "../../mermaid/wasmEngine";
import type { LaidOutEdge } from "../../mermaid/layout";

const edgeOf = (model: MermaidBoardModel, from: string, to: string): LaidOutEdge =>
  model.edges.find((e) => e.from === from && e.to === to)!;

describe("cluster back-edge adjudication", () => {
  it("an unrelated member-pair closure does not make the cluster edge loop", async () => {
    await mermaidReady;
    const lines = ["flowchart TD", "C[client]", "subgraph G[gw]", "N0[router]", "N1[memory]", "end", "C --> G", "N1 --> T[agent]", "T --> N0"];
    const m = buildBoardModel(wasmMermaidEngine.parse(lines.join("\n"))!, heuristicTextWidth);
    // C --> G stays a FORWARD edge: the cycle (T --> N0) closed on a
    // member-to-member leg, not inside C --> G's own expansion set.
    const intoCluster = edgeOf(m, "n:C", "g:G");
    expect(intoCluster.anchorFrom).toBeUndefined();
    // ...while the closing leg itself docks by flow rank (T sits above N0
    // in the final order, so it is an ordinary forward edge here — the
    // cycle breaker read C --> G's FIRST expansion backwards, and that
    // expansion is C --> N0, a leg of the cluster edge itself).
    const closure = edgeOf(m, "n:T", "n:N0");
    expect(closure.anchorFrom).toBe("bottom");
    expect(closure.anchorTo).toBe("top");
  });

  it("a retry between two plain nodes still docks on the free side", async () => {
    await mermaidReady;
    const src = ["flowchart TD", "S --> D{ready?}", "D -->|no| W[wait]", "D -->|yes| R[run]", "W --> D", "R --> E"].join("\n");
    const m = buildBoardModel(wasmMermaidEngine.parse(src)!, heuristicTextWidth);
    const loop = edgeOf(m, "n:W", "n:D");
    expect(`${loop.anchorFrom}/${loop.anchorTo}`).toBe("left/left");
  });
});
