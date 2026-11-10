import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { compile } from "sass";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, ref, type Ref } from "vue";

import HkRangeRibbon, {
  normalizeHkRangeWindow,
  type RibbonLane,
  type RibbonSegment,
} from "./HkRangeRibbon";
import { setLocale } from "../i18n/context";
import jaBundle from "../i18n/locales/ja/components.json";

/**
 * HkRangeRibbon anatomy + behaviour.
 *
 * The component's whole reason to exist is the window contract, so the
 * cases below pin it from both sides:
 *   · clipping has exactly TWO sites: the window (windowed lanes: outside →
 *     absent, straddling → re-normalized) and the DOMAIN (`clipToDomain`:
 *     content outside the caller's axis paints nowhere on either layer),
 *     while the overview keeps painting the whole domain;
 *   · the emitted window is ALWAYS in absolute domain coordinates — never
 *     relative to the currently zoomed sub-domain (the chest row filter
 *     depends on exactly that);
 *   · every reset path (button / dblclick / Escape / Home) lands null and
 *     restores the full view;
 *   · sub-minimum brushes, edge drags and keyboard nudges clamp instead of
 *     crossing;
 *   · the two layers stay explicit (minimap / detail) over ONE caller
 *     `domain` axis (default [0, 1]): the minimap draws the domain, the
 *     detail draws the selected window, labels read domain percentages, and
 *     the deprecated `headroom` prop is the `[0, 1 + headroom]` alias.
 * A stylesheet contract at the bottom compiles the sheet and pins the
 * classes, geometry and the one animation (repo convention: vitest stubs
 * CSS, so the runtime cases can never catch a dead rule).
 */

const LANES: RibbonLane[] = [
  { key: "cpu", label: "CPU" },
  { key: "io", label: "IO" },
];

const SEGMENTS: RibbonSegment[] = [
  { id: "boot", lane: "cpu", start: 0.05, end: 0.2, label: "boot", tone: "success" },
  { id: "parse", lane: "cpu", start: 0.3, end: 0.45, label: "parse", tone: "secondary" },
  { id: "write", lane: "io", start: 0.5, end: 0.9, label: "write", tone: "warning" },
  {
    id: "flush",
    lane: "io",
    start: 0.95,
    end: 1,
    label: "flush",
    status: "error",
    tip: { title: "Flush stall", lines: ["waited 12ms", "retried once"] },
  },
];

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

afterEach(async () => {
  for (const { app, container } of mounts.splice(0)) {
    app.unmount();
    container.remove();
  }
  // setLocale mutates module-global i18n state — restore the default after
  // every case (HkDateTag / HkSolarLocationSetting idiom).
  await setLocale("en");
});

// ── Mount helpers ───────────────────────────────────────────────────────
function mountRibbon(props: Record<string, unknown> = {}): HTMLElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const Wrapper = defineComponent({
    setup() {
      return () => h(HkRangeRibbon, { lanes: LANES, segments: SEGMENTS, ...props });
    },
  });
  const app = createApp(Wrapper);
  app.mount(container);
  mounts.push({ app, container });
  const root = container.querySelector<HTMLElement>(".hk-range-ribbon");
  expect(root, ".hk-range-ribbon renders").toBeTruthy();
  return root!;
}

interface Host {
  root: HTMLElement;
  window: Ref<[number, number] | null>;
  windowChange: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
  setWindow: (next: [number, number] | null) => Promise<void>;
}

/**
 * The controlled-consumer harness: the host owns `window`, applies every
 * emitted value back into its own ref and records it. That is the contract
 * chest uses (fractions in, window out, host filters its rows).
 */
function mountHost(
  initial: [number, number] | null = null,
  extra: Record<string, unknown> = {},
): Host {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const win = ref<[number, number] | null>(initial);
  const windowChange = vi.fn();
  const select = vi.fn();
  const base = { lanes: LANES, segments: SEGMENTS, ...extra };
  const Wrapper = defineComponent({
    setup() {
      return () =>
        h(HkRangeRibbon, {
          ...base,
          window: win.value,
          onWindowChange: (next: [number, number] | null) => {
            windowChange(next);
            win.value = next;
          },
          onSelect: (id: string) => select(id),
        });
    },
  });
  const app = createApp(Wrapper);
  app.mount(container);
  mounts.push({ app, container });
  const root = container.querySelector<HTMLElement>(".hk-range-ribbon");
  expect(root, ".hk-range-ribbon renders").toBeTruthy();
  return {
    root: root!,
    window: win,
    windowChange,
    select,
    setWindow: async (next) => {
      win.value = next;
      await nextTick();
    },
  };
}

// ── DOM queries / geometry ──────────────────────────────────────────────
function laneSegments(root: HTMLElement, lane?: string): HTMLElement[] {
  const scope = lane
    ? root.querySelector<HTMLElement>(`.hk-range-ribbon-lane[data-lane="${lane}"]`)
    : root;
  if (!scope) return [];
  return Array.from(
    scope.querySelectorAll<HTMLElement>(".hk-range-ribbon-lane-track .hk-range-ribbon-segment"),
  );
}

function segmentById(root: HTMLElement, id: string): HTMLElement | null {
  return root.querySelector<HTMLElement>(
    `.hk-range-ribbon-lane-track .hk-range-ribbon-segment[data-segment-id="${id}"]`,
  );
}

function boxOf(element: HTMLElement): { left: number; width: number } {
  return { left: parseFloat(element.style.left), width: parseFloat(element.style.width) };
}

function lastWindow(mock: ReturnType<typeof vi.fn>): [number, number] | null {
  const calls = mock.mock.calls;
  expect(calls.length, "windowChange was emitted").toBeGreaterThan(0);
  return calls[calls.length - 1]?.[0] as [number, number] | null;
}

function expectWindow(
  actual: [number, number] | null,
  lo: number,
  hi: number,
): void {
  expect(actual, "windowChange payload").not.toBeNull();
  const [start, end] = actual!;
  expect(start, "window start").toBeCloseTo(lo, 10);
  expect(end, "window end").toBeCloseTo(hi, 10);
  expect(start, "start < end").toBeLessThan(end);
}

const STRIP_LEFT = 100;
const STRIP_WIDTH = 200;

/** happy-dom has no layout: pin the strip's rect and derive clientX from a
 *  full-domain fraction. */
function stubStrip(
  root: HTMLElement,
): { strip: HTMLElement; x: (fraction: number) => number } {
  const strip = root.querySelector<HTMLElement>(".hk-range-ribbon-strip");
  expect(strip, "the overview strip renders").toBeTruthy();
  const rect = {
    x: STRIP_LEFT,
    y: 0,
    left: STRIP_LEFT,
    top: 0,
    width: STRIP_WIDTH,
    height: 32,
    right: STRIP_LEFT + STRIP_WIDTH,
    bottom: 32,
    toJSON: () => ({}),
  } as DOMRect;
  strip!.getBoundingClientRect = () => rect;
  return {
    strip: strip!,
    x: (fraction: number) => STRIP_LEFT + fraction * STRIP_WIDTH,
  };
}

interface PointerOptions {
  pointerId?: number;
  pointerType?: string;
  button?: number;
}

function pointer(
  type: string,
  clientX: number,
  target: EventTarget,
  options: PointerOptions = {},
): void {
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId: options.pointerId ?? 1,
      pointerType: options.pointerType ?? "mouse",
      clientX,
      clientY: 10,
      button: options.button ?? 0,
    }),
  );
}

function keydown(
  target: EventTarget,
  key: string,
  init: KeyboardEventInit = {},
): KeyboardEvent {
  const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}

async function drag(
  target: EventTarget,
  from: number,
  to: number,
  x: (fraction: number) => number,
): Promise<void> {
  pointer("pointerdown", x(from), target);
  pointer("pointermove", x(to), target);
  pointer("pointerup", x(to), target);
  await nextTick();
}

// ── Full domain ─────────────────────────────────────────────────────────
describe("HkRangeRibbon full domain", () => {
  it("renders every segment at its full-domain fraction and no window chrome", () => {
    const root = mountRibbon({ window: null });
    const expected: Record<string, { left: number; width: number; lane: string }> = {
      boot: { left: 5, width: 15, lane: "cpu" },
      parse: { left: 30, width: 15, lane: "cpu" },
      write: { left: 50, width: 40, lane: "io" },
      flush: { left: 95, width: 5, lane: "io" },
    };
    expect(laneSegments(root), "all four segments render").toHaveLength(4);
    for (const [id, box] of Object.entries(expected)) {
      const element = segmentById(root, id);
      expect(element, `${id} renders`).toBeTruthy();
      expect(element!.closest(".hk-range-ribbon-lane")?.getAttribute("data-lane")).toBe(box.lane);
      expect(boxOf(element!).left, `${id} left`).toBeCloseTo(box.left, 4);
      expect(boxOf(element!).width, `${id} width`).toBeCloseTo(box.width, 4);
    }
    // No window ⇒ no highlight, no scrims, no handles, no reset button.
    expect(root.querySelector(".hk-range-ribbon-window")).toBeNull();
    expect(root.querySelector(".hk-range-ribbon-scrim")).toBeNull();
    expect(root.querySelector(".hk-range-ribbon-handle")).toBeNull();
    expect(root.querySelector(".hk-range-ribbon-reset")).toBeNull();
    expect(root.hasAttribute("data-windowed")).toBe(false);
  });

  it("clamps inverted and out-of-domain segments and drops NaN ones", () => {
    const segments: RibbonSegment[] = [
      { id: "inverted", lane: "cpu", start: 0.7, end: 0.3, label: "inverted" },
      { id: "point", lane: "cpu", start: 0.5, end: 0.5, label: "point" },
      { id: "far", lane: "cpu", start: -0.5, end: 0.25, label: "far" },
      { id: "nan", lane: "cpu", start: Number.NaN, end: 0.4, label: "nan" },
      { id: "orphan", lane: "gpu", start: 0.1, end: 0.2, label: "orphan" },
      { id: "outside", lane: "cpu", start: 1.2, end: 1.4, label: "outside" },
    ];
    const root = mountRibbon({ window: null, segments });
    // Inverted → swapped, out-of-domain → clamped, zero-length kept as a tick.
    expect(boxOf(segmentById(root, "inverted")!).left).toBeCloseTo(30, 4);
    expect(boxOf(segmentById(root, "inverted")!).width).toBeCloseTo(40, 4);
    expect(boxOf(segmentById(root, "point")!).left).toBeCloseTo(50, 4);
    expect(boxOf(segmentById(root, "point")!).width).toBeCloseTo(0, 4);
    expect(boxOf(segmentById(root, "far")!).left).toBeCloseTo(0, 4);
    expect(boxOf(segmentById(root, "far")!).width).toBeCloseTo(25, 4);
    // NaN is ignored…
    expect(segmentById(root, "nan")).toBeNull();
    // …and a segment can never invent an undeclared lane.
    expect(segmentById(root, "orphan")).toBeNull();
    expect(root.querySelector('[data-segment-id="orphan"]')).toBeNull();
    // Content wholly outside the axis paints NOTHING: the domain is a
    // clipping rule, not a clamp to an edge tick (pre-domain content would
    // have collapsed [1.2, 1.4] onto 100% and drawn a tick there).
    expect(segmentById(root, "outside")).toBeNull();
    expect(root.querySelector('[data-segment-id="outside"]')).toBeNull();
  });

  it("shares the label column with the lanes so both axes agree", () => {
    const root = mountRibbon({ window: [0.2, 0.6] });
    const overview = root.querySelector<HTMLElement>(".hk-range-ribbon-overview")!;
    const gutter = overview.querySelector<HTMLElement>(".hk-range-ribbon-overview-gutter");
    const field = overview.querySelector<HTMLElement>(".hk-range-ribbon-overview-field");
    expect(gutter, "the overview keeps an empty label gutter").toBeTruthy();
    expect(field, "the strip lives in the lane-matching column").toBeTruthy();
    expect(field!.firstElementChild?.classList.contains("hk-range-ribbon-strip")).toBe(true);
    // Handle percentages resolve against the strip's own box (the field),
    // never against the gutter — a window edge lines up with the bar it clips.
    expect(root.querySelector<HTMLElement>('[data-edge="start"]')!.parentElement).toBe(field);
  });
});

// ── Exported normalizer / component parity ──────────────────────────────
describe("HkRangeRibbon window normalizer parity", () => {
  it("keeps the component on the exported helper (source contract)", () => {
    // The rendered-parity cases below are DIVERGENCE detectors: a
    // byte-identical inlined copy of the algorithm renders the same window
    // and passes them. This source pin is the CALL-SITE guard — the
    // component must keep CALLING the exported normalizer rather than
    // growing a private copy again.
    const tsx = readFileSync(resolve(componentDir, "HkRangeRibbon.tsx"), "utf8");
    expect(tsx).toMatch(/return normalizeHkRangeWindow\(source, minWidth\.value, domain\.value\)/);
  });

  it("renders exactly the window the exported helper returns", () => {
    const rawWindows: Array<[number, number]> = [
      [0.7, 0.3],
      [0.5, 0.5],
      [1.2, 1.5],
      [-0.5, -0.2],
      [1, 1],
      [0.49, 0.51],
    ];
    for (const raw of rawWindows) {
      const normalized = normalizeHkRangeWindow(raw);
      expect(normalized, `${raw} normalizes`).not.toBeNull();

      const root = mountRibbon({ window: raw });
      expect(root.hasAttribute("data-windowed"), `${raw} is windowed`).toBe(true);
      const highlight = root.querySelector<HTMLElement>(".hk-range-ribbon-window")!;
      expect(boxOf(highlight).left, `${raw} left`).toBeCloseTo(normalized![0] * 100, 4);
      expect(boxOf(highlight).width, `${raw} width`).toBeCloseTo(
        (normalized![1] - normalized![0]) * 100,
        4,
      );

      // Feeding the helper's output back in is idempotent — the rendered
      // box is byte-identical, which is what lets a host pass either the raw
      // or the normalized value into the same prop.
      const again = mountRibbon({ window: [...normalized!] as [number, number] });
      const againHighlight = again.querySelector<HTMLElement>(".hk-range-ribbon-window")!;
      expect(boxOf(againHighlight), `${raw} idempotent`).toEqual(boxOf(highlight));
    }
  });
});

