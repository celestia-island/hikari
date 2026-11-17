import { describe, expect, it } from "vitest";

import {
  flowLabelVisible,
  formatFlowPercent,
  truncateFlowLabel,
  usageFlowLayout,
  USAGE_FLOW_PALETTE,
  type HkUsageFlowRow,
} from "./usageFlowLayout";

/** Three callers → two upstreams → three models, comfortably above the
 *  node-visibility floor so no geometry is clamped. */
const ROWS: HkUsageFlowRow[] = [
  { source: "k1", middle: "up-a", target: "m1", value: 500 },
  { source: "k1", middle: "up-b", target: "m2", value: 300 },
  { source: "k2", middle: "up-a", target: "m1", value: 200 },
  { source: "k2", middle: "up-b", target: "m3", value: 100 },
  { source: "k3", middle: "up-a", target: "m3", value: 50 },
];

function columnNodes(layout: ReturnType<typeof usageFlowLayout>, column: number) {
  return layout.nodes.filter((node) => node.column === column);
}

function linksFrom(layout: ReturnType<typeof usageFlowLayout>, key: string) {
  return layout.links.filter((link) => link.sourceKey === key);
}

/** Every coordinate pair inside a ribbon path, in document order. */
function pathPoints(d: string): Array<{ x: number; y: number }> {
  return [...d.matchAll(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g)].map((match) => ({
    x: Number(match[1]),
    y: Number(match[2]),
  }));
}

