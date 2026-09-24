import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  LEGACY_WALLPAPER_SURFACE_IDS,
  luminanceSamplerRefCount,
  registerWallpaperSurfaceSources,
  releaseLuminanceSampler,
  resolveWallpaperSurfaceElement,
  retainLuminanceSampler,
  sampleLuminanceNow,
  startLuminanceSampler,
  stopLuminanceSampler,
} from "./useBackgroundLuminance";

/**
 * The wallpaper-surface DOM contract.
 *
 * What this replaced: `useBackgroundLuminance.ts` read
 * `getElementById("s-wallpaper-canvas")` / `("s-wallpaper-video")` — chest's
 * element ids, hard-coded in a SHARED library. That is an implicit contract
 * between two packages and it fails SILENTLY for the second consumer: no
 * element, no sample, no error, and the floating-text tokens are then
 * derived from the body background instead of the wallpaper.
 *
 * Three facts are pinned here:
 *   1. a REGISTERED surface is what gets sampled, even when its element id
 *      is nothing like chest's (the assertion that would have failed for
 *      every consumer but chest);
 *   2. the legacy ids still resolve when nothing is registered (chest keeps
 *      working until its own migration PR);
 *   3. the shared loop is reference-counted, so an unmounting backdrop
 *      releases only its own claim.
 */

/** A WebGL2 context stub just real enough for the PBO round trip. */
function makeGl(pixel: [number, number, number, number]) {
  return {
    PIXEL_PACK_BUFFER: 0x88eb,
    STREAM_READ: 0x88e1,
    RGBA: 0x1908,
    UNSIGNED_BYTE: 0x1401,
    createBuffer: vi.fn(() => ({ id: "pbo" })),
    bindBuffer: vi.fn(),
    bufferData: vi.fn(),
    deleteBuffer: vi.fn(),
    readPixels: vi.fn(),
    getBufferSubData: vi.fn((_target: number, _offset: number, data: Uint8Array) => {
      data[0] = pixel[0];
      data[1] = pixel[1];
      data[2] = pixel[2];
      data[3] = pixel[3];
    }),
  } as unknown as WebGL2RenderingContext;
}

const DARK: [number, number, number, number] = [0, 0, 0, 255];
const BRIGHT: [number, number, number, number] = [250, 250, 250, 255];

let probed: HTMLCanvasElement[] = [];

/** Every canvas reports `pixels` (see makeGl) — the test distinguishes the
 *  sources by WHICH element was asked, not by the pixel value. */
function stubCanvasContexts() {
  probed = [];
  const spy = vi.spyOn(HTMLCanvasElement.prototype, "getContext");
  spy.mockImplementation(function (this: HTMLCanvasElement, kind: string) {
    probed.push(this);
    return kind === "webgl2" ? ((this as unknown as { __gl?: WebGL2RenderingContext }).__gl ?? null) : null;
  } as unknown as typeof HTMLCanvasElement.prototype.getContext);
  return spy;
}

function makeCanvas(id: string, gl: WebGL2RenderingContext | null, connected = true): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  if (id) canvas.id = id;
  (canvas as unknown as { __gl: WebGL2RenderingContext | null }).__gl = gl;
  if (connected) document.body.appendChild(canvas);
  return canvas;
}

const luminanceVar = () =>
  document.documentElement.style.getPropertyValue("--float-text-color");

async function frame() {
  await new Promise((r) => setTimeout(r, 40));
}

let disposers: Array<() => void> = [];

beforeEach(() => {
  probed = [];
  disposers = [];
  document.documentElement.style.removeProperty("--float-text-color");
  document.documentElement.style.removeProperty("--float-badge-color");
  stopLuminanceSampler();
});

