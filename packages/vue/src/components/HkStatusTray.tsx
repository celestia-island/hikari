import { defineComponent, onBeforeUnmount, onMounted, ref, watch, type PropType } from "vue";
import { Circle, Square, Triangle, X } from "lucide-vue-next";

import { scheduleInterval, type IntervalHandle } from "../runtime/intervalBus";
import { formatTime } from "../utils/format";
import "./HkStatusTray.scss";

/**
 * HkStatusTray — the gamepad cluster + wall clock, upstreamed from
 * shittim-chest's `SystemTray` (2026-09-24) and registered as the built-in
 * implementation of the `status.tray` decor slot.
 *
 * What changed on the way up:
 *
 *  - **Class names are byte-identical to chest's** (`.s-status-bar-system-tray`
 *    → `.s-status-bar-gamepad` → 4 × `.s-status-bar-btn[data-shape][data-active]`
 *    → `.s-status-bar-time`), so the plana-ui rules in
 *    `styles/admin-tokens.scss` style it unchanged — including for consumers
 *    that already ship that sheet.
 *  - **`size` replaces per-host glyph CSS.** The root publishes
 *    `--hk-tray-glyph` / `--hk-tray-glyph-x` / `--hk-tray-time-size`, and
 *    `HkStatusTray.scss` consumes them with the admin-tokens values as
 *    fallbacks. `md` (the default) emits exactly the present values, so the
 *    default rendering is pixel-identical to chest's.
 *  - **The per-theme variant table is gone.** chest's `TRAY_DECORS` record
 *    (and its `DEFAULT_TRAY_DECOR`) is replaced by the decor registry: a
 *    theme ships its own tray by registering a component for
 *    `status.tray` under its own theme id, which `<HkThemeDecor>` resolves
 *    ahead of this built-in. Nothing theme-specific is hardcoded here.
 *  - **Reduced motion is held by the component**, not by every host's
 *    whitelist: with `prefers-reduced-motion: reduce` the glyph rotation
 *    parks on the first shape (the clock is data, not animation, and keeps
 *    ticking).
 *  - **No positioning of its own.** The component hands out content only;
 *    where the tray sits (footer, card corner, modal chrome) is the host's
 *    decision, which is what makes it usable as a decor slot.
 */

const TICK_MS = 1000;

/** Shape cluster — Plana's four gamepad glyphs, tinted through theme
 *  tokens, crossfading on a soft 1s cycle (Blue Archive-style gentle
 *  motion). Order is the `data-shape` order hosts and CSS rely on. */
const SHAPES = [
  { component: Triangle, colorVar: "--color-success", name: "triangle" },
  { component: Circle, colorVar: "--color-error", name: "circle" },
  { component: X, colorVar: "--color-warning", name: "x" },
  { component: Square, colorVar: "--color-primary", name: "square" },
] as const;

export type HkStatusTraySize = "sm" | "md" | "lg";

/**
 * The size ladder. `md` carries the values the shipped CSS already uses
 * (`svg 9px`, `x` glyph `11px`, clock `--text-2xs`); the sheet's fallbacks
 * repeat those same values, and `HkStatusTray.size.test.ts` keeps all three
 * copies equal — moving one without the others fails there instead of
 * restyling every consumer silently.
 */
export const HK_TRAY_SIZE_VARS: Record<HkStatusTraySize, Record<string, string>> = {
  sm: {
    "--hk-tray-glyph": "7px",
    "--hk-tray-glyph-x": "9px",
    "--hk-tray-time-size": "calc(var(--text-2xs) * 0.85)",
  },
  md: {
    "--hk-tray-glyph": "9px",
    "--hk-tray-glyph-x": "11px",
    "--hk-tray-time-size": "var(--text-2xs)",
  },
  lg: {
    "--hk-tray-glyph": "12px",
    "--hk-tray-glyph-x": "14px",
    "--hk-tray-time-size": "calc(var(--text-2xs) * 1.3)",
  },
};

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches === true
  );
}

export default defineComponent({
  name: "HkStatusTray",
  props: {
    /** Glyph/clock scale. `md` is the shipped default. */
    size: {
      type: String as PropType<HkStatusTraySize>,
      default: "md" as HkStatusTraySize,
    },
    /** Glyph rotation cadence, ms (chest's default, unchanged). */
    cycleMs: { type: Number, default: 1000 },
  },
  setup(props) {
    const now = ref("");
    const activeIndex = ref(0);

    let cycleHandle: IntervalHandle | null = null;
    let clockHandle: IntervalHandle | null = null;
    let motionQuery: MediaQueryList | null = null;

    function stopCycle() {
      cycleHandle?.disconnect();
      cycleHandle = null;
    }

    /** Rotation is the only animation here: with reduced motion it parks on
     *  the first glyph (and a theme switch back to motion resumes it). */
    function startCycle() {
      stopCycle();
      if (prefersReducedMotion()) {
        activeIndex.value = 0;
        return;
      }
      cycleHandle = scheduleInterval(() => {
        activeIndex.value = (activeIndex.value + 1) % SHAPES.length;
      }, props.cycleMs);
    }

    function onMotionPreferenceChange() {
      startCycle();
    }

    onMounted(() => {
      const tick = () => {
        now.value = formatTime(new Date(), {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        });
      };
      tick();
      startCycle();
      // intervalBus: paused while hidden, catch-up tick on return — the
      // clock re-syncs the moment the tab becomes visible again instead of
      // lagging behind a throttled background interval.
      clockHandle = scheduleInterval(tick, TICK_MS);

      // The preference can flip while the page stays open (OS setting, user
      // override). Optional chaining: minimal `matchMedia` stubs in tests
      // and older embedders expose only `.matches`.
      if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
        motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
        motionQuery?.addEventListener?.("change", onMotionPreferenceChange);
      }
    });

    // A different cadence applies at once instead of at the next mount
    // (chest rebuilt the interval on its resolved decor for the same
    // reason).
    watch(() => props.cycleMs, startCycle);

    onBeforeUnmount(() => {
      stopCycle();
      clockHandle?.disconnect();
      clockHandle = null;
      motionQuery?.removeEventListener?.("change", onMotionPreferenceChange);
      motionQuery = null;
    });

    return () => (
      <div
        class="s-status-bar-system-tray"
        style={HK_TRAY_SIZE_VARS[props.size] as Record<string, string>}
      >
        <div class="s-status-bar-gamepad">
          {SHAPES.map(({ component: Icon, colorVar, name }, i) => (
            <span
              key={name}
              class="s-status-bar-btn"
              data-shape={name}
              data-active={i === activeIndex.value || undefined}
              style={i === activeIndex.value ? { color: `rgb(var(${colorVar}))` } : undefined}
            >
              <Icon />
            </span>
          ))}
        </div>
        <span class="s-status-bar-time">{now.value}</span>
      </div>
    );
  },
});
