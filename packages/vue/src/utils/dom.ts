export const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** All focusable elements inside a container (excluding tabindex=-1). */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

/** Focus the first autofocus/focusable element, falling back to the container. */
export function focusFirst(container: HTMLElement): void {
  const autofocus = container.querySelector<HTMLElement>("[autofocus]");
  const focusable = container.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
  (autofocus || focusable || container).focus();
}

/** Keep Tab/Shift+Tab cycling inside the container (modal focus trap). */
export function trapFocus(container: HTMLElement, event: KeyboardEvent): void {
  const focusable = getFocusableElements(container);
  if (focusable.length === 0) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey) {
    if (document.activeElement === first) {
      event.preventDefault();
      last.focus();
    }
  } else {
    if (document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
}

/** Scroll an element into view by selector (optional options). */
export function scrollToElement(selector: string, opts?: ScrollIntoViewOptions): void {
  const el = document.querySelector(selector) as HTMLElement | null;
  el?.scrollIntoView(opts ?? { block: "nearest" });
}

/** Pre-measured in-flow box for {@link pinLeaveGeometry}. Snapshot the
 *  leaving elements BEFORE the patch that removes them (e.g. the host
 *  component's onBeforeUpdate): during a multi-element removal the
 *  first sibling's leave-active class (position:absolute) lands
 *  synchronously in the same patch pass, so a later sibling's live
 *  offset* read would freeze an already-reflowed position. */
export interface LeaveBoxSnapshot {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * Pin a leaving list item's geometry before its `*-leave-active` rule
 * switches it to `position: absolute`.
 *
 * TransitionGroup hosts that live in a shrink-to-fit container (the
 * fixed toast columns are sized by their content, anchored by `right`
 * plus a `max-width` only) collapse to zero width the moment their
 * last in-flow child starts leaving. A `width: 100%` on the leaving
 * item then resolves against that dead containing block: the item
 * snaps into a padding-only sliver, its static position jumps to the
 * collapsed edge, and the group's FLIP move transition flings the
 * sliver across the screen while it fades — the closing-toast "flash".
 *
 * Recording the in-flow box makes the leave transition play as a true
 * mirror of the entrance instead. The pin is anchored by `anchorX`:
 * - `"right"` (default): anchored to the RIGHT inner edge of the
 *   containing block (the relative transition-group wrapper, which is
 *   also the element's offsetParent). Right-anchored hosts keep that
 *   edge put while the left edge collapses, so a `right + width` pin
 *   survives the collapse that defeats a `left` pin (toast columns).
 * - `"left"`: anchored to the LEFT inner edge — for hosts whose
 *   inline-start edge stays put in LTR flow (the tab track), where a
 *   right pin would misplace a middle removal by the removed width.
 *
 * Metrics come from `opts.box` when supplied (a pre-patch snapshot —
 * see {@link LeaveBoxSnapshot}), otherwise from the offset* family —
 * layout boxes that ignore transforms, so a concurrent FLIP move
 * cannot skew the pin — and the width/height pins are paired with an
 * inline `box-sizing: border-box` so they reproduce the measured
 * border-box exactly for content-box items.
 *
 * No-op when layout information is unavailable (no offsetParent:
 * hidden subtrees, detached nodes, non-layout environments).
 */
export function pinLeaveGeometry(
  el: Element,
  opts?: { anchorX?: "left" | "right"; box?: LeaveBoxSnapshot },
): void {
  const node = el as HTMLElement;
  const parent = node.offsetParent as HTMLElement | null;
  if (parent == null) return;
  // Read every metric BEFORE writing any style: writes take effect
  // immediately (layout is flushed on the next read), and on a
  // content-box element an intermediate `width` write silently changes
  // the wrap width — a height read after it would freeze a transient
  // rewrap instead of the box the user is looking at.
  const top = opts?.box?.top ?? node.offsetTop;
  const left = opts?.box?.left ?? node.offsetLeft;
  const width = opts?.box?.width ?? node.offsetWidth;
  const height = opts?.box?.height ?? node.offsetHeight;
  if (opts?.anchorX === "left") {
    node.style.left = `${left}px`;
  } else {
    // CSS `right` for an absolutely positioned box is measured from the
    // containing block's right padding-box edge; offsetLeft/offsetWidth
    // place the item's right border edge within that same padding box.
    const right = parent.clientWidth - (left + width);
    node.style.right = `${right}px`;
  }
  node.style.top = `${top}px`;
  node.style.width = `${width}px`;
  node.style.height = `${height}px`;
  node.style.boxSizing = "border-box";
}

/**
 * Drop the pins written by {@link pinLeaveGeometry}. Wire this to the
 * transition's leave-cancelled hook: when a leave is aborted and the
 * element re-enters the flow, stale left/right/width/height pins would
 * freeze its geometry even as its content changes.
 */
export function clearLeaveGeometry(el: Element): void {
  const node = el as HTMLElement;
  node.style.right = "";
  node.style.left = "";
  node.style.top = "";
  node.style.width = "";
  node.style.height = "";
  node.style.boxSizing = "";
}
