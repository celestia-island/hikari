import { defineComponent, onMounted, onUnmounted, ref, type PropType } from "vue";

import { Minus, Square, X, Copy } from "lucide-vue-next";

import {
  claimWindowChrome,
  resolveWindowApi,
  watchMaximizedState,
} from "../runtime/windowChrome";

import "./HkWindowControls.scss";

/**
 * HkWindowControls — the minimize / maximize / close cluster for hosts
 * that own their window chrome (Tauri custom titlebars, Electron
 * frameless). Three modes, and the choice is DELIBERATELY explicit
 * (user direction 2026-10-23):
 *
 * - `standard` — three borderless ghost icon buttons at the same size
 *   step as the header's other chrome (ghost/32, 16px glyphs), spaced
 *   with comfortable gaps. The whole top-right reads as one family of
 *   identical buttons; the close hover is a small rounded red wash.
 *   THE mode for content-height headers (3rem-class bars).
 *   HOST CONTRACT: this mode never rides the window edge (that is the
 *   flush variant's job) — the host keeps the canonical inset
 *   `var(--hk-window-controls-edge-inset)` (≤1023px:
 *   `--hk-window-controls-edge-inset-compact`) between the cluster
 *   and the frame — token values live once in styles/admin-tokens,
 *   not restated here. A standard cluster glued to the frame corner
 *   is the wrong mode's look (field report 2026-10-25: the chest
 *   login strip rendered with no end padding at all);
 *   `.s-glass-header--chrome` is the in-library implementation of the
 *   contract for admin headers, and the chat face sources its
 *   `--chrome` padding from the same tokens.
 *   LAYER CONTRACT: the host's caption band must claim the titlebar
 *   layer with the `.hk-chrome-band` class (styles/admin-tokens.scss),
 *   or the first open HkModal veil dims and deadens the whole drag row
 *   — field reports 2026-11-12: the chest settings and display windows
 *   covered the bar. HkAdminHeader's chrome mode hangs the class
 *   automatically; a hand-rolled band adds it to its own element. The
 *   claim needs a clean ancestor chain (no stacking-context wrapper
 *   with z<90000 between band and body); a trapped host instead sets
 *   `--hk-chrome-band-inset` so the modal veil's top edge starts below
 *   the band — the geometry leg, stacking-proof by construction.
 *
 * - `flush` — edge-riding squares that fill the host's height (the
 *   host must zero its own right padding so the close button rides
 *   the window edge; wash-on-hover only, radius 0). THE mode for real
 *   thin captions (32px-class native-titlebar strips).
 *
 * - **omitted → nothing renders.** There is NO default variant: a
 *   forgetful host shows no control buttons (the app stays closable
 *   via the taskbar/OS), which fails loudly at design review instead
 *   of silently shipping the wrong chrome.
 *
 * macOS: the traffic lights belong to the OS titlebar — this component
 * renders nothing on Apple platforms and the header degrades to its
 * browser-face look automatically.
 *
 * The window API comes from `resolveWindowApi()` (runtime/windowChrome):
 * `__TAURI__.window.getCurrentWindow()` when the host exposes it, otherwise the
 * `__TAURI_INTERNALS__` IPC surface. That fallback matters: the field report
 * (2026-10-28) was a boot where `__TAURI__` was missing/late, this component
 * rendered NOTHING, the boot bar never got claimed, and two caption strips
 * fought over the top edge. The three gates below are unchanged; only the
 * "is there a shell?" probe is shared now. No shell at all → nothing renders.
 */

/** Apple platforms own their traffic lights — we never render there. */
export function isApplePlatform(): boolean {
  return /Mac|iPhone|iPad|iPod/.test(
    (typeof navigator !== "undefined" && navigator.userAgent) || "",
  );
}

export type WindowControlsVariant = "standard" | "flush";

