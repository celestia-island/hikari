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
}

/** What `useSidebarRail` hands back. `collapsed` is WRITABLE — setting
 *  it (or calling toggle/expand/collapse) updates the owner state, whether
 *  that is the internal session ref or the host's channel. */
export interface SidebarRailHandle {
  collapsed: Ref<boolean>;
  /** True while the temporary peek drawer is open (collapsed layout, full
   *  panel overlaying the content). Always false while expanded. */
  peeking: Ref<boolean>;
  /** Live `prefers-reduced-motion: reduce` state (shared subscription). */
  reducedMotion: Ref<boolean>;
  /** Flip collapsed/expanded. During a peek this is "pin expanded": the
   *  peek closes and the sidebar restores to full width. */
  toggle(): void;
  expand(): void;
  collapse(): void;
  /** Bind to the host region's `pointerenter`. Arms the peek timer while
   *  collapsed; cancels a pending grace close while peeking (the
   *  anti-flicker re-entry). */
  onPointerEnter(): void;
  /** Bind to the host region's `pointerleave`. Cancels a pending peek
   *  arm; arms the grace close while peeking. */
  onPointerLeave(): void;
  /** Close an open peek immediately (Escape, nav click, mode change). */
  closePeek(): void;
  /** Bind to the host region's `keydown`. Closes an open peek on Escape
   *  and returns true when it consumed the key (callers may stop
   *  propagation so outer Escape layers stay quiet). */
  onKeydown(e: KeyboardEvent): boolean;
}

/** Default hover dwell before the peek drawer opens. */
export const SIDEBAR_RAIL_PEEK_DELAY = 400;
/** Default grace after pointerleave before the peek drawer closes. */
export const SIDEBAR_RAIL_PEEK_GRACE = 150;

export function useSidebarRail(options: SidebarRailOptions = {}): SidebarRailHandle {
  const collapsed = options.collapsed ?? ref(false);
  const peeking = ref(false);
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");

  const peekDelay = () =>
    Math.max(0, unref(typeof options.peekDelay === "function" ? options.peekDelay() : options.peekDelay) ?? SIDEBAR_RAIL_PEEK_DELAY);
  const peekGrace = () =>
    Math.max(0, unref(typeof options.peekGrace === "function" ? options.peekGrace() : options.peekGrace) ?? SIDEBAR_RAIL_PEEK_GRACE);

  let armTimer: ReturnType<typeof setTimeout> | null = null;
  let closeTimer: ReturnType<typeof setTimeout> | null = null;

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

  function closePeek(): void {
    clearArm();
    clearClose();
    peeking.value = false;
  }

  // Expanding the sidebar absorbs any open peek (the peek IS the expanded
  // panel, temporarily); an external collapse→expand flip must land the
  // same way. Watching the ref covers internal writes too — harmless.
  // SYNC flush: the peek must read closed in the same tick as the flip —
  // a shell that re-renders off the model change would otherwise render
  // one frame of "expanded + peeking" (an overlay with nothing to
  // overlay).
  watch(
    collapsed,
    (v) => {
      if (!v) closePeek();
    },
    { flush: "sync" },
  );

  const handle: SidebarRailHandle = {
    collapsed,
    peeking,
    reducedMotion,
    toggle() {
      peeking.value = false;
      collapsed.value = !collapsed.value;
    },
    expand() {
      peeking.value = false;
      collapsed.value = false;
    },
    collapse() {
      peeking.value = false;
      collapsed.value = true;
    },
    onPointerEnter() {
      // Re-entry inside the grace window is the anti-flicker contract:
      // the pending close dies before it can fire.
      clearClose();
      if (!collapsed.value || peeking.value) return;
      clearArm();
      const delay = peekDelay();
      if (delay <= 0) {
        peeking.value = true;
        return;
      }
      armTimer = setTimeout(() => {
        armTimer = null;
        // Still collapsed and still hovered (no leave cleared the arm).
        if (collapsed.value) peeking.value = true;
      }, delay);
    },
    onPointerLeave() {
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
  });

  return handle;
}
