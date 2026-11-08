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
// The pill shows the VISIBLE RANGE against the total — "第 16 ~ 30 条，
// 共 30 条" (zh) / "Rows 16–30 of 30" (en) — localized through the i18n
// context (user direction 2026-11-08: the old bare "16 / 30" pair keyed
// on the FIRST visible row, so a fully-scrolled list never read "30";
// the range form names the band the viewport actually shows and the
// bottom-of-list state reads as an ending, not a midpoint).
import { defineComponent, type InjectionKey } from "vue";

import { useI18n } from "../i18n/context";
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
    /** First visible row (1-based). */
    from: { type: Number, default: 0 },
    /** Last visible row (1-based, inclusive) — at the bottom of the
     *  list this equals the row count, so the range reads as an end. */
    to: { type: Number, default: 0 },
    /** Authoritative total (the pill's "共 N 条" / "of N"). */
    total: { type: Number, default: 0 },
  },
  setup(props) {
    const { t } = useI18n();
    return () => {
      // One visible row collapses the range to the single-row sentence;
      // a degenerate band (0 rows) hides the text with the pill itself.
      const text =
        props.total < 1 || props.from < 1 || props.to < props.from
          ? ""
          : props.from === props.to
            ? t("hikari::scrollProgress.single", "Row {from} of {total}")
                .replace("{from}", String(props.from))
                .replace("{total}", String(props.total))
            : t("hikari::scrollProgress.range", "Rows {from}–{to} of {total}")
                .replace("{from}", String(props.from))
                .replace("{to}", String(props.to))
                .replace("{total}", String(props.total));
      return (
        <span
          class="hk-scroll-progress-pill"
          aria-hidden="true"
          data-state={!props.shown ? "hidden" : props.active ? "active" : "idle"}
        >
          {text}
        </span>
      );
    };
  },
});

export default HkScrollProgress;
