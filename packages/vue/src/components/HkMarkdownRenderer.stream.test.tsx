// AI-generated: developed with the DeepSeek Harness agent (model DeepSeek V4.1 Flash); human-directed.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick, ref } from "vue";
import { marked } from "marked";

import HkMarkdownRenderer from "./HkMarkdownRenderer";

/**
 * Streaming (S2) contract for HkMarkdownRenderer.
 *
 * A streamed body (chat delta, agent trace, report being assembled) arrives
 * one chunk per token batch. Every chunk used to run the whole pipeline —
 * marked.parse over the entire body, DOMPurify, the DOMParser URL sweep and
 * an innerHTML replacement — so n chunks over a body of length L cost
 * O(n·L) parse work for O(L) of text: quadratic in the reply length. These
 * cases pin the two fixes:
 *
 *  - coalescing: a burst of chunks renders at most twice (leading edge +
 *    one trailing parse of the LATEST content), never once per chunk;
 *  - memo: a chrome flip (inlineChips) re-seats the markup the component
 *    already holds instead of paying a second full parse for the same body.
 *
 * `marked.parse` is the honest counter for "a full body render": it is the
 * first and most expensive stage of the pipeline, and it runs exactly once
 * per parse that actually happens.
 */

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

function mountContent(initial: string) {
  const holder = ref(initial);
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({
    render: () => h(HkMarkdownRenderer, { content: holder.value }),
  });
  app.mount(container);
  mounts.push({ app, container });
  return { container, set: (v: string) => { holder.value = v; } };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function settleFor(root: HTMLElement, text: string, tries = 240): Promise<void> {
  for (let i = 0; i < tries; i += 1) {
    if ((root.textContent ?? "").includes(text)) return;
    await sleep(5);
    await nextTick();
  }
}

let parseSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  // Same module instance the renderer lazily imports and parses through.
  parseSpy = vi.spyOn(marked, "parse");
});

afterEach(() => {
  parseSpy.mockRestore();
  for (const { app, container } of mounts.splice(0)) {
    app.unmount();
    container.remove();
  }
});

describe("HkMarkdownRenderer streaming", () => {
  it("collapses a burst of content updates into at most two full parses", async () => {
    const { container, set } = mountContent("stream start");
    await settleFor(container, "stream start");
    const initialParses = parseSpy.mock.calls.length;
    expect(initialParses).toBe(1);

    // Let the coalescing window close so the burst starts from an idle
    // renderer — the leading edge is then immediate, as it is for the first
    // paint of a settled body.
    await sleep(80);
    let text = "stream start";
    for (let i = 1; i <= 10; i += 1) {
      text = `${text} chunk-${i}`;
      set(text);
      // One Vue flush per chunk: the cadence a token stream really has
      // (chunks land in successive ticks, far faster than a frame).
      await nextTick();
    }

    // Trailing edge: the LAST chunk is always rendered, whatever the window.
    await settleFor(container, "chunk-10");
    const extra = parseSpy.mock.calls.length - initialParses;
    // Ten chunks used to mean ten parses of the whole growing body.
    expect(extra).toBeGreaterThanOrEqual(1);
    expect(extra).toBeLessThanOrEqual(2);
    expect(container.textContent).toContain("chunk-1 chunk-2 chunk-3");
  });

  it("renders every chunk that arrives after a quiet period (leading edge stays live)", async () => {
    const { container, set } = mountContent("idle body");
    await settleFor(container, "idle body");
    const initialParses = parseSpy.mock.calls.length;
    // Two chunks paced well beyond the window are two separate renders — a
    // throttle that sat on them would delay a non-streaming update for no
    // reason.
    set("idle body plus one");
    await settleFor(container, "plus one");
    set("idle body plus one and two");
    await settleFor(container, "and two");
    expect(parseSpy.mock.calls.length - initialParses).toBe(2);
  });

  it("re-seats the held markup for an inlineChips flip instead of re-parsing", async () => {
    const content = "Badge {{container_badge}} here";
    const holder = ref(content);
    const chips = ref(false);
    const container = document.createElement("div");
    document.body.appendChild(container);
    const app = createApp({
      render: () => h(HkMarkdownRenderer, { content: holder.value, inlineChips: chips.value }),
    });
    app.mount(container);
    mounts.push({ app, container });

    await settleFor(container, "here");
    const parses = parseSpy.mock.calls.length;
    expect(parses).toBe(1);
    expect(container.querySelector(".hk-tpl-chip")).toBeNull();

    chips.value = true;
    await nextTick();
    await sleep(30);
    await nextTick();

    // The chip pass ran on the SAME body: markup, not a second parse.
    expect(container.querySelector(".hk-tpl-chip")).not.toBeNull();
    expect(parseSpy.mock.calls.length).toBe(parses);

    // …and flipping it back re-seats the un-chipped html again, still free.
    chips.value = false;
    await nextTick();
    await sleep(30);
    await nextTick();
    expect(container.querySelector(".hk-tpl-chip")).toBeNull();
    expect(container.textContent).toContain("Badge");
    expect(parseSpy.mock.calls.length).toBe(parses);
  });

  it("a chunk landing mid-parse supersedes the older render (no stale body)", async () => {
    const { container, set } = mountContent("first body");
    await settleFor(container, "first body");
    // Two updates: the second lands while the first parse is still resolving
    // its imports/markup. The body must end on the newer text, never on the
    // older one that finished last.
    set("second body");
    set("third body");
    await settleFor(container, "third body");
    await sleep(80);
    await nextTick();
    expect(container.textContent).toContain("third body");
    expect(container.textContent).not.toContain("second body");
  });
});
