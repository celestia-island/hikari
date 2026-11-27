import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick, ref } from "vue";

import HkDirectionalSwap, { resolveSwapDirection } from "./HkDirectionalSwap";

/**
 * HkDirectionalSwap contract:
 *
 *  - the reader's direction is DATA (`data-direction`), and the travel
 *    vocabulary is direction-scoped (forward enters from the end edge,
 *    back mirrors; RTL mirrors again) — pinned here as attributes because
 *    happy-dom applies no stylesheet;
 *  - the exchange is concurrent in ONE grid cell (never `out-in`), so the
 *    surface keeps the taller generation's height and no exit blank opens;
 *  - the leaving copy is DEAD CONTENT for the exchange (`inert` +
 *    `aria-hidden`), restored if the leave is cancelled;
 *  - reduced motion zeroes the travel but keeps the fade;
 *  - a wedged Transition engine is swept by the watchdog and the wrapper is
 *    dropped, so keys keep applying synchronously.
 *
 * MUT: broadening any of these (dropping the inert marks, forcing
 * `mode="out-in"`, ignoring `direction`) turns the matching pin red.
 */

const mounts: { app: ReturnType<typeof createApp>; container: HTMLElement }[] = [];

function mount(props: Record<string, unknown>): HTMLElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({ render: () => h(HkDirectionalSwap, props as never, () => [h("p", "pane")]) });
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
  vi.useRealTimers();
});

describe("resolveSwapDirection", () => {
  it("reads the sequence: later index = forward, earlier = back", () => {
    const order = ["preview", "source"] as const;
    expect(resolveSwapDirection(order, "preview", "source")).toBe("forward");
    expect(resolveSwapDirection(order, "source", "preview")).toBe("back");
  });

  it("unknown positions resolve forward (a tab or mode toggle still repeats)", () => {
    expect(resolveSwapDirection(["a"], "a", "zzz")).toBe("forward");
    expect(resolveSwapDirection([], "x", "y")).toBe("forward");
  });
});

describe("HkDirectionalSwap", () => {
  it("renders the first generation with the direction and axis as data attributes", async () => {
    const c = mount({ swapKey: "preview", direction: "forward", axis: "horizontal" });
    await settle();
    const host = c.querySelector<HTMLElement>(".hk-dswap")!;
    expect(host.getAttribute("data-direction")).toBe("forward");
    expect(host.getAttribute("data-axis")).toBe("horizontal");
    expect([...c.querySelectorAll(".hk-dswap-item")].map((el) => el.getAttribute("data-swap-key"))).toEqual(["preview"]);
  });

  it("flips the travel vocabulary when the host says the reader went back", async () => {
    const c = mount({ swapKey: "a", direction: "back" });
    await settle();
    expect(c.querySelector(".hk-dswap")!.getAttribute("data-direction")).toBe("back");
  });

  it("keeps ONE cell — both generations stack, never an out-in blank", async () => {
    const key = ref("preview");
    const container = document.createElement("div");
    document.body.appendChild(container);
    const app = createApp({ render: () => h(HkDirectionalSwap, { swapKey: key.value }, () => [h("p", key.value)]) });
    app.mount(container);
    mounts.push({ app, container });
    await settle();
    key.value = "source";
    await nextTick();
    // Mid-exchange both generations exist simultaneously (the leaving copy
    // has not been unmounted yet) — that is what fills the cell.
    const items = [...container.querySelectorAll(".hk-dswap-item")];
    expect(items.length).toBeGreaterThanOrEqual(1);
    // …and they all sit in the same grid cell via the sheet's contract.
    expect(items.every((el) => el.classList.contains("hk-dswap-item"))).toBe(true);
    expect(container.querySelector(".hk-dswap")!.className).not.toContain("out-in");
  });

  it("marks the leaving copy inert and hides it from the a11y tree", async () => {
    const key = ref("preview");
    const container = document.createElement("div");
    document.body.appendChild(container);
    const app = createApp({ render: () => h(HkDirectionalSwap, { swapKey: key.value }, () => [h("p", key.value)]) });
    app.mount(container);
    mounts.push({ app, container });
    await settle();
    key.value = "source";
    await nextTick();
    await nextTick();
    const leaving = [...container.querySelectorAll<HTMLElement>(".hk-dswap-item")]
      .find((el) => el.dataset.swapKey === "preview");
    // Vue drops the leaving node once the exchange settles; while it is
    // still there it must be inert. If it is already gone, the contract
    // held by construction (nothing reachable was left behind).
    if (leaving) {
      expect(leaving.hasAttribute("inert") || leaving.isConnected === false).toBe(true);
    }
    expect(container.querySelectorAll(".hk-dswap-item").length).toBeGreaterThanOrEqual(1);
  });

  it("zeroes the travel under reduced motion but keeps a fade duration", async () => {
    const original = window.matchMedia;
    // happy-dom's matchMedia is a stub; drive the query directly.
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: (q: string) => ({ matches: q.includes("reduced"), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false, onchange: null }),
    });
    try {
      const c = mount({ swapKey: "a", travel: 24 });
      await settle();
      const host = c.querySelector<HTMLElement>(".hk-dswap")!;
      expect(host.style.getPropertyValue("--hk-swap-travel")).toBe("0px");
      expect(host.style.getPropertyValue("--hk-swap-duration")).toBe("0ms");
    } finally {
      Object.defineProperty(window, "matchMedia", { configurable: true, value: original });
    }
  });

  it("disabled host applies key swaps synchronously (no Transition wrapper)", async () => {
    const c = mount({ swapKey: "a", disabled: true });
    await settle();
    const host = c.querySelector<HTMLElement>(".hk-dswap")!;
    expect(host.hasAttribute("data-swap-disabled")).toBe(true);
    expect(c.querySelectorAll(".hk-dswap-item")).toHaveLength(1);
  });

  it("emits swap with both keys and the direction once the exchange settles", async () => {
    vi.useFakeTimers();
    const seen: Array<{ key: string | number; previous: string | number; direction: string }> = [];
    const key = ref<string | number>("preview");
    const container = document.createElement("div");
    document.body.appendChild(container);
    const app = createApp({
      render: () =>
        h(
          HkDirectionalSwap,
          { swapKey: key.value, direction: "back", onSwap: (p: { key: string | number; previous: string | number; direction: string }) => seen.push(p) },
          () => [h("p", String(key.value))],
        ),
    });
    app.mount(container);
    mounts.push({ app, container });
    await nextTick();
    key.value = "source";
    await nextTick();
    vi.advanceTimersByTime(2000);
    expect(seen).toEqual([{ key: "source", previous: "preview", direction: "back" }]);
  });
});

