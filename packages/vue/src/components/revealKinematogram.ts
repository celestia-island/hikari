/**
 * revealKinematogram — the screenshot-safe rendering behind the
 * HkPasswordSurface hold-to-reveal pass (a random-dot kinematogram).
 *
 * Principle: the whole reveal area is filled with ONE shared noise tile,
 * and the only difference between the password glyphs and the background
 * is the direction their slice of that noise drifts — the noise sampled
 * through the glyph mask translates one way, the background noise the
 * opposite way. Human vision segments the glyphs by motion coherence;
 * any SINGLE frame is statistically identical noise inside and outside
 * the glyphs, so a screenshot carries no shape, edge or contrast signal
 * for OCR to lock onto.
 *
 * The glyph mask never reaches the visible canvas as geometry: glyphs
 * are rasterized into an offscreen mask whose pixels are immediately
 * re-composited with noise (`source-in` on the mask itself), so the
 * visible canvas only ever receives ONE background noise fill and a
 * final `drawImage` of noise-on-noise. This is the invariant the
 * component tests pin: no `fillText` with password content may ever
 * target the visible canvas.
 *
 * Threat model & limits: this defeats single-frame capture (screenshots,
 * scrapers, bystander photos). Motion must exist for the human to read,
 * so it also exists for software: an attacker recording video and
 * correlating frames can in principle recover the drift boundary. The
 * reveal is hold-to-reveal and user-initiated; that residual risk is
 * the accepted trade-off.
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
  /** Left edge of the glyph's advance box. */
  x: number;
  /** Advance width (the box the glyph is centered inside). */
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

/** Counter-drift speeds in CSS px/s (glyph noise →, background noise ←).
 * Opposite directions maximize motion segregation at a relative speed
 * that reads clearly without becoming dizzying at ~30fps. */
export const GLYPH_DRIFT_PX_S = 40;
export const BACKGROUND_DRIFT_PX_S = -40;

/** Lightness spread of the noise around the field's ink color. Both
 * regions sample the SAME tile, so any spread is shared and a single
 * frame stays statistically uniform across the glyph boundary. */
const L_SPREAD = 34;
const L_MIN = 4;
const L_MAX = 96;

/** Side margins (CSS px) kept clear of glyphs so the drifting field
 * does not hide text under the lock / eye affordances. */
const SIDE_MARGIN_CSS = 14;

/** Fold an accumulated drift (device px) into the tile period: a value
 * in [0, tile) usable as a pattern translation, correct for negative
 * accumulators (background drifts towards −∞) and periodic in t. */
export function wrapDrift(px: number, tile: number): number {
  const m = px % tile;
  return m < 0 ? m + tile : m;
}

/**
 * Lay the password glyphs out centered in the reveal area, scaling the
 * row down (floor 0.4×) when it overflows — the same fitting contract
 * the legacy jitter pass used, but WITHOUT per-frame randomness: the
 * mask must stay still while only the noise through it moves.
 * `measure` receives CSS-px font sizes and returns CSS-px widths.
 */
export function layoutRevealGlyphs(
  chars: string[],
  measure: (ch: string, fontPx: number) => number,
  aW: number,
  aH: number,
  dpr: number,
): RevealLayout {
  // Visual size matches the legacy pass: ~58% of the box height, pinned
  // to a readable band regardless of box size.
  const basePx = Math.min(18, Math.max(12, aH * 0.58));
  const widths = chars.map((ch) => measure(ch, basePx));
  const raw = widths.reduce((s, w) => s + w, 0);
  const avail = Math.max(16, aW - SIDE_MARGIN_CSS * 2);
  const scale = raw > avail ? Math.max(0.4, avail / raw) : 1;
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
 * tile and the offscreen glyph mask, accumulates the two drift offsets,
 * and composites one frame per animation-bus tick. All state resets per
 * hold (`beginHold`): fresh noise so two holds of the same password
 * never replay the same frame sequence, plus randomized drift phases.
 */
export class RevealNoisePainter {
  private tile: HTMLCanvasElement | null = null;
  private mask: HTMLCanvasElement | null = null;
  private maskKey = "";
  private offsetGlyph = 0;
  private offsetBackground = 0;
  private ok = true;

  /** False once canvas 2D is unusable (no DOM / no 2d context / no
   * pattern support): the caller degrades to the legacy static jitter. */
  get available(): boolean {
    return this.ok;
  }

  /** Current accumulated drifts in device px (test/debug window). */
  peekDrift(): { glyph: number; background: number } {
    return { glyph: this.offsetGlyph, background: this.offsetBackground };
  }

  /** Start a hold: fresh noise tile around the field's ink color and
   * randomized phases so replays are never pixel-identical. */
  beginHold(base: Hsl): void {
    this.offsetGlyph = Math.random() * NOISE_TILE_W;
    this.offsetBackground = Math.random() * NOISE_TILE_W;
    this.maskKey = ""; // force a mask rebuild on the first paint
    this.ok = this.retile(base);
  }

  advance(dt: number, dpr: number): void {
    this.offsetGlyph += GLYPH_DRIFT_PX_S * dpr * dt;
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
      for (let i = 0; i < data.length; i += 4) {
        const nl = Math.min(L_MAX, Math.max(L_MIN, l + (Math.random() * 2 - 1) * L_SPREAD));
        const [r, g, b] = hslToRgb(h, s, nl);
        data[i] = r;
        data[i + 1] = g;
        data[i + 2] = b;
        data[i + 3] = 255;
      }
      tctx.putImageData(img, 0, 0);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Composite one frame: background noise translated by the background
   * drift, then the glyph mask — rebuilt only when `maskKey` (value +
   * canvas size) changes — re-filled with noise translated by the glyph
   * drift and stamped over it. Returns false (and latches
   * `available` off) when the engine cannot support the pattern path.
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
      const og = Math.round(wrapDrift(this.offsetGlyph, NOISE_TILE_W));
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
