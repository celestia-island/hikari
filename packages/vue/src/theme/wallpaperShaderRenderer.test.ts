import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { HkWallpaperSurfaceContext } from "../components/HkWallpaperBackdrop";
import { registerShaderPresets } from "./wallpaperShaderPresets";
import {
  WallpaperShaderPipeline,
  createWallpaperShaderSurface,
} from "./wallpaperShaderRenderer";

// WallpaperShaderPipeline.attach() compiles real GLSL through WebGL2;
// happy-dom has no WebGL at all, so the GPU side is stubbed at its seam —
// the preset registry — and only the pure selection logic runs against
// real numbers. (The WebGL2-unavailable branch itself lives in
// HkWallpaperBackdrop, which owns the context probe now.)
registerShaderPresets({
  configured: {
    fragment: "// frag",
    render: { desktop: 2.5, mobile: (a) => 10 * a },
  },
  bare: { fragment: "// frag" },
});

/** Private members the render loop reads; reached structurally, no `any`. */
type PipelineInternals = {
  canvas: HTMLCanvasElement | null;
  currentPreset: string;
  computeScale(): number;
};

const internals = (p: WallpaperShaderPipeline): PipelineInternals =>
  p as unknown as PipelineInternals;

/** Bind a preset + canvas size, then read the scale the shader would get. */
function scaleFor(presetId: string, width: number, height: number): number {
  const p = new WallpaperShaderPipeline();
  const i = internals(p);
  i.currentPreset = presetId;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  i.canvas = canvas;
  return i.computeScale();
}

/** Minimal gl stub for the failure paths: clearColor no-ops, the first
 *  createShader answers null so createProgram bails before any real GL. */
const failingGl = () =>
  ({ clearColor: () => {}, createShader: () => null }) as unknown as WebGL2RenderingContext;

const ctx = (overrides: Partial<HkWallpaperSurfaceContext> = {}): HkWallpaperSurfaceContext => ({
  canvas: document.createElement("canvas"),
  gl: failingGl(),
  presetId: "configured",
  period: "day",
  powerPreference: "high-performance",
  ...overrides,
});

describe("createWallpaperShaderSurface (HkWallpaperBackdrop driver)", () => {
  /** A canvas attached to the document, as the component hands it over —
   *  the driver must never remove it (the component owns the DOM). */
  const ownedCanvas = (): HTMLCanvasElement => {
    const canvas = document.createElement("canvas");
    document.body.append(canvas);
    return canvas;
  };

  it("declines (null) on an unknown preset without touching the canvas", () => {
    const canvas = ownedCanvas();
    expect(createWallpaperShaderSurface(ctx({ presetId: "unknown", canvas }))).toBeNull();
    expect(canvas.isConnected).toBe(true);
  });

  it("declines (null) when the program cannot build, leaving the canvas in place", () => {
    const canvas = ownedCanvas();
    expect(createWallpaperShaderSurface(ctx({ canvas }))).toBeNull();
    expect(canvas.isConnected).toBe(true);
  });

  it("delegates setPeriod/dispose to one pipeline per surface", async () => {
    const attachSpy = vi
      .spyOn(WallpaperShaderPipeline.prototype, "attach")
      .mockReturnValue(true);
    const setPeriodSpy = vi.spyOn(WallpaperShaderPipeline.prototype, "setPeriod").mockImplementation(() => {});
    const destroySpy = vi.spyOn(WallpaperShaderPipeline.prototype, "destroy").mockImplementation(() => {});

    const surface = createWallpaperShaderSurface(ctx());
    expect(surface).not.toBeNull();
    expect(attachSpy).toHaveBeenCalledTimes(1);

    surface!.setPeriod?.("night");
    expect(setPeriodSpy).toHaveBeenCalledWith("night");

    surface!.dispose();
    expect(destroySpy).toHaveBeenCalledTimes(1);

    attachSpy.mockRestore();
    setPeriodSpy.mockRestore();
    destroySpy.mockRestore();
  });
});

