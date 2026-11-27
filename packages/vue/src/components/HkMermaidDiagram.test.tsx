import { afterEach, describe, expect, it } from "vitest";
import { createApp, h, nextTick, ref } from "vue";

import HkMermaidDiagram from "./HkMermaidDiagram";
import { buildBoardModel, heuristicTextWidth } from "../mermaid/layout";
import { wasmMermaidEngine, mermaidReady } from "../mermaid/wasmEngine";
import { setMermaidEngineForTests } from "../mermaid/engine";
import { mermaidParser } from "../mermaid";

/**
 * HkMermaidDiagram contract:
 *  - NO registered engine → the raw source in a fallback code block
 *    (never a broken surface) — the hljs convention economy;
 *  - engine + valid source → the HkBoard surface with per-kind painters;
 *  - engine + garbage → fallback code block;
 *  - `minimap`/`grid` chrome toggles pass through to the board.
 *
 * House style: raw createApp mounts torn down after each case; the
 * global engine is set/cleared per case, never leaked.
 */

const mounts: { app: ReturnType<typeof createApp>; container: HTMLElement }[] = [];

function mount(props: Record<string, unknown>): HTMLElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({ render: () => h(HkMermaidDiagram, props as never) });
  app.mount(container);
  mounts.push({ app, container });
  return container;
}

async function settle(): Promise<void> {
  await nextTick();
  await new Promise((r) => setTimeout(r, 0));
  await nextTick();
}

afterEach(() => {
  for (const { app, container } of mounts.splice(0)) {
    app.unmount();
    container.remove();
  }
  setMermaidEngineForTests(null);
});

const FLOWCHART = "graph TD\nA[Start] -->|go| B{Choice}\nB -->|yes| C((Done))";

