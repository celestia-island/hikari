import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick } from "vue";

// HPopover teleports to body and needs popup-manager runtime — stub it
// with a passthrough that renders its slot while open and records the
// interaction-relevant props (same pattern as HkModelTag.test.tsx).
vi.mock("@celestia-island/hikari", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@celestia-island/hikari")>();
  const { defineComponent, h } = await import("vue");
  const HPopoverStub = defineComponent({
    name: "HPopover",
    props: {
      modelValue: { type: Boolean, default: false },
      placement: { type: String, default: "bottom" },
      sheetOnMobile: { type: Boolean, default: false },
      title: { type: String, default: "" },
    },
    setup(props, { slots }) {
      return () =>
        props.modelValue
          ? h(
              "div",
              {
                class: "popover-stub",
                "data-placement": props.placement,
                "data-sheet": String(props.sheetOnMobile),
              },
              slots.default?.(),
            )
          : null;
    },
  });
  return { ...actual, HPopover: HPopoverStub };
});

import { HkContextRing } from "./HkContextRing";

/**
 * HkContextRing contract tests:
 * - ring renders with a button role, model + usage aria-label and a
 *   floored center percentage
 * - zero-token segments are dropped from ring, bar and legend
 * - popover: click toggles, hover delays follow HkModelTag's choreography,
 *   sheetOnMobile is on, placement defaults to bottom-start
 * - legend sorts by tokens desc with correct share math
 * - contextWindow=null degrades to the gray ring + "–" center
 */
const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

function mount(node: ReturnType<typeof h>) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({ render: () => node });
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

function ringNode(props: Record<string, unknown>) {
  return h(HkContextRing, props as never);
}

function baseProps(): Record<string, unknown> {
  return {
    model: "qwen3-coder-plus#8",
    used: 42600,
    contextWindow: 200000,
    segments: [
      { key: "prompt", tokens: 20000 },
      { key: "thinking", tokens: 22600 },
    ],
  };
}

const openPopup = async (c: HTMLElement) => {
  c.querySelector(".hk-ctx-ring")?.dispatchEvent(
    new MouseEvent("click", { bubbles: true }),
  );
  await nextTick();
};

