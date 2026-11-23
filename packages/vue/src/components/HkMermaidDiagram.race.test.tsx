// The engine loads asynchronously now, so a diagram can mount before it lands.
// That first parse returns the fallback; the component must re-parse once
// `mermaidReady` settles, or the board stays a code block for its whole life.
//
// MUT:engine-epoch — every other HkMermaidDiagram case awaits `mermaidReady`
// *before* mounting, so none of them enter this window; deleting the
// `engineEpoch` retry keeps the fallback where the board should appear.
import { afterEach, describe, expect, it } from "vitest";
import { createApp, h, nextTick } from "vue";

import HkMermaidDiagram from "./HkMermaidDiagram";
import { setMermaidEngineForTests } from "../mermaid/engine";
import { mermaidParser } from "../mermaid";

const FLOWCHART = "graph TD\nA[Start] --> B{Choice}";

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

afterEach(() => {
  for (const { app, container } of mounts.splice(0)) {
    app.unmount();
    container.remove();
  }
  setMermaidEngineForTests(null);
});

describe("HkMermaidDiagram mounted before the engine is ready", () => {
  it("replaces the fallback with the board once the engine lands", async () => {
    setMermaidEngineForTests(mermaidParser);
    // No `await mermaidReady` here on purpose: mounting immediately is the case.
    const container = document.createElement("div");
    document.body.appendChild(container);
    const app = createApp({
      render: () => h(HkMermaidDiagram, { source: FLOWCHART } as never),
    });
    app.mount(container);
    mounts.push({ app, container });

    // MUT:engine-epoch — without the reactive retry the fallback below never
    // gives way to `.hk-board`, which is what this asserts against.
    for (let i = 0; i < 200 && !container.querySelector(".hk-board"); i++) {
      await nextTick();
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    expect(container.querySelector(".hk-board")).not.toBeNull();
    expect(container.querySelector(".hk-mermaid-fallback")).toBeNull();
  });
});
