// AI-generated: developed with the ZCode agent (model GLM-5.3); human-directed.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick, ref, type Ref } from "vue";

/**
 * HkTimeZoneGlobe × HkBoard3D — the picker's WEBGL branch contract.
 *
 * The real board cannot init in happy-dom (no WebGL), so this suite stubs
 * it and keeps the board's whole props surface addressable. Two product
 * directions from 2026-11-01 are template-level promises and belong here:
 *
 *  - TURNTABLE: the globe passes equal min/max polar bounds (90° - the
 *    eye's 18° ring tilt) so the board can only spin about the vertical
 *    axis — the sphere never tips toward a pole or rolls;
 *  - READOUT: the SELECTED sector's chip is the globe's own always-on
 *    layer pinned to the top-center of the stage — not a pointer-following
 *    tooltip (which sat under the finger on a touch drag), not gated on
 *    hover, and not rewritten by hover either (a drag re-selects without
 *    moving the pointer, so a hover preview would go stale as it is read).
 *
 * The no-WebGL assertions (fallback list, readout stepping aside) live in
 * HkTimeZoneGlobe.test.tsx, which mounts the real board.
 */

interface CapturedBoard {
  minPolarAngle?: number;
  maxPolarAngle?: number;
  interactive?: boolean;
  minimap?: boolean;
  minimapCollapsible?: boolean;
  minimapDefaultCollapsed?: boolean;
  enablePan?: boolean;
  minDistance?: number;
  maxDistance?: number;
  /** The globe's onObjectHover listener (preview a wedge). */
  onObjectHover: ((id: string | null) => void) | null;
  /** The globe's onError listener (no-WebGL report). */
  onError: ((message: string) => void) | null;
}

const captured = vi.hoisted(() => ({ boards: [] as CapturedBoard[] }));

vi.mock("./HkBoard3D", async () => {
  const vue = await import("vue");
  /** Narrow an undeclared-listener attr without a double cast. */
  function listenerOf<T extends (...args: never[]) => void>(value: unknown): T | null {
    return typeof value === "function" ? (value as T) : null;
  }
  const BoardStub = vue.defineComponent({
    name: "HkBoard3D",
    props: {
      interactive: Boolean,
      minimap: Boolean,
      minimapCollapsible: Boolean,
      minimapDefaultCollapsed: Boolean,
      hoverBox: Boolean,
      transparentBackground: Boolean,
      enablePan: Boolean,
      minPolarAngle: Number,
      maxPolarAngle: Number,
      fov: Number,
      minDistance: Number,
      maxDistance: Number,
      initialPosition: Array,
      initialTarget: Array,
    },
    // Deliberately NO `emits` declaration: the globe's listeners then land
    // in `attrs`, which is exactly how this suite reaches onObjectHover /
    // onError without the stub ever calling emit().
    setup(props, { attrs }) {
      captured.boards.push({
        minPolarAngle: props.minPolarAngle,
        maxPolarAngle: props.maxPolarAngle,
        interactive: props.interactive,
        minimap: props.minimap,
        minimapCollapsible: props.minimapCollapsible,
        minimapDefaultCollapsed: props.minimapDefaultCollapsed,
        enablePan: props.enablePan,
        minDistance: props.minDistance,
        maxDistance: props.maxDistance,
        onObjectHover: listenerOf<(id: string | null) => void>(attrs.onObjectHover),
        onError: listenerOf<(message: string) => void>(attrs.onError),
      });
      return () => null;
    },
  });
  return { default: BoardStub };
});

import HkTimeZoneGlobe from "./HkTimeZoneGlobe";
import { setLocale } from "../i18n/context";

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

function mountGlobe(modelValue = "Asia/Shanghai"): {
  container: HTMLElement;
  zone: Ref<string>;
} {
  captured.boards.length = 0;
  const container = document.createElement("div");
  document.body.appendChild(container);
  // A live modelValue ref, so a test can drive a re-selection the way the
  // host does (HkSolarLocationSetting writes draftTimeZone).
  const zone = ref(modelValue);
  const app = createApp({
    render: () =>
      h(HkTimeZoneGlobe, {
        modelValue: zone.value,
        "onUpdate:modelValue": (next: string) => {
          zone.value = next;
        },
      }),
  });
  app.mount(container);
  mounts.push({ app, container });
  return { container, zone };
}

async function settle(): Promise<void> {
  await nextTick();
  await new Promise((resolve) => setTimeout(resolve, 20));
  await nextTick();
}

function board(): CapturedBoard {
  expect(captured.boards, "the globe mounted one board").toHaveLength(1);
  return captured.boards[0]!;
}

