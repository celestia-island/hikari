// installHkTooltipBridge — document-level replacement for NATIVE tooltips.
//
// Hover/focus on ANY element carrying a `title` attribute shows an
// HkTooltip-styled popup instead of the browser's built-in one, so every
// existing `title=` call site in a host app upgrades to the house tooltip
// look with zero per-component migration. The mechanics:
//
//   engage (pointerover / focusin, delegated; a pointerover with
//     pointerType "touch" never engages — the touch hint bar owns
//     touch pointers, and stripping the title would break its fallback)
//     → the element's title is moved aside into `data-hk-title` and the
//       attribute is REMOVED — the native tooltip can no longer appear
//     → after the delay the shared `.hk-tooltip-popup` element is filled,
//       positioned (applyTooltipPosition: same placement/zoom math as
//       HkTooltip, plus the viewport-gutter clamp) and faded in
//   disengage (pointerout / focusout / scroll / resize / Esc / a touch
//     pointerdown anywhere — touch uses the per-modality strategy: the
//     hint bar owns titles, so touch never hover- or focus-engages and
//     any tap fully disconnects a stale hold); a mouse pointerdown
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
// popups share the tooltip z band with component tooltips — inside the
// overlay root, which is where the popup MOUNTS (same home as the
// HkTooltip component's teleported popup: the in-root ordinal z is
// meaningless at body level once #hk-overlay-root carries its own
// document-space elevation). Installing twice on the same document is
// idempotent: the second install returns the first install's uninstall.
// Side effect: ensures #hk-overlay-root exists before the install appends
// the popup (the component tooltip's Teleport target is the same node).
//
// Caption-band exemption (2026-11-17): a trigger marked
// `data-hk-tooltip-band-overlap` (or an overlap-by-default install) is
// allowed to PIN over the host caption strip — and must therefore PAINT
// over it too. That bubble relocates to the above-titlebar root
// (#hk-top-root, overlay/topRoot.ts) for the show, then moves back to the
// overlay root on hide: the elevation is granted per trigger and only
// while the bubble is up, exactly like the exemption itself.
import { ensureOverlayRoot } from "../overlay/overlayRoot";
import { TOP_ROOT_SELECTOR, ensureTopRoot } from "../overlay/topRoot";
import { applyTooltipPosition, type TooltipPlacement } from "./tooltipPosition";
import { usePopupManager, type PopupHandle } from "./usePopupManager";
import { reportHkRuntime, type HkRuntimeHandle } from "./registry";
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
  /**
   * The caption-band exemption DEFAULT for this install (2026-11-12 user
   * direction): false keeps every bridge tooltip off the host caption
   * strip (the popup frame floors at band + 4px, popupBounds); true lets
   * them pin over it. The data-hk-tooltip-band-overlap attribute opts a
   * single trigger in or out (the per-trigger marker WINS over this
   * install default, which is how the title bar's own buttons
   * (HkTitleBar) keep their captions readable on the strip); since
   * 2026-11-17 the nearest marked ANCESTOR governs too, so a host-drawn
   * caption band declares the exemption ONCE on its band row and every
   * button inside inherits it. An exempted bubble also paints above the
   * band: the shared popup relocates to the above-titlebar root
   * (overlay/topRoot.ts) only while it shows.
   */
  allowBandOverlap?: boolean;
}

interface BridgeState {
  /** The pointer modality of the last pointer event (mouse/touch/pen).
   * Touch never hover-engages and never focus-engages — the touch hint
   * bar owns titles there (2026-11-15 user ruling: per-modality
   * strategy). Empty until the first pointer event. */
  lastPointerType: string;
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
  allowBandOverlap: boolean;
  describedBy: string;
  /** How many tooltips this install has shown (registry meta). */
  shown: number;
  /** Runtime-registry handle for this install (the "context of contexts"). */
  runtime?: HkRuntimeHandle;
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
  // An exempted bubble returned the elevation with its show — park the
  // shared popup back in the overlay root so the next non-exempt tooltip
  // starts from its normal home (and the invariant "idle bridge popup
  // lives in #hk-overlay-root" stays true).
  const home = ensureOverlayRoot();
  if (home && state.popup.parentElement !== home) home.appendChild(state.popup);
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
  // Resolve the exemption ONCE and let it decide the popup's home too:
  // an exempted bubble may pin over the caption strip, so it must paint
  // above it (the above-titlebar root); every other bubble keeps the
  // overlay root, where popupBounds floors it below the band.
  //
  // Resolution order (2026-11-17 extension): the trigger's OWN marker
  // wins; otherwise the nearest marked ANCESTOR governs — a host that
  // draws its own caption band can declare the exemption once on the
  // band row (`data-hk-tooltip-band-overlap="true"`) instead of
  // sprinkling it on every button; finally the install default applies.
  // Presence opts IN even on an avoid-by-default install, an explicit
  // "false" opts OUT even on an overlap-by-default one.
  const ownMarker = el.getAttribute("data-hk-tooltip-band-overlap");
  const ancestorMarker = el.closest("[data-hk-tooltip-band-overlap]");
  const exempted =
    ownMarker !== null
      ? ownMarker !== "false"
      : ancestorMarker
        ? ancestorMarker.getAttribute("data-hk-tooltip-band-overlap") !== "false"
        : state.allowBandOverlap;
  // A trigger INSIDE an above-titlebar layer (a title on a notification
  // row, a caption menu entry) shares that layer's home and exemption:
  // the bubble would otherwise be painted under its own parent surface
  // (round-1 verification finding, 2026-11-17).
  const insideTopRoot = el.closest(TOP_ROOT_SELECTOR) != null;
  const allowBandOverlap = exempted || insideTopRoot;
  const home = allowBandOverlap ? ensureTopRoot() ?? ensureOverlayRoot() : ensureOverlayRoot();
  if (home && state.popup.parentElement !== home) home.appendChild(state.popup);
  // Same geometry as component tooltips: the fixed popup pins to the
  // trigger rect with the shared placement switch (ancestor zoom aware),
  // then the measured box is clamped into the viewport gutter — a title
  // trigger hugging the screen edge shows a full-width bubble shifted
  // inside the gutter, never the squeezed leftover-space column.
  applyTooltipPosition(
    state.popup,
    el.getBoundingClientRect(),
    state.placement,
    state.maxWidth,
    { allowBandOverlap },
  );
  state.popup.classList.add("hk-tooltip-visible");
  el.setAttribute("aria-describedby", state.describedBy);
  state.shown += 1;
  state.runtime?.pulse({ shown: state.shown });
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
  state.runtime?.dispose();
}

