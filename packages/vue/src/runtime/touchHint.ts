// installHkTouchHintBridge — the TOUCH half of hikari's tooltip story.
//
// The hover bridge (runtime/tooltipBridge.ts) and HkTooltip serve pointers
// that can HOVER: a gliding mouse, a stylus floating over the glass. A
// finger cannot hover — on a phone the only "what is this?" gesture is the
// LONG-PRESS, and an anchored bubble is the wrong surface for it twice
// over: the finger occludes the very element being inspected, and the
// anchored geometry chases the tremoring contact point around the
// viewport edge. So the touch mode shows the hint in a bar DOCKED AT THE
// TOP CENTRE of the viewport — breadcrumb-like, deliberately NOT anchored
// at the finger — where it can never cover the content it explains.
//
// Mechanics (delegated at document level, CAPTURE phase, so an app root
// that stopPropagation()s in bubble phase cannot hide the gesture):
//
//   engage (pointerdown with pointerType touch|pen — mouse NEVER
//           engages; hybrid devices keep their hover tooltips)
//     → anchor = target.closest(selector); skipped when `exclude`
//       matches, when there is no anchor, when the anchor is disabled,
//       or when the text resolves to nothing at fire time
//     → the anchor is guarded against long-press side effects for the
//       hold (inline user-select / -webkit-touch-callout set to none,
//       restored reversibly on every exit). touchstart is NEVER
//       preventDefaulted — that would take scrolling away from the page.
//   hold (default 450ms, slop 10px)
//     → cancelled by pointermove beyond the slop (same pointerId), by
//       pointerup before the timer fires, by pointercancel, or by ANY
//       scroll while pending: a finger that moved was scrolling, not
//       asking. After the hint fires, movement alone no longer cancels —
//       the bar is not finger-anchored, so a drifting finger has nothing
//       to chase; the scroll that follows still hides it.
//   fire
//     → text = resolve(anchor) ?? title ?? data-hk-title (the hover
//       bridge stashes held titles there), trimmed; empty → no show
//     → showHkTouchHintBar(text); ONE subsequent contextmenu inside the
//       anchor is swallowed (Android synthesizes its own long-press
//       menu right after ours fires) — exactly one, then the flag
//       clears and a second menu request is a real gesture.
//
// Bar lifecycle while shown: the bar stays while the finger is down; on
// pointerup the linger timer starts (default 2200ms — long enough to read
// a sentence, short enough not to outstay the answer); ANY pointerdown,
// scroll, Escape or window blur hides it immediately.
//
// The install is idempotent per document exactly like the hover bridge
// (WeakMap<Document, State>; a second install returns the first's
// uninstall) and reports itself to the runtime registry as
// `touchHintBridge`, pulsing a running `shown` count. The BAR itself is
// NOT install-owned: armTouchHint (the component hook HkTooltip uses)
// presents the same bar with no install at all, so uninstalling the
// bridge never tears the presenter down — the bar simply hides through
// its own lifecycle.
import { ensureOverlayRoot } from "../overlay/overlayRoot";
import { usePopupManager, type PopupHandle } from "./usePopupManager";
import { reportHkRuntime, type HkRuntimeHandle } from "./registry";
// The bar carries its own sheet (the imageFallback precedent: a runtime
// module ships the chrome it needs, scss imports dedupe, so a host that
// also pulls the sheet through a bundle pays nothing twice).
import "./touchHint.scss";

export interface HkTouchHintOptions {
  /** Long-press hold before the hint fires, in ms. Default 450. */
  holdMs?: number;
  /** Finger travel that cancels a pending hold, in px. Default 10. */
  slopPx?: number;
  /** How long the bar lingers after the finger lifts, in ms. Default 2200. */
  lingerMs?: number;
  /** Which elements carry hint text. Default `[title]`. */
  selector?: string;
  /** Elements matching this never engage. */
  exclude?: string;
  /**
   * Custom text source. Wins whenever it produces a non-empty string;
   * null/undefined falls through to the title/data-hk-title chain.
   */
  resolve?: (el: Element) => string | null | undefined;
}

