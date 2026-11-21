/**
 * Behavioural tests for the overview ruler: real mounts with STUBBED
 * geometry (happy-dom reports no layout, so clientHeight/scrollHeight and
 * getBoundingClientRect are seeded per test — the engine math then runs
 * for real). Pins the R2/R3 geometry findings:
 *   - the cursor edge travels progress × (1 − length) — the overlay
 *     scrollbar's own mapping — and lands at 100% at max scroll (S1-1);
 *   - thumb drags are 1:1 with the cursor's own travel (S1-2);
 *   - attach renders the first frame immediately (S2-A);
 *   - the host promotion survives a sibling detach and restores on the
 *     last one (S2-1);
 *   - Clear semantics: setBands([]) empties the waterfall (S2-B tail).
 */
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { attachOverviewRuler, type OverviewRulerHandle } from "./useOverviewRuler";

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

function stubRect(el: HTMLElement, rect: Rect): void {
  Object.defineProperty(el, "getBoundingClientRect", {
    configurable: true,
    value: () => ({
      ...rect,
      right: rect.left + rect.width,
      bottom: rect.top + rect.height,
      x: rect.left,
      y: rect.top,
      toJSON() {
        return {};
      },
    }),
  });
}

function seedScroll(
  sc: HTMLElement,
  dims: { extent: number; visible: number },
): void {
  Object.defineProperty(sc, "scrollHeight", {
    configurable: true,
    value: dims.extent,
  });
  Object.defineProperty(sc, "clientHeight", {
    configurable: true,
    value: dims.visible,
  });
}

function makeScroller(children: number): { host: HTMLElement; sc: HTMLElement } {
  const host = document.createElement("div");
  const sc = document.createElement("div");
  for (let i = 1; i <= children; i += 1) {
    const d = document.createElement("div");
    d.textContent = `row ${i}`;
    sc.appendChild(d);
  }
  host.appendChild(sc);
  document.body.appendChild(host);
  return { host, sc };
}

/** Strip geometry used across these tests: 48px wide, 400px tall, docked
 *  at the host origin (the scroller rect is stubbed to the same box). */
const STRIP: Rect = { left: 0, top: 0, width: 48, height: 400 };