// ── Windowed view: clipping ─────────────────────────────────────────────
describe("HkRangeRibbon windowed view", () => {
  it("clips and re-normalizes only intersecting segments — the only clipping site", () => {
    const root = mountRibbon({ window: [0.4, 0.6] });

    // boot (0.05–0.2) and flush (0.95–1) are wholly outside: absent.
    expect(segmentById(root, "boot")).toBeNull();
    expect(segmentById(root, "flush")).toBeNull();
    expect(laneSegments(root), "only the two intersecting segments render").toHaveLength(2);

    // parse 0.3–0.45 → clipped to 0.4–0.45 → re-normalized to 0–25%.
    // A "rebuild the bar from raw fractions" regression leaves 30%/15%.
    const parse = segmentById(root, "parse")!;
    expect(boxOf(parse).left, "parse re-normalized left").toBeCloseTo(0, 4);
    expect(boxOf(parse).width, "parse re-normalized width").toBeCloseTo(25, 4);

    // write 0.5–0.9 → clipped to 0.5–0.6 → 50%–100%.
    const write = segmentById(root, "write")!;
    expect(boxOf(write).left).toBeCloseTo(50, 4);
    expect(boxOf(write).width).toBeCloseTo(50, 4);

    // The overview still highlights exactly the window.
    const highlight = root.querySelector<HTMLElement>(".hk-range-ribbon-window")!;
    expect(boxOf(highlight).left).toBeCloseTo(40, 4);
    expect(boxOf(highlight).width).toBeCloseTo(20, 4);
    const before = root.querySelector<HTMLElement>('.hk-range-ribbon-scrim[data-side="before"]')!;
    const after = root.querySelector<HTMLElement>('.hk-range-ribbon-scrim[data-side="after"]')!;
    expect(boxOf(before).width, "before scrim dims 0–40%").toBeCloseTo(40, 4);
    expect(boxOf(after).left, "after scrim starts at 60%").toBeCloseTo(60, 4);
    expect(boxOf(after).width).toBeCloseTo(40, 4);
    expect(root.getAttribute("data-windowed")).toBe("true");
  });

  it("keeps painting the FULL domain in the overview while the lanes are clipped", () => {
    const root = mountRibbon({ window: [0.4, 0.6] });
    // Negative pin for "clipping only happens in windowed lanes": the
    // wholly-outside boot must still be painted on the overview at its
    // FULL-domain position. If the overview reused the clipped placement
    // (or the window were applied to both surfaces) this goes red.
    const overview = root.querySelector<HTMLElement>(
      '.hk-range-ribbon-overview-segment[data-segment-id="boot"]',
    );
    expect(overview, "the overview keeps the outside segment").toBeTruthy();
    expect(boxOf(overview!).left, "overview left is full-domain").toBeCloseTo(5, 4);
    expect(boxOf(overview!).width, "overview width is full-domain").toBeCloseTo(15, 4);
    expect(root.querySelectorAll(".hk-range-ribbon-overview-segment")).toHaveLength(4);
    // …while the lane copy of the same segment is gone.
    expect(segmentById(root, "boot")).toBeNull();
  });

  it("clips a domain-edge sliver without rescaling it against the full domain", () => {
    const root = mountRibbon({ window: [0.9, 1] });
    // write ends exactly at the window start (a strict-intersection test).
    expect(segmentById(root, "write")).toBeNull();
    const flush = segmentById(root, "flush")!;
    expect(boxOf(flush).left).toBeCloseTo(50, 4);
    expect(boxOf(flush).width).toBeCloseTo(50, 4);
    expect(laneSegments(root)).toHaveLength(1);
  });

  it("normalizes inverted, out-of-domain and degenerate windows; NaN means full", () => {
    // Inverted [0.8, 0.2] → [0.2, 0.8].
    const inverted = mountRibbon({ window: [0.8, 0.2] as unknown as [number, number] });
    expect(boxOf(inverted.querySelector<HTMLElement>(".hk-range-ribbon-window")!).left).toBeCloseTo(
      20,
      4,
    );
    expect(
      boxOf(inverted.querySelector<HTMLElement>(".hk-range-ribbon-window")!).width,
    ).toBeCloseTo(60, 4);

    // Out-of-domain [-0.5, 0.5] → [0, 0.5]: boot 5–20% of the domain → 10–40% of the window.
    const clamped = mountRibbon({ window: [-0.5, 0.5] as [number, number] });
    expect(boxOf(segmentById(clamped, "boot")!).left).toBeCloseTo(10, 4);
    expect(boxOf(segmentById(clamped, "boot")!).width).toBeCloseTo(30, 4);

    // Degenerate [0.5, 0.5] expands around the point to minWindow (0.02).
    const degenerate = mountRibbon({ window: [0.5, 0.5] });
    const highlight = degenerate.querySelector<HTMLElement>(".hk-range-ribbon-window")!;
    expect(boxOf(highlight).left).toBeCloseTo(49, 4);
    expect(boxOf(highlight).width).toBeCloseTo(2, 4);

    // NaN is not a window: the full domain renders with no chrome.
    const nan = mountRibbon({ window: [Number.NaN, 0.5] as [number, number] });
    expect(nan.querySelector(".hk-range-ribbon-handle")).toBeNull();
    expect(laneSegments(nan)).toHaveLength(4);
  });

  it("clamps a minWindow above half the domain around the point and treats malformed windows as full", () => {
    // minWindow 0.7 around 0.5 → [0.15, 0.85].
    const wide = mountRibbon({ window: [0.5, 0.5], minWindow: 0.7 });
    const highlight = wide.querySelector<HTMLElement>(".hk-range-ribbon-window")!;
    expect(boxOf(highlight).left).toBeCloseTo(15, 4);
    expect(boxOf(highlight).width).toBeCloseTo(70, 4);

    // Malformed values mean "no window" (full domain), never a crash: a
    // one-member array, an infinity and an all-NaN pair all fall back.
    const malformed: number[][] = [
      [0.2],
      [0.2, Number.POSITIVE_INFINITY],
      [Number.NaN, Number.NaN],
    ];
    for (const window of malformed) {
      const root = mountRibbon({ window });
      expect(root.querySelector(".hk-range-ribbon-handle")).toBeNull();
      expect(laneSegments(root)).toHaveLength(4);
    }
  });
});

// ── Brushing ────────────────────────────────────────────────────────────
describe("HkRangeRibbon brush", () => {
  it("brushes a window from a strip drag in full-domain fractions", async () => {
    const host = mountHost(null);
    const { strip, x } = stubStrip(host.root);
    await drag(strip, 0.2, 0.4, x);
    expectWindow(lastWindow(host.windowChange), 0.2, 0.4);
    expect(host.window.value).not.toBeNull();
    expect(host.window.value![0]).toBeCloseTo(0.2, 10);
    expect(host.window.value![1]).toBeCloseTo(0.4, 10);
    // The host-fed window drives the lanes: only parse survives [0.2, 0.4].
    expect(laneSegments(host.root)).toHaveLength(1);
    expect(segmentById(host.root, "parse")).toBeTruthy();
  });

  it("clamps a sub-minimum brush to minWindow", async () => {
    const host = mountHost(null, { minWindow: 0.1 });
    const { strip, x } = stubStrip(host.root);
    await drag(strip, 0.5, 0.52, x);
    expectWindow(lastWindow(host.windowChange), 0.5, 0.6);
    const [start, end] = lastWindow(host.windowChange)!;
    expect(end - start, "never narrower than minWindow").toBeGreaterThanOrEqual(0.1 - 1e-9);
  });

  it("shifts a min-width brush inward at the domain edge", async () => {
    const host = mountHost(null, { minWindow: 0.1 });
    const { strip, x } = stubStrip(host.root);
    await drag(strip, 0.95, 0.99, x);
    expectWindow(lastWindow(host.windowChange), 0.9, 1);
  });

  it("keeps start < end for a right-to-left drag", async () => {
    const host = mountHost(null);
    const { strip, x } = stubStrip(host.root);
    await drag(strip, 0.6, 0.2, x);
    expectWindow(lastWindow(host.windowChange), 0.2, 0.6);
  });

  it("clamps a brush that runs past the strip to the domain", async () => {
    const host = mountHost(null);
    const { strip, x } = stubStrip(host.root);
    await drag(strip, 0.1, 1.4, x);
    expectWindow(lastWindow(host.windowChange), 0.1, 1);
  });

  it("does not brush on a click without movement (negative)", async () => {
    const host = mountHost(null);
    const { strip, x } = stubStrip(host.root);
    pointer("pointerdown", x(0.55), strip);
    pointer("pointerup", x(0.55), strip);
    await nextTick();
    expect(host.windowChange).not.toHaveBeenCalled();
    expect(host.root.hasAttribute("data-windowed")).toBe(false);
  });

  it("keeps its own window when no window prop or listener is supplied (uncontrolled fallback)", async () => {
    const root = mountRibbon({});
    const { strip, x } = stubStrip(root);
    pointer("pointerdown", x(0.25), strip);
    pointer("pointermove", x(0.5), strip);
    pointer("pointerup", x(0.5), strip);
    await nextTick();
    expect(root.hasAttribute("data-windowed")).toBe(true);
    const parse = segmentById(root, "parse")!;
    expect(boxOf(parse).left).toBeCloseTo(20, 4);
    expect(boxOf(parse).width).toBeCloseTo(60, 4);
    expect(root.querySelector(".hk-range-ribbon-reset")).toBeTruthy();
  });
});

// ── Pointer plumbing (capture / multi-touch / release) ──────────────────
describe("HkRangeRibbon pointer plumbing", () => {
  it("captures the pointer on strip and handle pointerdown", () => {
    const host = mountHost([0.2, 0.6]);
    const { strip, x } = stubStrip(host.root);
    const stripCapture = vi.fn();
    strip.setPointerCapture = stripCapture;
    pointer("pointerdown", x(0.5), strip);
    expect(stripCapture, "strip captures the brush pointer").toHaveBeenCalledWith(1);
    pointer("pointerup", x(0.5), strip);

    const handle = host.root.querySelector<HTMLElement>('[data-edge="end"]')!;
    const handleCapture = vi.fn();
    handle.setPointerCapture = handleCapture;
    pointer("pointerdown", x(0.6), handle);
    expect(handleCapture, "handle captures the resize pointer").toHaveBeenCalledWith(1);
    pointer("pointerup", x(0.6), handle);
  });

  it("ignores a second pointer while a brush is in flight", async () => {
    const host = mountHost(null);
    const { strip, x } = stubStrip(host.root);
    pointer("pointerdown", x(0.2), strip, { pointerId: 1 });
    pointer("pointerdown", x(0.8), strip, { pointerId: 2 }); // second finger
    pointer("pointermove", x(0.4), strip, { pointerId: 1 });
    await nextTick();
    expectWindow(lastWindow(host.windowChange), 0.2, 0.4);

    // The other pointer's release must not end the first drag…
    const calls = host.windowChange.mock.calls.length;
    pointer("pointerup", x(0.4), strip, { pointerId: 2 });
    pointer("pointermove", x(0.5), strip, { pointerId: 1 });
    await nextTick();
    expect(host.windowChange.mock.calls.length).toBe(calls + 1);
    expectWindow(lastWindow(host.windowChange), 0.2, 0.5);
  });

  it("ends the gesture when the pointer is released outside the ribbon", async () => {
    const host = mountHost(null);
    const { strip, x } = stubStrip(host.root);
    pointer("pointerdown", x(0.2), strip);
    pointer("pointermove", x(0.3), strip);
    await nextTick();
    let calls = host.windowChange.mock.calls.length;

    document.body.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        pointerId: 1,
        pointerType: "mouse",
        clientX: x(0.9),
        clientY: 10,
        button: 0,
      }),
    );
    document.body.dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        pointerId: 1,
        pointerType: "mouse",
        clientX: x(0.9),
        clientY: 10,
      }),
    );
    await nextTick();
    expect(host.windowChange.mock.calls.length, "released drag stops tracking").toBe(calls);

    // pointercancel ends it too.
    pointer("pointerdown", x(0.1), strip);
    pointer("pointermove", x(0.2), strip);
    await nextTick();
    calls = host.windowChange.mock.calls.length;
    document.body.dispatchEvent(
      new PointerEvent("pointercancel", {
        bubbles: true,
        pointerId: 1,
        pointerType: "mouse",
        clientX: x(0.2),
        clientY: 10,
      }),
    );
    document.body.dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        pointerId: 1,
        pointerType: "mouse",
        clientX: x(0.6),
        clientY: 10,
      }),
    );
    await nextTick();
    expect(host.windowChange.mock.calls.length, "cancelled drag stops tracking").toBe(calls);
  });

  it("brushes with touch pointers", async () => {
    const host = mountHost(null);
    const { strip, x } = stubStrip(host.root);
    pointer("pointerdown", x(0.25), strip, { pointerType: "touch", pointerId: 3 });
    pointer("pointermove", x(0.5), strip, { pointerType: "touch", pointerId: 3 });
    pointer("pointerup", x(0.5), strip, { pointerType: "touch", pointerId: 3 });
    await nextTick();
    expectWindow(lastWindow(host.windowChange), 0.25, 0.5);
  });

  it("ignores sub-pixel jitter on a click (3px brush slop)", async () => {
    const host = mountHost(null);
    const { strip, x } = stubStrip(host.root);

    pointer("pointerdown", x(0.5), strip);
    pointer("pointermove", x(0.5) + 2, strip); // 2px: under the slop
    pointer("pointerup", x(0.5) + 2, strip);
    await nextTick();
    expect(host.windowChange, "a jittery click must not zoom").not.toHaveBeenCalled();
    expect(host.root.hasAttribute("data-windowed")).toBe(false);

    // 4px clears the slop: this is a real brush.
    pointer("pointerdown", x(0.5), strip);
    pointer("pointermove", x(0.5) + 4, strip);
    pointer("pointerup", x(0.5) + 4, strip);
    await nextTick();
    expect(host.windowChange).toHaveBeenCalled();
    expect(host.root.hasAttribute("data-windowed")).toBe(true);
  });

  it("gives touch pointers a wider brush slop", async () => {
    const host = mountHost(null);
    const { strip, x } = stubStrip(host.root);

    // A touch tap drifts 4-6px in practice: 6px must still be a tap.
    pointer("pointerdown", x(0.5), strip, { pointerType: "touch", pointerId: 4 });
    pointer("pointermove", x(0.5) + 6, strip, { pointerType: "touch", pointerId: 4 });
    pointer("pointerup", x(0.5) + 6, strip, { pointerType: "touch", pointerId: 4 });
    await nextTick();
    expect(host.windowChange, "a 6px touch tap must not zoom").not.toHaveBeenCalled();
    expect(host.root.hasAttribute("data-windowed")).toBe(false);

    // 12px clears the touch slop: this is a real brush.
    pointer("pointerdown", x(0.5), strip, { pointerType: "touch", pointerId: 4 });
    pointer("pointermove", x(0.5) + 12, strip, { pointerType: "touch", pointerId: 4 });
    pointer("pointerup", x(0.5) + 12, strip, { pointerType: "touch", pointerId: 4 });
    await nextTick();
    expect(host.windowChange).toHaveBeenCalled();
    expect(host.root.hasAttribute("data-windowed")).toBe(true);
  });
});

