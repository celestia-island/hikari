import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, ref, type App } from "vue";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as sass from "sass";

import HkCrossfade, { CROSSFADE_WATCHDOG_MS } from "./HkCrossfade";

/**
 * HkCrossfade contract tests. House style: no @vue/test-utils dependency —
 * raw createApp mounts on shared containers torn down after each case.
 *
 * Timing model (mirrors ModeMorphTabs.test): happy-dom resolves no CSS
 * transition durations, so with a working (timer-driven) rAF the swap
 * completes inside fake-timer advances. Freezing rAF via stubGlobal holds
 * both transition generations in the DOM — which is exactly the state the
 * simultaneous dissolve and the watchdog are about.
 */

const mounts: App[] = [];
const containers: HTMLElement[] = [];

interface Harness {
  container: HTMLElement;
  set: (key: string) => Promise<void>;
}

function mountCrossfade(opts: {
  initial?: string;
  appear?: boolean;
  disabled?: boolean;
} = {}): Harness {
  const container = document.createElement("div");
  document.body.appendChild(container);
  containers.push(container);

  const current = ref(opts.initial ?? "a");
  const Wrapper = defineComponent({
    setup() {
      return () =>
        h(
          HkCrossfade,
          {
            swapKey: current.value,
            appear: opts.appear ?? false,
            disabled: opts.disabled ?? false,
          },
          {
            default: () => h("p", { class: "body" }, `body-${current.value}`),
          },
        );
    },
  });
  const app = createApp(Wrapper);
  mounts.push(app);
  app.mount(container);
  return {
    container,
    set: async (key: string) => {
      current.value = key;
      await nextTick();
    },
  };
}

function items(host: HTMLElement): HTMLElement[] {
  // The mount container holds the .hk-crossfade host; items are the HOST's
  // direct children (Transition renders no DOM of its own).
  return Array.from(
    host.querySelectorAll<HTMLElement>(":scope > .hk-crossfade > .hk-crossfade-item"),
  );
}

function keys(host: HTMLElement): Array<string | undefined> {
  return items(host).map((el) => el.dataset.crossfadeKey);
}

