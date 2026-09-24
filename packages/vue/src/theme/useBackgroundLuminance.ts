import { onceFrame, onFrame, type AnimationHandle } from "../runtime/animationBus";

const CVAR = "--float-text-color";
const CVAR_BADGE = "--float-badge-color";

// ── Wallpaper surface sources: the explicit DOM contract ────────────────
//
// This sampler used to find its source by hard-coded element id
// (`s-wallpaper-canvas` / `s-wallpaper-video` — chest's renderer, the only
// consumer at the time). That is an IMPLICIT contract between two packages,
// and it fails SILENTLY for the second consumer: `getElementById` returns
// null, `sampleFrame` falls through to the body background, and text
// contrast is computed from the wrong surface with no error anywhere.
//
// The contract is explicit, in one direction only: whoever owns a wallpaper
// surface REGISTERS it, as a getter, because a renderer may re-create the
// element — hikari's HkWallpaperBackdrop re-renders its layers from state,
// so a captured element reference would go stale on the first wallpaper
// switch.
//
// The id fallback kept smaller hosts working while they migrated, and both
// had landed by 2026-09-24 (chest #1123, erp.celestia.world #123): every
// surface owner now registers, none of them renders those ids, and a
// fallback that matches nothing is exactly the silent wrong-surface read it
// was meant to avoid. So it is gone, and "no registration" means null —
// `sampleFrame` then takes its documented body-background path.

/** The two wallpaper surfaces the sampler can read. */
export type WallpaperSurfaceKind = "canvas" | "video";

/** Getter bag a surface owner registers; both entries are optional. */
export interface WallpaperSurfaceSources {
  /** The pipeline/WebGL surface. */
  canvas?: () => HTMLCanvasElement | null | undefined;
  /** The moving-image surface. */
  video?: () => HTMLVideoElement | null | undefined;
}

const surfaceSources = new Map<symbol, WallpaperSurfaceSources>();

/**
 * Register a surface owner's elements. Returns a disposer — call it on
 * unmount, or a torn-down instance keeps answering the sampler with a
 * detached element.
 *
 * Resolution is most-recently-registered-first among the entries that
 * actually resolve: with two backdrops mounted (a chat layout and an admin
 * layout, chest's shipped shape), the sampler reads the newest live surface
 * and falls back rather than throwing.
 */
export function registerWallpaperSurfaceSources(sources: WallpaperSurfaceSources): () => void {
  const token = Symbol("wallpaper-surface");
  surfaceSources.set(token, sources);
  return () => {
    surfaceSources.delete(token);
  };
}

/** Resolve the live element for `kind`: the newest registered source that
 *  resolves, else null. Registration is the whole contract — there is no id
 *  to fall back to. */
export function resolveWallpaperSurfaceElement(kind: WallpaperSurfaceKind): HTMLElement | null {
  const tokens = [...surfaceSources.keys()];
  for (let i = tokens.length - 1; i >= 0; i -= 1) {
    const source = surfaceSources.get(tokens[i]!);
    const el = source?.[kind]?.();
    if (el) return el;
  }
  return null;
}

let handle: AnimationHandle | null = null;
let cachedText: string | null = null;
let cachedPrimary: string | null = null;
let pendingPBO: { buffer: WebGLBuffer; gl: WebGL2RenderingContext } | null = null;
/** Live claims on the shared loop — see retainLuminanceSampler. */
let retainCount = 0;
/** One warning per loop start, not one per frame — see sampleFrameSafely. */
let sampleFailureReported = false;

/** Start the shared loop (no reference bookkeeping). */
function beginSampler(): void {
  endSampler();
  sampleFailureReported = false;
  sampleFrameSafely();
  handle = onFrame(() => sampleFrameSafely(), "idle");
}

/** Stop the shared loop (no reference bookkeeping). */
function endSampler(): void {
  if (handle) {
    handle.disconnect();
    handle = null;
  }
  if (pendingPBO) {
    try { pendingPBO.gl.deleteBuffer(pendingPBO.buffer); } catch {}
    pendingPBO = null;
  }
}

function luminance(r: number, g: number, b: number): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function applyLuminance(lum: number) {
  const el = document.documentElement;
  if (lum < 0.45) {
    el.style.setProperty(CVAR, "255, 255, 255");
    el.style.setProperty(CVAR_BADGE, "255, 255, 255");
  } else {
    if (cachedText === null || cachedPrimary === null) {
      const cs = getComputedStyle(el);
      cachedText = cs.getPropertyValue("--color-text").trim();
      cachedPrimary = cs.getPropertyValue("--color-primary").trim();
    }
    el.style.setProperty(CVAR, cachedText);
    el.style.setProperty(CVAR_BADGE, cachedPrimary);
  }
}

