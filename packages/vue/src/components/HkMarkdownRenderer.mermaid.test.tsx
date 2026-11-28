import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick, ref } from "vue";
import { marked } from "marked";

import HkMarkdownRenderer from "./HkMarkdownRenderer";
import { setMermaidEngineForTests } from "../mermaid/engine";
import { mermaidReady } from "../mermaid/wasmEngine";
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
    await mermaidReady;
    const { container } = mount(DOC);
    await settleFor(container, ".hk-md-mermaid[data-mermaid='mounted']");
    const host = container.querySelector(".hk-md-mermaid") as HTMLElement;
    expect(host.querySelector(".hk-mermaid")).not.toBeNull();
    expect(host.querySelector(".hk-board")).not.toBeNull();
    // MUT:markdown-viewport-policy — bypassing HkMermaidDiagram's defaults in
    // this consumer never passes: the prose path shares the 40vh cap and fit
    // ceiling, while minimap=false also removes the minimap fit reserve.
    expect((host.querySelector(".hk-mermaid__stage") as HTMLElement).style.maxHeight).toBe("40vh");
    const board = host.querySelector(".hk-board") as unknown as {
      __vueParentComponent?: { props: Record<string, unknown> };
    };
    expect(board.__vueParentComponent?.props).toMatchObject({
      minimap: false,
      fitEndReserve: 0,
      fitCap: 1,
      zoomLadder: "percent",
    });
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
    await mermaidReady;
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
    await mermaidReady;
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

// ── Lifecycle pins (R3 survivors: prune + teardown) ───────────────────

describe("mermaid sub-app lifecycle pins", () => {
  it("re-parse unmounts the stale sub-app (no leaked __vue_app__)", async () => {
    setMermaidEngineForTests(mermaidParser);
    await mermaidReady;
    const { container, set } = mount(DOC);
    await settleFor(container, ".hk-md-mermaid[data-mermaid='mounted']");
    const stale = container.querySelector(".hk-md-mermaid") as HTMLElement;
    expect((stale as { __vue_app__?: unknown }).__vue_app__).toBeTruthy();

    set(["Update:", "", "```mermaid", "sequenceDiagram", "X ->> Y: ping", "```"].join("\n"));
    await settleFor(container, ".hk-mermaid[data-mermaid-kind='sequence']");
    // The stale host left the document AND its app was unmounted.
    expect(stale.isConnected).toBe(false);
    expect((stale as { __vue_app__?: unknown }).__vue_app__).toBeUndefined();
  });

  it("renderer teardown unmounts every mermaid sub-app", async () => {
    setMermaidEngineForTests(mermaidParser);
    await mermaidReady;
    const { container } = mount(DOC);
    await settleFor(container, ".hk-md-mermaid[data-mermaid='mounted']");
    const host = container.querySelector(".hk-md-mermaid") as HTMLElement;
    expect((host as { __vue_app__?: unknown }).__vue_app__).toBeTruthy();

    const entry = mounts[mounts.length - 1];
    entry.app.unmount();
    expect((host as { __vue_app__?: unknown }).__vue_app__).toBeUndefined();
    expect(host.isConnected).toBe(false);
  });
});

// ── Streaming reuse (S2) ───────────────────────────────────────────────
// A streamed reply re-emits every fence above the growing tail byte for
// byte on every chunk. The diagram under such a fence must survive the
// re-parse: unmounting a live board and mounting a byte-identical one is
// the expensive half of a mermaid block (engine layout), and it is the
// half the fence text itself can rule out.
describe("mermaid streaming reuse", () => {
  /** Poll for a text token (the body is innerHTML, not vdom). */
  async function settleForText(root: HTMLElement, text: string, tries = 160): Promise<void> {
    for (let i = 0; i < tries; i += 1) {
      if ((root.textContent ?? "").includes(text)) return;
      await new Promise((r) => setTimeout(r, 5));
      await nextTick();
    }
  }

  it("reuses the mounted diagram when the fence source is unchanged", async () => {
    setMermaidEngineForTests(mermaidParser);
    await mermaidReady;
    const parseSpy = vi.spyOn(marked, "parse");
    try {
      const { container, set } = mount(DOC);
      await settleFor(container, ".hk-md-mermaid[data-mermaid='mounted']");
      const host = container.querySelector(".hk-md-mermaid") as HTMLElement;
      const board = host.querySelector(".hk-board");
      expect(board).not.toBeNull();
      expect(parseSpy).toHaveBeenCalledTimes(1);

      // The stream appends prose BELOW the fence — the fence text is
      // byte-identical, so the rendered board must ride along.
      set(`${DOC}\n\nmore streamed prose`);
      await settleForText(container, "more streamed prose");
      await nextTick();
      expect(parseSpy).toHaveBeenCalledTimes(2); // the BODY was re-parsed…

      const after = container.querySelector(".hk-md-mermaid") as HTMLElement;
      expect(after).toBe(host); // …and the diagram node was not rebuilt
      expect(host.isConnected).toBe(true);
      expect(host.querySelector(".hk-board")).toBe(board); // same live board
      expect(container.querySelectorAll(".hk-md-mermaid")).toHaveLength(1);
    } finally {
      parseSpy.mockRestore();
    }
  });

  it("still rebuilds the diagram when the fence source itself changes", async () => {
    setMermaidEngineForTests(mermaidParser);
    await mermaidReady;
    const { container, set } = mount(DOC);
    await settleFor(container, ".hk-md-mermaid[data-mermaid='mounted']");
    const first = container.querySelector(".hk-md-mermaid") as HTMLElement;

    // Streaming INTO the fence: the source grows, so the board must be new.
    set(DOC.replace("A[Alpha] --> B[Beta]", "A[Alpha] --> B[Beta]\n  B --> C[Gamma]"));
    await settleForText(container, "Gamma");
    await new Promise((r) => setTimeout(r, 60));
    await nextTick();
    const fresh = container.querySelector(".hk-md-mermaid") as HTMLElement;
    expect(fresh).not.toBe(first);
    expect(first.isConnected).toBe(false);
    expect((first as { __vue_app__?: unknown }).__vue_app__).toBeUndefined();
  });

  it("retires the sub-app when the fence disappears from the body", async () => {
    setMermaidEngineForTests(mermaidParser);
    await mermaidReady;
    const { container, set } = mount(DOC);
    await settleFor(container, ".hk-md-mermaid[data-mermaid='mounted']");
    const host = container.querySelector(".hk-md-mermaid") as HTMLElement;

    set("prose only now");
    await settleForText(container, "prose only now");
    await new Promise((r) => setTimeout(r, 60));
    await nextTick();
    expect(container.querySelector(".hk-md-mermaid")).toBeNull();
    expect((host as { __vue_app__?: unknown }).__vue_app__).toBeUndefined();
  });
});