function assertNoFrozenClasses(el: HTMLElement): void {
  for (const cls of Array.from(el.classList)) {
    expect(cls.startsWith("hk-crossfade-enter") || cls.startsWith("hk-crossfade-leave")).toBe(false);
  }
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

describe("HkCrossfade — DOM contract", () => {
  it("renders the active item silently on first paint (appear off)", () => {
    vi.useFakeTimers();
    const { container } = mountCrossfade({ initial: "a" });
    const list = items(container);
    expect(list).toHaveLength(1);
    expect(list[0]!.dataset.crossfadeKey).toBe("a");
    expect(list[0]!.textContent).toContain("body-a");
    assertNoFrozenClasses(list[0]!);
  });

  it("healthy swap completes through the Transition and settles on the new item", async () => {
    vi.useFakeTimers();
    const { container, set } = mountCrossfade();
    await set("b");
    // Past the watchdog budget: the swap completed through the Transition
    // long before, and the watchdog fired into a settled DOM as a no-op.
    await vi.advanceTimersByTimeAsync(CROSSFADE_WATCHDOG_MS + 100);
    const list = items(container);
    expect(list).toHaveLength(1);
    expect(list[0]!.dataset.crossfadeKey).toBe("b");
    expect(list[0]!.textContent).toContain("body-b");
    assertNoFrozenClasses(list[0]!);
  });

  it("dissolves SIMULTANEOUSLY: old and new share the same host mid-swap (no out-in gap)", async () => {
    vi.useFakeTimers();
    freezeRaf();
    const { container, set } = mountCrossfade();
    await set("b");
    await vi.advanceTimersByTimeAsync(200); // inside the watchdog budget
    const list = items(container);
    // Both generations mounted at once — the default-mode contract. With
    // `mode="out-in"` the old item would already be gone here (blank phase);
    // with a bare default Transition they would sit side by side instead of
    // stacked in one host cell.
    expect(keys(container)).toEqual(["a", "b"]);
    expect(list[0]!.classList.contains("hk-crossfade-leave-active")).toBe(true);
    expect(list[1]!.classList.contains("hk-crossfade-enter-from")).toBe(true);
  });

  it("watchdog completes a stalled swap: sweeps frozen classes, drops the stale item", async () => {
    vi.useFakeTimers();
    freezeRaf();
    const { container, set } = mountCrossfade();
    await set("b");
    await vi.advanceTimersByTimeAsync(CROSSFADE_WATCHDOG_MS - 100); // still wedged
    expect(keys(container)).toEqual(["a", "b"]);
    await vi.advanceTimersByTimeAsync(200); // past the budget
    const list = items(container);
    expect(list).toHaveLength(1);
    expect(list[0]!.dataset.crossfadeKey).toBe("b");
    assertNoFrozenClasses(list[0]!);
  });

  it("re-arms a fresh Transition on the next swap after a wedged one (dissolves resume)", async () => {
    vi.useFakeTimers();
    freezeRaf();
    const { container, set } = mountCrossfade();
    await set("b");
    await vi.advanceTimersByTimeAsync(CROSSFADE_WATCHDOG_MS + 100); // recovered once
    expect(keys(container)).toEqual(["b"]);
    // The next swap restores the Transition. The swept DOM left no previous
    // child inside the fresh instance, so that one swap lands as a
    // synchronous hard cut (the one-time cost of a stall) — settled and
    // correct, no wedge loop.
    await set("c");
    const list = items(container);
    expect(list).toHaveLength(1);
    expect(list[0]!.dataset.crossfadeKey).toBe("c");
    assertNoFrozenClasses(list[0]!);
    // From there on, swaps run the dissolve again: with a previous child
    // in the fresh Transition, the still-frozen rAF wedges this one, and
    // the budget recovers it — every swap lands correct, at most one
    // budget late.
    await set("d");
    await vi.advanceTimersByTimeAsync(200); // mid-swap: both generations
    expect(keys(container)).toEqual(["c", "d"]);
    await vi.advanceTimersByTimeAsync(CROSSFADE_WATCHDOG_MS); // recovered
    const settled = items(container);
    expect(settled).toHaveLength(1);
    expect(settled[0]!.dataset.crossfadeKey).toBe("d");
    assertNoFrozenClasses(settled[0]!);
  });

  it("appear dissolves the first item in; the watchdog un-freezes it under rAF starvation", async () => {
    vi.useFakeTimers();
    freezeRaf();
    const { container } = mountCrossfade({ initial: "a", appear: true });
    await vi.advanceTimersByTimeAsync(50);
    expect(items(container)[0]!.classList.contains("hk-crossfade-enter-from")).toBe(true);
    await vi.advanceTimersByTimeAsync(CROSSFADE_WATCHDOG_MS + 100);
    const list = items(container);
    expect(list).toHaveLength(1);
    expect(list[0]!.dataset.crossfadeKey).toBe("a");
    assertNoFrozenClasses(list[0]!);
  });

  it("disabled swaps synchronously with zero transition classes", async () => {
    vi.useFakeTimers();
    const { container, set } = mountCrossfade({ disabled: true });
    await set("b");
    const list = items(container);
    expect(list).toHaveLength(1);
    expect(list[0]!.dataset.crossfadeKey).toBe("b");
    assertNoFrozenClasses(list[0]!);
  });

  it("re-rendering with the same swapKey swaps nothing", async () => {
    vi.useFakeTimers();
    const { container, set } = mountCrossfade({ initial: "a" });
    await set("a");
    await vi.advanceTimersByTimeAsync(100);
    const list = items(container);
    expect(list).toHaveLength(1);
    assertNoFrozenClasses(list[0]!);
  });
});

describe("HkCrossfade — stylesheet contract", () => {
  const here = dirname(fileURLToPath(import.meta.url));

  it("stacks both generations in one grid cell — the same-position guarantee", () => {
    const css = sass.compile(join(here, "HkCrossfade.scss")).css;
    expect(css).toMatch(/\.hk-crossfade\s*\{[^}]*display:\s*grid/);
    const item = css.match(/\.hk-crossfade-item[^{]*\{[^}]*\}/)?.[0] ?? "";
    expect(item).toContain("grid-area: 1/1");
  });

  it("dissolves opacity only — no transform anywhere, dead layer drops pointer events", () => {
    const css = sass.compile(join(here, "HkCrossfade.scss")).css;
    expect(css).not.toContain("transform");
    const leave = css.match(/\.hk-crossfade-leave-active[^{]*\{[^}]*\}/)?.[0] ?? "";
    expect(leave).toContain("transition: opacity");
    expect(leave).toContain("pointer-events: none");
    expect(leave).toContain("var(--duration-normal, 0.3s)");
    const enter = css.match(/\.hk-crossfade-enter-active[^{]*\{[^}]*\}/)?.[0] ?? "";
    expect(enter).toContain("transition: opacity");
    expect(enter).toContain("var(--duration-normal, 0.3s)");
    for (const phase of ["enter-from", "leave-to"]) {
      const block = css.match(new RegExp(`\\.hk-crossfade-${phase}[^{]*\\{[^}]*\\}`))?.[0] ?? "";
      expect(block, `hk-crossfade-${phase} rule missing`).toContain("opacity: 0");
    }
  });

  it("reduced motion keeps the opacity exchange, just shorter (fade survives, motion dies)", () => {
    const css = sass.compile(join(here, "HkCrossfade.scss")).css;
    const media = css.match(/@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*\}\s*$/)?.[0] ?? "";
    expect(media).toContain(".hk-crossfade-enter-active");
    expect(media).toContain(".hk-crossfade-leave-active");
    expect(media).toContain("var(--duration-fast, 0.15s)");
  });
});

describe("HkCrossfade — wiring contract", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(join(here, "HkCrossfade.tsx"), "utf-8");

  it("runs the Transition in default (simultaneous) mode and never overrides its duration", () => {
    expect(src).toContain('<Transition\n            name="hk-crossfade"');
    expect(src).not.toMatch(/<Transition[^>]*\bmode=/);
    expect(src).not.toContain("duration={{");
  });

  it("pins the watchdog wiring and the animation-bus report", () => {
    expect(src).toContain("export const CROSSFADE_WATCHDOG_MS = 450;");
    expect(src).toContain("suppress.value = true;");
    expect(src).toContain("el.remove();");
    expect(src).toContain("useReportedTransition(REPORT_MS)");
    expect(src).toContain("armReport(); armWatchdog();");
  });
});
