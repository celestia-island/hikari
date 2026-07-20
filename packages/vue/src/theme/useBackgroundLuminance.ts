import { onceFrame, onFrame, type AnimationHandle } from "../runtime/animationBus";

const CVAR = "--float-text-color";
const CVAR_BADGE = "--float-badge-color";

let handle: AnimationHandle | null = null;
let cachedText: string | null = null;
let cachedPrimary: string | null = null;
let pendingPBO: { buffer: WebGLBuffer; gl: WebGL2RenderingContext } | null = null;

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
  const canvas = document.getElementById("s-wallpaper-canvas") as HTMLCanvasElement | null;
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
  const video = document.getElementById("s-wallpaper-video") as HTMLVideoElement | null;
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

export function startLuminanceSampler() {
  stopLuminanceSampler();
  sampleFrame();
  handle = onFrame(() => sampleFrame(), "idle");
}

export function stopLuminanceSampler() {
  if (handle) {
    handle.disconnect();
    handle = null;
  }
  if (pendingPBO) {
    try { pendingPBO.gl.deleteBuffer(pendingPBO.buffer); } catch {}
    pendingPBO = null;
  }
}

export function sampleLuminanceNow() {
  onceFrame(() => sampleFrame());
}

export function invalidateLuminanceCache() {
  cachedText = null;
  cachedPrimary = null;
}
