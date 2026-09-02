import { afterEach, describe, expect, it } from "vitest";
import { createApp, defineComponent, h, nextTick } from "vue";

import HkImageViewer from "./HkImageViewer";

const mounts: ReturnType<typeof createApp>[] = [];
const containers: HTMLElement[] = [];

afterEach(() => {
  for (const app of mounts.splice(0)) app.unmount();
  for (const el of containers.splice(0)) el.remove();
});

/** Pinch state math (see the touch tests below):
 *  fingers start 40px apart, spread to 120px → zoom 1 → 3 (clamped to
 *  fit..8 exactly like wheel/double-click zoom). */

interface Setup {
  container: () => HTMLElement;
  img: () => HTMLImageElement;
  /** Current `translate(...) scale(...)` numbers of the img transform. */
  transform: () => { tx: number; ty: number; scale: number };
}

async function mountViewer(): Promise<Setup> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  containers.push(container);

  const Wrapper = defineComponent({
    setup() {
      return () => h(HkImageViewer, { src: "/test-wallpaper.svg", alt: "wallpaper" });
    },
  });
  const app = createApp(Wrapper);
  mounts.push(app);
  app.mount(container);

  const img = () => {
    const el = container.querySelector<HTMLImageElement>(".hk-image-viewer-img");
    if (!el) throw new Error("viewer img not rendered");
    return el;
  };

  // Mark the image loaded (happy-dom never decodes resources): the
  // viewer only engages gestures once `loaded` is true. One flush lets
  // every transform read below see the post-load fit/center state.
  Object.defineProperty(img(), "naturalWidth", { configurable: true, value: 800 });
  Object.defineProperty(img(), "naturalHeight", { configurable: true, value: 600 });
  img().dispatchEvent(new Event("load"));
  await nextTick();

  return {
    container: () => {
      const el = container.querySelector<HTMLElement>(".hk-image-viewer");
      if (!el) throw new Error("viewer container not rendered");
      return el;
    },
    img,
    transform: () => {
      const m = /translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)\s*scale\(([\d.]+)\)/.exec(img().style.transform);
      if (!m) throw new Error(`unexpected transform: ${img().style.transform}`);
      return { tx: parseFloat(m[1]), ty: parseFloat(m[2]), scale: parseFloat(m[3]) };
    },
  };
}

function pointer(type: string, id: number, x: number, y: number): PointerEvent {
  return new PointerEvent(type, { bubbles: true, pointerId: id, pointerType: "touch", clientX: x, clientY: y });
}