// ── Handles ─────────────────────────────────────────────────────────────
describe("HkRangeRibbon handles", () => {
  it("moves exactly one edge when the start handle is dragged", async () => {
    const host = mountHost([0.2, 0.6], { minWindow: 0.1 });
    const { x } = stubStrip(host.root);
    const handle = host.root.querySelector<HTMLElement>('[data-edge="start"]')!;
    pointer("pointerdown", x(0.2), handle);
    pointer("pointermove", x(0.35), handle);
    pointer("pointerup", x(0.35), handle);
    await nextTick();
    expectWindow(lastWindow(host.windowChange), 0.35, 0.6);
  });

  it("moves exactly one edge when the end handle is dragged", async () => {
    const host = mountHost([0.2, 0.6], { minWindow: 0.1 });
    const { x } = stubStrip(host.root);
    const handle = host.root.querySelector<HTMLElement>('[data-edge="end"]')!;
    pointer("pointerdown", x(0.6), handle);
    pointer("pointermove", x(0.75), handle);
    pointer("pointerup", x(0.75), handle);
    await nextTick();
    expectWindow(lastWindow(host.windowChange), 0.2, 0.75);
  });

  it("stops the end handle at minWindow and never crosses the start edge", async () => {
    const host = mountHost([0.2, 0.6], { minWindow: 0.1 });
    const { x } = stubStrip(host.root);
    const handle = host.root.querySelector<HTMLElement>('[data-edge="end"]')!;
    pointer("pointerdown", x(0.6), handle);
    pointer("pointermove", x(0.05), handle);
    pointer("pointerup", x(0.05), handle);
    await nextTick();
    expectWindow(lastWindow(host.windowChange), 0.2, 0.3);
  });

  it("stops the start handle at minWindow and never crosses the end edge", async () => {
    const host = mountHost([0.2, 0.6], { minWindow: 0.1 });
    const { x } = stubStrip(host.root);
    const handle = host.root.querySelector<HTMLElement>('[data-edge="start"]')!;
    pointer("pointerdown", x(0.2), handle);
    pointer("pointermove", x(0.95), handle);
    pointer("pointerup", x(0.95), handle);
    await nextTick();
    expectWindow(lastWindow(host.windowChange), 0.5, 0.6);
  });

  it("emits FULL-DOMAIN absolute fractions when dragging a handle inside an active window", async () => {
    // The chest row filter consumes this value: a drag on the right handle
    // of [0.2, 0.4] to the middle of the ZOOMED strip must answer
    // [0.2, 0.5] in full-domain fractions — a window-relative bug would
    // answer [0.2, 0.7] (or renormalize the start to 0).
    const host = mountHost([0.2, 0.4], { minWindow: 0.02 });
    const { x } = stubStrip(host.root);
    const handle = host.root.querySelector<HTMLElement>('[data-edge="end"]')!;
    pointer("pointerdown", x(0.4), handle);
    pointer("pointermove", x(0.5), handle);
    pointer("pointerup", x(0.5), handle);
    await nextTick();
    const emitted = lastWindow(host.windowChange);
    expectWindow(emitted, 0.2, 0.5);
    // The start edge must be untouched, in absolute domain terms.
    expect(emitted![0], "start stays 0.2 absolute, not window-relative").toBeCloseTo(0.2, 10);
    // …and the rendered chrome agrees: start handle at 20%, end at 50%.
    const startHandle = host.root.querySelector<HTMLElement>('[data-edge="start"]')!;
    const endHandle = host.root.querySelector<HTMLElement>('[data-edge="end"]')!;
    expect(parseFloat(startHandle.style.left)).toBeCloseTo(20, 4);
    expect(parseFloat(endHandle.style.left)).toBeCloseTo(50, 4);
    const highlight = host.root.querySelector<HTMLElement>(".hk-range-ribbon-window")!;
    expect(boxOf(highlight).left, "highlight left is 20% of the full domain").toBeCloseTo(20, 4);
    expect(boxOf(highlight).width).toBeCloseTo(30, 4);
  });

  it("nudges only its own edge from the keyboard", async () => {
    const host = mountHost([0.4, 0.6], { minWindow: 0.02 });
    const handle = host.root.querySelector<HTMLElement>('[data-edge="start"]')!;
    keydown(handle, "ArrowRight");
    await nextTick();
    expectWindow(lastWindow(host.windowChange), 0.45, 0.6);
  });
});

// ── Reset paths ─────────────────────────────────────────────────────────
describe("HkRangeRibbon reset", () => {
  it("resets through the button and restores the full view", async () => {
    const host = mountHost([0.2, 0.6]);
    const button = host.root.querySelector<HTMLElement>(".hk-range-ribbon-reset");
    expect(button, "reset button is shown while a window exists").toBeTruthy();
    // The reset affordance rides the STANDARD icon button (user direction
    // 2026-11-06: no hand-rolled chip chrome), carrying its lucide glyph
    // through the house-normal slot — pin the lucide class the slot must
    // produce so a glyph swap cannot silently vanish.
    expect(button!.className, "reset is an HkIconButton, not a bespoke chip").toContain(
      "hk-icon-button",
    );
    expect(
      button!.querySelector("svg.lucide-rotate-ccw"),
      "reset glyph renders through the icon slot",
    ).not.toBeNull();
    expect(button!.getAttribute("type"), "reset never becomes a submit button").toBe("button");
    button!.click();
    await nextTick();
    expect(host.windowChange).toHaveBeenLastCalledWith(null);
    expect(host.window.value).toBeNull();
    expect(host.root.querySelector(".hk-range-ribbon-reset")).toBeNull();
    expect(host.root.querySelector(".hk-range-ribbon-handle")).toBeNull();
    // Full view restored — not just the highlight removed.
    expect(laneSegments(host.root)).toHaveLength(4);
    expect(boxOf(segmentById(host.root, "boot")!).left).toBeCloseTo(5, 4);
    expect(boxOf(segmentById(host.root, "flush")!).left).toBeCloseTo(95, 4);
  });

  it("resets on a double-click on the strip", async () => {
    const host = mountHost([0.2, 0.6]);
    const strip = host.root.querySelector<HTMLElement>(".hk-range-ribbon-strip")!;
    strip.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true }));
    await nextTick();
    expect(host.windowChange).toHaveBeenLastCalledWith(null);
    expect(laneSegments(host.root)).toHaveLength(4);
  });

  it("only consumes a double-click when it actually resets", async () => {
    const idle = mountHost(null);
    const idleEvent = new MouseEvent("dblclick", { bubbles: true, cancelable: true });
    idle.root.querySelector<HTMLElement>(".hk-range-ribbon-strip")!.dispatchEvent(idleEvent);
    await nextTick();
    expect(idle.windowChange).not.toHaveBeenCalled();
    expect(idleEvent.defaultPrevented, "nothing to reset: the host keeps the event").toBe(false);

    const host = mountHost([0.2, 0.6]);
    const event = new MouseEvent("dblclick", { bubbles: true, cancelable: true });
    host.root.querySelector<HTMLElement>(".hk-range-ribbon-strip")!.dispatchEvent(event);
    await nextTick();
    expect(host.windowChange).toHaveBeenLastCalledWith(null);
    expect(event.defaultPrevented).toBe(true);
  });

  it("resets on Escape", async () => {
    const host = mountHost([0.2, 0.6]);
    const strip = host.root.querySelector<HTMLElement>(".hk-range-ribbon-strip")!;
    const event = keydown(strip, "Escape");
    await nextTick();
    expect(event.defaultPrevented).toBe(true);
    expect(host.windowChange).toHaveBeenLastCalledWith(null);
  });

  it("resets on Home", async () => {
    const host = mountHost([0.2, 0.6]);
    const strip = host.root.querySelector<HTMLElement>(".hk-range-ribbon-strip")!;
    keydown(strip, "Home");
    await nextTick();
    expect(host.windowChange).toHaveBeenLastCalledWith(null);
  });

  it("resets on Home from the reset button too", async () => {
    const host = mountHost([0.2, 0.6]);
    const button = host.root.querySelector<HTMLElement>(".hk-range-ribbon-reset")!;
    const event = keydown(button, "Home");
    await nextTick();
    expect(host.windowChange).toHaveBeenLastCalledWith(null);
    expect(event.defaultPrevented).toBe(true);
  });

  it("leaves Escape to the host when there is nothing to reset", async () => {
    const host = mountHost(null);
    const strip = host.root.querySelector<HTMLElement>(".hk-range-ribbon-strip")!;
    const event = keydown(strip, "Escape");
    await nextTick();
    expect(host.windowChange, "no window: nothing resets").not.toHaveBeenCalled();
    expect(event.defaultPrevented, "a host dialog must still see Escape").toBe(false);

    // With a window the reset really happens, so Escape is consumed.
    await host.setWindow([0.2, 0.6]);
    const second = keydown(host.root.querySelector<HTMLElement>(".hk-range-ribbon-strip")!, "Escape");
    await nextTick();
    expect(host.windowChange).toHaveBeenLastCalledWith(null);
    expect(second.defaultPrevented).toBe(true);
  });

  it("treats a full-domain window as nothing to reset (raw-records rest state)", async () => {
    // A minimal-style host rests at the controlled FULL selection [0, 1]:
    // the grips paint, but there is no narrower selection to come back to.
    // Escape there must reach the host (the dialog closes), not "reset" the
    // bar it already shows — before 2026-11-07 every press swallowed the key.
    const host = mountHost([0, 1]);
    const strip = host.root.querySelector<HTMLElement>(".hk-range-ribbon-strip")!;
    const event = keydown(strip, "Escape");
    await nextTick();
    expect(host.windowChange, "full selection: nothing resets").not.toHaveBeenCalled();
    expect(event.defaultPrevented, "a host dialog must still see Escape").toBe(false);

    // The reset BUTTON agrees with Escape: nothing to reset at [0, 1].
    expect(host.root.querySelector(".hk-range-ribbon-reset")).toBeNull();
    // The grips stay (they are the selection itself, not a reset affordance).
    expect(host.root.querySelector(".hk-range-ribbon-handle")).not.toBeNull();

    // A real sub-domain still resets — and the chip is back for it.
    await host.setWindow([0.3, 0.7]);
    expect(host.root.querySelector(".hk-range-ribbon-reset")).not.toBeNull();
    const second = keydown(host.root.querySelector<HTMLElement>(".hk-range-ribbon-strip")!, "Escape");
    await nextTick();
    expect(host.windowChange).toHaveBeenLastCalledWith(null);
    expect(second.defaultPrevented).toBe(true);
    // Back at the full selection the chip is gone again.
    await host.setWindow([0, 1]);
    expect(host.root.querySelector(".hk-range-ribbon-reset")).toBeNull();
  });

  it("cancels an in-flight brush with Escape and consumes the key", async () => {
    const host = mountHost(null);
    const { strip, x } = stubStrip(host.root);
    // Pointer down and stay inside the brush slop: no window exists yet.
    pointer("pointerdown", x(0.5), strip);
    pointer("pointermove", x(0.5) + 2, strip); // 2px < the 3px mouse slop
    await nextTick();
    expect(host.windowChange, "still inside the slop").not.toHaveBeenCalled();

    const escape = keydown(strip, "Escape");
    await nextTick();
    expect(escape.defaultPrevented, "cancelling a live gesture consumes the key").toBe(true);
    expect(host.windowChange, "cancelling is not a window change").not.toHaveBeenCalled();

    // PROBE: the gesture is gone — a later move must not revive the brush.
    pointer("pointermove", x(0.8), strip);
    await nextTick();
    expect(host.windowChange, "no brush may be revived after the cancel").not.toHaveBeenCalled();
    expect(host.root.hasAttribute("data-windowed")).toBe(false);
  });

  it("drops an in-flight brush when a reset interrupts it", async () => {
    const host = mountHost(null);
    const { strip, x } = stubStrip(host.root);
    pointer("pointerdown", x(0.2), strip);
    pointer("pointermove", x(0.4), strip);
    await nextTick();
    const afterBrush = host.windowChange.mock.calls.length;
    expect(afterBrush, "the brush emitted").toBeGreaterThan(0);

    keydown(strip, "Escape");
    await nextTick();
    expect(host.windowChange).toHaveBeenLastCalledWith(null);
    const afterReset = host.windowChange.mock.calls.length;

    // The pointer is still down, but the reset cleared the gesture: the
    // next move must not re-brush from the stale anchor.
    pointer("pointermove", x(0.8), strip);
    await nextTick();
    expect(host.windowChange.mock.calls.length, "no brush after the reset").toBe(afterReset);
  });

  it("hides the reset button when no window exists (negative)", () => {
    const root = mountRibbon({ window: null });
    expect(root.querySelector(".hk-range-ribbon-reset")).toBeNull();
  });
});