describe("HkContextRing ring", () => {
  it("renders a button-like trigger with model and floored usage in the label", () => {
    const c = mount(ringNode(baseProps()));
    const ring = c.querySelector(".hk-ctx-ring");
    expect(ring?.getAttribute("role")).toBe("button");
    expect(ring?.getAttribute("aria-label")).toContain("qwen3-coder-plus#8");
    // 42600 / 200000 = 21.3% -> floored 21%
    expect(ring?.getAttribute("aria-label")).toContain("21%");
    expect(c.querySelector(".hk-ctx-ring-center")?.textContent).toBe("21%");
  });

  it("shows 100+ once usage passes the window", () => {
    const c = mount(ringNode({
      model: "m",
      used: 220_000,
      contextWindow: 200_000,
      segments: [],
    }));
    expect(c.querySelector(".hk-ctx-ring-center")?.textContent).toBe("100+");
  });

  it("draws one arc per nonzero segment and none for zero-token segments", () => {
    const c = mount(ringNode({
      ...baseProps(),
      segments: [
        { key: "prompt", tokens: 20000 },
        { key: "tool", tokens: 0 },
        { key: "output", tokens: 22600 },
      ],
    }));
    const arcs = c.querySelectorAll(".hk-progress-ring-seg");
    expect(arcs).toHaveLength(2);
  });

  it("partitions the occupancy so estimated segments still fill up to the center pct", () => {
    // Segments sum (20k) intentionally != used (60k): the raw tokens/window
    // shares would end the fill at 10% while the center claims 30%. The
    // arcs must instead split the whole 30% proportionally.
    const c = mount(ringNode({
      model: "m",
      used: 60_000,
      contextWindow: 200_000,
      segments: [
        { key: "prompt", tokens: 5_000 },
        { key: "tool", tokens: 15_000 },
      ],
    }));
    const arcs = c.querySelectorAll(".hk-progress-ring-seg");
    expect(arcs).toHaveLength(2);
    const R = (28 - 3) / 2;
    const C = 2 * Math.PI * R;
    const drawn = [...arcs].reduce(
      (acc, el) => acc + Number(el.getAttribute("stroke-dasharray")?.split(/\s+/)[0]),
      0,
    );
    // drawn total = 30% of the circumference (within per-arc gap carve)
    expect(drawn).toBeGreaterThan(0.25 * C);
    expect(drawn).toBeLessThan(0.30 * C);
    // Composition ratio preserved up to the inter-arc gap carve: the first
    // arc (25% of the composition -> 7.5% of the ring) loses the 1%-of-ring
    // gap, the last arc (75% -> 22.5%) keeps its full share.
    const len0 = Number(arcs[0].getAttribute("stroke-dasharray")?.split(/\s+/)[0]);
    const len1 = Number(arcs[1].getAttribute("stroke-dasharray")?.split(/\s+/)[0]);
    expect(len0).toBeCloseTo((0.075 - 0.01) * C, 5);
    expect(len1).toBeCloseTo(0.225 * C, 5);
  });

  it("draws a single muted occupancy arc when composition is all zeros", () => {
    const c = mount(ringNode({
      ...baseProps(),
      segments: [
        { key: "prompt", tokens: 0 },
        { key: "tool", tokens: 0 },
      ],
    }));
    const arcs = c.querySelectorAll(".hk-progress-ring-seg");
    expect(arcs).toHaveLength(1);
    // The muted fallback carries the full 21.3% occupancy.
    const R = (28 - 3) / 2;
    const C = 2 * Math.PI * R;
    const drawn = Number(arcs[0].getAttribute("stroke-dasharray")?.split(/\s+/)[0]);
    expect(drawn).toBeCloseTo((42_600 / 200_000) * C, 5);
    expect(arcs[0].getAttribute("style")).toContain("--context-free");
  });

  it("degrades to a gray ring with a dash center when the window is null", () => {
    const c = mount(ringNode({
      model: "m",
      used: 100,
      contextWindow: null,
      segments: [{ key: "prompt", tokens: 100 }],
    }));
    expect(c.querySelector(".hk-ctx-ring-center")?.textContent).toBe("–");
    expect(c.querySelectorAll(".hk-progress-ring-seg")).toHaveLength(0);
    expect(c.querySelector(".hk-progress-ring-track")).not.toBeNull();
  });
});

