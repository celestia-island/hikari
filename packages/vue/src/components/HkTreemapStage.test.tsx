import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, reactive } from "vue";

// Same stub pattern as HkTreemap.test.tsx: assert the tooltip wiring
// without the popup manager.
vi.mock("./HkTooltip", () => ({
  default: {
    name: "HkTooltipStub",
    props: {
      text: { type: String, required: true },
      placement: { type: String, default: "top" },
    },
    setup(props: { text: string; placement: string }, { slots }: { slots: { default?: (p: unknown) => unknown } }) {
      return () => h("span", {
        "data-hk-tooltip-text": props.text,
        "data-hk-tooltip-placement": props.placement,
      }, slots.default?.({}) as never);
    },
  },
}));

import HkTreemapStage from "./HkTreemapStage";
import type { HkTreemapNode } from "./HkTreemap";

class FakeResizeObserver implements ResizeObserver {
  static instances: FakeResizeObserver[] = [];
  readonly observed: Element[] = [];
  disconnected = false;
  constructor(readonly callback: (...args: never[]) => void) {
    FakeResizeObserver.instances.push(this);
  }
  observe(element: Element): void {
    this.observed.push(element);
  }
  unobserve(): void {}
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

async function setSize(mounted: { container: HTMLElement }, width = 400, height = 240, zoom = 1) {
  const el = mounted.container.querySelector<HTMLElement>(".hk-treemap-stage__canvas")!;
  el.getBoundingClientRect = () => fakeRect(width * zoom, height * zoom);
  Object.defineProperty(el, "clientWidth", { value: width, configurable: true });
  Object.defineProperty(el, "clientHeight", { value: height, configurable: true });
  Object.defineProperty(el, "offsetWidth", { value: width, configurable: true });
  Object.defineProperty(el, "offsetHeight", { value: height, configurable: true });
  FakeResizeObserver.instances[0]?.callback();
  await nextTick();
}

beforeEach(() => {
  vi.clearAllMocks();
  FakeResizeObserver.instances = [];
  globalThis.ResizeObserver = FakeResizeObserver;
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
    const placements = [...mounted.container.querySelectorAll("[data-hk-tooltip-placement]")]
      .map((node) => node.getAttribute("data-hk-tooltip-placement"));
    expect(new Set(placements)).toEqual(new Set(["bottom"]));
    // No redundant root-level title/header; the canvas aria-label still
    // names the surface for assistive tech.
    expect(mounted.container.querySelector(".hk-treemap-stage__head")).toBeNull();
    expect(mounted.container.querySelector('[aria-label="Back"]')).toBeNull();
    // Big groups preview their children immediately (no click required).
    const nested = [...mounted.container.querySelectorAll(".hk-treemap-stage__nested-cell")];
    expect(nested.length).toBeGreaterThanOrEqual(2);
    const nestedLabels = [...mounted.container.querySelectorAll(".hk-treemap-stage__nested-label")]
      .map((node) => node.textContent);
    expect(nestedLabels).toContain("Alpha");
    expect(nestedLabels).toContain("Beta");
    // Previews live INSIDE the drillable cell: parent hover/focus chrome
    // and the click surface stay above them without a second z-layer.
    for (const preview of nested) {
      expect(preview.closest(".hk-treemap-stage__cell--drillable")).not.toBeNull();
    }
  });