export const HkWindowControls = defineComponent({
  name: "HkWindowControls",
  props: {
    /** REQUIRED — no default. One of the two deliberate modes; omit it
     *  and the component renders nothing (the explicit-None contract). */
    variant: {
      type: String as PropType<WindowControlsVariant>,
      required: true,
      validator: (v: unknown) => v === "standard" || v === "flush",
    },
  },
  setup(props) {
    const maximized = ref(false);
    // The ONE read path (runtime/windowChrome): reads the shell now, re-reads on
    // every resize event, and falls back to a bounded poll only when the shell
    // refuses to publish events at all. Never arm this by hand again — the
    // 2026-11-12 report was a hand-rolled path that lost the shell receiver, so
    // the glyph stayed a square on a maximized window.
    let stopWatching: (() => void) | null = null;
    // Set on unmount: the mount path is async, so an unmount that lands before
    // the watcher exists must not leave one armed for a component that is gone.
    let disposed = false;
    // Only a mount that actually paints the cluster takes the window chrome
    // over from the boot bar (boot-chrome.js): the SAME gates the render
    // function applies, replayed once on mount. A component that renders
    // nothing must not claim — the boot bar would vanish and leave the window
    // with no controls at all. On Apple platforms nothing is painted (the OS
    // owns the traffic lights), so a host that ships only this component on
    // macOS must dispatch `claimWindowChrome()` itself.
    let claimed = false;

    onMounted(async () => {
      if (isApplePlatform()) return;
      if (props.variant !== "standard" && props.variant !== "flush") return;
      const win = resolveWindowApi();
      if (!win) return;
      if (!claimed) {
        claimed = true;
        claimWindowChrome("HkWindowControls");
      }
      // The watcher handles every rejection internally: an unhandled rejection
      // during boot is treated as fatal by the family's `res/fatal-fallback.js`
      // (it raises the full-screen "Application failed to load" landing on
      // `unhandledrejection`), and the internals path would reproduce it every
      // poll interval.
      const stop = watchMaximizedState(win, (value) => {
        if (!disposed) maximized.value = value;
      });
      if (disposed) {
        stop();
        return;
      }
      stopWatching = stop;
    });

    onUnmounted(() => {
      disposed = true;
      stopWatching?.();
      stopWatching = null;
    });

    return () => {
      // Two render gates before any chrome: Apple owns its traffic
      // lights, and a host that forgot the variant gets NOTHING (the
      // explicit-None contract — belt for runtime JS where TS cannot
      // enforce the required prop).
      if (isApplePlatform()) return null;
      if (props.variant !== "standard" && props.variant !== "flush") return null;
      const win = resolveWindowApi();
      if (!win) return null;

      // Toggle, then re-read the shell state: the glyph must follow the real
      // window, not a local guess. The re-read stays even though the watcher
      // also fires on resize — the shell may publish that event before it has
      // actually flipped its own flag, and the user's click is the one moment a
      // stale glyph is unacceptable. Every step is handled, and a torn-down
      // component never writes.
      const toggleMaximize = () => {
        void win
          .toggleMaximize()
          .then(() => win.isMaximized())
          .then(
            (value) => {
              if (!disposed) maximized.value = value;
            },
            () => {},
          );
      };

      // A refused shell call must never surface as an unhandled rejection (the
      // family's res/fatal-fallback.js turns one into a full-screen boot
      // failure) and must never look like a working button. The boot bar shows
      // the degraded state when it is the one drawing the controls; here the
      // host's own footer simply keeps the glyph it had.
      const ignore = (pending: Promise<unknown>) => void pending.catch(() => {});

      const flush = props.variant === "flush";
      return (
        <div
          class={{ "hk-window-controls": true, "hk-window-controls--flush": flush }}
          data-tauri-drag-region={false}
        >
          <button
            type="button"
            class="hk-window-controls__btn"
            aria-label="Minimize"
            onClick={() => ignore(win.minimize())}
          >
            <Minus size={flush ? 14 : 16} />
          </button>
          <button
            type="button"
            class="hk-window-controls__btn"
            aria-label={maximized.value ? "Restore" : "Maximize"}
            onClick={toggleMaximize}
          >
            {maximized.value
              ? <Copy size={flush ? 12 : 14} style={{ transform: "rotate(180deg)" }} />
              : <Square size={flush ? 12 : 14} />}
          </button>
          <button
            type="button"
            class="hk-window-controls__btn hk-window-controls__btn--close"
            aria-label="Close"
            onClick={() => ignore(win.close())}
          >
            <X size={flush ? 14 : 16} />
          </button>
        </div>
      );
    };
  },
});

export default HkWindowControls;
