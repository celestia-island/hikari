import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick } from "vue";

import { setMermaidEngineForTests } from "../mermaid/engine";

const ready = vi.hoisted(() => {
  let settle!: () => void;
  const promise = new Promise<void>((resolve) => { settle = resolve; });
  return { promise, resolve: () => settle() };
});

vi.mock("../mermaid/wasmEngine", () => ({
  mermaidReady: ready.promise,
}));

import HkMermaidDiagram from "./HkMermaidDiagram";

describe("HkMermaidDiagram loading state", () => {
  afterEach(() => setMermaidEngineForTests(null));

  it("shows the shared spinner while pending, then replaces it with the board", async () => {
    // MUT:mermaid-loading-gate — marking the engine settled before its promise
    // settles catches immediately: the fallback source appears and the spinner
    // disappears, which is exactly the flash this contract forbids.
    let allowDocument = false;
    setMermaidEngineForTests({
      parse: () => allowDocument ? ({
        kind: "graph",
        variant: "flowchart",
        direction: "TD",
        nodes: [
          { id: "A", label: "A", shape: "rect" },
          { id: "B", label: "B", shape: "rect" },
        ],
        edges: [{ source: "A", target: "B", label: null, edgeType: "arrow" }],
      }) : null,
    });
    const host = document.createElement("div");
    document.body.appendChild(host);
    const app = createApp({ render: () => h(HkMermaidDiagram, { source: "flowchart TD\nA --> B" }) });
    app.mount(host);
    expect(host.querySelector('[role="status"] .hk-spinner')).not.toBeNull();
    expect(host.querySelector(".hk-mermaid-fallback")).toBeNull();
    expect(host.textContent).not.toContain("flowchart TD");

    // Drive the actual reactive seam: the engine OBJECT was registered from
    // the start, but its document only becomes available with the ready
    // promise. A mere registration must never select the source fallback.
    allowDocument = true;
    ready.resolve();
    await nextTick();
    await new Promise((r) => setTimeout(r, 0));
    await nextTick();
    expect(host.querySelector(".hk-board"), host.innerHTML).not.toBeNull();
    expect(host.querySelector('[role="status"] .hk-spinner')).toBeNull();
    expect(host.querySelector(".hk-mermaid-fallback")).toBeNull();
    app.unmount();
    host.remove();
  });
});
