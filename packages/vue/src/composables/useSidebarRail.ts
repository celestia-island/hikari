import { onScopeDispose, ref, unref, watch, type Ref } from "vue";

import { useMediaQuery } from "../runtime/useMediaQuery";

/**
 * The sidebar rail state machine (2026-10-30): the ONE implementation of
 * hikari's collapsible icon-rail + hover-peek drawer behavior.
 *
 * Three consumers ride this exact machine — HkFaceShell/HkAdminShell (the
 * shell sidebar), HkSidebar (the standalone rail panel) and bespoke hosts
 * (wowsp's own Sidebar) — so the timing semantics live here, never
 * per-consumer:
 *
 * - `collapsed` is SESSION-ONLY by default: the composable owns an
 *   internal ref and never touches storage. A host that wants persistence
 *   (or a v-model channel) passes its own `collapsed` ref and stores
 *   whatever it wants — the library stays storage-free.
 * - While collapsed, a pointer resting on the rail arms a `peekDelay`
 *   (default 400ms) timer; on expiry the full sidebar opens as a PEEK
 *   drawer (an overlay the consumer renders — the layout box stays at
 *   rail width, so the content area NEVER shifts; that overlay geometry
 *   is the consumer's `hk-sidebar-rail-*` classes, this machine only
 *   owns the timing).
 * - Leaving the host region while peeking arms a `peekGrace` (default
 *   150ms) close timer; re-entering cancels it, so a diagonal pointer
 *   move across the gap does not flicker the drawer shut.
 * - Escape closes an open peek immediately.
 *
 * The toggle's hover surface is INSIDE the host region (it straddles the
 * panel's content-facing border), so a pointer parked on the collapse
 * button used to arm the dwell and then jump out from under the cursor
 * when the peek opened — the reported twitch. `setPeekSuppressed` is the
 * fix: the host feeds it geometric containment of the toggle
 * (HkSidebar/HkFaceShell use `isPointerOverRailToggle`), and while it is
 * true no peek may arm. Suppression never closes an OPEN peek and never
 * makes the rail inert: releasing it with the pointer still resting on
 * the rail re-arms the normal dwell.
 *
 * A `pointerleave` whose relatedTarget is still inside the host region is
 * NOT a leave: the peek/width transitions re-render the toggle subtree, and
 * the resulting DOM churn can synthesize leaves that would otherwise start
 * a spurious grace close. Pass `host` so the machine can tell the two
 * apart.
 *
 * `pinning` marks the rail -> expanded transition window (the reported
 * "expand replays the sidebar slide" defect): hosts render it as their
 * `data-pinning` attribute and the CSS snaps the panel to its final width
 * while the HOST keeps animating (only the content area is supposed to
 * move). It clears on the host's width `transitionend` (`endPinning`) or
 * after `SIDEBAR_RAIL_PIN_FALLBACK` when no transition fires; reduced
 * motion skips it entirely (the layout lands instantly, nothing to mask).
 *
 * `reducedMotion` rides the shared `useMediaQuery` subscription (the
 * HkWallpaperBackdrop precedent): consumers use it to skip JS-driven
 * motion; the CSS sheets carry their own
 * `@media (prefers-reduced-motion: reduce)` blocks for the slide.
 */
export interface SidebarRailOptions {
  /** External collapsed state (a v-model channel, a persisted store, …).
   *  Omitted = the composable's own session-only ref. */
  collapsed?: Ref<boolean>;
  /** Hover dwell on the rail before the peek opens, in ms. A number or a
   *  getter (props are reactive); <= 0 opens with no dwell. Default 400. */
  peekDelay?: number | (() => number);
  /** Grace after pointerleave before the peek closes, in ms; re-entering
   *  within the window cancels the close. A number or a getter. Default 150. */
  peekGrace?: number | (() => number);
  /** The host region element (a getter — hosts mount it conditionally).
   *  Used to recognize DOM churn: a `pointerleave` whose relatedTarget is
   *  still inside this element is not a leave. Omitted = every leave is
   *  taken at face value (the pre-hardening behavior). */
  host?: HTMLElement | null | (() => HTMLElement | null | undefined);
}

/** What `useSidebarRail` hands back. `collapsed` is WRITABLE — setting
 *  it (or calling toggle/expand/collapse) updates the owner state, whether
 *  that is the internal session ref or the host's channel. */
