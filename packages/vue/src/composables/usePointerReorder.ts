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
  /** A press is LIVE — from the moment `start` accepted it, before it has
   *  crossed the threshold into a drag. The strip is this gesture's until
   *  it ends, so a caller that can change the order by other means (the
   *  panel's own keyboard reorder, a host edit) can hold off while this is
   *  `true`: the drag resolves by INDEX, and an order that moves under it
   *  is an order the release would misread. */
  pressed: Ref<boolean>;
  /** Watch a press on item `index` (item 0 of `items()` is index 0).
   *  Nothing is reported until the pointer travels past the threshold,
   *  so a tap stays a plain click and the page keeps its scrolling. */
  start: (event: PointerEvent, index: number) => void;
}

/** The geometry item `from` was LAID OUT with — its span across the strip
 *  (`band`) and its position along it (`mid`), in the pointer's own
 *  coordinates, both shifted by however much the item's frame has moved
 *  since they were read. `usePointerReorder` reads it at press time,
 *  before anything is painted on the item. */
export interface PointerReorderOrigin {
  band: { lo: number; hi: number };
  mid: number;
}

/** The display index the dragged item lands ON for a pointer at
 *  (`main`, `cross`) — the pointer's coordinates split into the strip's
 *  axis and the axis across it — over `rects`, starting from index `from`
 *  (`-1` while no drag is in flight). The composable's own resolution, kept
 *  pure so its tests can pin the no-drag path: this module is internal to
 *  the package, so the export is not part of the published surface.
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
 *  empty strip.
 *
 *  `origin` is item `from`'s LAYOUT geometry, and it is what both steps
 *  read for that one item: the line filter scores it on the band it was
 *  LAID OUT on and the walk measures its laid-out midpoint. That geometry
 *  is trustworthy — it is the single rect read before anything was painted
 *  on the item, so no drag lift and no host `scale()` can move the line the
 *  user is dragging along, nor stop the walk short inside the item itself —
 *  which is exactly what the item's LIVE rect cannot promise while the item
 *  is being dragged. Every other item keeps its live rect: siblings are not
 *  transformed by the drag. Omitted (or null), item `from` is measured by
 *  its live rect like every other item, which is the classic resolution a
 *  caller with no press to read an origin at gets. */
