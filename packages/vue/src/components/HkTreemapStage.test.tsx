import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, reactive } from "vue";

// Same stub pattern as HkTreemap.test.tsx: assert the tooltip wiring
// without the popup manager.
vi.mock("./HkTooltip", () => ({
  default: {
    name: "HkTooltipStub",
    props: { text: { type: String, required: true } },
    setup(props: { text: string }, { slots }: { slots: { default?: (p: unknown) => unknown } }) {
      return () => h("span", { "data-hk-tooltip-text": props.text }, slots.default?.({}) as never);
    },
  },
}));

import HkTreemapStage from "./HkTreemapStage";
import type { HkTreemapNode } from "./HkTreemap";

class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];
  readonly observed: Element[] = [];
  disconnected = false;
  constructor(readonly callback: () => void) {
    FakeResizeObserver.instances.push(this);
  }
  observe(element: Element): void {
    this.observed.push(element);
  }
  disconnect(): void {
    this.disconnected = true;
  }
}

const originalResizeObserver = globalThis.ResizeObserver;
const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

const NODES: HkTreemapNode[] = [
  {
    id: "group",
    label: "Group",
    value: 0,
    children: [
      { id: "a", label: "Alpha", value: 2 },
      { id: "b", label: "Beta", value: 4 },
    ],
  },
  { id: "other", label: "Other", value: 4 },
];

function fakeRect(width: number, height: number): DOMRect {
  return {
    x: 0, y: 0, top: 0, left: 0, right: width, bottom: height,
    width, height, toJSON: () => ({}),
  } as DOMRect;
}

function mountStage(initialProps: Record<string, unknown> = { nodes: NODES }) {
  const props = reactive<Record<string, unknown>>({ ...initialProps });
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp(
    defineComponent({
      setup() {
        return () => h(HkTreemapStage, { ...props });
      },
    }),
  );
  app.mount(container);
  const mounted = { app, container };
  mounts.push(mounted);
  return {
    ...mounted,
    update(next: Record<string, unknown>) {
      Object.assign(props, next);
    },
  };
}

async function setSize(mounted: { container: HTMLElement }, width = 400, height = 240) {
  const el = mounted.container.querySelector<HTMLElement>(".hk-treemap-stage__canvas")!;
  el.getBoundingClientRect = () => fakeRect(width, height);
  Object.defineProperty(el, "clientWidth", { value: width, configurable: true });
  Object.defineProperty(el, "clientHeight", { value: height, configurable: true });
  FakeResizeObserver.instances[0]?.callback();
  await nextTick();
}

beforeEach(() => {
  vi.clearAllMocks();
  FakeResizeObserver.instances = [];
  globalThis.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver;
});

afterEach(() => {
  for (const mounted of mounts.splice(0)) {
    mounted.app.unmount();
    mounted.container.remove();
  }
  globalThis.ResizeObserver = originalResizeObserver;
});

describe("HkTreemapStage — the drill path", () => {
  it("renders the root level cells with tooltips and no back button at root", async () => {
    const mounted = mountStage({ nodes: NODES, ariaLabel: "Usage" });
    await setSize(mounted);
    const cells = mounted.container.querySelectorAll(".hk-treemap-stage__cell");
    // Root level renders TOP-LEVEL cells only — a group is ONE drillable
    // cell by design (click to enter): group + other = 2.
    expect(cells.length).toBe(2);
    expect(mounted.container.querySelector('[aria-label="Back"]')).toBeNull();
    const tooltips = [...mounted.container.querySelectorAll("[data-hk-tooltip-text]")].map(
      (n) => n.getAttribute("data-hk-tooltip-text"),
    );
    expect(tooltips.some((t) => t!.startsWith("Group:"))).toBe(true);
    expect(mounted.container.textContent).toContain("Usage"); // the root crumb
  });

  it("clicking a GROUP cell drills in: children fill the canvas, back button appears", async () => {
    const mounted = mountStage({ nodes: NODES });
    await setSize(mounted);
    const group = [...mounted.container.querySelectorAll(".hk-treemap-stage__cell--drillable")]
      .find((c) => (c.getAttribute("aria-label") ?? "").startsWith("Group:")) as HTMLElement;
    expect(group).toBeTruthy();
    group.click();
    await nextTick();
    // Back button + the drilled crumb appear.
    expect(mounted.container.querySelector('[aria-label="Back"]')).toBeTruthy();
    expect(mounted.container.textContent).toContain("Group");
    // The children now lay out at the full canvas: both leaves present.
    const labels = [...mounted.container.querySelectorAll(".hk-treemap__label")].map(
      (n) => n.textContent,
    );
    expect(labels).toContain("Alpha");
    expect(labels).toContain("Beta");
    // "Other" is gone at this level.
    expect(labels).not.toContain("Other");
  });

  it("the back button pops one level; the root crumb pops all the way", async () => {
    const mounted = mountStage({ nodes: NODES });
    await setSize(mounted);
    const group = [...mounted.container.querySelectorAll(".hk-treemap-stage__cell--drillable")]
      .find((c) => (c.getAttribute("aria-label") ?? "").startsWith("Group:")) as HTMLElement;
    group.click();
    await nextTick();
    (mounted.container.querySelector('[aria-label="Back"]') as HTMLElement).click();
    await nextTick();
    expect(mounted.container.querySelector('[aria-label="Back"]')).toBeNull();
    // Back at root: "Other" is back.
    expect(mounted.container.textContent).toContain("Other");
  });

  it("clicking a LEAF emits select, never drills", async () => {
    const mounted = mountStage({ nodes: [{ id: "leaf", label: "Leaf", value: 1 }] });
    await setSize(mounted);
    const seen: string[] = [];
    // Re-mount with the listener (simpler than reactive fn props here).
    mounted.app.unmount();
    mounts.splice(mounts.indexOf(mounted), 1);
    const container = document.createElement("div");
    document.body.appendChild(container);
    const app = createApp({
      render: () =>
        h(HkTreemapStage, {
          nodes: [{ id: "leaf", label: "Leaf", value: 1 }],
          onSelect: (id: string) => seen.push(id),
        }),
    });
    app.mount(container);
    mounts.push({ app, container });
    const el = container.querySelector<HTMLElement>(".hk-treemap-stage__canvas")!;
    el.getBoundingClientRect = () => fakeRect(400, 240);
    Object.defineProperty(el, "clientWidth", { value: 400, configurable: true });
    Object.defineProperty(el, "clientHeight", { value: 240, configurable: true });
    // The re-mount's observer is the LAST instance (the first app's still
    // sits in the array, disconnected).
    FakeResizeObserver.instances[FakeResizeObserver.instances.length - 1]?.callback();
    await nextTick();
    const leaf = container.querySelector(".hk-treemap-stage__cell") as HTMLElement;
    leaf.click();
    await nextTick();
    expect(seen).toEqual(["leaf"]);
    expect(container.querySelector('[aria-label="Back"]')).toBeNull();
  });

  it("changing the data resets the drill stack and the camera", async () => {
    const mounted = mountStage({ nodes: NODES });
    await setSize(mounted);
    const group = [...mounted.container.querySelectorAll(".hk-treemap-stage__cell--drillable")]
      .find((c) => (c.getAttribute("aria-label") ?? "").startsWith("Group:")) as HTMLElement;
    group.click();
    await nextTick();
    expect(mounted.container.querySelector('[aria-label="Back"]')).toBeTruthy();

    mounted.update({ nodes: [{ id: "fresh", label: "Fresh", value: 3 }] });
    await nextTick();
    expect(mounted.container.querySelector('[aria-label="Back"]')).toBeNull();
    expect(mounted.container.textContent).toContain("Fresh");
  });
});

