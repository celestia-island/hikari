/**
 * revealKinematogram — the canvas rendering behind the HkPasswordSurface
 * reveal strategies: the boiling-noise kinematogram (the "noise"
 * strategy — screenshot-safe in any single frame) and the sweep-window
 * kinematics for the "sweep" strategy (a readable band over the noise;
 * deliberately NOT single-frame safe). Both serve hold and toggle
 * triggers; the "plain" strategy bypasses this module entirely.
 *
 * Principle: the whole reveal area is filled with ONE shared noise tile.
 * The glyph mask stays perfectly still while the BACKGROUND noise drifts
 * sideways; the noise sampled through the glyph mask is RE-SAMPLED at a
 * random tile phase every frame ("boiling"). A human segments the glyphs
 * instantly — a stable silhouette of flicker against a calmly drifting
 * surround — while any SINGLE frame is statistically identical noise
 * inside and outside the glyphs (both regions sample the same tile), so
 * a screenshot carries no shape, edge or contrast signal for OCR to lock
 * onto. The earlier design drifted glyph and background noise in opposite
 * directions; direction-opponent motion alone proved too weak a
 * segmentation cue at field font sizes (fine 1px grain + fast ±40px/s
 * drift rendered the reveal illegible in practice).
 *
 * Readability levers (all preserve the single-frame uniformity invariant):
 * - NOISE_GRAIN: the tile is random per 2×2 device-px block, not per
 *   pixel — coarse grain carries a far stronger temporal/motion signal,
 *   especially at dpr 1.
 * - Boiling glyph noise (see above): frame-rate independent — even a
 *   throttled ~15fps bus still shows flicker vs drift.
 * - The glyph layout uses a larger size band with letter spacing (see
 *   layoutRevealGlyphs).
 *
 * The glyph mask never reaches the visible canvas as geometry: glyphs
 * are rasterized into an offscreen mask whose pixels are immediately
 * re-composited with noise (`source-in` on the mask itself), so the
 * visible canvas only ever receives noise fills and a noise-composited
 * stamp. This is the invariant the component tests pin: no `fillText`
 * with password content may ever target the visible canvas while the
 * noise strategy is active.
 *
 * Threat model & limits: this defeats single-frame capture (screenshots,
 * scrapers, bystander photos). Motion must exist for the human to read,
 * so it also exists for software: an attacker recording video and
 * correlating frames can in principle recover the glyph boundary. One
 * finer nuance, for completeness: because both regions sample the SAME
 * tile, the glyph texture is an exact duplicate of the background
 * texture at one shift, so a pixel-exact capture could in principle
 * recover the mask by shifted self-correlation — no OCR needed, but
 * strictly costlier than the video attack above, and inherent to any
 * shared-tile kinematogram (the old counter-drift design included).
 * The reveal is user-initiated (hold, or toggle with auto-hide); that
 * residual risk is the accepted trade-off. Consumers that do NOT want
 * this threat model can pick `revealStrategy="plain"` on HkInput for the
 * industry-standard readable reveal.
 *
 * Reduced motion: the shared animation bus parks, so the field would
 * freeze into unreadable pure noise. HkPasswordSurface therefore checks
 * the park state directly at hold start and re-checks it for the whole
 * hold on a recurring bare-timer watchdog, degrading to the legacy
 * static per-glyph jitter drawing instead.
 */

/** One glyph's placement on the offscreen mask, in DEVICE pixels. */
export interface RevealGlyph {
  ch: string;
  /** Left edge of the glyph's advance box — also the draw position:
   *  rasterizers draw textAlign="left" at x, so the ×1.2 letter-spacing
   *  lands entirely trailing and the row sits a fraction of a glyph left
   *  of exact center (imperceptible; not worth a centering pass). */
  x: number;
  /** Advance width (measured glyph width × the letter-spacing factor). */
  advance: number;
}

/** A fully resolved glyph row for one password value at one canvas size. */
export interface RevealLayout {
  glyphs: RevealGlyph[];
  /** Font size in DEVICE px (CSS size × dpr) for a crisp mask. */
  fontPx: number;
}