export function indexAt(
  rects: readonly DOMRect[],
  axis: PointerReorderAxis,
  main: number,
  cross: number,
  from: number,
  origin?: PointerReorderOrigin | null,
): number {
  if (rects.length === 0) return -1;
  const own = origin && from >= 0 && from < rects.length ? origin : null;
  /** An item's span ACROSS the strip — the axis the line is read on. */
  const band = (rect: DOMRect, index: number) => {
    if (own && index === from) return own.band;
    return axis === "x" ? { lo: rect.top, hi: rect.bottom } : { lo: rect.left, hi: rect.right };
  };
  /** An item's position ALONG the strip. */
  const mid = (rect: DOMRect, index: number) => {
    if (own && index === from) return own.mid;
    return axis === "x" ? rect.left + rect.width / 2 : rect.top + rect.height / 2;
  };
  // Nearest line wins: items in the pointer's own band score 0, and a
  // pointer between two bands takes the closer one. The half-pixel
  // tolerance keeps the siblings of ONE wrapped line together, whose
  // bands can differ by sub-pixel rounding. The dragged item is scored
  // against its layout band like every other item — no exclusion, no
  // centre test: with the geometry above it cannot be the band that a
  // transform painted on it, so letting it speak (which a lone item on its
  // own line must be able to do — a single-file strip has no other item to
  // name that line) can no longer collapse the slot onto its own index.
  const lineGap = rects.map((rect, index) => {
    const { lo, hi } = band(rect, index);
    return cross < lo ? lo - cross : cross > hi ? cross - hi : 0;
  });
  let nearest = Number.POSITIVE_INFINITY;
  for (let i = 0; i < lineGap.length; i += 1) {
    if (lineGap[i] < nearest) nearest = lineGap[i];
  }
  let slot = -1;
  for (let i = 0; i < rects.length; i += 1) {
    if (lineGap[i] > nearest + 0.5) continue;
    if (main < mid(rects[i], i)) {
      slot = i;
      break;
    }
    slot = i + 1;
  }
  if (slot < 0) slot = rects.length;
  return from >= 0 && slot > from ? slot - 1 : slot;
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
 * behave the way the pointer looks like it should. The item being dragged
 * is measured by the geometry it was LAID OUT with — snapshotted on press,
 * before the lift is painted on it (`start`) and carried along with the
 * frame it was read in, however that frame moves under the drag — so no
 * transform an item picks up mid-drag can move the line it is dragged along
 * or the midpoint it is compared against.
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
  const pressed = ref(false);

  /** The pointer that owns the live press; a second pointer is ignored. */
  let pointerId = -1;
  let pressedIndex = -1;
  let originX = 0;
  let originY = 0;
  let moved = false;
  /** The pointer's last position, split by axis — the auto-scroll frames
   *  re-resolve the drop target from it while the content moves under it. */
  let lastMain = 0;
  let lastCross = 0;
  /** The pressed item's LAYOUT geometry (`null` until a press reads it), the
   *  FRAME it was laid out in (its parent element) and where that frame sat
   *  when the geometry was read — the whole drag resolves against this
   *  instead of the item's live rect, which carries the lift. */
  let pressedBand: { lo: number; hi: number } | null = null;
  let pressedMid = 0;
  let pressedFrame: HTMLElement | null = null;
  let pressedFrameBox: { x: number; y: number; w: number; h: number } | null = null;
  /** The very ELEMENT the press landed on: the index the drag resolves by
   *  is only meaningful while that index still names it (see `slotAt`). */
  let pressedItem: HTMLElement | null = null;
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

  /** The slot the live strip resolves for a pointer at (`main`, `cross`),
   *  starting from index `from` — the elements measured, then handed to
   *  `indexAt`, which carries the geometry's rules. One thing is checked
   *  first: that the INDEX still names the element the press grabbed — a
   *  keyboard reorder, a host edit, a row toggled by a second pointer or a
   *  leaving item finally leaving all put a different element there. When it
   *  does not, the gesture is abandoned rather than resolved: a drag may end
   *  without a reorder, it never lands on an item the pointer did not
   *  grab. */
  function slotAt(main: number, cross: number, from: number): number {
    const items = liveItems();
    if (items.length === 0) return -1;
    if (pressedItem && items[pressedIndex] !== pressedItem) {
      abandonDrag();
      return -1;
    }
    return indexAt(
      items.map((item) => item.getBoundingClientRect()),
      axis,
      main,
      cross,
      from,
      layoutOrigin(),
    );
  }

  /** Where a frame's CONTENT sits in viewport coordinates — the box the
   *  item is laid out in, minus that box's own scroll, which is the point
   *  its children move with — and how big that box is. A scroller the items
   *  sit directly in scrolls its children without moving its own box, so
   *  the scroll has to come off explicitly; for every other element the
   *  offsets are 0 and this is its box origin.
   *
   *  The scroll comes off at its own scale, which is right whenever the
   *  frame is not ALSO transformed: this is a raw offset against a rect the
   *  browser has already transformed, so a `scale()` on a frame that is
   *  itself a scroller AND is scaled mid-drag would take it off at the
   *  wrong magnitude — out of contract here, and the shapes this is written
   *  for (a wrapping field, a panel list) are not scrollers at all: the
   *  surface that scrolls them is their ancestor, and an ancestor's scroll
   *  moves the frame's box like any other translation. */
  function frameBox(frame: HTMLElement): { x: number; y: number; w: number; h: number } {
    const rect = frame.getBoundingClientRect();
    return {
      x: rect.left - frame.scrollLeft,
      y: rect.top - frame.scrollTop,
      w: rect.width,
      h: rect.height,
    };
  }


  /** The pressed item's layout geometry for `indexAt`, placed in the frame's
   *  box AS IT IS NOW. The snapshot is in VIEWPORT coordinates, so anything
   *  that moves the frame under it — the auto-scroll this composable drives,
   *  a host scrolling the surface or any scroller above it, a page scroll, a
   *  re-parent, a transform on an ancestor — has to be carried with it, or
   *  the line the item was laid out on would be compared against siblings
   *  that have since moved away from it. `null` before any press, and for a
   *  press whose item was not in the strip.
   *
   *  The carrier is the frame's BOX: a coordinate travels by the box's
   *  displacement when the box keeps its size (a scroll of any kind, a
   *  re-parent, a translation) and keeps its place INSIDE the box when the
   *  box is resized — which is what a `scale()` or a zoom painted on the
   *  frame or on an ancestor does to it, the box growing and shrinking with
   *  the content it holds. A frame with no extent to scale against (no
   *  layout at all, a `display: contents` frame) falls back to the
   *  displacement. */
  function layoutOrigin(): PointerReorderOrigin | null {
    if (!pressedBand || !pressedFrameBox) return null;
    const at = pressedFrameBox;
    const now = pressedFrame && pressedFrame.isConnected ? frameBox(pressedFrame) : at;
    const carry = (value: number, along: "x" | "y"): number => {
      const from = along === "x" ? at.x : at.y;
      const fromSpan = along === "x" ? at.w : at.h;
      const to = along === "x" ? now.x : now.y;
      const toSpan = along === "x" ? now.w : now.h;
      return fromSpan > 0 && toSpan > 0
        ? to + ((value - from) * toSpan) / fromSpan
        : to + (value - from);
    };
    const down = axis === "x" ? "y" : "x";
    const lo = carry(pressedBand.lo, down);
    const hi = carry(pressedBand.hi, down);
    return { band: { lo, hi }, mid: carry(pressedMid, axis) };
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
    if (!pressed.value || !moved || scrollVelocity === 0) return;
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
    const over = slotAt(lastMain, lastCross, pressedIndex);
    if (over >= 0) dragOver.value = over;
    scrollFrameId = requestAnimationFrame(scrollTick);
  }

  /** Follow the pointer's edge zone: start the frame loop when a live drag
   *  enters one, stop it the moment it leaves (or the drag ends), so an
   *  idle strip never scrolls and no frame is scheduled for nothing. */
  function syncAutoScroll(): void {
    if (!pressed.value || !moved) {
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
    if (!pressed.value) return;
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
    pressed.value = false;
    moved = false;
    pointerId = -1;
    pressedIndex = -1;
    pressedBand = null;
    pressedFrame = null;
    pressedFrameBox = null;
    pressedItem = null;
    dragging.value = false;
    dragFrom.value = -1;
    dragOver.value = -1;
  }

  function onPointerMove(event: PointerEvent): void {
    if (!pressed.value || event.pointerId !== pointerId) return;
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
    const over = slotAt(lastMain, lastCross, pressedIndex);
    if (over >= 0) dragOver.value = over;
    syncAutoScroll();
  }

  function onPointerUp(event: PointerEvent): void {
    if (!pressed.value || event.pointerId !== pointerId) return;
    const from = pressedIndex;
    const at = pointerAt(event);
    const to = moved ? slotAt(at.main, at.cross, from) : from;
    const dropped = moved && to >= 0 && to !== from;
    // The drag is over either way — the trap only guards the click the
    // browser is about to deliver.
    if (moved) trapClick();
    releaseDrag();
    if (dropped) options.onDrop(from, to);
  }

  /** End a drag that must not resolve — the strip it was reading is no
   *  longer the strip the press grabbed. The trailing click is swallowed
   *  exactly as a drop's is: this WAS a drag (the pointer travelled past the
   *  threshold), and the click the browser is about to deliver at wherever
   *  the finger came to rest is one the user never made. */
  function abandonDrag(): void {
    if (moved) trapClick();
    releaseDrag();
  }

  function onPointerCancel(event: PointerEvent): void {
    if (!pressed.value || event.pointerId !== pointerId) return;
    // The browser took the gesture (a scroll started): abandon it
    // silently — a reorder must never come out of a cancelled drag.
    releaseDrag();
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (event.key === "Escape") releaseDrag();
  }

  function start(event: PointerEvent, index: number): void {
    if (pressed.value || event.defaultPrevented || event.button !== 0 || index < 0) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest?.(INTERACTIVE)) return;
    pressed.value = true;
    moved = false;
    pointerId = event.pointerId;
    pressedIndex = index;
    // The item's LAYOUT geometry, read NOW: this is the one moment nothing
    // is painted on it yet — the drag state that carries the lift publishes
    // only once the pointer crosses the threshold — so the rect is the line
    // the strip laid the item out on, whatever a transform does to it for
    // the rest of the gesture. The frame it was read in rides along (the
    // item's own parent element, the box the strip is laid out in), so the
    // snapshot can be carried with the content if that frame moves under
    // the drag — see `layoutOrigin`.
    const item = liveItems()[index];
    const rect = item?.getBoundingClientRect();
    pressedBand = rect
      ? axis === "x"
        ? { lo: rect.top, hi: rect.bottom }
        : { lo: rect.left, hi: rect.right }
      : null;
    pressedMid = rect
      ? axis === "x"
        ? rect.left + rect.width / 2
        : rect.top + rect.height / 2
      : 0;
    pressedFrame = item?.parentElement ?? null;
    pressedFrameBox = pressedFrame ? frameBox(pressedFrame) : null;
    pressedItem = item ?? null;
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

  return { dragFrom, dragOver, dragging, pressed, start };
}
