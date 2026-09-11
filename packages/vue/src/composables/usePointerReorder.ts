import { getCurrentScope, onScopeDispose, ref, type Ref } from "vue";

/** The axis a reorderable strip flows along: field chips run left to
 *  right, stacked panel rows top to bottom. */
export type PointerReorderAxis = "x" | "y";

/** Pointer travel (px) that separates a click/tap from a drag — smaller
 *  than any deliberate move, larger than the jitter a finger or a
 *  shaky mouse produces while pressing. */
const DEFAULT_THRESHOLD = 6;

/** How long a finished drag keeps its click trap armed. The browser
 *  delivers the post-drag click right after `pointerup` for a mouse and
 *  up to a few hundred ms later for a touch tap; past that window the
 *  trap can only be stale — a new press owns the next click, and eating
 *  it would be worse than letting one through. */
const CLICK_TRAP_MS = 400;

/** Presses that start ON an interactive control never drag — the same
 *  guard HkDraggableList applies to its rows: a button pressed to act
 *  must act, not move the thing it sits in. */
const INTERACTIVE = "button, a, input, textarea, select, [contenteditable]";

/** Auto-scroll: how close to the scroller's edge (px) a live drag starts
 *  pulling the strip along, and how many pixels one animation frame moves
 *  it AT that edge (the step tapers to 1px at the zone's inner boundary,
 *  so entering the zone is a nudge and holding at the edge is a run). */
const EDGE_ZONE = 24;
const EDGE_MAX_STEP = 12;

/** System reduced-motion preference — animations snap instead of tweening.
 *  The auto-scroll still runs; this only decides whether a surface that
 *  eases its own scrolling (`scroll-behavior: smooth`) is allowed to. */
function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true
  );
}

export interface PointerReorderOptions {
  /** Items in DISPLAY order. Re-read on every pointer move, so a list
   *  re-rendering under a live drag resolves against what is actually on
   *  screen — and whatever this returns IS the drop space: items a drag
   *  may not land on are simply not listed (that is how a panel drag
   *  stays clamped to the selected group). */
  items: () => readonly (HTMLElement | null | undefined)[];
  /** Flow direction of the strip (measured midpoints run along it). */
  axis: PointerReorderAxis;
  /** Fired once per real drop, with the display indices of the dragged
   *  item and of the slot it landed in (`from !== to` — a release back on
   *  the origin is a no-op, never an emit). */
  onDrop: (from: number, to: number) => void;
  /** Pointer travel in px that separates a click/tap from a drag. */
  threshold?: number;
  /** The element that scrolls the strip, resolved when the drag needs it
   *  (the desktop popout or the mobile sheet's list — the surface that
   *  already owns the scroll region; this only drives it). While a live
   *  drag holds near the scroller's leading/trailing edge the strip is
   *  pulled along one frame at a time, so a row can be carried past the
   *  visible band instead of being dropped, scrolled and grabbed again.
   *  Undefined (or null at that moment): no auto-scroll. */
  scrollContainer?: () => HTMLElement | null;
}

export interface PointerReorder {
  /** Display index of the item being dragged, `-1` while idle. */
  dragFrom: Ref<number>;
  /** Display index of the slot the release would land in, `-1` while
   *  idle. */
  dragOver: Ref<number>;
  /** A press crossed the threshold and is being dragged. */
  dragging: Ref<boolean>;
  /** Watch a press on item `index` (item 0 of `items()` is index 0).
   *  Nothing is reported until the pointer travels past the threshold,
   *  so a tap stays a plain click and the page keeps its scrolling. */
  start: (event: PointerEvent, index: number) => void;
}

