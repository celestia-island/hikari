import { defineComponent, onBeforeUnmount, onMounted, ref } from "vue";

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
 * component swaps the maximize/restore glyph — no shell probing inside.
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
    return () => (
      <div class="hk-titlebar" data-drag-region>
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
              title="Minimize"
              aria-label="Minimize"
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
              title={props.maximized ? "Restore" : "Maximize"}
              aria-label={props.maximized ? "Restore" : "Maximize"}
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
              title="Close"
              aria-label="Close"
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