describe("attach failure modes", () => {
  it("rolls back to idle on failure", () => {
    const p = new WallpaperShaderPipeline();
    expect(p.attach(ctx().canvas, failingGl(), "configured", "night")).toBe(false);
    expect(p.isActive).toBe(false);
    expect(p.presetId).toBe("");
  });
});

describe("WallpaperShaderPipeline.computeScale (render-config selection)", () => {
  it("routes portrait aspects through the mobile curve with the real ratio", () => {
    // 1080×2400 phone → aspect 0.45; the stub mobile curve (10 × aspect)
    // echoes the exact ratio the pipeline derived from the canvas.
    expect(scaleFor("configured", 1080, 2400)).toBeCloseTo(4.5, 10);
    // 999×1000 → aspect 0.999: still strictly below 1.0, still mobile.
    expect(scaleFor("configured", 999, 1000)).toBeCloseTo(9.99, 10);
  });

  it("uses the flat desktop scale at aspect 1.0 and above", () => {
    // Exactly square is desktop (the mobile branch is aspect < 1.0 only).
    expect(scaleFor("configured", 1000, 1000)).toBe(2.5);
    // 16:9 and 16:9-at-4K landscape monitors.
    expect(scaleFor("configured", 1920, 1080)).toBe(2.5);
    expect(scaleFor("configured", 3840, 2160)).toBe(2.5);
  });

  it("falls back to 1.0 without a canvas, a render config, or a preset", () => {
    const p = new WallpaperShaderPipeline();
    const i = internals(p);
    i.currentPreset = "configured";
    i.canvas = null; // never attached / already destroyed
    expect(i.computeScale()).toBe(1.0);
    // A preset without a render config keeps the neutral scale.
    expect(scaleFor("bare", 1080, 2400)).toBe(1.0);
    // An unknown preset id likewise.
    expect(scaleFor("unknown", 1920, 1080)).toBe(1.0);
  });
});

// ── Resize policy (2026-09-21 phone-IME flicker mitigation) ──────────
//
// The drawing buffer sizes against the LAYOUT viewport
// (documentElement client size) and reallocs only after the viewport
// settles (RESIZE_SETTLE_MS debounce): keyboard animations step the
// visual viewport many times without moving the canvas' CSS box
// (fixed, 100% of the ICB), and each intermediate realloc discarded the
// GPU texture → black flash. These tests pin both halves.
type PipelineResizeInternals = {
  canvas: HTMLCanvasElement | null;
  gl: WebGL2RenderingContext | null;
  onResize: () => void;
};