// ── Keyboard ────────────────────────────────────────────────────────────
describe("HkRangeRibbon keyboard", () => {
  it("slides the window with the arrow keys, clamped to the domain", async () => {
    const host = mountHost([0.4, 0.6]);
    let strip = host.root.querySelector<HTMLElement>(".hk-range-ribbon-strip")!;
    keydown(strip, "ArrowRight");
    await nextTick();
    expectWindow(lastWindow(host.windowChange), 0.45, 0.65);

    // At the right edge the width is preserved and the end clamps to 1.
    await host.setWindow([0.9, 0.98]);
    strip = host.root.querySelector<HTMLElement>(".hk-range-ribbon-strip")!;
    keydown(strip, "ArrowRight");
    await nextTick();
    expectWindow(lastWindow(host.windowChange), 0.92, 1);

    // …and symmetrically at the left edge.
    await host.setWindow([0.02, 0.1]);
    strip = host.root.querySelector<HTMLElement>(".hk-range-ribbon-strip")!;
    keydown(strip, "ArrowLeft");
    await nextTick();
    expectWindow(lastWindow(host.windowChange), 0, 0.08);
  });

  it("resizes from the trailing edge with Shift+Arrow, clamped to minWindow", async () => {
    const host = mountHost([0.4, 0.6], { minWindow: 0.02 });
    let strip = host.root.querySelector<HTMLElement>(".hk-range-ribbon-strip")!;
    keydown(strip, "ArrowRight", { shiftKey: true });
    await nextTick();
    expectWindow(lastWindow(host.windowChange), 0.4, 0.65);

    await host.setWindow([0.4, 0.45]);
    strip = host.root.querySelector<HTMLElement>(".hk-range-ribbon-strip")!;
    keydown(strip, "ArrowLeft", { shiftKey: true });
    await nextTick();
    expectWindow(lastWindow(host.windowChange), 0.4, 0.42);

    await host.setWindow([0.94, 0.99]);
    strip = host.root.querySelector<HTMLElement>(".hk-range-ribbon-strip")!;
    keydown(strip, "ArrowRight", { shiftKey: true });
    await nextTick();
    expectWindow(lastWindow(host.windowChange), 0.94, 1);
  });

  it("contracts the full domain into a window with Shift+Arrow; plain arrows stay inert (negative)", async () => {
    const host = mountHost(null);
    const strip = host.root.querySelector<HTMLElement>(".hk-range-ribbon-strip")!;

    // A bare arrow cannot brush without a brush: no window, no emission —
    // and the arrow is left un-prevented for the host.
    const bareArrow = keydown(strip, "ArrowRight");
    await nextTick();
    expect(host.windowChange).not.toHaveBeenCalled();
    expect(bareArrow.defaultPrevented, "an inert arrow is not swallowed").toBe(false);
    expect(host.root.hasAttribute("data-windowed")).toBe(false);

    // Shift+Arrow is the keyboard entry point into windowed mode.
    keydown(strip, "ArrowLeft", { shiftKey: true });
    await nextTick();
    expectWindow(lastWindow(host.windowChange), 0, 0.95);
  });

  it("does not emit an identical window at a domain edge", async () => {
    const host = mountHost([0.9, 1]);
    let strip = host.root.querySelector<HTMLElement>(".hk-range-ribbon-strip")!;
    let event = keydown(strip, "ArrowRight");
    await nextTick();
    expect(host.windowChange, "sliding past the right edge is a no-op").not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);

    await host.setWindow([0, 0.1]);
    strip = host.root.querySelector<HTMLElement>(".hk-range-ribbon-strip")!;
    event = keydown(strip, "ArrowLeft");
    await nextTick();
    expect(host.windowChange, "sliding past the left edge is a no-op").not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);

    await host.setWindow([0.4, 1]);
    strip = host.root.querySelector<HTMLElement>(".hk-range-ribbon-strip")!;
    event = keydown(strip, "ArrowRight", { shiftKey: true });
    await nextTick();
    expect(host.windowChange, "growing past the right edge is a no-op").not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it("keeps Home for the range surface and Escape for the whole ribbon", async () => {
    const host = mountHost([0.2, 0.6]);
    const segment = segmentById(host.root, "write")!;

    // A focused segment keeps its native Home (caret/scroll) behaviour.
    const homeOnSegment = keydown(segment, "Home");
    await nextTick();
    expect(host.windowChange, "Home on a segment does not reset").not.toHaveBeenCalled();
    expect(homeOnSegment.defaultPrevented).toBe(false);

    // Escape still resets from anywhere inside the ribbon.
    keydown(segment, "Escape");
    await nextTick();
    expect(host.windowChange).toHaveBeenLastCalledWith(null);
  });
});

// ── Selection ───────────────────────────────────────────────────────────
describe("HkRangeRibbon selection", () => {
  it("selects on click and paints selectedId as data-selected", async () => {
    const host = mountHost([0.2, 0.6]);
    segmentById(host.root, "write")!.click();
    await nextTick();
    expect(host.select).toHaveBeenCalledWith("write");

    const root = mountRibbon({ window: null, selectedId: "parse" });
    expect(segmentById(root, "parse")!.getAttribute("data-selected")).toBe("true");
    expect(segmentById(root, "boot")!.hasAttribute("data-selected")).toBe(false);
  });

  it("selects with Enter and Space from the keyboard", async () => {
    const host = mountHost(null);
    const parse = segmentById(host.root, "parse")!;
    const enter = keydown(parse, "Enter");
    await nextTick();
    expect(enter.defaultPrevented).toBe(true);
    expect(host.select).toHaveBeenCalledWith("parse");
    keydown(parse, " ");
    await nextTick();
    expect(host.select).toHaveBeenCalledTimes(2);
  });

  it("paints tone, kind and status onto the lane bars", () => {
    const segments: RibbonSegment[] = [
      {
        id: "tinted",
        lane: "cpu",
        start: 0.1,
        end: 0.3,
        label: "tinted",
        tone: "warning",
        kind: "wave",
      },
      { id: "queued", lane: "cpu", start: 0.4, end: 0.6, label: "queued", status: "pending" },
      { id: "failed", lane: "cpu", start: 0.7, end: 0.9, label: "failed", status: "error" },
      { id: "plain", lane: "cpu", start: 0.92, end: 0.98, label: "plain" },
    ];
    const root = mountRibbon({ window: null, segments });
    const tinted = segmentById(root, "tinted")!;
    expect(tinted.getAttribute("data-tone")).toBe("warning");
    expect(tinted.getAttribute("data-kind")).toBe("wave");
    expect(segmentById(root, "queued")!.getAttribute("data-status")).toBe("pending");
    expect(segmentById(root, "failed")!.getAttribute("data-status")).toBe("error");
    // A plain row carries none of the optional markers (no "undefined" text).
    const plain = segmentById(root, "plain")!;
    expect(plain.hasAttribute("data-tone")).toBe(false);
    expect(plain.hasAttribute("data-kind")).toBe(false);
    expect(plain.hasAttribute("data-status")).toBe(false);
  });
});

// ── Tip card ────────────────────────────────────────────────────────────
describe("HkRangeRibbon tip card", () => {
  it("floats the title and lines on hover and leaves on mouseleave", async () => {
    const root = mountRibbon({ window: null });
    const flush = segmentById(root, "flush")!;
    flush.dispatchEvent(new MouseEvent("mouseenter"));
    await nextTick();
    const tip = flush.querySelector<HTMLElement>(".hk-range-ribbon-tip");
    expect(tip, "tip card renders on hover").toBeTruthy();
    expect(tip!.getAttribute("role")).toBe("tooltip");
    expect(tip!.querySelector(".hk-range-ribbon-tip-title")?.textContent).toBe("Flush stall");
    expect(
      Array.from(tip!.querySelectorAll(".hk-range-ribbon-tip-line")).map((line) => line.textContent),
    ).toEqual(["waited 12ms", "retried once"]);

    flush.dispatchEvent(new MouseEvent("mouseleave"));
    await nextTick();
    expect(flush.querySelector(".hk-range-ribbon-tip")).toBeNull();
  });

  it("floats on focus and hides on blur", async () => {
    const root = mountRibbon({ window: null });
    const flush = segmentById(root, "flush")!;
    flush.dispatchEvent(new FocusEvent("focus"));
    await nextTick();
    expect(flush.querySelector(".hk-range-ribbon-tip")).toBeTruthy();
    flush.dispatchEvent(new FocusEvent("blur"));
    await nextTick();
    expect(flush.querySelector(".hk-range-ribbon-tip")).toBeNull();
  });

  it("floats nothing for a segment without a tip (negative)", async () => {
    const root = mountRibbon({ window: null });
    const parse = segmentById(root, "parse")!;
    parse.dispatchEvent(new MouseEvent("mouseenter"));
    await nextTick();
    expect(parse.querySelector(".hk-range-ribbon-tip")).toBeNull();
  });

  it("does not resurrect a tip for a segment that left the window", async () => {
    const host = mountHost(null);
    const flush = segmentById(host.root, "flush")!;
    flush.dispatchEvent(new MouseEvent("mouseenter"));
    await nextTick();
    expect(flush.querySelector(".hk-range-ribbon-tip"), "tip floats on hover").toBeTruthy();

    // Narrow the window until the hovered segment is clipped out: its bar
    // unmounts without a mouseleave, and the tip id must not survive it.
    await host.setWindow([0.2, 0.6]);
    expect(segmentById(host.root, "flush")).toBeNull();
    expect(host.root.querySelector(".hk-range-ribbon-tip")).toBeNull();

    // Restoring the full domain re-renders the bar — with NO tip, because
    // nothing is hovering or focusing it any more.
    await host.setWindow(null);
    expect(segmentById(host.root, "flush")).toBeTruthy();
    expect(host.root.querySelector(".hk-range-ribbon-tip")).toBeNull();
  });

  it("anchors the tip inward at the track edges", async () => {
    const segments: RibbonSegment[] = [
      { id: "left", lane: "cpu", start: 0.02, end: 0.12, label: "left", tip: { title: "Left" } },
      { id: "mid", lane: "cpu", start: 0.45, end: 0.55, label: "mid", tip: { title: "Mid" } },
      { id: "right", lane: "cpu", start: 0.9, end: 0.99, label: "right", tip: { title: "Right" } },
      { id: "quarter", lane: "cpu", start: 0.2, end: 0.3, label: "quarter", tip: { title: "Q" } },
      { id: "threequarter", lane: "cpu", start: 0.7, end: 0.8, label: "threequarter", tip: { title: "TQ" } },
    ];
    const root = mountRibbon({ window: null, segments });
    const anchorOf = async (id: string): Promise<string | null> => {
      const bar = segmentById(root, id)!;
      bar.dispatchEvent(new MouseEvent("mouseenter"));
      await nextTick();
      return bar.querySelector<HTMLElement>(".hk-range-ribbon-tip")!.getAttribute("data-anchor");
    };
    // The card grows away from the edge it would otherwise overflow.
    expect(await anchorOf("left"), "near the track start").toBe("start"); // center 7%
    expect(await anchorOf("mid"), "mid-track").toBe("middle"); // center 50%
    expect(await anchorOf("right"), "near the track end").toBe("end"); // center 94.5%
    // The thresholds are exclusive: exactly 25% / 75% still centres.
    expect(await anchorOf("quarter"), "exactly 25%").toBe("middle");
    expect(await anchorOf("threequarter"), "exactly 75%").toBe("middle");
  });
});

