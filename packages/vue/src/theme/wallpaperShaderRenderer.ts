import { onFrame, type AnimationHandle } from "../runtime/animationBus";
import type {
  HkWallpaperSurface,
  HkWallpaperSurfaceContext,
  HkWallpaperSurfaceFactory,
} from "../components/HkWallpaperBackdrop";
import type { TimePeriod } from "./useSolarTime";
import { getShaderPreset } from "./wallpaperShaderPresets";

/**
 * The shared WebGL2 pipeline renderer for wallpaper backdrops — the
 * attach()-form driver `HkWallpaperBackdrop` hands a canvas to. Ported
 * from the per-app copies chest (#1123) and erp (#123) carried after the
 * component-layer adoption; those two repos kept identical 280-line
 * renderers, which is exactly the duplication this module retires.
 *
 * The shape is the surface contract, not the pre-component singleton:
 *
 *  - the COMPONENT owns the canvas and the GL context (it created the
 *    context with the `powerPreference` it was configured with — that
 *    attribute was consumed at `getContext` time and is therefore not
 *    something this driver passes again; it rides
 *    `HkWallpaperSurfaceContext` for factories that create their own
 *    context);
 *  - ONE driver instance per attach — the module-level singleton both
 *    forks once kept was the two-layouts-share-one-canvas bug the
 *    component layer was built to kill (either layout's teardown
 *    destroyed the other's pipeline);
 *  - `attach()` never writes the DOM and never removes the canvas on
 *    failure — it returns `false` fully rolled back, and the component
 *    stands down to the solid floor.
 *
 * Uniform contract (what a registered fragment shader may rely on):
 * `u_time` (seconds since attach), `u_resolution` (drawing-buffer px),
 * `u_scale` (see `WallpaperShaderScaleConfig`), `u_period` (0 day,
 * 1 dusk, 2 night) and `u_texture` (sampler2D, unit 0 — bound only when
 * the preset declares a texture). Attributes: `a_position` (fullscreen
 * quad, triangle strip).
 */

/** The fixed vertex stage every preset fragment pairs with. */
export const SHADER_VERTEX = `#version 300 es
in vec2 a_position;
out vec2 v_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_position = a_position;
}`;

/** Viewport-resize settle window (ms) before the drawing buffer is
 *  reallocated — see WallpaperShaderPipeline.onResize. */
const RESIZE_SETTLE_MS = 140;

function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(
  gl: WebGL2RenderingContext,
  vertSrc: string,
  fragSrc: string,
): WebGLProgram | null {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vertSrc);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fragSrc);
  if (!vs || !fs) return null;
  const prog = gl.createProgram();
  if (!prog) return null;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    gl.deleteProgram(prog);
    return null;
  }
  return prog;
}

/**
 * One pipeline lifetime: one canvas attach, one program, one frame loop.
 * Hosts normally reach this through {@link createWallpaperShaderSurface};
 * the class is exported for hosts that need to drive the lifecycle
 * themselves (embedding the canvas outside the backdrop component).
 */
export class WallpaperShaderPipeline {
  private gl: WebGL2RenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private startTime: number = 0;
  private uTime: WebGLUniformLocation | null = null;
  private uResolution: WebGLUniformLocation | null = null;
  private uScale: WebGLUniformLocation | null = null;
  private uPeriod: WebGLUniformLocation | null = null;
  private uTexture: WebGLUniformLocation | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private currentPreset: string = "";
  private currentPeriod: TimePeriod = "day";
  private handle: AnimationHandle | null = null;
  private resizeTimer: ReturnType<typeof setTimeout> | null = null;
  private texture: WebGLTexture | null = null;
  private pendingTexImg: HTMLImageElement | null = null;

  /**
   * Attach to a component-owned canvas + live WebGL2 context (the
   * HkWallpaperBackdrop surface contract: the component owns the CSS box
   * and the context, the driver owns the drawing buffer and the pixels).
   * No DOM writes, no canvas removal on failure — the caller's canvas
   * stays exactly where it was. Returns false (fully rolled back) when
   * the preset is unknown or the program cannot build.
   */
  attach(
    canvas: HTMLCanvasElement,
    gl: WebGL2RenderingContext,
    presetId: string,
    period: TimePeriod,
  ): boolean {
    this.destroy();

    const preset = getShaderPreset(presetId);
    if (!preset) return false;

    this.currentPreset = presetId;
    this.currentPeriod = period;

    this.canvas = canvas;
    this.gl = gl;
    gl.clearColor(0, 0, 0, 0);

    const prog = createProgram(gl, SHADER_VERTEX, preset.fragment);
    if (!prog) {
      this.gl = null;
      this.canvas = null;
      this.currentPreset = "";
      return false;
    }
    this.program = prog;

    gl.useProgram(prog);

    this.uTime = gl.getUniformLocation(prog, "u_time");
    this.uResolution = gl.getUniformLocation(prog, "u_resolution");
    this.uScale = gl.getUniformLocation(prog, "u_scale");
    this.uPeriod = gl.getUniformLocation(prog, "u_period");
    this.uTexture = gl.getUniformLocation(prog, "u_texture");

    if (preset.texture) {
      this.loadTexture(preset.texture);
    }

    const vao = gl.createVertexArray();
    this.vao = vao;
    gl.bindVertexArray(vao);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW,
    );

    const aPos = gl.getAttribLocation(prog, "a_position");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    this.startTime = performance.now();
    this.resize();

    this.handle = onFrame((ctx) => this.render(ctx), "normal");