describe("HkContextRing popover", () => {
  it("opens and closes on click", async () => {
    const c = mount(ringNode(baseProps()));
    expect(c.querySelector(".hk-ctx-pop")).toBeNull();
    await openPopup(c);
    expect(c.querySelector(".hk-ctx-pop")).not.toBeNull();
    expect(c.querySelector(".hk-ctx-pop-model")).not.toBeNull();
    // model pill content is rendered inside the popup
    expect(c.querySelector(".hk-ctx-pop-model")?.textContent).toContain("qwen3-coder-plus");
    await openPopup(c);
    expect(c.querySelector(".hk-ctx-pop")).toBeNull();
  });

  it("opens on hover after the 250ms delay and closes on leave after 120ms", async () => {
    vi.useFakeTimers();
    try {
      const c = mount(ringNode(baseProps()));
      const ring = c.querySelector(".hk-ctx-ring")!;
      ring.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
      vi.advanceTimersByTime(249);
      await nextTick();
      expect(c.querySelector(".hk-ctx-pop")).toBeNull();
      vi.advanceTimersByTime(2);
      await nextTick();
      expect(c.querySelector(".hk-ctx-pop")).not.toBeNull();

      ring.dispatchEvent(new MouseEvent("mouseleave", { bubbles: true }));
      vi.advanceTimersByTime(119);
      await nextTick();
      expect(c.querySelector(".hk-ctx-pop")).not.toBeNull();
      vi.advanceTimersByTime(2);
      await nextTick();
      expect(c.querySelector(".hk-ctx-pop")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("toggles with Enter and Space", async () => {
    const c = mount(ringNode(baseProps()));
    const ring = c.querySelector(".hk-ctx-ring")!;
    ring.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await nextTick();
    expect(c.querySelector(".hk-ctx-pop")).not.toBeNull();
    ring.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
    await nextTick();
    expect(c.querySelector(".hk-ctx-pop")).toBeNull();
  });

  it("asks HPopover for the mobile bottom sheet by default", async () => {
    const c = mount(ringNode(baseProps()));
    await openPopup(c);
    const stub = c.querySelector(".popover-stub");
    expect(stub?.getAttribute("data-sheet")).toBe("true");
    expect(stub?.getAttribute("data-placement")).toBe("bottom-start");
  });

  it("honours the placement prop", async () => {
    const c = mount(ringNode({ ...baseProps(), placement: "top-end" }));
    await openPopup(c);
    expect(c.querySelector(".popover-stub")?.getAttribute("data-placement")).toBe("top-end");
  });

  it("renders the segmented bar with the same data as the ring", async () => {
    const c = mount(ringNode(baseProps()));
    await openPopup(c);
    const blocks = c.querySelectorAll(".hk-ctx-pop-bar .hk-progress-bar-seg");
    expect(blocks).toHaveLength(2);
    // 20000 / 200000 = 10%, 22600 / 200000 = 11.3%
    expect((blocks[0] as HTMLElement).style.width).toBe("10%");
    expect((blocks[1] as HTMLElement).style.width).toBe("11.3%");
  });
});

describe("HkContextRing legend", () => {
  it("sorts rows by tokens desc and computes the window share", async () => {
    const c = mount(ringNode({
      model: "m",
      used: 85000,
      contextWindow: 200000,
      segments: [
        { key: "prompt", tokens: 20000 },
        { key: "user", tokens: 5000 },
        { key: "thinking", tokens: 60000 },
      ],
    }));
    await openPopup(c);
    const rows = c.querySelectorAll(".hk-ctx-legend-row");
    expect(rows).toHaveLength(3);
    const labels = Array.from(rows).map((r) => r.querySelector(".hk-ctx-legend-label")?.textContent);
    expect(labels).toEqual(["Thinking", "Prompt", "User"]);
    const tokens = Array.from(rows).map((r) => r.querySelector(".hk-ctx-legend-tokens")?.textContent);
    expect(tokens).toEqual(["60.0k", "20.0k", "5.0k"]);
    const pcts = Array.from(rows).map((r) => r.querySelector(".hk-ctx-legend-pct")?.textContent);
    expect(pcts).toEqual(["30%", "10%", "2.5%"]);
  });

  it("resolves segment labels through the hikari::context i18n keys", async () => {
    const c = mount(ringNode(baseProps()));
    await openPopup(c);
    const labels = Array.from(c.querySelectorAll(".hk-ctx-legend-label")).map((n) => n.textContent);
    expect(labels).toContain("Thinking");
    expect(labels).toContain("Prompt");
  });

  it("lets an explicit label win over the i18n key", async () => {
    const c = mount(ringNode({
      ...baseProps(),
      segments: [{ key: "prompt", label: "System setup", tokens: 20000 }],
    }));
    await openPopup(c);
    expect(c.querySelector(".hk-ctx-legend-label")?.textContent).toBe("System setup");
  });

  it("shows the estimated footnote only when estimated is set", async () => {
    const withEst = mount(ringNode({ ...baseProps(), estimated: true }));
    await openPopup(withEst);
    expect(withEst.querySelector(".hk-ctx-est")).not.toBeNull();
    const without = mount(ringNode(baseProps()));
    await openPopup(without);
    expect(without.querySelector(".hk-ctx-est")).toBeNull();
  });
});