function sampleShader(): boolean {
  const canvas = resolveWallpaperSurfaceElement("canvas") as HTMLCanvasElement | null;
  if (!canvas) return false;
  const gl = canvas.getContext("webgl2");
  if (!gl) return false;

  let applied = false;

  if (pendingPBO && pendingPBO.gl === gl) {
    try {
      const data = new Uint8Array(4);
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, pendingPBO.buffer);
      gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, data, 0, 4);
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
      gl.deleteBuffer(pendingPBO.buffer);
      applyLuminance(luminance(data[0], data[1], data[2]));
      applied = true;
    } catch {
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
      gl.deleteBuffer(pendingPBO.buffer);
    }
  }
  pendingPBO = null;

  const pbo = gl.createBuffer();
  if (pbo) {
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, pbo);
    gl.bufferData(gl.PIXEL_PACK_BUFFER, 4, gl.STREAM_READ);
    const cx = Math.floor(canvas.width / 2);
    const cy = Math.floor(canvas.height / 2);
    gl.readPixels(cx, cy, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, 0);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    pendingPBO = { buffer: pbo, gl };
  }

  return applied;
}

function sampleMedia(el: HTMLImageElement | HTMLVideoElement): boolean {
  try {
    let w: number, h: number;
    if (el instanceof HTMLImageElement) {
      w = el.naturalWidth || 1;
      h = el.naturalHeight || 1;
    } else {
      w = el.videoWidth || 1;
      h = el.videoHeight || 1;
    }
    w = Math.min(w, 64);
    h = Math.min(h, 64);
    const c = document.createElement("canvas");
    c.width = 1;
    c.height = 1;
    const ctx = c.getContext("2d");
    if (!ctx) return false;
    ctx.drawImage(el, w / 2, h / 2, 1, 1, 0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    applyLuminance(luminance(r, g, b));
    return true;
  } catch {
    return false;
  }
}

function sampleFromBodyBg(): boolean {
  const raw = getComputedStyle(document.body).backgroundColor;
  const m = raw.match(/\d+/g);
  if (!m || m.length < 3) return false;
  applyLuminance(luminance(+m[0], +m[1], +m[2]));
  return true;
}

function sampleFrame() {
  if (sampleShader()) return;
  const video = resolveWallpaperSurfaceElement("video") as HTMLVideoElement | null;
  if (video && video.readyState >= 2 && sampleMedia(video)) return;
  const bgImg = getComputedStyle(document.body).backgroundImage;
  if (bgImg && bgImg !== "none") {
    const urlMatch = bgImg.match(/url\(["']?(.*?)["']?\)/);
    if (urlMatch) {
      const img = document.createElement("img");
      img.crossOrigin = "anonymous";
      img.src = urlMatch[1];
      img.onload = () => { sampleMedia(img); };
      return;
    }
  }
  sampleFromBodyBg();
}

/**
 * Every sampler entry point goes through here.
 *
 * The surfaced element is HOST-provided DOM: a foreign WebGL context, a
 * video whose media pipeline is in any state, an element detached mid-read.
 * A throw from one of those used to be impossible to hit (the ids were the
 * host renderer's own, in the host's own process) and is now a plain
 * possibility — and the destructive shape of it is what matters: the first
 * synchronous sample runs inside the registering component's `mounted` hook,
 * so an escaping throw takes the COMPONENT's mount down over a luminance
 * read. A surface that cannot be read is a missing sample, not a crash; the
 * next frame tries again.
 */
function sampleFrameSafely(): void {
  try {
    sampleFrame();
  } catch (err) {
    // Reported ONCE per loop start (a broken surface would otherwise warn
    // every idle beat), then the sampler keeps trying.
    if (!sampleFailureReported) {
      sampleFailureReported = true;
      if (typeof console !== "undefined") {
        console.warn("[useBackgroundLuminance] wallpaper surface unreadable; skipping samples", err);
      }
    }
  }
}

export function startLuminanceSampler() {
  // An explicit start owns exactly one reference; a running retain/release
  // pair from a mounted backdrop is replaced, not stacked.
  retainCount = 1;
  beginSampler();
}

export function stopLuminanceSampler() {
  retainCount = 0;
  endSampler();
}

/**
 * Take a reference on the shared sampler loop. The first reference starts
 * it; further references are no-ops (one loop, however many consumers
 * started it).
 *
 * Why this exists next to `startLuminanceSampler`: a component that mounts
 * the sampler and stops it on unmount is a SINGLE-instance contract —
 * chest mounts a backdrop in both its chat layout and its admin layout, so
 * the first unmount would stop sampling for the surviving backdrop and
 * text contrast on the wallpaper would silently freeze at its last value.
 * Reference counting makes "unmount releases MY claim" the observable
 * behaviour; `start/stop` keep their absolute (host-owned) semantics.
 */
export function retainLuminanceSampler(): void {
  retainCount += 1;
  if (retainCount === 1) beginSampler();
}

/** Drop one reference; the loop stops when the last one goes. */
export function releaseLuminanceSampler(): void {
  if (retainCount === 0) return;
  retainCount -= 1;
  if (retainCount === 0) endSampler();
}

/** Live reference count (0 = not sampling). Diagnostic/test seam. */
export function luminanceSamplerRefCount(): number {
  return retainCount;
}

export function sampleLuminanceNow() {
  onceFrame(() => sampleFrameSafely());
}

export function invalidateLuminanceCache() {
  cachedText = null;
  cachedPrimary = null;
}