describe("usageFlowLayout", () => {
  it("returns an empty layout when no row carries a positive value", () => {
    const layout = usageFlowLayout([
      { source: "a", middle: "b", target: "c", value: 0 },
      { source: "a", middle: "b", target: "d", value: -3 },
      { source: "a", middle: "b", target: "e", value: Number.NaN },
    ]);
    expect(layout.empty).toBe(true);
    expect(layout.total).toBe(0);
    expect(layout.nodes).toHaveLength(0);
    expect(layout.legend).toHaveLength(0);
  });

  it("sums duplicate triples and keeps the three columns conserved", () => {
    const layout = usageFlowLayout([
      ...ROWS,
      { source: "k1", middle: "up-a", target: "m1", value: 500 },
    ]);
    // 500+300+200+100+50 plus the duplicated 500 triple.
    expect(layout.total).toBe(1650);
    for (const column of [0, 1, 2]) {
      const sum = columnNodes(layout, column).reduce((acc, node) => acc + node.value, 0);
      expect(sum, `column ${column} total`).toBe(1650);
    }
    const k1 = layout.nodes.find((node) => node.fullLabel === "k1" && node.column === 0);
    expect(k1?.value).toBe(1300);
  });

  it("orders each column by value descending and keeps geometry inside the frame", () => {
    const layout = usageFlowLayout(ROWS, { width: 900, height: 400 });
    for (const column of [0, 1, 2]) {
      const nodes = columnNodes(layout, column);
      const values = nodes.map((node) => node.value);
      expect(values, `column ${column} order`).toEqual([...values].sort((a, b) => b - a));
      for (const node of nodes) {
        expect(node.x).toBeGreaterThanOrEqual(0);
        expect(node.x + node.width).toBeLessThanOrEqual(900);
        expect(node.y).toBeGreaterThanOrEqual(0);
        expect(node.y + node.height).toBeLessThanOrEqual(400);
      }
    }
    // The last column's bars sit at the right edge, the first column's at
    // the left edge, and the middle column is centred on the frame.
    const first = columnNodes(layout, 0)[0];
    const middle = columnNodes(layout, 1)[0];
    const last = columnNodes(layout, 2)[0];
    expect(first.x).toBe(8);
    expect(middle.x).toBe(Math.round((900 - 14) / 2));
    expect(last.x + last.width).toBe(900 - 8);
  });

  it("uses one shared scale: node heights are proportional to their values", () => {
    const layout = usageFlowLayout(ROWS, { height: 480 });
    const k1 = layout.nodes.find((node) => node.fullLabel === "k1" && node.column === 0)!;
    const k2 = layout.nodes.find((node) => node.fullLabel === "k2" && node.column === 0)!;
    expect(k1.height / k1.value).toBeCloseTo(k2.height / k2.value, 3);
  });

  it("stacks each node's ribbons exactly on its scaled height, on both sides", () => {
    const layout = usageFlowLayout(ROWS, { height: 480 });
    const scale = layout.links[0].thickness / layout.links[0].value;
    for (const link of layout.links) {
      expect(link.thickness, `exact scaled slot for ${link.key}`).toBeCloseTo(link.value * scale, 6);
      expect(link.path.includes("NaN"), `no NaN in ${link.key}`).toBe(false);
    }
    for (const node of layout.nodes) {
      const outgoing = layout.links
        .filter((link) => link.sourceKey === node.key)
        .sort((a, b) => a.startY - b.startY);
      const incoming = layout.links
        .filter((link) => link.targetKey === node.key)
        .sort((a, b) => a.endY - b.endY);
      // Outgoing slots are contiguous from the bar's top edge, and the
      // stack closes exactly at the node's SCALED height.
      let cursor = node.y;
      for (const link of outgoing) {
        expect(link.startY, `outgoing cursor of ${node.fullLabel}`).toBeCloseTo(cursor, 1);
        cursor += link.value * scale;
      }
      if (outgoing.length > 0) {
        expect(cursor, `outgoing stack end of ${node.fullLabel}`).toBeCloseTo(
          node.y + node.value * scale,
          1,
        );
      }
      let end = node.y;
      for (const link of incoming) {
        expect(link.endY, `incoming cursor of ${node.fullLabel}`).toBeCloseTo(end, 1);
        end += link.value * scale;
      }
      if (incoming.length > 0) {
        expect(end, `incoming stack end of ${node.fullLabel}`).toBeCloseTo(
          node.y + node.value * scale,
          1,
        );
      }
      // The floored bar may be TALLER than the stack, never shorter.
      expect(node.value * scale).toBeLessThanOrEqual(node.height + 0.01);
    }
  });

  it("floors a sub-visible node's bar without letting its layer escape", () => {
    const rows = [
      { source: "huge", middle: "up", target: "m1", value: 9_800_000 },
      ...Array.from({ length: 9 }, (_, i) => ({
        source: `tiny-${i}`,
        middle: "up",
        target: "m1",
        value: 2_000,
      })),
    ];
    const layout = usageFlowLayout(rows, { height: 420 });
    const scale = layout.links[0].thickness / layout.links[0].value;
    const tiny = layout.nodes.find((node) => node.fullLabel === "tiny-0")!;
    expect(tiny.height).toBe(2); // the visibility floor
    // A 2-unit bar cannot carry a label; the hint/legend still name it.
    expect(tiny.labelVisible).toBe(false);
    expect(layout.nodes.find((node) => node.fullLabel === "huge")!.labelVisible).toBe(true);
    expect(tiny.value * scale).toBeLessThan(tiny.height);
    const outgoing = layout.links.filter((link) => link.sourceKey === tiny.key);
    expect(outgoing).toHaveLength(1);
    expect(outgoing[0].startY).toBeCloseTo(tiny.y, 2);
    expect(outgoing[0].thickness).toBeCloseTo(tiny.value * scale, 3);
    // No slot origin escapes the drawn bar.
    for (const link of outgoing) {
      expect(link.startY).toBeLessThanOrEqual(tiny.y + tiny.height + 0.01);
    }
  });

  it("clamps every column into the frame for any requested node cap", () => {
    const many = Array.from({ length: 60 }, (_, i) => ({
      source: `s${String(i).padStart(2, "0")}`,
      middle: "up",
      target: "m1",
      value: 10,
    }));
    for (const maxNodes of [0, 1, 2, 1000, Number.NaN]) {
      const layout = usageFlowLayout(many, { height: 420, maxNodes });
      for (const node of layout.nodes) {
        expect(node.y, `top of ${node.fullLabel} (cap ${maxNodes})`).toBeGreaterThanOrEqual(0);
        expect(node.y + node.height, `bottom of ${node.fullLabel} (cap ${maxNodes})`).toBeLessThanOrEqual(420);
      }
      const sources = columnNodes(layout, 0);
      // The magnitudes survive: the largest bar is not the 2-unit floor.
      expect(Math.max(...sources.map((node) => node.height))).toBeGreaterThan(2);
      // A cap of 2 is honoured; a cap of 1 still leaves room for the bucket.
      if (maxNodes === 2) expect(sources).toHaveLength(2);
    }
  });

  it("falls back to the empty face when the total itself is non-finite", () => {
    const layout = usageFlowLayout([
      { source: "a", middle: "u", target: "m1", value: 1e308 },
      { source: "b", middle: "u", target: "m2", value: 1e308 },
    ]);
    // Two FINITE distinct triples whose sum overflows: an empty face is
    // the honest answer — NaN geometry and `d="… NaN …"` are not.
    expect(layout.empty).toBe(true);
    expect(layout.nodes).toHaveLength(0);
    expect(layout.links).toHaveLength(0);
  });

  it("drops a fold merge whose summed label value overflows", () => {
    const layout = usageFlowLayout(
      [
        { source: "a", middle: "u", target: "m1", value: 1e308 },
        { source: "b", middle: "u", target: "zzz", value: 1e308 },
      ],
      // `othersLabel` deliberately equal to the kept label: the folded
      // "zzz" merges onto "m1" and the summed value overflows.
      { maxNodes: 2, othersLabel: "m1" },
    );
    expect(layout.empty).toBe(true);
    expect(layout.nodes.every((node) => Number.isFinite(node.height))).toBe(true);
    expect(layout.links.every((link) => !link.path.includes("NaN"))).toBe(true);
  });

  it("keeps proportional bars at capacity (the cap is not just a fit check)", () => {
    const many = Array.from({ length: 30 }, (_, i) => ({
      source: `s${String(i).padStart(2, "0")}`,
      middle: "up",
      target: "m1",
      value: 10,
    }));
    const layout = usageFlowLayout(many, { height: 420, maxNodes: 0 });
    const sources = columnNodes(layout, 0);
    // The cap shrinks below the raw fit count so every kept bar keeps a
    // proportional band — none sits on the 2-unit visibility floor.
    for (const node of sources) {
      if (node.others) continue;
      expect(node.height, `${node.fullLabel} must not be flattened`).toBeGreaterThan(2);
    }
    // ...and the folded bucket still carries the tail.
    expect(sources.some((node) => node.others)).toBe(true);
    expect(sources.reduce((acc, node) => acc + node.value, 0)).toBe(300);
  });

  it("pins the label-visibility boundary against the ROUNDED bar height", () => {
    // The DOM height is rounded to two decimals; the label decision must
    // follow the rounded value, or a bar rendered at 12 could ship bare.
    expect(flowLabelVisible(11.994)).toBe(false);
    expect(flowLabelVisible(11.995)).toBe(true); // rounds to 12.00
    expect(flowLabelVisible(12)).toBe(true);
    expect(flowLabelVisible(11.99)).toBe(false);
    expect(flowLabelVisible(40)).toBe(true);
  });

  it("drops a duplicate sum that overflows instead of poisoning the column", () => {
    const layout = usageFlowLayout([
      { source: "a", middle: "up", target: "m1", value: 1e308 },
      { source: "a", middle: "up", target: "m1", value: 1e308 },
      { source: "b", middle: "up", target: "m1", value: 10 },
    ]);
    expect(layout.empty).toBe(false);
    expect(layout.nodes.every((node) => Number.isFinite(node.y) && Number.isFinite(node.height))).toBe(true);
    expect(layout.links.every((link) => !link.path.includes("NaN"))).toBe(true);
    // The overflowing triple is gone; the healthy row survives.
    expect(layout.total).toBe(10);
    expect(layout.nodes.some((node) => node.fullLabel === "a")).toBe(false);
    expect(layout.nodes.some((node) => node.fullLabel === "b")).toBe(true);
  });

  it("never hands two models the same colour because a roster row repeats", () => {
    const layout = usageFlowLayout(
      [
        { source: "k", middle: "up", target: "a", value: 3 },
        { source: "k", middle: "up", target: "b", value: 2 },
      ],
      { models: [{ label: "a" }, { label: "a" }, { label: "b" }], colors: ["c0", "c1", "c2"] },
    );
    const colors = new Map(layout.legend.map((row) => [row.label, row.color]));
    expect(colors.get("a")).toBe("c0");
    expect(colors.get("b")).toBe("c1");
  });

  it("wraps a palette shorter than the roster", () => {
    const layout = usageFlowLayout(
      [
        { source: "k", middle: "up", target: "a", value: 3 },
        { source: "k", middle: "up", target: "b", value: 2 },
        { source: "k", middle: "up", target: "c", value: 1 },
      ],
      { models: [{ label: "a" }, { label: "b" }, { label: "c" }], colors: ["c0", "c1"] },
    );
    expect(layout.legend.map((row) => row.color)).toEqual(["c0", "c1", "c0"]);
  });

  it("draws ribbons with the target node's colour and a closed path", () => {
    const layout = usageFlowLayout(ROWS);
    const byKey = new Map(layout.nodes.map((node) => [node.key, node]));
    expect(layout.links.length).toBeGreaterThan(0);
    for (const link of layout.links) {
      expect(link.color).toBe(byKey.get(link.targetKey)?.color);
      expect(link.path.startsWith("M ")).toBe(true);
      expect(link.path.endsWith(" Z")).toBe(true);
    }
    // Two stages of links exist: caller→upstream and upstream→model.
    const stages = new Set(layout.links.map((link) => (link.sourceKey.startsWith("0:") ? 0 : 1)));
    expect([...stages].sort()).toEqual([0, 1]);
  });

  it("collapses the tail of a column into one others bucket without losing value", () => {
    const many = ["a", "b", "c", "d", "e"].map((source, index) => ({
      source,
      middle: "up",
      target: "m1",
      value: (index + 1) * 10,
    }));
    const layout = usageFlowLayout(many, { maxNodes: 3, othersLabel: "Other callers" });
    const sources = columnNodes(layout, 0);
    // The folded bucket outranks the retained tail nodes (it carries
    // a + b + c = 60), so it stacks first — columns rank AFTER folding.
    expect(sources.map((node) => node.fullLabel)).toEqual(["Other callers", "e", "d"]);
    const others = sources[0];
    expect(others.others).toBe(true);
    expect(others.value).toBe(10 + 20 + 30);
    expect(layout.total).toBe(150);
    // The legend covers the MODEL column only: a folded caller bucket is a
    // node, not a model row.
    expect(layout.legend.map((row) => row.label)).toEqual(["m1"]);
  });

  it("folds an overflowing model column in the chart but lists every model", () => {
    const rows = ["m1", "m2", "m3", "m4"].map((target) => ({
      source: "k",
      middle: "up",
      target,
      value: 10,
    }));
    const layout = usageFlowLayout(rows, { maxNodes: 3, othersLabel: "Other models" });
    expect(layout.total).toBe(40);
    // The chart collapses the tail into one bucket node...
    const bucket = layout.nodes.find(
      (node) => node.column === 2 && node.fullLabel === "Other models",
    );
    expect(bucket?.value).toBe(20);
    expect(bucket?.others).toBe(true);
    // ...while the legend keeps the FULL model table, pre-fold: folding
    // is a chart layout decision, not a usage fact.
    expect(layout.legend.map((row) => row.label)).toEqual(["m1", "m2", "m3", "m4"]);
    for (const row of layout.legend) {
      expect(row.value, `${row.label} keeps its real total`).toBe(10);
      expect(row.percent).toBe(25);
      expect(row.idle).toBe(false);
    }
    expect(layout.legend.some((row) => row.label === "Other models")).toBe(false);
  });

  it("reports a folded registered model's real total, never a zero it did not have", () => {
    const rows = ["m1", "m2", "m3", "m4"].map((target) => ({
      source: "k",
      middle: "up",
      target,
      value: 10,
    }));
    const layout = usageFlowLayout(rows, {
      maxNodes: 2,
      models: [{ label: "m1" }, { label: "m2" }, { label: "m3" }, { label: "m4" }],
    });
    // m3/m4 are folded into the chart's bucket; the legend must still
    // report the traffic they carried (the S1 the round-2 reviewer found).
    const m3 = layout.legend.find((row) => row.label === "m3")!;
    expect(m3.value).toBe(10);
    expect(m3.idle).toBe(false);
    expect(m3.percent).toBe(25);
    expect(layout.legend.map((row) => row.label)).toEqual(["m1", "m2", "m3", "m4"]);
  });

  it("merges a real label that equals the others bucket into the fold", () => {
    const rows = [
      { source: "a", middle: "up", target: "m1", value: 40 },
      { source: "b", middle: "up", target: "m1", value: 30 },
      { source: "Others", middle: "up", target: "m1", value: 20 },
      { source: "c", middle: "up", target: "m1", value: 10 },
    ];
    const layout = usageFlowLayout(rows, { maxNodes: 2, othersLabel: "Others" });
    const sources = columnNodes(layout, 0);
    // A real label equal to the fold label merges into the bucket by label:
    // top 1 is "a" (40), so b + Others + c = 60 fold together.
    expect(sources.map((node) => node.fullLabel).sort()).toEqual(["Others", "a"]);
    expect(sources.find((node) => node.fullLabel === "Others")?.value).toBe(60);
  });

  it("lets the registered roster fix colours and lists idle models", () => {
    const roster = [
      { label: "model-b" },
      { label: "model-a" },
      { label: "model-idle" },
    ];
    const rows = [
      { source: "k", middle: "up", target: "model-a", value: 60 },
      { source: "k", middle: "up", target: "model-b", value: 40 },
    ];
    const layout = usageFlowLayout(rows, { models: roster });
    const legend = layout.legend;
    expect(legend.map((row) => row.label)).toEqual(["model-b", "model-a", "model-idle"]);
    // Colour order follows the roster, not usage: model-b is slot 0 even
    // though model-a served more.
    expect(legend[0].color).toBe(USAGE_FLOW_PALETTE[0]);
    expect(legend[1].color).toBe(USAGE_FLOW_PALETTE[1]);
    expect(legend[2].idle).toBe(true);
    expect(legend[2].value).toBe(0);
    expect(legend[2].color).toBe(USAGE_FLOW_PALETTE[2]);
    // The node colour matches the legend swatch.
    const nodeA = layout.nodes.find((node) => node.fullLabel === "model-a")!;
    expect(nodeA.color).toBe(USAGE_FLOW_PALETTE[1]);
    expect(layout.legend[0].value).toBe(40);
    expect(layout.legend[1].value).toBe(60);
  });

  it("keeps a real model labelled like the fold bucket as its own row", () => {
    const rows = [
      { source: "k", middle: "up", target: "Others", value: 50 },
      { source: "k", middle: "up", target: "m1", value: 30 },
      { source: "k", middle: "up", target: "m2", value: 10 },
      { source: "k", middle: "up", target: "m3", value: 5 },
    ];
    const layout = usageFlowLayout(rows, { maxNodes: 3, othersLabel: "Others" });
    const row = layout.legend.find((candidate) => candidate.label === "Others")!;
    // The fold bucket merges into the real kept model by label in the
    // CHART; the legend reports the model's own traffic (50), not the
    // merged bucket sum.
    expect(row.value).toBe(50);
    expect(row.percent).toBeCloseTo((50 / 95) * 100, 5);
    const node = layout.nodes.find(
      (candidate) => candidate.column === 2 && candidate.fullLabel === "Others",
    )!;
    expect(node.value).toBe(65);
    // The NODE-side kept-guard too: this label is a kept real model, not
    // the synthetic bucket, so it must not wear the bucket styling.
    expect(node.others).toBe(false);
    expect(layout.total).toBe(95);
  });

  it("appends models with traffic that the roster does not know", () => {
    const layout = usageFlowLayout(
      [
        { source: "k", middle: "up", target: "registered", value: 70 },
        { source: "k", middle: "up", target: "unregistered", value: 30 },
      ],
      { models: [{ label: "registered" }] },
    );
    expect(layout.legend.map((row) => row.label)).toEqual(["registered", "unregistered"]);
    expect(layout.legend[1].color).toBe(USAGE_FLOW_PALETTE[1]);
    expect(layout.legend[1].idle).toBe(false);
  });

  it("draws the exact slot thickness — the path's cap edges carry it", () => {
    const rows = [
      { source: "huge", middle: "up", target: "m1", value: 9_800_000 },
      ...Array.from({ length: 9 }, (_, i) => ({
        source: `tiny-${i}`,
        middle: "up",
        target: "m1",
        value: 2_000,
      })),
    ];
    const layout = usageFlowLayout(rows, { height: 420 });
    let thin = 0;
    for (const link of layout.links) {
      const points = pathPoints(link.path);
      for (const x of new Set(points.map((point) => point.x))) {
        const ys = points.filter((point) => point.x === x).map((point) => point.y);
        if (ys.length !== 2) continue;
        expect(
          Math.abs(ys[0] - ys[1]),
          `drawn cap thickness of ${link.key}`,
        ).toBeCloseTo(link.thickness, 1);
      }
      if (link.thickness < 0.5) thin += 1;
    }
    // The dataset must actually exercise sub-unit slots: a draw floor
    // (the round-2 defect) only shows up on thin ribbons.
    expect(thin).toBeGreaterThan(0);
  });

  it("keeps a floored node's multi-link slots contiguous and scaled", () => {
    const rows = [
      { source: "huge", middle: "up", target: "m1", value: 9_800_000 },
      { source: "tiny", middle: "up-a", target: "m1", value: 1_000 },
      { source: "tiny", middle: "up-b", target: "m1", value: 1_000 },
    ];
    const layout = usageFlowLayout(rows, { height: 420 });
    const tiny = layout.nodes.find(
      (node) => node.fullLabel === "tiny" && node.column === 0,
    )!;
    expect(tiny.height).toBe(2); // floored bar
    const scale =
      layout.links.find((link) => link.value === 9_800_000)!.thickness / 9_800_000;
    const outgoing = layout.links
      .filter((link) => link.sourceKey === tiny.key)
      .sort((a, b) => a.startY - b.startY);
    expect(outgoing).toHaveLength(2);
    expect(outgoing[0].startY).toBeCloseTo(tiny.y, 2);
    expect(outgoing[0].startY + outgoing[0].thickness).toBeCloseTo(
      outgoing[1].startY,
      2,
    );
    expect(outgoing[1].startY).toBeCloseTo(tiny.y + 1_000 * scale, 2);
    expect(outgoing[1].startY + outgoing[1].thickness).toBeCloseTo(
      tiny.y + tiny.value * scale,
      2,
    );
  });

  it("falls back to its defaults for non-finite frame/truncation options", () => {
    const layout = usageFlowLayout(
      [{ source: "s".repeat(60), middle: "up", target: "m", value: 1 }],
      {
        width: Number.NaN,
        height: Number.NaN,
        maxNodes: Number.NaN,
        labelMaxChars: Number.NaN,
      },
    );
    expect(layout.width).toBe(960);
    expect(layout.height).toBe(420);
    for (const node of layout.nodes) {
      expect(Number.isFinite(node.x)).toBe(true);
      expect(Number.isFinite(node.y)).toBe(true);
      expect(Number.isFinite(node.height)).toBe(true);
    }
    // Truncation is NOT silently disabled by a NaN budget.
    const source = layout.nodes.find((node) => node.column === 0)!;
    expect(source.label.endsWith("…")).toBe(true);
  });

  it("offsets unregistered model slots by the ASSIGNED roster slots", () => {
    const layout = usageFlowLayout(
      [
        { source: "k", middle: "up", target: "a", value: 3 },
        { source: "k", middle: "up", target: "b", value: 2 },
      ],
      { models: [{ label: "a" }, { label: "a" }], colors: ["c0", "c1", "c2"] },
    );
    const b = layout.legend.find((row) => row.label === "b")!;
    // One DISTINCT roster label, so "b" takes the slot after it (c1) —
    // not the slot after the duplicate-inflated array length (c2).
    expect(b.color).toBe("c1");
  });

  it("ignores malformed roster entries instead of throwing", () => {
    const layout = usageFlowLayout(
      [{ source: "k", middle: "up", target: "m", value: 1 }],
      { models: [null as never, { label: "" }, { label: "m" }] },
    );
    expect(layout.legend.map((row) => row.label)).toEqual(["m"]);
    for (const row of layout.legend) {
      expect(typeof row.label).toBe("string");
      expect(row.label).not.toBe("undefined");
    }
  });

  it("honours explicit roster colours and a custom palette", () => {
    const layout = usageFlowLayout(
      [{ source: "k", middle: "up", target: "m", value: 1 }],
      {
        colors: ["rgb(1 2 3)", "rgb(4 5 6)"],
        models: [{ label: "m", color: "rgb(9 9 9)" }],
      },
    );
    expect(layout.legend[0].color).toBe("rgb(9 9 9)");
    const node = layout.nodes.find((candidate) => candidate.fullLabel === "m")!;
    expect(node.color).toBe("rgb(9 9 9)");
    // Unrostered models ride the custom ladder.
    const other = usageFlowLayout(
      [{ source: "k", middle: "up", target: "x", value: 1 }],
      { colors: ["rgb(1 2 3)", "rgb(4 5 6)"] },
    );
    expect(other.legend[0].color).toBe("rgb(1 2 3)");
  });

  it("truncates long labels but keeps the full label on the node", () => {
    const long = "deepseek-v4.1-flash-1017-celestia-edition-very-long";
    const layout = usageFlowLayout(
      [{ source: "k", middle: "up", target: long, value: 1 }],
      { labelMaxChars: 12 },
    );
    const node = layout.nodes.find((candidate) => candidate.column === 2)!;
    expect(node.label.endsWith("…")).toBe(true);
    expect(node.label.length).toBeLessThanOrEqual(13);
    expect(node.fullLabel).toBe(long);
    // The legend keeps the untruncated roster label.
    expect(layout.legend[0].label).toBe(long);
  });

  it("counts a CJK label's width as two units when truncating", () => {
    expect(truncateFlowLabel("模型用量分布信息", 8)).toBe("模型用量…");
    expect(truncateFlowLabel("模型用量分布信息", 100)).toBe("模型用量分布信息");
  });

  it("is deterministic: identical input yields identical geometry and colours", () => {
    const a = usageFlowLayout(ROWS, { height: 420, models: [{ label: "m1" }] });
    const b = usageFlowLayout(ROWS, { height: 420, models: [{ label: "m1" }] });
    expect(a).toEqual(b);
  });

  it("clamps a degenerate frame instead of emitting negative geometry", () => {
    const layout = usageFlowLayout(ROWS, { width: 1, height: 1 });
    expect(layout.width).toBe(320);
    expect(layout.height).toBe(180);
    for (const node of layout.nodes) {
      expect(node.height).toBeGreaterThanOrEqual(2);
      expect(Number.isFinite(node.y)).toBe(true);
      expect(Number.isFinite(node.height)).toBe(true);
    }
  });

  it("formats shares without pretending a sub-percent slice is zero", () => {
    expect(formatFlowPercent(0)).toBe("0%");
    expect(formatFlowPercent(0.4)).toBe("<1%");
    expect(formatFlowPercent(1)).toBe("1%");
    expect(formatFlowPercent(33.4)).toBe("33%");
    expect(formatFlowPercent(100)).toBe("100%");
    expect(formatFlowPercent(Number.NaN)).toBe("0%");
  });

  it("keeps linksFrom() consistent with the flow values", () => {
    const layout = usageFlowLayout(ROWS);
    const k1 = layout.nodes.find((node) => node.fullLabel === "k1" && node.column === 0)!;
    const outgoing = linksFrom(layout, k1.key);
    expect(outgoing.map((link) => link.value).sort((a, b) => a - b)).toEqual([300, 500]);
  });
});
