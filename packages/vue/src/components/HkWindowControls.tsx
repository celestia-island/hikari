import { defineComponent, onMounted, onUnmounted, ref, type PropType } from "vue";

import { Minus, Square, X, Copy } from "lucide-vue-next";

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
 * The window API rides `__TAURI__.window.getCurrentWindow()` when
 * present; on a non-Tauri host (browser preview) the buttons render
 * but the calls no-op, keeping visual parity for storybook/tests.
 */

interface TauriWindowLike {
  minimize(): Promise<void>;
  toggleMaximize(): Promise<void>;
  close(): Promise<void>;
  isMaximized(): Promise<boolean>;
  onResized(cb: () => void): Promise<() => void>;
}

function currentWindow(): TauriWindowLike | null {
  const w = (
    window as unknown as {
      __TAURI__?: { window?: { getCurrentWindow?: () => TauriWindowLike } };
    }
  ).__TAURI__?.window;
  return w?.getCurrentWindow?.() ?? null;
}

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
    let unlisten: (() => void) | null = null;

    onMounted(async () => {
      const win = currentWindow();
      if (!win) return;
      try {
        const refresh = () => void win.isMaximized().then((m) => (maximized.value = m));
        refresh();
        const off = await win.onResized(refresh);
        unlisten = off;
      } catch {
        /* the window API is optional furniture */
      }
    });

    onUnmounted(() => {
      unlisten?.();
    });

    return () => {
      // Two render gates before any chrome: Apple owns its traffic
      // lights, and a host that forgot the variant gets NOTHING (the
      // explicit-None contract — belt for runtime JS where TS cannot
      // enforce the required prop).
      if (isApplePlatform()) return null;
      if (props.variant !== "standard" && props.variant !== "flush") return null;
      const win = currentWindow();
      if (!win) return null;

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
            onClick={() => void win.minimize()}
          >
            <Minus size={flush ? 14 : 16} />
          </button>
          <button
            type="button"
            class="hk-window-controls__btn"
            aria-label={maximized.value ? "Restore" : "Maximize"}
            onClick={() => void win.toggleMaximize()}
          >
            {maximized.value
              ? <Copy size={flush ? 12 : 14} style={{ transform: "rotate(180deg)" }} />
              : <Square size={flush ? 12 : 14} />}
          </button>
          <button
            type="button"
            class="hk-window-controls__btn hk-window-controls__btn--close"
            aria-label="Close"
            onClick={() => void win.close()}
          >
            <X size={flush ? 14 : 16} />
          </button>
        </div>
      );
    };
  },
});

export default HkWindowControls;