/** Noise tile size in device px. Wide enough that the horizontal wrap
 * period stays well above a typical field width; random content makes
 * the wrap seam invisible, and the tile carries no glyph information. */
export const NOISE_TILE_W = 512;
export const NOISE_TILE_H = 128;

/** Noise grain in device px: the tile is randomized per GRAIN×GRAIN
 * block instead of per pixel. Coarse grain is THE readability lever for
 * the kinematogram — 1px noise at dpr 1 is below the spatial frequency
 * where flicker/motion segmentation reads glyph silhouettes, so every
 * glyph boundary smeared into static. Both regions sample the SAME
 * tile, so grain size never breaks single-frame uniformity. */
export const NOISE_GRAIN = 2;

/** Background drift speed in CSS px/s (background noise ←). Slow enough
 * that the eye can track the texture; the segmentation signal is the
 * flicker-vs-drift contrast, not raw speed. The glyph region does NOT
 * drift — its noise is re-sampled at a random tile phase every frame
 * (boiling), which reads at any frame rate. */
export const BACKGROUND_DRIFT_PX_S = -22;

/** Lightness spread of the noise around the field's ink color. Both
 * regions sample the SAME tile, so any spread is shared and a single
 * frame stays statistically uniform across the glyph boundary. */
const L_SPREAD = 34;
const L_MIN = 4;
const L_MAX = 96;

/** Side margins (CSS px) kept clear of glyphs so the drifting field
 * does not hide text under the lock / eye affordances. */
const SIDE_MARGIN_CSS = 14;

/** Extra advance width per glyph, as a multiple of the measured width.
 * Password characters pack edge-to-edge at the natural advance, and at
 * noise-reveal resolutions that crowding is the difference between
 * reading a string and guessing it — 20% tracking buys the separation
 * at a modest width cost. */
const LETTER_SPACING_SCALE = 1.2;

/** Fold an accumulated drift (device px) into the tile period: a value
 * in [0, tile) usable as a pattern translation, correct for negative
 * accumulators (background drifts towards −∞) and periodic in t. */
export function wrapDrift(px: number, tile: number): number {
  const m = px % tile;
  return m < 0 ? m + tile : m;
}

/** Sweep-window kinematics for the "sweep" reveal strategy (all values
 * in DEVICE px): the readable window's CENTER travels from `spanStart`
 * to `spanEnd` at a constant pace, dwells at the end for
 * SWEEP_END_PAUSE_S so the tail characters get read, then loops for as
 * long as the reveal is held. Pure math — unit-pinned.
 *
 * Readability contract: inside the window the password is drawn as
 * ordinary high-contrast text (the eye reads it effortlessly); outside
 * it, the boiling-noise field continues. A single screenshot therefore
 * leaks only the characters under the window — weaker than the "noise"
 * strategy's full single-frame safety, but far more readable. */
export const SWEEP_SPEED_CSS_PX_S = 220;
export const SWEEP_END_PAUSE_S = 0.45;

export function sweepWindow(
  spanStart: number,
  spanEnd: number,
  winW: number,
  t: number,
  dpr: number,
): { x: number; w: number } {
  const travel = Math.max(1, spanEnd - spanStart);
  const moveT = travel / (SWEEP_SPEED_CSS_PX_S * dpr);
  const cycle = moveT + SWEEP_END_PAUSE_S;
  const phase = ((t % cycle) + cycle) % cycle;
  const x = phase >= moveT ? spanEnd : spanStart + travel * (phase / moveT);
  return { x, w: winW };
}

/**
 * Lay the password glyphs out centered in the reveal area, scaling the
 * row down (floor 0.5×) when it overflows. The mask must stay perfectly
 * still while only the noise through it moves, so nothing here is
 * per-frame random. (The legacy jitter fallback keeps its own older
 * fitting band; this layout serves the noise mask and the plain pass.)
 * `measure` receives CSS-px font sizes and returns CSS-px widths.
 */
