import { afterEach, describe, expect, it } from "vitest";
import { createApp, defineComponent, h } from "vue";

import HkGaugeRing from "./HkGaugeRing";

const mounts: ReturnType<typeof createApp>[] = [];
const containers: HTMLElement[] = [];

function mountRing(props: Record<string, unknown> = {}): HTMLElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  containers.push(container);

  const Wrapper = defineComponent({
    setup() {
      return () => h(HkGaugeRing, { animate: false, ...props });
    },
  });

  const app = createApp(Wrapper);
  mounts.push(app);
  app.mount(container);
  return container;
}

/** The rendered arc circle (value arc, not the track). */
function arc(container: HTMLElement): SVGCircleElement | null {
  return container.querySelector(".hk-gauge-ring__arc");
}

afterEach(() => {
  mounts.splice(0).forEach((app) => app.unmount());
  containers.splice(0).forEach((c) => c.remove());
});

describe("HkGaugeRing", () => {
  it("colors a single-value ring from the component variant", () => {
    const c = mountRing({ value: 42, variant: "info" });
    expect(arc(c)?.getAttribute("data-variant")).toBe("info");
    // Single-arc rings expose progressbar semantics.
    expect(c.firstElementChild?.getAttribute("role")).toBe("progressbar");
    expect(c.firstElementChild?.getAttribute("aria-valuenow")).toBe("42");
  });

  it("resolves the auto variant by utilisation thresholds", () => {
    const ok = mountRing({ value: 50, variant: "auto" });
    expect(arc(ok)?.getAttribute("data-variant")).toBe("success");

    const warn = mountRing({ value: 80, variant: "auto" });
    expect(arc(warn)?.getAttribute("data-variant")).toBe("warning");

    const hot = mountRing({ value: 93, variant: "auto" });
    expect(arc(hot)?.getAttribute("data-variant")).toBe("danger");
  });

  it("keeps an explicit color as an inline stroke override", () => {
    const c = mountRing({ value: 10, color: undefined, rings: [{ pct: 10, color: "#123456" }] });
    const el = arc(c) as unknown as HTMLElement;
    expect(el.style.stroke).toBe("#123456");
  });

  it("clamps values above 100 in aria and geometry", () => {
    const c = mountRing({ value: 250 });
    const root = c.firstElementChild as HTMLElement;
    expect(root.getAttribute("aria-valuenow")).toBe("100");
    // dashoffset for 100% with animate=false is exactly 0 (full circle).
    const el = arc(c) as unknown as HTMLElement;
    expect(el.getAttribute("stroke-dashoffset")).toBe("0");
  });

  it("renders the center value/label with its own classes, not utilities", () => {
    const c = mountRing({ value: 33, centerValue: "33%", centerLabel: "CPU", size: 72 });
    const center = c.querySelector(".hk-gauge-ring__center") as HTMLElement;
    expect(center).not.toBeNull();
    // Self-contained classes only — no host-app utility classes on the
    // overlay (the old markup leaned on `absolute inset-0 flex ...`).
    expect(center.className).toBe("hk-gauge-ring__center");
    const value = c.querySelector(".hk-gauge-ring__value") as HTMLElement;
    const label = c.querySelector(".hk-gauge-ring__label") as HTMLElement;
    expect(value.textContent).toBe("33%");
    expect(label.textContent).toBe("CPU");
    // Typography scales with size (72px ring → 12px value font).
    expect(value.style.fontSize).toBe("12px");
    expect(label.style.fontSize).toBe("9px");
  });

  it("marks multi-ring gauges as img (progressbar only for single value)", () => {
    const c = mountRing({ rings: [{ pct: 30 }, { pct: 70 }] });
    const root = c.firstElementChild as HTMLElement;
    expect(root.getAttribute("role")).toBe("img");
    expect(root.getAttribute("aria-valuenow")).toBeNull();
  });
});