/** armTouchHint tuning — the timing trio plus the gesture handover. */
export interface HkTouchHintArmOptions {
  holdMs?: number;
  slopPx?: number;
  lingerMs?: number;
  /**
   * The pointer that pressed, so other fingers cannot cancel the hold.
   * Unpassed, every pointer's move/up counts (a bare caller's simplest
   * contract).
   */
  pointerId?: number;
  /**
   * The press point for the slop math. armTouchHint is called from
   * inside a pointerdown handler whose event it cannot see, so callers
   * hand over the contact point; the fallback is the element's centre —
   * within a fingertip of the true down point for the wrapper-sized
   * elements this hook serves.
   */
  origin?: { x: number; y: number };
}

const DEFAULT_HOLD_MS = 450;
const DEFAULT_SLOP_PX = 10;
const DEFAULT_LINGER_MS = 2200;

/** Sentinel pointerId that matches every pointer (see ArmOptions). */
const ANY_POINTER = -1;

interface TouchHintState {
  root: Document;
  listeners: Array<{ target: EventTarget; type: string; fn: EventListener; opts?: AddEventListenerOptions }>;
  /** Cancel function of the one live hold (null while idle). */
  hold: (() => void) | null;
  holdMs: number;
  slopPx: number;
  lingerMs: number;
  selector: string;
  exclude: string;
  resolve?: (el: Element) => string | null | undefined;
  /** How many hints this install has shown (registry meta). */
  shown: number;
  /** Runtime-registry handle for this install (the "context of contexts"). */
  runtime?: HkRuntimeHandle;
}

const INSTALLS = new WeakMap<Document, TouchHintState>();

// ── the presenter: ONE bar per page ──────────────────────────────────────

/**
 * The bar is module state, not install state: the delegated bridge and
 * every armTouchHint caller present through the SAME element, so hints
 * from different sources can never stack two bars over the status strip.
 */
let barEl: HTMLDivElement | null = null;
let barHandle: PopupHandle | null = null;
let barVisible = false;
/** True while the press that fired the hint is still down. */
let barHeld = false;
/** Linger window of the gesture that showed the bar (presentBar arg). */
let barLingerMs = DEFAULT_LINGER_MS;
let lingerTimer: ReturnType<typeof setTimeout> | null = null;
/** The anchor whose NEXT contextmenu is ours to swallow (see fire). */
let suppressContextIn: Element | null = null;
/** The lifecycle listeners bind once, on the first bar creation. */
let lifecycleBound = false;

function stopLinger() {
  if (lingerTimer !== null) {
    clearTimeout(lingerTimer);
    lingerTimer = null;
  }
}

function hideBar() {
  stopLinger();
  barVisible = false;
  barHeld = false;
  // The suppression flag dies with the bar: a contextmenu that arrives
  // after the hint is gone belongs to a fresh gesture.
  suppressContextIn = null;
  barEl?.classList.remove("is-on");
}

function startLinger() {
  stopLinger();
  lingerTimer = setTimeout(() => {
    lingerTimer = null;
    hideBar();
  }, barLingerMs);
}