describe("attachOverviewRuler (behaviour)", () => {
  let cleanup: (() => void) | null = null;

  beforeEach(() => {
    cleanup = null;
  });
  afterEach(() => {
    cleanup?.();
    cleanup = null;
    document.body.textContent = "";
  });

  it("renders the first frame on attach (cursor styled immediately)", () => {
    const { host, sc } = makeScroller(30);
    stubRect(sc, { left: 0, top: 0, width: 300, height: 300 });
    seedScroll(sc, { extent: 3000, visible: 300 });
    const handle = attachOverviewRuler(sc, { host });
    cleanup = () => handle.detach();
    const cursor = host.querySelector<HTMLElement>(".hk-overview-ruler-cursor")!;
    // length = 300/3000 = 10%; progress = 0 → top = 0%
    expect(cursor.style.top).toBe("0%");
    expect(cursor.style.height).toBe("10%");
  });

  it("jump: a strip click at fraction f scrolls to f × maxScroll", () => {
    const { host, sc } = makeScroller(30);
    stubRect(sc, { left: 0, top: 0, width: 300, height: 300 });
    seedScroll(sc, { extent: 3000, visible: 300 }); // maxScroll 2700
    const handle = attachOverviewRuler(sc, { host });
    cleanup = () => handle.detach();
    const strip = host.querySelector<HTMLElement>(".hk-overview-ruler")!;
    stubRect(strip, STRIP);
    // click at fraction 0.5 down the strip
    const y = STRIP.top + STRIP.height * 0.5;
    strip.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        cancelable: true,
        clientX: STRIP.left + STRIP.width / 2,
        clientY: y,
        pointerId: 1,
        pointerType: "mouse",
        button: 0,
        isPrimary: true,
      }),
    );
    strip.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        cancelable: true,
        clientX: STRIP.left + STRIP.width / 2,
        clientY: y,
        pointerId: 1,
        pointerType: "mouse",
      }),
    );
    expect(sc.scrollTop).toBe(1350); // 0.5 × 2700
  });

  it("cursor lands exactly at the strip end when fully scrolled (S1-1)", () => {
    const { host, sc } = makeScroller(30);
    stubRect(sc, { left: 0, top: 0, width: 300, height: 300 });
    seedScroll(sc, { extent: 3000, visible: 300 });
    const handle = attachOverviewRuler(sc, { host });
    cleanup = () => handle.detach();
    sc.scrollTop = 2700; // maxScroll
    sc.dispatchEvent(new Event("scroll"));
    const cursor = host.querySelector<HTMLElement>(".hk-overview-ruler-cursor")!;
    // progress = 1 → top = (1 − 0.1) = 90%; the bottom edge lands at 100%
    expect(cursor.style.top).toBe("90%");
    expect(cursor.style.height).toBe("10%");
  });

  it("thumb drag is 1:1 with the cursor's own travel (S1-2)", () => {
    const { host, sc } = makeScroller(30);
    stubRect(sc, { left: 0, top: 0, width: 300, height: 300 });
    seedScroll(sc, { extent: 3000, visible: 300 }); // length 0.1, maxScroll 2700
    const handle = attachOverviewRuler(sc, { host });
    cleanup = () => handle.detach();
    const strip = host.querySelector<HTMLElement>(".hk-overview-ruler")!;
    stubRect(strip, STRIP);
    const cursor = host.querySelector<HTMLElement>(".hk-overview-ruler-cursor")!;
    stubRect(cursor, { left: 0, top: 0, width: 48, height: 40 }); // 10% of 400
    // cursor travel = 400 − 40 = 360px ↔ maxScroll 2700: a 180px drag is
    // HALF the document (1350) — exactly 1:1 with the cursor box.
    const startY = STRIP.top + 20; // inside the 40px cursor at top 0%
    strip.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        cancelable: true,
        clientX: 24,
        clientY: startY,
        pointerId: 1,
        pointerType: "mouse",
        button: 0,
        isPrimary: true,
      }),
    );
    strip.dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        cancelable: true,
        clientX: 24,
        clientY: startY + 180,
        pointerId: 1,
        pointerType: "mouse",
      }),
    );
    strip.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        cancelable: true,
        clientX: 24,
        clientY: startY + 180,
        pointerId: 1,
        pointerType: "mouse",
      }),
    );
    expect(sc.scrollTop).toBe(1350);
  });

  it("thumb-mode strip clicks are inert (thumb restricts dragging)", () => {
    const { host, sc } = makeScroller(30);
    stubRect(sc, { left: 0, top: 0, width: 300, height: 300 });
    seedScroll(sc, { extent: 3000, visible: 300 });
    const handle = attachOverviewRuler(sc, { host, cursorDrag: "thumb" });
    cleanup = () => handle.detach();
    const strip = host.querySelector<HTMLElement>(".hk-overview-ruler")!;
    stubRect(strip, STRIP);
    // click OUTSIDE the cursor (fraction 0.5 down the strip)
    strip.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        cancelable: true,
        clientX: 24,
        clientY: STRIP.top + STRIP.height * 0.5,
        pointerId: 1,
        pointerType: "mouse",
        button: 0,
        isPrimary: true,
      }),
    );
    expect(sc.scrollTop).toBe(0);
  });

  it("setBands replaces the waterfall; empty clears it (S2-B tail)", () => {
    const { host, sc } = makeScroller(10);
    stubRect(sc, { left: 0, top: 0, width: 300, height: 300 });
    seedScroll(sc, { extent: 500, visible: 300 });
    const handle = attachOverviewRuler(sc, { host });
    cleanup = () => handle.detach();
    handle.setBands([
      { start: 0.1, length: 0.2, modifier: "hk-overview-band-error" },
      { start: 0.5, length: 0.1, modifier: "hk-overview-band-warn" },
    ]);
    const bands = host.querySelectorAll<HTMLElement>(".hk-overview-ruler-band");
    expect(bands.length).toBe(2);
    expect(bands[0].classList.contains("hk-overview-band-error")).toBe(true);
    expect(bands[1].classList.contains("hk-overview-band-warn")).toBe(true);
    expect(bands[0].style.top).toBe("10%");
    handle.setBands([]);
    expect(host.querySelectorAll(".hk-overview-ruler-band").length).toBe(0);
  });

  it("host promotion is reference-counted and restores on the last detach (S2-1)", () => {
    const { host, sc } = makeScroller(5);
    stubRect(sc, { left: 0, top: 0, width: 300, height: 300 });
    seedScroll(sc, { extent: 250, visible: 300 });
    const a = attachOverviewRuler(sc, { host });
    const b = attachOverviewRuler(sc, { host });
    cleanup = () => {
      a.detach();
      b.detach();
    };
    // happy-dom computed position is static → the promotion applied
    expect(host.style.position).toBe("relative");
    a.detach();
    // ruler B still mounted — the promotion must survive A's detach
    expect(host.style.position).toBe("relative");
    expect(host.querySelector(".hk-overview-ruler")).toBeTruthy();
    b.detach();
    // the LAST detach restores the saved inline position
    expect(host.style.position).toBe("");
    expect(host.querySelector(".hk-overview-ruler")).toBeNull();
  });

  it("detach is idempotent and a no-host viewport gets a no-op handle", () => {
    const { sc } = makeScroller(3);
    // Detach sc from any parent: no host resolvable
    const orphan = document.createElement("div");
    orphan.appendChild(sc);
    const handle = attachOverviewRuler(sc);
    expect(() => {
      handle.update();
      handle.setBands([{ start: 0, length: 1 }]);
      handle.detach();
      handle.detach();
    }).not.toThrow();
    void orphan;
  });
});
