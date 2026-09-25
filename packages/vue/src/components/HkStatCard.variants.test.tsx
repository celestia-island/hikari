import { afterEach, describe, expect, it } from "vitest";
import { createApp, h, defineComponent, nextTick } from "vue";

import { HkStatCard, statToneColor } from "./HkStatCard";

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

/** A stand-in lucide-style icon component (functional, size prop). */
const FakeIcon = defineComponent({
  name: "FakeIcon",
  props: { size: { type: [Number, String], default: 24 } },
  setup: (props) => () => h("svg", { "data-fake-icon": "", width: props.size, height: props.size }),
});

describe("HkStatCard plain (default) — the original anatomy is preserved", () => {
  it("renders the label/dot/value/hint anatomy without a variant class", () => {
    const c = mount(h(HkStatCard, { label: "Hub health", value: "2/2", tone: "success", hint: "hubs" }));
    const card = c.querySelector(".hk-stat-card") as HTMLElement;
    expect(card.className).toContain("hk-stat-card-plain");
    expect(c.querySelector(".hk-stat-card-head")).toBeTruthy();
    expect(c.querySelector(".hk-stat-card-dot-success")).toBeTruthy();
    expect(c.querySelector(".hk-stat-card-value")?.textContent).toBe("2/2");
    expect(c.querySelector(".hk-stat-card-hint")?.textContent).toBe("hubs");
    // plain renders no chip/ring/bar anatomy
    expect(c.querySelector(".hk-stat-card-chip-body")).toBeNull();
    expect(c.querySelector(".hk-gauge-ring")).toBeNull();
    expect(c.querySelector(".hk-progress-bar")).toBeNull();
  });
});

describe("HkStatCard chip", () => {
  it("renders the tinted icon chip beside value-over-label", () => {
    const c = mount(
      h(HkStatCard, { variant: "chip", icon: FakeIcon, tone: "info", label: "Running", value: 3 }),
    );
    const card = c.querySelector(".hk-stat-card") as HTMLElement;
    expect(card.className).toContain("hk-stat-card-chip");
    const chip = c.querySelector(".hk-stat-card-chip-icon") as HTMLElement;
    expect(chip).toBeTruthy();
    expect(chip.className).toContain("hk-stat-card-chip-icon-info");
    expect(chip.querySelector("svg[data-fake-icon]")).toBeTruthy();
    expect(c.querySelector(".hk-stat-card-chip-value")?.textContent).toBe("3");
    expect(c.querySelector(".hk-stat-card-chip-label")?.textContent).toBe("Running");
    // no tone dot on the chip variant — the chip itself carries the tone
    expect(c.querySelector(".hk-stat-card-dot")).toBeNull();
  });

  it("omits the icon chip node when no icon is given", () => {
    const c = mount(h(HkStatCard, { variant: "chip", label: "L", value: 1 }));
    expect(c.querySelector(".hk-stat-card-chip-icon")).toBeNull();
  });

  it("renders the aside slot at the trailing edge", () => {
    const c = mount(
      h(HkStatCard, { variant: "chip", label: "Balance", value: 20 }, { aside: () => h("span", { class: "aside-probe" }, "basic") }),
    );
    expect(c.querySelector(".hk-stat-card-aside .aside-probe")?.textContent).toBe("basic");
  });

  it("keeps the whole-card click affordance", () => {
    const c = mount(h(HkStatCard, { variant: "chip", label: "L", value: 1, clickable: true }));
    const el = c.querySelector(".hk-stat-card") as HTMLElement;
    expect(el.getAttribute("role")).toBe("button");
    expect(el.className).toContain("hk-stat-card-clickable");
  });
});

