import { afterEach, describe, expect, it } from "vitest";
import { createApp, h, nextTick } from "vue";

import HkMermaidDiagram from "./HkMermaidDiagram";
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
    const c = mount({ source: FLOWCHART });
    await settle();
    expect(c.querySelector(".hk-mermaid")?.getAttribute("data-mermaid-kind")).toBe("graph");
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
    const c = mount({ source: "graph LR\nA -->" });
    await settle();
    expect(c.querySelector(".hk-mermaid-fallback")).not.toBeNull();
    expect(c.querySelector(".hk-board")).toBeNull();
  });

  it("minimap=false hides the corner map; grid defaults off", async () => {
    setMermaidEngineForTests(mermaidParser);
    const c = mount({ source: FLOWCHART, minimap: false });
    await settle();
    expect(c.querySelector(".hk-board-minimap")).toBeNull();
    const grid = c.querySelector(".hk-board-grid") as HTMLElement;
    expect(grid.style.display).toBe("none");
  });

  it("minimap defaults on (the caller decides the chrome)", async () => {
    setMermaidEngineForTests(mermaidParser);
    const c = mount({ source: FLOWCHART });
    await settle();
    expect(c.querySelector(".hk-board-minimap")).not.toBeNull();
  });

  it("sequence renders participant lanes and message labels", async () => {
    setMermaidEngineForTests(mermaidParser);
    const c = mount({ source: "sequenceDiagram\nClient ->> Server: request\nServer -->> Client: response" });
    await settle();
    expect([...c.querySelectorAll(".hk-mmd-participant")].map((el) => el.textContent)).toEqual(["Client", "Server"]);
    const labels = [...c.querySelectorAll(".hk-board-edge-label")].map((el) => el.textContent);
    expect(labels).toContain("request");
    expect(labels).toContain("response");
  });

  it("changing the source re-parses (computed pipeline, no stale board)", async () => {
    setMermaidEngineForTests(mermaidParser);
    const container = document.createElement("div");
    document.body.appendChild(container);
    const app = createApp({
      data: () => ({ source: FLOWCHART }),
      render() {
        return h(HkMermaidDiagram, { source: (this as { source: string }).source });
      },
    });
    app.mount(container);
    mounts.push({ app, container });
    await settle();
    expect(container.querySelector(".hk-mermaid")?.getAttribute("data-mermaid-kind")).toBe("graph");
    (app as unknown as { _instance: { proxy: { source: string } } })._instance.proxy.source = "sequenceDiagram\nA ->> B: x";
    await settle();
    expect(container.querySelector(".hk-mermaid")?.getAttribute("data-mermaid-kind")).toBe("sequence");
    container.remove();
  });
});

// ── R2/R3 fix regression pins ────────────────────────────────────────

describe("mermaid fix pins (R2/R3)", () => {
  it("quadrant points plot on the 0..1 domain across the frame (S1 regression)", async () => {
    setMermaidEngineForTests(mermaidParser);
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
    const c = mount({ source: "gantt\ntitle Sprint\nsection S\none : t1, 2d" });
    await settle();
    const headers = [...c.querySelectorAll(".hk-mmd-section--header")].map((el) => el.textContent);
    expect(headers).toContain("Sprint");
  });

  it("pie legend shows computed percentages", async () => {
    setMermaidEngineForTests(mermaidParser);
    const c = mount({ source: 'pie\n"a": 3\n"b": 7' });
    await settle();
    const values = [...c.querySelectorAll(".hk-mmd-pie__legend-value")].map((el) => el.textContent);
    expect(values).toEqual(["3 · 30%", "7 · 70%"]);
  });
});
