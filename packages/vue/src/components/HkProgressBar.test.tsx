import { afterEach, describe, expect, it } from "vitest";
import { createApp, h, nextTick } from "vue";

import HkProgressBar from "./HkProgressBar";

/**
 * HkProgressBar segmented-mode contract tests:
 * - `segments` renders one flush block per segment with its own width/color
 * - without `segments` the value/secondary/status behavior is untouched
 */
const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

function mount(props: Record<string, unknown>) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({ render: () => h(HkProgressBar, props as never) });
  app.mount(container);
  mounts.push({ app, container });
  return container;
}

afterEach(() => {
  for (const { app, container } of mounts.splice(0)) {
    app.unmount();
    container.remove();
  }
});

describe("HkProgressBar segmented mode", () => {
  it("renders one block per segment with width and inline color", () => {
    const c = mount({
      segments: [
        { value: 30, color: "#f00" },
        { value: 20, color: "#0f0" },
      ],
    });
    const segs = c.querySelectorAll(".hk-progress-bar-seg");
    expect(segs).toHaveLength(2);
    expect((segs[0] as HTMLElement).style.width).toBe("30%");
    expect((segs[0] as HTMLElement).style.background).toBe("#f00");
    expect((segs[1] as HTMLElement).style.width).toBe("20%");
    expect((segs[1] as HTMLElement).style.background).toBe("#0f0");
    // No legacy fills in segmented mode.
    expect(c.querySelector(".hk-progress-bar-fill")).toBeNull();
    expect(c.querySelector(".hk-progress-bar-secondary")).toBeNull();
  });

  it("appends the segment class and tolerates a missing color", () => {
    const c = mount({
      segments: [{ value: 40, class: "my-block" }, { value: 10 }],
    });
    const seg = c.querySelector(".hk-progress-bar-seg.my-block");
    expect(seg).not.toBeNull();
    expect((c.querySelectorAll(".hk-progress-bar-seg")[1] as HTMLElement).style.background).toBe("");
  });

  it("clamps out-of-range widths", () => {
    const c = mount({
      segments: [{ value: -5 }, { value: 120 }],
    });
    const segs = c.querySelectorAll(".hk-progress-bar-seg");
    expect((segs[0] as HTMLElement).style.width).toBe("0%");
    expect((segs[1] as HTMLElement).style.width).toBe("100%");
  });

  it("renders an empty track for an empty segments array (no indeterminate sweep)", () => {
    const c = mount({ segments: [] });
    expect(c.querySelectorAll(".hk-progress-bar-seg")).toHaveLength(0);
    expect(c.querySelector(".hk-progress-bar-indeterminate")).toBeNull();
  });
});

describe("HkProgressBar single-value mode (backward compat)", () => {
  it("renders the value fill at its percentage", () => {
    const c = mount({ value: 65, max: 100 });
    const fill = c.querySelector(".hk-progress-bar-fill");
    expect(fill).not.toBeNull();
    expect((fill as HTMLElement).style.width).toBe("65%");
    expect(c.querySelectorAll(".hk-progress-bar-seg")).toHaveLength(0);
  });

  it("still renders the indeterminate sweep when value is null", () => {
    const c = mount({});
    expect(c.querySelector(".hk-progress-bar-indeterminate")).not.toBeNull();
  });
});

/** Settled innerHTML of a fresh mount — the regression fixtures compare it. */
async function renderHtml(props: Record<string, unknown>) {
  const c = mount(props);
  await nextTick();
  return c.innerHTML;
}

function overspendBlock(c: HTMLElement): HTMLElement | null {
  return c.querySelector<HTMLElement>(".hk-progress-bar-overspend");
}

/**
 * The overspend block's inline geometry, split back into its numbers. The
 * seam is the `+ 1px` / `- 1px` pair: the block starts one pixel past the
 * quota edge and loses that pixel from its own width, so the visible
 * divider is exactly 1px at any track width (and the pair always sums back
 * to a full track when quota is exhausted).
 */
function overspendGeometry(c: HTMLElement) {
  const block = overspendBlock(c);
  expect(block, "overspend block").not.toBeNull();
  const start = block!.style.getPropertyValue("inset-inline-start");
  const width = block!.style.width;
  const startMatch = /^calc\(([\d.]+)% \+ 1px\)$/.exec(start);
  const widthMatch = /^calc\(([\d.]+)% - 1px\)$/.exec(width);
  expect(startMatch, `start seam ${start}`).not.toBeNull();
  expect(widthMatch, `width seam ${width}`).not.toBeNull();
  return {
    edge: Number.parseFloat(startMatch![1]!),
    over: Number.parseFloat(widthMatch![1]!),
  };
}