afterEach(() => {
  for (const dispose of disposers) dispose();
  disposers = [];
  stopLuminanceSampler();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("wallpaper surface registry", () => {
  it("proves the detector can tell two canvases apart (positive control)", () => {
    makeCanvas(LEGACY_WALLPAPER_SURFACE_IDS.canvas, makeGl(BRIGHT));
    const mine = makeCanvas("hk-wallpaper-canvas-instance-1", makeGl(DARK));
    stubCanvasContexts();

    expect(resolveWallpaperSurfaceElement("canvas")).toBe(
      document.getElementById(LEGACY_WALLPAPER_SURFACE_IDS.canvas),
    );

    disposers.push(registerWallpaperSurfaceSources({ canvas: () => mine }));
    expect(resolveWallpaperSurfaceElement("canvas")).toBe(mine);
  });

  it("samples the REGISTERED surface, not chest's fixed id", async () => {
    const legacy = makeCanvas(LEGACY_WALLPAPER_SURFACE_IDS.canvas, makeGl(BRIGHT));
    // A different id AND a different class: nothing about this element
    // matches what the sampler used to look for.
    const registered = makeCanvas("hk-wallpaper-canvas-7f3a", makeGl(DARK));
    stubCanvasContexts();

    disposers.push(registerWallpaperSurfaceSources({ canvas: () => registered }));

    // Two one-shot samples: the first starts the PBO read, the second
    // collects it (the sampler's existing two-frame round trip).
    sampleLuminanceNow();
    sampleLuminanceNow();
    await frame();

    expect(probed, "only the registered element is probed").toContain(registered);
    expect(probed, "chest's element is never touched").not.toContain(legacy);
    // A DARK surface ⇒ white floating text (the registered element's pixels).
    expect(luminanceVar()).toBe("255, 255, 255");
  });

  it("still resolves the legacy ids when nothing is registered", () => {
    const legacyCanvas = makeCanvas(LEGACY_WALLPAPER_SURFACE_IDS.canvas, makeGl(BRIGHT));
    const legacyVideo = document.createElement("video");
    legacyVideo.id = LEGACY_WALLPAPER_SURFACE_IDS.video;
    document.body.appendChild(legacyVideo);
    stubCanvasContexts();

    expect(resolveWallpaperSurfaceElement("canvas")).toBe(legacyCanvas);
    expect(resolveWallpaperSurfaceElement("video")).toBe(legacyVideo);
  });

  it("stops using a surface as soon as its owner disposes the registration", () => {
    const legacy = makeCanvas(LEGACY_WALLPAPER_SURFACE_IDS.canvas, null);
    const registered = makeCanvas("hk-wallpaper-canvas-transient", null);
    stubCanvasContexts();

    const dispose = registerWallpaperSurfaceSources({ canvas: () => registered });
    expect(resolveWallpaperSurfaceElement("canvas")).toBe(registered);
    dispose();
    expect(resolveWallpaperSurfaceElement("canvas")).toBe(legacy);
  });

  it("prefers the newest registration that resolves", () => {
    const first = makeCanvas("hk-wallpaper-canvas-a", null);
    const second = makeCanvas("hk-wallpaper-canvas-b", null);
    stubCanvasContexts();

    disposers.push(registerWallpaperSurfaceSources({ canvas: () => first }));
    disposers.push(registerWallpaperSurfaceSources({ canvas: () => second }));
    expect(resolveWallpaperSurfaceElement("canvas")).toBe(second);

    // A source that resolves nothing does not shadow an older live one.
    disposers.push(registerWallpaperSurfaceSources({ canvas: () => null }));
    expect(resolveWallpaperSurfaceElement("canvas")).toBe(second);
  });

  it("keeps the video surface addressable independently of the canvas", () => {
    const video = document.createElement("video");
    document.body.appendChild(video);
    disposers.push(registerWallpaperSurfaceSources({ video: () => video }));

    expect(resolveWallpaperSurfaceElement("video")).toBe(video);
    expect(resolveWallpaperSurfaceElement("canvas")).toBeNull();
  });

  it("survives a surface whose element cannot be read (no escape into the caller)", async () => {
    // A non-canvas element answering the canvas slot: getContext("webgl2")
    // throws. The sample must be skipped, not propagated into whoever
    // started the loop.
    const bogus = document.createElement("div");
    document.body.appendChild(bogus);
    disposers.push(
      registerWallpaperSurfaceSources({
        canvas: () => bogus as unknown as HTMLCanvasElement,
      }),
    );
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(() => startLuminanceSampler()).not.toThrow();
    await frame();
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe("shared sampler loop reference counting", () => {
  it("starts on the first claim and stops on the last release", () => {
    expect(luminanceSamplerRefCount()).toBe(0);

    retainLuminanceSampler();
    expect(luminanceSamplerRefCount()).toBe(1);
    retainLuminanceSampler();
    expect(luminanceSamplerRefCount()).toBe(2);

    releaseLuminanceSampler();
    expect(luminanceSamplerRefCount(), "a sibling's claim is untouched").toBe(1);
    releaseLuminanceSampler();
    expect(luminanceSamplerRefCount()).toBe(0);

    // Over-release is a no-op, never a negative count.
    releaseLuminanceSampler();
    expect(luminanceSamplerRefCount()).toBe(0);
  });

  it("lets the explicit host API replace the claims, as before", () => {
    retainLuminanceSampler();
    retainLuminanceSampler();
    startLuminanceSampler();
    expect(luminanceSamplerRefCount()).toBe(1);
    stopLuminanceSampler();
    expect(luminanceSamplerRefCount()).toBe(0);
  });
});
