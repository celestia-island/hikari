// installHkTooltipBridge — document-level replacement for NATIVE tooltips.
//
// Hover/focus on ANY element carrying a `title` attribute shows an
// HkTooltip-styled popup instead of the browser's built-in one, so every
// existing `title=` call site in a host app upgrades to the house tooltip
// look with zero per-component migration. The mechanics:
//
//   engage (pointerover / focusin, delegated)
//     → the element's title is moved aside into `data-hk-title` and the
//       attribute is REMOVED — the native tooltip can no longer appear
//     → after the delay the shared `.hk-tooltip-popup` element is filled,
//       positioned (tooltipPositionStyle: same placement/zoom math as
//       HkTooltip) and faded in
//   disengage (pointerout / focusout / scroll / resize / Esc); pointerdown
//     only hides the popup — the hold stays so no native tooltip flashes
//     → the popup fades out and the title attribute is RESTORED, so
//       view-source fidelity and non-pointer readers keep the original
//       markup (screen readers announce the title on focus as before;
//       while the popup is up it carries aria-describedby instead).
//
// Escape hatches:
//   - `[data-hk-tooltip-native]` keeps its native browser tooltip
//   - elements inside an `.hk-tooltip-wrapper` are already HkTooltip-
//     managed and are skipped (no double popups)
//   - empty / whitespace-only titles never engage
//
// The bridge holds one popup-manager handle (kind "tooltip"), so its
// popups share the tooltip z band with component tooltips. Installing
// twice on the same document is idempotent: the second install returns
// the first install's uninstall.
import { tooltipPositionStyle, type TooltipPlacement } from "./tooltipPosition";
import { usePopupManager, type PopupHandle } from "./usePopupManager";
// The popup reuses HkTooltip's popup classes — carry the sheet so a host
// that installs the bridge without mounting HkTooltip still renders the
// house look (scss imports are deduped, so double-import is free).
import "../components/HkTooltip.scss";

export interface HkTooltipBridgeOptions {
  /** Hover/focus → popup delay in ms (HkTooltip parity: 300). */
  delay?: number;
  /** Popup side relative to the trigger. */
  placement?: TooltipPlacement;
  /** Popup max-width (the shared SCSS caps at 280px by default). */
  maxWidth?: string;
  /** Which elements carry tooltip text. Default: `[title]`. */
  selector?: string;
  /** Elements matching this never engage (their title stays native). */
  exclude?: string;
}

interface BridgeState {
  root: Document;
  popup: HTMLDivElement;
  content: HTMLDivElement;
  handle: PopupHandle | null;
  listeners: Array<{ target: EventTarget; type: string; fn: EventListener; opts?: AddEventListenerOptions }>;
  active: Element | null;
  savedTitle: string | null;
  timer: ReturnType<typeof setTimeout> | null;
  delay: number;
  placement: TooltipPlacement;
  maxWidth: string | undefined;
  selector: string;
  exclude: string;
  describedBy: string;
}

const INSTALLS = new WeakMap<Document, BridgeState>();
let bridgeSeq = 0;

function stopTimer(state: BridgeState) {
  if (state.timer !== null) {
    clearTimeout(state.timer);
    state.timer = null;
  }
}

/** Fade the popup out without touching the held title. */
function hidePopup(state: BridgeState) {
  stopTimer(state);
  state.popup.classList.remove("hk-tooltip-visible");
  if (state.active) {
    // Hand the description relationship back: once the popup is gone the
    // restored title attribute speaks for itself again.
    state.active.removeAttribute("aria-describedby");
  }
}

/** Restore the title attribute stashed at engage time and drop the hold. */
function restoreTitle(state: BridgeState) {
  const el = state.active;
  const saved = state.savedTitle;
  state.active = null;
  state.savedTitle = null;
  if (!el) return;
  // Write back ONLY into the exact state WE created (attr removed).
  // Anything else is a fresher writer that must win:
  //   - a host re-set a title while we held it removed → theirs;
  //   - HkPopover's open-state suppression blanks titles via `title=""`
  //     and restores its own snapshots on close — resurrecting ours over
  //     its blank would defeat it (engage already skips empty titles, so
  //     blanked elements can never be the engaged ones);
  //   - a Vue binding flipped to `undefined` → Vue REMOVES the attr, and
  //     a stale resurrection would keep showing dead text.
  // Vue never re-adds an attr it saw removed while its vnode value stayed
  // unchanged, so this restore is what keeps static titles alive after a
  // plain hover.
  if (saved !== null && !el.hasAttribute("title")) {
    el.setAttribute("title", saved);
  }
  delete (el as HTMLElement).dataset.hkTitle;
}

function disengage(state: BridgeState) {
  stopTimer(state);
  hidePopup(state);
  restoreTitle(state);
}

function showPopup(state: BridgeState, el: Element) {
  const text = state.savedTitle;
  if (!text || !state.popup.isConnected) return;
  state.content.textContent = text;
  // Same geometry as component tooltips: the fixed popup pins to the
  // trigger rect with the shared placement switch (ancestor zoom aware).
  Object.assign(state.popup.style, tooltipPositionStyle(
    el.getBoundingClientRect(),
    state.placement,
    state.maxWidth,
  ));
  state.popup.classList.add("hk-tooltip-visible");
  el.setAttribute("aria-describedby", state.describedBy);
}