/**
 * Install the document-level native-tooltip replacement. Returns the
 * uninstaller (removes listeners, restores any held title, drops the
 * popup element). Idempotent per document. The install reports itself to
 * the runtime registry (`tooltipBridge`, kind "hook") and pulses with a
 * running `shown` count — the signature and options are unchanged.
 */
export function installHkTooltipBridge(options: HkTooltipBridgeOptions = {}): () => void {
  if (typeof document === "undefined") return () => undefined;
  // The same SSR gate one level down: `ensureOverlayRoot` reports the
  // truly-absent root instead of inventing one, so bail before building a
  // popup that could never be attached.
  const overlayRoot = ensureOverlayRoot();
  if (!overlayRoot) return () => undefined;
  const existing = INSTALLS.get(document);
  if (existing) return () => uninstall(existing);

  const popup = document.createElement("div");
  popup.className = "hk-tooltip-popup hk-tooltip-bridge";
  const content = document.createElement("div");
  content.className = "hk-tooltip-content";
  popup.appendChild(content);
  // Mount into the overlay root, NOT <body> (2026-10-16 defect report):
  // the manager's z here is the IN-ROOT ordinal band (tooltip 300, above
  // anchored popups 200) — it only competes inside the root's
  // `isolation: isolate` fence. At body level the same number is a
  // near-bottom document z, far under `#hk-overlay-root`'s own elevation
  // (--hk-z-overlay-root, 90000), so every tooltip the bridge showed over
  // an overlay-hosted surface — the filter panel's operator `title=`s
  // over its popover — painted UNDER the panel and was clipped by it.
  // The component tooltips teleport into the root for exactly this
  // reason; the bridge shares their popup classes AND must share their
  // home. `pointer-events` stays none on both the root and the popup, so
  // the hosting subtree changes nothing about hit-testing.
  overlayRoot.appendChild(popup);

  const state: BridgeState = {
    lastPointerType: "",
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
    allowBandOverlap: options.allowBandOverlap ?? false,
    describedBy: `hk-tooltip-bridge-${++bridgeSeq}`,
    shown: 0,
  };
  popup.id = state.describedBy;
  state.runtime = reportHkRuntime("tooltipBridge", {
    kind: "hook",
    description: "Document-level native-tooltip replacement: any [title] element gets the HkTooltip-styled popup.",
    meta: {
      delay: state.delay,
      placement: state.placement,
      selector: state.selector,
      allowBandOverlap: state.allowBandOverlap,
      shown: 0,
    },
    read: () => ({ installed: true, engaged: state.active !== null, shown: state.shown }),
  });

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
    // Touch pointers never hover: a finger drag fires pointerover en
    // route, but the touch half (runtime/touchHint.ts) owns those
    // pointers — engaging here would strip the title attribute for an
    // anchored popup the touch mode never shows, and break the touch
    // bar's own title fallback. Pen keeps hover (stylus users hover).
    // Focus (focusin below) is untouched: keyboard a11y still engages.
    state.lastPointerType = (e as PointerEvent).pointerType || "mouse";
    if ((e as PointerEvent).pointerType === "touch") return;
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

  on("pointerdown", (e) => {
    const pointerType = (e as PointerEvent).pointerType || "mouse";
    state.lastPointerType = pointerType;
    if (pointerType === "touch") {
      // A finger tap DISCONNECTS any hold (mouse keeps it — pressing
      // with the tooltip up must not flash a native tooltip). On touch
      // the popup can only be stale (focus/pointer paths are gated);
      // restoring the title returns the element to the pre-engage state
      // the touch hint bar reads from.
      if (state.active) disengage(state);
      return;
    }
    if (state.active) hidePopup(state); // native also hides on press; stay engaged
  }, { capture: true, passive: true });

  on("focusin", (e) => {
    // Touch taps focus buttons (Android), and nothing on a touch page
    // ever blurs them — an unmodality-gated focus path stuck the gray
    // tooltip on screen permanently (2026-11-15 field report). When the
    // last pointer was a finger, the touch hint bar owns titles; the
    // title attribute stays in place for AT announcement.
    if (state.lastPointerType === "touch") return;
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
    // Typing/tabs switch the modality back to keyboard: a hardware-
    // keyboard user on a hybrid device must not lose focus tooltips
    // because a finger touched the screen earlier (sticky-modality fix,
    // round-2 review PR #1338).
    state.lastPointerType = "keyboard";
    if ((e as KeyboardEvent).key === "Escape" && state.active) disengage(state);
  }, { capture: true });

  INSTALLS.set(document, state);
  return () => uninstall(state);
}
