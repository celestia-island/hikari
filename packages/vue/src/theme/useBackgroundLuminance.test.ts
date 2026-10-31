import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  luminanceSamplerRefCount,
  registerWallpaperSurfaceSources,
  releaseLuminanceSampler,
  resolveWallpaperSurfaceElement,
  retainLuminanceSampler,
  sampleLuminanceNow,
  startLuminanceSampler,
  stopLuminanceSampler,
} from "./useBackgroundLuminance";
import { invalidInput } from "../test-utils/invalid";

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
 *   1. a REGISTERED surface is what gets sampled, whatever its element id
 *      is (the assertion that would have failed for every consumer but
 *      chest);
 *   2. registration is the WHOLE contract: the retired ids are inert, and
 *      "nothing registered" resolves to null so the sampler takes its
 *      documented body-background path instead of reading a stranger's
 *      element;
 *   3. the shared loop is reference-counted, so an unmounting backdrop
 *      releases only its own claim.
 */

/** The ids the sampler used to look up before the registry existed. Still
 *  spelled out here, because the point of case 2 is that they mean nothing. */
const RETIRED_IDS = { canvas: "s-wallpaper-canvas", video: "s-wallpaper-video" } as const;

/** A WebGL2 context stub just real enough for the PBO round trip.
 *
 *  Built from the (legal) empty-object assertion and then filled in with
 *  type-checked assignments, so each stub signature is still verified against
 *  `WebGL2RenderingContext` instead of being asserted wholesale. */
function makeGl(pixel: [number, number, number, number]): WebGL2RenderingContext {
  const gl = {} as WebGL2RenderingContext;
  // The GL enum constants are declared `readonly` on the interface, so they go
  // on as own properties; everything below is a normal checked assignment.
  for (const [key, value] of Object.entries({
    PIXEL_PACK_BUFFER: 0x88eb,
    STREAM_READ: 0x88e1,
    RGBA: 0x1908,
    UNSIGNED_BYTE: 0x1401,
  })) {
    Object.defineProperty(gl, key, { value, configurable: true, writable: true });
  }
  gl.createBuffer = vi.fn(() => ({ id: "pbo" }));
  gl.bindBuffer = vi.fn();
  gl.bufferData = vi.fn();
  gl.deleteBuffer = vi.fn();
  gl.readPixels = vi.fn();
  gl.getBufferSubData = vi.fn(
    (_target: number, _offset: number, data: ArrayBufferView) => {
      if (data instanceof Uint8Array) {
        data[0] = pixel[0];
        data[1] = pixel[1];
        data[2] = pixel[2];
        data[3] = pixel[3];
      }
    },
  );
  return gl;
}

const DARK: [number, number, number, number] = [0, 0, 0, 255];
const BRIGHT: [number, number, number, number] = [250, 250, 250, 255];

let probed: HTMLCanvasElement[] = [];

/** The stub context each canvas should answer with. A WeakMap keeps the
 *  association typed — an expando on the element would need a cast. */
const glByCanvas = new WeakMap<HTMLCanvasElement, WebGL2RenderingContext | null>();

/** Every canvas reports `pixels` (see makeGl) — the test distinguishes the
 *  sources by WHICH element was asked, not by the pixel value. */
function stubCanvasContexts() {
  probed = [];
  const spy = vi.spyOn(HTMLCanvasElement.prototype, "getContext");
  // One implementation cannot satisfy every `getContext` overload: the
  // overloads differ only by return type, and TypeScript has no single
  // signature that is assignable to all of them.
  spy.mockImplementation(invalidInput(function (this: HTMLCanvasElement, kind: string) {
    probed.push(this);
    return kind === "webgl2" ? glByCanvas.get(this) ?? null : null;
  }));
  return spy;
}

function makeCanvas(id: string, gl: WebGL2RenderingContext | null, connected = true): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  if (id) canvas.id = id;
  glByCanvas.set(canvas, gl);
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
    makeCanvas("hk-wallpaper-canvas-decoy", makeGl(BRIGHT));
    const mine = makeCanvas("hk-wallpaper-canvas-instance-1", makeGl(DARK));
    stubCanvasContexts();

    expect(
      resolveWallpaperSurfaceElement("canvas"),
      "an unregistered element is not the sampler's source",
    ).toBeNull();

    disposers.push(registerWallpaperSurfaceSources({ canvas: () => mine }));
    expect(resolveWallpaperSurfaceElement("canvas")).toBe(mine);
  });

  it("samples the REGISTERED surface, not the retired ids", async () => {
    const retired = makeCanvas(RETIRED_IDS.canvas, makeGl(BRIGHT));
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
    expect(probed, "the retired id is never touched").not.toContain(retired);
    // A DARK surface ⇒ white floating text (the registered element's pixels).
    expect(luminanceVar()).toBe("255, 255, 255");
  });

  it("does not resolve the retired ids when nothing is registered", () => {
    const retiredCanvas = makeCanvas(RETIRED_IDS.canvas, makeGl(BRIGHT));
    const retiredVideo = document.createElement("video");
    retiredVideo.id = RETIRED_IDS.video;
    document.body.appendChild(retiredVideo);
    stubCanvasContexts();

    expect(document.getElementById(RETIRED_IDS.canvas)).toBe(retiredCanvas);
    expect(resolveWallpaperSurfaceElement("canvas")).toBeNull();
    expect(resolveWallpaperSurfaceElement("video")).toBeNull();
  });

  it("stops using a surface as soon as its owner disposes the registration", () => {
    const retired = makeCanvas(RETIRED_IDS.canvas, null);
    const registered = makeCanvas("hk-wallpaper-canvas-transient", null);
    stubCanvasContexts();

    const dispose = registerWallpaperSurfaceSources({ canvas: () => registered });
    expect(resolveWallpaperSurfaceElement("canvas")).toBe(registered);
    dispose();
    expect(document.getElementById(RETIRED_IDS.canvas)).toBe(retired);
    expect(resolveWallpaperSurfaceElement("canvas")).toBeNull();
  });

  it("keeps the other owner's surface when one registration disposes", () => {
    const mine = makeCanvas("hk-wallpaper-canvas-my-owner", null);
    const other = makeCanvas("hk-wallpaper-canvas-other-owner", null);
    stubCanvasContexts();

    const disposeMine = registerWallpaperSurfaceSources({ canvas: () => mine });
    disposers.push(registerWallpaperSurfaceSources({ canvas: () => other }));
    expect(resolveWallpaperSurfaceElement("canvas")).toBe(other);

    disposeMine();
    // Disposal is per registration, not a sweep: the survivor must keep
    // answering, or the second backdrop (chest mounts one per layout) loses
    // its contrast sampling the moment the first unmounts.
    expect(resolveWallpaperSurfaceElement("canvas")).toBe(other);
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
        canvas: () => invalidInput(bogus),
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