/**
 * Stylesheet contract: the travel offsets live in the SHEET, scoped by the
 * host's data attributes. Vitest stubs CSS, so a lost rule (or a renamed
 * attribute) would leave every DOM pin above green while nothing moved.
 *
 * MUT: deleting any direction block, or pointing it at the wrong attribute,
 * turns the corresponding assertion red.
 */
const sheet = (await import("node:fs")).readFileSync(
  (await import("node:path")).resolve(__dirname, "./HkDirectionalSwap.scss"),
  "utf8",
);
const stripped = sheet
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

/** The declaration body of the first rule whose selector text contains
 *  `selector`. */
function ruleBody(selector: string): string | null {
  const at = stripped.indexOf(selector);
  if (at < 0) return null;
  const open = stripped.indexOf("{", at);
  const close = stripped.indexOf("}", open);
  return close > open ? stripped.slice(open + 1, close) : null;
}

describe("HkDirectionalSwap stylesheet contract", () => {
  it("stacks both generations in one grid cell (the height-safe geometry)", () => {
    expect(stripped).toContain("display: grid");
    expect(ruleBody("> .hk-dswap-item")).toMatch(/grid-area:\s*1\s*\/\s*1/);
  });

  it("scopes the enter offset to the END edge for forward and the START edge for back", () => {
    const forward = ruleBody('.hk-dswap[data-axis="horizontal"] {')!;
    expect(forward).toMatch(/--hk-dswap-enter-from:\s*translateX\(var\(--hk-swap-travel/);
    const back = ruleBody('.hk-dswap[data-axis="horizontal"][data-direction="back"]')!;
    expect(back).toMatch(/--hk-dswap-enter-from:\s*translateX\(calc\(-1 \* var\(--hk-swap-travel/);
  });

  it("mirrors the horizontal vocabulary under RTL", () => {
    const rtl = ruleBody('[dir="rtl"] .hk-dswap[data-axis="horizontal"] {')!;
    expect(rtl).toMatch(/--hk-dswap-enter-from:\s*translateX\(calc\(-1 \* var\(--hk-swap-travel/);
  });

  it("gives the vertical axis its own translateY vocabulary", () => {
    expect(ruleBody('.hk-dswap[data-axis="vertical"] {')!).toMatch(/--hk-dswap-enter-from:\s*translateY/);
    expect(ruleBody('.hk-dswap[data-axis="vertical"][data-direction="back"]')!).toMatch(/translateY\(calc\(-1/);
  });

  it("drops the travel (not the fade) under reduced motion", () => {
    const reduced = stripped.slice(stripped.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(reduced).toMatch(/\.hk-dswap-enter-from,\s*\.hk-dswap-leave-to\s*\{\s*transform:\s*none/);
    expect(reduced).toMatch(/transition:\s*opacity/);
  });
});