// ── A11y + i18n ─────────────────────────────────────────────────────────
describe("HkRangeRibbon a11y and i18n", () => {
  it("wires the strip and both handles as sliders with min/max/now", () => {
    const root = mountRibbon({ window: [0.2, 0.6] });
    const strip = root.querySelector<HTMLElement>(".hk-range-ribbon-strip")!;
    expect(strip.getAttribute("role")).toBe("slider");
    expect(strip.getAttribute("aria-orientation")).toBe("horizontal");
    expect(strip.getAttribute("aria-valuemin")).toBe("0");
    expect(strip.getAttribute("aria-valuemax")).toBe("100");
    expect(strip.getAttribute("aria-valuenow"), "strip value = window start").toBe("20");
    expect(strip.getAttribute("aria-valuetext")).toBe("20% – 60%");
    expect(strip.getAttribute("aria-label")).toBe("Observation range");

    const start = root.querySelector<HTMLElement>('[data-edge="start"]')!;
    expect(start.getAttribute("role")).toBe("slider");
    expect(start.getAttribute("aria-orientation")).toBe("horizontal");
    expect(start.getAttribute("aria-valuemin")).toBe("0");
    expect(start.getAttribute("aria-valuemax")).toBe("58");
    expect(start.getAttribute("aria-valuenow")).toBe("20");
    expect(start.getAttribute("aria-label")).toBe("Window start");

    const end = root.querySelector<HTMLElement>('[data-edge="end"]')!;
    expect(end.getAttribute("role")).toBe("slider");
    expect(end.getAttribute("aria-orientation")).toBe("horizontal");
    expect(end.getAttribute("aria-valuemin")).toBe("22");
    expect(end.getAttribute("aria-valuemax")).toBe("100");
    expect(end.getAttribute("aria-valuenow")).toBe("60");
    expect(end.getAttribute("aria-label")).toBe("Window end");

    // The hint described by the strip labels the keyboard contract.
    const describedBy = strip.getAttribute("aria-describedby");
    expect(describedBy, "strip points at its keyboard hint").toBeTruthy();
    const hint = document.getElementById(describedBy!);
    expect(hint, "hint element exists").toBeTruthy();
    expect(hint!.textContent).toContain("Move window");
    expect(hint!.textContent).toContain("Resize window");
  });

  it("announces a narrow window with a decimal so it differs from the full domain", () => {
    const full = mountRibbon({ window: null });
    expect(
      full.querySelector<HTMLElement>(".hk-range-ribbon-strip")!.getAttribute("aria-valuetext"),
      "the full domain keeps the classic integer text",
    ).toBe("0% – 100%");

    const narrow = mountRibbon({ window: [0.004, 0.996] });
    const strip = narrow.querySelector<HTMLElement>(".hk-range-ribbon-strip")!;
    const text = strip.getAttribute("aria-valuetext")!;
    expect(text, "a fractional window keeps one decimal").toContain("0.4%");
    expect(text).toContain("99.6%");
    expect(text, "rounding to integers would be indistinguishable").not.toBe("0% – 100%");
    expect(strip.getAttribute("aria-valuenow"), "valuenow uses the same precision").toBe("0.4");

    const start = narrow.querySelector<HTMLElement>('[data-edge="start"]')!;
    const end = narrow.querySelector<HTMLElement>('[data-edge="end"]')!;
    expect(start.getAttribute("aria-valuenow")).toBe("0.4");
    expect(start.getAttribute("aria-valuetext")).toBe("0.4%");
    expect(end.getAttribute("aria-valuetext")).toBe("99.6%");
    // The handle bounds share the precision: at a razor-narrow window an
    // integer-rounded max (97) would contradict a decimal valuenow (97.5).
    expect(start.getAttribute("aria-valuemax"), "start max keeps the decimal").toBe("97.6");
    expect(end.getAttribute("aria-valuemin"), "end min keeps the decimal").toBe("2.4");

    // An integer window keeps the integer text the earlier pins assert.
    const integer = mountRibbon({ window: [0.2, 0.6] });
    expect(
      integer.querySelector<HTMLElement>(".hk-range-ribbon-strip")!.getAttribute("aria-valuetext"),
    ).toBe("20% – 60%");
  });

  it("localizes the labels and hint from the active locale bundle", async () => {
    await setLocale("ja");
    const root = mountRibbon({ window: [0.2, 0.6] });
    const strip = root.querySelector<HTMLElement>(".hk-range-ribbon-strip")!;
    expect(strip.getAttribute("aria-label")).toBe(jaBundle["hikari::ribbon.rangeAria"]);
    expect(root.querySelector<HTMLElement>('[data-edge="start"]')!.getAttribute("aria-label")).toBe(
      jaBundle["hikari::ribbon.windowStart"],
    );
    expect(root.querySelector<HTMLElement>('[data-edge="end"]')!.getAttribute("aria-label")).toBe(
      jaBundle["hikari::ribbon.windowEnd"],
    );
    expect(
      root.querySelector<HTMLElement>(".hk-range-ribbon-reset")!.getAttribute("aria-label"),
    ).toBe(jaBundle["hikari::ribbon.reset"]);
    const hint = document.getElementById(strip.getAttribute("aria-describedby")!);
    expect(hint!.textContent).toContain(jaBundle["hikari::ribbon.moveWindow"]);
    expect(hint!.textContent).toContain(jaBundle["hikari::ribbon.resizeWindow"]);
  });

  it("windowEnabled=false renders a static full-domain view and ignores the window", async () => {
    const host = mountHost([0.4, 0.6], { windowEnabled: false });
    expect(host.root.getAttribute("data-window-enabled")).toBe("false");
    expect(host.root.hasAttribute("data-windowed")).toBe(false);
    // A supplied window is ignored: the full domain renders, chrome gone.
    expect(laneSegments(host.root)).toHaveLength(4);
    expect(host.root.querySelector(".hk-range-ribbon-window")).toBeNull();
    expect(host.root.querySelector(".hk-range-ribbon-handle")).toBeNull();
    expect(host.root.querySelector(".hk-range-ribbon-reset")).toBeNull();
    const strip = host.root.querySelector<HTMLElement>(".hk-range-ribbon-strip")!;
    expect(strip.getAttribute("tabindex")).toBe("-1");
    expect(strip.getAttribute("aria-disabled")).toBe("true");

    // Drag and Escape stay inert.
    const { x } = stubStrip(host.root);
    pointer("pointerdown", x(0.1), strip);
    pointer("pointermove", x(0.3), strip);
    pointer("pointerup", x(0.3), strip);
    keydown(strip, "Escape");
    await nextTick();
    expect(host.windowChange).not.toHaveBeenCalled();
    expect(laneSegments(host.root)).toHaveLength(4);
  });

  it("does not advertise the range affordance when the window is disabled", () => {
    const disabled = mountRibbon({ windowEnabled: false, window: null });
    const disabledStrip = disabled.querySelector<HTMLElement>(".hk-range-ribbon-strip")!;
    expect(disabledStrip.hasAttribute("title"), "no drag hint on a disabled strip").toBe(false);
    expect(disabledStrip.hasAttribute("aria-describedby"), "nothing to describe").toBe(false);
    expect(disabled.querySelector(".hk-range-ribbon-hint"), "no sr-only hint").toBeNull();

    // The enabled ribbon still carries all three.
    const enabled = mountRibbon({ window: null });
    const enabledStrip = enabled.querySelector<HTMLElement>(".hk-range-ribbon-strip")!;
    expect(enabledStrip.getAttribute("title")).toContain("Drag to select a range");
    const describedBy = enabledStrip.getAttribute("aria-describedby");
    expect(describedBy, "the enabled strip describes its keyboard contract").toBeTruthy();
    expect(document.getElementById(describedBy!), "the hint element exists").toBeTruthy();
    expect(enabled.querySelector(".hk-range-ribbon-hint")).toBeTruthy();
  });
});

// ── Controlled / uncontrolled switch ────────────────────────────────────
describe("HkRangeRibbon controlled contract", () => {
  it("keeps the host's window while controlled and falls back to full when the prop is dropped", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const control = ref<"controlled" | "uncontrolled">("controlled");
    const win = ref<[number, number] | null>([0.2, 0.6]);
    const emitted = vi.fn();
    const Wrapper = defineComponent({
      setup() {
        return () =>
          h(HkRangeRibbon, {
            lanes: LANES,
            segments: SEGMENTS,
            ...(control.value === "controlled"
              ? { window: win.value, onWindowChange: emitted }
              : {}),
          });
      },
    });
    const app = createApp(Wrapper);
    app.mount(container);
    mounts.push({ app, container });
    const root = container.querySelector<HTMLElement>(".hk-range-ribbon")!;
    const { strip, x } = stubStrip(root);

    pointer("pointerdown", x(0.55), strip);
    pointer("pointermove", x(0.7), strip);
    pointer("pointerup", x(0.7), strip);
    await nextTick();
    expect(emitted, "the drag still reports").toHaveBeenCalled();

    // The host ignored the emission: its window stays authoritative.
    const highlight = root.querySelector<HTMLElement>(".hk-range-ribbon-window")!;
    expect(parseFloat(highlight.style.left), "start still 20%").toBeCloseTo(20, 4);
    expect(parseFloat(highlight.style.width), "width still 40%").toBeCloseTo(40, 4);

    // Dropping the prop hands control to the ribbon's own state, which never
    // mirrored the ignored controlled value: the full domain shows.
    control.value = "uncontrolled";
    await nextTick();
    expect(root.hasAttribute("data-windowed")).toBe(false);
    expect(root.querySelector(".hk-range-ribbon-handle")).toBeNull();
    expect(laneSegments(root)).toHaveLength(4);
  });
});

// ── Domain-aware normalizer ─────────────────────────────────────────────
describe("HkRangeRibbon domain normalizer", () => {
  it("clamps, expands and caps inside the caller's domain", () => {
    // Inverted and out-of-domain windows clamp to the axis.
    const inverted = normalizeHkRangeWindow([1.5, 0.5], 0.02, [0, 2])!;
    expect(inverted[0]).toBeCloseTo(0.5, 10);
    expect(inverted[1]).toBeCloseTo(1.5, 10);
    const clamped = normalizeHkRangeWindow([-1, 3], 0.02, [0, 2])!;
    expect(clamped[0]).toBeCloseTo(0, 10);
    expect(clamped[1]).toBeCloseTo(2, 10);

    // The min width lives in domain units: 0.02 around a point on [0, 2].
    const point = normalizeHkRangeWindow([0.5, 0.5], 0.02, [0, 2])!;
    expect(point[0]).toBeCloseTo(0.49, 10);
    expect(point[1]).toBeCloseTo(0.51, 10);

    // A min width wider than the axis caps at the span instead of escaping
    // the domain.
    const capped = normalizeHkRangeWindow([1, 1], 5, [0, 2])!;
    expect(capped[0]).toBeCloseTo(0, 10);
    expect(capped[1]).toBeCloseTo(2, 10);

    // At the domain edges the expansion shifts inward, never outside.
    const leftEdge = normalizeHkRangeWindow([0, 0], 0.02, [0, 2])!;
    expect(leftEdge[0]).toBeCloseTo(0, 10);
    expect(leftEdge[1]).toBeCloseTo(0.02, 10);
    const rightEdge = normalizeHkRangeWindow([2, 2], 0.02, [0, 2])!;
    expect(rightEdge[0]).toBeCloseTo(1.98, 10);
    expect(rightEdge[1]).toBeCloseTo(2, 10);
  });

  it("treats a malformed domain as the unit axis (two-argument parity)", () => {
    // Hosts calling with two arguments are byte-identical to the old contract.
    expect(normalizeHkRangeWindow([0.2, 0.4])).toEqual([0.2, 0.4]);
    expect(normalizeHkRangeWindow([0.2, 0.4], 0.02)).toEqual([0.2, 0.4]);
    expect(normalizeHkRangeWindow([0.2, 0.4], 0.02, null)).toEqual([0.2, 0.4]);
    expect(normalizeHkRangeWindow([0.2, 0.4], 0.02, "nope" as unknown as number[])).toEqual([
      0.2, 0.4,
    ]);
    // A zero-width domain has no interior: the unit axis takes over.
    expect(normalizeHkRangeWindow([0.2, 0.4], 0.02, [0.5, 0.5])).toEqual([0.2, 0.4]);
    // An inverted domain is sorted, so it behaves like the same ordered pair.
    expect(normalizeHkRangeWindow([0.2, 0.4], 0.02, [1, 0])).toEqual([0.2, 0.4]);
  });
});