describe("HkProgressBar overspend mode (CONTRACT §9 fixtures)", () => {
  it("0 — an empty bar grows no overspend block", () => {
    const c = mount({ value: 0, max: 100 });
    expect((c.querySelector(".hk-progress-bar-fill") as HTMLElement).style.width).toBe("0%");
    expect(overspendBlock(c)).toBeNull();
    expect(c.querySelector(".hk-progress-bar-track--overspend")).toBeNull();
  });

  it("half — a half bar grows no overspend block", () => {
    const c = mount({ value: 50, max: 100 });
    expect((c.querySelector(".hk-progress-bar-fill") as HTMLElement).style.width).toBe("50%");
    expect(overspendBlock(c)).toBeNull();
  });

  it("full — exactly at quota there is still no overspend block", () => {
    const c = mount({ value: 100, max: 100 });
    expect((c.querySelector(".hk-progress-bar-fill") as HTMLElement).style.width).toBe("100%");
    expect(overspendBlock(c)).toBeNull();
  });

  it("over 1% — the quota edge keeps the fill and the stretch follows it", () => {
    const c = mount({ value: 100, max: 100, overValue: 1 });
    // Track total = 101: 100/101 keeps the quota edge, 1/101 is overspend.
    expect((c.querySelector(".hk-progress-bar-fill") as HTMLElement).style.width).toBe("99.0099%");
    const g = overspendGeometry(c);
    expect(g.edge).toBe(99.0099);
    expect(g.over).toBe(0.9901);
    expect(g.edge + g.over).toBeCloseTo(100, 4);
    expect(overspendBlock(c)!.className).toContain("hk-progress-bar-overspend-muted");
    expect(overspendBlock(c)!.getAttribute("aria-hidden")).toBe("true");
  });

  it("over 50% — half again as much as quota, in the danger tone", () => {
    const c = mount({ value: 100, max: 100, overValue: 50, overspendTone: "danger" });
    // Track total = 150: 100/150 quota edge, 50/150 overspend.
    expect((c.querySelector(".hk-progress-bar-fill") as HTMLElement).style.width).toBe("66.6667%");
    const g = overspendGeometry(c);
    expect(g.edge).toBe(66.6667);
    expect(g.over).toBe(33.3333);
    expect(g.edge + g.over).toBeCloseTo(100, 4);
    expect(overspendBlock(c)!.className).toContain("hk-progress-bar-overspend-danger");
    expect(overspendBlock(c)!.className).not.toContain("hk-progress-bar-overspend-muted");
  });

  it("max=0 — a bar with no quota at all is entirely overspend", () => {
    const c = mount({ value: 0, max: 0, overValue: 5 });
    // No quota slice: total = overValue, so the fill is 0% and the stretch
    // takes the whole track (minus the 1px seam).
    expect((c.querySelector(".hk-progress-bar-fill") as HTMLElement).style.width).toBe("0%");
    const g = overspendGeometry(c);
    expect(g.edge).toBe(0);
    expect(g.over).toBe(100);
  });

  it("derives overValue when the value itself runs past max", () => {
    const c = mount({ value: 105, max: 100 });
    // total = 105: 100/105 quota edge, 5/105 overspend.
    expect((c.querySelector(".hk-progress-bar-fill") as HTMLElement).style.width).toBe("95.2381%");
    const g = overspendGeometry(c);
    expect(g.edge).toBe(95.2381);
    expect(g.over).toBe(4.7619);
  });

  it("derives exactly what the clamped quota-card shape states explicitly", () => {
    // chest's card passes value = min(used, quota) + overValue = used - quota;
    // a caller handing the raw value must paint the same picture.
    const derived = overspendGeometry(mount({ value: 105, max: 100 }));
    const explicit = overspendGeometry(mount({ value: 100, max: 100, overValue: 5 }));
    expect(derived).toEqual(explicit);
    const card = overspendGeometry(mount({ value: 100, max: 100, overValue: 4 }));
    expect(card.edge).toBe(96.1538);
    expect(card.over).toBe(3.8462);
  });

  it("keeps the legacy fill when overValue is explicitly 0 even past max", () => {
    const c = mount({ value: 140, max: 100, overValue: 0 });
    expect(overspendBlock(c)).toBeNull();
    expect((c.querySelector(".hk-progress-bar-fill") as HTMLElement).style.width).toBe("100%");
  });

  it("renders the caption with its tone beside the value label", () => {
    const c = mount({
      value: 100, max: 100, overValue: 2, showLabel: true,
      overspendLabel: "超支 2.0 度", overspendTone: "danger",
    });
    expect(c.querySelector(".hk-progress-bar-label")!.textContent).toBe("100%超支 2.0 度");
    const caption = c.querySelector(".hk-progress-bar-overspend-label")!;
    expect(caption.textContent).toBe("超支 2.0 度");
    expect(caption.className).toContain("hk-progress-bar-overspend-label-danger");
  });

  it("shows the caption alone when showLabel is off, and never without overspend", () => {
    const alone = mount({ value: 100, max: 100, overValue: 1, overspendLabel: "超支 1.0 度" });
    expect(alone.querySelector(".hk-progress-bar-overspend-label")!.textContent).toBe("超支 1.0 度");
    // The value label itself stays off — only the caption row rendered.
    expect(alone.querySelector(".hk-progress-bar-label")!.textContent).toBe("超支 1.0 度");

    const dormant = mount({ value: 50, max: 100, overspendLabel: "超支 1.0 度" });
    expect(dormant.querySelector(".hk-progress-bar-overspend-label")).toBeNull();
  });

  it("scales the secondary overlay onto the stretched track", () => {
    const c = mount({ value: 100, max: 100, overValue: 50, secondary: 75 });
    // secondary 75 of the stretched total 150 — not of the old 100 max.
    expect((c.querySelector(".hk-progress-bar-secondary") as HTMLElement).style.width).toBe("50%");
  });

  it("ignores overspend in segmented mode (segments cannot exceed 100%)", () => {
    const c = mount({ segments: [{ value: 50 }], overValue: 10 });
    expect(overspendBlock(c)).toBeNull();
    expect((c.querySelector(".hk-progress-bar-seg") as HTMLElement).style.width).toBe("50%");
  });

  it("ignores overspend on the indeterminate sweep (no quantity to overrun)", () => {
    const c = mount({ overValue: 10 });
    expect(c.querySelector(".hk-progress-bar-indeterminate")).not.toBeNull();
    expect(overspendBlock(c)).toBeNull();
  });

  it("never emits NaN widths for a degenerate (non-positive) total", () => {
    const c = mount({ value: 5, max: -10, overValue: 5 });
    expect(overspendBlock(c)).toBeNull();
    expect(c.innerHTML).not.toContain("NaN");
  });
});