describe("HkMermaidDiagram", () => {
  it("without a registered engine the source falls back to a code block", async () => {
    setMermaidEngineForTests(null);
    const c = mount({ source: FLOWCHART });
    await settle();
    expect(c.querySelector(".hk-mermaid-fallback pre code")?.textContent).toContain("graph TD");
    expect(c.querySelector(".hk-board")).toBeNull();
  });

  it("with the engine, a flowchart renders the board with shape painters", async () => {
    setMermaidEngineForTests(mermaidParser);
    await mermaidReady;
    const c = mount({ source: FLOWCHART });
    await settle();
    const wrap = c.querySelector(".hk-mermaid") as HTMLElement;
    expect(wrap.getAttribute("data-mermaid-kind")).toBe("graph");
    expect(wrap.getAttribute("role")).toBe("img");
    expect(wrap.getAttribute("aria-label")).toContain("mermaid graph diagram");
    expect(c.querySelector(".hk-board")).not.toBeNull();
    const labels = [...c.querySelectorAll(".hk-mmd-node__label")].map((el) => el.textContent);
    expect(labels).toEqual(["Start", "Choice", "Done"]);
    expect(c.querySelector(".hk-mmd-node--diamond")).not.toBeNull();
    expect(c.querySelector(".hk-mmd-node--circle")).not.toBeNull();
    // Edge label rides the board's SVG caption layer.
    expect([...c.querySelectorAll(".hk-board-edge-label")].map((el) => el.textContent)).toEqual(["go", "yes"]);
  });

  it("unparseable source falls back to the code block, engine present", async () => {
    setMermaidEngineForTests(mermaidParser);
    await mermaidReady;
    const c = mount({ source: "graph LR\nA -->" });
    await settle();
    expect(c.querySelector(".hk-mermaid-fallback")).not.toBeNull();
    expect(c.querySelector(".hk-board")).toBeNull();
  });

  it("minimap=false hides the zoom bar; grid defaults off", async () => {
    setMermaidEngineForTests(mermaidParser);
    await mermaidReady;
    const c = mount({ source: FLOWCHART, minimap: false });
    await settle();
    expect(c.querySelector(".hk-mermaid__toolbar")).toBeNull();
    expect(c.querySelector(".hk-mm-zoom-bar")).toBeNull();
    const grid = c.querySelector(".hk-board-grid") as HTMLElement;
    expect(grid.style.display).toBe("none");
  });

  it("minimap defaults on: the zoom bar sits in its own ROW under the board, never over it", async () => {
    setMermaidEngineForTests(mermaidParser);
    await mermaidReady;
    const c = mount({ source: FLOWCHART });
    await settle();
    const toolbar = c.querySelector(".hk-mermaid__toolbar")!;
    expect(toolbar.querySelector(".hk-mm-zoom-bar")).not.toBeNull();
    // No overlay dock inside the stage: at fit zoom the board's own
    // bottom-right dock covered the last node of every wide diagram.
    const stage = c.querySelector(".hk-mermaid__stage")!;
    expect(c.querySelector(".hk-board-minimap")).toBeNull();
    expect(c.querySelector(".hk-board")!.closest(".hk-mermaid__stage")).toBe(stage);
    // The bar FOLLOWS the stage in flow — it cannot cover anything.
    expect(toolbar.parentElement).toBe(c.querySelector(".hk-mermaid"));
    expect(toolbar.previousElementSibling).toBe(stage);
  });

  it("every arrow of a top-down flowchart ends along a vertical end tangent", async () => {
    setMermaidEngineForTests(mermaidParser);
    await mermaidReady;
    const c = mount({
      source: [
        "flowchart TD",
        "  A[markdown] --> B[pest parser]",
        "  B --> C[AST]",
        "  C -->|old lane| D[tairitsu VDom]",
        "  C --> E[knowledge.json]",
      ].join("\n"),
    });
    await settle();
    const arrows = [...c.querySelectorAll<SVGPathElement>(".hk-board-edge[marker-end]")];
    expect(arrows).toHaveLength(4);
    for (const path of arrows) {
      const d = path.getAttribute("d") ?? "";
      const legs = d.match(/C [^C]+/g) ?? [];
      const n = legs[legs.length - 1].slice(2).replace(/,/g, "").trim().split(/\s+/).map(Number);
      // second control point of the last cubic, then the end point
      expect(n[2], d).toBe(n[4]);
      expect(n[3], d).toBeLessThan(n[5]);
    }
  });

  it("edges and arrowheads carry the diagram ink, not the board's scene ink", async () => {
    setMermaidEngineForTests(mermaidParser);
    await mermaidReady;
    const c = mount({ source: "flowchart TD\nA --> B" });
    await settle();
    const ink = "rgb(var(--color-primary) / 62%)";
    expect(c.querySelector("marker path")!.getAttribute("fill")).toBe(ink);
    const path = c.querySelector<SVGPathElement>(".hk-board-edge")!;
    expect(path.getAttribute("stroke")).toBe(ink);
    expect(path.style.stroke).toBe(ink);
  });

  it("an edge that skips ranks is drawn THROUGH its lane (three legs, not one long curve)", async () => {
    setMermaidEngineForTests(mermaidParser);
    await mermaidReady;
    const c = mount({ source: "flowchart TD\nT[top] --> A[rank 1]\nA --> B[rank 2]\nB --> C[rank 3]\nT --> C" });
    await settle();
    const paths = [...c.querySelectorAll<SVGPathElement>(".hk-board-edge")];
    // the last edge declared (`T --> C`) spans three ranks
    const skip = paths[paths.length - 1];
    expect(skip.getAttribute("d")!.match(/C [^C]+/g)).toHaveLength(3);
    // a direct edge is a single cubic
    expect(paths[0].getAttribute("d")!.match(/C [^C]+/g)).toHaveLength(1);
    // and the lane's cells were emitted as hidden board nodes (zero-size)
    const inputs = (c.querySelector(".hk-board") as unknown as { __vueParentComponent?: { props: { nodes: Array<{ id: string; hidden?: boolean; w: number }> } } }).__vueParentComponent;
    const lane = (inputs?.props.nodes ?? []).filter((n) => n.id.startsWith("j:e3:"));
    expect(lane).toHaveLength(2);
    for (const j of lane) {
      expect(j.hidden).toBe(true);
      expect(j.w).toBe(0);
    }
  });

  it("sequence renders participant lanes and message labels", async () => {
    setMermaidEngineForTests(mermaidParser);
    await mermaidReady;
    const c = mount({ source: "sequenceDiagram\nClient ->> Server: request\nServer -->> Client: response" });
    await settle();
    expect([...c.querySelectorAll(".hk-mmd-participant")].map((el) => el.textContent)).toEqual(["Client", "Server"]);
    const labels = [...c.querySelectorAll(".hk-board-edge-label")].map((el) => el.textContent);
    expect(labels).toContain("request");
    expect(labels).toContain("response");
  });

  it("paints every grammar shape — none falls back to the plain code block", async () => {
    // The parser wave (2026-11-28) taught the grammar the shapes mermaid's
    // reference documents; a shape the painter does not know would still
    // render (as a rounded box), so this pin asserts the CLASS, not just
    // that something drew. MUT: dropping a variant from OUTLINE_SHAPES (or
    // from the TS union) turns the matching entry red.
    setMermaidEngineForTests(mermaidParser);
    await mermaidReady;
    const c = mount({
      source: [
        "flowchart LR",
        "A[rect] --> B([stadium])",
        "B --> C[[subroutine]]",
        "C --> D[(database)]",
        "D --> E{{hexagon}}",
        "E --> F[/para/]",
        "F --> G(((dc)))",
        "G --> H>asym]",
        "H --> I{trap-verbal}",
        "I --> J((circle))",
      ].join("\n"),
    });
    await settle();
    expect(c.querySelector(".hk-mermaid-fallback")).toBeNull();
    const painted = [...c.querySelectorAll(".hk-mmd-node")].map(
      (el) => [...el.classList].find((k) => k.startsWith("hk-mmd-node--") && k !== "hk-mmd-node--outline") ?? "",
    );
    expect(painted).toEqual([
      "hk-mmd-node--rect",
      "hk-mmd-node--stadium",
      "hk-mmd-node--subroutine",
      "hk-mmd-node--cylinder",
      "hk-mmd-node--hexagon",
      "hk-mmd-node--parallelogram",
      "hk-mmd-node--doublecircle",
      "hk-mmd-node--asymmetric",
      "hk-mmd-node--diamond",
      "hk-mmd-node--circle",
    ]);
    // …and the outline family really draws a path, not an empty shell.
    const outlines = [...c.querySelectorAll(".hk-mmd-node__outline")];
    expect(outlines).toHaveLength(7);
    for (const svg of outlines) expect(svg.children.length).toBeGreaterThan(0);
  });

  it("changing the source re-parses (computed pipeline, no stale board)", async () => {
    setMermaidEngineForTests(mermaidParser);
    await mermaidReady;
    const container = document.createElement("div");
    document.body.appendChild(container);
    const source = ref(FLOWCHART);
    const app = createApp({
      render: () => h(HkMermaidDiagram, { source: source.value }),
    });
    app.mount(container);
    mounts.push({ app, container });
    await settle();
    expect(container.querySelector(".hk-mermaid")?.getAttribute("data-mermaid-kind")).toBe("graph");
    source.value = "sequenceDiagram\nA ->> B: x";
    await settle();
    expect(container.querySelector(".hk-mermaid")?.getAttribute("data-mermaid-kind")).toBe("sequence");
    container.remove();
  });
});