export function layoutRevealGlyphs(
  chars: string[],
  measure: (ch: string, fontPx: number) => number,
  aW: number,
  aH: number,
  dpr: number,
): RevealLayout {
  // Visual size band: ~62% of the box height, clamped to [13, 22] CSS
  // px — the 12–18 band was the main illegibility complaint (18px noise
  // glyphs are at the edge of letterform recognition; shrinking long
  // passwords to 0.4× of that was hopeless).
  const basePx = Math.min(22, Math.max(13, aH * 0.62));
  const widths = chars.map((ch) => measure(ch, basePx) * LETTER_SPACING_SCALE);
  const raw = widths.reduce((s, w) => s + w, 0);
  const avail = Math.max(16, aW - SIDE_MARGIN_CSS * 2);
  const scale = raw > avail ? Math.max(0.5, avail / raw) : 1;
  const fontPx = basePx * scale * dpr;
  const advanceScale = scale * dpr;
  let x = (aW / 2 - (raw * scale) / 2) * dpr;
  const glyphs: RevealGlyph[] = [];
  for (let i = 0; i < chars.length; i++) {
    const advance = widths[i]! * advanceScale;
    glyphs.push({ ch: chars[i]!, x, advance });
    x += advance;
  }
  return { glyphs, fontPx };
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs((2 * l) / 100 - 1)) * (s / 100);
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;
  if (hp < 1) {
    r = c;
    g = x;
  } else if (hp < 2) {
    r = x;
    g = c;
  } else if (hp < 3) {
    g = c;
    b = x;
  } else if (hp < 4) {
    g = x;
    b = c;
  } else if (hp < 5) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  const m = l / 100 - c / 2;
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

type Hsl = readonly [number, number, number];

/**
 * Stateful painter for one password surface instance: owns the noise
 * tile and the offscreen glyph mask, accumulates the background drift,
 * and composites one frame per animation-bus tick. All state resets per
 * hold (`beginHold`): fresh noise so two holds of the same password
 * never replay the same frame sequence, plus a randomized drift phase.
 */
export class RevealNoisePainter {
  private tile: HTMLCanvasElement | null = null;
  private mask: HTMLCanvasElement | null = null;
  private maskKey = "";
  private offsetBackground = 0;
  private ok = true;

  /** False once canvas 2D is unusable (no DOM / no 2d context / no
   * pattern support): the caller degrades to the legacy static jitter. */
  get available(): boolean {
    return this.ok;
  }

  /** Current accumulated background drift in device px (test/debug
   * window). The glyph region has no accumulator — its phase is a fresh
   * random draw per frame (boiling). */
  peekDrift(): { background: number } {
    return { background: this.offsetBackground };
  }

  /** Start a hold: fresh noise tile around the field's ink color and a
   * randomized background phase so replays are never pixel-identical. */
  beginHold(base: Hsl): void {
    this.offsetBackground = Math.random() * NOISE_TILE_W;
    this.maskKey = ""; // force a mask rebuild on the first paint
    this.ok = this.retile(base);
  }

  advance(dt: number, dpr: number): void {
    this.offsetBackground += BACKGROUND_DRIFT_PX_S * dpr * dt;
  }

