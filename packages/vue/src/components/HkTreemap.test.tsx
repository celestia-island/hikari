import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, reactive } from "vue";

const H = vi.hoisted(() => {
  class FakeChart {
    static instances: FakeChart[] = [];
    readonly options: unknown[] = [];
    clearCount = 0;
    resizeCount = 0;
    disposed = false;

    constructor(readonly element: HTMLElement) {
      FakeChart.instances.push(this);
    }

    setOption(option: unknown): void {
      this.options.push(option);
    }

    clear(): void {
      this.clearCount += 1;
    }

    resize(): void {
      this.resizeCount += 1;
    }

    dispose(): void {
      this.disposed = true;
    }
  }

  return {
    FakeChart,
    init: vi.fn(),
    use: vi.fn(),
    importGate: null as Promise<void> | null,
  };
});

vi.mock("echarts/core", () => ({
  init: H.init,
  use: H.use,
}));

vi.mock("echarts/charts", async () => {
  if (H.importGate) await H.importGate;
  return { TreemapChart: { name: "TreemapChart" } };
});

vi.mock("echarts/components", () => ({
  TooltipComponent: { name: "TooltipComponent" },
}));

vi.mock("echarts/renderers", () => ({
  CanvasRenderer: { name: "CanvasRenderer" },
}));