// ── R2/R3 fix regression pins ────────────────────────────────────────

describe("mermaid fix pins (R2/R3)", () => {
  it("quadrant points plot on the 0..1 domain across the frame (S1 regression)", async () => {
    setMermaidEngineForTests(mermaidParser);
    await mermaidReady;
    const c = mount({ source: "quadrantChart\nx-axis Low --> High\np1: [0.3, 0.6]\np2: [0.78, 0.82]" });
    await settle();
    const circles = [...c.querySelectorAll(".hk-mmd-quadrant__point circle")] as SVGCircleElement[];
    expect(circles).toHaveLength(2);
    // Frame: L=56, PW=460 → x=0.3 ⇒ cx≈194; T=44, PH=336 → y=0.6 ⇒ cy≈178.4.
    expect(Number(circles[0].getAttribute("cx"))).toBeCloseTo(194, 0);
    expect(Number(circles[0].getAttribute("cy"))).toBeCloseTo(178.4, 0);
    expect(Number(circles[1].getAttribute("cx"))).toBeCloseTo(56 + 0.78 * 460, 0);
    // Points spread across the frame, not crammed in a corner.
    const cx0 = Number(circles[0].getAttribute("cx"));
    const cx1 = Number(circles[1].getAttribute("cx"));
    expect(Math.abs(cx1 - cx0)).toBeGreaterThan(100);
  });

  it("two mounted boards never mint colliding marker ids (S2 regression)", async () => {
    setMermaidEngineForTests(mermaidParser);
    await mermaidReady;
    const c1 = mount({ source: FLOWCHART });
    const c2 = mount({ source: "graph TD\nX[r] --> Y{q}" });
    await settle();
    const ids = [...document.querySelectorAll("marker[id^='hk-board-ah-']")].map((m) => m.id);
    expect(ids.length).toBeGreaterThanOrEqual(2);
    expect(new Set(ids).size).toBe(ids.length);
    // Every arrowed edge references a marker that actually exists.
    for (const path of document.querySelectorAll(".hk-board-edge[marker-end]")) {
      const url = path.getAttribute("marker-end") as string;
      const id = url.slice("url(#".length, -1);
      expect(ids).toContain(id);
    }
    void c1; void c2;
  });

  it("interactive=false leaves wheel events untouched; default intercepts them", async () => {
    setMermaidEngineForTests(mermaidParser);
    await mermaidReady;
    const locked = mount({ source: FLOWCHART, interactive: false });
    await settle();
    const boardEl = locked.querySelector(".hk-board") as HTMLElement;
    const wheel1 = new WheelEvent("wheel", { cancelable: true, deltaY: -10 });
    boardEl.dispatchEvent(wheel1);
    expect(wheel1.defaultPrevented).toBe(false);

    const free = mount({ source: FLOWCHART });
    await settle();
    const board2 = free.querySelector(".hk-board") as HTMLElement;
    const wheel2 = new WheelEvent("wheel", { cancelable: true, deltaY: -10 });
    board2.dispatchEvent(wheel2);
    expect(wheel2.defaultPrevented).toBe(true);
  });

  it("gantt title renders as the spanning header row", async () => {
    setMermaidEngineForTests(mermaidParser);
    await mermaidReady;
    const c = mount({ source: "gantt\ntitle Sprint\nsection S\none : t1, 2d" });
    await settle();
    const headers = [...c.querySelectorAll(".hk-mmd-section--header")].map((el) => el.textContent);
    expect(headers).toContain("Sprint");
  });

  it("pie legend shows computed percentages", async () => {
    setMermaidEngineForTests(mermaidParser);
    await mermaidReady;
    const c = mount({ source: 'pie\n"a": 3\n"b": 7' });
    await settle();
    const values = [...c.querySelectorAll(".hk-mmd-pie__legend-value")].map((el) => el.textContent);
    expect(values).toEqual(["3 · 30%", "7 · 70%"]);
  });
});

