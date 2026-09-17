import { Eye, EyeOff } from "lucide-vue-next";
import {
  Comment,
  computed,
  defineComponent,
  onMounted,
  onUnmounted,
  ref,
  watch,
  type PropType,
  useAttrs,
} from "vue";

import { useI18n } from "../i18n/context";
import { credentialAutocomplete } from "../runtime/credentialAutofill";

import { onFrame, onceFrame, isAnimationParked, type AnimationHandle } from "../runtime/animationBus";
import { scheduleCron, scheduleCronAfter, type CronHandle } from "../runtime/cronBus";
import { scheduleInterval, type IntervalHandle } from "../runtime/intervalBus";
import { passwordLevel, type PasswordLevel, type PasswordStrengthEvaluator } from "../utils/password";

import HListTransition from "./HkListTransition";
import HkTooltip from "./HkTooltip";
import { HkPlaceholderMarquee, type PlaceholderVariant } from "./HkPlaceholderMarquee";
import {
  layoutRevealGlyphs,
  RevealFilterPainter,
  RevealNoisePainter,
  sweepWindow,
  type RevealLayout,
} from "./revealKinematogram";
import "./HkPasswordSurface.scss";
import { drawnScale } from "../composables/layoutGeometry";

interface Ripple {
  radius: number;
  peak: number;
}

/**
 * HkPasswordSurface — the internal rendering engine behind
 * `HkInput variant="password"`.
 *
 * It carries the hikari password-field visual language (canvas dot matrix
 * with input ripples, centered breathing placeholder, caps-lock / full-
 * width hints, blur "entered" hint) and the password-specific behaviors
 * (pending-clear refocus semantics, IME composition, autofill polling).
 * HkInput owns the wrapper / label / error / hint chrome and delegates
 * here — the public API is HkInput's, this file is an implementation
 * detail and is NOT exported from the package index.
 *
 * Right-edge affordance (`passwordTrailing`):
 * - "eye" (default): the reveal button. What the reveal SHOWS is chosen
 *   by `revealStrategy`, how it is TRIGGERED by `revealTrigger`:
 *   - strategy "filter" (default): dual counter-drifting spatter
 *     layers — the glyph row is a set of STATIC apertures filled with a
 *     spatter texture drifting one way, over a statistically identical
 *     spatter field drifting the other way, the glyphs lifted by a
 *     small lightness pedestal with a soft halo band around the row
 *     (see revealKinematogram.ts). The whole row stays readable in
 *     motion while any single frame — a screenshot — carries no glyph
 *     structure, only a weak mean-luminance signal dissolved into the
 *     halo ramp. Reduced motion or a pattern-less engine degrades to
 *     the fully readable static plain text.
 *   - strategy "sweep": a readable window — the password is drawn as
 *     ordinary high-contrast text inside a narrow band that sweeps
 *     across the row over the boiling-noise field. Reading is
 *     effortless; a single frame shows the characters under the band
 *     in the clear (partial capture resistance only).
 *   - strategy "noise": the screenshot-safe boiling-noise kinematogram:
 *     one shared noise tile, the background drifting sideways while the
 *     noise sampled through the password glyphs is re-sampled at a
 *     random phase every frame. Statistically pure noise in ANY single
 *     frame (nothing for OCR), but the hardest to read; opt-in for
 *     high-exposure surfaces. When the animation bus is parked
 *     (reduced motion) or the engine cannot run the pattern path, the
 *     reveal degrades to the legacy static per-glyph jitter drawing.
 *   - strategy "plain": the industry-standard readable reveal — the
 *     password is drawn as ordinary text on the canvas while revealed
 *     (the DOM input stays type="password"). Readable by everyone,
 *     motion-free, but fully visible to screenshots and shoulder
 *     surfers — the consumer picks this when the screenshot threat
 *     model does not apply.
 *   - trigger "hold" (default): press-and-hold the eye; release hides.
 *   - trigger "toggle": click the eye to show, click again to hide;
 *     an auto-hide timer (`revealAutoHideMs`, default 8s, 0 disables)
 *     hides a forgotten reveal. Space/Enter toggles from the keyboard.
 * - "strength": the traffic-light dot (weak / fair / strong) with a
 *   localized tooltip on hover AND on touch tap.
 * - "none": no affordance at all.
 */
