// AI-generated: developed with the ZCode agent (model GLM-5.3); human-directed.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp, h, nextTick } from "vue";

import HkTimeZoneGlobe from "./HkTimeZoneGlobe";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { setLocale } from "../i18n/context";

/**
 * HkTimeZoneGlobe — happy-dom has no WebGL, so every mount here lands
 * on the board's fallback path and exercises the component's NO-WEBGL
 * contract: the same 24 sectors as a translated, selectable list. The
 * WebGL branch is geometry + material wiring covered by the pure-math
 * suites (solarTimeZones / solarGlobeMap) and the board's own tests.
 */

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

function mountGlobe(modelValue: string): HTMLElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({
    render: () =>
      h(HkTimeZoneGlobe, {
        modelValue,
        "onUpdate:modelValue": (zone: string) => {
          (container as HTMLElement & { __lastZone?: string }).__lastZone = zone;
        },
      }),
  });
  app.mount(container);
  mounts.push({ app, container });
  return container;
}

async function settle(): Promise<void> {
  await nextTick();
  await new Promise((resolve) => setTimeout(resolve, 20));
  await nextTick();
}

function listEl(): HTMLElement {
  const el = document.body.querySelector<HTMLElement>('[data-test="hk-timezone-globe-list"]');
  expect(el, "fallback sector list renders (no WebGL in happy-dom)").toBeTruthy();
  return el!;
}

function options(): HTMLButtonElement[] {
  return [...document.body.querySelectorAll<HTMLButtonElement>('[data-test="hk-timezone-globe-option"]')];
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(async () => {
  for (const { app, container } of mounts.splice(0)) {
    app.unmount();
    container.remove();
  }
  await setLocale("en");
});

describe("HkTimeZoneGlobe fallback list", () => {
  it("renders the 24 sector wheel as a listbox, translated per locale", async () => {
    mountGlobe("Asia/Shanghai");
    await settle();

    const list = listEl();
    expect(list.getAttribute("role")).toBe("listbox");
    expect(options()).toHaveLength(24);

    const p8 = options().find((o) => o.dataset.zone === "Asia/Shanghai")!;
    expect(p8, "+8 sector renders").toBeTruthy();
    expect(p8.getAttribute("aria-selected")).toBe("true");
    expect(p8.textContent).toContain("UTC+8");
    expect(p8.textContent).toContain("Asia/Shanghai");
    // Representative cities — the user-facing examples, translated.
    expect(p8.textContent).toContain("Shanghai");
    expect(p8.textContent).toContain("Taipei");
    expect(p8.textContent).toContain("Hong Kong");
    expect(p8.textContent).toContain("Singapore");
  });

  it("emits the representative zone of the picked sector", async () => {
    const container = mountGlobe("Asia/Shanghai");
    await settle();

    const tokyo = options().find((o) => o.dataset.zone === "Asia/Tokyo")!;
    tokyo.click();
    await settle();
    expect((container as HTMLElement & { __lastZone?: string }).__lastZone).toBe("Asia/Tokyo");

    // Re-picking the current value emits nothing (idempotent writes).
    const shanghai = options().find((o) => o.dataset.zone === "Asia/Shanghai")!;
    shanghai.click();
    await settle();
    expect((container as HTMLElement & { __lastZone?: string }).__lastZone).toBe("Asia/Tokyo");
  });

  it("marks exactly one sector selected for a stored half-hour zone", async () => {
    // +5.5 rounds onto the +6 band; the stored zone keeps its own id.
    mountGlobe("Asia/Kolkata");
    await settle();

    const selected = options().filter((o) => o.getAttribute("aria-selected") === "true");
    expect(selected).toHaveLength(1);
    expect(selected[0]!.dataset.zone).toBe("Asia/Dhaka");
  });

  it("shows the rotation hint and the group label (a11y)", async () => {
    mountGlobe("Asia/Shanghai");
    await settle();

    const root = document.body.querySelector<HTMLElement>('[data-test="hk-timezone-globe"]')!;
    expect(root.getAttribute("aria-label")).toBe("Time zone globe");
    expect(root.textContent).toContain("Drag to spin the globe");
    // The pinned HUD is a canvas affordance: without WebGL the list IS the
    // interface, so the chip must not cover its rows.
    expect(document.body.querySelector('[data-test="hk-timezone-globe-readout"]')).toBeNull();
  });

  it("flows zh-Hans through the sector names and city lists", async () => {
    await setLocale("zh-Hans");
    mountGlobe("Asia/Shanghai");
    await settle();

    const p8 = options().find((o) => o.dataset.zone === "Asia/Shanghai")!;
    expect(p8.textContent).toContain("东八区");
    expect(p8.textContent).toContain("上海、台北、香港、新加坡");
  });
});

describe("HkTimeZoneGlobe look contract (source-level)", () => {
  it("renders the base sphere TRANSPARENT (the white-alpha map must read as holo, not a solid ball)", () => {
    const src = readFileSync(join(import.meta.dirname, "HkTimeZoneGlobe.tsx"), "utf8");
    expect(src).toMatch(/MeshBasicMaterial\(\{ color: 0x8899aa, transparent: true \}\)/);
  });

  it("mounts its minimap collapsible AND folded by default (user direction 2026-10-31)", () => {
    const src = readFileSync(join(import.meta.dirname, "HkTimeZoneGlobe.tsx"), "utf8");
    expect(src).toContain("minimapCollapsible");
    expect(src).toContain("minimapDefaultCollapsed");
  });

  it("pins the readout to the stage's TOP-CENTER, pointer-transparent (user direction 2026-11-01)", () => {
    const scss = readFileSync(join(import.meta.dirname, "HkTimeZoneGlobe.scss"), "utf8");
    const block = (selector: string): string => {
      const start = scss.indexOf(selector + " {");
      expect(start, selector + " exists").toBeGreaterThanOrEqual(0);
      const end = scss.indexOf("\n}", start);
      expect(end, selector + " closes").toBeGreaterThan(start);
      return scss.slice(start, end);
    };

    // The readout is absolutely positioned, so its containing block must
    // stay the stage.
    expect(block(".hk-timezone-globe__stage")).toContain("position: relative");

    const readout = block(".hk-timezone-globe__readout");
    expect(readout, "a HUD layer over the canvas").toContain("position: absolute");
    expect(readout, "top-anchored").toMatch(/top:\s*var\(--space-6/);
    expect(readout, "horizontally centered").toContain("left: 50%");
    expect(readout, "horizontally centered").toContain("transform: translateX(-50%)");
    // The board paints an opaque surface later in the DOM, so the chip is
    // only visible while it stacks above it.
    expect(readout, "above the board surface").toMatch(/z-index:\s*[1-9]/);
    // The chip sits over the very surface the user drags; a drag that
    // begins on it must still reach the canvas.
    expect(readout, "a passive layer").toContain("pointer-events: none");

    // A long city row must ellipsize inside the chip, not escape it.
    expect(block(".hk-timezone-globe__readout-cities")).toContain("text-overflow: ellipsis");
  });
});
describe("minimap reset icon contract (user direction 2026-10-31)", () => {
  it("reset buttons use RotateCcw, never the expand-looking Maximize2", () => {
    for (const name of ["HkMinimap.tsx", "HkMinimap3D.tsx", "HkZoomToolbar.tsx"]) {
      const src = readFileSync(join(import.meta.dirname, name), "utf8");
      expect(src, name + " imports RotateCcw").toContain("RotateCcw");
      expect(src, name + " dropped Maximize2").not.toContain("Maximize2");
    }
  });
});