    window.addEventListener("resize", this.onResize);
    return true;
  }

  setPeriod(period: TimePeriod) {
    this.currentPeriod = period;
  }

  private render(ctx: { now: number }) {
    const gl = this.gl;
    if (!gl || !this.canvas) return;

    const elapsed = (ctx.now - this.startTime) / 1000;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(this.uTime, elapsed);
    gl.uniform2f(this.uResolution, this.canvas.width, this.canvas.height);
    if (this.uScale) gl.uniform1f(this.uScale, this.computeScale());

    let periodVal = 2.0;
    if (this.currentPeriod === "day") periodVal = 0.0;
    else if (this.currentPeriod === "dusk") periodVal = 1.0;
    gl.uniform1f(this.uPeriod, periodVal);

    if (this.texture && this.uTexture) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.uniform1i(this.uTexture, 0);
    }

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  private computeScale(): number {
    if (!this.canvas) return 1.0;
    const preset = getShaderPreset(this.currentPreset);
    const cfg = preset?.render;
    if (!cfg) return 1.0;
    const aspect = this.canvas.width / this.canvas.height;
    if (aspect < 1.0) {
      return cfg.mobile(aspect);
    }
    return cfg.desktop;
  }

  private loadTexture(url: string) {
    const gl = this.gl;
    if (!gl) return;

    const tex = gl.createTexture();
    if (!tex) return;
    this.texture = tex;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));

    const img = new Image();
    this.pendingTexImg = img;
    img.onload = () => {
      if (!this.gl || !this.texture || this.pendingTexImg !== img) return;
      this.gl.bindTexture(gl.TEXTURE_2D, this.texture);
      this.gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      this.gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      this.gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      this.gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      this.gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      this.pendingTexImg = null;
    };
    img.src = url;
  }

  private onResize = () => {
    // Settle-debounce: viewport-resize storms (phone keyboard animations
    // step the viewport every frame for ~250ms; window drags/rotations
    // step it too) must not reallocate the drawing buffer per step —
    // each realloc discards the GPU texture and the gap before the next
    // submitted frame renders as a black flash. While a debounce is
    // pending the canvas keeps drawing into the old buffer; CSS
    // (width/height 100%) stretches it, which background art survives
    // fine for the ~140ms settle window.
    if (this.resizeTimer != null) clearTimeout(this.resizeTimer);
    this.resizeTimer = setTimeout(() => {
      this.resizeTimer = null;
      this.resize();
    }, RESIZE_SETTLE_MS);
  };

  private resize() {
    if (!this.canvas || !this.gl) return;
    // Size against the LAYOUT viewport (documentElement client size),
    // not window.innerWidth/innerHeight (visual viewport). Under the
    // default interactive-widget=resizes-visual the soft keyboard
    // shrinks only the visual viewport — this canvas' CSS box (fixed,
    // 100% of the ICB) never moves, so reallocating the buffer on an
    // innerHeight change produced zero visual change while discarding
    // the GPU texture mid-animation (the 2026-09-21 phone IME black
    // flicker report). The layout viewport only moves for real
    // geometry changes (URL-bar collapse, rotation, window resize),
    // which is exactly when the buffer SHOULD follow.
    const vw = document.documentElement.clientWidth || window.innerWidth;
    const vh = document.documentElement.clientHeight || window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const scale = 0.5;
    const w = Math.floor(vw * dpr * scale);
    const h = Math.floor(vh * dpr * scale);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.canvas.style.width = "100%";
      this.canvas.style.height = "100%";
    }
  }

  destroy() {
    if (this.handle) {
      this.handle.disconnect();
      this.handle = null;
    }
    if (this.resizeTimer != null) {
      clearTimeout(this.resizeTimer);
      this.resizeTimer = null;
    }
    window.removeEventListener("resize", this.onResize);
    if (this.gl) {
      if (this.vao) this.gl.deleteVertexArray(this.vao);
      if (this.program) this.gl.deleteProgram(this.program);
      if (this.texture) this.gl.deleteTexture(this.texture);
      this.gl = null;
    }
    this.program = null;
    this.vao = null;
    this.uTime = null;
    this.uResolution = null;
    this.uScale = null;
    this.uPeriod = null;
    this.uTexture = null;
    this.texture = null;
    this.pendingTexImg = null;
    // The canvas is component-owned (HkWallpaperBackdrop removes it with
    // its own tree); the driver only forgets it.
    this.canvas = null;
    this.currentPreset = "";
  }

  get isActive(): boolean {
    return this.handle !== null;
  }

  get presetId(): string {
    return this.currentPreset;
  }
}

/**
 * The ready-made pipeline driver for `HkWallpaperBackdrop`: one
 * {@link WallpaperShaderPipeline} per surface attach, resolved against
 * the shared preset registry ({@link getShaderPreset}). Hand it to the
 * component through the backdrop decor registration's props bag:
 *
 * ```ts
 * registerThemeDecor({
 *   themeId: "*", slot: "backdrop", component: HkWallpaperBackdrop,
 *   props: { createSurface: createWallpaperShaderSurface },
 * });
 * ```
 *
 * Returning `null` on an unknown preset or a failed program build is the
 * contract's "decline" — the component then stands down to the solid
 * floor instead of leaving an invisible canvas on screen.
 */
export const createWallpaperShaderSurface: HkWallpaperSurfaceFactory = (
  ctx: HkWallpaperSurfaceContext,
): HkWallpaperSurface | null => {
  const pipeline = new WallpaperShaderPipeline();
  if (!pipeline.attach(ctx.canvas, ctx.gl, ctx.presetId, ctx.period)) {
    return null;
  }
  return {
    setPeriod: (period) => pipeline.setPeriod(period),
    dispose: () => pipeline.destroy(),
  };
};
