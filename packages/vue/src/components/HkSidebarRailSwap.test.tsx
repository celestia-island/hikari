import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, ref, type App } from "vue";

import HkSidebarRailSwap from "./HkSidebarRailSwap";
import { CROSSFADE_WATCHDOG_MS } from "./HkCrossfade";

/**
 * HkSidebarRailSwap contract (2026-10-30) — the rail/full content handoff.
 *
 * What this file pins:
 *
 * 1. WIDTH PINS: each generation renders at ITS density's width (the
 *    rail/expanded props) with the density attribute (`data-rail`) on the
 *    GENERATION — never the host root — so the leaving generation keeps
 *    its dress while the entering one takes the new one.
 * 2. THE DISSOLVE is HkCrossfade's simultaneous exchange (the tab-panel
 *    mechanism): mid-swap both generations share the swap's single grid
 *    cell, the leaving copy frozen at its last render and pointer-dead.
 * 3. The scoped `{ rail }` slot param: the entering generation is invoked
 *    with the new value; the leaving one keeps what it last rendered.
 * 4. A healthy swap settles on exactly one generation.
 *
 * Timing model: identical to HkCrossfade.test — happy-dom resolves no CSS
 * transition durations, so a working rAF completes the swap inside
 * fake-timer advances, and freezing rAF holds both generations mounted.
 */

const mounts: App[] = [];
const containers: HTMLElement[] = [];

interface SwapSlotParams {
  rail: boolean;
}

interface Harness {
  container: HTMLElement;
  swap(): HTMLElement;
  generations(): HTMLElement[];
  params: SwapSlotParams[];
  set(rail: boolean): Promise<void>;
}

function mountSwap(opts: { rail?: boolean; railWidth?: string; expandedWidth?: string } = {}): Harness {
  const params: SwapSlotParams[] = [];
  const container = document.createElement("div");
  document.body.appendChild(container);
  containers.push(container);

  const rail = ref(opts.rail ?? false);
  const Wrapper = defineComponent({
    name: "RailSwapHarness",
    setup() {
      return () =>
        h(
          HkSidebarRailSwap,
          {
            rail: rail.value,
            railWidth: opts.railWidth ?? "56px",
            expandedWidth: opts.expandedWidth ?? "240px",
          },
          {
            default: (p: SwapSlotParams) => {
              params.push(p);
              return h("p", { class: "body" }, p.rail ? "RAIL" : "FULL");
            },
          },
        );
    },
  });
  const app = createApp(Wrapper);
  mounts.push(app);
  app.mount(container);
  return {
    container,
    swap: () => container.querySelector(".hk-sidebar-rail-swap") as HTMLElement,
    generations: () =>
      Array.from(container.querySelectorAll<HTMLElement>(".hk-sidebar-rail-generation")),
    params,
    set: async (v: boolean) => {
      rail.value = v;
      await nextTick();
    },
  };
}

function freezeRaf(): void {
  vi.stubGlobal("requestAnimationFrame", (_cb: FrameRequestCallback) => 0 as unknown as number);
  vi.stubGlobal("cancelAnimationFrame", () => {});
}

afterEach(() => {
  for (const app of mounts) app.unmount();
  mounts.length = 0;
  document.body.innerHTML = "";
  containers.length = 0;
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("HkSidebarRailSwap — generation contract", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("renders the active generation silently on first paint, pinned at its width", () => {
    const c = mountSwap({ railWidth: "56px", expandedWidth: "240px" });
    // The swap host IS HkCrossfade's host — class fallthrough merges them.
    expect(c.swap().classList.contains("hk-crossfade")).toBe(true);

    const gens = c.generations();
    expect(gens).toHaveLength(1);
    expect(gens[0]!.style.width).toBe("240px");
    expect(gens[0]!.hasAttribute("data-rail"), "expanded carries no rail density").toBe(false);
    expect(c.params[c.params.length - 1]!.rail).toBe(false);
    expect(gens[0]!.textContent).toContain("FULL");
  });

  it("the rail generation pins the rail width and carries the density", async () => {
    const c = mountSwap({ railWidth: "64px" });
    await c.set(true);
    await vi.advanceTimersByTimeAsync(600);
    const gens = c.generations();
    expect(gens).toHaveLength(1);
    expect(gens[0]!.style.width).toBe("64px");
    expect(gens[0]!.hasAttribute("data-rail")).toBe(true);
    expect(c.params[c.params.length - 1]!.rail).toBe(true);
    expect(gens[0]!.textContent).toContain("RAIL");
  });

  it("applies the width props VERBATIM (a var() token must survive the passthrough)", async () => {
    // happy-dom's CSSOM silently drops a var() width from the parsed
    // inline style, so the token passthrough is pinned in SOURCE (the
    // house source-pin style): the generation's width is the raw prop —
    // no re-resolution, no fallback substitution — which is what lets a
    // bespoke host pass its own var(--app-sidebar-w, 240px) token.
    const { readFileSync } = await import("node:fs");
    const { dirname, join } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const src = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "HkSidebarRailSwap.tsx"),
      "utf8",
    );
    expect(src).toContain("width: props.rail ? props.railWidth : props.expandedWidth");
  });
});