function bindBarLifecycle() {
  if (lifecycleBound) return;
  lifecycleBound = true;
  // Page-global dismissals, all CAPTURE at document level: an app root
  // that stops propagation in bubble phase must not be able to pin the
  // bar open either.
  document.addEventListener("pointerdown", () => {
    // A new press ends the previous hint immediately — the user has
    // moved on. That same press may arm the NEXT hint; that is the
    // recognizer's business, not the presenter's.
    if (barVisible) hideBar();
  }, { capture: true, passive: true });
  const settle = () => {
    // Finger lifted (or the platform reclaimed the gesture): hold the
    // text on screen for the linger window, then hide. No pointerId
    // filter here — the presenter never knew the pointer, and a lift of
    // ANY finger reads the same to the user looking at the bar.
    if (barVisible && barHeld) {
      barHeld = false;
      startLinger();
    }
  };
  document.addEventListener("pointerup", settle, { capture: true, passive: true });
  document.addEventListener("pointercancel", settle, { capture: true, passive: true });
  // Any scroll invalidates the "content being inspected" premise — the
  // page moved under the finger, so the hint is about something else now.
  document.addEventListener("scroll", () => {
    if (barVisible) hideBar();
  }, { capture: true, passive: true });
  document.addEventListener("keydown", (e) => {
    if (barVisible && (e as KeyboardEvent).key === "Escape") hideBar();
  }, { capture: true, passive: true });
  // NOTE: blur fires at WINDOW (never routed through document capture),
  // so it binds there explicitly — same asymmetry the hover bridge
  // documents for resize.
  document.defaultView?.addEventListener("blur", () => {
    if (barVisible) hideBar();
  });
  // The one deliberate preventDefault in the module: swallow the FIRST
  // contextmenu inside the anchor that just fired (Android's long-press
  // menu), then stand down. Outside events do not consume the flag —
  // only the anchor's own menu is ours.
  document.addEventListener("contextmenu", (e) => {
    if (!suppressContextIn || e.defaultPrevented) return;
    const target = e.target;
    if (target instanceof Node && suppressContextIn.contains(target)) {
      e.preventDefault();
      suppressContextIn = null;
    }
  }, { capture: true });
}

function ensureBar(): HTMLDivElement | null {
  const overlayRoot = ensureOverlayRoot();
  if (!overlayRoot) return null;
  if (barEl && barEl.isConnected) return barEl;
  // (Re)create: first show, or a test/host tore the node out of the DOM —
  // the presenter self-heals instead of writing text into a detached
  // node forever. A rebuild re-registers the z handle: whoever removed
  // the element also swept the registry (the house test discipline), and
  // a stale handle's z would silently stop tracking the band.
  if (barHandle) {
    try {
      usePopupManager().unregister(barHandle.id);
    } catch {
      /* handle already gone */
    }
    barHandle = null;
  }
  const bar = document.createElement("div");
  bar.className = "hk-touch-hint-bar";
  // role=status + aria-live=polite: the hint replaces an unreadable
  // native tooltip for touch users, so it must ANNOUNCE itself once,
  // without interrupting (polite, not assertive).
  bar.setAttribute("role", "status");
  bar.setAttribute("aria-live", "polite");
  // Mount into the overlay root, NOT <body> (the 2026-10-16 defect the
  // hover bridge documents): the manager's z is the in-root tooltip-band
  // ordinal and only competes inside the root's isolation fence; at body
  // level the same number is a near-bottom document z. The bar is a
  // tooltip-kind annotation, so it takes the SAME band handle pattern
  // the bridge uses verbatim — registered OUTSIDE any component, which
  // the popup manager supports because its registry is a module
  // singleton, not an injection context (the bridge's tests run
  // headless with no Vue app; so do ours).
  overlayRoot.appendChild(bar);
  try {
    barHandle = usePopupManager().register("tooltip", false);
    bar.style.zIndex = String(barHandle.zIndex);
  } catch {
    barHandle = null; // popup manager unavailable — CSS fallback z-index
  }
  bindBarLifecycle();
  barEl = bar;
  return bar;
}

/** Internal show with the recognizer's linger window. */
function presentBar(text: string, lingerMs: number): void {
  const bar = ensureBar();
  if (!bar) return; // no overlay root at all (SSR) — nothing to mount into
  barLingerMs = lingerMs;
  stopLinger();
  bar.textContent = text; // text nodes only — hint text is never markup
  bar.classList.add("is-on");
  barVisible = true;
  // The recognizer fires mid-press: the finger is still down, so the
  // bar starts HELD and only the pointerup starts the linger.
  barHeld = true;
}

