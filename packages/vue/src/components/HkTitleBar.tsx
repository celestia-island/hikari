import { computed, defineComponent, onBeforeUnmount, onMounted, ref } from "vue";
import { useI18n } from "../i18n/context";
import { chromeGuard } from "../runtime/chromeGuard";

import "./HkTitleBar.scss";

/**
 * HkTitleBar — hybrid-shell window caption bar.
 *
 * A pure visual + event component: it renders the bar (app icon, title,
 * subtitle, draggable surface, right-side caption buttons) and EMITS
 * `minimize` / `toggle-maximize` / `close` / custom-button clicks. It
 * never touches a shell API itself — the host (Tauri, Electron, …) wires
 * those events to its own window controls, keeping hikari dependency-free.
 *
 * Dragging is pure CSS (`app-region: drag` on the bar, `no-drag` on the
 * interactive children) — supported by Tauri (WebView2/WKWebView/WebKitGTK)
 * and Electron alike; no JS drag logic needed.
 *
 * Text selection is disabled across the bar (captions are chrome, not
 * content).
 *
 * Buttons are selective: `showMinimize` / `showMaximize` / `showClose`
 * (defaults true/true/true) and `customActions` render extra icon buttons
 * to the LEFT of minimize, each emitting `action` with its id.
 *
 * The maximized state is data-driven: the host passes `maximized` and the
 * component swaps the maximize/restore glyph and squares the close button's
 * window corner radius (a maximized frame has no rounded corner to follow)
 * — no shell probing inside.
 *
 * The caption tooltips (minimize / maximize / restore / close) resolve
 * through the preset i18n keys (`hikari::titleBar.*`): the bar is window
 * chrome, so it follows the host's `setLocale` instead of receiving copy
 * through props — with the English strings as the t() fallback for hosts
 * that never set a locale.
 *
 * ## Modal-open guard (runtime/chromeGuard)
 *
 * While any HkModal-kind window is open, the bar flips into its GUARDED
 * rendering (`data-chrome-guarded`): the drag surface and the caption
 * buttons (minimize / maximize / close, tagged `data-window-control`)
 * stay alive, every other interactive element in the bar goes dead —
 * custom actions get a real `disabled` unless the window listed their id
 * in `keepCaptionActions`, and slotted controls (host hamburgers, view
 * switches) lose pointer events to the stylesheet's guard sweep. Bar
 * VISIBILITY never changes: the bar keeps painting above any overlay
 * (z contract: `--hk-z-titlebar` 100001 > `--hk-z-overlay-root` 90000 —
 * a host that traps the bar inside a stacking context below the overlay
 * root, e.g. `#app { z-index: 1 }`, breaks this contract in ITS css and
 * must un-trap it; the overlay root mounts to `<body>` and cannot reach
 * into host css).
 */
export default defineComponent({
  name: "HkTitleBar",
  props: {
    title: { type: String, default: "" },
    subtitle: { type: String, default: "" },
    /** App icon rendered left of the title (img src or inline node). */
    icon: { type: String, default: "" },
    maximized: { type: Boolean, default: false },
    showMinimize: { type: Boolean, default: true },
    showMaximize: { type: Boolean, default: true },
    showClose: { type: Boolean, default: true },
    /** Extra icon buttons rendered left of minimize. */
    customActions: {
      type: Array as () => { id: string; label: string; icon?: unknown }[],
      default: () => [],
    },
  },
  emits: {
    minimize: () => true,
    "toggle-maximize": () => true,
    close: () => true,
    /** A custom action button was clicked (id from `customActions`). */
    action: (_id: string) => true,
  },
  setup(props, { emit, slots }) {
    const { t } = useI18n();
    // Window-chrome guard (runtime/chromeGuard): while a modal-kind
    // window is open, everything in the bar except the drag surface and
    // the caption buttons goes dead. `keepCaptionActions` ids listed by
    // the live windows stay clickable and carry `data-keep-when-guarded`
    // so the stylesheet's pointer-events sweep exempts them too.
    const guarded = computed(() => chromeGuard.active.value);
    const keptIds = computed(() => chromeGuard.keep.value);
    const customActionState = (
      id: string,
    ): {
      disabled?: boolean;
      "aria-disabled"?: "true";
      "data-keep-when-guarded"?: true;
    } => {
      if (!guarded.value) return {};
      const kept = keptIds.value.has(id);
      return kept
        ? { "data-keep-when-guarded": true }
        : { disabled: true, "aria-disabled": "true" };
    };
    return () => (
      <div
        class="hk-titlebar"
        data-drag-region
        data-maximized={props.maximized || undefined}
        data-chrome-guarded={guarded.value || undefined}
      >
        {slots.left?.() ?? (
          <span class="hk-titlebar-title">
            {props.icon && <img class="hk-titlebar-icon" src={props.icon} alt="" />}
            <span class="hk-titlebar-title-text">{props.title}</span>
            {props.subtitle && (
              <span class="hk-titlebar-subtitle">{props.subtitle}</span>
            )}
          </span>
        )}
        <span class="hk-titlebar-spacer" />
        <div class="hk-titlebar-actions">
          {slots.actions?.()}
          {props.customActions.map((a) => (
            <button
              key={a.id}
              type="button"
              class="hk-titlebar-btn"
              title={a.label}
              aria-label={a.label}
              {...customActionState(a.id)}
              onClick={(e: MouseEvent) => {
                e.stopPropagation();
                emit("action", a.id);
              }}
            >
              {a.icon}
            </button>
          ))}
          {props.showMinimize && (
            <button
              type="button"
              class="hk-titlebar-btn"
              data-window-control
              title={t("hikari::titleBar.minimize", "Minimize")}
              aria-label={t("hikari::titleBar.minimize", "Minimize")}
              onClick={(e: MouseEvent) => {
                e.stopPropagation();
                emit("minimize");
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><path d="M5 12h14" /></svg>
            </button>
          )}
          {props.showMaximize && (
            <button
              type="button"
              class="hk-titlebar-btn"
              data-window-control
              title={props.maximized ? t("hikari::titleBar.restore", "Restore") : t("hikari::titleBar.maximize", "Maximize")}
              aria-label={props.maximized ? t("hikari::titleBar.restore", "Restore") : t("hikari::titleBar.maximize", "Maximize")}
              onClick={(e: MouseEvent) => {
                e.stopPropagation();
                emit("toggle-maximize");
              }}
            >
              {props.maximized ? (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><rect x="3" y="8" width="13" height="13" rx="2" /><path d="M8 8V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-3" /></svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><rect x="4" y="4" width="16" height="16" rx="2" /></svg>
              )}
            </button>
          )}
          {props.showClose && (
            <button
              type="button"
              class="hk-titlebar-btn hk-titlebar-btn-close"
              data-window-control
              title={t("hikari::titleBar.close", "Close")}
              aria-label={t("hikari::titleBar.close", "Close")}
              onClick={(e: MouseEvent) => {
                e.stopPropagation();
                emit("close");
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          )}
        </div>
      </div>
    );
  },
});