describe("HkSidebarRailSwap — the dissolve (HkCrossfade's mechanism)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("holds BOTH generations mid-swap: leaving FROZEN at its dress, entering at the new one", async () => {
    freezeRaf();
    const c = mountSwap({ railWidth: "56px", expandedWidth: "240px" });
    await c.set(true);
    await vi.advanceTimersByTimeAsync(200); // inside the dissolve window

    const gens = c.generations();
    expect(gens, "both generations share the cell mid-swap").toHaveLength(2);
    // DOM order: leaving first, entering last.
    const [leaving, entering] = gens;
    expect(leaving!.hasAttribute("data-rail"), "the leaving copy keeps the EXPANDED dress").toBe(false);
    expect(leaving!.style.width).toBe("240px");
    expect(leaving!.textContent).toContain("FULL");
    expect(entering!.hasAttribute("data-rail"), "the entering copy takes the rail dress").toBe(true);
    expect(entering!.style.width).toBe("56px");
    expect(entering!.textContent).toContain("RAIL");
    // The leaving ITEM is pointer-dead for the dissolve (HkCrossfade's
    // leave rule) — the frozen generation cannot intercept clicks.
    const leavingItem = leaving!.parentElement!;
    expect(leavingItem.classList.contains("hk-crossfade-leave-active")).toBe(true);
  });

  it("a healthy swap settles on the entering generation alone", async () => {
    const c = mountSwap({ railWidth: "56px" });
    await c.set(true);
    await vi.advanceTimersByTimeAsync(600);
    const gens = c.generations();
    expect(gens).toHaveLength(1);
    expect(gens[0]!.hasAttribute("data-rail")).toBe(true);
  });

  it("reversing mid-dissolve still lands on the live density — and settles", async () => {
    freezeRaf();
    const c = mountSwap({});
    await c.set(true);
    await vi.advanceTimersByTimeAsync(100);
    await c.set(false); // flipped back before the first dissolve settled
    await vi.advanceTimersByTimeAsync(100);
    const last = c.generations()[c.generations().length - 1]!;
    expect(last.hasAttribute("data-rail")).toBe(false);
    expect(last.style.width).toBe("240px");

    // Release rAF and let the choreography finish: whatever stale items
    // the reversal stranded must sweep, settling on exactly one
    // generation at the live density (the watchdog's degraded path
    // would otherwise leave wedged copies mounted).
    vi.unstubAllGlobals();
    await vi.advanceTimersByTimeAsync(CROSSFADE_WATCHDOG_MS + 200);
    const settled = c.generations();
    expect(settled).toHaveLength(1);
    expect(settled[0]!.hasAttribute("data-rail")).toBe(false);
    expect(settled[0]!.style.width).toBe("240px");
  });

  it("FREEZES the leaving generation under a host re-render mid-dissolve", async () => {
    // THE central guarantee: the leaving copy is not re-rendered while
    // it dissolves — a host re-render (peek state, live store data) must
    // not restyle or rewrite it, or the density handoff would reintroduce
    // the squeeze this component exists to fix. The harness re-renders
    // the whole slot with NEW live text mid-dissolve; the leaving copy
    // must keep the OLD text while the entering copy shows the new one.
    freezeRaf();
    const container = document.createElement("div");
    document.body.appendChild(container);
    containers.push(container);

    const rail = ref(false);
    const live = ref("v1");
    const Wrapper = defineComponent({
      name: "RailSwapFreezeHarness",
      setup() {
        return () =>
          h(
            HkSidebarRailSwap,
            { rail: rail.value, railWidth: "56px", expandedWidth: "240px" },
            {
              default: ({ rail: r }: { rail: boolean }) =>
                h("p", { class: "body" }, (r ? "RAIL:" : "FULL:") + live.value),
            },
          );
      },
    });
    const app = createApp(Wrapper);
    mounts.push(app);
    app.mount(container);

    rail.value = true; // start the FULL -> RAIL dissolve
    await nextTick();
    await vi.advanceTimersByTimeAsync(120);
    live.value = "v2"; // the host re-renders mid-dissolve
    await nextTick();
    await vi.advanceTimersByTimeAsync(50);

    const gens = Array.from(
      container.querySelectorAll<HTMLElement>(".hk-sidebar-rail-generation"),
    );
    expect(gens).toHaveLength(2);
    // The frozen leaving copy keeps its last-rendered text (FULL:v1);
    // the entering copy re-renders live (RAIL:v2).
    expect(gens[0]!.textContent).toBe("FULL:v1");
    expect(gens[1]!.textContent).toBe("RAIL:v2");
  });
});