/**
 * usePointerReorder — pointer drag-to-reorder for a strip of elements.
 *
 * Framework-free of any list semantics: the caller hands over the items in
 * display order and a drop callback, and gets back the drag state to paint
 * (`dragFrom` / `dragOver` / `dragging`). The landing slot is resolved by
 * the pointer's position against the item MIDPOINTS along the axis, inside
 * the LINE the pointer is on across it — so a wrapping chip row (x axis,
 * several lines) and a stacked panel column (y axis, one column) both
 * behave the way the pointer looks like it should.
 *
 * The threshold is what keeps the gesture honest on a control that is also
 * clickable: a press under ~6px is not a drag at all — no state is
 * published, no reorder is emitted, and the click that follows reaches its
 * handler untouched, so a tap on a chip still focuses the field. A real
 * drag swallows that trailing click instead (the browser would otherwise
 * deliver it to a common ancestor — or, on a short drag, to the row the
 * user just moved, toggling it off); the trap is retired when it fires,
 * when its window lapses, and by the next press.
 *
 * Touch: the composable itself never claims the page's panning (it calls
 * no `preventDefault` on press), so the caller decides with CSS —
 * `touch-action: none` on an explicit grip makes a drag exclusive, while a
 * plain `pan-y` item gives way to the browser (which sends
 * `pointercancel`, and the drag is abandoned without emitting).
 *
 * Nothing is emitted for a cancelled gesture — pointercancel, Escape, an
 * unmount mid-drag, a window that loses focus, a hidden page, or a move
 * that arrives with no button held (the pointer was released somewhere the
 * page never saw) — and every listener is torn down on release, so an
 * abandoned drag can never leak into the next interaction: a press whose
 * release is lost must not fire a reorder later, at whatever position the
 * pointer happens to be by then.
 */
