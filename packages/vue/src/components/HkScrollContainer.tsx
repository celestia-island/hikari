import {
  computed,
  defineComponent,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
  type PropType,
} from "vue";

import { useI18n } from "../i18n/context";
import "./HkScrollContainer.scss";
import { attachOverlayScrollbars, type OverlayScrollbarHandle } from "../composables/useOverlayScrollbar";
import { provideScrollWindow } from "../composables/useScrollWindow";
import { scheduleFrame, notifyScrollStart, onceFrame, type AnimationHandle } from "../runtime/animationBus";
import HFab from "./HkFab";

type ScrollAxis = "vertical" | "horizontal" | "both";
type ScrollMode = "traditional" | "windowed";
type ScrollAlign = "start" | "center";
type OverflowSense = "none" | "start" | "end" | "both";

/** Which edges of an axis still hide content, derived from live scroll
 *  geometry. "end" = content continues past the end edge (can scroll
 *  towards larger offsets), "start" = content hides before the start
 *  edge, "both" = either side, "none" = everything fits. */
function computeOverflow(scrollSize: number, clientSize: number, scrollPos: number): OverflowSense {
  if (scrollSize <= clientSize + 1) return "none";
  const max = scrollSize - clientSize;
  const atStart = scrollPos <= 1;
  const atEnd = scrollPos >= max - 1;
  if (atStart && atEnd) return "none";
  if (atStart) return "end";
  if (atEnd) return "start";
  return "both";
}

