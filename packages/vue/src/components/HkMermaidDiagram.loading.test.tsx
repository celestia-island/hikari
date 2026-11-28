import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, h } from "vue";

import { setMermaidEngineForTests } from "../mermaid/engine";

vi.mock("../mermaid/wasmEngine", () => ({
  mermaidReady: new Promise<void>(() => {}),
}));

import HkMermaidDiagram from "./HkMermaidDiagram";

describe("HkMermaidDiagram loading state", () => {
  afterEach(() => setMermaidEngineForTests(null));

  it("shows the shared spinner while no parser is ready, never raw source", () => {
    // MUT:mermaid-loading-gate — marking the engine settled before its promise
    // settles catches immediately: the fallback source appears and the spinner
    // disappears, which is exactly the flash this contract forbids.
    setMermaidEngineForTests(null);
    const host = document.createElement("div");
    document.body.appendChild(host);
    const app = createApp({ render: () => h(HkMermaidDiagram, { source: "flowchart TD\nA-->B" }) });
    app.mount(host);
    expect(host.querySelector('[role="status"] .hk-spinner')).not.toBeNull();
    expect(host.querySelector(".hk-mermaid-fallback")).toBeNull();
    expect(host.textContent).not.toContain("flowchart TD");
    app.unmount();
    host.remove();
  });
});
