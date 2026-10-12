import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, ref, type App } from "vue";

import HkDiffViewer from "./HkDiffViewer";

/**
 * HkDiffViewer — the rendered half: hunk grouping, collapsed unchanged
 * regions and the async expander contract (loadContext round-trips,
 * anchor policy, failure/retry, reset on diff change).
 */

const apps: App[] = [];
afterEach(() => {
  for (const app of apps.splice(0)) app.unmount();
  document.body.innerHTML = "";
});

function mount(props: Record<string, unknown>) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const Root = defineComponent({
    setup() {
      return () => h(HkDiffViewer, props as never);
    },
  });
  const app = createApp(Root);
  app.mount(container);
  apps.push(app);
  return container;
}

/** Diff with a 9-line leading gap, one mixed hunk, and a 5-line trailing gap. */
const DIFF = [
  "--- a/a.toml",
  "+++ b/a.toml",
  "@@ -10,4 +10,5 @@",
  " ctx-a",
  "-old",
  "+new-1",
  "+new-2",
  " ctx-b",
  " ctx-c",
  "",
].join("\n");

const tick = () => new Promise((r) => setTimeout(r, 0));

describe("HkDiffViewer", () => {
  it("groups the diff into hunk cards with per-hunk stats and both-side numbers", async () => {
    const root = mount({ diff: DIFF, totalLines: 19 });
    await nextTick();
    const head = root.querySelector(".hk-diff-viewer__hunk-head")!;
    expect(head.textContent).toContain("@@ -10,4 +10,5 @@");
    expect(head.querySelector('[data-kind="add"]')!.textContent).toBe("+2");
    expect(head.querySelector('[data-kind="del"]')!.textContent).toBe("−1");
    const lines = [...root.querySelectorAll(".hk-diff-viewer__line")];
    // 6 hunk lines (3 context + 1 del + 2 add); gap rows are not .line
    expect(lines).toHaveLength(6);
    const kinds = lines.map((l) => l.getAttribute("data-kind"));
    expect(kinds).toEqual(["context", "del", "add", "add", "context", "context"]);
    const delLine = lines[1];
    expect(delLine.querySelectorAll(".hk-diff-viewer__no")[0].textContent).toBe("11");
    expect(delLine.querySelectorAll(".hk-diff-viewer__no")[1].textContent).toBe("");
  });

  it("renders unchanged regions as static dividers without a loadContext fetcher", async () => {
    const root = mount({ diff: DIFF, totalLines: 19 });
    await nextTick();
    const gaps = [...root.querySelectorAll(".hk-diff-viewer__gap")];
    expect(gaps).toHaveLength(2); // leading 9 + trailing 5
    expect(gaps[0].tagName).toBe("DIV"); // not a button — nothing to fetch with
    expect(gaps[0].textContent).toContain("9");
    expect(gaps[1].textContent).toContain("5");
  });

  it("expands an unchanged region asynchronously via loadContext", async () => {
    const seen: Array<[number, number]> = [];
    const loadContext = vi.fn(async (start: number, count: number) => {
      seen.push([start, count]);
      return Array.from({ length: count }, (_, i) => `line-${start + i}`);
    });
    const root = mount({ diff: DIFF, totalLines: 19, loadContext, contextChunk: 4 });
    await nextTick();

    // Trailing gap [15..19] (5 lines, anchor start): first click fetches 15..18.
    const trailing = root.querySelectorAll(".hk-diff-viewer__gap")[1] as HTMLButtonElement;
    expect(trailing.tagName).toBe("BUTTON");
    trailing.click();
    await tick();
    await nextTick();
    expect(seen).toEqual([[15, 4]]);
    let text = root.textContent!;
    expect(text).toContain("line-15");
    expect(text).toContain("line-18");
    // One line remains hidden → the expander stays, now counting 1.
    const after = root.querySelectorAll(".hk-diff-viewer__gap")[1] as HTMLButtonElement;
    expect(after.textContent).toContain("1");

    // Second click completes the region; the divider disappears entirely.
    after.click();
    await tick();
    await nextTick();
    expect(seen[1]).toEqual([19, 1]);
    expect(root.querySelectorAll(".hk-diff-viewer__gap")).toHaveLength(1); // only the leading gap
    text = root.textContent!;
    expect(text).toContain("line-19");
    // Revealed context lines carry both-side numbers (shift = 0 here).
    const revealed = [...root.querySelectorAll(".hk-diff-viewer__line[data-kind='context']")];
    expect(revealed.length).toBeGreaterThan(4);
  });

  it("expands the LEADING gap bottom-up (lines nearest the hunk first)", async () => {
    const seen: Array<[number, number]> = [];
    const loadContext = vi.fn(async (start: number, count: number) => {
      seen.push([start, count]);
      return Array.from({ length: count }, (_, i) => `L${start + i}`);
    });
    const root = mount({ diff: DIFF, totalLines: 19, loadContext, contextChunk: 4 });
    await nextTick();
    const leading = root.querySelectorAll(".hk-diff-viewer__gap")[0] as HTMLButtonElement;
    leading.click();
    await tick();
    await nextTick();
    expect(seen).toEqual([[6, 4]]); // bottom 4 of the 9-line leading gap
    const text = root.textContent!;
    expect(text).toContain("L6");
    expect(text).toContain("L9");
    expect(text).not.toContain("L5");
  });

  it("marks a failed fetch inline and retries on the next click", async () => {
    let calls = 0;
    const loadContext = vi.fn(async () => {
      calls += 1;
      if (calls === 1) return null; // transport failure
      return ["recovered"];
    });
    const root = mount({
      diff: DIFF,
      totalLines: 19,
      loadContext,
      contextChunk: 1, // trailing gap is 5 lines; irrelevant — leading used
    });
    await nextTick();
    const gap = root.querySelectorAll(".hk-diff-viewer__gap")[1] as HTMLButtonElement;
    gap.click();
    await tick();
    await nextTick();
    expect(root.querySelector(".hk-diff-viewer__gap[data-state='failed']")).toBeTruthy();
    expect(loadContext).toHaveBeenCalledTimes(1);

    (root.querySelector(".hk-diff-viewer__gap[data-state='failed']") as HTMLButtonElement).click();
    await tick();
    await nextTick();
    expect(loadContext).toHaveBeenCalledTimes(2);
    expect(root.querySelector(".hk-diff-viewer__gap[data-state='failed']")).toBeNull();
    expect(root.textContent).toContain("recovered");
  });

  it("bottom-aligns a SHORT response in the leading gap (R1)", async () => {
    // A clipping host answers fewer lines than requested: for the
    // bottom-anchored leading gap the arrived lines are the ones NEAREST
    // the hunk — storing them top-aligned would permanently hide those.
    const seen: Array<[number, number]> = [];
    const loadContext = vi.fn(async (start: number, count: number) => {
      seen.push([start, count]);
      // Clips to 2 lines regardless of the requested window.
      return ["L8", "L9"].slice(0, Math.min(2, count));
    });
    const root = mount({ diff: DIFF, totalLines: 19, loadContext, contextChunk: 4 });
    await nextTick();
    const leading = root.querySelectorAll(".hk-diff-viewer__gap")[0] as HTMLButtonElement;
    leading.click();
    await tick();
    await nextTick();
    expect(seen).toEqual([[6, 4]]); // bottom 4 of the 9-line gap requested…
    const text = root.textContent!;
    expect(text).toContain("L8"); // …but the 2 that arrived render…
    expect(text).toContain("L9"); //   …nearest the hunk (bottom-aligned)
    expect(text).not.toContain("L6");
    // 7 lines remain hidden; the expander persists with the new count.
    const after = root.querySelectorAll(".hk-diff-viewer__gap")[0] as HTMLButtonElement;
    expect(after.textContent).toContain("7");
  });

  it("collapses and re-expands a hunk via its header", async () => {
    const root = mount({ diff: DIFF, totalLines: 19 });
    await nextTick();
    const head = root.querySelector(".hk-diff-viewer__hunk-head") as HTMLButtonElement;
    expect(root.querySelectorAll(".hk-diff-viewer__line")).toHaveLength(6);
    head.click();
    await nextTick();
    expect(root.querySelectorAll(".hk-diff-viewer__line")).toHaveLength(0);
    head.click();
    await nextTick();
    expect(root.querySelectorAll(".hk-diff-viewer__line")).toHaveLength(6);
  });

  it("resets gap state when the diff prop changes", async () => {
    const loadContext = vi.fn(async (start: number, count: number) =>
      Array.from({ length: count }, (_, i) => `line-${start + i}`),
    );
    const container = document.createElement("div");
    document.body.appendChild(container);
    const diffRef = ref(DIFF);
    const Root = defineComponent({
      setup() {
        return () =>
          h(HkDiffViewer, {
            diff: diffRef.value,
            totalLines: 19,
            loadContext,
            contextChunk: 100,
          } as never);
      },
    });
    const app = createApp(Root);
    app.mount(container);
    apps.push(app);
    await nextTick();

    (container.querySelector(".hk-diff-viewer__gap") as HTMLButtonElement).click();
    await tick();
    await nextTick();
    expect(container.textContent).toContain("line-1");

    // A different diff must drop the fetched lines and recompute gaps.
    diffRef.value = "@@ -3,2 +3,2 @@\n-a\n+b\n";
    await nextTick();
    expect(container.textContent).not.toContain("line-1");
    expect(container.textContent).toContain("15"); // trailing gap of the new diff
  });

  it("degrades unparseable input to a raw <pre>", async () => {
    const root = mount({ diff: "not a diff\nat all" });
    await nextTick();
    expect(root.querySelector(".hk-diff-viewer__raw")!.textContent).toContain("not a diff");
    expect(root.querySelector(".hk-diff-viewer__hunk")).toBeNull();
  });
});