  it("keeps the tooltip-owned cell frames inside a small canvas at 2×/3× DPI", async () => {
    const mounted = mountStage({ nodes: NODES });
    for (const zoom of [2, 3]) {
      await setSize(mounted, 220, 120, zoom);
      const cells = [...mounted.container.querySelectorAll<HTMLElement>(".hk-treemap-stage__cell")];
      expect(cells).toHaveLength(2);
      for (const cell of cells) {
        const frame = cell.closest<HTMLElement>("[data-hk-tooltip-text]")!;
        expect(frame.style.position).toBe("absolute");
        const x = Number.parseFloat(frame.style.left);
        const y = Number.parseFloat(frame.style.top);
        const w = Number.parseFloat(frame.style.width);
        const h = Number.parseFloat(frame.style.height);
        expect(x).toBeGreaterThanOrEqual(0);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(x + w).toBeLessThanOrEqual(220.001);
        expect(y + h).toBeLessThanOrEqual(120.001);
        expect(cell.style.inset).toBe("0px");
      }
    }
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

  it("a same-shape live refresh preserves the drill path and camera", async () => {
    const mounted = mountStage({ nodes: NODES });
    await setSize(mounted);
    const group = [...mounted.container.querySelectorAll(".hk-treemap-stage__cell--drillable")]
      .find((c) => (c.getAttribute("aria-label") ?? "").startsWith("Group:")) as HTMLElement;
    group.click();
    await nextTick();
    expect(mounted.container.querySelector('[aria-label="Back"]')).toBeTruthy();
    const back = mounted.container.querySelector<HTMLElement>('[aria-label="Back"]')!;
    expect(back.classList.contains("hk-treemap-stage__back-float")).toBe(true);

    // A camera change made at this level must survive the refresh too.
    const canvas = mounted.container.querySelector<HTMLElement>(".hk-treemap-stage__canvas")!;
    canvas.dispatchEvent(new WheelEvent("wheel", {
      deltaY: -100, bubbles: true, cancelable: true,
    }));
    await nextTick();
    const surface = mounted.container.querySelector<HTMLElement>(".hk-treemap-stage__surface")!;
    const camera = surface.style.transform;
    expect(camera).toContain("scale(1.1)");

    // Live polling hands the stage a NEW array with the same ids (updated
    // weights). The user's drill must survive; only the values move.
    mounted.update({
      nodes: [
        {
          id: "group",
          label: "Group",
          value: 0,
          children: [
            { id: "a", label: "Alpha updated", value: 5 },
            { id: "b", label: "Beta", value: 7 },
          ],
        },
        { id: "other", label: "Other", value: 4 },
      ],
    });
    await nextTick();
    expect(mounted.container.querySelector('[aria-label="Back"]')).toBeTruthy();
    expect(mounted.container.textContent).toContain("Alpha updated");
    expect(mounted.container.textContent).toContain("Beta");
    expect(mounted.container.querySelector(".hk-treemap-stage__head")).toBeTruthy();
    expect(mounted.container.querySelector<HTMLElement>(".hk-treemap-stage__surface")!.style.transform)
      .toBe(camera);
  });

  it("keeps a drilled level with a localized empty message when its children vanish", async () => {
    const mounted = mountStage({ nodes: NODES, emptyText: "Nothing inside" });
    await setSize(mounted);
    const group = mounted.container.querySelector<HTMLElement>(".hk-treemap-stage__cell--drillable")!;
    group.click();
    await nextTick();

    // Same group id, refreshed into a leaf: no auto-return, no blank canvas.
    mounted.update({ nodes: [{ id: "group", label: "Group", value: 5 }] });
    await nextTick();
    expect(mounted.container.querySelector('[aria-label="Back"]')).toBeTruthy();
    expect(mounted.container.querySelector(".hk-treemap-stage__head")).toBeTruthy();
    expect(mounted.container.querySelector(".hk-treemap-stage__empty")?.textContent)
      .toBe("Nothing inside");
  });

  it("removing the drilled group falls back to root and clears the back control", async () => {
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
    expect(mounted.container.querySelector(".hk-treemap-stage__head")).toBeNull();
    expect(mounted.container.textContent).toContain("Fresh");
  });

  it("reveals the nested preview only when zoom makes the group large enough", async () => {
    const nestedNodes: HkTreemapNode[] = [
      {
        id: "outer",
        label: "Outer",
        value: 0,
        children: [{
          id: "inner",
          label: "Inner",
          value: 0,
          children: [
            { id: "inner-a", label: "Inner A", value: 1 },
            { id: "inner-b", label: "Inner B", value: 1 },
          ],
        }],
      },
      { id: "other", label: "Other", value: 1 },
    ];
    const mounted = mountStage({ nodes: nestedNodes, zoomPercent: 100 });
    await setSize(mounted, 100, 240);
    // The group cell is 100px wide at 100% — below the 120×90 preview
    // gate, even though it is tall.
    expect(mounted.container.querySelectorAll(".hk-treemap-stage__nested-cell")).toHaveLength(0);

    mounted.update({ zoomPercent: 150 });
    await nextTick();
    const previews = [...mounted.container.querySelectorAll<HTMLElement>(".hk-treemap-stage__nested-cell")];
    expect(previews.length).toBeGreaterThan(0);
    // Recursion reaches the grandchild level (outer → inner → leaves) and
    // the nested group's own label passes the zoomed label ladder.
    expect(previews.some((cell) => cell.dataset.depth === "1")).toBe(true);
    expect(previews.every((cell) => cell.getAttribute("aria-hidden") === "true")).toBe(true);
    // Flat VNodes all live under the top-level cell: the grandchild must sit
    // below/right of its nested parent by the header/pad inset. Re-basing on
    // the nested cell's own x/y would collapse this delta to zero.
    const depth0 = previews.find((cell) => cell.dataset.depth === "0")!;
    const depth1 = previews.find((cell) => cell.dataset.depth === "1")!;
    expect(Number.parseFloat(depth1.style.top) - Number.parseFloat(depth0.style.top))
      .toBeGreaterThanOrEqual(22);
    expect(Number.parseFloat(depth1.style.left) - Number.parseFloat(depth0.style.left))
      .toBeGreaterThanOrEqual(2);
    expect(mounted.container.textContent).toContain("Inner");
    // Previews are descendants of the group button, not siblings.
    for (const preview of previews) {
      expect(preview.closest(".hk-treemap-stage__cell--drillable")).not.toBeNull();
    }
  });

  it("also gates the preview on the zoomed HEIGHT, not width alone", async () => {
    const wideShort = mountStage({
      nodes: [{
        id: "wide",
        label: "Wide",
        value: 0,
        children: [
          { id: "wide-a", label: "Wide A", value: 1 },
          { id: "wide-b", label: "Wide B", value: 1 },
        ],
      }],
      zoomPercent: 100,
    });
    await setSize(wideShort, 200, 80);
    // Full-canvas group: 200×80 at 100% — wide enough, too short.
    expect(wideShort.container.querySelectorAll(".hk-treemap-stage__nested-cell")).toHaveLength(0);
    wideShort.update({ zoomPercent: 150 });
    await nextTick();
    expect(wideShort.container.querySelectorAll(".hk-treemap-stage__nested-cell").length)
      .toBeGreaterThan(0);
  });

  it("parks the floating return control beside the minimap when it expands", async () => {
    const mounted = mountStage({ nodes: NODES });
    await setSize(mounted);
    const group = mounted.container.querySelector<HTMLElement>(".hk-treemap-stage__cell--drillable")!;
    group.click();
    await nextTick();
    const back = mounted.container.querySelector<HTMLElement>(".hk-treemap-stage__back-float")!;
    const endOf = () => back.style.getPropertyValue("inset-inline-end");
    expect(endOf()).toBe("50px"); // 12px gutter + 30px collapsed map + 8px gap

    (mounted.container.querySelector(".hk-minimap--collapsed") as HTMLElement).click();
    await nextTick();
    expect(endOf()).toBe("180px"); // expanded map is 160px wide
  });

  it("renders an unknown child label in italics", async () => {
    const mounted = mountStage({
      nodes: [{
        id: "group",
        label: "Group",
        value: 0,
        children: [
          { id: "known", label: "Known", value: 3 },
          { id: "unknown", label: "Unknown", value: 9, labelItalic: true },
        ],
      }],
    });
    await setSize(mounted);
    // A large unknown leaf also gets a top-level italic label when drilled.
    const group = mounted.container.querySelector<HTMLElement>(".hk-treemap-stage__cell--drillable")!;
    group.click();
    await nextTick();
    const unknown = mounted.container.querySelector(".hk-treemap__label--unknown");
    expect(unknown).not.toBeNull();
    expect(unknown!.textContent).toBe("Unknown");
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

  it("wheel gestures zoom the canvas and never scroll the host page", async () => {
    const mounted = mountStage({ nodes: NODES });
    await setSize(mounted);
    const canvas = mounted.container.querySelector<HTMLElement>(".hk-treemap-stage__canvas")!;
    const surface = mounted.container.querySelector<HTMLElement>(".hk-treemap-stage__surface")!;
    const inEvent = new WheelEvent("wheel", { deltaY: -100, bubbles: true, cancelable: true });
    canvas.dispatchEvent(inEvent);
    await nextTick();
    expect(inEvent.defaultPrevented).toBe(true);
    expect(surface.style.transform).toContain("scale(1.1)");
    canvas.dispatchEvent(new WheelEvent("wheel", { deltaY: 100, bubbles: true, cancelable: true }));
    await nextTick();
    expect(surface.style.transform).toContain("scale(1)");
  });

  it("clamps wheel zoom at 50–200% and ignores zero-delta motion", async () => {
    const mounted = mountStage({ nodes: NODES });
    await setSize(mounted);
    const canvas = mounted.container.querySelector<HTMLElement>(".hk-treemap-stage__canvas")!;
    const surface = mounted.container.querySelector<HTMLElement>(".hk-treemap-stage__surface")!;
    const zero = new WheelEvent("wheel", { deltaY: 0, bubbles: true, cancelable: true });
    canvas.dispatchEvent(zero);
    await nextTick();
    expect(zero.defaultPrevented).toBe(true);
    expect(surface.style.transform).toContain("scale(1)");
    for (let i = 0; i < 8; i += 1) {
      canvas.dispatchEvent(new WheelEvent("wheel", { deltaY: 100, bubbles: true, cancelable: true }));
    }
    await nextTick();
    expect(surface.style.transform).toContain("scale(0.5)");
    for (let i = 0; i < 20; i += 1) {
      canvas.dispatchEvent(new WheelEvent("wheel", { deltaY: -100, bubbles: true, cancelable: true }));
    }
    await nextTick();
    expect(surface.style.transform).toContain("scale(2)");
  });

  it("keeps wheel zoom anchored under the pointer at 2× root DPI", async () => {
    const mounted = mountStage({ nodes: [{ id: "leaf", label: "Leaf", value: 1 }] });
    await setSize(mounted, 400, 240, 2);
    const canvas = mounted.container.querySelector<HTMLElement>(".hk-treemap-stage__canvas")!;
    canvas.getBoundingClientRect = () => ({
      x: 100, y: 50, left: 100, top: 50, right: 900, bottom: 530,
      width: 800, height: 480, toJSON: () => ({}),
    }) as DOMRect;
    const surface = mounted.container.querySelector<HTMLElement>(".hk-treemap-stage__surface")!;
    const wheel = new WheelEvent("wheel", {
      deltaY: -100, bubbles: true, cancelable: true,
    });
    // happy-dom does not apply MouseEventInit's client coords to WheelEvent;
    // pin them explicitly (same convention as HkBoard.scale.test.ts).
    Object.defineProperty(wheel, "clientX", { value: 500 });
    Object.defineProperty(wheel, "clientY", { value: 290 });
    // (500,290) drawn = (200,120) local. At 100→110%, pan must become
    // (-20,-12) so -20 + 200×1.1 = 200 (and likewise on y).
    canvas.dispatchEvent(wheel);
    await nextTick();
    const match = /translate\(([-\d.]+)px, ([-\d.]+)px\) scale\(([\d.]+)\)/.exec(
      surface.style.transform,
    );
    expect(match).not.toBeNull();
    expect(Number(match![1])).toBeCloseTo(-20, 8);
    expect(Number(match![2])).toBeCloseTo(-12, 8);
    expect(Number(match![3])).toBeCloseTo(1.1, 8);
    // The world point under the pointer is invariant, not merely "zoomed".
    expect(Number(match![1]) + 200 * Number(match![3])).toBeCloseTo(200, 8);
    expect(Number(match![2]) + 120 * Number(match![3])).toBeCloseTo(120, 8);
  });

  it("controlled zoom changes pan only when the parent actually applies the request", async () => {
    const mounted = mountStage({
      nodes: [{ id: "leaf", label: "Leaf", value: 1 }],
      zoomPercent: 100,
    });
    await setSize(mounted, 400, 240, 2);
    const canvas = mounted.container.querySelector<HTMLElement>(".hk-treemap-stage__canvas")!;
    canvas.getBoundingClientRect = () => ({
      x: 100, y: 50, left: 100, top: 50, right: 900, bottom: 530,
      width: 800, height: 480, toJSON: () => ({}),
    }) as DOMRect;
    const surface = mounted.container.querySelector<HTMLElement>(".hk-treemap-stage__surface")!;
    const wheel = new WheelEvent("wheel", { deltaY: -100, bubbles: true, cancelable: true });
    Object.defineProperty(wheel, "clientX", { value: 500 });
    Object.defineProperty(wheel, "clientY", { value: 290 });
    canvas.dispatchEvent(wheel);
    await nextTick();
    // Parent rejected/omitted the update: neither scale nor pan may move.
    expect(surface.style.transform).toBe("translate(0px, 0px) scale(1)");

    mounted.update({ zoomPercent: 110 });
    await nextTick();
    const match = /translate\(([-\d.]+)px, ([-\d.]+)px\) scale\(([\d.]+)\)/.exec(
      surface.style.transform,
    );
    expect(match).not.toBeNull();
    expect(Number(match![1])).toBeCloseTo(-20, 8);
    expect(Number(match![2])).toBeCloseTo(-12, 8);
    expect(Number(match![3])).toBeCloseTo(1.1, 8);
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

  it("minimap drag-to-pan works in the DEFAULT collapsed→expanded flow (the R2/R3 S1)", async () => {
    const mounted = mountStage({ nodes: NODES });
    await setSize(mounted);
    // Expand from the default-collapsed glyph.
    (mounted.container.querySelector(".hk-minimap--collapsed") as HTMLElement).click();
    await nextTick();
    const card = mounted.container.querySelector(".hk-minimap") as HTMLElement;
    expect(card).toBeTruthy();
    // The old imperative binding missed the FIRST-render-null minimap
    // entirely; with vnode-bound handlers the gesture must reach the
    // camera: a drag on the map moves the surface transform.
    card.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: 80, clientY: 55 }));
    await nextTick();
    expect(card.getAttribute("data-dragging")).toBe("");
    card.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: 100, clientY: 65 }));
    card.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
    await nextTick();
    const surface = mounted.container.querySelector<HTMLElement>(".hk-treemap-stage__surface")!;
    expect(surface.style.transform).not.toBe("translate(0px, 0px) scale(1)");
    expect(surface.style.transform).toMatch(/translate\(-?\d+/);
  });

  it("an empty tree shows the empty state and no minimap", async () => {
    const mounted = mountStage({ nodes: [], emptyText: "Nothing" });
    await setSize(mounted);
    expect(mounted.container.querySelector(".hk-treemap__empty")!.textContent).toBe("Nothing");
    expect(mounted.container.querySelector(".hk-minimap")).toBeNull();
    expect(mounted.container.querySelectorAll(".hk-treemap-stage__cell")).toHaveLength(0);
  });
});