export interface SidebarRailHandle {
  collapsed: Ref<boolean>;
  /** True while the temporary peek drawer is open (collapsed layout, full
   *  panel overlaying the content). Always false while expanded. */
  peeking: Ref<boolean>;
  /** True while the peek is suppressed (the pointer rests on a control
   *  that sits on the rail's hover surface — the toggle). Read-only;
   *  write it through {@link setPeekSuppressed}. */
  peekSuppressed: Ref<boolean>;
  /** True during the rail -> expanded transition window. Hosts render it
   *  as `data-pinning` so the CSS can snap the panel (and any nested
   *  sidebar) to full width while only the host width animates. Always
   *  false under reduced motion. */
  pinning: Ref<boolean>;
  /** Live `prefers-reduced-motion: reduce` state (shared subscription). */
  reducedMotion: Ref<boolean>;
  /** Flip collapsed/expanded. During a peek this is "pin expanded": the
   *  peek closes and the sidebar restores to full width. */
  toggle(): void;
  expand(): void;
  collapse(): void;
  /** Set the suppression state. While true no peek may ARM: a pending
   *  dwell is cleared and fresh arms are refused. An already-open peek is
   *  left alone, and clearing the flag while the pointer still rests
   *  inside the host re-arms the dwell from zero. Hosts drive it from a
   *  host-region `pointermove` + the toggle's rect (geometric
   *  containment, never event.target: the toggle is opacity:0 /
   *  pointer-events:none until the region is engaged, so it is not the
   *  target even when the pointer IS on it). */
  setPeekSuppressed(v: boolean): void;
  /** Bind to the host region's `pointerenter`. Arms the peek timer while
   *  collapsed; cancels a pending grace close while peeking (the
   *  anti-flicker re-entry). */
  onPointerEnter(): void;
  /** Bind to the host region's `pointerleave`. Takes the DOM event so a
   *  leave whose relatedTarget is still inside the host region (DOM churn
   *  while the peek/width transitions rebuild the subtree) is ignored —
   *  it would otherwise start a spurious grace close. Cancels a pending
   *  peek arm; arms the grace close while peeking. */
  onPointerLeave(e?: { relatedTarget?: EventTarget | null } | null): void;
  /** Close an open peek immediately (Escape, nav click, mode change). */
  closePeek(): void;
  /** Clear the pin window early — bind the host's width `transitionend`
   *  here (filter it to the host's own `width` transition first). */
  endPinning(): void;
  /** Bind to the host region's `keydown`. Closes an open peek on Escape
   *  and returns true when it consumed the key (callers may stop
   *  propagation so outer Escape layers stay quiet). */
  onKeydown(e: KeyboardEvent): boolean;
}

/** Default hover dwell before the peek drawer opens. */
export const SIDEBAR_RAIL_PEEK_DELAY = 400;
/** Default grace after pointerleave before the peek drawer closes. */
export const SIDEBAR_RAIL_PEEK_GRACE = 150;
/** Safety net for the pin window: hosts clear it on their width
 *  `transitionend`, but a transition that never fires (equal widths, a
 *  host without a width animation) must not strand `data-pinning`. */
export const SIDEBAR_RAIL_PIN_FALLBACK = 400;

/** True when `node` lives inside `el` (including `el` itself). Guards
 *  the DOM globals: the machine is imported by SSR-safe hosts too. */
function isInside(el: HTMLElement | null, node: EventTarget | null | undefined): boolean {
  if (!el || !node) return false;
  return typeof Node !== "undefined" && node instanceof Node && el.contains(node);
}