function engage(state: BridgeState, el: Element) {
  if (state.active === el) return; // moving across the trigger's children
  if (state.active) disengage(state);
  const title = el.getAttribute("title");
  if (!title || !title.trim()) return;
  state.active = el;
  state.savedTitle = title;
  (el as HTMLElement).dataset.hkTitle = title;
  el.removeAttribute("title");
  stopTimer(state);
  state.timer = setTimeout(() => {
    state.timer = null;
    showPopup(state, el);
  }, state.delay);
}

function shouldEngage(state: BridgeState, target: EventTarget | null): Element | null {
  if (!target || !(target instanceof Element)) return null;
  // Skip HkTooltip-managed triggers and the bridge's own popup.
  if (target.closest(".hk-tooltip-wrapper") || target.closest(".hk-tooltip-popup")) return null;
  if (target.closest("[data-hk-tooltip-native]")) return null;
  if (state.exclude && target.closest(state.exclude)) return null;
  const el = target.closest(state.selector);
  // HTML and SVG elements both carry dataset/getBoundingClientRect/attrs —
  // an <svg title=...> gets the house popup just like a <button>.
  return el instanceof HTMLElement || el instanceof SVGElement ? el : null;
}

function uninstall(state: BridgeState) {
  if (INSTALLS.get(state.root) === state) INSTALLS.delete(state.root);
  disengage(state);
  for (const { target, type, fn, opts } of state.listeners.splice(0)) {
    target.removeEventListener(type, fn, opts);
  }
  if (state.handle) {
    try {
      usePopupManager().unregister(state.handle.id);
    } catch {
      /* handle already gone */
    }
    state.handle = null;
  }
  state.popup.remove();
}

/**
 * Install the document-level native-tooltip replacement. Returns the
 * uninstaller (removes listeners, restores any held title, drops the
 * popup element). Idempotent per document.
 */
export function installHkTooltipBridge(options: HkTooltipBridgeOptions = {}): () => void {
  if (typeof document === "undefined") return () => undefined;
  const existing = INSTALLS.get(document);
  if (existing) return () => uninstall(existing);

  const popup = document.createElement("div");
  popup.className = "hk-tooltip-popup hk-tooltip-bridge";
  const content = document.createElement("div");
  content.className = "hk-tooltip-content";
  popup.appendChild(content);
  document.body.appendChild(popup);

  const state: BridgeState = {
    root: document,
    popup,
    content,
    handle: null,
    listeners: [],
    active: null,
    savedTitle: null,
    timer: null,
    delay: options.delay ?? 300,
    placement: options.placement ?? "top",
    maxWidth: options.maxWidth,
    selector: options.selector ?? "[title]",
    exclude: options.exclude ?? "",
    describedBy: `hk-tooltip-bridge-${++bridgeSeq}`,
  };
  popup.id = state.describedBy;

  // One popup-manager handle for the bridge's lifetime: its popups hold
  // the tooltip band (above overlays, below toasts) exactly like
  // component tooltips do.
  try {
    state.handle = usePopupManager().register("tooltip", false);
    popup.style.zIndex = String(state.handle.zIndex);
  } catch {
    state.handle = null; // popup manager unavailable — CSS fallback z-index
  }

  const on = (type: string, fn: EventListener, opts?: AddEventListenerOptions) => {
    document.addEventListener(type, fn, opts);
    state.listeners.push({ target: document, type, fn, opts });
  };

  on("pointerover", (e) => {
    const el = shouldEngage(state, e.target);
    if (el) engage(state, el);
  }, { capture: true, passive: true });

  on("pointerout", (e) => {
    if (!state.active) return;
    const target = e.target instanceof Element ? e.target : null;
    if (!target) return;
    // Only leave when the pointer exited the engaged element entirely.
    // Containment — NOT the selector: engagement removed the title
    // attribute, so the engaged element no longer matches `[title]`.
    const related = (e as MouseEvent).relatedTarget;
    if ((target === state.active || state.active.contains(target))
      && !(related instanceof Element && state.active.contains(related))) {
      disengage(state);
    }
  }, { capture: true, passive: true });

  on("pointerdown", () => {
    if (state.active) hidePopup(state); // native also hides on press; stay engaged
  }, { capture: true, passive: true });

  on("focusin", (e) => {
    const el = shouldEngage(state, e.target);
    if (el) engage(state, el);
  }, { capture: true });

  on("focusout", (e) => {
    if (!state.active) return;
    if (e.target instanceof Element
      && (e.target === state.active || state.active.contains(e.target))) {
      disengage(state);
    }
  }, { capture: true });

  // Any scroll/resize anywhere invalidates the fixed-position geometry —
  // DISCONNECT entirely (restore the title, drop the hold), not just hide:
  // a hide-only path would leave the trigger with its title attribute
  // removed and no aria-describedby while the pointer rests on it. The
  // popup re-arms through a fresh engage on the next pointer move.
  // NOTE: resize fires at WINDOW (never routed through document capture),
  // so it binds there explicitly; element scrolls are capture-reachable
  // from the document.
  on("scroll", () => {
    if (state.active) disengage(state);
  }, { capture: true, passive: true });
  const view = document.defaultView;
  if (view) {
    const onResize = () => {
      if (state.active) disengage(state);
    };
    view.addEventListener("resize", onResize);
    state.listeners.push({ target: view, type: "resize", fn: onResize });
  }

  on("keydown", (e) => {
    if ((e as KeyboardEvent).key === "Escape" && state.active) disengage(state);
  }, { capture: true });

  INSTALLS.set(document, state);
  return () => uninstall(state);
}
