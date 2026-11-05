import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { compile } from "sass";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, ref, type Ref } from "vue";

import HkRangeRibbon, { type RibbonLane, type RibbonSegment } from "./HkRangeRibbon";
import { setLocale } from "../i18n/context";
import jaBundle from "../i18n/locales/ja/components.json";

/**
 * HkRangeRibbon anatomy + behaviour.
 *
 * The component's whole reason to exist is the window contract, so the
 * cases below pin it from both sides:
 *   · windowed lanes are the ONLY clipping site (full domain → positions
 *     untouched; clipped → re-normalized; wholly-outside → absent), while
 *     the overview keeps painting the full domain;
 *   · the emitted window is ALWAYS in full-domain absolute fractions —
 *     never relative to the currently zoomed sub-domain (the chest row
 *     filter depends on exactly that);
 *   · every reset path (button / dblclick / Escape / Home) lands null and
 *     restores the full view;
 *   · sub-minimum brushes, edge drags and keyboard nudges clamp instead of
 *     crossing.
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

function pointer(type: string, clientX: number, target: EventTarget): void {
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId: 1,
      pointerType: "mouse",
      clientX,
      clientY: 10,
      button: 0,
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

    // A bare arrow cannot brush without a brush: no window, no emission.
    keydown(strip, "ArrowRight");
    await nextTick();
    expect(host.windowChange).not.toHaveBeenCalled();
    expect(host.root.hasAttribute("data-windowed")).toBe(false);

    // Shift+Arrow is the keyboard entry point into windowed mode.
    keydown(strip, "ArrowLeft", { shiftKey: true });
    await nextTick();
    expectWindow(lastWindow(host.windowChange), 0, 0.95);
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
});

// ── A11y + i18n ─────────────────────────────────────────────────────────
describe("HkRangeRibbon a11y and i18n", () => {
  it("wires the strip and both handles as sliders with min/max/now", () => {
    const root = mountRibbon({ window: [0.2, 0.6] });
    const strip = root.querySelector<HTMLElement>(".hk-range-ribbon-strip")!;
    expect(strip.getAttribute("role")).toBe("slider");
    expect(strip.getAttribute("aria-valuemin")).toBe("0");
    expect(strip.getAttribute("aria-valuemax")).toBe("100");
    expect(strip.getAttribute("aria-valuenow"), "strip value = window start").toBe("20");
    expect(strip.getAttribute("aria-valuetext")).toBe("20% – 60%");
    expect(strip.getAttribute("aria-label")).toBe("Observation range");

    const start = root.querySelector<HTMLElement>('[data-edge="start"]')!;
    expect(start.getAttribute("role")).toBe("slider");
    expect(start.getAttribute("aria-valuemin")).toBe("0");
    expect(start.getAttribute("aria-valuemax")).toBe("58");
    expect(start.getAttribute("aria-valuenow")).toBe("20");
    expect(start.getAttribute("aria-label")).toBe("Window start");

    const end = root.querySelector<HTMLElement>('[data-edge="end"]')!;
    expect(end.getAttribute("role")).toBe("slider");
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
});

// ── Stylesheet contract ─────────────────────────────────────────────────
const componentDir = dirname(fileURLToPath(import.meta.url));

/** Body of one compiled rule, by exact selector (Sass drops quotes around
 *  attribute values: `[data-status=pending]`). */
function ruleBody(sheet: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matches = [
    ...sheet.matchAll(new RegExp(`(?:(?<=^)|(?<=[}{]))\\s*${escaped}\\s*\\{([^}]*)\\}`, "g")),
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

    // A clipped 2px sliver must still be visible.
    expect(declaration(ruleBody(css, ".hk-range-ribbon-segment"), "min-width")).toBe("2px");
    expect(declaration(ruleBody(css, ".hk-range-ribbon-lane-track"), "height")).toBe("20px");
    // The reset chip clears the edge handle (half its 8px width).
    expect(declaration(ruleBody(css, ".hk-range-ribbon-reset"), "right")).toBe("4px");
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
});