export function useSidebarRail(options: SidebarRailOptions = {}): SidebarRailHandle {
  const collapsed = options.collapsed ?? ref(false);
  const peeking = ref(false);
  const peekSuppressed = ref(false);
  const pinning = ref(false);
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");

  const peekDelay = () =>
    Math.max(0, unref(typeof options.peekDelay === "function" ? options.peekDelay() : options.peekDelay) ?? SIDEBAR_RAIL_PEEK_DELAY);
  const peekGrace = () =>
    Math.max(0, unref(typeof options.peekGrace === "function" ? options.peekGrace() : options.peekGrace) ?? SIDEBAR_RAIL_PEEK_GRACE);

  /** The host region, resolved lazily (conditional rendering flips it). */
  const hostEl = (): HTMLElement | null => {
    const host = options.host;
    return (typeof host === "function" ? host() : host) ?? null;
  };

  let armTimer: ReturnType<typeof setTimeout> | null = null;
  let closeTimer: ReturnType<typeof setTimeout> | null = null;
  let pinTimer: ReturnType<typeof setTimeout> | null = null;
  /** Mirrors "the pointer is inside the host region". Suppression
   *  releases re-arm from THIS state, not from a fresh pointerenter. */
  let hovered = false;

  function clearArm(): void {
    if (armTimer !== null) {
      clearTimeout(armTimer);
      armTimer = null;
    }
  }

  function clearClose(): void {
    if (closeTimer !== null) {
      clearTimeout(closeTimer);
      closeTimer = null;
    }
  }

  function clearPin(): void {
    if (pinTimer !== null) {
      clearTimeout(pinTimer);
      pinTimer = null;
    }
  }

  /** Open the peek and hand it the timers: a pending arm must never fire
   *  after the draw is up, and a pending grace close belongs to a
   *  previous cycle. */
  function openPeek(): void {
    clearArm();
    clearClose();
    peeking.value = true;
  }

  /** Arm the dwell — the ONE place that decides whether a peek may start.
   *  Every early return is a documented veto: not hovered (the pointer
   *  left), suppressed (it is parked on the toggle), already peeking, or
   *  expanded (no rail to peek from). */
  function arm(): void {
    clearArm();
    if (!hovered || peekSuppressed.value || peeking.value || !collapsed.value) return;
    const delay = peekDelay();
    if (delay <= 0) {
      openPeek();
      return;
    }
    armTimer = setTimeout(() => {
      armTimer = null;
      // Still collapsed / still allowed when the dwell expires: a release
      // of suppression wires a fresh arm, but a stale one can race a
      // collapse or a hover that ended without a leave.
      if (collapsed.value && !peekSuppressed.value) openPeek();
    }, delay);
  }

  function applySuppressed(v: boolean): void {
    if (peekSuppressed.value === v) return;
    peekSuppressed.value = v;
    if (v) {
      // The arm is already counting down from the pointerenter that
      // preceded the first pointermove — drop it, or the drawer opens
      // under the resting cursor (the reported twitch).
      clearArm();
      return;
    }
    // Released while the pointer still rests on the rail: re-arm the
    // normal dwell (the pointer is no longer on the toggle, so the peek
    // SHOULD happen — from a full dwell, not from the stale remainder).
    arm();
  }

  function closePeek(): void {
    clearArm();
    clearClose();
    peeking.value = false;
  }

  function endPinning(): void {
    clearPin();
    pinning.value = false;
  }

  /** Mark the rail -> expanded window. Reduced motion skips it: the
   *  layout lands instantly, so there is no replayed slide to mask. */
  function startPinning(): void {
    if (reducedMotion.value) return;
    clearPin();
    pinning.value = true;
    pinTimer = setTimeout(() => {
      pinTimer = null;
      pinning.value = false;
    }, SIDEBAR_RAIL_PIN_FALLBACK);
  }

  // Expanding the sidebar absorbs any open peek (the peek IS the expanded
  // panel, temporarily); an external collapse→expand flip must land the
  // same way. Watching the ref covers internal writes too — harmless.
  // SYNC flush: the peek must read closed in the same tick as the flip —
  // a shell that re-renders off the model change would otherwise render
  // one frame of "expanded + peeking" (an overlay with nothing to
  // overlay). The SAME flush guarantees data-pinning lands in the render
  // that carries the new widths — a frame late and the panel would start
  // sliding before the CSS could snap it.
  watch(
    collapsed,
    (v, prev) => {
      if (v) {
        // Collapsing: there is no rail -> expanded window to mask.
        endPinning();
        return;
      }
      closePeek();
      if (prev) startPinning();
    },
    { flush: "sync" },
  );

  const handle: SidebarRailHandle = {
    collapsed,
    peeking,
    peekSuppressed,
    pinning,
    reducedMotion,
    toggle() {
      closePeek();
      collapsed.value = !collapsed.value;
    },
    expand() {
      closePeek();
      collapsed.value = false;
    },
    collapse() {
      closePeek();
      collapsed.value = true;
    },
    setPeekSuppressed: applySuppressed,
    onPointerEnter() {
      hovered = true;
      // Re-entry inside the grace window is the anti-flicker contract:
      // the pending close dies before it can fire.
      clearClose();
      arm();
    },
    onPointerLeave(e) {
      // DOM churn, not a leave: the peek/width transitions rebuild the
      // toggle subtree, and the synthesized leave would start a grace
      // close under a pointer that never went anywhere.
      if (isInside(hostEl(), e?.relatedTarget)) return;
      hovered = false;
      // Suppression describes a pointer that is NOT in the region anymore.
      applySuppressed(false);
      // A leave before the dwell expires cancels the arm — the peek only
      // ever opens under a RESTING pointer.
      clearArm();
      if (!peeking.value) return;
      clearClose();
      const grace = peekGrace();
      if (grace <= 0) {
        peeking.value = false;
        return;
      }
      closeTimer = setTimeout(() => {
        closeTimer = null;
        peeking.value = false;
      }, grace);
    },
    closePeek,
    endPinning,
    onKeydown(e: KeyboardEvent) {
      if (e.key === "Escape" && peeking.value) {
        closePeek();
        return true;
      }
      return false;
    },
  };

  onScopeDispose(() => {
    clearArm();
    clearClose();
    clearPin();
  });

  return handle;
}
