import { describe, expect, it } from "vitest";

import { buildBoardModel, heuristicTextWidth, layoutGraph } from "../../mermaid/layout";
import { parseMermaid } from "../../mermaid/parse";

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

describe("layoutGraph", () => {
  const items = [
    { id: "A", w: 80, h: 40, order: 0 },
    { id: "B", w: 90, h: 40, order: 1 },
    { id: "C", w: 70, h: 40, order: 2 },
    { id: "D", w: 90, h: 40, order: 3 },
  ];

  it("ranks along edges (A→B→C puts each on its own rank, TD)", () => {
    const { positions } = layoutGraph({ items, edges: [{ from: "A", to: "B" }, { from: "B", to: "C" }], direction: "TD" });
    expect(positions.get("B")!.y).toBeGreaterThan(positions.get("A")!.y);
    expect(positions.get("C")!.y).toBeGreaterThan(positions.get("B")!.y);
  });

  it("siblings of one rank never overlap and share a row (TD)", () => {
    const { positions } = layoutGraph({ items, edges: [{ from: "A", to: "B" }, { from: "A", to: "C" }], direction: "TD" });
    const b = positions.get("B")!;
    const c = positions.get("C")!;
    expect(b.y).toBe(c.y);
    expect(overlap({ ...b, w: 90, h: 40 }, { ...c, w: 70, h: 40 })).toBe(false);
    expect(positions.get("A")!.y).toBeLessThan(b.y);
  });

  it("LR grows horizontally with rank; RL mirrors it", () => {
    const lr = layoutGraph({ items, edges: [{ from: "A", to: "B" }], direction: "LR" });
    expect(lr.positions.get("B")!.x).toBeGreaterThan(lr.positions.get("A")!.x);
    const rl = layoutGraph({ items, edges: [{ from: "A", to: "B" }], direction: "RL" });
    expect(rl.positions.get("B")!.x).toBeLessThan(rl.positions.get("A")!.x);
  });

  it("cycles do not hang and every node is placed", () => {
    const { positions } = layoutGraph({ items, edges: [{ from: "A", to: "B" }, { from: "B", to: "A" }, { from: "C", to: "D" }], direction: "TD" });
    for (const id of ["A", "B", "C", "D"]) expect(positions.has(id)).toBe(true);
  });

  it("is deterministic — two runs produce identical output", () => {
    const run = () => layoutGraph({ items, edges: [{ from: "A", to: "C" }, { from: "A", to: "B" }, { from: "B", to: "D" }], direction: "TD" });
    expect(run()).toEqual(run());
  });
});

describe("buildBoardModel", () => {
  it("flowchart: nodes and labeled edges carry through, arrows set", () => {
    const model = buildBoardModel(parseMermaid("graph TD\nA[Start] -->|go| B{Q}") as never, measure);
    expect(model.nodes.map((n) => n.id)).toEqual(["n:A", "n:B"]);
    expect(model.edges).toEqual([
      { id: "e:0", from: "n:A", to: "n:B", style: "bezier", dashed: false, arrow: "solid", label: "go" },
    ]);
    expect(model.suggestedHeight).toBeGreaterThanOrEqual(200);
  });

  it("sequence: participant headers, lifelines, message junctions and self-loop vias", () => {
    const model = buildBoardModel(
      parseMermaid("sequenceDiagram\nparticipant A\nA ->> B: hi\nB -->> A: yo\nA ->> A: note") as never,
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

  it("class: cards keep member-driven heights and inheritance edges arrow", () => {
    const model = buildBoardModel(
      parseMermaid("classDiagram\nclass A {\n+x: i32\n}\nclass B {\n}\nA <|-- B") as never,
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

  it("gantt: sequential tasks advance, deps push starts, axis exists", () => {
    const model = buildBoardModel(
      parseMermaid("gantt\nsection S\none : t1, 2d\ntwo : t2, 3d\nthree : t3, after t1, 1d") as never,
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

  it("pie and quadrant render as a single painter card", () => {
    const pie = buildBoardModel(parseMermaid('pie\n"a": 1\n"b": 2') as never, measure);
    expect(pie.nodes).toHaveLength(1);
    expect(pie.nodes[0].kind).toBe("pie");
    const quad = buildBoardModel(parseMermaid("quadrantChart\np: [0.5, 0.5]") as never, measure);
    expect(quad.nodes).toHaveLength(1);
    expect(quad.nodes[0].kind).toBe("quadrant");
  });
});

// ── Pins for the mutation survivors (R3 round, fb0c426c) ──────────────

describe("layout pin tests (mutation survivors)", () => {
  it("barycenter reorders a rank by neighbor position (B→X, A→Y flips X/Y)", () => {
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

  it("sequence messages stack one row step apart", () => {
    const model = buildBoardModel(
      parseMermaid("sequenceDiagram\nA ->> B: one\nA ->> B: two\nA ->> B: three") as never,
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

  it("a gantt dep ACROSS sections pushes the start past the section cursor", () => {
    const model = buildBoardModel(
      parseMermaid([
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

  it("suggestHeight floors at 200px for tiny content", () => {
    const model = buildBoardModel(parseMermaid("sequenceDiagram\nA ->> B: x") as never, measure);
    expect(model.suggestedHeight).toBeGreaterThanOrEqual(200);
    const bare = buildBoardModel(parseMermaid("sequenceDiagram\nparticipant Only") as never, measure);
    expect(bare.suggestedHeight).toBe(200);
  });
});