/**
 * Present `text` in the touch hint bar docked at the top of the
 * viewport. The public presenter face: HkTooltip's touch path rides it
 * through armTouchHint, and hosts may call it directly for bespoke
 * long-press surfaces. The bar stays until the lifecycle above retires
 * it (pointerdown / scroll / Escape / blur immediately, linger after the
 * next pointerup).
 */
export function showHkTouchHintBar(text: string): void {
  if (typeof document === "undefined") return;
  presentBar(text, DEFAULT_LINGER_MS);
}

// ── the recognizer: one long-press hold ──────────────────────────────────

interface HoldSpec {
  anchor: Element;
  pointerId: number;
  origin: { x: number; y: number };
  holdMs: number;
  slopPx: number;
  lingerMs: number;
  /** Text resolved AT FIRE TIME — titles can change during the hold. */
  text: () => string;
  /** Fires only when the hold elapses and text resolves non-empty. */
  onFire: (text: string) => void;
  /** Called on EVERY exit: cancel, fire-then-lift, external cancel. */
  onEnd: () => void;
}

/**
 * Run one long-press hold. Binds its own document-level capture
 * listeners (pointermove/pointerup/pointercancel/scroll) and returns the
 * external cancel function, which is also what every internal exit runs
 * through — one teardown path, so the anchor guards can never leak.
 */
function startHold(spec: HoldSpec): () => void {
  const style = (spec.anchor as HTMLElement).style;
  // Guards ON, reversibly: remember what was there so an author's own
  // inline value survives us, and absent stays absent (removeProperty,
  // not an empty-string write).
  const prevUserSelect = style.getPropertyValue("user-select");
  const prevCallout = style.getPropertyValue("-webkit-touch-callout");
  style.setProperty("user-select", "none");
  style.setProperty("-webkit-touch-callout", "none");
  let timer: ReturnType<typeof setTimeout> | null = null;
  let fired = false;
  let done = false;
  const listeners: Array<{ type: string; fn: EventListener; opts: AddEventListenerOptions }> = [];

  const end = () => {
    if (done) return;
    done = true;
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    if (prevUserSelect) style.setProperty("user-select", prevUserSelect);
    else style.removeProperty("user-select");
    if (prevCallout) style.setProperty("-webkit-touch-callout", prevCallout);
    else style.removeProperty("-webkit-touch-callout");
    for (const { type, fn, opts } of listeners.splice(0)) {
      document.removeEventListener(type, fn, opts);
    }
    spec.onEnd();
  };

  // Slop is evaluated only while pending (see the module header); moves
  // of OTHER pointers never cancel — multitouch nearby is not this
  // gesture going wrong.
  const onMove = (e: Event) => {
    if (fired || done) return;
    const pe = e as PointerEvent;
    if (spec.pointerId !== ANY_POINTER && pe.pointerId !== spec.pointerId) return;
    if (Math.hypot(pe.clientX - spec.origin.x, pe.clientY - spec.origin.y) > spec.slopPx) end();
  };
  // One handler for up and cancel: before the fire both mean "the ask
  // was retracted"; after it the bar is already up and the PRESENTER
  // owns it (linger on lift) — this only restores the guards.
  const onLift = (e: Event) => {
    if (done) return;
    const pe = e as PointerEvent;
    if (spec.pointerId !== ANY_POINTER && pe.pointerId !== spec.pointerId) return;
    end();
  };
  // Pending: a scrolling finger was not asking. Fired: the presenter is
  // hiding the bar on this same scroll anyway — restore the guards now.
  const onScroll = () => end();

  const on = (type: string, fn: EventListener) => {
    // Passive everywhere: this module never preventDefaults a pointer or
    // scroll event (the lone preventDefault is the contextmenu swallow),
    // and a passive listener keeps the scroll path off the main-thread
    // sync wait.
    const opts: AddEventListenerOptions = { capture: true, passive: true };
    document.addEventListener(type, fn, opts);
    listeners.push({ type, fn, opts });
  };
  on("pointermove", onMove);
  on("pointerup", onLift);
  on("pointercancel", onLift);
  on("scroll", onScroll);

  timer = setTimeout(() => {
    timer = null;
    fired = true;
    const text = spec.text();
    if (!text) {
      end(); // nothing to say — same teardown, just earlier
      return;
    }
    spec.onFire(text);
    // Listeners STAY bound: the guards must survive the rest of the
    // press (iOS fires its text-selection callout at ~500ms, right
    // after our 450ms hint), so the guards only come back on lift,
    // scroll or external cancel.
  }, spec.holdMs);

  return end;
}

