import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, ref } from "vue";

import HkImageViewer from "./HkImageViewer";

/**
 * Initial-position motion contract (2026-10-20 lightbox fly-in report).
 *
 * The <img> mounts parked at translate(0, 0) scale(1) — natural size,
 * anchored at the container's top-left — and only the load handler knows
 * the centered fit layout. With `transition: transform` armed from the
 * first paint, that reposition animated and the freshly-visible image
 * flew in from the top-left corner to the center every time a lightbox
 * opened. The glide must stay unarmed (no .is-animatable class) until
 * the repositioned transform has COMMITTED — two frames, because rAF
 * callbacks run before their frame's style recalc — and re-arm the same
 * way after every src change.
 */

const mounts: ReturnType<typeof createApp>[] = [];
const containers: HTMLElement[] = [];

afterEach(() => {
  for (const app of mounts.splice(0)) app.unmount();
  for (const el of containers.splice(0)) el.remove();
  vi.unstubAllGlobals();
});

// Hand-pumped rAF queue: flushFrame() models one rendered frame, and a
// callback scheduled during a flush (the nested second hop of the arming
// chain) waits for the NEXT frame, exactly like the browser.
const frames: FrameRequestCallback[] = [];

function stubRaf(): void {
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback): number => {
    frames.push(cb);
    return frames.length;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {});
}

function flushFrame(): void {
  for (const cb of frames.splice(0)) cb(performance.now());
}

interface Setup {
  img: () => HTMLImageElement;
  setSrc: (src: string) => void;
  /** happy-dom never decodes images: hand the viewer a natural size and
   *  fire the load event the layout waits on, flushed to the DOM. */
  markLoaded: (w: number, h: number) => Promise<void>;
}

async function mountViewer(): Promise<Setup> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  containers.push(container);

  const src = ref("/a.png");
  const Wrapper = defineComponent({
    setup() {
      return () => h(HkImageViewer, { src: src.value, alt: "pic" });
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

  async function markLoaded(w: number, h: number) {
    Object.defineProperty(img(), "naturalWidth", { configurable: true, value: w });
    Object.defineProperty(img(), "naturalHeight", { configurable: true, value: h });
    img().dispatchEvent(new Event("load"));
    await nextTick();
  }

  return { img, setSrc: (v: string) => { src.value = v; }, markLoaded };
}

const armed = (img: HTMLImageElement) => img.classList.contains("is-animatable");

describe("HkImageViewer initial-position motion", () => {
  it("jumps straight to the centered layout on load, unarmed", async () => {
    stubRaf();
    const s = await mountViewer();

    // Pre-load: invisible, parked at the top-left origin, glide disarmed.
    expect(s.img().style.transform).toBe("translate(0px, 0px) scale(1)");
    expect(armed(s.img())).toBe(false);

    // Load: the transform jumps to the centered fit layout in the same
    // tick (happy-dom containers measure 0x0, so an 800x600 image centers
    // at translate(-400px, -300px)) and the image becomes visible — the
    // arming class must NOT ride along, or this very move would glide.
    await s.markLoaded(800, 600);
    expect(s.img().style.transform).toBe("translate(-400px, -300px) scale(1)");
    expect(s.img().classList.contains("is-loading")).toBe(false);
    expect(armed(s.img())).toBe(false);

    // Frame 1 commits the new transform; the class must still be absent
    // here — a single-hop arming would land both in one style recalc and
    // the move would animate after all.
    flushFrame();
    expect(armed(s.img())).toBe(false);

    // Frame 2 arms the glide for wheel / pinch / minimap moves.
    flushFrame();
    await nextTick();
    expect(armed(s.img())).toBe(true);
  });

  it("disarms on src change and re-arms only after the new reposition", async () => {
    stubRaf();
    const s = await mountViewer();
    await s.markLoaded(800, 600);
    flushFrame();
    flushFrame();
    await nextTick();
    expect(armed(s.img())).toBe(true);

    s.setSrc("/b.png");
    await nextTick();
    // Disarmed immediately, and any in-flight arming retracted: the
    // swap's own reposition must land unarmed too.
    expect(armed(s.img())).toBe(false);

    await s.markLoaded(400, 300);
    expect(s.img().style.transform).toBe("translate(-200px, -150px) scale(1)");
    expect(armed(s.img())).toBe(false);
    flushFrame();
    expect(armed(s.img())).toBe(false);
    flushFrame();
    await nextTick();
    expect(armed(s.img())).toBe(true);
  });
});

const here = dirname(fileURLToPath(import.meta.url));
const scss = readFileSync(join(here, "HkImageViewer.scss"), "utf-8");

/** Full brace-matched body of the first rule following a marker. */
function ruleBody(marker: string, from = scss): string {
  const at = from.indexOf(marker);
  expect(at, `${marker} exists`).toBeGreaterThanOrEqual(0);
  const open = from.indexOf("{", at);
  let depth = 0;
  let close = open;
  for (; close < from.length; close++) {
    if (from[close] === "{") depth++;
    else if (from[close] === "}") {
      depth--;
      if (depth === 0) break;
    }
  }
  return from.slice(open + 1, close);
}

/** A rule's OWN declarations — nested blocks (the &-selectors) stripped,
 *  so a transition hidden one level down cannot satisfy an assertion
 *  aimed at the rule's direct declarations. */
function ownDecls(marker: string, from = scss): string {
  return ruleBody(marker, from).replace(/\{[^{}]*\}/g, "");
}

describe("HkImageViewer motion CSS contract", () => {
  it("keeps the transform transition behind the is-animatable gate", () => {
    // An unconditional transition on the base rule is exactly the fly-in
    // regression: deleting the gate (or hoisting the transition back to
    // the base rule) must fail here.
    expect(ownDecls(".hk-image-viewer-img")).not.toContain("transition");
    expect(ruleBody("&.is-animatable")).toContain("transition: transform 0.12s ease-out");
  });

  it("keeps reduced-motion outranking the armed transition", () => {
    const reduceAt = scss.indexOf("@media (prefers-reduced-motion: reduce)");
    expect(reduceAt).toBeGreaterThanOrEqual(0);
    const block = scss.slice(reduceAt);
    // Same (0,2,0) specificity as the armed rule, declared later in the
    // file — a bare .hk-image-viewer-img override would lose the cascade
    // tie to the gated rule above.
    expect(ruleBody(".hk-image-viewer-img.is-animatable", block)).toContain("transition: none");
  });
});