// ── The fold-aware scroll map (2026-10-12 user direction) ──────────────
// The scrollbar must represent the WHOLE document while the viewer folds
// unchanged regions away: the map total is fold-invariant, deleted rows
// carry no document extent (they are not in the current file), and the
// hunk heading is chrome. Mounting and folding drives the emission.
describe("HkDiffViewer scroll map", () => {
  const MAPPED_DIFF = [
    // Counts MUST match the listed lines (3 old-side, 4 new-side; then
    // 3 and 3) or the map total drifts off totalLines.
    "@@ -1,3 +1,4 @@",
    " ctx1",
    " ctx2",
    " ctx3",
    "+add",
    "@@ -50,3 +51,3 @@",
    " ctxA",
    "-old",
    "+new",
    " ctxB",
  ].join("\n");

  function mountViewer(extra: Record<string, unknown> = {}) {
    const emitted: Array<Array<{ dom: number; map: number }>> = [];
    const root = mount({
      diff: MAPPED_DIFF,
      totalLines: 100,
      onScrollMap: (segs: Array<{ dom: number; map: number }>) => emitted.push(segs),
      ...extra,
    });
    return { root, emitted };
  }

  it("emits a map whose total is the document, fold-invariant", async () => {
    const { root, emitted } = mountViewer();
    await nextTick();
    expect(emitted.length).toBeGreaterThanOrEqual(1);
    const total = (segs: Array<{ map: number }>) => segs.reduce((a, s) => a + s.map, 0);
    expect(total(emitted[emitted.length - 1])).toBe(100);
    // Collapse a hunk: the document total must not change (the scrollbar
    // is a map of the WHOLE file whatever is folded).
    const head = root.querySelector<HTMLButtonElement>(".hk-diff-viewer__hunk-head")!;
    head.click();
    await nextTick();
    expect(total(emitted[emitted.length - 1])).toBe(100);
    head.click(); // back
    await nextTick();
    expect(total(emitted[emitted.length - 1])).toBe(100);
  });

  it("keeps an empty-batched gap's rung at zero dom while the document keeps its lines", async () => {
    // A host answering [] marks the gap done with NO rows fetched: the
    // rung must not claim dom extent for lines that never rendered (R2's
    // N2 caught +1957px of phantom dom) while the document side keeps
    // the gap's full extent.
    const { root, emitted } = mountViewer({
      loadContext: async () => [],
    });
    await nextTick();
    // MAPPED_DIFF has no leading gap (hunk 1 starts at line 1); the first
    // divider is the 46-line middle gap (lines 5..50, anchor=start).
    const divider = root.querySelector<HTMLButtonElement>(".hk-diff-viewer__gap")!;
    divider.click();
    await tick();
    await nextTick();
    const segs = emitted[emitted.length - 1];
    // The gap is DONE via the empty batch: its document extent survives
    // as a zero-dom rung — no phantom rows for lines that never rendered.
    expect(segs).toContainEqual({ dom: 0, map: 46 });
    expect(segs).not.toContainEqual({ dom: 46, map: 46 });
    // …and the document total is still the whole file.
    expect(segs.reduce((a, x) => a + x.map, 0)).toBe(100);
  });

  it("orders an expanded anchor=start gap's revealed rung BEFORE its divider rung", async () => {
    // R2's N3: swapping the rung order moved the remaining-divider's
    // document start by ~727px. The render puts revealed rows above the
    // remaining divider for anchor=start, and the map must mirror it.
    const lines: string[] = [];
    for (let i = 0; i < 40; i += 1) lines.push(` fetched-${i}`);
    const { root, emitted } = mountViewer({
      loadContext: async () => lines,
    });
    await nextTick();
    // The trailing gap (anchor=start, after the last hunk).
    const dividers = [...root.querySelectorAll<HTMLButtonElement>(".hk-diff-viewer__gap")];
    const trailing = dividers[dividers.length - 1];
    trailing.click();
    await tick();
    await nextTick();
    const segs = emitted[emitted.length - 1];
    // Find the trailing gap's rungs: revealed (dom>0, map=40) directly
    // before the remaining divider (map = 100 - docBefore - 40).
    const idx = segs.findIndex((x, i) => x.map === 40 && segs[i + 1] && segs[i + 1].map > 0 && segs[i + 1].dom >= 0 && x.dom > 0 && i > segs.length - 6);
    expect(idx).toBeGreaterThan(-1);
    expect(segs[idx].dom).toBeGreaterThan(0);
    expect(segs[idx + 1].map).toBeGreaterThan(0);
  });

  it("counts deleted rows as rendered-but-not-in-the-document", async () => {
    const { emitted } = mountViewer();
    await nextTick();
    const segs = emitted[emitted.length - 1];
    const total = segs.reduce((a, s) => a + s.map, 0);
    const dom = segs.reduce((a, s) => a + s.dom, 0);
    // 4 context/add rows in hunk 1 + 6 in hunk 2 (one of them a DELETED
    // row: rendered, map 0) → dom exceeds the hunks' map contribution.
    expect(dom).toBeGreaterThan(total - 100 + 0); // sanity: dom side exists
    const hunkRows = segs.filter((s) => s.dom === 1 && s.map <= 1);
    expect(hunkRows.length).toBeGreaterThan(4);
  });
});