import HkTreemap, {
  HK_TREEMAP_DEFAULT_COLORS,
  buildHkTreemapLayout,
  contrastTextColor,
  createHkTreemapOption,
  createHkTreemapSummary,
  formatHkTreemapPercent,
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

async function waitForChart(): Promise<void> {
  await vi.waitFor(() => expect(H.FakeChart.instances).toHaveLength(1));
  await nextTick();
}

function lastOption(): any {
  const chart = H.FakeChart.instances[0]!;
  return chart.options[chart.options.length - 1];
}

beforeEach(() => {
  vi.clearAllMocks();
  H.FakeChart.instances = [];
  H.importGate = null;
  H.init.mockImplementation((element: HTMLElement) => new H.FakeChart(element));
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
    const layout = buildHkTreemapLayout([
      {
        id: "root",
        label: "Root",
        value: 1000,
        children: [
          { id: "leaf", label: "Leaf", value: 2 },
          {
            id: "nested",
            label: "Nested",
            value: 900,
            children: [{ id: "deep", label: "Deep", value: 3 }],
          },
        ],
      },
      { id: "top", label: "Top", value: 5 },
    ]);

    expect(layout.total).toBe(10);
    expect(layout.nodes[0]!.value).toBe(5);
    expect(layout.nodes[0]!.children![1]!.value).toBe(3);
    expect(layout.nodes[1]!.value).toBe(5);
  });

  it("filters zero, negative and non-finite values before calculating totals", () => {
    const layout = buildHkTreemapLayout([
      {
        id: "valid",
        label: "Valid",
        value: 0,
        children: [
          { id: "zero", label: "Zero", value: 0 },
          { id: "negative", label: "Negative", value: -2 },
          { id: "nan", label: "NaN", value: Number.NaN },
          { id: "infinite", label: "Infinite", value: Number.POSITIVE_INFINITY },
          { id: "neg-infinite", label: "Negative infinite", value: Number.NEGATIVE_INFINITY },
          { id: "kept", label: "Kept", value: 4 },
        ],
      },
      {
        id: "invalid-group",
        label: "Invalid group",
        value: 500,
        children: [{ id: "invalid-leaf", label: "Invalid", value: 0 }],
      },
    ]);

    expect(layout.nodes).toHaveLength(1);
    expect(layout.nodes[0]!.children!.map((node) => node.id)).toEqual(["kept"]);
    expect(layout.nodes[0]!.value).toBe(4);
    expect(layout.total).toBe(4);
  });

  it("uses all visible leaves in the chart as the percentage denominator", () => {
    const layout = buildHkTreemapLayout(NODES);
    const group = layout.nodes[0]!;
    const alpha = group.children![0]!;
    const beta = group.children![1]!;
    const other = layout.nodes[1]!;

    expect(layout.total).toBe(10);
    expect(group.percent).toBe(60);
    expect(alpha.percent).toBe(20);
    expect(beta.percent).toBe(40);
    expect(other.percent).toBe(40);
    expect(alpha.percent + beta.percent + other.percent).toBe(100);
  });

  it("assigns deterministic top-level palette colors and honors overrides", () => {
    const nodes: HkTreemapNode[] = [
      { id: "first", label: "First", value: 1 },
      {
        id: "custom",
        label: "Custom",
        value: 1,
        color: "#123456",
        children: [{ id: "child", label: "Child", value: 1 }],
      },
      { id: "third", label: "Third", value: 1 },
    ];
    const first = buildHkTreemapLayout(nodes);
    const second = buildHkTreemapLayout(nodes);

    expect(first).toEqual(second);
    expect(first.nodes.map((node) => node.color)).toEqual([
      HK_TREEMAP_DEFAULT_COLORS[0],
      "#123456",
      HK_TREEMAP_DEFAULT_COLORS[2],
    ]);
    expect(first.nodes[1]!.children![0]!.color).toBe("#123456");
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

  it("chooses readable label colours for pale and dark backgrounds", () => {
    const option = createHkTreemapOption(buildHkTreemapLayout([
      { id: "pale", label: "Pale", value: 1, color: "#edc948" },
      { id: "dark", label: "Dark", value: 1, color: "#4e79a7" },
      { id: "invalid", label: "Invalid", value: 1, color: "var(--x)" },
    ])) as any;
    const data = option.series[0].data;
    expect(data[0].label.color).toBe("#111827");
    expect(data[0].upperLabel.color).toBe("#111827");
    expect(data[1].label.color).toBe("#fff");
    expect(data[2].label.color).toBe("#fff");
    expect(contrastTextColor("#abc")).toBe("#111827");
    expect(contrastTextColor("not-a-color")).toBe("#fff");
  });

  it("feeds real values and percentages to leaf, group and tooltip formatters", () => {
    const option = createHkTreemapOption(buildHkTreemapLayout(NODES), (value) => `${value} units`) as any;
    const series = option.series[0];
    const group = series.data[0];
    const leaf = group.children[0];

    expect(series.nodeClick).toBe(false);
    expect(series.roam).toBe(false);
    expect(series.breadcrumb.show).toBe(false);
    expect(series.label.formatter({ data: leaf })).toBe("Alpha\n2 units · 20%");
    expect(series.upperLabel.formatter({ data: group })).toBe("Group · 6 units · 60%");
    expect(option.tooltip.formatter({ data: leaf })).toBe(
      "<strong>Alpha</strong><br/>2 units · 20%",
    );
  });

  it("escapes HTML in tooltip labels and formatted values", () => {
    const option = createHkTreemapOption(
      buildHkTreemapLayout([{ id: "html", label: "<unsafe>", value: 1 }]),
      () => "<b>1</b>",
    ) as any;
    const datum = option.series[0].data[0];

    expect(option.tooltip.formatter({ data: datum })).toBe(
      "<strong>&lt;unsafe&gt;</strong><br/>&lt;b&gt;1&lt;/b&gt; · 100%",
    );
  });

  it("builds an accessible leaf-path summary from the same layout", () => {
    const summary = createHkTreemapSummary(buildHkTreemapLayout(NODES), (value) => `${value}u`);
    expect(summary).toBe("Group / Alpha: 2u (20%); Group / Beta: 4u (40%); Other: 4u (40%)");
    expect(formatHkTreemapPercent(0.04)).toBe("<0.1%");
  });
});

describe("HkTreemap component lifecycle", () => {
  it("mounts lazily and renders legend, formatted values and accessible text", async () => {
    const mounted = mountTreemap({
      nodes: NODES,
      ariaLabel: "Resource usage",
      valueFormatter: (value: number) => `${value} units`,
    });
    await waitForChart();

    expect(H.init).toHaveBeenCalledTimes(1);
    expect(H.use).toHaveBeenCalledTimes(1);
    expect(H.FakeChart.instances[0]!.options).toHaveLength(1);
    expect(mounted.container.querySelector<HTMLElement>(".hk-treemap")!.style.height).toBe("320px");
    expect(mounted.container.querySelectorAll(".hk-treemap__legend-item")).toHaveLength(2);
    expect(mounted.container.textContent).toContain("6 units");

    const chart = mounted.container.querySelector<HTMLElement>(".hk-treemap__chart")!;
    expect(chart.getAttribute("role")).toBe("img");
    expect(chart.getAttribute("aria-label")).toBe("Resource usage");
    expect(chart.getAttribute("aria-hidden")).toBe("false");
    const summaryId = chart.getAttribute("aria-describedby")!;
    expect(mounted.container.querySelector(`#${summaryId}`)!.textContent).toBe(
      "Group / Alpha: 2 units (20%); Group / Beta: 4 units (40%); Other: 4 units (40%)",
    );
  });

  it("calls setOption when data or value formatting changes", async () => {
    const mounted = mountTreemap();
    await waitForChart();
    const chart = H.FakeChart.instances[0]!;
    expect(chart.options).toHaveLength(1);

    mounted.update({ nodes: [{ id: "new", label: "New", value: 7 }] });
    await vi.waitFor(() => expect(chart.options).toHaveLength(2));
    expect(lastOption().series[0].data[0]).toMatchObject({ id: "new", value: 7 });

    mounted.update({ valueFormatter: (value: number) => `${value} updated` });
    await vi.waitFor(() => expect(chart.options).toHaveLength(3));
    expect(lastOption().series[0].data[0].hkTreemap.valueText).toBe("7 updated");
  });

  it("resizes with its container and window, then disconnects and disposes", async () => {
    const mounted = mountTreemap();
    await waitForChart();
    const chart = H.FakeChart.instances[0]!;
    const observer = FakeResizeObserver.instances[0]!;
    const chartElement = mounted.container.querySelector(".hk-treemap__chart")!;

    expect(observer.observed).toEqual([chartElement]);
    observer.callback();
    window.dispatchEvent(new Event("resize"));
    expect(chart.resizeCount).toBe(2);

    unmount(mounted);
    expect(chart.disposed).toBe(true);
    expect(observer.disconnected).toBe(true);
    observer.callback();
    window.dispatchEvent(new Event("resize"));
    expect(chart.resizeCount).toBe(2);
  });

  it("shows an honest empty state and clears stale options across updates", async () => {
    const mounted = mountTreemap({ nodes: [], emptyText: "Nothing visible" });
    await waitForChart();
    const chart = H.FakeChart.instances[0]!;

    expect(mounted.container.querySelector(".hk-treemap__empty")!.textContent).toBe("Nothing visible");
    expect(mounted.container.querySelector(".hk-treemap__legend")).toBeNull();
    expect(mounted.container.querySelector(".hk-treemap__chart")!.getAttribute("aria-hidden")).toBe("true");
    expect(chart.clearCount).toBe(1);

    mounted.update({ nodes: NODES });
    await vi.waitFor(() => expect(chart.options).toHaveLength(1));
    expect(mounted.container.querySelector(".hk-treemap__empty")).toBeNull();

    mounted.update({ nodes: [] });
    await vi.waitFor(() => expect(chart.clearCount).toBe(2));
    expect(mounted.container.querySelector(".hk-treemap__empty")!.textContent).toBe("Nothing visible");
  });

  it("supports hiding the legend and numeric pixel heights", async () => {
    const mounted = mountTreemap({ showLegend: false, height: 280 });
    await waitForChart();

    expect(mounted.container.querySelector(".hk-treemap__legend")).toBeNull();
    expect(mounted.container.querySelector<HTMLElement>(".hk-treemap")!.style.height).toBe("280px");
  });

  it("does not init a detached element when async imports finish after unmount", async () => {
    let releaseImports!: () => void;
    H.importGate = new Promise<void>((resolve) => {
      releaseImports = resolve;
    });
    const mounted = mountTreemap();
    await nextTick();

    unmount(mounted);
    releaseImports();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(H.init).not.toHaveBeenCalled();
    expect(H.FakeChart.instances).toHaveLength(0);
  });
});