export function usePointerReorder(options: PointerReorderOptions): PointerReorder {
  const threshold = options.threshold ?? DEFAULT_THRESHOLD;
  const axis = options.axis;

  const dragFrom = ref(-1);
  const dragOver = ref(-1);
  const dragging = ref(false);

  /** The pointer that owns the live press; a second pointer is ignored. */
  let pointerId = -1;
  let pressedIndex = -1;
  let originX = 0;
  let originY = 0;
  let pressed = false;
  let moved = false;
  /** The pointer's last position, split by axis — the auto-scroll frames
   *  re-resolve the drop target from it while the content moves under it. */
  let lastMain = 0;
  let lastCross = 0;
  /** Auto-scroll: px per frame (signed: negative scrolls back), 0 = off. */
  let scrollVelocity = 0;
  let scrollFrameId = 0;
  let clickTrap: ((event: MouseEvent) => void) | null = null;
  /** Retires a live trap on the next press of ANY kind — the trailing
   *  click either came already or never will, and a stale trap must not
   *  eat a legitimate one (a press that `start` itself rejects — a
   *  control, a second pointer, a right-click — still ends the window). */
  let trapRetire: ((event: PointerEvent) => void) | null = null;
  let clickTrapTimer: ReturnType<typeof setTimeout> | null = null;

  /** Item elements in display order, nulls dropped. */
  function liveItems(): HTMLElement[] {
    return options.items().filter((el): el is HTMLElement => el != null);
  }

  /** The display index the dragged item lands ON for a pointer at
   *  (`main`, `cross`) — the pointer's coordinates split into the strip's
   *  axis and the axis across it — starting from index `from`.
   *
   *  Resolved in two steps. First the LINE: items whose cross-axis span
   *  holds the pointer (or is nearest to it) are the candidates, which is
   *  what makes a WRAPPING chip row behave — a chip on the second line can
   *  never be matched by a pointer on the first. A single-file strip (the
   *  panel's column, whose rows all span the list width) has every item in
   *  one span, so filtering by line is a strict no-op there — it only ever
   *  separates items that really are on different lines.
   *
   *  Then the INSERTION POINT: the first candidate whose midpoint still
   *  lies beyond the pointer (past the line's end when it is beyond every
   *  candidate midpoint), which becomes a landing index by accounting for
   *  the dragged item's own removal — dragging past one neighbour's
   *  midpoint swaps with that neighbour instead of skipping it. -1 for an
   *  empty strip. */
  function indexAt(main: number, cross: number, from: number): number {
    const items = liveItems();
    if (items.length === 0) return -1;
    const rects = items.map((item) => item.getBoundingClientRect());
    // Nearest line wins: items in the pointer's own band score 0, and a
    // pointer between two bands takes the closer one. The half-pixel
    // tolerance keeps the siblings of ONE wrapped line together, whose
    // bands can differ by sub-pixel rounding.
    let nearest = Number.POSITIVE_INFINITY;
    const lineGap = rects.map((rect) => {
      const lo = axis === "x" ? rect.top : rect.left;
      const hi = axis === "x" ? rect.bottom : rect.right;
      const gap = cross < lo ? lo - cross : cross > hi ? cross - hi : 0;
      if (gap < nearest) nearest = gap;
      return gap;
    });
    let slot = -1;
    for (let i = 0; i < rects.length; i += 1) {
      if (lineGap[i] > nearest + 0.5) continue;
      const rect = rects[i];
      const mid = axis === "x" ? rect.left + rect.width / 2 : rect.top + rect.height / 2;
      if (main < mid) {
        slot = i;
        break;
      }
      slot = i + 1;
    }
    if (slot < 0) slot = items.length;
    return from >= 0 && slot > from ? slot - 1 : slot;
  }

  /** The pointer's coordinates split by axis: the position along the strip
   *  and the position across it. */
  function pointerAt(event: PointerEvent): { main: number; cross: number } {
    return axis === "x"
      ? { main: event.clientX, cross: event.clientY }
      : { main: event.clientY, cross: event.clientX };
  }

  /** How fast one frame should move the strip for a pointer at `main`:
   *  0 outside the edge zones, a 1..EDGE_MAX_STEP px ramp inside them. The
   *  zone is clamped to half the scroller, so a surface shorter than two
   *  zones cannot have them overlap into a permanent scroll. */
  function edgeVelocity(main: number): number {
    const container = options.scrollContainer?.() ?? null;
    if (!container) return 0;
    const rect = container.getBoundingClientRect();
    const lo = axis === "x" ? rect.left : rect.top;
    const hi = axis === "x" ? rect.right : rect.bottom;
    const span = hi - lo;
    if (!Number.isFinite(span) || span <= 0) return 0;
    const zone = Math.min(EDGE_ZONE, span / 2);
    const ramp = (depth: number) => {
      const clamped = Math.min(Math.max(depth, 0), zone);
      return Math.max(1, Math.round((EDGE_MAX_STEP * clamped) / zone));
    };
    if (main < lo + zone) return -ramp(lo + zone - main);
    if (main > hi - zone) return ramp(main - (hi - zone));
    return 0;
  }

  /** One auto-scroll frame. The strip is re-read on demand, so the drop
   *  target is re-resolved from the same pointer position after the
   *  content moved under it — the slot follows what the user sees. */
  function scrollTick(): void {
    scrollFrameId = 0;
    if (!pressed || !moved || scrollVelocity === 0) return;
    const container = options.scrollContainer?.() ?? null;
    if (!container) return;
    const next =
      (axis === "x" ? container.scrollLeft : container.scrollTop) + scrollVelocity;
    if (prefersReducedMotion()) {
      // The scroll is never gated on the preference — only the easing a
      // smooth-scrolling surface would apply to it.
      container.scrollTo(
        axis === "x"
          ? { left: next, behavior: "instant" }
          : { top: next, behavior: "instant" },
      );
    } else if (axis === "x") {
      container.scrollLeft = next;
    } else {
      container.scrollTop = next;
    }
    const over = indexAt(lastMain, lastCross, pressedIndex);
    if (over >= 0) dragOver.value = over;
    scrollFrameId = requestAnimationFrame(scrollTick);
  }

  /** Follow the pointer's edge zone: start the frame loop when a live drag
   *  enters one, stop it the moment it leaves (or the drag ends), so an
   *  idle strip never scrolls and no frame is scheduled for nothing. */
  function syncAutoScroll(): void {
    if (!pressed || !moved) {
      stopAutoScroll();
      return;
    }
    scrollVelocity = edgeVelocity(lastMain);
    if (scrollVelocity === 0) stopAutoScroll();
    else if (scrollFrameId === 0) scrollFrameId = requestAnimationFrame(scrollTick);
  }

  function stopAutoScroll(): void {
    scrollVelocity = 0;
    if (scrollFrameId !== 0) {
      cancelAnimationFrame(scrollFrameId);
      scrollFrameId = 0;
    }
  }

  function dropClickTrap(): void {
    if (clickTrapTimer !== null) {
      clearTimeout(clickTrapTimer);
      clickTrapTimer = null;
    }
    if (clickTrap) {
      window.removeEventListener("click", clickTrap, { capture: true });
      clickTrap = null;
    }
    if (trapRetire) {
      window.removeEventListener("pointerdown", trapRetire, { capture: true });
      trapRetire = null;
    }
  }

  /** Swallow the ONE click a real drag would otherwise deliver — at the
   *  WINDOW capture phase, so nothing down the path (a row's toggle, the
   *  field's open handler, a host's own listener) ever sees it. The trap
   *  disarms as it fires, when its window lapses, and on the next press of
   *  any kind: the post-drag click is the only click a drag owns, and every
   *  other one must reach its handler untouched. */
  function trapClick(): void {
    dropClickTrap();
    clickTrap = (event: MouseEvent) => {
      dropClickTrap();
      event.stopPropagation();
      event.preventDefault();
    };
    trapRetire = () => dropClickTrap();
    window.addEventListener("click", clickTrap, { capture: true });
    // Capture phase: the new gesture's own handlers see a clean window, and
    // its click (if any) can never be mistaken for the drag's.
    window.addEventListener("pointerdown", trapRetire, { capture: true });
    clickTrapTimer = setTimeout(dropClickTrap, CLICK_TRAP_MS);
  }

  /** The page stopped being able to deliver this gesture's release: the
   *  window lost focus, or the tab went to the background. Abandon it. */
  function onPressLost(): void {
    if (!pressed) return;
    releaseDrag();
  }

  function onVisibilityChange(): void {
    if (document.hidden) onPressLost();
  }

  /** Forget the whole gesture: listeners off, auto-scroll stopped, state
   *  back to idle. */
  function releaseDrag(): void {
    stopAutoScroll();
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("pointercancel", onPointerCancel);
    window.removeEventListener("keydown", onKeyDown);
    // Bubble phase, never capture: an ELEMENT's blur does not bubble, so
    // this only ever sees the WINDOW losing focus (a capture listener would
    // also fire for every input blur on the page).
    window.removeEventListener("blur", onPressLost);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    pressed = false;
    moved = false;
    pointerId = -1;
    pressedIndex = -1;
    dragging.value = false;
    dragFrom.value = -1;
    dragOver.value = -1;
  }

  function onPointerMove(event: PointerEvent): void {
    if (!pressed || event.pointerId !== pointerId) return;
    // No button held any more: the release happened where the page could
    // not see it (the pointer left the window and came back). This is the
    // only signal for that — a mouse that is merely moved around the page
    // reports `buttons: 0` on every hover, so the very next move ends a
    // wedged drag instead of letting a later stray `pointerup` apply it at
    // a position the user never chose. (It rests on the spec's `buttons: 1`
    // for an active contact of ANY pointer type, touch included; a pointer
    // that broke that would simply end its drags on the first move, which
    // is why the blur/visibility guards above exist as the backstop.)
    if (event.buttons === 0) {
      releaseDrag();
      return;
    }
    if (!moved) {
      const travel = Math.hypot(event.clientX - originX, event.clientY - originY);
      if (travel < threshold) return;
      moved = true;
      dragging.value = true;
      dragFrom.value = pressedIndex;
    }
    const at = pointerAt(event);
    lastMain = at.main;
    lastCross = at.cross;
    const over = indexAt(lastMain, lastCross, pressedIndex);
    if (over >= 0) dragOver.value = over;
    syncAutoScroll();
  }

  function onPointerUp(event: PointerEvent): void {
    if (!pressed || event.pointerId !== pointerId) return;
    const from = pressedIndex;
    const at = pointerAt(event);
    const to = moved ? indexAt(at.main, at.cross, from) : from;
    const dropped = moved && to >= 0 && to !== from;
    // The drag is over either way — the trap only guards the click the
    // browser is about to deliver.
    if (moved) trapClick();
    releaseDrag();
    if (dropped) options.onDrop(from, to);
  }

  function onPointerCancel(event: PointerEvent): void {
    if (!pressed || event.pointerId !== pointerId) return;
    // The browser took the gesture (a scroll started): abandon it
    // silently — a reorder must never come out of a cancelled drag.
    releaseDrag();
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (event.key === "Escape") releaseDrag();
  }

  function start(event: PointerEvent, index: number): void {
    if (pressed || event.defaultPrevented || event.button !== 0 || index < 0) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest?.(INTERACTIVE)) return;
    pressed = true;
    moved = false;
    pointerId = event.pointerId;
    pressedIndex = index;
    originX = event.clientX;
    originY = event.clientY;
    const at = pointerAt(event);
    lastMain = at.main;
    lastCross = at.cross;
    // Window-level listeners: the drag must survive the pointer leaving
    // the item it started on (there is no capture, so a release over a
    // neighbouring element still lands here).
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerCancel);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("blur", onPressLost);
    document.addEventListener("visibilitychange", onVisibilityChange);
  }

  if (getCurrentScope()) {
    onScopeDispose(() => {
      releaseDrag();
      dropClickTrap();
    });
  }

  return { dragFrom, dragOver, dragging, start };
}
