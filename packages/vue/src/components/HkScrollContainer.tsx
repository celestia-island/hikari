import {
  computed,
  defineComponent,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  type PropType,
} from "vue";

import "./HkScrollContainer.scss";
import { provideScrollWindow } from "../composables/useScrollWindow";
import { scheduleCronAfter, type CronHandle } from "../runtime/cronBus";
import { notifyScrollStart, onceFrame, scheduleFrame, type AnimationHandle } from "../runtime/animationBus";

type ScrollAxis = "vertical" | "horizontal" | "both";
type ScrollMode = "traditional" | "windowed";

interface AxisState {
  track: HTMLElement;
  thumb: HTMLElement;
  dragging: boolean;
  dragStartClient: number;
  dragStartScroll: number;
  hideTimer: CronHandle;
}

interface DragHandlers {
  onDown: (e: MouseEvent) => void;
  onMove: (e: MouseEvent) => void;
  onUp: () => void;
  onTrackClick: (e: MouseEvent) => void;
  onEnter: () => void;
  onLeave: () => void;
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
  },
  setup(props, { slots, expose }) {
    const viewportRef = ref<HTMLElement>();
    let ro: ResizeObserver;
    let scheduled: AnimationHandle | null = null;
    let vState: AxisState | null = null;
    let hState: AxisState | null = null;
    let vDrag: DragHandlers | null = null;
    let hDrag: DragHandlers | null = null;

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

    function recomputePinned() {
      const vp = viewportRef.value;
      if (!vp) return;
      pinned.value = vp.scrollHeight - vp.scrollTop - vp.clientHeight < FOLLOW_THRESHOLD;
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

    function makeState(horizontal: boolean): AxisState {
      const track = document.createElement("div");
      track.className = "hk-scrollbar-track";
      if (horizontal) track.setAttribute("data-axis", "horizontal");
      const thumb = document.createElement("div");
      thumb.className = "hk-scrollbar-thumb";
      track.appendChild(thumb);
      return {
        track,
        thumb,
        dragging: false,
        dragStartClient: 0,
        dragStartScroll: 0,
        hideTimer: undefined as unknown as CronHandle,
      };
    }

    function scheduleUpdate() {
      scheduled?.disconnect();
      scheduled = scheduleFrame(() => {
        scheduled = null;
        update();
      });
    }

    function update() {
      const vp = viewportRef.value;
      if (!vp) return;
      if (vState) updateAxis(vp, vState, false);
      if (hState) updateAxis(vp, hState, true);
    }

    function updateAxis(vp: HTMLElement, s: AxisState, horizontal: boolean) {
      const scrollSize = horizontal ? vp.scrollWidth : vp.scrollHeight;
      const clientSize = horizontal ? vp.clientWidth : vp.clientHeight;
      const scrollPos = horizontal ? vp.scrollLeft : vp.scrollTop;
      if (scrollSize <= clientSize) {
        s.track.style.display = "none";
        return;
      }
      s.track.style.display = "";
      const trackSize = horizontal ? s.track.clientWidth : s.track.clientHeight;
      const ratio = clientSize / scrollSize;
      const thumbSize = Math.max(ratio * trackSize, 20);
      const maxScroll = scrollSize - clientSize;
      const maxTrack = trackSize - thumbSize;
      const offset = maxScroll > 0 ? (scrollPos / maxScroll) * maxTrack : 0;
      if (horizontal) {
        s.thumb.style.width = `${thumbSize}px`;
        s.thumb.style.transform = `translateX(${offset}px)`;
      } else {
        s.thumb.style.height = `${thumbSize}px`;
        s.thumb.style.transform = `translateY(${offset}px)`;
      }
    }

    function flash(s: AxisState | null) {
      if (!s) return;
      s.track.classList.add("is-scrolling");
      s.hideTimer?.disconnect();
      s.hideTimer = scheduleCronAfter(() => s.track.classList.remove("is-scrolling"), 1200);
    }

    function onScroll() {
      if (!viewportRef.value) return;
      scheduleUpdate();
      if (props.scrollbar) notifyScrollStart();
      flash(vState);
      flash(hState);
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

    function makeDragHandlers(s: AxisState, horizontal: boolean): DragHandlers {
      const onDown = (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const vp = viewportRef.value;
        if (!vp) return;
        s.dragging = true;
        s.dragStartClient = horizontal ? e.clientX : e.clientY;
        s.dragStartScroll = horizontal ? vp.scrollLeft : vp.scrollTop;
        s.thumb.classList.add("is-dragging");
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
      };
      const onMove = (e: MouseEvent) => {
        const vp = viewportRef.value;
        if (!vp || !s.dragging) return;
        const scrollSize = horizontal ? vp.scrollWidth : vp.scrollHeight;
        const clientSize = horizontal ? vp.clientWidth : vp.clientHeight;
        const delta = (horizontal ? e.clientX : e.clientY) - s.dragStartClient;
        const thumbSize = Math.max((clientSize / scrollSize) * clientSize, 20);
        const trackRange = clientSize - thumbSize;
        if (trackRange <= 0) return;
        const target = s.dragStartScroll + (delta / trackRange) * (scrollSize - clientSize);
        if (horizontal) vp.scrollLeft = target;
        else vp.scrollTop = target;
      };
      const onUp = () => {
        s.dragging = false;
        s.thumb.classList.remove("is-dragging");
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };
      const onTrackClick = (e: MouseEvent) => {
        if (e.target === s.thumb) return;
        const vp = viewportRef.value;
        if (!vp) return;
        const rect = s.track.getBoundingClientRect();
        const ratio = horizontal
          ? (e.clientX - rect.left) / rect.width
          : (e.clientY - rect.top) / rect.height;
        const max = (horizontal ? vp.scrollWidth : vp.scrollHeight) - (horizontal ? vp.clientWidth : vp.clientHeight);
        if (horizontal) vp.scrollLeft = ratio * max;
        else vp.scrollTop = ratio * max;
      };
      const onEnter = () => s.track.classList.add("is-hovering");
      const onLeave = () => s.track.classList.remove("is-hovering");
      return { onDown, onMove, onUp, onTrackClick, onEnter, onLeave };
    }

    function attachAxis(s: AxisState, d: DragHandlers) {
      s.thumb.addEventListener("mousedown", d.onDown);
      s.track.addEventListener("click", d.onTrackClick);
      s.track.addEventListener("mouseenter", d.onEnter);
      s.track.addEventListener("mouseleave", d.onLeave);
    }

    function detachAxis(s: AxisState | null, d: DragHandlers | null) {
      if (!s || !d) return;
      s.thumb.removeEventListener("mousedown", d.onDown);
      s.track.removeEventListener("click", d.onTrackClick);
      s.track.removeEventListener("mouseenter", d.onEnter);
      s.track.removeEventListener("mouseleave", d.onLeave);
      document.removeEventListener("mousemove", d.onMove);
      document.removeEventListener("mouseup", d.onUp);
      s.hideTimer?.disconnect();
      s.track.remove();
    }

    onMounted(() => {
      const vp = viewportRef.value;
      if (!vp) return;
      const containerEl = vp.parentElement;
      if (!containerEl) return;

      if (props.scrollbar) {
        if (hasV()) {
          vState = makeState(false);
          containerEl.appendChild(vState.track);
          vDrag = makeDragHandlers(vState, false);
          attachAxis(vState, vDrag);
        }
        if (hasH()) {
          hState = makeState(true);
          containerEl.appendChild(hState.track);
          hDrag = makeDragHandlers(hState, true);
          attachAxis(hState, hDrag);
        }
      }

      vp.addEventListener("scroll", onScroll, { passive: true });
      vp.addEventListener("wheel", onWheel, { passive: false });

      ro = new ResizeObserver(scheduleUpdate);
      ro.observe(vp);

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
      detachAxis(vState, vDrag);
      detachAxis(hState, hDrag);
      scheduled?.disconnect();
      settleHandle?.disconnect();
      settleHandle = null;
      ro?.disconnect();
      followRO?.disconnect();
      followRO = null;
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

    expose({ scrollTo, scrollToElement, getScrollElement, getScrollTop });

    return () => {
      const Tag = props.as as "div" | "section" | "nav" | "main" | "aside";
      const content = props.autoFollow ? (
        <div ref={autoFollowContent} class="hk-scroll-container__autofollow-content">
          {slots.default?.()}
        </div>
      ) : (
        slots.default?.()
      );
      return (
        <Tag class="hk-scroll-container" data-axis={props.axis}>
          <div ref={viewportRef} class="hk-scroll-container__viewport">
            {content}
          </div>
          {showAutoTag.value && (
            <span class="hk-scroll-container__autotag" aria-hidden="true">Auto</span>
          )}
        </Tag>
      );
    };
  },
});
