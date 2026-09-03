import { afterEach, describe, expect, it } from "vitest";
import { createApp, h } from "vue";

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