// ── Round-2 fix pins (R4/R5/R6) ──────────────────────────────────────

describe("round-2 fix pins", () => {
  it("diamond nodes paint a true rhombus polygon (S1 regression)", async () => {
    setMermaidEngineForTests(mermaidParser);
    await mermaidReady;
    const c = mount({ source: "graph TD\nA[Start] --> B{Is the data ok?}" });
    await settle();
    const poly = c.querySelector(".hk-mmd-node__diamond polygon") as SVGPolygonElement;
    expect(poly).not.toBeNull();
    const pts = (poly.getAttribute("points") ?? "").split(" ").map((p) => p.split(",").map(Number));
    // Rhombus: four vertices — top mid, right mid, bottom mid, left mid.
    expect(pts).toHaveLength(4);
    const [w, h] = (() => {
      const xs = pts.map((p) => p[0]);
      const ys = pts.map((p) => p[1]);
      return [Math.max(...xs), Math.max(...ys)];
    })();
    expect(pts[0]).toEqual([w / 2, 0]);
    expect(pts[1]).toEqual([w, h / 2]);
    expect(pts[2]).toEqual([w / 2, h]);
    expect(pts[3]).toEqual([0, h / 2]);
  });

  it("class adornments land on the mermaid-correct end (S2 regression)", async () => {
    setMermaidEngineForTests(mermaidParser);
    await mermaidReady;
    const c = mount({ source: "classDiagram\nclass Parent {\n}\nclass Child {\n}\nParent <|-- Child" });
    await settle();
    // The inheritance triangle must sit on the PARENT lane: the rendered
    // edge is swapped so marker-end targets n:Parent, while ranking still
    // places Parent above Child.
    const paths = [...c.querySelectorAll("path.hk-board-edge[marker-end]")] as SVGPathElement[];
    expect(paths).toHaveLength(1);
    // Direction from path d: starts at Child's rank (below), ends at Parent.
    const d = paths[0].getAttribute("d") ?? "";
    const nums = d.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
    const startY = nums[1];
    const endY = nums[nums.length - 1];
    expect(endY).toBeLessThan(startY);
  });

  it("out-of-range quadrant points clamp onto the frame (R5 pin)", async () => {
    setMermaidEngineForTests(mermaidParser);
    await mermaidReady;
    const c = mount({ source: "quadrantChart\nlo: [-0.5, 0.2]\nhi: [1.5, 0.8]" });
    await settle();
    const circles = [...c.querySelectorAll(".hk-mmd-quadrant__point circle")] as SVGCircleElement[];
    // Frame x: 56..516, y: 44..380.
    const cx0 = Number(circles[0].getAttribute("cx"));
    const cy0 = Number(circles[0].getAttribute("cy"));
    const cx1 = Number(circles[1].getAttribute("cx"));
    expect(cx0).toBeCloseTo(56, 0);
    expect(cy0).toBeGreaterThan(43);
    expect(cx1).toBeCloseTo(516, 0);
  });

  it("gantt space-separated multi-deps parse as real deps and dedupe repeats (R8)", async () => {
    setMermaidEngineForTests(mermaidParser);
    await mermaidReady;
    const c = mount({ source: "gantt\nsection S\none : t1, 2d\nother : t0, 1d\ntwo : t2, after t1 t0 t1, 1d" });
    await settle();
    // `after t1 t0 t1` ⇒ deps [t1, t0] (space-split + dedupe), and t2's
    // bar starts past BOTH dependencies' ends.
    const model = buildBoardModel(
      wasmMermaidEngine.parse("gantt\nsection S\none : t1, 2d\nother : t0, 1d\ntwo : t2, after t1 t0 t1, 1d") as never,
      heuristicTextWidth,
    );
    const bar = (name: string) => {
      const n = model.nodes.find((x) => x.data.name === name && x.kind === "task");
      if (!n) throw new Error(`missing bar ${name}`);
      return n;
    };
    const t1 = bar("one");
    const t0 = bar("other");
    const t2 = bar("two");
    expect(t2.x).toBeGreaterThanOrEqual(Math.max(t1.x + t1.w, t0.x + t0.w));
    // Rows: one→g:0, other→g:1, two→g:2 — two dependency edges land on
    // "two" (dedupe collapsed the repeated t1).
    expect(model.edges.filter((e) => e.to === "g:2")).toHaveLength(2);
    void c;
  });
});
