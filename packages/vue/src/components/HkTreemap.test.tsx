import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, reactive } from "vue";

// HkTooltip is stubbed so the per-cell wiring is assertable without the
// popup manager: the stub renders its trigger slot and exposes the bound
// text as [data-hk-tooltip-text].
vi.mock("./HkTooltip", () => ({
  default: {
    name: "HkTooltipStub",
    props: { text: { type: String, required: true } },
    setup(props: { text: string }, { slots }: { slots: { default?: (p: unknown) => unknown } }) {
      return () => h("span", { "data-hk-tooltip-text": props.text }, slots.default?.({}) as never);
    },
  },
}));

import HkTreemap, {
  HK_TREEMAP_DEFAULT_COLORS,
  buildHkTreemapLayout,
  contrastTextColor,
  createHkTreemapSummary,
  formatHkTreemapPercent,
  layoutHkTreemapCells,
  type HkTreemapNode,
} from "./HkTreemap";

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
    value: 999,
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

function mountTreemap(initialProps: Record<string, unknown> = { nodes: NODES }) {
  const props = reactive<Record<string, unknown>>({ ...initialProps });
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp(
    defineComponent({
      setup() {
        return () => h(HkTreemap, { ...props });
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

function unmount(mounted: { app: ReturnType<typeof createApp>; container: HTMLElement }) {
  const index = mounts.findIndex((item) => item.app === mounted.app);
  if (index >= 0) mounts.splice(index, 1);
  mounted.app.unmount();
  mounted.container.remove();
}

/** Give the chart element a concrete size and let the observer re-measure.
 *
 * `zoom` simulates the app's root CSS zoom (dpiPrefs writes 100–300% on
 * <html>): getBoundingClientRect answers in DRAWN px (zoom×), while
 * clientWidth/Height and the cells' inline px live in LOCAL px. */
async function setSize(
  mounted: { container: HTMLElement },
  width: number,
  height: number,
  zoom = 1,
) {
  const el = mounted.container.querySelector<HTMLElement>(".hk-treemap__chart")!;
  el.getBoundingClientRect = () => fakeRect(width * zoom, height * zoom);
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

describe("HkTreemap pure layout input", () => {
  it("sums nested groups from leaves and ignores caller-provided parent values", () => {
    const layout = buildHkTreemapLayout(NODES);
    expect(layout.total).toBe(10);
    expect(layout.nodes[0]!.value).toBe(6);
    expect(layout.nodes[0]!.children).toHaveLength(2);
  });

  it("filters zero, negative and non-finite values before calculating totals", () => {
    const layout = buildHkTreemapLayout([
      { id: "ok", label: "Ok", value: 3 },
      { id: "zero", label: "Zero", value: 0 },
      { id: "neg", label: "Neg", value: -2 },
      { id: "nan", label: "NaN", value: Number.NaN },
      { id: "inf", label: "Inf", value: Number.POSITIVE_INFINITY },
    ]);
    expect(layout.total).toBe(3);
    expect(layout.nodes.map((node) => node.id)).toEqual(["ok"]);
  });

  it("uses all visible leaves in the chart as the percentage denominator", () => {
    const layout = buildHkTreemapLayout(NODES);
    const leaves: number[] = [];
    const walk = (nodes: typeof layout.nodes): void => {
      for (const node of nodes) {
        if (node.children) walk(node.children);
        else leaves.push(node.percent);
      }
    };
    walk(layout.nodes);
    expect(leaves.reduce((sum, value) => sum + value, 0)).toBeCloseTo(100, 6);
  });

  it("assigns deterministic top-level palette colors and honors opaque overrides", () => {
    const layout = buildHkTreemapLayout([
      { id: "a", label: "A", value: 1 },
      { id: "b", label: "B", value: 1, color: "#123456" },
      { id: "c", label: "C", value: 1, color: "rgba(1,2,3,0.5)" },
      { id: "d", label: "D", value: 1, color: "var(--unparseable)" },
    ]);
    expect(layout.nodes[0]!.color).toBe(HK_TREEMAP_DEFAULT_COLORS[0]);
    expect(layout.nodes[1]!.color).toBe("rgb(18 52 86)");
    // Translucent and unparseable overrides fall back to the palette slot.
    expect(layout.nodes[2]!.color).toBe(HK_TREEMAP_DEFAULT_COLORS[2]);
    expect(layout.nodes[3]!.color).toBe(HK_TREEMAP_DEFAULT_COLORS[3]);
  });

  it("sums three levels deep and prunes groups with no valid descendants", () => {
    const layout = buildHkTreemapLayout([
      {
        id: "mid", label: "Mid", value: 0,
        children: [
          {
            id: "deep", label: "Deep", value: 0,
            children: [
              { id: "leaf", label: "Leaf", value: 4 },
              { id: "dead", label: "Dead", value: 0 },
            ],
          },
          { id: "deadgroup", label: "DeadGroup", value: 1, children: [{ id: "x", label: "X", value: -1 }] },
        ],
      },
    ]);
    expect(layout.total).toBe(4);
    const mid = layout.nodes[0]!;
    expect(mid.children!).toHaveLength(1);
    expect(mid.children![0]!.children!).toHaveLength(1);
    expect(mid.children![0]!.children![0]!.id).toBe("leaf");
  });

  it("is deterministic and never mutates the caller's node objects", () => {
    const input: HkTreemapNode[] = [
      { id: "a", label: "A", value: 3 },
      { id: "b", label: "B", value: 2 },
    ];
    const snapshot = JSON.stringify(input);
    const first = buildHkTreemapLayout(input);
    const second = buildHkTreemapLayout(input);
    expect(second).toEqual(first);
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it("returns a genuinely empty model for absent or entirely invalid data", () => {
    expect(buildHkTreemapLayout([])).toEqual({ nodes: [], total: 0 });
    expect(
      buildHkTreemapLayout([
        { id: "zero", label: "Zero", value: 0 },
        { id: "nan", label: "NaN", value: Number.NaN },
      ]),
    ).toEqual({ nodes: [], total: 0 });
  });

  it("chooses readable label colours across pale, mid-tone and dark backgrounds", () => {
    expect(contrastTextColor("#edc948")).toBe("#0b1220");
    expect(contrastTextColor("#4e79a7")).toBe("#fff");
    expect(contrastTextColor("#76b7b2")).toBe("#0b1220");
    expect(contrastTextColor("rgb(242, 142, 43)")).toBe("#0b1220");
    expect(contrastTextColor("#abc")).toBe("#0b1220");
    expect(contrastTextColor("hsl(0, 0%, 100%)")).toBe("#0b1220");
    expect(contrastTextColor("not-a-color")).toBe("#fff");
    // Every default palette member must clear WCAG AA with its chosen text.
    for (const color of HK_TREEMAP_DEFAULT_COLORS) {
      expect(["#fff", "#0b1220"]).toContain(contrastTextColor(color));
    }
  });

  it("builds an accessible leaf-path summary from the same layout", () => {
    const summary = createHkTreemapSummary(buildHkTreemapLayout(NODES), (value) => `${value}u`);
    expect(summary).toBe("Group / Alpha: 2u (20%); Group / Beta: 4u (40%); Other: 4u (40%)");
    expect(formatHkTreemapPercent(0.04)).toBe("<0.1%");
  });
});

describe("HkTreemap native cells (layoutHkTreemapCells)", () => {
  it("reserves a header band for groups and subdivides the remainder", () => {
    const layout = buildHkTreemapLayout(NODES);
    const cells = layoutHkTreemapCells(layout.nodes, 0, 0, 400, 240);
    expect(cells).toHaveLength(2);
    const group = cells.find((cell) => cell.node.id === "group")!;
    expect(group.children).toHaveLength(2);
    // Children live strictly inside the group's rect, below its header.
    for (const child of group.children) {
      expect(child.x).toBeGreaterThanOrEqual(group.x);
      expect(child.y).toBeGreaterThanOrEqual(group.y + 22);
      expect(child.x + child.w).toBeLessThanOrEqual(group.x + group.w + 0.001);
      expect(child.y + child.h).toBeLessThanOrEqual(group.y + group.h + 0.001);
    }
  });

  it("cells tile their canvas with no area drift", () => {
    const layout = buildHkTreemapLayout(NODES);
    const cells = layoutHkTreemapCells(layout.nodes, 0, 0, 320, 200);
    const area = cells.reduce((sum, cell) => sum + cell.w * cell.h, 0);
    expect(area).toBeCloseTo(320 * 200, 6);
  });

  it("a starved group renders as a plain cell instead of a broken nest", () => {
    const layout = buildHkTreemapLayout([
      {
        id: "g", label: "G", value: 1, color: "#4e79a7",
        children: [{ id: "l", label: "L", value: 1 }],
      },
      { id: "big", label: "Big", value: 9999 },
    ]);
    const cells = layoutHkTreemapCells(layout.nodes, 0, 0, 100, 60);
    const group = cells.find((cell) => cell.node.id === "g")!;
    // Whatever the split, the group never emits children outside its rect.
    for (const child of group.children) {
      expect(child.x + child.w).toBeLessThanOrEqual(group.x + group.w + 0.001);
      expect(child.y + child.h).toBeLessThanOrEqual(group.y + group.h + 0.001);
    }
  });
});

describe("HkTreemap component", () => {
  it("renders legend, cells with theme mortar and accessible text after measuring", async () => {
    const mounted = mountTreemap({
      nodes: NODES,
      ariaLabel: "Resource usage",
      valueFormatter: (value: number) => `${value} units`,
    });
    await setSize(mounted, 400, 240);

    expect(mounted.container.querySelector<HTMLElement>(".hk-treemap")!.style.height).toBe("320px");
    expect(mounted.container.querySelectorAll(".hk-treemap__legend-item")).toHaveLength(2);
    // Group header + leaf cells all rendered as DOM.
    const cells = mounted.container.querySelectorAll(".hk-treemap__cell");
    expect(cells.length).toBeGreaterThanOrEqual(4);
    expect(mounted.container.textContent).toContain("6 units");

    const chart = mounted.container.querySelector<HTMLElement>(".hk-treemap__chart")!;
    expect(chart.getAttribute("role")).toBe("img");
    expect(chart.getAttribute("aria-label")).toBe("Resource usage");
    const summaryId = chart.getAttribute("aria-describedby")!;
    expect(mounted.container.querySelector(`#${summaryId}`)!.textContent).toBe(
      "Group / Alpha: 2 units (20%); Group / Beta: 4 units (40%); Other: 4 units (40%)",
    );
  });

  it("lays out in LOCAL px under a root zoom — never zoom× oversized (R2 S1)", async () => {
    const mounted = mountTreemap({ nodes: [{ id: "solo", label: "Solo", value: 5 }] });
    // 2× root: gBCR reports 800×480 drawn; the layout must still tile the
    // 400×240 LOCAL space (the old gBCR-based measure painted 2× cells).
    await setSize(mounted, 400, 240, 2);
    const cell = mounted.container.querySelector<HTMLElement>(".hk-treemap__cell")!;
    expect(cell.style.width).toBe("400px");
    expect(cell.style.height).toBe("240px");
  });

  it("every cell carries the standard HkTooltip with label, value and share", async () => {
    const mounted = mountTreemap({
      nodes: NODES,
      valueFormatter: (value: number) => `${value}u`,
    });
    await setSize(mounted, 400, 240);
    const tooltips = [
      ...mounted.container.querySelectorAll("[data-hk-tooltip-text]"),
    ].map((node) => node.getAttribute("data-hk-tooltip-text"));
    expect(tooltips).toContain("Group: 6u · 60%");
    expect(tooltips).toContain("Alpha: 2u · 20%");
    expect(tooltips).toContain("Other: 4u · 40%");
  });

  it("re-renders cells when data changes on a same-size container", async () => {
    const mounted = mountTreemap();
    await setSize(mounted, 400, 240);
    expect(mounted.container.querySelectorAll(".hk-treemap__cell").length).toBeGreaterThanOrEqual(4);

    mounted.update({ nodes: [{ id: "new", label: "New", value: 7 }] });
    await nextTick();
    const cells = [...mounted.container.querySelectorAll(".hk-treemap__cell")];
    expect(cells).toHaveLength(1);
    expect(cells[0]!.getAttribute("aria-label")).toBe("New: 7 · 100%");
  });

  it("disconnects its observer on unmount", async () => {
    const mounted = mountTreemap();
    await setSize(mounted, 400, 240);
    const observer = FakeResizeObserver.instances[0]!;
    expect(observer.observed[0]).toBe(mounted.container.querySelector(".hk-treemap__chart"));
    unmount(mounted);
    expect(observer.disconnected).toBe(true);
  });

  it("shows an honest empty state and no cells without data", async () => {
    const mounted = mountTreemap({ nodes: [], emptyText: "Nothing visible" });
    await setSize(mounted, 400, 240);
    expect(mounted.container.querySelector(".hk-treemap__empty")!.textContent).toBe("Nothing visible");
    expect(mounted.container.querySelector(".hk-treemap__legend")).toBeNull();
    expect(mounted.container.querySelectorAll(".hk-treemap__cell")).toHaveLength(0);
  });

  it("supports hiding the legend and numeric pixel heights", async () => {
    const mounted = mountTreemap({ showLegend: false, height: 280 });
    await setSize(mounted, 400, 240);
    expect(mounted.container.querySelector(".hk-treemap__legend")).toBeNull();
    expect(mounted.container.querySelector<HTMLElement>(".hk-treemap")!.style.height).toBe("280px");
  });

  it("small cells degrade to colour blocks (the tooltip still speaks)", async () => {
    // One dominant leaf + many crumbs: the crumbs get centi-pixel cells —
    // far below the label ladder — and must render bare (no label spans).
    const crumbs: HkTreemapNode[] = Array.from({ length: 24 }, (_, i) => ({
      id: `c${i}`,
      label: `Crumble-${i}`,
      value: 1,
    }));
    const mounted = mountTreemap({
      nodes: [{ id: "big", label: "Big", value: 100000 }, ...crumbs],
    });
    await setSize(mounted, 400, 240);
    const bare = [...mounted.container.querySelectorAll(".hk-treemap__cell")].filter(
      (cell) => cell.querySelector(".hk-treemap__label") === null,
    );
    expect(bare.length).toBeGreaterThan(0);
    // …and every bare cell still carries its full tooltip text.
    const bareWithTooltip = bare.filter((cell) => {
      const host = cell.closest("[data-hk-tooltip-text]");
      return host !== null && host.getAttribute("data-hk-tooltip-text")!.includes("Crumble-");
    });
    expect(bareWithTooltip.length).toBe(bare.length);
  });
});

describe("HkTreemap chrome contract (SCSS pins)", () => {
  const css = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "./HkTreemap.scss"), "utf8");

  it("overflowing labels ellipsize from the first clipped character", () => {
    expect(css.match(/text-overflow: ellipsis/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("the cell mortar reads the theme — no fixed white gutters (the dark-mode glare)", () => {
    expect(css).not.toContain("#fff");
    expect(css).toMatch(/--color-background/);
    expect(css).toMatch(/--color-muted/);
  });
});