/**
 * The no-overspend render must stay BYTE-identical to the pre-overspend
 * implementation. These markup strings were recorded from master e6263f45
 * (the commit this change branches from) BEFORE the component grew the
 * overspend branch; the `<!---->` placeholders are Vue's own v-if anchors,
 * so an extra conditional layer or a changed class list shows up here as a
 * diff, not just as a "close enough" layout. That is the pixel-equivalence
 * guard the contract asks for.
 */
describe("HkProgressBar no-overspend regression (byte-identical render)", () => {
  const RECORDED: Array<[string, Record<string, unknown>, string]> = [
    ["0", { value: 0, max: 100 },
      '<div class="hk-progress-bar" data-size="sm"><!----><div class="hk-progress-bar-track"><!----><div class="hk-progress-bar-fill hk-progress-bar-fill-loading" style="width: 0%;"></div></div></div>'],
    ["half", { value: 50, max: 100 },
      '<div class="hk-progress-bar" data-size="sm"><!----><div class="hk-progress-bar-track"><!----><div class="hk-progress-bar-fill hk-progress-bar-fill-loading" style="width: 50%;"></div></div></div>'],
    ["full", { value: 100, max: 100 },
      '<div class="hk-progress-bar" data-size="sm"><!----><div class="hk-progress-bar-track"><!----><div class="hk-progress-bar-fill hk-progress-bar-fill-loading" style="width: 100%;"></div></div></div>'],
    ["indeterminate", {},
      '<div class="hk-progress-bar" data-size="sm"><!----><div class="hk-progress-bar-track"><div class="hk-progress-bar-indeterminate hk-progress-bar-indeterminate-loading"></div></div></div>'],
    ["secondary + label + size + status", { value: 40, max: 100, secondary: 80, status: "done", size: "md", showLabel: true },
      '<div class="hk-progress-bar" data-size="md"><span class="hk-progress-bar-label">40%</span><div class="hk-progress-bar-track"><div class="hk-progress-bar-secondary hk-progress-bar-secondary-done" style="width: 80%;"></div><div class="hk-progress-bar-fill hk-progress-bar-fill-done" style="width: 40%;"></div></div></div>'],
    ["segments", { segments: [{ value: 30, color: "#f00" }, { value: 20, class: "b" }] },
      '<div class="hk-progress-bar" data-size="sm"><!----><div class="hk-progress-bar-track hk-progress-bar-track--segments"><div class="hk-progress-bar-seg" style="width: 30%; background: #f00;"></div><div class="hk-progress-bar-seg b" style="width: 20%;"></div></div></div>'],
    ["max=0 (the legacy NaN-width quirk stays put)", { value: 0, max: 0 },
      '<div class="hk-progress-bar" data-size="sm"><!----><div class="hk-progress-bar-track"><!----><div class="hk-progress-bar-fill hk-progress-bar-fill-loading"></div></div></div>'],
    ["custom label never leaks without showLabel", { value: 65, max: 100, label: "自定义" },
      '<div class="hk-progress-bar" data-size="sm"><!----><div class="hk-progress-bar-track"><!----><div class="hk-progress-bar-fill hk-progress-bar-fill-loading" style="width: 65%;"></div></div></div>'],
    ["xs + error status", { value: 12, max: 100, size: "xs", status: "error" },
      '<div class="hk-progress-bar" data-size="xs"><!----><div class="hk-progress-bar-track"><!----><div class="hk-progress-bar-fill hk-progress-bar-fill-error" style="width: 12%;"></div></div></div>'],
  ];

  for (const [name, props, golden] of RECORDED) {
    it(`renders exactly the pre-overspend markup: ${name}`, async () => {
      expect(await renderHtml(props)).toBe(golden);
    });
  }

  it("treats an explicit overValue: 0 as the legacy full bar", async () => {
    expect(await renderHtml({ value: 140, max: 100, overValue: 0 })).toBe(RECORDED[2]![2]);
  });
});