// ── Dual-layer waterfall + caller domain axis ───────────────────────────
describe("HkRangeRibbon dual-layer waterfall", () => {
  /** The minimap's x for a fraction on the deprecated headroom ALIAS axis
   *  `[0, 1 + headroom]`, in percent. */
  function axisPercent(fraction: number, headroom: number): number {
    return (fraction / (1 + headroom)) * 100;
  }

  /** The minimap's x of a DOMAIN coordinate / of a domain LENGTH, in percent. */
  function domainPercent(value: number, domain: [number, number]): number {
    return ((value - domain[0]) / (domain[1] - domain[0])) * 100;
  }

  function domainWidthPercent(length: number, domain: [number, number]): number {
    return (length / (domain[1] - domain[0])) * 100;
  }

  /** Inline box assertions at the geometry tolerance. `percent()` rounds to
   *  four decimals OF A PERCENT (~1e-6 fraction), so a four-decimal
   *  `toBeCloseTo` sits exactly on that rounding boundary; 3 keeps a margin
   *  while still pinning well below a percent. */
  function expectBox(
    element: HTMLElement | null,
    expected: { left: number; width: number },
    label: string,
  ): void {
    expect(element, label).toBeTruthy();
    expect(boxOf(element!).left, `${label} left`).toBeCloseTo(expected.left, 3);
    expect(boxOf(element!).width, `${label} width`).toBeCloseTo(expected.width, 3);
  }

  it("marks both layers explicitly and keeps the lane markup intact", () => {
    const root = mountRibbon({ window: [0.35, 0.67] });
    const minimap = root.querySelector<HTMLElement>(".hk-range-ribbon-overview");
    expect(minimap, "the minimap layer renders").toBeTruthy();
    expect(minimap!.getAttribute("data-layer")).toBe("minimap");
    // The strip (brush surface + window chrome host) is the minimap's own.
    expect(minimap!.querySelector(".hk-range-ribbon-strip")).toBeTruthy();
    expect(minimap!.querySelector(".hk-range-ribbon-overview-gutter")).toBeTruthy();
    expect(minimap!.querySelectorAll(".hk-range-ribbon-overview-row")).toHaveLength(2);

    const detail = root.querySelector<HTMLElement>(".hk-range-ribbon-detail");
    expect(detail, "the detail layer renders").toBeTruthy();
    expect(detail!.getAttribute("data-layer")).toBe("detail");
    // The lane list keeps its markup verbatim and lives INSIDE the wrapper.
    const lanes = detail!.querySelector<HTMLElement>(".hk-range-ribbon-lanes");
    expect(lanes, "the lane list is nested in the detail layer").toBeTruthy();
    expect(lanes!.parentElement).toBe(detail);
    expect(detail!.querySelectorAll(".hk-range-ribbon-lane")).toHaveLength(2);
    expect(detail!.querySelectorAll(".hk-range-ribbon-lane-track")).toHaveLength(2);
    // Exactly two layers, in reading order (minimap above detail).
    expect(Array.from(root.children).map((child) => child.getAttribute("data-layer"))).toEqual([
      "minimap",
      "detail",
    ]);
    // Minimal mode stays a bare bar: no detail layer at all.
    expect(mountRibbon({ minimal: true }).querySelector(".hk-range-ribbon-detail")).toBeNull();
  });

  it("keeps the unit axis when no domain is supplied (backward compatible)", () => {
    // Omitting `domain` (and the alias) is exactly [0, 1]: same boxes, same
    // aria bounds as an explicit unit axis.
    const implicit = mountRibbon({ window: [0.2, 0.6] });
    const explicit = mountRibbon({ domain: [0, 1], window: [0.2, 0.6] });
    for (const selector of [
      ".hk-range-ribbon-window",
      '.hk-range-ribbon-scrim[data-side="after"]',
      '.hk-range-ribbon-overview-segment[data-segment-id="write"]',
      '.hk-range-ribbon-lane-track .hk-range-ribbon-segment[data-segment-id="write"]',
    ]) {
      const a = implicit.querySelector<HTMLElement>(selector)!;
      const b = explicit.querySelector<HTMLElement>(selector)!;
      expect(a.style.left, `${selector} left`).toBe(b.style.left);
      expect(a.style.width, `${selector} width`).toBe(b.style.width);
    }
    const strip = implicit.querySelector<HTMLElement>(".hk-range-ribbon-strip")!;
    expect(strip.getAttribute("aria-valuemin")).toBe("0");
    expect(strip.getAttribute("aria-valuemax")).toBe("100");
  });

  it("draws the minimap x as (f - domain[0]) / span across caller axes", () => {
    // Hard anchor first: on [0, 2] half the strip is coordinate 1.0.
    const wide = mountRibbon({ domain: [0, 2], window: [0.5, 1.5] });
    expectBox(
      wide.querySelector<HTMLElement>(".hk-range-ribbon-window"),
      { left: 25, width: 50 },
      "frame [0.5, 1.5] of [0, 2]",
    );
    expectBox(
      wide.querySelector<HTMLElement>('.hk-range-ribbon-overview-segment[data-segment-id="parse"]'),
      { left: 15, width: 7.5 },
      "parse 0.3..0.45 of [0, 2]",
    );
    expectBox(
      wide.querySelector<HTMLElement>('.hk-range-ribbon-scrim[data-side="before"]'),
      { left: 0, width: 25 },
      "before scrim covers the domain before the window",
    );
    expectBox(
      wide.querySelector<HTMLElement>('.hk-range-ribbon-scrim[data-side="after"]'),
      { left: 75, width: 25 },
      "after scrim runs to the domain end",
    );
    expect(
      parseFloat(wide.querySelector<HTMLElement>('.hk-range-ribbon-handle[data-edge="start"]')!.style.left),
    ).toBeCloseTo(25, 3);
    expect(
      parseFloat(wide.querySelector<HTMLElement>('.hk-range-ribbon-handle[data-edge="end"]')!.style.left),
    ).toBeCloseTo(75, 3);

    // Formula sweep over the shapes a caller may declare: negative start,
    // trailing budget and a narrower window of interest. A window at 10%..70%
    // of each axis must land at the same strip percentages.
    const cases: Array<[number, number]> = [
      [-0.1, 1],
      [0.2, 0.8],
      [-0.5, 1.5],
    ];
    for (const domain of cases) {
      const span = domain[1] - domain[0];
      const window: [number, number] = [domain[0] + 0.1 * span, domain[0] + 0.7 * span];
      const root = mountRibbon({ domain, window });
      expectBox(
        root.querySelector<HTMLElement>(".hk-range-ribbon-window"),
        { left: 10, width: 60 },
        `${domain} frame is 10%..70% of the axis`,
      );
      expectBox(
        root.querySelector<HTMLElement>('.hk-range-ribbon-scrim[data-side="before"]'),
        { left: 0, width: 10 },
        `${domain} before scrim`,
      );
      expectBox(
        root.querySelector<HTMLElement>('.hk-range-ribbon-scrim[data-side="after"]'),
        { left: 70, width: 30 },
        `${domain} after scrim reaches the axis end`,
      );
      expect(
        parseFloat(
          root.querySelector<HTMLElement>('.hk-range-ribbon-handle[data-edge="start"]')!.style.left,
        ),
        `${domain} start grip`,
      ).toBeCloseTo(10, 3);
      expect(
        parseFloat(
          root.querySelector<HTMLElement>('.hk-range-ribbon-handle[data-edge="end"]')!.style.left,
        ),
        `${domain} end grip`,
      ).toBeCloseTo(70, 3);
    }
  });

  it("maps the detail track to the selected WINDOW in domain coordinates", () => {
    // Domain [0, 2], window [0.5, 1.5]: the detail is 0..100% of that window,
    // so a bar starting at coordinate 1.0 lands halfway.
    const segments: RibbonSegment[] = [
      { id: "lead", lane: "cpu", start: 0.5, end: 0.9, label: "lead" },
      { id: "mid", lane: "cpu", start: 1, end: 1.2, label: "mid" },
      { id: "tail", lane: "cpu", start: 1.4, end: 1.8, label: "tail" },
    ];
    const root = mountRibbon({ domain: [0, 2], window: [0.5, 1.5], segments });
    expectBox(segmentById(root, "lead"), { left: 0, width: 40 }, "lead 0.5..0.9");
    expectBox(segmentById(root, "mid"), { left: 50, width: 20 }, "a bar at 1.0 starts halfway");
    expectBox(segmentById(root, "tail"), { left: 90, width: 10 }, "tail clipped at the window end");

    // The same window on a negative-start axis keeps its relative mapping:
    // [-0.1, 1] with window [0.2, 0.6] puts parse (0.3..0.45) at 25%..62.5%.
    const negative = mountRibbon({ domain: [-0.1, 1], window: [0.2, 0.6] });
    expectBox(segmentById(negative, "parse"), { left: 25, width: 37.5 }, "parse inside a negative axis");
  });

  it("paints the no-window detail on the domain axis (the full view)", () => {
    // With no window the detail IS the full view, so its axis is the domain:
    // on [0, 2] a segment at 0.3..0.45 lands at 15%..22.5%, and the minimap
    // twin agrees — the full-domain view is where the two layers line up.
    const root = mountRibbon({ window: null, domain: [0, 2] });
    const parse = segmentById(root, "parse")!;
    expect(boxOf(parse).left, "0.3 on a [0, 2] axis").toBeCloseTo(15, 3);
    expect(boxOf(parse).width).toBeCloseTo(7.5, 3);
    const overview = root.querySelector<HTMLElement>(
      '.hk-range-ribbon-overview-segment[data-segment-id="parse"]',
    )!;
    expect(boxOf(overview).left, "both layers share the domain axis").toBeCloseTo(
      boxOf(parse).left,
      3,
    );
    expect(boxOf(overview).width).toBeCloseTo(boxOf(parse).width, 3);

    // The deprecated alias drives the no-window detail the same way: it IS a
    // domain, not a minimap-only tail.
    const alias = mountRibbon({ window: null, headroom: 0.1 });
    expect(boxOf(segmentById(alias, "parse")!).left).toBeCloseTo(axisPercent(0.3, 0.1), 3);
  });

  it("maps the same absolute fraction onto the alias minimap and the window-relative detail", () => {
    // parse covers 30%..45% of the alias axis [0, 1.1]; the window is
    // 35%..67% of that same axis.
    const root = mountRibbon({ window: [0.35, 0.67], headroom: 0.1 });
    expectBox(
      root.querySelector<HTMLElement>('.hk-range-ribbon-overview-segment[data-segment-id="parse"]'),
      { left: axisPercent(0.3, 0.1), width: axisPercent(0.15, 0.1) },
      "alias minimap parse",
    );

    // The detail ignores the axis entirely and re-normalizes the window to
    // its own 0..100% track.
    const parseDetail = segmentById(root, "parse")!;
    expect(boxOf(parseDetail).left, "detail starts at the window start").toBeCloseTo(0, 3);
    expect(boxOf(parseDetail).width, "detail width is window-relative").toBeCloseTo(
      ((0.45 - 0.35) / (0.67 - 0.35)) * 100,
      3,
    );
    const writeDetail = segmentById(root, "write")!;
    expect(
      boxOf(writeDetail).left + boxOf(writeDetail).width,
      "detail ends at the window end",
    ).toBeCloseTo(100, 3);

    // A detail box under the alias is byte-identical to its box with no
    // alias at all — the window, not the axis, is the detail's unit.
    const noAlias = mountRibbon({ window: [0.35, 0.67] });
    expect(boxOf(segmentById(root, "write")!)).toEqual(boxOf(segmentById(noAlias, "write")!));
    // …while the window frame is axis-projected on the minimap.
    expectBox(
      root.querySelector<HTMLElement>(".hk-range-ribbon-window"),
      { left: axisPercent(0.35, 0.1), width: axisPercent(0.32, 0.1) },
      "alias frame",
    );
  });

  it("dims the unselected alias axis all the way to its end", () => {
    // window [0.2, 1]: content 100% is selected, so the whole 1.0..1.1 end of
    // the alias axis is unselected and must stay dimmed.
    const root = mountRibbon({ window: [0.2, 1], headroom: 0.1 });
    expectBox(
      root.querySelector<HTMLElement>('.hk-range-ribbon-scrim[data-side="before"]'),
      { left: 0, width: axisPercent(0.2, 0.1) },
      "before scrim",
    );
    const after = root.querySelector<HTMLElement>('.hk-range-ribbon-scrim[data-side="after"]')!;
    expect(boxOf(after).left, "after scrim starts at content 100%").toBeCloseTo(90.9091, 3);
    expect(boxOf(after).width, "after scrim covers to the alias end").toBeCloseTo(9.0909, 3);
    expect(
      boxOf(after).left + boxOf(after).width,
      "the scrim reaches the axis end",
    ).toBeCloseTo(100, 3);

    expectBox(
      root.querySelector<HTMLElement>(".hk-range-ribbon-window"),
      { left: axisPercent(0.2, 0.1), width: axisPercent(0.8, 0.1) },
      "alias frame",
    );
    const start = root.querySelector<HTMLElement>('.hk-range-ribbon-handle[data-edge="start"]')!;
    const end = root.querySelector<HTMLElement>('.hk-range-ribbon-handle[data-edge="end"]')!;
    expect(parseFloat(start.style.left)).toBeCloseTo(axisPercent(0.2, 0.1), 3);
    expect(parseFloat(end.style.left)).toBeCloseTo(axisPercent(1, 0.1), 3);
    // The a11y readings are coordinates, not axis percentages.
    expect(end.getAttribute("aria-valuenow")).toBe("100");
    expect(end.getAttribute("aria-valuetext")).toBe("100%");
    expect(
      root.querySelector<HTMLElement>(".hk-range-ribbon-strip")!.getAttribute("aria-valuetext"),
    ).toBe("20% – 100%");
  });

  it("sanitizes the deprecated headroom alias into a real axis", () => {
    const cases: Array<[number, number]> = [
      [0, 1],
      [-0.5, 1],
      [Number.NaN, 1],
      [Number.NEGATIVE_INFINITY, 1],
      [Number.POSITIVE_INFINITY, 1],
      [2, 2],
    ];
    for (const [headroom, span] of cases) {
      const root = mountRibbon({ window: null, headroom });
      const parse = root.querySelector<HTMLElement>(
        '.hk-range-ribbon-overview-segment[data-segment-id="parse"]',
      )!;
      expect(parse, `headroom ${headroom} still paints`).toBeTruthy();
      expect(boxOf(parse).left, `headroom ${headroom} maps through span ${span}`).toBeCloseTo(
        (0.3 / span) * 100,
        3,
      );
    }
  });

  it("treats headroom as the [0, 1 + headroom] alias, and a domain wins over it", () => {
    // Equivalence: the alias and its explicit domain draw the same geometry.
    const alias = mountRibbon({ headroom: 0.1, window: [0.2, 0.6] });
    const explicit = mountRibbon({ domain: [0, 1.1], window: [0.2, 0.6] });
    const compared: Array<{ selector: string; width: boolean }> = [
      { selector: ".hk-range-ribbon-window", width: true },
      { selector: '.hk-range-ribbon-scrim[data-side="before"]', width: true },
      { selector: '.hk-range-ribbon-scrim[data-side="after"]', width: true },
      { selector: '.hk-range-ribbon-handle[data-edge="start"]', width: false },
      { selector: '.hk-range-ribbon-handle[data-edge="end"]', width: false },
      { selector: '.hk-range-ribbon-overview-segment[data-segment-id="parse"]', width: true },
    ];
    for (const { selector, width } of compared) {
      const fromAlias = alias.querySelector<HTMLElement>(selector)!;
      const fromDomain = explicit.querySelector<HTMLElement>(selector)!;
      expect(parseFloat(fromAlias.style.left), `${selector} left`).toBeCloseTo(
        parseFloat(fromDomain.style.left),
        10,
      );
      if (width) {
        expect(parseFloat(fromAlias.style.width), `${selector} width`).toBeCloseTo(
          parseFloat(fromDomain.style.width),
          10,
        );
      }
    }
    // The alias announces its own end (110%), never the unit axis.
    expect(
      alias.querySelector<HTMLElement>(".hk-range-ribbon-strip")!.getAttribute("aria-valuemax"),
    ).toBe("110");

    // A valid `domain` wins over a supplied headroom.
    const both = mountRibbon({ domain: [0, 2], headroom: 0.1 });
    expect(
      boxOf(
        both.querySelector<HTMLElement>(
          '.hk-range-ribbon-overview-segment[data-segment-id="parse"]',
        )!,
      ).left,
      "domain [0, 2] wins: parse at 15%",
    ).toBeCloseTo(15, 3);
    expect(
      both.querySelector<HTMLElement>(".hk-range-ribbon-strip")!.getAttribute("aria-valuemax"),
    ).toBe("200");
  });

  it("treats the headroom alias as a real axis: selectable tail, axis-end rest state", async () => {
    // The deprecated `headroom` alias is SOURCE-compatible with the old prop,
    // not behaviour-compatible: [0, 1.1] is the coordinate system, so the old
    // "padding, not selectable progress" tail is gone. This case pins the
    // deltas a headroom host would observe.
    const host = mountHost([0, 1], { headroom: 0.1 });
    const root = host.root;
    // [0, 1] is a SUB-view of a [0, 1.1] axis, so there IS something to reset
    // (the old component treated content 100% as the rest state).
    expect(
      root.querySelector(".hk-range-ribbon-reset"),
      "a sub-view of the alias axis has a reset chip",
    ).toBeTruthy();
    keydown(root, "Escape");
    await nextTick();
    expect(lastWindow(host.windowChange), "Escape clears to the full axis").toBeNull();

    // The tail is selectable axis: a press at strip 95% reads 1.045 (the old
    // component clamped it to content 1.0).
    const { strip, x } = stubStrip(root);
    await drag(strip, 0.95, 0.5, x);
    expectWindow(lastWindow(host.windowChange), 0.55, 1.045);

    // Shift+ArrowLeft from the full axis contracts it by 5% of the SPAN
    // (0.055), not the unit axis's 0.05.
    keydown(root, "Escape");
    await nextTick();
    expect(lastWindow(host.windowChange), "back on the full axis").toBeNull();
    keydown(root.querySelector<HTMLElement>(".hk-range-ribbon-strip")!, "ArrowLeft", {
      shiftKey: true,
    });
    await nextTick();
    expectWindow(lastWindow(host.windowChange), 0, 1.045);
  });

  it("caps minWindow at the axis span when the domain is narrower", () => {
    // A 0.01 span cannot honour the default 0.02 floor, so the component caps
    // the floor at the span. The cap is visible in the handle bounds: an
    // uncapped 0.02 floor would announce 49% / 52% instead of 50% / 51%.
    const root = mountRibbon({ domain: [0.5, 0.51], window: [0.505, 0.505] });
    expectBox(
      root.querySelector<HTMLElement>(".hk-range-ribbon-window"),
      { left: 0, width: 100 },
      "a point expands to the whole narrow axis",
    );
    expect(
      root.querySelector<HTMLElement>('[data-edge="start"]')!.getAttribute("aria-valuemax"),
      "the floor is the span, not the 0.02 default",
    ).toBe("50");
    expect(
      root.querySelector<HTMLElement>('[data-edge="end"]')!.getAttribute("aria-valuemin"),
      "end floor = start + the capped min",
    ).toBe("51");
  });

  it("maps pointer input onto the domain and clamps to its edges", async () => {
    // Domain [0, 2]: half the strip is coordinate 1.0, so a brush from axis
    // 50% to the far right is [1, 2]. A read that ignored the domain would
    // answer [0.5, 1].
    const wide = mountHost(null, { domain: [0, 2] });
    const wideStrip = stubStrip(wide.root);
    await drag(wideStrip.strip, 0.5, 1, wideStrip.x);
    expectWindow(lastWindow(wide.windowChange), 1, 2);

    // Negative start, [-0.1, 1]: axis 50% is coordinate 0.45, and a press
    // past the right edge still clamps to the domain end 1.
    const negative = mountHost(null, { domain: [-0.1, 1] });
    const neg = stubStrip(negative.root);
    await drag(neg.strip, 0.5, 1.25, neg.x);
    expectWindow(lastWindow(negative.windowChange), 0.45, 1);

    // The handle path reads the same axis: with domain [0, 2] the end grip
    // dragged to axis 95% is coordinate 1.9 (a read that ignored the domain
    // would leave the window at 0.95).
    await wide.setWindow([0.5, 1.5]);
    const end = wide.root.querySelector<HTMLElement>('.hk-range-ribbon-handle[data-edge="end"]')!;
    expect(end, "the end grip renders for the sub-window").toBeTruthy();
    await drag(end, 0.75, 0.95, wideStrip.x);
    expectWindow(lastWindow(wide.windowChange), 0.5, 1.9);
  });

  it("reads labels and ARIA in domain units (negative and above 100%)", () => {
    // Negative start: the full view announces its own axis, not 0%..100%.
    const negative = mountRibbon({ domain: [-0.1, 0.5] });
    const strip = negative.querySelector<HTMLElement>(".hk-range-ribbon-strip")!;
    expect(strip.getAttribute("aria-valuemin")).toBe("-10");
    expect(strip.getAttribute("aria-valuemax")).toBe("50");
    expect(strip.getAttribute("aria-valuenow"), "full view = domain start").toBe("-10");
    expect(strip.getAttribute("aria-valuetext")).toBe("-10% – 50%");

    // A window that itself starts below zero keeps its sign on both the strip
    // and the start grip.
    const windowed = mountRibbon({ domain: [-0.1, 1], window: [-0.05, 0.4] });
    const windowedStrip = windowed.querySelector<HTMLElement>(".hk-range-ribbon-strip")!;
    expect(windowedStrip.getAttribute("aria-valuenow")).toBe("-5");
    expect(windowedStrip.getAttribute("aria-valuetext")).toBe("-5% – 40%");
    expect(
      windowed
        .querySelector<HTMLElement>('.hk-range-ribbon-handle[data-edge="start"]')!
        .getAttribute("aria-valuetext"),
    ).toBe("-5%");

    // Above 100%: a 200% budget reads as 0..200, and a window ending at 150%
    // announces 150 rather than a rescaled 75.
    const wide = mountRibbon({ domain: [0, 2], window: [0.5, 1.5] });
    const wideStrip = wide.querySelector<HTMLElement>(".hk-range-ribbon-strip")!;
    expect(wideStrip.getAttribute("aria-valuemin")).toBe("0");
    expect(wideStrip.getAttribute("aria-valuemax")).toBe("200");
    expect(wideStrip.getAttribute("aria-valuetext")).toBe("50% – 150%");
    const wideEnd = wide.querySelector<HTMLElement>('.hk-range-ribbon-handle[data-edge="end"]')!;
    expect(wideEnd.getAttribute("aria-valuenow")).toBe("150");
    expect(wideEnd.getAttribute("aria-valuetext")).toBe("150%");
    expect(wideEnd.getAttribute("aria-valuemax")).toBe("200");
  });

  it("sanitizes the domain: inverted sorts, unusable values fall back to [0, 1]", () => {
    // An inverted pair is a caller typo, not a different axis: it is sorted.
    const inverted = mountRibbon({ domain: [0.6, 0.2] });
    expect(
      boxOf(
        inverted.querySelector<HTMLElement>(
          '.hk-range-ribbon-overview-segment[data-segment-id="parse"]',
        )!,
      ).left,
      "parse 0.3 on the sorted [0.2, 0.6] axis",
    ).toBeCloseTo(25, 3);

    const unusable: unknown[] = [
      [0.5, 0.5],
      [Number.NaN, 1],
      [0.2],
      [],
      null,
      [0.2, Number.POSITIVE_INFINITY],
    ];
    for (const domain of unusable) {
      const root = mountRibbon({ domain });
      const strip = root.querySelector<HTMLElement>(".hk-range-ribbon-strip")!;
      expect(strip.getAttribute("aria-valuemax"), `${JSON.stringify(domain)} falls back`).toBe(
        "100",
      );
      expect(
        boxOf(
          root.querySelector<HTMLElement>(
            '.hk-range-ribbon-overview-segment[data-segment-id="parse"]',
          )!,
        ).left,
      ).toBeCloseTo(30, 3);
    }
  });

  it("clips overview segments to the domain and drops points outside it", () => {
    // Domain [0.2, 0.8]: boot ends exactly at the domain start and flush
    // starts past its end, so neither paints. An explicit segment list is
    // needed here: the shared fixture straddles the axis differently.
    const segments: RibbonSegment[] = [
      { id: "boot", lane: "cpu", start: 0.05, end: 0.2, label: "boot" },
      { id: "write", lane: "io", start: 0.5, end: 0.9, label: "write" },
      { id: "flush", lane: "io", start: 0.95, end: 1, label: "flush" },
      { id: "edge", lane: "cpu", start: 0.2, end: 0.2, label: "edge" },
      { id: "gone", lane: "cpu", start: 0.9, end: 0.9, label: "gone" },
    ];
    const root = mountRibbon({ window: null, domain: [0.2, 0.8], segments });
    expect(root.querySelector('[data-segment-id="boot"]'), "ends at the domain start").toBeNull();
    expect(root.querySelector('[data-segment-id="flush"]'), "starts past the domain end").toBeNull();
    // A zero-length point ON the domain start is kept as a tick; one past the
    // domain end is gone (the domain is the clipping rule, not a clamp).
    expect(
      root.querySelector('.hk-range-ribbon-overview-segment[data-segment-id="edge"]'),
      "a point on the domain edge paints",
    ).toBeTruthy();
    expect(root.querySelector('[data-segment-id="gone"]'), "a point outside is gone").toBeNull();
    // A bar straddling the domain end is clipped, not rescaled away.
    expectBox(
      root.querySelector<HTMLElement>(
        '.hk-range-ribbon-overview-segment[data-segment-id="write"]',
      ),
      { left: 50, width: 50 },
      "write clipped at the domain end",
    );
  });

  it("treats a window covering the whole domain as the unfiltered state", () => {
    // The reset chip keys off the DOMAIN: [0, 2] on a [0, 2] axis is the rest
    // state (nothing to reset), while [0, 1] is a real sub-selection.
    const full = mountRibbon({ domain: [0, 2], window: [0, 2] });
    expect(
      full.querySelector(".hk-range-ribbon-reset"),
      "the whole axis selected = nothing to reset",
    ).toBeNull();
    const sub = mountRibbon({ domain: [0, 2], window: [0, 1] });
    expect(sub.querySelector(".hk-range-ribbon-reset"), "a sub-window shows reset").toBeTruthy();
  });

  it("nudges the window by 5% of the visible span from the keyboard", async () => {
    // Domain [0, 2]: one arrow moves the window 0.1 (5% of the span), not the
    // unit axis's 0.05, so the visual step stays 5% of the strip.
    const host = mountHost([0.5, 1], { domain: [0, 2] });
    const strip = host.root.querySelector<HTMLElement>(".hk-range-ribbon-strip")!;
    keydown(strip, "ArrowRight");
    await nextTick();
    expectWindow(lastWindow(host.windowChange), 0.6, 1.1);
    // Shift+Arrow resizes from the trailing edge by the same step.
    keydown(strip, "ArrowRight", { shiftKey: true });
    await nextTick();
    expectWindow(lastWindow(host.windowChange), 0.6, 1.2);
    // The handle slider nudges its own edge by the same step.
    const start = host.root.querySelector<HTMLElement>('.hk-range-ribbon-handle[data-edge="start"]')!;
    keydown(start, "ArrowRight");
    await nextTick();
    expectWindow(lastWindow(host.windowChange), 0.7, 1.2);
  });

  it("keeps the keyboard range entry inside the caller's domain", async () => {
    // Shift+ArrowLeft on the full view opens a window from the domain start,
    // stopped at `max(d0 + minWindow, d1 - step)` — a COORDINATE floor. The
    // bare-width version went dead on axes whose end sits below minWindow
    // and emitted sub-minimum windows on tight axes.
    const open = async (domain: [number, number]): Promise<[number, number] | null> => {
      const host = mountHost(null, { domain });
      keydown(host.root.querySelector<HTMLElement>(".hk-range-ribbon-strip")!, "ArrowLeft", {
        shiftKey: true,
      });
      await nextTick();
      return host.windowChange.mock.calls.length === 0 ? null : lastWindow(host.windowChange);
    };

    // (a) An axis whose END is below the 0.02 floor: the entry must still
    // work (the old floor exceeded the domain end and returned early).
    expectWindow(await open([-1, 0]), -1, -0.05);
    // (b) A tight axis: the emitted width may never sit below minWindow (the
    // bare-width floor emitted 0.01995 against a 0.02 floor).
    const tight = await open([0.5, 0.521]);
    expectWindow(tight, 0.5, 0.52);
    expect(tight![1] - tight![0], "never narrower than minWindow").toBeGreaterThanOrEqual(0.02);
    // (c) The floor anchors at d0 + minWindow (-0.45), not at absolute 0.02.
    expectWindow(await open([-0.47, 0.03]), -0.47, 0.005);
  });

  it("keeps a live brush inside a domain that changed mid-gesture", async () => {
    // The anchor is captured at pointerdown. If the host narrows the axis
    // while the pointer is down, the anchor must be re-clamped before the
    // window is built — otherwise the committed window escapes the new axis.
    const container = document.createElement("div");
    document.body.appendChild(container);
    const liveDomain = ref<[number, number]>([0, 1]);
    const win = ref<[number, number] | null>(null);
    const windowChange = vi.fn();
    const Wrapper = defineComponent({
      setup() {
        return () =>
          h(HkRangeRibbon, {
            lanes: LANES,
            segments: SEGMENTS,
            domain: liveDomain.value,
            window: win.value,
            onWindowChange: (next: [number, number] | null) => {
              windowChange(next);
              win.value = next;
            },
          });
      },
    });
    const app = createApp(Wrapper);
    app.mount(container);
    mounts.push({ app, container });
    const root = container.querySelector<HTMLElement>(".hk-range-ribbon")!;
    const { strip, x } = stubStrip(root);

    // Press at 95% of the unit axis, then narrow the axis to [0, 0.5].
    pointer("pointerdown", x(0.95), strip);
    liveDomain.value = [0, 0.5];
    await nextTick();
    // Moving to half of the NEW axis must build [0.25, 0.5] (a stale 0.95
    // anchor would have built [0.25, 0.95], outside the new axis).
    pointer("pointermove", x(0.5), strip);
    pointer("pointerup", x(0.5), strip);
    await nextTick();
    expectWindow(lastWindow(windowChange), 0.25, 0.5);
  });

  it("draws the caller's domain on minimal mode's bare bar", async () => {
    // Minimal mode suppresses the minimap lane rows and the whole detail
    // layer; the bare bar still lives in the overview container, and its axis
    // is the caller's domain.
    const rest = mountRibbon({ minimal: true, domain: [0, 2], window: [0, 2] });
    const restStart = rest.querySelector<HTMLElement>('.hk-range-ribbon-handle[data-edge="start"]')!;
    const restEnd = rest.querySelector<HTMLElement>('.hk-range-ribbon-handle[data-edge="end"]')!;
    expect(parseFloat(restStart.style.left), "domain start grip").toBeCloseTo(0, 3);
    expect(parseFloat(restEnd.style.left), "domain end grip").toBeCloseTo(100, 3);
    expect(restStart.getAttribute("aria-valuetext"), "labels read domain percents").toBe("0%");
    expect(restEnd.getAttribute("aria-valuetext")).toBe("200%");

    // A sub-window is projected by the domain: [0.5, 1.5] of [0, 2] is
    // 25%..75%, and the scrims cover the domain the caller did not select.
    const sub = mountRibbon({ minimal: true, domain: [0, 2], window: [0.5, 1.5] });
    expect(
      parseFloat(
        sub.querySelector<HTMLElement>('.hk-range-ribbon-handle[data-edge="start"]')!.style.left,
      ),
    ).toBeCloseTo(25, 3);
    expect(
      parseFloat(
        sub.querySelector<HTMLElement>('.hk-range-ribbon-handle[data-edge="end"]')!.style.left,
      ),
    ).toBeCloseTo(75, 3);
    expectBox(
      sub.querySelector<HTMLElement>('.hk-range-ribbon-scrim[data-side="before"]'),
      { left: 0, width: 25 },
      "before scrim",
    );
    expectBox(
      sub.querySelector<HTMLElement>('.hk-range-ribbon-scrim[data-side="after"]'),
      { left: 75, width: 25 },
      "after scrim",
    );

    // The pointer maps onto the same domain: axis 50% is coordinate 1.0, and
    // a press past the right edge clamps to the domain end 2.0.
    const host = mountHost([0.5, 1.5], { minimal: true, domain: [0, 2] });
    const { strip, x } = stubStrip(host.root);
    await drag(strip, 0.5, 1.4, x);
    expectWindow(lastWindow(host.windowChange), 1, 2);
  });
});

