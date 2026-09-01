import { defineComponent, TransitionGroup, type PropType } from "vue";

import { useReportedTransition } from "../composables/useReportedTransition";

import "./HkListTransition.scss";

type ListAnimVariant = "pop" | "slide" | "fade" | "grow" | "reveal";

/** Enter/leave report window: the slowest variant (pop/slide/fade) runs
 *  --hi-duration-normal, the fast ones (grow/reveal) run their own 150ms
 *  plus a 150ms stagger delay — both finish inside this budget. */
const REPORT_MS = 320;

/**
 * HkListTransition — keyed list enter/enter/exit choreography.
 *
 * The library-level primitive for "items squeeze in / squeeze out": a
 * `TransitionGroup` that fades + scales rows in and collapses the space
 * on remove, then FLIPs the siblings into their new places (`move`).
 * Variants:
 *   - `pop`/`slide`/`fade` — standard enter/leave fades (leave elements
 *     go absolute so the space contracts instantly);
 *   - `grow` — scale-in with a one-beat stagger; leave collapses in
 *     place, siblings close the gap after it;
 *   - `reveal` — height-aware squeeze: entering rows expand from 80% of
 *     their natural height (interpolate-size + calc-size), leaving rows
 *     shrink back — the container height itself animates, so wrapping
 *     groups and stacked cards both get a real space transition.
 *
 * Animation-context participation: every enter/leave batch is REPORTED to
 * the runtime animation bus (`reportTransition`), so JS choreography that
 * must outlive the CSS work (e.g. a sheet repositioning after a row is
 * removed) is not cut short; `appear` animates the initial children on
 * mount (open surfaces get the same gentle entrance as later updates);
 * reduced motion / the global animation switch (`html[data-css-animations
 * ="0"]`) disable the motion in scss.
 */
export default defineComponent({
  name: "HkListTransition",
  props: {
    tag: { type: String, default: "div" },
    variant: { type: String as PropType<ListAnimVariant>, default: "pop" },
    move: { type: Boolean, default: false },
    /** Animate the children present at mount time (their enter
     *  transitions run once). Defaults to false — bulk-rendered lists
     *  usually want their rows to appear silently. */
    appear: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
  },
  setup(props, { slots }) {
    const report = useReportedTransition(REPORT_MS);
    // TransitionGroup forwards the enter/leave hooks to EVERY child, so
    // a batch of N rows arms N reports on the shared track. Refcount
    // them: each child's settle cancels only its own claim, and the
    // track stays armed until the last child of the batch finishes.
    let pending = 0;
    const arm = () => {
      pending++;
      report.run();
    };
    const settle = () => {
      pending = Math.max(0, pending - 1);
      if (pending === 0) report.cancel();
    };

    return () => {
      const name = props.disabled ? "hk-list-none" : `hk-list-${props.variant}`;
      return (
        <TransitionGroup
          tag={props.tag}
          name={name}
          appear={props.appear}
          moveClass={props.move ? undefined : "hk-list-move-disabled"}
          onBeforeEnter={arm}
          onAfterEnter={settle}
          onEnterCancelled={settle}
          onBeforeLeave={arm}
          onAfterLeave={settle}
          onLeaveCancelled={settle}
        >
          {slots.default?.()}
        </TransitionGroup>
      );
    };
  },
});
