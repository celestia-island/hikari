import { describe, expect, it } from "vitest";

import { buildBoardModel, feedbackArcSet, heuristicTextWidth, layoutGraph } from "../../mermaid/layout";
import { wasmMermaidEngine, mermaidReady } from "../../mermaid/wasmEngine";

/**
 * Layout invariants — the geometry module is pure and deterministic, so
 * the tests pin structural properties (no overlaps inside a rank, rank
 * monotonicity along edges, direction handling, sequence lane geometry,
 * gantt scheduling) rather than exact pixels.
 */

const measure = heuristicTextWidth; // deterministic in every environment

function overlap(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

describe("subgraph clusters", () => {
  const CLUSTER = [
    "flowchart TD",
    '  C["client"]',
    '  subgraph G["Gateway"]',
    '    N0["router"]',
    '    N1["memory"]',
    "  end",
    '  C -->|"call"| G',
    '  N1 --> T["agent"]',
  ].join("\n");

  it("emits one frame node per cluster and no subgraph/end member nodes", async () => {
    await mermaidReady;
    const doc = wasmMermaidEngine.parse(CLUSTER)!;
    const model = buildBoardModel(doc, measure);
    const frames = model.nodes.filter((n) => n.kind === "group");
    expect(frames).toHaveLength(1);
    expect(frames[0].id).toBe("g:G");
    expect(frames[0].data.label).toBe("Gateway");
    expect(frames[0].passthrough).toBe(true);
    expect(model.nodes.filter((n) => n.kind === "shape").map((n) => n.id)).toEqual([
      "n:C",
      "n:N0",
      "n:N1",
      "n:T",
    ]);
  });

  it("keeps frames first in paint order and encloses exactly the members", async () => {
    await mermaidReady;
    const model = buildBoardModel(wasmMermaidEngine.parse(CLUSTER)!, measure);
    expect(model.nodes[0].kind).toBe("group");
    const frame = model.nodes[0];
    const inside = (id: string): boolean => {
      const n = model.nodes.find((x) => x.id === id)!;
      return n.x >= frame.x && n.y >= frame.y && n.x + n.w <= frame.x + frame.w && n.y + n.h <= frame.y + frame.h;
    };
    expect(inside("n:N0")).toBe(true);
    expect(inside("n:N1")).toBe(true);
    expect(inside("n:C")).toBe(false);
    expect(inside("n:T")).toBe(false);
    // The frame never starts above/left of the world origin (it is clipped
    // by the board viewport otherwise).
    expect(frame.x).toBeGreaterThanOrEqual(0);
    expect(frame.y).toBeGreaterThanOrEqual(0);
  });

  it("routes an edge addressed to the cluster id onto its frame", async () => {
    await mermaidReady;
    const model = buildBoardModel(wasmMermaidEngine.parse(CLUSTER)!, measure);
    const toFrame = model.edges.filter((e) => e.to === "g:G");
    expect(toFrame).toHaveLength(1);
    expect(toFrame[0].from).toBe("n:C");
    expect(toFrame[0].label).toBe("call");
    // Mermaid attaches the arrow to the cluster's border, so the endpoint
    // must anchor on the frame's nearest edge (its center hides behind the
    // members it encloses).
    expect(toFrame[0].anchorTo).toBe("nearest");
    // Nothing still points at a bare cluster id node.
    expect(model.edges.some((e) => e.to === "n:G" || e.from === "n:G")).toBe(false);
  });

  it("anchors a cluster-as-SOURCE edge on the frame's border too", async () => {
    await mermaidReady;
    // The hub fixture has `G --> B` (cluster as the source). Without the
    // override the edge anchors on the frame's CENTRE, i.e. inside the box
    // behind its own members; `nearest` clamps the endpoint onto the frame's
    // border for oblique geometry, the same rule the target side uses.
    const doc = wasmMermaidEngine.parse([
      "flowchart TD",
      '  subgraph G["Gateway"]',
      '    A["a"]',
      "  end",
      '  G --> B["b"]',
    ].join("\n"))!;
    const model = buildBoardModel(doc, measure);
    const fromFrame = model.edges.filter((e) => e.from === "g:G");
    expect(fromFrame).toHaveLength(1);
    expect(fromFrame[0].anchorFrom).toBe("nearest");
    expect(fromFrame[0].to).toBe("n:B");
  });

  it("nests an outer frame around the inner frame", async () => {
    await mermaidReady;
    const doc = wasmMermaidEngine.parse([
      "flowchart TD",
      '  subgraph Outer["outer"]',
      '    subgraph Inner["inner"]',
      '      A["a"]',
      "    end",
      '    B["b"]',
      "  end",
    ].join("\n"))!;
    const model = buildBoardModel(doc, measure);
    const frames = model.nodes.filter((n) => n.kind === "group");
    expect(frames.map((f) => f.id)).toEqual(["g:Outer", "g:Inner"]);
    const [outer, inner] = frames;
    expect(inner.x).toBeGreaterThan(outer.x);
    expect(inner.y).toBeGreaterThan(outer.y);
    expect(inner.x + inner.w).toBeLessThan(outer.x + outer.w);
    expect(inner.y + inner.h).toBeLessThan(outer.y + outer.h);
  });

  it("never lets side-by-side clusters (or a free neighbour) overlap in ANY direction", async () => {
    await mermaidReady;
    // TD/BT put siblings side by side; LR/RL stack them, where the frame's
    // header band (26px) joins the two pads — a direction-blind gap passes TD
    // and overlaps LR (measured: 14px).
    for (const direction of ["TD", "BT", "LR", "RL"]) {
      const doc = wasmMermaidEngine.parse([
        `flowchart ${direction}`,
        '  R["root"]',
        '  subgraph GA["alpha"]',
        '    A1["a1"]',
        "  end",
        '  subgraph GB["beta"]',
        '    B1["b1"]',
        "  end",
        '  R --> A1',
        '  R --> B1',
      ].join("\n"))!;
      const model = buildBoardModel(doc, measure);
      const rects = model.nodes.map((n) => ({ id: n.id, kind: n.kind, x: n.x, y: n.y, w: n.w, h: n.h }));
      const frames = rects.filter((r) => r.kind === "group");
      expect(frames, direction).toHaveLength(2);
      const [ga, gb] = frames;
      // Frames must not intersect on EITHER axis in ANY direction.
      const overlapX = ga.x < gb.x + gb.w && gb.x < ga.x + ga.w;
      const overlapY = ga.y < gb.y + gb.h && gb.y < ga.y + ga.h;
      expect(overlapX && overlapY, `${direction}: frames overlap`).toBe(false);
      // A frame must not swallow a node it does not own.
      const inside = (f: (typeof frames)[number], n: (typeof rects)[number]): boolean =>
        n.x >= f.x && n.y >= f.y && n.x + n.w <= f.x + f.w && n.y + n.h <= f.y + f.h;
      for (const frame of frames) {
        for (const node of rects.filter((r) => r.kind !== "group")) {
          const owned = frame.id === "g:GA" ? node.id === "n:A1" : node.id === "n:B1";
          if (!owned) expect(inside(frame, node), `${direction}: ${frame.id} swallows ${node.id}`).toBe(false);
        }
      }
    }
  });

  it("keeps every frame inside the non-negative world box the board draws", async () => {
    await mermaidReady;
    // A cluster on the TOP rank is the case that would start above y = 0.
    const doc = wasmMermaidEngine.parse([
      "flowchart TD",
      '  subgraph G["top cluster"]',
      '    A["a"]',
      "  end",
      '  A --> B["b"]',
    ].join("\n"))!;
    const model = buildBoardModel(doc, measure);
    const frame = model.nodes.find((n) => n.kind === "group")!;
    expect(frame.x).toBeGreaterThanOrEqual(0);
    expect(frame.y).toBeGreaterThanOrEqual(0);
    // The edge SVG is anchored at (0,0) with the content box's size: the
    // model's width/height must cover the frame or its shell gets cut off.
    expect(model.width).toBeGreaterThan(frame.x + frame.w);
    expect(model.height).toBeGreaterThan(frame.y + frame.h);
    // The component's visible height comes from suggestedHeight; it must be
    // derived from the framed height, not the pre-frame one.
    expect(model.suggestedHeight).toBeGreaterThanOrEqual(Math.min(frame.y + frame.h + 24, 540));
  });

  it("plain graphs carry no frames (the field is absent, not empty)", async () => {
    await mermaidReady;
    const doc = wasmMermaidEngine.parse("graph TD\nA --> B")!;
    expect("groups" in doc).toBe(false);
    const model = buildBoardModel(doc, measure);
    expect(model.nodes.every((n) => n.kind !== "group")).toBe(true);
  });
});

describe("layoutGraph", () => {
  const items = [
    { id: "A", w: 80, h: 40, order: 0 },
    { id: "B", w: 90, h: 40, order: 1 },
    { id: "C", w: 70, h: 40, order: 2 },
    { id: "D", w: 90, h: 40, order: 3 },
  ];

  it("ranks along edges (A→B→C puts each on its own rank, TD)", async () => {
    await mermaidReady;
    const { positions } = layoutGraph({ items, edges: [{ from: "A", to: "B" }, { from: "B", to: "C" }], direction: "TD" });
    expect(positions.get("B")!.y).toBeGreaterThan(positions.get("A")!.y);
    expect(positions.get("C")!.y).toBeGreaterThan(positions.get("B")!.y);
  });

  it("siblings of one rank never overlap and share a row (TD)", async () => {
    await mermaidReady;
    const { positions } = layoutGraph({ items, edges: [{ from: "A", to: "B" }, { from: "A", to: "C" }], direction: "TD" });
    const b = positions.get("B")!;
    const c = positions.get("C")!;
    expect(b.y).toBe(c.y);
    expect(overlap({ ...b, w: 90, h: 40 }, { ...c, w: 70, h: 40 })).toBe(false);
    expect(positions.get("A")!.y).toBeLessThan(b.y);
  });

  it("LR grows horizontally with rank; RL mirrors it", async () => {
    await mermaidReady;
    const lr = layoutGraph({ items, edges: [{ from: "A", to: "B" }], direction: "LR" });
    expect(lr.positions.get("B")!.x).toBeGreaterThan(lr.positions.get("A")!.x);
    const rl = layoutGraph({ items, edges: [{ from: "A", to: "B" }], direction: "RL" });
    expect(rl.positions.get("B")!.x).toBeLessThan(rl.positions.get("A")!.x);
  });

  it("cycles do not hang and every node is placed", async () => {
    await mermaidReady;
    const { positions } = layoutGraph({ items, edges: [{ from: "A", to: "B" }, { from: "B", to: "A" }, { from: "C", to: "D" }], direction: "TD" });
    for (const id of ["A", "B", "C", "D"]) expect(positions.has(id)).toBe(true);
  });

  it("is deterministic — two runs produce identical output", async () => {
    await mermaidReady;
    const run = () => layoutGraph({ items, edges: [{ from: "A", to: "C" }, { from: "A", to: "B" }, { from: "B", to: "D" }], direction: "TD" });
    expect(run()).toEqual(run());
  });
});

describe("buildBoardModel", () => {
  it("flowchart: nodes and labeled edges carry through, arrows set", async () => {
    await mermaidReady;
    const model = buildBoardModel(wasmMermaidEngine.parse("graph TD\nA[Start] -->|go| B{Q}") as never, measure);
    expect(model.nodes.map((n) => n.id)).toEqual(["n:A", "n:B"]);
    expect(model.edges).toEqual([
      {
        id: "e:0",
        from: "n:A",
        to: "n:B",
        style: "bezier",
        // a flow edge toward a later rank leaves the source's bottom and
        // enters the target's top (see "flowchart routing" below)
        anchorFrom: "bottom",
        anchorTo: "top",
        dashed: false,
        arrow: "solid",
        label: "go",
      },
    ]);
    expect(model.suggestedHeight).toBeGreaterThanOrEqual(200);
  });

  it("sequence: participant headers, lifelines, message junctions and self-loop vias", async () => {
    await mermaidReady;
    const model = buildBoardModel(
      wasmMermaidEngine.parse("sequenceDiagram\nparticipant A\nA ->> B: hi\nB -->> A: yo\nA ->> A: note") as never,
      measure,
    );
    const ids = new Set(model.nodes.map((n) => n.id));
    expect(ids.has("p:A")).toBe(true);
    expect(ids.has("p:B")).toBe(true);
    expect(ids.has("j:life:A")).toBe(true);
    expect(model.edges.some((e) => e.id === "e:life:A" && e.dashed && e.arrow === "none")).toBe(true);
    const hi = model.edges.find((e) => e.label === "hi");
    expect(hi).toMatchObject({ dashed: false, arrow: "open", style: "straight" });
    const note = model.edges.find((e) => e.label === "note");
    expect(note?.via).toHaveLength(2);
    // Participants sit side by side (no overlap).
    const pa = model.nodes.find((n) => n.id === "p:A")!;
    const pb = model.nodes.find((n) => n.id === "p:B")!;
    expect(overlap(pa, pb)).toBe(false);
  });

  it("class: cards keep member-driven heights and inheritance edges arrow", async () => {
    await mermaidReady;
    const model = buildBoardModel(
      wasmMermaidEngine.parse("classDiagram\nclass A {\n+x: i32\n}\nclass B {\n}\nA <|-- B") as never,
      measure,
    );
    const a = model.nodes.find((n) => n.id === "n:A")!;
    const b = model.nodes.find((n) => n.id === "n:B")!;
    expect(a.h).toBeGreaterThan(b.h);
    // `A <|-- B`: ranking keeps A (parent) above B, but the rendered
    // edge is END-SWAPPED so the hollow inheritance triangle (open
    // marker) lands on the parent — mermaid's adornment position.
    expect(model.edges[0]).toMatchObject({ from: "n:B", to: "n:A", arrow: "open", dashed: false });
  });

  it("gantt: sequential tasks advance, deps push starts, axis exists", async () => {
    await mermaidReady;
    const model = buildBoardModel(
      wasmMermaidEngine.parse("gantt\nsection S\none : t1, 2d\ntwo : t2, 3d\nthree : t3, after t1, 1d") as never,
      measure,
    );
    const bar = (name: string): { x: number; w: number } => {
      const node = model.nodes.find((n) => n.data.name === name && n.kind === "task")!;
      return { x: node.x, w: node.w };
    };
    expect(model.nodes.some((n) => n.id === "ax")).toBe(true);
    const t1 = bar("one");
    const t2 = bar("two");
    const t3 = bar("three");
    expect(t2.x).toBeGreaterThanOrEqual(t1.x + t1.w); // section cursor
    expect(t3.x).toBeGreaterThanOrEqual(t1.x + t1.w); // after t1
    expect(model.edges.some((e) => e.from === "g:0" && e.to === "g:2" && e.dashed)).toBe(true);
  });

  it("pie and quadrant render as a single painter card", async () => {
    await mermaidReady;
    const pie = buildBoardModel(wasmMermaidEngine.parse('pie\n"a": 1\n"b": 2') as never, measure);
    expect(pie.nodes).toHaveLength(1);
    expect(pie.nodes[0].kind).toBe("pie");
    const quad = buildBoardModel(wasmMermaidEngine.parse("quadrantChart\np: [0.5, 0.5]") as never, measure);
    expect(quad.nodes).toHaveLength(1);
    expect(quad.nodes[0].kind).toBe("quadrant");
  });
});

// ── Pins for the mutation survivors (R3 round, fb0c426c) ──────────────

describe("layout pin tests (mutation survivors)", () => {
  it("barycenter reorders a rank by neighbor position (B→X, A→Y flips X/Y)", async () => {
    await mermaidReady;
    const items = [
      { id: "A", w: 80, h: 40, order: 0 },
      { id: "B", w: 80, h: 40, order: 1 },
      { id: "X", w: 80, h: 40, order: 2 },
      { id: "Y", w: 80, h: 40, order: 3 },
    ];
    const { positions } = layoutGraph({ items, edges: [{ from: "B", to: "X" }, { from: "A", to: "Y" }], direction: "TD" });
    // Without the barycenter pass X (parse order first) would stay left
    // of Y; with it Y follows its parent A and X follows B.
    expect(positions.get("Y")!.x).toBeLessThan(positions.get("X")!.x);
    expect(positions.get("A")!.x).toBeLessThan(positions.get("B")!.x);
  });

  it("sequence messages stack one row step apart", async () => {
    await mermaidReady;
    const model = buildBoardModel(
      wasmMermaidEngine.parse("sequenceDiagram\nA ->> B: one\nA ->> B: two\nA ->> B: three") as never,
      measure,
    );
    const rows = model.nodes
      .filter((n) => n.id.startsWith("j:m:") && n.id.endsWith(":f"))
      .map((n) => n.y)
      .sort((a, b) => a - b);
    expect(rows).toHaveLength(3);
    expect(rows[1] - rows[0]).toBe(44);
    expect(rows[2] - rows[1]).toBe(44);
  });

  it("a gantt dep ACROSS sections pushes the start past the section cursor", async () => {
    await mermaidReady;
    const model = buildBoardModel(
      wasmMermaidEngine.parse([
        "gantt",
        "section One",
        "long : t1, 5d",
        "section Two",
        "later : t2, after t1, 1d",
      ].join("\n")) as never,
      measure,
    );
    const bar = (name: string) => {
      const n = model.nodes.find((x) => x.data.name === name && x.kind === "task");
      if (!n) throw new Error(`no bar ${name}`);
      return n;
    };
    const t1 = bar("long");
    const t2 = bar("later");
    // Section Two's own cursor restarts at 0 — only the dep can push t2
    // past t1's end (this is the mutation the single-section golden
    // could never catch: there the cursor dominated the dep).
    expect(t2.x).toBeGreaterThanOrEqual(t1.x + t1.w);
  });

  it("suggestHeight lets a tall diagram grow to 720px so the fit stays legible", async () => {
    await mermaidReady;
    // Ten nodes down one trunk: ~736px of content. The board fits whatever
    // height it is given, and the old 540px cap parked this diagram at 62%
    // (14px labels drawn at 8.7px, docs.celestia.world 2026-11-27).
    const tall = buildBoardModel(
      wasmMermaidEngine.parse(
        ["flowchart TD", ...Array.from({ length: 10 }, (_, i) => `N${i}[node ${i}] --> N${i + 1}[node ${i + 1}]`)].join("\n"),
      ) as never,
      measure,
    );
    expect(tall.height).toBeGreaterThan(700);
    expect(tall.suggestedHeight).toBe(720);
  });

  it("suggestHeight floors at 200px for tiny content", async () => {
    await mermaidReady;
    const model = buildBoardModel(wasmMermaidEngine.parse("sequenceDiagram\nA ->> B: x") as never, measure);
    expect(model.suggestedHeight).toBeGreaterThanOrEqual(200);
    const bare = buildBoardModel(wasmMermaidEngine.parse("sequenceDiagram\nparticipant Only") as never, measure);
    expect(bare.suggestedHeight).toBe(200);
  });
});

describe("feedbackArcSet", () => {
  const items = (ids: string[]) => ids.map((id, order) => ({ id, w: 10, h: 10, order }));
  const withIndex = (edges: Array<{ from: string; to: string }>) => edges.map((e, index) => ({ ...e, index }));

  it("reads exactly one edge of a cycle backwards — the one that closes it", () => {
    const edges = withIndex([{ from: "A", to: "B" }, { from: "B", to: "C" }, { from: "C", to: "D" }, { from: "D", to: "B" }]);
    expect([...feedbackArcSet(items(["A", "B", "C", "D"]), edges)]).toEqual([3]);
  });

  it("starts at the true sources, so a node parsed before its feeder is not made the back edge", () => {
    // B and C are parsed first, but R is the only indegree-0 node: the
    // search starts there and the cycle closes on C → A, not on A → B.
    const edges = withIndex([{ from: "R", to: "A" }, { from: "A", to: "B" }, { from: "B", to: "C" }, { from: "C", to: "A" }]);
    expect([...feedbackArcSet(items(["B", "C", "A", "R"]), edges)]).toEqual([3]);
  });
});

describe("flowchart routing — arrows dock on the border they enter", () => {
  const DECISION = [
    "flowchart TD",
    "  A[Start] --> B{Is it?}",
    "  B -->|Yes| C[OK]",
    "  C --> D[Rethink]",
    "  D --> B",
    "  B -->|No| E[End]",
    "  C --> E",
  ].join("\n");
  const parse = async (source: string) => {
    await mermaidReady;
    return buildBoardModel(wasmMermaidEngine.parse(source) as never, measure);
  };
  const nodeY = (model: { nodes: Array<{ id: string; y: number }> }, id: string): number =>
    model.nodes.find((n) => n.id === `n:${id}`)!.y;

  it("a cycle keeps the decision ABOVE its outputs (only the retry edge is read backwards)", async () => {
    const model = await parse(DECISION);
    // Start → Is it? → OK / End → Rethink. The old ranker stalled on the
    // cycle and drew the diamond BELOW everything that follows it.
    expect(nodeY(model, "A")).toBeLessThan(nodeY(model, "B"));
    expect(nodeY(model, "B")).toBeLessThan(nodeY(model, "C"));
    expect(nodeY(model, "B")).toBeLessThan(nodeY(model, "E"));
    expect(nodeY(model, "C")).toBeLessThan(nodeY(model, "D"));
  });

  it("forward edges leave the stack-growing side and arrive on the opposite one", async () => {
    const model = await parse(DECISION);
    const edge = (from: string, to: string) => model.edges.find((e) => e.from === `n:${from}` && e.to === `n:${to}`)!;
    expect(edge("A", "B")).toMatchObject({ anchorFrom: "bottom", anchorTo: "top" });
    expect(edge("B", "C")).toMatchObject({ anchorFrom: "bottom", anchorTo: "top" });
    expect(edge("C", "E")).toMatchObject({ anchorFrom: "bottom", anchorTo: "top" });
    // the retry edge loops around ONE side instead of running through the
    // ranks between its ends
    expect(edge("D", "B")).toMatchObject({ anchorFrom: "left", anchorTo: "left" });
  });

  it("BT mirrors the docking: a forward edge leaves through the TOP", async () => {
    const model = await parse("flowchart BT\nA --> B");
    expect(model.edges[0]).toMatchObject({ from: "n:A", to: "n:B", anchorFrom: "top", anchorTo: "bottom" });
  });

  it("LR: a fan-out leaves the source's right side and arrives on each target's left", async () => {
    const model = await parse("flowchart LR\nS --> A\nS --> B\nS --> C");
    for (const e of model.edges) expect(e).toMatchObject({ anchorFrom: "right", anchorTo: "left" });
    // same rank = one COLUMN in LR: the siblings stack vertically, in parse order
    const a = model.nodes.find((n) => n.id === "n:A")!;
    const b = model.nodes.find((n) => n.id === "n:B")!;
    expect(a.x).toBe(b.x);
    expect(a.y).toBeLessThan(b.y);
    expect(overlap(a, b)).toBe(false);
  });

  it("a back edge loops around the side its source has free", async () => {
    const model = await parse([
      "flowchart TD",
      "  S((start)) --> D{ready?}",
      "  D -->|yes| R[run]",
      "  D -->|no| W[wait]",
      "  W --> D",
      "  R --> E((end))",
    ].join("\n"));
    const loop = model.edges.find((e) => e.from === "n:W" && e.to === "n:D")!;
    // `run` sits beside `wait` on the left, so the loop goes around the right
    expect(loop).toMatchObject({ anchorFrom: "right", anchorTo: "right" });
  });

  it("an edge that skips ranks runs down a lane of its own, clear of the ranks between", async () => {
    const model = await parse("flowchart TD\nT[top] --> A[rank 1]\nA --> B[rank 2]\nB --> C[rank 3]\nT --> C");
    const skip = model.edges.find((e) => e.from === "n:T" && e.to === "n:C")!;
    expect(skip.via?.length).toBe(2);
    const between = ["n:A", "n:B"].map((id) => model.nodes.find((n) => n.id === id)!);
    for (const id of skip.via!) {
      const j = model.nodes.find((n) => n.id === id)!;
      expect(j.hidden).toBe(true);
      for (const node of between) {
        expect(overlap({ x: j.x - 1, y: j.y - 1, w: 2, h: 2 }, node)).toBe(false);
      }
    }
  });

  it("a self-loop is drawn: out of and back into the same border, around two corners", async () => {
    const model = await parse("flowchart TD\nA[retry] --> A\nA --> B[done]");
    const loop = model.edges.find((e) => e.from === "n:A" && e.to === "n:A")!;
    expect(loop).toMatchObject({ anchorFrom: "right", anchorTo: "right", arrow: "solid" });
    expect(loop.via?.length).toBe(2);
    const a = model.nodes.find((n) => n.id === "n:A")!;
    for (const id of loop.via!) {
      const j = model.nodes.find((n) => n.id === id)!;
      expect(j.hidden).toBe(true);
      expect(j.x).toBeGreaterThan(a.x + a.w);
    }
  });

  it("an edge into a cluster orders the node before the cluster's members, and out of it after", async () => {
    const model = await parse([
      "flowchart TD",
      "  subgraph outer[Outer]",
      "    subgraph inner[Inner]",
      "      B[one] --> C[two]",
      "    end",
      "    A[outside inner]",
      "  end",
      "  A --> B",
      "  C --> D[after]",
      "  D --> outer",
      "  outer --> E[end]",
    ].join("\n"));
    expect(nodeY(model, "A")).toBeLessThan(nodeY(model, "B"));
    // the node AFTER the cluster and the node the cluster feeds both sit
    // below every member — beside each other, as mermaid.js draws them
    for (const id of ["A", "B", "C"]) expect(nodeY(model, id)).toBeLessThan(nodeY(model, "D"));
    expect(nodeY(model, "E")).toBe(nodeY(model, "D"));
    // and the cluster edges still land on the frame
    expect(model.edges[3]).toMatchObject({ from: "n:D", to: "g:outer", anchorTo: "nearest" });
    expect(model.edges[4]).toMatchObject({ from: "g:outer", to: "n:E", anchorFrom: "nearest" });
  });
});

describe("flowchart routing — review round 2 pins", () => {
  const parse = async (source: string) => {
    await mermaidReady;
    return buildBoardModel(wasmMermaidEngine.parse(source) as never, measure);
  };

  it("a self-loop stands off the cross-axis side in every flow direction", async () => {
    // TD/BT loop on the RIGHT border, LR/RL on the BOTTOM border: the side
    // the outgoing edges do NOT use. The two corners sit SELF_LOOP_OUT
    // (26px) beyond that border, SELF_LOOP_ALONG (15px) either side of its
    // midpoint — so the route leaves the anchor along the border normal,
    // swings around them and comes back head-on.
    const expectLoop = (dir: "TD" | "BT" | "LR" | "RL", side: "right" | "bottom") => {
      const model = buildBoardModel(
        wasmMermaidEngine.parse(`flowchart ${dir}\nA[retry] --> A\nA --> B[done]`) as never,
        measure,
      );
      const a = model.nodes.find((n) => n.id === "n:A")!;
      const loop = model.edges.find((e) => e.from === "n:A" && e.to === "n:A")!;
      expect(loop).toMatchObject({ anchorFrom: side, anchorTo: side });
      const [ja, jb] = loop.via!.map((id) => model.nodes.find((n) => n.id === id)!);
      if (side === "right") {
        const midY = a.y + a.h / 2;
        for (const j of [ja, jb]) expect(j.x).toBe(Math.round(a.x + a.w + 26));
        expect(ja.y).toBeLessThan(midY);
        expect(jb.y).toBeGreaterThan(midY);
        // junction coordinates are rounded to whole world px
        expect(Math.abs((midY - ja.y) - (jb.y - midY))).toBeLessThanOrEqual(1);
      } else {
        const midX = a.x + a.w / 2;
        for (const j of [ja, jb]) expect(j.y).toBe(Math.round(a.y + a.h + 26));
        expect(ja.x).toBeLessThan(midX);
        expect(jb.x).toBeGreaterThan(midX);
        expect(Math.abs((midX - ja.x) - (jb.x - midX))).toBeLessThanOrEqual(1);
      }
    };
    expectLoop("TD", "right");
    expectLoop("BT", "right");
    expectLoop("LR", "bottom");
    expectLoop("RL", "bottom");
  });

  it("a back edge is defined by the cycle breaker, not by an accident of parse order", async () => {
    // The decision loop written with its edges in the OTHER order: B→A,
    // C→B, D→C, B→D. The cycle is B→D→C→B and the search closes it on
    // C→B — so C→B is the back edge (it loops around the side) and B→A is
    // an ordinary forward edge however it is numbered.
    const items = ["A", "B", "C", "D"].map((id, order) => ({ id, w: 80, h: 40, order }));
    const out = layoutGraph({
      items,
      edges: [{ from: "B", to: "A" }, { from: "C", to: "B" }, { from: "D", to: "C" }, { from: "B", to: "D" }],
      direction: "TD",
    });
    expect(out.backEdges).toEqual([1]);
    expect(out.ranks.get("B")).toBe(0);
    expect(out.ranks.get("C")).toBe(2);
    // every remaining edge spans one rank, so nothing needs a lane
    expect(out.lanes).toEqual([]);

    // With a rank-skipping forward edge AND a cycle in the same graph, only
    // the forward edge gets a lane; the back edge loops around the side.
    const mixed = layoutGraph({
      items: ["T", "A", "B", "C"].map((id, order) => ({ id, w: 80, h: 40, order })),
      edges: [{ from: "T", to: "A" }, { from: "A", to: "B" }, { from: "B", to: "C" }, { from: "T", to: "C" }, { from: "C", to: "T" }],
      direction: "TD",
    });
    expect(mixed.backEdges).toEqual([4]);
    expect(mixed.lanes.map((lane) => lane.edge)).toEqual([3]);
    expect(mixed.lanes[0].points).toHaveLength(2);
  });

  it("a back edge with a sibling on the RIGHT loops left; with siblings on both sides or none it takes the default side", async () => {
    const siblingRight = await parse([
      "flowchart TD",
      "  S((start)) --> D{ready?}",
      "  D -->|no| W[wait]",
      "  D -->|yes| R[run]",
      "  W --> D",
      "  R --> E((end))",
    ].join("\n"));
    // `wait` is now the LEFT sibling of `run`, so its loop goes around the left
    expect(siblingRight.edges.find((e) => e.from === "n:W" && e.to === "n:D")).toMatchObject({
      anchorFrom: "left",
      anchorTo: "left",
    });

    const only = await parse("flowchart TD\nS --> D{again?}\nD -->|no| W[wait]\nW --> D\nD -->|yes| E((end))");
    // no same-rank sibling: the TD default side is left
    expect(only.edges.find((e) => e.from === "n:W" && e.to === "n:D")).toMatchObject({ anchorFrom: "left" });

    const both = await parse("flowchart TD\nS --> M[middle]\nS --> L[left]\nS --> R[right]\nM --> M");
    // a self-loop is not a back edge, but the middle node has siblings on
    // both sides and must still draw its loop on the default cross side
    expect(both.edges.find((e) => e.from === "n:M" && e.to === "n:M")).toMatchObject({ anchorFrom: "right" });
  });

  it("the cycle breaker's choice is a valid feedback arc set: ranking always completes", async () => {
    // Every node of a pure 5-cycle has indegree 1; nothing is a source.
    const ring = ["a", "b", "c", "d", "e"];
    const items = ring.map((id, order) => ({ id, w: 40, h: 40, order }));
    const edges = ring.map((id, i) => ({ from: id, to: ring[(i + 1) % ring.length] }));
    const out = layoutGraph({ items, edges, direction: "TD" });
    expect(out.backEdges.length).toBe(1);
    for (const id of ring) expect(out.positions.has(id)).toBe(true);
    // …and removing that one edge leaves a DAG: ranks strictly increase
    // along every remaining edge.
    for (const [i, e] of edges.entries()) {
      if (out.backEdges.includes(i)) continue;
      expect(out.ranks.get(e.to)!).toBeGreaterThan(out.ranks.get(e.from)!);
    }
  });
});

describe("node shape sizing", () => {
  /** Build a one-node graph of `shape` and read back the laid-out box. */
  const sizeOf = async (shape: string): Promise<{ w: number; h: number }> => {
    await mermaidReady;
    // The grammar takes the shape from BRACKET syntax (`A([text])`), not the
    // `@{ shape: … }` attribute form mermaid also accepts, so this walks the
    // bracket spellings.
    const bracket: Record<string, string> = {
      rect: "[same label]",
      rounded: "(same label)",
      diamond: "{same label}",
      circle: "((same label))",
      stadium: "([same label])",
      subroutine: "[[same label]]",
      cylinder: "[(same label)]",
      hexagon: "{{same label}}",
      parallelogram: "[/same label/]",
      asymmetric: ">same label]",
      doublecircle: "(((same label)))",
    };
    const doc = wasmMermaidEngine.parse(`flowchart TD\n  A${bracket[shape]}\n`);
    expect(doc, `${shape} must parse`).not.toBeNull();
    const model = buildBoardModel(doc as never, measure);
    const n = model.nodes.find((x) => x.id === "n:A")!;
    return { w: n.w, h: n.h };
  };

  it("gives the slanted/rounded outline family extra slack over a plain rect", async () => {
    // The outline is drawn INSIDE the box, so a box sized for the label alone
    // would clip it. MUT: folding these shapes back into the rect branch
    // (the pre-wave default) turns this red.
    const rect = await sizeOf("rect");
    const wide = await sizeOf("hexagon");
    expect(wide.w).toBeGreaterThan(rect.w);
    expect(wide.h).toBeGreaterThan(rect.h);
    // Every member of the slack family shares that floor.
    for (const shape of ["stadium", "cylinder", "parallelogram", "doublecircle"]) {
      const s = await sizeOf(shape);
      expect(s.w, shape).toBeGreaterThan(rect.w);
    }
    // …while the plain boxes keep the roomier-but-tight default.
    const rounded = await sizeOf("rounded");
    expect(rounded.w).toBe(rect.w);
    // The subroutine/asymmetric pair sits between the two.
    const sub = await sizeOf("subroutine");
    expect(sub.w).toBeGreaterThan(rect.w);
    expect(sub.w).toBeLessThan(wide.w);
  });
});
