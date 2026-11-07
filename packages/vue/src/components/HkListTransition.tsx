import { defineComponent, onBeforeUpdate, ref, TransitionGroup, type PropType } from "vue";

import { clearLeaveGeometry, pinLeaveGeometry, type LeaveBoxSnapshot } from "../utils/dom";
import { useReportedTransition } from "../composables/useReportedTransition";

import "./HkListTransition.scss";

type ListAnimVariant = "pop" | "slide" | "fade" | "grow" | "reveal" | "surface";

/** Enter/leave report window: the slowest variant (pop/slide/fade/surface)
 *  runs --hi-duration-normal, the fast ones (grow/reveal) run their own 150ms
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
 *   - `surface` — the window choreography (HkModal's whole-window
 *     entrance, user direction 2026-11-07): a row rises 10px while
 *     settling from 97% scale and fading in, and leaves by sinking back
 *     to the same pose; siblings glide into the freed space (FLIP).
 *     The motion signature of the surface family, so a list whose rows
 *     ARE windows (HkModalBreadcrumb's stack) can animate them the way
 *     the windows themselves arrive.
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

    // Variants whose leave-active rule lifts the row out of flow with
    // `position: absolute` (see HkListTransition.scss). Only these need
    // the geometry pin; `reveal` animates the row's own height in place
    // and `none` never leaves the flow, so a pin would freeze the very
    // property they animate.
    const ABSOLUTE_VARIANTS: ReadonlySet<string> = new Set(["pop", "slide", "fade", "grow", "surface"]);

    // Pre-patch geometry of every row, refreshed on each update (the DOM
    // is still the pre-patch tree at onBeforeUpdate — same pattern as
    // HkTabs). During a multi-row removal the first leaving sibling gets
    // its leave-active class (position:absolute) synchronously inside the
    // patch pass, so a live offset read in a later sibling's beforeLeave
    // hook would freeze an already-reflowed position. The pin also
    // replaces `grow`'s old `width: 100%`, which resolved against a
    // possibly-collapsed containing block when the host is not
    // position:relative (the full-width leave flash).
    const hostRef = ref<{ $el?: Element } | null>(null);
    const prePatchBoxes = new WeakMap<Element, LeaveBoxSnapshot>();
    /** Pre-patch VIEWPORT position of every row (gBCR). The offset boxes
     *  above are relative to the offsetParent's padding box — for a host
     *  whose padding box MOVES when its content shrinks (a centered
     *  shrink-to-fit host) that origin shift is exactly the ghost-drift
     *  the compensation below cancels, so the viewport truth is what the
     *  compensation must restore. */
    const prePatchRects = new WeakMap<Element, { x: number; y: number }>();
    onBeforeUpdate(() => {
      // Fragment hosts (tag="") have a comment anchor as $el — no
      // element children to measure there.
      const host = hostRef.value?.$el;
      if (host == null || host.nodeType !== 1) return;
      for (const child of Array.from(host.children)) {
        const e = child as HTMLElement;
        prePatchBoxes.set(e, {
          top: e.offsetTop,
          left: e.offsetLeft,
          width: e.offsetWidth,
          height: e.offsetHeight,
        });
        const r = e.getBoundingClientRect();
        prePatchRects.set(e, { x: r.left, y: r.top });
      }
    });

    const usesAbsoluteLeave = () =>
      !props.disabled && ABSOLUTE_VARIANTS.has(props.variant);

    function pinLeaving(el: Element) {
      if (!usesAbsoluteLeave()) return;
      const node = el as HTMLElement;
      pinLeaveGeometry(el, { anchorX: "left", box: prePatchBoxes.get(el) });
      // ── Centered-host compensation ─────────────────────────────────
      // An absolute ghost is positioned against the host's PADDING box —
      // and a shrink-to-fit host REFITS the instant the ghost leaves the
      // flow. A centered host (the modal breadcrumb's nav: fixed +
      // left:50% + translate(-50%,-50%)) then moves its padding origin
      // right by half the freed width, and the pinned `left` lands the
      // ghost ΔW/2 away from where the user last saw it (2026-11-07
      // review, real-Chrome repro: 74px jump on a single removal, 138px
      // on a double). Cancel it while nobody has painted: lift the ghost
      // out of flow inline (Vue's leave-active will repeat the same
      // declaration one microtask later), force the refit with one
      // layout read, and write the visual delta back as a ONE-SHOT
      // margin. The ghost's motion itself stays opacity + transform only
      // (compositor contract intact; a margin written once before the
      // first leave frame is a static position, not an animation).
      // Multi-row removals stay exact: each ghost is compensated against
      // the pre-patch viewport rect captured BEFORE this patch, and the
      // forced read in its own turn already sees every earlier ghost's
      // refit.
      const pre = prePatchRects.get(el);
      if (pre == null || node.offsetParent == null) return;
      node.style.position = "absolute";
      const now = node.getBoundingClientRect();
      const dx = pre.x - now.left;
      const dy = pre.y - now.top;
      if (dx !== 0) node.style.marginLeft = `${dx}px`;
      if (dy !== 0) node.style.marginTop = `${dy}px`;
    }

    function unpinLeaving(el: Element) {
      if (!usesAbsoluteLeave()) return;
      clearLeaveGeometry(el);
      // The compensation writes of pinLeaving — an aborted leave returns
      // the row to the flow, where a stale position/margin would freeze
      // it off its slot.
      const node = el as HTMLElement;
      node.style.position = "";
      node.style.marginLeft = "";
      node.style.marginTop = "";
    }

    return () => {
      const name = props.disabled ? "hk-list-none" : `hk-list-${props.variant}`;
      return (
        <TransitionGroup
          ref={hostRef}
          tag={props.tag}
          name={name}
          appear={props.appear}
          moveClass={props.move ? undefined : "hk-list-move-disabled"}
          onBeforeEnter={arm}
          onAfterEnter={settle}
          onEnterCancelled={settle}
          onBeforeLeave={(el: Element) => {
            arm();
            pinLeaving(el);
          }}
          onAfterLeave={settle}
          onLeaveCancelled={(el: Element) => {
            settle();
            unpinLeaving(el);
          }}
        >
          {slots.default?.()}
        </TransitionGroup>
      );
    };
  },
});