describe("WallpaperShaderPipeline resize policy", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  const restoreFns: Array<() => void> = [];

  /** Override a getter with a fixed value; restored in afterEach. */
  function stubGetter(obj: object, prop: string, value: number): void {
    const desc = Object.getOwnPropertyDescriptor(obj, prop);
    Object.defineProperty(obj, prop, {
      configurable: true,
      get: () => value,
    });
    restoreFns.push(() => {
      if (desc) Object.defineProperty(obj, prop, desc);
      else delete (obj as Record<string, unknown>)[prop];
    });
  }

  function stubViewport(opts: {
    innerWidth?: number;
    innerHeight?: number;
    icbWidth: number;
    icbHeight: number;
    dpr?: number;
  }): void {
    if (opts.innerWidth !== undefined) stubGetter(window, "innerWidth", opts.innerWidth);
    if (opts.innerHeight !== undefined) stubGetter(window, "innerHeight", opts.innerHeight);
    if (opts.dpr !== undefined) stubGetter(window, "devicePixelRatio", opts.dpr);
    stubGetter(document.documentElement, "clientWidth", opts.icbWidth);
    stubGetter(document.documentElement, "clientHeight", opts.icbHeight);
  }

  /** Bind a canvas + truthy gl onto the pipeline (resize gates on both). */
  function bind(): { p: PipelineResizeInternals; canvas: HTMLCanvasElement } {
    const p = new WallpaperShaderPipeline() as unknown as PipelineResizeInternals;
    const canvas = document.createElement("canvas");
    p.canvas = canvas;
    p.gl = {} as WebGL2RenderingContext;
    return { p, canvas };
  }

  /** Count writes to the canvas backing-store width (realloc proxy). */
  function countWidthWrites(canvas: HTMLCanvasElement): () => number {
    const desc = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, "width")!;
    let n = 0;
    Object.defineProperty(canvas, "width", {
      configurable: true,
      get: () => desc.get!.call(canvas) as number,
      set: (v: number) => {
        n += 1;
        desc.set!.call(canvas, v);
      },
    });
    restoreFns.push(() => delete (canvas as unknown as Record<string, unknown>).width);
    return () => n;
  }

  afterEach(() => {
    vi.useRealTimers();
    while (restoreFns.length > 0) restoreFns.pop()!();
  });

  it("sizes the buffer from the layout viewport, not the visual one", () => {
    // Keyboard open (resizes-visual engines): window.innerHeight
    // shrinks to 400 while the ICB stays 390×844.
    stubViewport({ innerWidth: 390, innerHeight: 400, icbWidth: 390, icbHeight: 844, dpr: 2 });
    const { p, canvas } = bind();
    // Buffer already at the ICB-derived size (dpr 2, scale 0.5 → 1:1).
    canvas.width = 390;
    canvas.height = 844;
    const writes = countWidthWrites(canvas);

    p.onResize();
    vi.advanceTimersByTime(1000);

    // The CSS box never moved → no realloc, no GPU-texture discard.
    expect(writes()).toBe(0);
    expect(canvas.width).toBe(390);
    expect(canvas.height).toBe(844);
  });

  it("reallocs once, after the settle window, on a real geometry change", () => {
    stubViewport({ icbWidth: 390, icbHeight: 700, dpr: 2 });
    const { p, canvas } = bind();
    canvas.width = 390;
    canvas.height = 844;
    const writes = countWidthWrites(canvas);

    p.onResize();
    expect(writes()).toBe(0); // nothing before the settle window
    vi.advanceTimersByTime(140);
    expect(writes()).toBe(1);
    expect(canvas.width).toBe(390);
    expect(canvas.height).toBe(700);
  });

  it("coalesces a resize storm into exactly one realloc", () => {
    // Five stepped viewport sizes (keyboard/drag animation) inside the
    // settle window must end in ONE final realloc, not five.
    const { p, canvas } = bind();
    canvas.width = 390;
    canvas.height = 844;
    const writes = countWidthWrites(canvas);

    const heights = [820, 800, 780, 760, 700];
    for (const h of heights) {
      stubViewport({ icbWidth: 390, icbHeight: h, dpr: 2 });
      p.onResize();
      vi.advanceTimersByTime(50); // below the settle window every time
    }
    expect(writes()).toBe(0);
    vi.advanceTimersByTime(140);
    expect(writes()).toBe(1);
    expect(canvas.height).toBe(700);
  });

  it("cancels a pending realloc when the surface is disposed", () => {
    stubViewport({ icbWidth: 390, icbHeight: 700, dpr: 2 });
    const { p, canvas } = bind();
    canvas.width = 390;
    canvas.height = 844;
    const writes = countWidthWrites(canvas);

    p.onResize();
    expect(vi.getTimerCount()).toBe(1); // the settle timer is armed
    (p as unknown as WallpaperShaderPipeline).destroy();
    // destroy must CLEAR the timer, not merely orphan it: a live timer
    // that no-ops against a nulled canvas still holds the event loop
    // hostage in embedders and reads as "cancelled" to a canvas-write
    // probe — the timer count is the load-bearing probe.
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(1000);
    expect(writes()).toBe(0);
  });
});