export default defineComponent({
  name: "HkScrollContainer",
  props: {
    as: { type: String, default: "div" },
    axis: { type: String as PropType<ScrollAxis>, default: "vertical" },
    mode: { type: String as PropType<ScrollMode>, default: "traditional" },
    scrollbar: { type: Boolean, default: true },
    autoFollow: { type: Boolean, default: false },
    overscanScreens: { type: Number, default: 1 },
    /** Inline-axis alignment of the content when it fits the viewport.
     *  "center" wraps the slot in an auto-margin aligner: content that
     *  fits stays centered while overflowing content falls back to the
     *  inline-start edge (scrollable, never clipped) — the safe
     *  centering `justify-content: center` cannot provide. Applies to
     *  horizontal-axis containers (toggling at runtime is supported);
     *  ignored for vertical-only and axis="both" containers (the
     *  latter would re-introduce cross-axis center-clipping). */
    align: { type: String as PropType<ScrollAlign>, default: "start" },
    /** Fade the viewport's inline edges (CSS mask) on the sides where
     *  the sensed overflow (`data-h-overflow`) reports hidden content. */
    fade: { type: Boolean, default: false },
    /** Additive opt-in: while autoFollow is enabled and the user has
     *  scrolled away from the bottom, float a small jump-back FAB that
     *  snaps to the latest content and re-arms follow. */
    followAffordance: { type: Boolean, default: false },
  },
  setup(props, { slots, expose }) {
    const { t } = useI18n();
    const viewportRef = ref<HTMLElement>();
    let ro: ResizeObserver | null = null;
    let scheduled: AnimationHandle | null = null;
    // Overlay track/thumb machinery lives in the shared composable;
    // this component keeps overflow sensing, autoFollow, the aligner,
    // fade, windowed mode and the scrollbar opt-in.
    let overlay: OverlayScrollbarHandle | null = null;

    // Sensed overflow mirrored onto the root as data-h-overflow /
    // data-v-overflow so consumers can style edge affordances in pure
    // CSS. Attributes are only touched on change to avoid DOM churn.
    let lastHOverflow: OverflowSense | null = null;
    let lastVOverflow: OverflowSense | null = null;

    const alignerRef = shallowRef<HTMLElement | null>(null);
    let alignRO: ResizeObserver | null = null;

    const pinned = ref(true);
    const FOLLOW_THRESHOLD = 24;
    const autoFollowContent = shallowRef<HTMLElement | null>(null);
    let followRO: ResizeObserver | null = null;
    const showAutoTag = computed(() => props.autoFollow && props.scrollbar && pinned.value);

    if (props.mode === "windowed") {
      provideScrollWindow(viewportRef as unknown as import("vue").Ref<HTMLElement | null>, props.overscanScreens);
    }

    const hasV = () => props.axis !== "horizontal";
    const hasH = () => props.axis !== "vertical";
    // Safe centering applies to horizontal-axis containers only; the
    // rendered aligner + flex overlay are both gated on this.
    const alignCenter = () => props.align === "center" && props.axis === "horizontal";

    function setAligner(el: unknown) {
      const prev = alignerRef.value;
      if (prev && alignRO) alignRO.unobserve(prev);
      alignerRef.value = el instanceof HTMLElement ? el : null;
      // Content growth changes the sensed overflow but not the
      // viewport box, so the viewport-only ResizeObserver never fires
      // for it — observe the aligner as the content-size proxy.
      if (alignerRef.value && alignRO) alignRO.observe(alignerRef.value);
      // A render that just created the aligner (align toggled on after
      // mount) needs the observer created lazily here.
      syncAlignObserver();
    }

    /** (Re)create or drop the content-size observer so runtime toggles
     *  of the align/axis props keep sensing accurate (a container that
     *  switches to align="center" after mount still gets an aligner
     *  observer; switching back stops it). */
    function syncAlignObserver() {
      if (alignCenter() && !alignRO && alignerRef.value) {
        alignRO = new ResizeObserver(scheduleUpdate);
        alignRO.observe(alignerRef.value);
      } else if (!alignCenter() && alignRO) {
        alignRO.disconnect();
        alignRO = null;
      }
    }

    watch(() => [props.align, props.axis] as const, ([, axis], [, prevAxis]) => {
      syncAlignObserver();
      // Follow an axis change at runtime by rebuilding the overlay
      // tracks so the enabled axes stay in sync with the viewport.
      if (axis !== prevAxis && props.scrollbar) mountScrollbars();
      scheduleUpdate();
    }, { flush: "post" });

    /** Build the overlay tracks for the enabled axes (scrollbar on). */
    function mountScrollbars() {
      const vp = viewportRef.value;
      if (!vp) return;
      overlay?.detach();
      overlay = attachOverlayScrollbars(vp, { axis: props.axis });
    }

    /** Tear down and rebuild the overlay tracks when the `scrollbar`
     *  opt-in flips at runtime (HkTabs passes the prop through). */
    watch(() => props.scrollbar, (on) => {
      overlay?.detach();
      overlay = null;
      if (on) {
        mountScrollbars();
        update();
      }
    }, { flush: "post" });

    function recomputePinned() {
      const vp = viewportRef.value;
      if (!vp) return;
      pinned.value = vp.scrollHeight - vp.scrollTop - vp.clientHeight < FOLLOW_THRESHOLD;
    }

    /** Jump-back affordance: resume semantics, not pinned-recompute —
     *  pin first, then sense so follow state agrees with the new offset. */
    function jumpToLatest() {
      const vp = viewportRef.value;
      if (!vp) return;
      vp.scrollTop = vp.scrollHeight;
      recomputePinned();
    }

    function pinToBottomIfPinned() {
      const vp = viewportRef.value;
      if (!vp || !pinned.value) return;
      vp.scrollTop = vp.scrollHeight;
    }

    const SETTLE_FRAMES = 4;
    let settleRemaining = 0;
    let settleHandle: AnimationHandle | null = null;

    function runSettleFrame() {
      settleHandle = null;
      pinToBottomIfPinned();
      if (settleRemaining > 0) {
        settleRemaining--;
        settleHandle = scheduleFrame(runSettleFrame);
      }
    }

    function kickSettle() {
      settleRemaining = SETTLE_FRAMES;
      if (settleHandle) return;
      settleHandle = scheduleFrame(runSettleFrame);
    }

    function scheduleUpdate() {
      scheduled?.disconnect();
      scheduled = scheduleFrame(() => {
        scheduled = null;
        update();
      });
    }

    /** Component-side sensing pass: mirror the live scroll geometry
     *  onto the root as data-h-overflow / data-v-overflow. The overlay
     *  thumb geometry is the composable's job (it listens to scroll
     *  and resizes itself). */
    function update() {
      const vp = viewportRef.value;
      if (!vp) return;
      senseOverflow(vp);
    }

    /** Mirror the live scroll geometry onto the root element as
     *  data-h-overflow / data-v-overflow. Runs on every scheduled
     *  update (scroll, resize, content resize via the aligner). */
    function senseOverflow(vp: HTMLElement) {
      const root = vp.parentElement;
      if (!root) return;
      const h = hasH() ? computeOverflow(vp.scrollWidth, vp.clientWidth, vp.scrollLeft) : "none";
      const v = hasV() ? computeOverflow(vp.scrollHeight, vp.clientHeight, vp.scrollTop) : "none";
      if (h !== lastHOverflow) {
        lastHOverflow = h;
        root.setAttribute("data-h-overflow", h);
      }
      if (v !== lastVOverflow) {
        lastVOverflow = v;
        root.setAttribute("data-v-overflow", v);
      }
    }

    function onScroll() {
      if (!viewportRef.value) return;
      scheduleUpdate();
      if (props.scrollbar) notifyScrollStart();
      if (props.autoFollow) recomputePinned();
    }

    function onWheel(e: WheelEvent) {
      const vp = viewportRef.value;
      if (!vp || !hasH()) return;
      if (vp.scrollWidth <= vp.clientWidth) return;
      const delta = e.deltaX !== 0 ? e.deltaX : e.deltaY;
      if (delta === 0) return;
      const prev = vp.scrollLeft;
      vp.scrollLeft += delta;
      if (vp.scrollLeft !== prev) {
        e.preventDefault();
      }
    }

    onMounted(() => {
      const vp = viewportRef.value;
      if (!vp) return;

      if (props.scrollbar) {
        mountScrollbars();
      }

      vp.addEventListener("scroll", onScroll, { passive: true });
      vp.addEventListener("wheel", onWheel, { passive: false });

      ro = new ResizeObserver(scheduleUpdate);
      ro.observe(vp);

      syncAlignObserver();

      if (props.autoFollow && autoFollowContent.value) {
        pinned.value = true;
        onceFrame(() => {
          pinToBottomIfPinned();
          recomputePinned();
        });
        followRO = new ResizeObserver(() => {
          pinToBottomIfPinned();
          kickSettle();
        });
        followRO.observe(autoFollowContent.value!);
      }

      update();
    });

    onBeforeUnmount(() => {
      const vp = viewportRef.value;
      if (vp) {
        vp.removeEventListener("scroll", onScroll);
        vp.removeEventListener("wheel", onWheel);
      }
      overlay?.detach();
      overlay = null;
      scheduled?.disconnect();
      settleHandle?.disconnect();
      settleHandle = null;
      ro?.disconnect();
      ro = null;
      followRO?.disconnect();
      followRO = null;
      alignRO?.disconnect();
      alignRO = null;
    });

    function scrollTo(top: number, behavior: ScrollBehavior = "auto") {
      const vp = viewportRef.value;
      if (!vp) return;
      vp.scrollTo({ top, behavior });
    }

    function scrollToElement(el: HTMLElement | null, behavior: ScrollBehavior = "auto") {
      if (!el) return;
      const vp = viewportRef.value;
      if (!vp) {
        el.scrollIntoView({ behavior, block: "start" });
        return;
      }
      const target = el.getBoundingClientRect().top - vp.getBoundingClientRect().top + vp.scrollTop;
      vp.scrollTo({ top: target, behavior });
    }

    function getScrollElement(): HTMLElement | undefined {
      return viewportRef.value;
    }

    function getScrollTop(): number {
      return viewportRef.value?.scrollTop ?? 0;
    }

    /** Re-run the scrollbar + overflow sensing pass. Public escape
     *  hatch for content mutations the observers cannot see (e.g. the
     *  slot's own children resizing without the aligner box changing,
     *  or non-align consumers swapping content). */
    function refresh(): void {
      overlay?.update();
      update();
    }

    /** Current sensed overflow per axis, same values as the mirrored
     *  data attributes. */
    function getOverflow(): { horizontal: OverflowSense; vertical: OverflowSense } {
      return {
        horizontal: lastHOverflow ?? "none",
        vertical: lastVOverflow ?? "none",
      };
    }

    expose({ scrollTo, scrollToElement, getScrollElement, getScrollTop, refresh, getOverflow });

    return () => {
      const Tag = props.as as "div" | "section" | "nav" | "main" | "aside";
      let content = props.autoFollow ? (
        <div ref={autoFollowContent} class="hk-scroll-container-autofollow-content">
          {slots.default?.()}
        </div>
      ) : (
        slots.default?.()
      );
      // The aligner is the single flex item of the (row) viewport; its
      // auto inline margins center it when it fits and collapse to
      // zero when it overflows — see HkScrollContainer.scss.
      if (alignCenter()) {
        content = <div ref={setAligner} class="hk-scroll-container-aligner">{content}</div>;
      }
      return (
        <Tag
          class="hk-scroll-container"
          data-axis={props.axis}
          data-align={alignCenter() ? "center" : undefined}
          data-fade={props.fade ? "true" : undefined}
        >
          <div ref={viewportRef} class="hk-scroll-container-viewport">
            {content}
          </div>
          {showAutoTag.value && (
            <span class="hk-scroll-container-autotag" aria-hidden="true">{t("hikari::scrollContainer.auto", "Auto")}</span>
          )}
          {props.autoFollow && props.followAffordance && !pinned.value && (
            <HFab
              class="hk-scroll-container-jump"
              positioning="absolute"
              corner="bottom-right"
              icon="ArrowDown"
              size="sm"
              ariaLabel={t("hikari::modal.jumpToLatest", "Back to latest")}
              onClick={jumpToLatest}
            />
          )}
        </Tag>
      );
    };
  },
});