export default defineComponent({
  name: "HkPasswordSurface",
  inheritAttrs: false,
  props: {
    modelValue: { type: String, default: "" },
    placeholder: { type: String, default: "" },
    placeholderVariant: {
      type: String as () => PlaceholderVariant,
      default: "truncate",
    },
    disabled: { type: Boolean, default: false },
    readonly: { type: Boolean, default: false },
    required: { type: Boolean, default: false },
    /** Error styling on the box (the message itself is HkInput's). */
    error: { type: Boolean, default: false },
    name: { type: String, default: undefined },
    /** Undefined resolves through the runtime credential policy. */
    autocomplete: { type: String, default: undefined },
    /** Label target — the invisible input still owns the field id. */
    id: { type: String, default: undefined },
    /** Submit intent on Enter (no modifiers) — see HkInput. */
    submitOnEnter: { type: Function, default: undefined },
    /** Right-edge affordance — see the component docblock. */
    passwordTrailing: {
      type: String as () => "eye" | "strength" | "none",
      default: "eye",
    },
    /**
     * What the eye reveal SHOWS:
     * - "filter" (default): dual counter-drifting spatter layers —
     *   static glyph apertures over an oppositely drifting, statisti-
     *   cally matched spatter field, plus a small lightness pedestal
     *   and halo. Readable in motion; a single screenshot carries no
     *   glyph structure, only a weak luminance signal.
     * - "sweep": a readable window — ordinary high-contrast text inside
     *   a narrow band sweeping across the row. Easy to read; a single
     *   screenshot leaks the band's characters in the clear.
     * - "noise": the screenshot-safe boiling-noise kinematogram —
     *   statistically pure noise in any single frame, nothing for OCR,
     *   but the hardest to read (opt-in for high-exposure surfaces).
     * - "plain": ordinary readable text drawn on the canvas (fully
     *   screenshot-visible — pick per threat model).
     */
    revealStrategy: {
      type: String as () => "filter" | "sweep" | "noise" | "plain",
      default: "filter",
    },
    /**
     * How the eye reveal is TRIGGERED: "hold" (default) = press-and-
     * hold; "toggle" = click to show, click again (or the auto-hide
     * timer) to hide. Keyboard follows the same mode (Space/Enter).
     */
    revealTrigger: {
      type: String as () => "hold" | "toggle",
      default: "hold",
    },
    /**
     * Toggle mode only: hide the reveal automatically after this many
     * ms (default 8s) so a forgotten reveal does not linger. `0`
     * disables the timer. Ignored in hold mode.
     */
    revealAutoHideMs: { type: Number, default: 8000 },
    /** Overrides the built-in passwordLevel classifier. */
    strengthEvaluator: {
      type: Function as PropType<PasswordStrengthEvaluator>,
      default: undefined,
    },
    size: { type: String as () => "sm" | "md" | "lg", default: "md" },
  },
  emits: {
    "update:modelValue": (_value: string) => true,
    focus: (_e: FocusEvent) => true,
    blur: (_e: FocusEvent) => true,
    keydown: (_e: KeyboardEvent) => true,
  },
  setup(props, { emit, slots }) {
    const { t } = useI18n();
    const attrs = useAttrs();
    const inputRef = ref<HTMLInputElement>();
    const dotCanvasRef = ref<HTMLCanvasElement>();
    const boxRef = ref<HTMLElement>();
    const focused = ref(false);
    const capsLock = ref(false);
    const fullWidthPaused = ref(false);
    const allSelected = ref(false);
    const composing = ref(false);
    const preComposeValue = ref("");
    const revealing = ref(false);
    // Hold-to-reveal rendering state (see revealKinematogram.ts): the
    // painter owns the noise tile + offscreen glyph mask; revealFrames
    // counts bus-driven frames so the watchdog can tell a parked
    // animation bus (reduced motion) from a live one; the layout memo
    // keeps measureText off the per-frame path (inputs compared as
    // fields, the string key built only on an actual rebuild). sweepT
    // drives the sweep strategy's window position (seconds since the
    // reveal started).
    const revealNoise = new RevealNoisePainter();
    const revealFilter = new RevealFilterPainter();
    let revealFrames = 0;
    let revealLayoutValue = "";
    let revealLayoutW = -1;
    let revealLayoutH = -1;
    let revealLayoutMono = "";
    let revealStaticFallback = false;
    let revealWatchdog: CronHandle | null = null;
    let revealAutoHide: CronHandle | null = null;
    let revealLayout: RevealLayout | null = null;
    let revealLayoutKey = "";
    let sweepT = 0;
    // Raw computed `color` of the box, cached at reveal start — the
    // plain strategy's fillStyle (textHsl is the same read parsed for
    // the noise tile base).
    let cachedInkColor = "";
    const pendingClear = ref(false);
    // Flipped by the opt-in marquee overlay when the placeholder actually
    // overflows — the static text below is then hidden so the scrolling
    // copies do not overprint it.
    const marqueeOverflow = ref(false);
    let lastInputAt = 0;

    // ── strength (traffic light) ────────────────────────────────────
    // A throwing evaluator is a consumer bug, but it must never take
    // the whole field down (the computed runs inside the render fn):
    // degrade to the built-in classifier and warn once per instance.
    let warnedEvaluator = false;
    const level = computed<PasswordLevel | null>(() => {
      if (props.passwordTrailing !== "strength" || !props.modelValue) {
        return null;
      }
      const evaluate = props.strengthEvaluator ?? passwordLevel;
      try {
        return evaluate(props.modelValue);
      } catch (err) {
        if (!warnedEvaluator) {
          warnedEvaluator = true;
          console.warn(
            "[hikari] strengthEvaluator threw; falling back to passwordLevel",
            err,
          );
        }
        return passwordLevel(props.modelValue);
      }
    });

    const levelLabel = computed(() => {
      const lv = level.value;
      if (!lv) return "";
      if (lv === "weak") return t("hikari::passwordInput.strengthWeak", "Weak");
      if (lv === "fair") return t("hikari::passwordInput.strengthFair", "Fair");
      return t("hikari::passwordInput.strengthStrong", "Strong");
    });

    const strengthTooltip = computed(() =>
      level.value
        ? `${t("hikari::passwordInput.strengthLabel", "Password strength")}: ${levelLabel.value}`
        : "",
    );

    const idlePlaceholder = computed(
      () => props.placeholder || t("hikari::passwordInput.placeholderPassword"),
    );

    const resolvedPlaceholder = computed(() =>
      pendingClear.value && props.modelValue
        ? t("hikari::passwordInput.focusedHasValuePlaceholder")
        : focused.value
          ? t("hikari::passwordInput.focusedPlaceholder")
          : idlePlaceholder.value,
    );

    // ── canvas: dot matrix / reveal text ────────────────────────────
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const ROWS = 3;
    const GAP = 8;
    const DOT_R = 2.2;
    const SIGMA = 2.8;
    // Time-driven animation budget: the ripple ring sweeps the whole dot
    // grid and its peak fades out within 0.3s, regardless of box size.
    const RIPPLE_SWEEP_S = 0.3;
    const PEAK_DECAY_S = 0.3;
    const R_WIDTH = 1.3;
    const R_BOOST = 0.7;
    const PEAK_SPEED = 1 / PEAK_DECAY_S;

    let COLS = 11;
    let R_SPEED = 0;
    let dists: number[][] = [];
    let MAX_D = 1;
    let rgb: [number, number, number] = [88, 166, 255];
    // Base text color for the reveal pass, in HSL — synced from the
    // computed box color each time a reveal starts so theme switches
    // are picked up without a remount.
    let textHsl: [number, number, number] = [220, 10, 15];

    function rebuildGrid(cols: number) {
      if (cols < 3) cols = 3;
      if (cols % 2 === 0) cols--;
      COLS = cols;
      const cc = (COLS - 1) / 2;
      const cr = (ROWS - 1) / 2;
      dists = [];
      for (let r = 0; r < ROWS; r++) {
        dists[r] = [];
        for (let c = 0; c < COLS; c++) {
          const dx = c - cc,
            dy = r - cr;
          dists[r][c] = Math.sqrt(dx * dx + dy * dy);
        }
      }
      MAX_D = Math.sqrt(cc * cc + cr * cr);
      R_SPEED = (MAX_D + R_WIDTH + 0.5) / RIPPLE_SWEEP_S;
    }

    rebuildGrid(11);

    const ripples: Ripple[] = [];
    let ro: ResizeObserver | null = null;

    function parseColorTriple(raw: string): [number, number, number] | null {
      // Modern color functions (oklch/lab/color()) would split into
      // garbage numeric triples — reject them and keep the caller's
      // previous base instead (latent for consumer themes authored in
      // those functions; hikari's own themes use rgb triplets/hex).
      if (/^(oklch|oklab|lab|lch|color)\(/i.test(raw.trim())) return null;
      const ns = raw.split(/[\s,()rgba]+/).map(Number).filter((n) => !isNaN(n));
      return ns.length >= 3 ? [ns[0], ns[1], ns[2]] : null;
    }

    function syncColor() {
      try {
        const cs = getComputedStyle(document.documentElement);
        const raw = cs.getPropertyValue("--hi-color-primary-rgb").trim();
        if (raw) {
          const triple = parseColorTriple(raw);
          if (triple) {
            rgb = triple;
            return;
          }
        }
        const hex = cs.getPropertyValue("--hi-color-primary").trim();
        if (hex.startsWith("#")) {
          rgb = [
            parseInt(hex.slice(1, 3), 16),
            parseInt(hex.slice(3, 5), 16),
            parseInt(hex.slice(5, 7), 16),
          ];
          return;
        }
        const triple = parseColorTriple(hex);
        if (triple) rgb = triple;
      } catch {
        // ignore
      }
    }

    function syncTextHsl() {
      const box = boxRef.value;
      if (!box) return;
      try {
        const color = getComputedStyle(box).color;
        const triple = parseColorTriple(color);
        if (color) cachedInkColor = color;
        if (!triple) return;
        const [r, g, b] = triple;
        const rn = r / 255,
          gn = g / 255,
          bn = b / 255;
        const max = Math.max(rn, gn, bn),
          min = Math.min(rn, gn, bn);
        const l = (max + min) / 2;
        let h = 0;
        let s = 0;
        if (max !== min) {
          const d = max - min;
          s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
          if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
          else if (max === gn) h = ((bn - rn) / d + 2) / 6;
          else h = ((rn - gn) / d + 4) / 6;
        }
        textHsl = [h * 360, s * 100, l * 100];
      } catch {
        // ignore — keep the previous base
      }
    }

    // Cached alongside textHsl at each reveal start: reading computed
    // styles per animation frame is measurable layout thrash for zero
    // benefit (the stack cannot change mid-hold any more than the base
    // color can).
    let cachedMonoFont = "";
    function syncMonoFont(): string {
      try {
        const raw = getComputedStyle(document.documentElement)
          .getPropertyValue("--font-mono")
          .trim();
        if (raw) {
          cachedMonoFont = raw;
          return cachedMonoFont;
        }
      } catch {
        // ignore
      }
      cachedMonoFont = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
      return cachedMonoFont;
    }

    function resize() {
      const cv = dotCanvasRef.value;
      const bx = boxRef.value;
      if (!cv || !bx) return;
      // The canvas box is sized in the element's own units (`inset: 0`), so
      // its backing store has to be too: taking the DRAWN box would make the
      // dot grid k times denser inside a scaled or zoomed root (see
      // `layoutGeometry`).
      const drawn = bx.getBoundingClientRect();
      const scale = drawnScale(bx);
      const width = bx.offsetWidth > 0 ? drawn.width / (scale.x > 0 ? scale.x : 1) : drawn.width;
      const height = bx.offsetHeight > 0 ? drawn.height / (scale.y > 0 ? scale.y : 1) : drawn.height;
      cv.width = width * dpr;
      cv.height = height * dpr;
      const usable = width * 0.8;
      const cols = Math.max(3, Math.floor(usable / GAP) + 1);
      rebuildGrid(cols);
      // Assigning canvas width/height wiped the bitmap: while a reveal
      // is on, repaint synchronously instead of waiting for the next
      // bus frame (a parked bus — reduced motion — never delivers one).
      if (revealing.value) draw(0);
    }

    function clamp(n: number, lo: number, hi: number): number {
      return Math.min(hi, Math.max(lo, n));
    }

    /**
     * Resolve (and memoize by value + canvas size + mono stack) the
     * glyph layout for the noise reveal. Measuring text is a per-hold
     * cost, not a per-frame one: the mask must stay perfectly still
     * while only the noise sampled through it drifts. The mono stack is
     * part of the key so a theme/font change BETWEEN holds (same value,
     * same size) rebuilds the layout and the mask instead of reusing a
     * stale raster in the old font.
     */
    function revealLayoutFor(ctx: CanvasRenderingContext2D, W: number, H: number): RevealLayout | null {
      const value = props.modelValue;
      if (!value) return null;
      const mono = cachedMonoFont || syncMonoFont();
      if (
        !revealLayout ||
        revealLayoutValue !== value ||
        revealLayoutW !== W ||
        revealLayoutH !== H ||
        revealLayoutMono !== mono
      ) {
        revealLayout = layoutRevealGlyphs(
          Array.from(value),
          (ch, fontPx) => {
            ctx.font = `${fontPx}px ${mono}`;
            return ctx.measureText(ch).width;
          },
          W / dpr,
          H / dpr,
          dpr,
        );
        revealLayoutValue = value;
        revealLayoutW = W;
        revealLayoutH = H;
        revealLayoutMono = mono;
        // JSON encoding: delimiter-unambiguous even for adversarial
        // font stacks, and only rebuilt when the layout actually is.
        revealLayoutKey = JSON.stringify([value, W, H, mono]);
      }
      return revealLayout;
    }

    /**
     * Motion reveal pass (the "noise" strategy): one frame of the
     * boiling-noise kinematogram — background noise translated by
     * the accumulated drift, then the (offscreen) glyph mask
     * re-composited with noise sampled at a fresh random phase. The
     * glyph geometry itself never touches the visible canvas, so a
     * single frame is pure noise. Returns false when the pattern path
     * is unavailable, handing the frame to the legacy jitter fallback.
     */
    function drawRevealNoise(ctx: CanvasRenderingContext2D, W: number, H: number, dt: number): boolean {
      const layout = revealLayoutFor(ctx, W, H);
      if (!layout) return true; // empty value: nothing to reveal at all
      revealNoise.advance(dt, dpr);
      return revealNoise.paint(ctx, W, H, layout, cachedMonoFont || syncMonoFont(), revealLayoutKey);
    }

    /**
     * Plain reveal pass (`revealStrategy="plain"`): the industry-
     * standard readable reveal — the password as ordinary text, in the
     * box's own ink color, laid out by the SAME memoized fit-scale
     * layout as the noise mask (identical geometry, no jitter, no
     * motion — readable by everyone, including reduced-motion users,
     * at the cost of being fully screenshot-visible). The DOM input
     * still never flips: this is canvas paint, the value is never DOM
     * text beyond the type="password" input itself.
     */
    function drawRevealPlainText(ctx: CanvasRenderingContext2D, W: number, H: number) {
      const layout = revealLayoutFor(ctx, W, H);
      if (!layout) return;
      ctx.save();
      ctx.font = `${layout.fontPx.toFixed(2)}px ${cachedMonoFont || syncMonoFont()}`;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillStyle = cachedInkColor || "#fff";
      for (const g of layout.glyphs) {
        ctx.fillText(g.ch, g.x, H / 2);
      }
      ctx.restore();
    }

    /**
     * Sweep reveal pass (`revealStrategy="sweep"`): the
     * boiling-noise field stays as the base layer, and the password is
     * drawn as ordinary high-contrast text ONLY inside a narrow window
     * that sweeps across the row (sweepWindow kinematics: constant
     * pace, dwell at the end, loop while held). Reading is effortless —
     * real text under the window — while a single frame leaks only the
     * window band's characters. The window geometry needs the text
     * extent, so it derives from the memoized layout: span = first
     * glyph's left edge to the last advance's right edge, window width
     * = 6.5 advances (clamped into the field).
     *
     * Accepted risk: a row NARROWER than the window floor (≤ ~4 very
     * short characters) fits entirely inside the band, so one frame
     * leaks the whole password — for tiny secrets the sweep is
     * effectively the plain strategy. Documented trade-off, not a bug.
     *
     * If the noise pattern path is unavailable this latches the static
     * fallback (plain text, like the reduced-motion degrade) instead of
     * the legacy jitter: sweep exists FOR readability.
     */
    function drawRevealSweepFrame(ctx: CanvasRenderingContext2D, W: number, H: number, dt: number) {
      const layout = revealLayoutFor(ctx, W, H);
      if (!layout || layout.glyphs.length === 0) return;
      sweepT += dt;
      revealNoise.advance(dt, dpr);
      if (!revealNoise.paint(ctx, W, H, layout, cachedMonoFont || syncMonoFont(), revealLayoutKey)) {
        revealStaticFallback = true;
        drawRevealPlainText(ctx, W, H);
        return;
      }
      const first = layout.glyphs[0]!;
      const last = layout.glyphs[layout.glyphs.length - 1]!;
      const rowStart = first.x;
      const rowEnd = last.x + last.advance;
      const advance = last.advance;
      // Window width: 6.5 advances, never wider than half the field,
      // but never below a readable floor (a degenerate canvas width
      // must not collapse the band to zero — and a row shorter than
      // the floor fits the band entirely: accepted risk, see the
      // docblock above).
      const winW = Math.max(56 * dpr, Math.min(W * 0.5, 6.5 * advance));
      // Window-center span: from the first glyph's left edge to the
      // row's right edge (so the band starts showing the head and ends
      // showing the tail).
      const { x, w } = sweepWindow(rowStart, rowEnd, winW, sweepT, dpr);
      ctx.save();
      ctx.beginPath();
      ctx.rect(x - w / 2, 0, w, H);
      ctx.clip();
      drawRevealPlainText(ctx, W, H);
      ctx.restore();
    }

    /**
     * Filter reveal pass (`revealStrategy="filter"`, the default): the
     * whole row stays on screen at all times — static glyph apertures
     * filled with one spatter texture, over a statistically identical
     * spatter field drifting the OPPOSITE way, plus a small lightness
     * pedestal and a halo band. A human reads the row continuously off
     * the counter-motion + pedestal; a single frame carries no glyph
     * structure (matched texture statistics), only the weak pedestal
     * signal dissolved into the halo ramp. Like the sweep, a pattern-
     * less engine latches the static fallback to PLAIN text — filter
     * exists for readability, never degrade to frozen noise.
     */
    function drawRevealFilterFrame(ctx: CanvasRenderingContext2D, W: number, H: number, dt: number) {
      const layout = revealLayoutFor(ctx, W, H);
      if (!layout || layout.glyphs.length === 0) return;
      revealFilter.advance(dt, dpr);
      if (!revealFilter.paint(ctx, W, H, layout, cachedMonoFont || syncMonoFont(), revealLayoutKey)) {
        revealStaticFallback = true;
        drawRevealPlainText(ctx, W, H);
      }
    }

    /**
     * Legacy anti-OCR fallback, used only when frames cannot drive the
     * kinematogram (parked animation bus — reduced motion — or an
     * engine without canvas patterns): the password is drawn as text
     * with every glyph re-randomized per frame — size, baseline,
     * rotation and color all wobble — so automated recognition never
     * gets a stable target. A parked bus renders exactly ONE such
     * frame per hold; with patterns unavailable it degrades to the old
     * per-frame behavior.
     */
    function drawRevealJitterText(ctx: CanvasRenderingContext2D, W: number, H: number) {
      const value = props.modelValue;
      if (!value) return;
      const aW = W / dpr;
      const aH = H / dpr;
      const basePx = clamp(aH * 0.58, 12, 18);
      const mono = cachedMonoFont || syncMonoFont();
      ctx.font = `${basePx}px ${mono}`;
      // Iterate CODE POINTS on both passes (Array.from splits surrogate
      // pairs): indexing the string by code unit below would draw lone
      // surrogates for astral glyphs (emoji) and desync the width table.
      const chars = Array.from(value);
      const widths: number[] = [];
      let raw = 0;
      for (const ch of chars) {
        const w = ctx.measureText(ch).width;
        widths.push(w);
        raw += w;
      }
      const avail = Math.max(16, aW - 28);
      const scale = raw > avail ? Math.max(0.4, avail / raw) : 1;
      let x = (aW - raw * scale) / 2;
      const midY = aH / 2;
      const [bh, bs, bl] = textHsl;
      for (let i = 0; i < chars.length; i++) {
        const ch = chars[i]!;
        const advance = widths[i]! * scale;
        const sizeJ = basePx * scale * (1 + (Math.random() * 2 - 1) * 0.16);
        const yJ = (Math.random() * 2 - 1) * aH * 0.09;
        const rotJ = (Math.random() * 2 - 1) * 0.1;
        const hJ = bh + (Math.random() * 2 - 1) * 24;
        const sJ = clamp(bs + (Math.random() * 2 - 1) * 26, 10, 80);
        const lJ = clamp(bl + (Math.random() * 2 - 1) * 18, 12, 88);
        ctx.save();
        ctx.translate((x + advance / 2) * dpr, (midY + yJ) * dpr);
        ctx.rotate(rotJ);
        ctx.font = `${sizeJ.toFixed(2)}px ${mono}`;
        ctx.fillStyle = `hsl(${hJ.toFixed(1)} ${sJ.toFixed(1)}% ${lJ.toFixed(1)}%)`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(ch, 0, 0);
        ctx.restore();
        x += advance;
      }
    }

    function draw(dt: number) {
      const cv = dotCanvasRef.value;
      if (!cv) return;
      const ctx = cv.getContext("2d");
      if (!ctx) return;
      const W = cv.width,
        H = cv.height;
      ctx.clearRect(0, 0, W, H);

      if (revealing.value) {
        if (props.revealStrategy === "plain") {
          drawRevealPlainText(ctx, W, H);
          return;
        }
        if (props.revealStrategy === "sweep") {
          // Static fallback (reduced motion / pattern-less engine):
          // sweep exists for readability, so its degrade target is the
          // fully readable plain text, not the legacy jitter.
          if (revealStaticFallback) {
            drawRevealPlainText(ctx, W, H);
            return;
          }
          drawRevealSweepFrame(ctx, W, H, dt);
          return;
        }
        if (props.revealStrategy === "filter") {
          // Same degrade contract as the sweep: readable in motion,
          // plain text when motion cannot run.
          if (revealStaticFallback) {
            drawRevealPlainText(ctx, W, H);
            return;
          }
          drawRevealFilterFrame(ctx, W, H, dt);
          return;
        }
        if (!revealStaticFallback && drawRevealNoise(ctx, W, H, dt)) return;
        drawRevealJitterText(ctx, W, H);
        return;
      }

      const [pr, pg, pb] = rgb;
      const hasVal = !!props.modelValue;
      const foc = focused.value;

      const gW = (COLS - 1) * GAP;
      const gH = (ROWS - 1) * GAP;
      const aW = W / dpr;
      const aH = H / dpr;
      const ox = (aW - gW) / 2;
      const oy = (aH - gH) / 2;

      const emptyBase = foc ? 0.18 : 0.08;
      const filledResting = foc ? 0.55 : 0.35;

      const totalPeak = ripples.reduce((s, rp) => s + rp.peak, 0);

      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const d = dists[r][c];
          let a: number;
          if (!hasVal) {
            a = emptyBase;
          } else {
            const radial = Math.exp(-(d * d) / (2 * SIGMA * SIGMA));
            const rest = radial * filledResting;
            const peak = radial * totalPeak;
            a = Math.min(1, rest + peak);
          }
          for (let ri = 0; ri < ripples.length; ri++) {
            const rr = ripples[ri].radius;
            a = Math.min(
              1,
              a + Math.max(0, 1 - Math.abs(d - rr) / R_WIDTH) * R_BOOST,
            );
          }
          ctx.beginPath();
          ctx.arc(
            (ox + c * GAP) * dpr,
            (oy + r * GAP) * dpr,
            Math.max(0.5, DOT_R * dpr),
            0,
            Math.PI * 2,
          );
          ctx.fillStyle = `rgba(${pr},${pg},${pb},${a.toFixed(3)})`;
          ctx.fill();
        }
      }

      for (let i = ripples.length - 1; i >= 0; i--) {
        const rp = ripples[i];
        rp.radius += R_SPEED * dt;
        rp.peak = Math.max(0, rp.peak - PEAK_SPEED * dt);
        if (rp.radius > MAX_D + R_WIDTH + 0.5 && rp.peak <= 0) {
          ripples.splice(i, 1);
        }
      }
    }

    let loopHandle: AnimationHandle | null = null;

    function startLoop() {
      if (loopHandle) return;
      // The ripple canvas runs on the shared animation bus at "normal"
      // priority so the reduced-motion switch parks it like every other
      // JS-driven animation. The draw callback clamps the delta exactly
      // like the old self-scheduling rAF loop did. While revealing, the
      // same loop advances the noise kinematogram (and counts its
      // frames for the parked-bus watchdog in startReveal).
      loopHandle = onFrame((ctx) => {
        if (revealing.value) revealFrames++;
        draw(ctx.delta); // the bus already clamps per-entry delta to MAX_DELTA
      }, "normal");
    }

    function stopLoop() {
      loopHandle?.disconnect();
      loopHandle = null;
    }

    function kickRipple() {
      ripples.push({ radius: 0, peak: 1 });
    }

    // ── reveal (eye) ────────────────────────────────────────────────
    // Readonly fields keep the reveal (the old lock-reveal allowed it —
    // a stored, uneditable password is exactly the value a user wants
    // to eyeball); only disabled hides the control entirely.
    function startReveal() {
      if (!props.modelValue || props.disabled || revealing.value) return;
      syncTextHsl();
      syncMonoFont();
      // The plain strategy is static — no painter, no watchdog. The
      // motion strategies (filter default, sweep, noise) drive their
      // painter per frame and degrade to a STATIC fallback when frames
      // cannot drive them: filter and sweep fall back to plain text
      // (their whole point is readability), noise to the legacy jitter.
      // A parked bus (reduced motion) will never deliver a frame, so
      // the motion reveals would freeze — filter and sweep into an
      // unreadable mid-state, noise into pure noise — degrade
      // immediately to the strategy's static fallback (plain text for
      // filter and sweep, legacy jitter for noise). Motion-sensitive
      // users keep their preference and the reveal stays usable. The
      // plain strategy needs no degrade: its static text is already
      // motion-free. The parked check runs BEFORE beginHold so a
      // reduced-motion hold never builds noise/spatter tiles it will
      // never paint.
      const isPlain = props.revealStrategy === "plain";
      const parked = !isPlain && isAnimationParked();
      if (!isPlain) {
        revealStaticFallback = false;
        revealFrames = 0;
        sweepT = 0;
        if (!parked) {
          if (props.revealStrategy === "filter") {
            revealFilter.beginHold(textHsl, dpr);
          } else {
            revealNoise.beginHold(textHsl);
          }
        }
      }
      revealing.value = true;
      if (parked) {
        revealStaticFallback = true;
      }
      // Paint one synchronous frame so the reveal appears instantly;
      // the bus takes over from the next tick (the plain strategy is
      // static — that one frame IS the whole reveal until the value or
      // the canvas size changes).
      draw(0);
      if (!isPlain) {
        // Recurring belt-and-suspenders watchdog (cronBus on purpose:
        // bare timers fire even when the rAF-driven bus is parked or
        // throttled). While held it degrades to the static fallback as
        // soon as the hold is undrivable: the bus parked — possibly
        // MID-hold, reduced motion flipped on after frames already
        // arrived — or no bus frame ever arrived at all (hidden
        // document, extreme jank). The fallback latches for the rest of
        // the hold; the next hold re-probes from scratch.
        revealWatchdog?.disconnect();
        revealWatchdog = scheduleCron(() => {
          if (!revealing.value || revealStaticFallback) return;
          if (isAnimationParked() || revealFrames === 0) {
            revealStaticFallback = true;
            draw(0);
          }
        }, 160);
      }
      if (props.revealTrigger === "toggle") {
        // A toggled reveal must not linger forgotten on screen —
        // auto-hide (0 disables). cronBus, not the parked-prone
        // animation bus, so the hide always fires.
        revealAutoHide?.disconnect();
        revealAutoHide =
          props.revealAutoHideMs > 0
            ? scheduleCronAfter(() => {
                revealAutoHide = null;
                endReveal();
              }, props.revealAutoHideMs)
            : null;
      } else {
        document.addEventListener("pointerup", endReveal, { once: true });
        document.addEventListener("pointercancel", endReveal, { once: true });
      }
    }

    function endReveal() {
      if (!revealing.value) return;
      revealing.value = false;
      revealWatchdog?.disconnect();
      revealWatchdog = null;
      revealAutoHide?.disconnect();
      revealAutoHide = null;
      draw(0);
      document.removeEventListener("pointerup", endReveal);
      document.removeEventListener("pointercancel", endReveal);
    }

    function toggleReveal() {
      if (revealing.value) endReveal();
      else startReveal();
    }

    function clearAndFocus() {
      if (props.disabled || props.readonly) return;
      emit("update:modelValue", "");
      inputRef.value?.focus();
    }

    let flashHandle: CronHandle | null = null;

    function flash() {
      const el = boxRef.value;
      if (!el) return;
      el.removeAttribute("data-flash");
      void el.offsetWidth;
      el.setAttribute("data-flash", "");
      // cronBus one-shot (not the rAF-driven animationBus one) so the
      // attribute cleanup always fires — the animation bus is parked
      // under reduced motion and the flash must never stick.
      flashHandle?.disconnect();
      flashHandle = scheduleCronAfter(() => {
        flashHandle = null;
        el.removeAttribute("data-flash");
      }, 320);
      kickRipple();
    }

    function checkSelection() {
      const el = inputRef.value;
      if (!el || !el.value) {
        allSelected.value = false;
        return;
      }
      allSelected.value =
        el.selectionStart === 0 && el.selectionEnd === el.value.length;
    }

    const FW_RE = /[\uFF01-\uFF5E\u3000]/;

    function onInput(e: Event) {
      const t = e.target as HTMLInputElement;
      lastInputAt = performance.now();
      if (composing.value) return;
      if (pendingClear.value) {
        // Fallback for engines without beforeinput: keep only the part
        // typed beyond the old password, or start over on any other edit.
        pendingClear.value = false;
        const old = props.modelValue;
        if (old && t.value.startsWith(old) && t.value.length > old.length) {
          t.value = t.value.slice(old.length);
        } else {
          t.value = "";
        }
      }
      const v = t.value;
      if (FW_RE.test(v)) {
        const clean = v.replace(FW_RE, "");
        t.value = clean;
        emit("update:modelValue", clean);
        fullWidthPaused.value = true;
        allSelected.value = false;
        return;
      }
      fullWidthPaused.value = false;
      allSelected.value = false;
      emit("update:modelValue", v);
      flash();
      if (!v) {
        // Deleting down to empty can lose focus to an extension/IME bubble
        // in real browsers. Reclaim focus if nothing else has it.
        const el = inputRef.value;
        if (el && document.activeElement !== el) {
          queueMicrotask(() => {
            if (document.activeElement !== el && !props.disabled) {
              el.focus();
            }
          });
        }
      }
    }

    function onKeydown(e: KeyboardEvent) {
      if (e.getModifierState) capsLock.value = e.getModifierState("CapsLock");
      if (e.ctrlKey || e.metaKey) {
        onceFrame(() => checkSelection());
      }
      if (
        e.key === "Enter" &&
        !e.isComposing &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        !e.shiftKey &&
        !props.disabled &&
        !props.readonly
      ) {
        e.preventDefault();
        props.submitOnEnter?.();
      }
      emit("keydown", e);
    }

    function onKeyup(e: KeyboardEvent) {
      if (e.getModifierState) capsLock.value = e.getModifierState("CapsLock");
      checkSelection();
    }

    function onBeforeinput(e: InputEvent) {
      if (!pendingClear.value) return;
      const inputType = e.inputType || "";
      if (!inputType.startsWith("insert") && !inputType.startsWith("delete")) {
        return;
      }
      const el = inputRef.value;
      if (!el) return;
      pendingClear.value = false;
      // The old password is only a placeholder for the next input: typing
      // (or pasting) starts from an empty field, and deleting clears the
      // whole field instead of nibbling one dot of the old value.
      el.value = "";
      emit("update:modelValue", "");
      if (inputType.startsWith("delete")) {
        e.preventDefault();
        kickRipple();
      }
    }

    function onFocus(e: FocusEvent) {
      focused.value = true;
      if (props.modelValue && !props.readonly && !props.disabled) {
        // Keep the entered password on refocus instead of wiping it: the
        // field now shows a focused placeholder and clears the old value
        // only once the user actually starts typing.
        pendingClear.value = true;
      } else {
        pendingClear.value = false;
        checkAutofill();
      }
      emit("focus", e);
    }

    function onBlur(e: FocusEvent) {
      focused.value = false;
      pendingClear.value = false;
      // If the blur lands within a short window after the last input
      // event (e.g. an extension/IME yanks focus when the field is
      // cleared to empty), reclaim focus. A blur that hands focus to
      // another element (Tab navigation or a click on a focusable
      // control) is deliberate and must not be reclaimed.
      if (
        performance.now() - lastInputAt < 300 &&
        !props.disabled &&
        !props.readonly &&
        !e.relatedTarget
      ) {
        const el = inputRef.value;
        if (el) {
          // cronBus one-shot: the reclaim must run even under reduced
          // motion, where the animation bus is parked.
          focusReclaimHandle?.disconnect();
          focusReclaimHandle = scheduleCronAfter(() => {
            focusReclaimHandle = null;
            el.focus();
          }, 0);
        }
      }
      capsLock.value = false;
      fullWidthPaused.value = false;
      allSelected.value = false;
      // Some IMEs never fire compositionend when the field loses focus
      // mid-composition (or after deleting the whole composed text). A
      // stuck `composing` flag swallows every later onInput — the user
      // clears the field, the placeholder never comes back and typing
      // stops working. Reset the flag and sync any uncommitted value so
      // the model stays in lockstep with the real input.
      if (composing.value) {
        composing.value = false;
        const el = inputRef.value;
        if (el && el.value !== props.modelValue) {
          emit("update:modelValue", el.value);
        }
      }
      checkAutofill();
      emit("blur", e);
    }

    function checkAutofill() {
      const el = inputRef.value;
      if (!el) return;
      if (el.value && !props.modelValue) {
        emit("update:modelValue", el.value);
        flash();
      }
    }

    function onCompositionStart() {
      composing.value = true;
      preComposeValue.value = inputRef.value?.value ?? "";
      fullWidthPaused.value = true;
    }

    function onCompositionEnd() {
      composing.value = false;
      let v = inputRef.value?.value ?? "";
      if (pendingClear.value) {
        // Same fallback as onInput for engines without beforeinput.
        pendingClear.value = false;
        const old = props.modelValue;
        if (old && v.startsWith(old) && v.length > old.length) {
          v = v.slice(old.length);
          if (inputRef.value) inputRef.value.value = v;
        } else if (old) {
          v = "";
          if (inputRef.value) inputRef.value.value = "";
        }
      }
      if (FW_RE.test(v.slice(preComposeValue.value.length))) {
        if (inputRef.value) inputRef.value.value = preComposeValue.value;
        emit("update:modelValue", preComposeValue.value);
        fullWidthPaused.value = true;
        allSelected.value = false;
        return;
      }
      fullWidthPaused.value = false;
      allSelected.value = false;
      emit("update:modelValue", v);
      flash();
      if (!v) {
        // Deleting down to empty can lose focus to an extension/IME bubble
        // in real browsers. Reclaim focus if nothing else has it.
        const el = inputRef.value;
        if (el && document.activeElement !== el) {
          queueMicrotask(() => {
            if (document.activeElement !== el && !props.disabled) {
              el.focus();
            }
          });
        }
      }
    }

    function onSelect() {
      checkSelection();
    }

    function onAutofillAnim(_e: AnimationEvent) {
      const el = inputRef.value;
      if (!el) return;
      if (el.value && el.value !== props.modelValue) {
        emit("update:modelValue", el.value);
        flash();
      }
    }

    function onPointerup() {
      onceFrame(() => checkSelection());
    }

    let autofillHandle: IntervalHandle | null = null;
    let focusReclaimHandle: CronHandle | null = null;

    watch(() => props.modelValue, (v) => {
      // An external clear (or the blur hint's clear-and-focus) must drop
      // the pending-clear state so the placeholder falls back to the
      // waiting-for-input message.
      if (!v) pendingClear.value = false;
      if (revealing.value) {
        // Editing (or clearing) the password mid-reveal: an empty value
        // ends the reveal outright; otherwise the STATIC reveal frames
        // (plain text, or the latched jitter fallback under a parked
        // bus) must repaint with the new layout now, not on some future
        // bus frame that reduced motion may never deliver.
        if (!v) endReveal();
        else if (props.revealStrategy === "plain" || revealStaticFallback) draw(0);
      }
    });

    watch(() => props.disabled, (v) => {
      // Disabling the field mid-reveal unmounts the eye (showEye gates
      // on disabled) — never leave a reveal up on a disabled field,
      // especially a toggle with the auto-hide timer switched off.
      if (v) endReveal();
    });

    watch([() => props.revealStrategy, () => props.revealTrigger], () => {
      // The reveal knobs are read once at reveal start (painter setup,
      // watchdog, trigger listeners all branch on them); flipping either
      // mid-reveal would strand the hold in a half-old/half-new state
      // (a painter without beginHold, a toggle without its auto-hide).
      // The props are per-instance configuration — reconcile by simply
      // ending the reveal; the next interaction re-reads them fresh.
      endReveal();
    });

    onMounted(() => {
      syncColor();
      resize();
      ro = new ResizeObserver(resize);
      if (boxRef.value) ro.observe(boxRef.value);
      startLoop();
      // Visibility-aware poll (intervalBus parks while hidden, unlike a
      // raw setInterval that keeps burning in background tabs).
      autofillHandle = scheduleInterval(() => {
        if (!focused.value) checkAutofill();
      }, 500);
    });

    onUnmounted(() => {
      stopLoop();
      autofillHandle?.disconnect();
      autofillHandle = null;
      flashHandle?.disconnect();
      flashHandle = null;
      focusReclaimHandle?.disconnect();
      focusReclaimHandle = null;
      if (ro) ro.disconnect();
      endReveal();
    });

    const showEye = computed(() => props.passwordTrailing === "eye" && !props.disabled);

    const eyeLabel = computed(() =>
      props.revealTrigger === "toggle"
        ? revealing.value
          ? t("hikari::input.hidePassword", "Hide password")
          : t("hikari::input.showPassword", "Show password")
        : t("hikari::passwordInput.holdToReveal", "Hold to show password"),
    );

    return () => {
      const { class: _c, style: _s, ...restAttrs } = attrs as Record<string, unknown>;
      // Slot resolution. HkInput forwards its affix slots unconditionally
      // (the vue-jsx transform only accepts a literal slots object); an
      // empty array means "no caller content" and falls back. Precedence
      // mirrors the text variants: #prefix beats #prefixIcon, #suffix
      // beats #suffixIcon, and an explicit suffix suppresses the built-in
      // trailing affordance (the retired native toggle behaved the same).
      // Comment vnodes count as ABSENT: a `v-if`'d-out slot template
      // compiles to a [comment] array which must not hide the default
      // lock or stand the built-in affordances down. (Vue's Comment
      // vnode type is the exported Symbol, not a string.)
      const isCommentVNode = (n: unknown) =>
        typeof n === "object" &&
        n !== null &&
        (n as { type?: unknown }).type === Comment;
      const nonEmpty = (v: unknown) =>
        Array.isArray(v) ? v.some((n) => n != null && !isCommentVNode(n)) : !!v;
      const prefixContent = slots.prefix?.() ?? [];
      const hasPrefix = nonEmpty(prefixContent);
      const callerIcon = hasPrefix ? [] : (slots.prefixIcon?.() ?? []);
      const hasCallerIcon = nonEmpty(callerIcon);
      const suffixContent = slots.suffix?.() ?? [];
      const hasSuffix = nonEmpty(suffixContent);
      const suffixIconContent = hasSuffix ? [] : (slots.suffixIcon?.() ?? []);
      const hasSuffixIcon = nonEmpty(suffixIconContent);
      const hasCustomSuffix = hasSuffix || hasSuffixIcon;
      return (
        <>
          <div
            ref={boxRef}
            class={["hk-pwd-box", `hk-pwd-box-${props.size}`]}
            data-focused={focused.value || undefined}
            data-error={props.error || undefined}
            data-disabled={props.disabled || undefined}
            data-fw={fullWidthPaused.value || undefined}
          >
            <div
              class={[
                "hk-pwd-lock",
                props.modelValue ? "hk-pwd-lock-filled" : "hk-pwd-lock-empty",
                // Caller-provided prefix content must be interactive like
                // the text variants' affixes (a button / tooltip trigger
                // in #prefix or #prefixIcon): the default lock stays a
                // decorative, click-through glyph.
                hasPrefix || hasCallerIcon ? "hk-pwd-lock-custom" : "",
              ]}
            >
              {hasPrefix
                ? prefixContent
                : hasCallerIcon
                  ? callerIcon
                  : (
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  width="16"
                  height="16"
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              )}
            </div>
            <canvas ref={dotCanvasRef} class="hk-pwd-dots" />
            {(!props.modelValue || (pendingClear.value && focused.value)) &&
            !revealing.value ? (
              <span
                key={`ph-${pendingClear.value && props.modelValue ? "has-value" : focused.value ? "focused" : "idle"}`}
                class="hk-pwd-placeholder"
                onPointerdown={(e: PointerEvent) => {
                  // Tapping the placeholder refocuses the field — after an
                  // extension or IME steals focus the input otherwise stops
                  // responding to typing.
                  e.preventDefault();
                  inputRef.value?.focus();
                }}
              >
                <span
                  class="hk-pwd-placeholder-text"
                  style={
                    props.placeholderVariant === "marquee" && marqueeOverflow.value
                      ? { visibility: "hidden" }
                      : undefined
                  }
                >
                  {resolvedPlaceholder.value}
                </span>
                {props.placeholderVariant === "marquee" && (
                  <HkPlaceholderMarquee
                    text={resolvedPlaceholder.value}
                    variant={props.placeholderVariant}
                    onOverflowChange={(v: boolean) => {
                      marqueeOverflow.value = v;
                    }}
                  />
                )}
              </span>
            ) : null}
            {props.modelValue &&
            !focused.value &&
            !revealing.value &&
            !pendingClear.value ? (
              <span
                class="hk-pwd-blur-hint"
                onPointerdown={(e: PointerEvent) => {
                  e.preventDefault();
                  clearAndFocus();
                }}
              >
                {t("hikari::passwordInput.passwordEntered")}
              </span>
            ) : null}
            {focused.value && allSelected.value ? (
              <span class="hk-pwd-select-hint">
                {t("hikari::passwordInput.allSelected")}
              </span>
            ) : null}
            <input
              ref={inputRef}
              id={props.id}
              type="password"
              value={props.modelValue}
              name={props.name}
              autocomplete={props.autocomplete ?? credentialAutocomplete("password", "off")}
              data-1p-ignore
              data-lpignore="true"
              disabled={props.disabled}
              readonly={props.readonly}
              required={props.required}
              class="hk-pwd-input"
              {...restAttrs}
              onInput={onInput}
              onBeforeinput={onBeforeinput}
              onFocus={onFocus}
              onBlur={onBlur}
              onKeydown={onKeydown}
              onKeyup={onKeyup}
              onSelect={onSelect}
              onPointerup={onPointerup}
              onCompositionstart={onCompositionStart}
              onCompositionend={onCompositionEnd}
              onAnimationstart={onAutofillAnim}
            />
            {!hasCustomSuffix &&
              props.passwordTrailing === "strength" &&
              level.value ? (
              <HkTooltip
                text={strengthTooltip.value}
                placement="top"
                delay={150}
              >
                <span
                  class="hk-pwd-strength"
                  data-level={level.value}
                  role="img"
                  aria-label={strengthTooltip.value}
                />
              </HkTooltip>
            ) : null}
            {!hasCustomSuffix && showEye.value ? (
              <button
                type="button"
                class="hk-pwd-eye"
                data-revealing={revealing.value || undefined}
                aria-label={eyeLabel.value}
                onPointerdown={(e: PointerEvent) => {
                  // No focus steal: the caret stays in the field while
                  // the affordance is pressed.
                  e.preventDefault();
                  if (props.revealTrigger === "toggle") toggleReveal();
                  else startReveal();
                }}
                onContextmenu={(e: Event) => e.preventDefault()}
                onKeydown={(e: KeyboardEvent) => {
                  if (e.key !== " " && e.key !== "Enter") return;
                  e.preventDefault();
                  // Held-key auto-repeat: harmless for hold mode
                  // (startReveal no-ops while revealing), but it would
                  // flap a toggle on/off.
                  if (e.repeat) return;
                  if (props.revealTrigger === "toggle") toggleReveal();
                  else startReveal();
                }}
                onKeyup={(e: KeyboardEvent) => {
                  if (e.key !== " " && e.key !== "Enter") return;
                  e.preventDefault();
                  if (props.revealTrigger === "hold") endReveal();
                }}
              >
                {revealing.value ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            ) : null}
            {hasCustomSuffix ? (
              <span class="hk-pwd-suffix">
                {hasSuffix ? suffixContent : suffixIconContent}
              </span>
            ) : null}
          </div>
          <div class="hk-pwd-hints">
            <HListTransition tag="div">
              {capsLock.value ? (
                <span key="caps" class="hk-pwd-hint" data-variant="caps">
                  {t("hikari::passwordInput.capsLock")}
                </span>
              ) : null}
            </HListTransition>
            <HListTransition tag="div">
              {fullWidthPaused.value ? (
                <span key="fw" class="hk-pwd-hint" data-variant="fw">
                  {t("hikari::passwordInput.fullWidth")}
                </span>
              ) : null}
            </HListTransition>
          </div>
        </>
      );
    };
  },
});