/** True for a form control in its disabled face. `disabled` is
 *  declared on the control elements (button/input/select/textarea),
 *  not on HTMLElement — narrow instead of casting so a misspelled
 *  element type stays a compile error. */
function isDisabledControl(el: Element): boolean {
  return el instanceof HTMLButtonElement
    || el instanceof HTMLInputElement
    || el instanceof HTMLSelectElement
    || el instanceof HTMLTextAreaElement
    ? el.disabled
    : false;
}

/** resolve() is an enhancer, not a gate: it wins when it produces text,
 *  anything null-ish falls through to the attribute chain — the hover
 *  bridge stashes held titles in data-hk-title, so an element it is
 *  currently managing still hints. */
function resolveHintText(
  el: Element,
  resolve?: (el: Element) => string | null | undefined,
): string {
  const custom = resolve?.(el);
  if (custom != null && custom.trim()) return custom.trim();
  const raw = el.getAttribute("title") ?? el.getAttribute("data-hk-title");
  return (raw ?? "").trim();
}

// ── the delegated installer ──────────────────────────────────────────────

function uninstall(state: TouchHintState): void {
  if (INSTALLS.get(state.root) === state) INSTALLS.delete(state.root);
  // Cancel a pending hold first: end() restores the anchor guards before
  // anything else goes away.
  state.hold?.();
  state.hold = null;
  for (const { target, type, fn, opts } of state.listeners.splice(0)) {
    target.removeEventListener(type, fn, opts);
  }
  state.runtime?.dispose();
  // The BAR deliberately survives: it is presenter-owned module state
  // shared with armTouchHint callers, and it retires itself through its
  // own lifecycle (linger / scroll / Esc / blur).
}

/**
 * Install the document-level touch long-press hint bar: a touch or pen
 * hold over any element matching `selector` shows its text docked at the
 * top centre of the viewport. Returns the uninstaller (removes the
 * delegated listeners, cancels a pending hold, disposes the registry
 * entry). Idempotent per document — a second install returns the FIRST
 * install's uninstall, exactly like the hover bridge. Mouse pointers
 * never engage: the desktop hover tooltip stays byte-identical.
 */
