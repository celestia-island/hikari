import { getCurrentScope, onScopeDispose, watch, type Ref } from "vue";

import { onceFrame, scheduleFrame, type AnimationHandle } from "../runtime/animationBus";

export interface ApproachEndOptions {
  /** Distance in px from the vertical end that still counts as
   *  "approaching". May be a getter for live reads (a consumer prop that
   *  changes at runtime then needs no handle restart). Default 160. */
  distance?: number | (() => number);
}

export interface ApproachEndHandle {
  /** True when the viewport currently sits within the approach distance
   *  of its vertical end (content shorter than the viewport always
   *  counts). Pure evaluation — no emission, no state change. */
  isNearEnd(): boolean;
  /** Run a sensing pass that ignores the same-geometry dedup (still
   *  requires being in the zone). For consumers whose load produced zero
   *  new content but advanced their own cursor — the delivery window
   *  moved, the DOM did not — so the fill walk keeps going. */
  recheck(): void;
  /** Detach every sensor. Idempotent; also wired to the active effect
   *  scope when created inside one (component setup). */
  stop(): void;
}

/**
 * Sense "the viewport is at/near the end of its scrollable content" and
 * fire `onApproach` — the shared engine behind infinite/dynamic loading
 * for any list (HkScrollContainer's `approach-end` event is built on
 * this; native-scroll consumers can attach it to any element ref).
 *
 * Sensor set — each of the three covers a case the others miss:
 * - passive `scroll` on the viewport: the user scrolls towards the end;
 * - `ResizeObserver` on the viewport: the viewport box itself changes
 *   (panel resize can pull the end zone up over the current offset);
 * - `MutationObserver` (childList + subtree) on the viewport: content
 *   grows with NO scroll event and NO box change — the classic "the
 *   delivered page rendered but the list still doesn't fill the screen"
 *   case that scroll/box sensing alone would never re-report.
 *
 * All sensors funnel into ONE rAF-coalesced check. Emission is deduped
 * geometrically: fire on zone entry and whenever the geometry key
 * (`scrollHeight x clientHeight`) changes while still in the zone, so an
 * appended page that still leaves the viewport in the zone re-fires and
 * the consumer keeps filling; scroll jitter inside an unchanged zone
 * does not spam. Leaving the zone re-arms it. Content SHORTER than the
 * viewport counts as in-zone (remaining distance is negative), which is
 * what lets a consumer auto-fill a first screen from an empty list.
 */
export function useApproachEnd(
  viewport: Ref<HTMLElement | null | undefined>,
  onApproach: () => void,
  options?: ApproachEndOptions,
): ApproachEndHandle {
  let ro: ResizeObserver | null = null;
  let mo: MutationObserver | null = null;
  let boundEl: HTMLElement | null = null;
  let scheduled: AnimationHandle | null = null;
  let wasInZone = false;
  let lastKey: string | null = null;
  let stopped = false;

  function readDistance(): number {
    const d = options?.distance;
    if (typeof d === "function") return d();
    return d ?? 160;
  }

  /** One sensing pass. `force` skips the same-geometry dedup (recheck). */
  function check(force = false): void {
    if (stopped) return;
    const vp = viewport.value;
    if (!vp) return;
    const inZone = vp.scrollHeight - vp.scrollTop - vp.clientHeight <= readDistance();
    if (!inZone) {
      wasInZone = false;
      return;
    }
    const key = `${vp.scrollHeight}x${vp.clientHeight}`;
    const shouldFire = force || !wasInZone || key !== lastKey;
    wasInZone = true;
    lastKey = key;
    if (shouldFire) onApproach();
  }

  /** Coalesce every sensor into at most one check per frame. */
  function scheduleCheck(): void {
    if (stopped || !boundEl) return;
    if (scheduled) return;
    scheduled = scheduleFrame(() => {
      scheduled = null;
      check(false);
    });
  }

  /** (Re)attach all sensors to `el`; run the initial pass one frame
   *  later so a just-mounted list with less content than the viewport
   *  fires immediately (the auto-fill entry point). */
  function bind(el: HTMLElement | null): void {
    if (boundEl === el) return;
    detach();
    boundEl = el;
    if (!el) return;
    el.addEventListener("scroll", scheduleCheck, { passive: true });
    ro = new ResizeObserver(scheduleCheck);
    ro.observe(el);
    mo = new MutationObserver(scheduleCheck);
    mo.observe(el, { childList: true, subtree: true, characterData: true });
    onceFrame(() => {
      if (!stopped) check(false);
    });
  }

  function detach(): void {
    if (boundEl) boundEl.removeEventListener("scroll", scheduleCheck);
    boundEl = null;
    ro?.disconnect();
    ro = null;
    mo?.disconnect();
    mo = null;
  }

  function stop(): void {
    stopped = true;
    scheduled?.disconnect();
    scheduled = null;
    detach();
  }

  // The ref can swap at runtime (branch flips remount scrollers) — the
  // watcher keeps the sensors on whichever element is current.
  watch(viewport, (el) => {
    if (!stopped) bind(el ?? null);
  }, { flush: "post" });
  if (viewport.value) bind(viewport.value);

  if (getCurrentScope()) onScopeDispose(stop);

  return {
    isNearEnd(): boolean {
      const vp = viewport.value;
      if (!vp) return false;
      return vp.scrollHeight - vp.scrollTop - vp.clientHeight <= readDistance();
    },
    recheck(): void {
      if (stopped) return;
      scheduleFrame(() => check(true));
    },
    stop,
  };
}