describe("HkStatCard ring", () => {
  it("renders one tone-colored ring with the value and unit inside", () => {
    const c = mount(
      h(HkStatCard, {
        variant: "ring", tone: "success", pct: 37.5, value: "38%", unit: "cores",
        icon: FakeIcon, label: "Cores", hint: "12 / 32 · monthly",
      }),
    );
    const card = c.querySelector(".hk-stat-card") as HTMLElement;
    expect(card.className).toContain("hk-stat-card-ring");
    // exactly one ring block, painted with the tone palette
    expect(c.querySelectorAll(".hk-gauge-ring").length).toBe(1);
    expect(c.querySelector(".hk-gauge-ring-value")?.textContent).toBe("38%");
    expect(c.querySelector(".hk-gauge-ring-label")?.textContent).toBe("cores");
    expect(c.querySelector(".hk-stat-card-ring-label-text")?.textContent).toBe("Cores");
    expect(c.querySelector(".hk-stat-card-ring-label svg[data-fake-icon]")).toBeTruthy();
    expect(c.querySelector(".hk-stat-card-ring-detail")?.textContent).toBe("12 / 32 · monthly");
  });

  it("clamps an over-range pct to a full gauge", () => {
    const c = mount(h(HkStatCard, { variant: "ring", pct: 140, value: "140%", label: "L" }));
    // The dash offset must reflect a clamped 100% fill, not an overshoot:
    // a clamped ring draws dashoffset 0.
    const arc = c.querySelector(".hk-gauge-ring circle[stroke-dasharray]") as SVGElement;
    expect(arc).toBeTruthy();
    expect(arc.getAttribute("stroke-dashoffset")).toBe("0");
  });

  it("clamps a negative pct to an empty gauge (the guard HkGaugeRing does not provide)", () => {
    // HkGaugeRing only clamps the UPPER bound internally (Math.min(pct, 100)),
    // so a negative pct surviving this component would draw dashoffset
    // > circumference — an arc longer than the whole ring. This assertion is
    // what kills a mutation that drops clampPct's lower clamp.
    const c = mount(h(HkStatCard, { variant: "ring", pct: -20, value: "-20%", label: "L" }));
    const arc = c.querySelector(".hk-gauge-ring circle[stroke-dasharray]") as SVGElement;
    expect(arc).toBeTruthy();
    const circumference = 2 * Math.PI * ((104 - 7) / 2);
    const offset = Number(arc.getAttribute("stroke-dashoffset"));
    expect(Math.abs(offset - circumference)).toBeLessThan(0.01);
  });

  it("treats a missing pct as an empty gauge, not NaN", () => {
    const c = mount(h(HkStatCard, { variant: "ring", value: "—", label: "L" }));
    const arc = c.querySelector(".hk-gauge-ring circle[stroke-dasharray]") as SVGElement;
    expect(arc.getAttribute("stroke-dashoffset")).not.toContain("NaN");
  });

  it("paints the ring through inline stroke styles, not only the presentation attribute", () => {
    // var() in an SVG presentation attribute is not substituted on every
    // engine (Firefox drops the declaration → stroke:none → an invisible
    // gauge), so the tone color must ALSO ride the inline style — the same
    // contract HkProgressRing documents for its segment color.
    const c = mount(
      h(HkStatCard, { variant: "ring", tone: "info", pct: 40, value: "40%", label: "L" }),
    );
    const [track, arc] = c.querySelectorAll(".hk-gauge-ring circle") as NodeListOf<SVGCircleElement>;
    expect(track.getAttribute("stroke")).toBe("rgb(var(--color-text) / 8%)");
    expect(track.style.stroke).toBe("rgb(var(--color-text) / 8%)");
    expect(arc.getAttribute("stroke")).toBe(statToneColor("info"));
    expect(arc.style.stroke).toBe(statToneColor("info"));
  });
});

describe("HkStatCard clickable — role=button keyboard contract", () => {
  it("activates on Enter and Space like a native button", async () => {
    const clicks: string[] = [];
    const c = mount(
      h(HkStatCard, {
        variant: "chip", value: 1, label: "L", clickable: true,
        onClick: (e: MouseEvent | KeyboardEvent) => clicks.push("key" in e ? e.key : "mouse"),
      }),
    );
    const card = c.querySelector(".hk-stat-card") as HTMLElement;
    for (const key of ["Enter", " "]) {
      card.dispatchEvent(
        new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }),
      );
      await nextTick();
    }
    expect(clicks).toEqual(["Enter", " "]);
  });

  it("ignores keys bubbling from a focusable inside the card", async () => {
    const clicks: unknown[] = [];
    const c = mount(
      h(HkStatCard, { variant: "chip", value: 1, label: "L", clickable: true, onClick: () => clicks.push(1) }, {
        aside: () => h("button", { class: "aside-btn-probe" }, "x"),
      }),
    );
    const inner = c.querySelector(".aside-btn-probe") as HTMLElement;
    inner.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }),
    );
    await nextTick();
    expect(clicks.length).toBe(0);
  });
});

describe("HkStatCard bar", () => {
  it("renders label+value over a tone-colored segmented fill", () => {
    const c = mount(
      h(HkStatCard, { variant: "bar", tone: "warning", pct: 72, label: "Storage", value: "72%", hint: "47 / 65 GB" }),
    );
    const card = c.querySelector(".hk-stat-card") as HTMLElement;
    expect(card.className).toContain("hk-stat-card-bar");
    expect(c.querySelector(".hk-stat-card-bar-head .hk-stat-card-label")?.textContent).toBe("Storage");
    expect(c.querySelector(".hk-stat-card-bar-value")?.textContent).toBe("72%");
    const seg = c.querySelector(".hk-progress-bar-seg") as HTMLElement;
    expect(seg).toBeTruthy();
    expect(seg.style.width).toBe("72%");
    expect(seg.style.background).toBe("rgb(var(--color-warning))");
    expect(c.querySelector(".hk-stat-card-bar-detail")?.textContent).toBe("47 / 65 GB");
  });
});

describe("statToneColor", () => {
  it("maps every tone to the theme-variable palette the card paints with", () => {
    expect(statToneColor("success")).toBe("rgb(var(--color-success))");
    expect(statToneColor("warning")).toBe("rgb(var(--color-warning))");
    expect(statToneColor("error")).toBe("rgb(var(--color-error))");
    expect(statToneColor("primary")).toBe("rgb(var(--color-primary))");
    expect(statToneColor("muted")).toBe("rgb(var(--color-muted))");
    // info falls back to primary when the host palette omits it — the
    // same fallback the SCSS dot uses.
    expect(statToneColor("info")).toBe("rgb(var(--color-info, rgb(var(--color-primary))))");
  });
});