export function installHkTouchHintBridge(options: HkTouchHintOptions = {}): () => void {
  if (typeof document === "undefined") return () => undefined;
  const existing = INSTALLS.get(document);
  if (existing) return () => uninstall(existing);

  const state: TouchHintState = {
    root: document,
    listeners: [],
    hold: null,
    holdMs: options.holdMs ?? DEFAULT_HOLD_MS,
    slopPx: options.slopPx ?? DEFAULT_SLOP_PX,
    lingerMs: options.lingerMs ?? DEFAULT_LINGER_MS,
    selector: options.selector ?? "[title]",
    exclude: options.exclude ?? "",
    resolve: options.resolve,
    shown: 0,
  };
  state.runtime = reportHkRuntime("touchHintBridge", {
    kind: "hook",
    description:
      "Document-level touch long-press hint bar: touch/pen holds over [title] elements show their text docked at the top of the viewport.",
    meta: {
      holdMs: state.holdMs,
      slopPx: state.slopPx,
      lingerMs: state.lingerMs,
      selector: state.selector,
      shown: 0,
    },
    read: () => ({ installed: true, holding: state.hold !== null, shown: state.shown }),
  });

  const on = (type: string, fn: EventListener, opts?: AddEventListenerOptions) => {
    document.addEventListener(type, fn, opts);
    state.listeners.push({ target: document, type, fn, opts });
  };

  // CAPTURE: hosts that stopPropagation in their own bubble-phase roots
  // must not be able to hide the gesture (the hover bridge binds its
  // engage the same way).
  on("pointerdown", (e) => {
    const pe = e as PointerEvent;
    // Mice never engage — they have hover, and hybrid devices must keep
    // it. Pen joins touch: a stylus press is the same deliberate ask
    // (pen HOVER still floats the anchored popup; the two coexist).
    if (pe.pointerType !== "touch" && pe.pointerType !== "pen") return;
    if (state.hold) return; // one hold at a time — a second finger is noise
    const target = e.target;
    if (!target || !(target instanceof Element)) return;
    // Same escape hatches as the hover bridge: HkTooltip-managed
    // triggers own their touch hint through armTouchHint (a double arm
    // would fight over the one bar), and [data-hk-tooltip-native] keeps
    // the platform's whole tooltip behaviour, long-press included.
    if (target.closest(".hk-tooltip-wrapper") || target.closest(".hk-tooltip-popup")) return;
    if (target.closest("[data-hk-tooltip-native]")) return;
    if (state.exclude && target.closest(state.exclude)) return;
    const anchor = target.closest(state.selector);
    if (!anchor) return;
    if (isDisabledControl(anchor)) return;
    const hold = startHold({
      anchor,
      pointerId: pe.pointerId,
      origin: { x: pe.clientX, y: pe.clientY },
      holdMs: state.holdMs,
      slopPx: state.slopPx,
      lingerMs: state.lingerMs,
      text: () => resolveHintText(anchor, state.resolve),
      onFire: (text) => {
        state.shown += 1;
        state.runtime?.pulse({ shown: state.shown });
        // Arm the Android long-press-menu swallow for THIS anchor; the
        // presenter's contextmenu listener consumes it exactly once.
        suppressContextIn = anchor;
        presentBar(text, state.lingerMs);
      },
      onEnd: () => {
        state.hold = null;
      },
    });
    state.hold = hold;
  }, { capture: true, passive: true });

  INSTALLS.set(document, state);
  return () => uninstall(state);
}

// ── the component hook ───────────────────────────────────────────────────

/**
 * Arm the touch hint recognizer for a KNOWN element + text — no selector
 * walk. This is the handover HkTooltip performs from its own pointerdown
 * handler (the gesture is already in flight; pass the event's pointerId
 * and contact point as `origin` for exact slop math). The same
 * cancel-on-move/-cancel/-scroll rules as the delegated bridge apply.
 * Returns the cancel function — call it on hide/unmount; it also restores
 * the anchor guards.
 */
export function armTouchHint(
  el: HTMLElement,
  text: string,
  opts: HkTouchHintArmOptions = {},
): () => void {
  if (typeof document === "undefined") return () => undefined;
  const rect = el.getBoundingClientRect();
  const holdMs = opts.holdMs ?? DEFAULT_HOLD_MS;
  const slopPx = opts.slopPx ?? DEFAULT_SLOP_PX;
  const lingerMs = opts.lingerMs ?? DEFAULT_LINGER_MS;
  return startHold({
    anchor: el,
    pointerId: opts.pointerId ?? ANY_POINTER,
    origin: opts.origin ?? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
    holdMs,
    slopPx,
    lingerMs,
    text: () => text.trim(),
    onFire: (resolved) => {
      suppressContextIn = el;
      presentBar(resolved, lingerMs);
    },
    onEnd: () => undefined,
  });
}
