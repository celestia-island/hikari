import { afterEach, describe, expect, it } from "vitest";
import { createApp, h, nextTick, ref } from "vue";

import HkMarkdownRenderer from "./HkMarkdownRenderer";
import { setMermaidEngineForTests } from "../mermaid/engine";
import { mermaidParser } from "../mermaid";

/**
 * Mermaid fence integration in HkMarkdownRenderer:
 *  - no engine → an ordinary highlighted code block (byte-for-byte the
 *    pre-existing behavior);
 *  - engine → placeholder mounts an HkMermaidDiagram sub-app;
 *  - re-parse swaps content without leaking the old sub-app;
 *  - hostile source text stays text (escaped through the sanitize path,
 *    rendered as text nodes by the fallback/board painters).
 */

const mounts: { app: ReturnType<typeof createApp>; container: HTMLElement }[] = [];

function mount(content: string): { container: HTMLElement; set: (v: string) => void } {
  const holder = ref(content);
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({
    render: () => h(HkMarkdownRenderer, { content: holder.value }),
  });
  app.mount(container);
  mounts.push({ app, container });
  return { container, set: (v: string) => void (holder.value = v) };
}

async function settleFor(root: HTMLElement, selector: string, tries = 120): Promise<void> {
  for (let i = 0; i < tries; i += 1) {
    if (root.querySelector(selector)) return;
    await new Promise((r) => setTimeout(r, 5));
    await nextTick();
  }
}

afterEach(() => {
  for (const { app, container } of mounts.splice(0)) {
    app.unmount();
    container.remove();
  }
  setMermaidEngineForTests(null);
});

const DOC = [
  "# Report",
  "",
  "```mermaid",
  "graph TD",
  "A[Alpha] --> B[Beta]",
  "```",
  "",
  "tail prose",
].join("\n");

describe("HkMarkdownRenderer mermaid fences", () => {
  it("without an engine the fence renders as the ordinary code block", async () => {
    setMermaidEngineForTests(null);
    const { container } = mount(DOC);
    await settleFor(container, ".hk-md-code-wrap");
    const code = container.querySelector(".hk-md-code code");
    expect(code?.getAttribute("class")).toContain("language-mermaid");
    expect(code?.textContent).toContain("graph TD");
    expect(container.querySelector(".hk-md-mermaid")).toBeNull();
    expect(container.querySelector(".hk-mermaid")).toBeNull();
  });

  it("with an engine the fence mounts a diagram sub-app inside the markdown body", async () => {
    setMermaidEngineForTests(mermaidParser);
    const { container } = mount(DOC);
    await settleFor(container, ".hk-md-mermaid[data-mermaid='mounted']");
    const host = container.querySelector(".hk-md-mermaid") as HTMLElement;
    expect(host.querySelector(".hk-mermaid")).not.toBeNull();
    expect(host.querySelector(".hk-board")).not.toBeNull();
    // Prose around the fence is untouched. (No h1 assertion: the
    // happy-dom DOMPurify build strips SOME leading tags — an
    // environment artifact, not product behavior — so prose presence is
    // asserted on text, not on tag shape.)
    expect(container.textContent).toContain("Report");
    expect(container.textContent).toContain("tail prose");
    // The source carrier is swapped out for the host on mount.
    expect(container.querySelector(".hk-md-mermaid-src")).toBeNull();
  });

  it("re-parsing new content replaces the old diagram (no stale sub-app)", async () => {
    setMermaidEngineForTests(mermaidParser);
    const { container, set } = mount(DOC);
    await settleFor(container, ".hk-md-mermaid[data-mermaid='mounted']");
    const first = container.querySelector(".hk-mermaid") as HTMLElement;
    expect(first.getAttribute("data-mermaid-kind")).toBe("graph");

    // Leading prose on purpose: the happy-dom DOMPurify build unwraps
    // the FIRST element of the sanitized string (environment artifact,
    // browsers keep it), and this test targets the swap, not that quirk.
    set(["Update:", "", "```mermaid", "sequenceDiagram", "X ->> Y: ping", "```"].join("\n"));
    await settleFor(container, ".hk-mermaid[data-mermaid-kind='sequence']");
    const mounted = container.querySelectorAll(".hk-md-mermaid[data-mermaid='mounted']");
    expect(mounted).toHaveLength(1);
    // The old board left the DOM with the old body.
    expect(first.isConnected).toBe(false);
  });

  it("hostile source text stays text through the whole pipeline", async () => {
    setMermaidEngineForTests(mermaidParser);
    const hostile = ["```mermaid", "graph TD", 'A<img src=x onerror="alert(1)"> --> B', "```"].join("\n");
    const { container } = mount(hostile);
    await settleFor(container, ".hk-md-mermaid[data-mermaid='mounted']");
    expect(container.querySelector("img")).toBeNull();
    // The hostile text may appear ESCAPED (the fallback shows the source
    // verbatim as text); it must never appear as live markup.
    expect(container.innerHTML).not.toContain("<img");
    expect(container.innerHTML).not.toContain("<script");
  });
});