describe("HkImageViewer touch gestures", () => {
  it("a two-finger pinch zooms anchored between the fingers", async () => {
    const s = await mountViewer();
    const c = s.container();
    expect(s.transform().scale).toBe(1);

    // Fingers land 40px apart, then spread to 120px → 3x zoom.
    c.dispatchEvent(pointer("pointerdown", 1, 100, 100));
    c.dispatchEvent(pointer("pointerdown", 2, 140, 100));
    c.dispatchEvent(pointer("pointermove", 1, 60, 100));
    c.dispatchEvent(pointer("pointermove", 2, 180, 100));
    await nextTick();

    expect(s.transform().scale).toBeCloseTo(3, 5);
  });

  it("a single finger keeps panning exactly as before", async () => {
    const s = await mountViewer();
    const c = s.container();

    const before = s.transform();
    c.dispatchEvent(pointer("pointerdown", 1, 100, 100));
    c.dispatchEvent(pointer("pointermove", 1, 140, 160));
    await nextTick();

    const after = s.transform();
    expect(after.tx).toBeCloseTo(before.tx + 40, 5);
    expect(after.ty).toBeCloseTo(before.ty + 60, 5);
    expect(after.scale).toBe(before.scale);
  });

  it("a stray move without an active pointer never pans", async () => {
    const s = await mountViewer();
    const c = s.container();

    const before = s.transform();
    c.dispatchEvent(pointer("pointermove", 9, 200, 200));
    await nextTick();
    expect(s.transform()).toEqual(before);
  });

  it("after the pinch ends the surviving finger pans again (no jump)", async () => {
    const s = await mountViewer();
    const c = s.container();

    // Pinch to 3x.
    c.dispatchEvent(pointer("pointerdown", 1, 100, 100));
    c.dispatchEvent(pointer("pointerdown", 2, 140, 100));
    c.dispatchEvent(pointer("pointermove", 1, 60, 100));
    c.dispatchEvent(pointer("pointermove", 2, 180, 100));
    await nextTick();
    expect(s.transform().scale).toBeCloseTo(3, 5);

    // Finger 2 lifts: finger 1 takes over panning…
    c.dispatchEvent(pointer("pointerup", 2, 180, 100));
    await nextTick();

    // …and a follow-up move pans (in scaled image space, dx is applied
    // 1:1 to the transform) instead of continuing to zoom.
    const before = s.transform();
    c.dispatchEvent(pointer("pointermove", 1, 90, 130));
    await nextTick();

    const after = s.transform();
    expect(after.scale).toBeCloseTo(3, 5);
    expect(after.tx).toBeCloseTo(before.tx + 30, 5);
    expect(after.ty).toBeCloseTo(before.ty + 30, 5);
  });

  it("lifting one pinch finger while a third remains re-baselines without a zoom jump", async () => {
    const s = await mountViewer();
    const c = s.container();

    // Pinch to 3x with fingers 1+2 (40px apart → 120px apart).
    c.dispatchEvent(pointer("pointerdown", 1, 100, 100));
    c.dispatchEvent(pointer("pointerdown", 2, 140, 100));
    c.dispatchEvent(pointer("pointermove", 1, 60, 100));
    c.dispatchEvent(pointer("pointermove", 2, 180, 100));
    await nextTick();
    expect(s.transform().scale).toBeCloseTo(3, 5);

    // A third finger lands, then finger 1 lifts: the pair becomes
    // fingers 2+3 (20px apart) and must re-baseline at the CURRENT zoom.
    c.dispatchEvent(pointer("pointerdown", 3, 200, 100));
    c.dispatchEvent(pointer("pointerup", 1, 60, 100));
    await nextTick();
    expect(s.transform().scale).toBeCloseTo(3, 5);

    // Spreading the new pair (finger 3 pinned at 200) from 20px to 40px
    // distance doubles the zoom from its re-baselined 3x, exactly as a
    // fresh pinch would.
    c.dispatchEvent(pointer("pointermove", 2, 240, 100));
    await nextTick();
    expect(s.transform().scale).toBeCloseTo(6, 5);
  });

  it("pointercancel reclaims the gesture (no further pan/zoom)", async () => {
    const s = await mountViewer();
    const c = s.container();

    c.dispatchEvent(pointer("pointerdown", 1, 100, 100));
    c.dispatchEvent(pointer("pointercancel", 1, 100, 100));

    const before = s.transform();
    c.dispatchEvent(pointer("pointermove", 1, 300, 300));
    await nextTick();
    expect(s.transform()).toEqual(before);
  });

  it("pinch zoom anchors on the fingers' midpoint (pan lands exactly)", async () => {
    const s = await mountViewer();
    const c = s.container();

    // Fingers land 80px apart (midpoint 220,100), then finger 2 alone
    // spreads the pair to 120px: a 1.5x zoom whose anchor is the
    // midpoint. One single move event → one setZoom call → exact math.
    c.dispatchEvent(pointer("pointerdown", 1, 160, 100));
    c.dispatchEvent(pointer("pointerdown", 2, 240, 100));
    c.dispatchEvent(pointer("pointermove", 2, 280, 100));
    await nextTick();

    // Initial fit state centers the 800×600 image at pan (-400, -300),
    // zoom 1. setZoom(1.5, 220, 100): the world point under the mid is
    // ((220+400)/1, (100+300)/1) = (620, 400), so pan = mid - world·1.5
    // = (-710, -500). (clampPan keeps both: the zero-sized test
    // container clamps to ≤0, and these are.)
    const t = s.transform();
    expect(t.scale).toBeCloseTo(1.5, 5);
    expect(t.tx).toBeCloseTo(-710, 5);
    expect(t.ty).toBeCloseTo(-500, 5);
    // The anchor invariant itself: the midpoint maps onto itself.
    expect(t.tx + 620 * 1.5).toBeCloseTo(220, 5);
    expect(t.ty + 400 * 1.5).toBeCloseTo(100, 5);
  });

  it("pinching past MAX_ZOOM clamps to 8", async () => {
    const s = await mountViewer();
    const c = s.container();

    c.dispatchEvent(pointer("pointerdown", 1, 100, 100));
    c.dispatchEvent(pointer("pointerdown", 2, 140, 100));
    // Spread 40px → 640px: a 16x ratio clamps to MAX_ZOOM = 8.
    c.dispatchEvent(pointer("pointermove", 1, 100, 100));
    c.dispatchEvent(pointer("pointermove", 2, 740, 100));
    await nextTick();
    expect(s.transform().scale).toBeCloseTo(8, 5);
  });

  it("pinching inward below fit clamps to fit (transform untouched)", async () => {
    const s = await mountViewer();
    const c = s.container();

    const before = s.transform();
    expect(before.scale).toBe(1);

    // Close 40px → 4px: a 0.1x ratio clamps to fit (=1 here), and the
    // clamp is an early return in setZoom — pan must not move either.
    c.dispatchEvent(pointer("pointerdown", 1, 100, 100));
    c.dispatchEvent(pointer("pointerdown", 2, 140, 100));
    c.dispatchEvent(pointer("pointermove", 1, 118, 100));
    c.dispatchEvent(pointer("pointermove", 2, 122, 100));
    await nextTick();
    expect(s.transform()).toEqual(before);
  });

  it("lostpointercapture prunes ghost pointers (no phantom pinch)", async () => {
    const s = await mountViewer();
    const c = s.container();

    // Two fingers land (pinch armed), then capture is lost for both
    // without any pointerup reaching the viewer (the setter threw, or
    // the engine dropped the gesture).
    c.dispatchEvent(pointer("pointerdown", 1, 100, 100));
    c.dispatchEvent(pointer("pointerdown", 2, 140, 100));
    c.dispatchEvent(new PointerEvent("lostpointercapture", { pointerId: 1 }));
    c.dispatchEvent(new PointerEvent("lostpointercapture", { pointerId: 2 }));
    await nextTick();

    const before = s.transform();
    // A fresh single finger must pan — not resurrect a phantom pinch.
    c.dispatchEvent(pointer("pointerdown", 3, 200, 200));
    c.dispatchEvent(pointer("pointermove", 3, 260, 240));
    await nextTick();

    const after = s.transform();
    expect(after.scale).toBe(before.scale);
    expect(after.tx).toBeCloseTo(before.tx + 60, 5);
    expect(after.ty).toBeCloseTo(before.ty + 40, 5);
  });
});
