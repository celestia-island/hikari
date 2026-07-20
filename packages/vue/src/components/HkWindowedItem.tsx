import { defineComponent, onBeforeUnmount, onMounted, ref, shallowRef, watch, type PropType } from "vue";

import "./HkWindowedItem.scss";
import { useScrollWindow } from "../composables/useScrollWindow";
import { onceFrame } from "../runtime/animationBus";

export default defineComponent({
  name: "HkWindowedItem",
  props: {
    itemKey: { type: String, default: undefined },
    estimatedHeight: { type: Number, default: 96 },
    overscanScreens: { type: Number as PropType<number | null>, default: null },
    as: { type: String, default: "div" },
  },
  setup(props, { slots }) {
    const ctx = useScrollWindow();
    const root = shallowRef<HTMLElement | null>(null);
    const inWindow = ref(false);
    const measuredHeight = ref<number | null>(null);
    let io: IntersectionObserver | null = null;

    function placeholderHeight(): number {
      return measuredHeight.value ?? props.estimatedHeight;
    }

    function withinBuffer(el: HTMLElement, scrollEl: HTMLElement, overscan: number): boolean {
      const elRect = el.getBoundingClientRect();
      const rootRect = scrollEl.getBoundingClientRect();
      const buf = scrollEl.clientHeight * overscan;
      return elRect.bottom >= rootRect.top - buf && elRect.top <= rootRect.bottom + buf;
    }

    function buildObserver(target: HTMLElement, scrollEl: HTMLElement | null) {
      io?.disconnect();
      const overscan = props.overscanScreens ?? ctx?.overscanScreens ?? 1;
      const margin = `${Math.round(overscan * 100)}% 0px ${Math.round(overscan * 100)}% 0px`;
      io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            inWindow.value = e.isIntersecting;
          }
        },
        {
          root: scrollEl,
          rootMargin: margin,
          threshold: 0,
        },
      );
      io.observe(target);
    }

    function measure() {
      const el = root.value;
      if (!el) return;
      const h = el.offsetHeight;
      if (h > 0) measuredHeight.value = h;
    }

    onMounted(() => {
      const scrollEl = ctx?.scrollRoot.value ?? null;
      const overscan = props.overscanScreens ?? ctx?.overscanScreens ?? 1;
      if (scrollEl && root.value) {
        inWindow.value = withinBuffer(root.value, scrollEl, overscan);
      } else {
        inWindow.value = true;
      }
      if (root.value) buildObserver(root.value, scrollEl);
      onceFrame(measure);
    });

    watch(
      () => ctx?.scrollRoot.value ?? null,
      (scrollEl) => {
        if (root.value) buildObserver(root.value, scrollEl);
      },
    );

    watch(inWindow, (v) => {
      if (v) {
        onceFrame(measure);
      }
    });

    onBeforeUnmount(() => {
      io?.disconnect();
      io = null;
    });

    return () => {
      const Tag = props.as as "div";
      const showReal = inWindow.value || !ctx;
      const placeholderStyle = showReal ? undefined : { height: `${placeholderHeight()}px` };
      return (
        <Tag
          ref={root}
          class="hk-windowed-item"
          data-state={showReal ? "real" : "placeholder"}
          data-windowed-key={props.itemKey}
          style={placeholderStyle}
          aria-hidden={showReal ? undefined : "true"}
        >
          {showReal ? slots.default?.() : null}
        </Tag>
      );
    };
  },
});