  private retile(base: Hsl): boolean {
    try {
      if (typeof document === "undefined") return false;
      this.tile ??= document.createElement("canvas");
      // Size the backing store to the noise tile BEFORE putImageData:
      // a fresh canvas defaults to 300×150, which would silently clip
      // the 512×128 ImageData (real pattern period 300 instead of 512,
      // transparent rows below 128) and desync wrapDrift's modulus
      // from the actual pattern period.
      this.tile.width = NOISE_TILE_W;
      this.tile.height = NOISE_TILE_H;
      const tctx = this.tile.getContext("2d");
      if (!tctx || typeof tctx.createImageData !== "function") return false;
      const img = tctx.createImageData(NOISE_TILE_W, NOISE_TILE_H);
      if (!img) return false;
      const data = img.data;
      const [h, s, l] = base;
      // Randomize per GRAIN×GRAIN block, then stamp the block's pixels:
      // coarse grain is what makes the boiling/drift silhouette readable
      // (see the NOISE_GRAIN comment).
      for (let y = 0; y < NOISE_TILE_H; y += NOISE_GRAIN) {
        for (let x = 0; x < NOISE_TILE_W; x += NOISE_GRAIN) {
          const nl = Math.min(L_MAX, Math.max(L_MIN, l + (Math.random() * 2 - 1) * L_SPREAD));
          const [r, g, b] = hslToRgb(h, s, nl);
          for (let dy = 0; dy < NOISE_GRAIN; dy++) {
            const row = (y + dy) * NOISE_TILE_W;
            for (let dx = 0; dx < NOISE_GRAIN; dx++) {
              const i = (row + x + dx) * 4;
              data[i] = r;
              data[i + 1] = g;
              data[i + 2] = b;
              data[i + 3] = 255;
            }
          }
        }
      }
      tctx.putImageData(img, 0, 0);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Composite one frame: background noise translated by the accumulated
   * background drift, then the glyph mask — rebuilt only when `maskKey`
   * (value + canvas size) changes — re-filled with noise sampled at a
   * FRESH RANDOM tile phase (the boiling that makes glyphs pop without
   * any single-frame glyph signal) and stamped over the background.
   * Returns false (WITHOUT latching `available` off — pattern-null
   * engines retry the pattern path every frame by design, so a later
   * working pattern resumes the kinematogram; only a thrown error
   * latches the painter off) when the engine cannot support the pattern
   * path this frame.
   */
  paint(
    ctx: CanvasRenderingContext2D,
    W: number,
    H: number,
    layout: RevealLayout,
    monoFont: string,
    maskKey: string,
  ): boolean {
    if (!this.tile || !this.ok) return false;
    try {
      if (typeof document === "undefined") return false;
      this.mask ??= document.createElement("canvas");
      if (this.mask.width !== W || this.mask.height !== H) {
        // Assigning width/height wipes the canvas: force a rebuild.
        this.mask.width = W;
        this.mask.height = H;
        this.maskKey = "";
      }
      const mctx = this.mask.getContext("2d");
      if (!mctx) return false;

      if (this.maskKey !== maskKey) {
        mctx.globalCompositeOperation = "source-over";
        mctx.clearRect(0, 0, W, H);
        // Opaque white: only the ALPHA of this raster matters — it is
        // fully replaced by noise on the very next step, every frame.
        mctx.fillStyle = "#fff";
        mctx.textAlign = "left";
        mctx.textBaseline = "middle";
        mctx.font = `${layout.fontPx.toFixed(2)}px ${monoFont}`;
        for (const g of layout.glyphs) {
          mctx.fillText(g.ch, g.x, H / 2);
        }
        this.maskKey = maskKey;
      }

      const patGlyph = mctx.createPattern(this.tile, "repeat");
      if (!patGlyph) return false;
      mctx.save();
      mctx.globalCompositeOperation = "source-in";
      mctx.imageSmoothingEnabled = false;
      // Boiling: a fresh random tile phase EVERY frame, not an
      // accumulated drift. The glyph region flickers while the
      // background slides — a flicker-vs-drift silhouette the eye
      // segments instantly, at any frame rate, while a single frame
      // stays statistically uniform noise (same tile, same
      // distribution, random phase).
      const og = Math.floor(Math.random() * NOISE_TILE_W);
      mctx.translate(-og, 0);
      mctx.fillStyle = patGlyph;
      mctx.fillRect(og, 0, W + 2, H);
      mctx.restore();

      const patBg = ctx.createPattern(this.tile, "repeat");
      if (!patBg) return false;
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      const ob = Math.round(wrapDrift(this.offsetBackground, NOISE_TILE_W));
      ctx.translate(-ob, 0);
      ctx.fillStyle = patBg;
      ctx.fillRect(ob, 0, W + 2, H);
      ctx.restore();
      ctx.drawImage(this.mask, 0, 0);
      return true;
    } catch {
      this.ok = false;
      return false;
    }
  }
}