// ── Stylesheet contract ─────────────────────────────────────────────────
const componentDir = dirname(fileURLToPath(import.meta.url));

/** Body of one compiled rule, by exact selector (Sass drops quotes around
 *  attribute values: `[data-status=pending]`). */
function ruleBody(sheet: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matches = [
    ...sheet.matchAll(
      new RegExp(`(?:(?<=^)|(?<=[}{])|(?<=\\*/))\\s*${escaped}\\s*\\{([^}]*)\\}`, "g"),
    ),
  ];
  expect(matches, `${selector} compiles exactly once`).toHaveLength(1);
  return matches[0]?.[1] ?? "";
}

function declaration(body: string, property: string): string {
  const values = [...body.matchAll(new RegExp(`(?:^|;)\\s*${property}\\s*:([^;]*)`, "g"))].map(
    (match) => match[1]!.trim(),
  );
  expect(values.length, `${property} is declared at most once`).toBeLessThanOrEqual(1);
  return values[0] ?? "";
}

describe("HkRangeRibbon stylesheet contract", () => {
  const tsx = readFileSync(resolve(componentDir, "HkRangeRibbon.tsx"), "utf8");
  const scss = readFileSync(resolve(componentDir, "HkRangeRibbon.scss"), "utf8");
  const css = compile(resolve(componentDir, "HkRangeRibbon.scss"), { style: "expanded" }).css;

  it("compiles without dangling rules", () => {
    expect(css).toContain(".hk-range-ribbon-strip");
  });

  it("gives every class the component emits a rule, and carries no dead class", () => {
    const inTsx = new Set<string>();
    for (const match of tsx.matchAll(/class="([^"]*)"/g)) {
      for (const token of match[1].split(/\s+/)) {
        if (token) inTsx.add(token);
      }
    }
    const inCss = new Set(
      Array.from(css.matchAll(/\.(hk-range-ribbon[\w-]*)/g)).map((match) => match[1]!),
    );
    expect([...inTsx].sort(), "every emitted class is styled").toEqual([...inCss].sort());
    // The scan must not go vacuous.
    expect(inTsx.size).toBeGreaterThan(15);
  });

  it("speaks hikari's own class namespace only (no host utility dialect)", () => {
    for (const match of tsx.matchAll(/class="([^"]*)"/g)) {
      for (const token of match[1].split(/\s+/)) {
        if (!token) continue;
        expect(token, `class token "${token}" must be hikari-owned`).toMatch(/^hk-/);
      }
    }
  });

  it("styles from hikari theme tokens instead of hard-coded values", () => {
    expect(scss).toContain("var(--color-");
    expect(scss).toContain("var(--space-");
    expect(scss).toContain("var(--text-");
    expect(scss).toContain("var(--radius-");
    expect(scss, "no raw hex colours").not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it("pins the overview strip, handle and segment geometry", () => {
    const strip = ruleBody(css, ".hk-range-ribbon-strip");
    expect(declaration(strip, "height"), "overview strip height").toBe("32px");
    expect(strip).toContain("touch-action: none");
    expect(declaration(strip, "cursor")).toBe("crosshair");

    const handle = ruleBody(css, ".hk-range-ribbon-handle");
    expect(declaration(handle, "width"), "handle grip width").toBe("8px");
    expect(declaration(handle, "transform"), "handle centers on its edge").toBe(
      "translateX(-50%)",
    );
    expect(declaration(handle, "cursor")).toBe("ew-resize");
    expect(handle).toContain("touch-action: none");
    // Require the UNPREFIXED declaration at a declaration boundary: the old
    // /user-select:\s*none/ also matched "-webkit-user-select: none", so a
    // hypothetical polyfill that emitted only the prefixed property would
    // satisfy the pin while the standard property was gone.
    expect(handle, "a handle drag cannot start a text selection").toMatch(
      /(?:^|[;{])\s*user-select\s*:\s*none/,
    );

    // A clipped 2px sliver must still be visible.
    expect(declaration(ruleBody(css, ".hk-range-ribbon-segment"), "min-width")).toBe("2px");
    expect(declaration(ruleBody(css, ".hk-range-ribbon-lane-track"), "height")).toBe("20px");
    // The reset seat clears the edge handle (half its 8px width). The rule
    // must sit on the descendant key (0,2,0): `.hk-icon-button` declares
    // `position: relative` at (0,1,0), so a bare-class seat would depend on
    // bundle order.
    const resetSeat = ruleBody(css, ".hk-range-ribbon .hk-range-ribbon-reset");
    expect(declaration(resetSeat, "right")).toBe("4px");
    expect(declaration(resetSeat, "position"), "the seat must out-rank .hk-icon-button").toBe(
      "absolute",
    );
    expect(declaration(resetSeat, "top"), "the seat clears the strip edge").toBe("4px");
    // The grip must paint ABOVE the seat: a right-side window puts its end
    // handle inside the seat's box, and an opaque seat below it would make
    // the grip unreachable by pointer.
    const gripZ = Number(declaration(ruleBody(css, ".hk-range-ribbon-handle"), "z-index"));
    const seatZ = Number(declaration(resetSeat, "z-index"));
    expect(gripZ, "the edge grip outranks the reset seat").toBeGreaterThan(seatZ);
    // The surface backing is what keeps the control legible over the strip's
    // segments and scrims: ghost carries NO background (HkIconButtonVars),
    // so without these three the reset degrades to a bare glyph floating on
    // the paint. Removing them alone left the whole suite green (R3 M5b) —
    // pin the paint, not just the geometry.
    expect(declaration(resetSeat, "--hi-icon-button-bg"), "resting surface tint").toContain(
      "var(--color-surface)",
    );
    expect(declaration(resetSeat, "--hi-icon-button-bg-hover"), "hover surface tint").toContain(
      "var(--color-surface)",
    );
    expect(declaration(resetSeat, "--hi-icon-button-bg-active"), "press surface tint").toContain(
      "var(--color-surface)",
    );
    expect(ruleBody(css, ".hk-range-ribbon-window")).toContain("var(--color-primary)");
    expect(ruleBody(css, ".hk-range-ribbon-scrim")).toContain("var(--color-background)");
  });

  it("pins the pending pulse and its reduced-motion off-switch", () => {
    expect(css).toContain("@keyframes hk-range-ribbon-pulse");
    // The ground rule (the reduced-motion override legitimately repeats the
    // same selector, so this is matched by shape rather than by uniqueness).
    expect(css).toMatch(
      /\.hk-range-ribbon-segment\[data-status=pending\]\s*\{[^}]*border-style: dashed[^}]*animation: hk-range-ribbon-pulse[^}]*\}/,
    );
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.hk-range-ribbon-segment\[data-status=pending\][\s\S]*?animation: none/,
    );
  });

  it("shares one label column between the overview and the lanes", () => {
    expect(
      declaration(ruleBody(css, ".hk-range-ribbon"), "--hk-range-ribbon-label-col"),
      "the root declares the shared fallback column (JS publishes the measured px on top)",
    ).toBe("minmax(48px, 84px)");
    const overviewColumns = declaration(
      ruleBody(css, ".hk-range-ribbon-overview"),
      "grid-template-columns",
    );
    const laneColumns = declaration(ruleBody(css, ".hk-range-ribbon-lane"), "grid-template-columns");
    expect(overviewColumns, "the overview opts into the shared column").toContain(
      "var(--hk-range-ribbon-label-col)",
    );
    expect(overviewColumns, "both surfaces use the same tracks").toBe(laneColumns);
    // The strip's own box is the coordinate space for handle percentages.
    expect(ruleBody(css, ".hk-range-ribbon-overview-field")).toContain("position: relative");
    expect(css).toContain(".hk-range-ribbon-overview-gutter");
  });

  it("makes the detail layer a plain column container for the lane list", () => {
    const detail = ruleBody(css, ".hk-range-ribbon-detail");
    expect(declaration(detail, "display")).toBe("flex");
    expect(declaration(detail, "flex-direction"), "the lane list keeps its own column").toBe(
      "column",
    );
    // The wrapper adds no rhythm of its own: the lanes keep their gap.
    expect(detail, "the wrapper owns no gap").not.toContain("gap:");
    expect(declaration(ruleBody(css, ".hk-range-ribbon-lanes"), "gap")).toBe("var(--space-2)");
  });

  it("anchors the tip inward at the track edges", () => {
    const tip = ruleBody(css, ".hk-range-ribbon-tip");
    expect(declaration(tip, "text-align")).toBe("start");
    expect(declaration(tip, "transform"), "centered by default").toBe("translateX(-50%)");
    const startAnchor = ruleBody(css, ".hk-range-ribbon-tip[data-anchor=start]");
    expect(declaration(startAnchor, "left")).toBe("0");
    expect(declaration(startAnchor, "transform")).toBe("none");
    const endAnchor = ruleBody(css, ".hk-range-ribbon-tip[data-anchor=end]");
    expect(declaration(endAnchor, "left")).toBe("auto");
    expect(declaration(endAnchor, "right")).toBe("0");
    expect(declaration(endAnchor, "transform")).toBe("none");
  });

  // Wave (2026-11-06 raw-records five): MINIMAL MODE - the bare dual-handle
  // bar. Contract: data-minimal on the root, strip present, no lane rows and
  // no detail layer (the bar still lives in the overview container); the
  // shared label gutter is still rendered and only display:none in this mode
  // (the strip spans the full width). The standard mode keeps its lane chrome
  // + alignment probe. The uncontrolled default window is NULL here — the
  // grips need a controlled non-null window; the aria readings below come
  // from the strip's null-window fallbacks, not from a real window.
  it("minimal mode renders the bare dual-handle bar (no lane chrome)", () => {
    const root = mountRibbon({ minimal: true });
    expect(root.getAttribute("data-minimal")).toBe("true");
    const stripEl = root.querySelector(".hk-range-ribbon-strip")!;
    expect(stripEl).not.toBeNull();
    // The strip carries the slider a11y (role/tabindex/label/valuenow).
    expect(stripEl.getAttribute("aria-label")).toBe("Observation range");
    // No window ⇒ the strip's aria falls back to the full range ("0" /
    // "0% – 100%"): a truthful reading for an unfiltered bar, even though
    // no grips paint without a controlled window.
    expect(stripEl.getAttribute("aria-valuenow")).toBe("0");
    expect(stripEl.getAttribute("aria-valuetext")).toContain("0%");
    // The lanes BLOCK is skipped entirely (no lane rows at all).
    expect(root.querySelector(".hk-range-ribbon-lanes")).toBeNull();
    expect(root.querySelector(".hk-range-ribbon-lane")).toBeNull();
    // The overview minimap container shells remain but render EMPTY, and
    // the gutter probe is display:none (visibility is the semantic).
    const minimap = root.querySelector(".hk-range-ribbon-overview-lanes");
    expect(minimap!.children.length).toBe(0);
    // (The gutter probe's display:none in minimal mode is enforced by the
    //  static scss assertion at the end of this file — happy-dom cannot
    //  resolve the nested attribute selector.)
    expect(root.querySelector(".hk-range-ribbon-overview-segment")).toBeNull();
    // Standard consumers keep the lane chrome + the alignment probe.
    const std = mountRibbon({});
    expect(std.querySelector(".hk-range-ribbon-lane")).not.toBeNull();
    expect(std.querySelector(".hk-range-ribbon-overview-gutter")).not.toBeNull();
    // Default LANES vocabulary (cpu/boot/parse/io/write/flush).
    expect(std.textContent).toContain("CPU");
  });

  // Static scss contract: in minimal mode the gutter probe is display:none
  // and the overview collapses to a single column (the strip spans the
  // full width).
  it("minimal mode overrides the overview grid in the sheet", () => {
    const scss = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "HkRangeRibbon.scss"), "utf-8");
    // The nested scss compiles to a single-column overview + a hidden
    // gutter probe in minimal mode; assert the SOURCE structure (the flat
    // compiled selector does not appear verbatim in the nested sheet).
    expect(scss).toContain(".hk-range-ribbon[data-minimal] {");
    expect(scss).toMatch(
      /[\s\S]*?\.hk-range-ribbon\[data-minimal\] \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\)/,
    );
    expect(scss).toMatch(
      /\.hk-range-ribbon\[data-minimal\] \{[\s\S]*?\.hk-range-ribbon-overview-gutter \{[\s\S]*?display: none/,
    );
  });
});