function readout(): HTMLElement | null {
  return document.body.querySelector<HTMLElement>('[data-test="hk-timezone-globe-readout"]');
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

describe("HkTimeZoneGlobe turntable contract", () => {
  it("locks the board's orbit elevation to the eye ring (equal polar bounds)", async () => {
    mountGlobe();
    await settle();

    const { minPolarAngle, maxPolarAngle, interactive } = board();
    // 90° - EYE_TILT_DEG (18°) = 72°, as a DEGREE-valued board prop.
    expect(minPolarAngle).toBe(72);
    expect(maxPolarAngle).toBe(72);
    expect(minPolarAngle).toBe(maxPolarAngle);
    // The lock only binds on an INTERACTIVE board: a non-interactive board
    // deliberately relaxes the elevation window for its external driver,
    // so the globe must never mount as one.
    expect(interactive).toBe(true);
  });

  it("keeps the minimap (collapsible, folded by default) and disables panning", async () => {
    mountGlobe();
    await settle();

    const b = board();
    expect(b.minimap).toBe(true);
    expect(b.minimapCollapsible).toBe(true);
    expect(b.minimapDefaultCollapsed).toBe(true);
    expect(b.enablePan).toBe(false);
    // The picker still owns its own distance window and framing.
    expect(b.minDistance).toBe(2.15);
    expect(b.maxDistance).toBe(3.6);
  });
});

describe("HkTimeZoneGlobe pinned readout", () => {
  it("shows the selected sector with no hover needed (always on)", async () => {
    mountGlobe("Asia/Shanghai");
    await settle();

    const el = readout();
    expect(el, "the readout renders without any pointer interaction").toBeTruthy();
    expect(el!.textContent).toContain("UTC+8");
    expect(el!.textContent).toContain("Asia/Shanghai");
    // A city from the SELECTED band's second line — "Singapore" is not a
    // substring of the zone id, so only the cities row can satisfy it
    // ("Shanghai" would have been satisfied by "Asia/Shanghai").
    const cities = el!.querySelector<HTMLElement>(".hk-timezone-globe__readout-cities");
    expect(cities, "the cities line renders").toBeTruthy();
    expect(cities!.textContent).toContain("Singapore");
    // A live region, so a COMMITTED re-pick is spoken; hover never
    // rewrites the chip, so hovering cannot flood the announce queue.
    expect(el!.getAttribute("role")).toBe("status");
    expect(el!.getAttribute("aria-live")).toBe("polite");
    expect(el!.getAttribute("aria-atomic")).toBe("true");
    // The old pointer-following tooltip is gone for good.
    expect(document.body.querySelector('[data-test="hk-timezone-globe-tooltip"]')).toBeNull();
  });

  it("follows a committed re-selection when the host writes a new zone", async () => {
    const { zone } = mountGlobe("Asia/Shanghai");
    await settle();
    expect(readout()!.textContent).toContain("Asia/Shanghai");

    // The host's write path (draftTimeZone → modelValue), not a click: the
    // chip must re-render on the new band, not stay frozen at mount.
    zone.value = "Africa/Cairo";
    await settle();
    expect(readout()!.textContent).toContain("Africa/Cairo");
    expect(readout()!.textContent).toContain("UTC+2");
    expect(readout()!.textContent).not.toContain("Asia/Shanghai");
  });

  it("keeps showing the committed selection while a wedge is hovered", async () => {
    mountGlobe("Asia/Shanghai");
    await settle();

    const onObjectHover = board().onObjectHover;
    expect(onObjectHover, "the globe wired the board's hover event").toBeTruthy();
    onObjectHover!("sector-20"); // offset +9 → Asia/Tokyo
    await settle();
    // The chip is a selection statement: hover only tints the wedge.
    expect(readout()!.textContent).toContain("Asia/Shanghai");
    expect(readout()!.textContent).not.toContain("Asia/Tokyo");

    onObjectHover!(null);
    await settle();
    expect(readout()!.textContent).toContain("Asia/Shanghai");
  });

  it("does not repeat an English band name that IS its offset label", async () => {
    await setLocale("en"); // explicit: this contract is locale-dependent
    mountGlobe("Asia/Shanghai");
    await settle();

    const text = readout()!.textContent ?? "";
    expect(text.match(/UTC\+8/g)).toHaveLength(1);
    expect(text).toContain("Asia/Shanghai");
  });

  it("keeps the translated band name where the locale names the band (zh-Hans)", async () => {
    await setLocale("zh-Hans");
    mountGlobe("Asia/Shanghai");
    await settle();

    const text = readout()!.textContent ?? "";
    expect(text).toContain("UTC+8");
    expect(text).toContain("东八区");
  });

  it("steps aside when the board reports no WebGL (the fallback list is the interface)", async () => {
    mountGlobe("Asia/Shanghai");
    await settle();
    expect(readout()).toBeTruthy();

    const onError = board().onError;
    expect(onError, "the globe wired the board's error event").toBeTruthy();
    onError!("no webgl (test)");
    await settle();
    expect(readout()).toBeNull();
  });
});
