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
