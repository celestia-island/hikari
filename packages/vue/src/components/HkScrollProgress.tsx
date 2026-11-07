// Scroll-progress pill: the shared registration vocabulary and the pill
// renderer for HkScrollContainer's `scrollProgress` opt-in.
//
// This module owns three things:
// 1. the provide/inject key (`HK_SCROLL_PROGRESS_REGISTRAR`) a list uses to
//    find the registrar of the NEAREST enclosing HkScrollContainer that has
//    the feature on — provide/inject scoping is what makes a list registered
//    against an inner container never leak to an outer one;
// 2. the registration types (`HkScrollProgressHandle`,
//    `HkScrollProgressRegistrar`);
// 3. the pill renderer itself — HkScrollContainer imports and mounts it
//    inside its host, so the component stays internal to the feature.
//
// The pill shows bare digits "12 / 340" (first visible row / total rows) —
// deliberately locale-neutral, the same contract as HkLoadMore's counter.
import { defineComponent, type InjectionKey } from "vue";

import "./HkScrollProgress.scss";

/** What a list hands to the registrar so the pill can describe it:
 *  the list's root element (the box that scrolls inside the container's
 *  viewport) and the authoritative row total when the list knows one
 *  (undefined = the pill falls back to counting DOM rows). */
export interface HkScrollProgressHandle {
  getRoot(): HTMLElement | null;
  getTotal(): number | undefined;
  /** The list's own row elements in display order — wins over the
   *  container's `scrollProgressSelector` when present. This is for a
   *  list whose DOM rows are not all data rows (HkTable's section bands
   *  are `<tr>`s in the body, but they are not rows). Return `undefined`
   *  to fall back to the container's selector. */
  getRows?(): readonly Element[] | undefined;
}

/** Provided by every HkScrollContainer instance whose `scrollProgress`
 *  prop is on, and never when the prop is off. Lists inject it (null
 *  fallback) and register on mounted / unregister on unmounted. */
export interface HkScrollProgressRegistrar {
  register(handle: HkScrollProgressHandle): void;
  unregister(handle: HkScrollProgressHandle): void;
}

export const HK_SCROLL_PROGRESS_REGISTRAR: InjectionKey<HkScrollProgressRegistrar> =
  Symbol("hk-scroll-progress-registrar");

/** The pill renderer. Three states, mirrored on `data-state` so the SCSS
 *  owns the paint:
 *  - "hidden"  — a precondition fails (no registration, no overflow, no
 *    rows): `display: none`, never just transparent;
 *  - "active"  — the scroll offset is changing: opaque;
 *  - "idle"    — scrolling stopped: opacity 0 over the ~200ms fade.
 *  A11y honesty: `aria-hidden` throughout — the pill is DECORATIVE chrome
 *  and nothing announces the row position (HkInfiniteTail's role=status
 *  announces load / end-of-list events only, never a scroll position);
 *  this component adds no announce channel of its own. */
const HkScrollProgress = defineComponent({
  name: "HkScrollProgress",
  props: {
    shown: { type: Boolean, default: false },
    active: { type: Boolean, default: false },
    numerator: { type: Number, default: 0 },
    denominator: { type: Number, default: 0 },
  },
  setup(props) {
    return () => (
      <span
        class="hk-scroll-progress-pill"
        aria-hidden="true"
        data-state={!props.shown ? "hidden" : props.active ? "active" : "idle"}
      >
        {props.numerator} / {props.denominator}
      </span>
    );
  },
});

export default HkScrollProgress;