describe("HkTreemapStage — the camera + minimap", () => {
  it("the minimap defaults COLLAPSED to the semi-transparent map-icon button", async () => {
    const mounted = mountStage({ nodes: NODES });
    await setSize(mounted);
    expect(mounted.container.querySelector(".hk-minimap--collapsed")).toBeTruthy();
    expect(mounted.container.querySelector(".hk-mm-zoom-bar")).toBeNull();
  });

  it("expanding reveals the zoom bar; a step zoom emits and scales the surface", async () => {
    const mounted = mountStage({ nodes: NODES });
    await setSize(mounted);
    (mounted.container.querySelector(".hk-minimap--collapsed") as HTMLElement).click();
    await nextTick();
    const zoomIn = [...mounted.container.querySelectorAll(".hk-mm-zoom-btn")]
      .filter((b) => b.getAttribute("aria-label") === "Zoom in")[0] as HTMLElement;
    expect(zoomIn).toBeTruthy();
    zoomIn.click();
    await nextTick();
    const surface = mounted.container.querySelector<HTMLElement>(".hk-treemap-stage__surface")!;
    expect(surface.style.transform).toContain("scale(1.1)");
    // The zoom label reads the new rung.
    expect(mounted.container.querySelector(".hk-mm-zoom-label")!.textContent).toContain("110");
  });

  it("zoom reveals detail: a small cell's label appears at a higher rung", async () => {
    // One dominant leaf + crumbs: at 100% the crumbs sit under the label
    // floor; zoom in and the effective size crosses it.
    // Shares tuned for the ladder: each crumb ≈ 15×15px at 100% (under
    // the 18px label floor) → ≈ 30×30 at 200% (over it).
    const crumbs: HkTreemapNode[] = Array.from({ length: 30 }, (_, i) => ({
      id: `c${i}`,
      label: `Crumble-${i}`,
      value: 5,
    }));
    const mounted = mountStage({ nodes: [{ id: "big", label: "Big", value: 2000 }, ...crumbs] });
    await setSize(mounted, 400, 240);
    const labelsAt = () =>
      [...mounted.container.querySelectorAll(".hk-treemap__label")].map((n) => n.textContent);
    const before = labelsAt().filter((t) => t?.startsWith("Crumble-")).length;
    (mounted.container.querySelector(".hk-minimap--collapsed") as HTMLElement).click();
    await nextTick();
    // Step to 200%: each crumb's ZOOMED size doubles.
    for (let i = 0; i < 10; i += 1) {
      const zoomIn = [...mounted.container.querySelectorAll(".hk-mm-zoom-btn")]
        .filter((b) => b.getAttribute("aria-label") === "Zoom in")[0] as HTMLElement;
      zoomIn.click();
      await nextTick();
    }
    const after = labelsAt().filter((t) => t?.startsWith("Crumble-")).length;
    expect(after).toBeGreaterThan(before);
  });

  it("an empty tree shows the empty state and no minimap", async () => {
    const mounted = mountStage({ nodes: [], emptyText: "Nothing" });
    await setSize(mounted);
    expect(mounted.container.querySelector(".hk-treemap__empty")!.textContent).toBe("Nothing");
    expect(mounted.container.querySelector(".hk-minimap")).toBeNull();
    expect(mounted.container.querySelectorAll(".hk-treemap-stage__cell")).toHaveLength(0);
  });
});
