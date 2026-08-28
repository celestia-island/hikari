import { defineComponent, h, nextTick, onBeforeUnmount, onMounted, ref, watch, type ComponentPublicInstance, type PropType } from "vue";

import "./HkTabs.scss";
import HkScrollContainer from "./HkScrollContainer";
import HkHoverRevealAction from "./HkHoverRevealAction";
import HkIconButton from "./HkIconButton";
import { iconByName } from "../composables/iconRegistry";
import { useI18n } from "../i18n/context";

interface TabItem {
  key: string;
  label: string;
  disabled?: boolean;
}

/** Structural stand-in for HkScrollContainer's exposed surface —
 *  imperative expose() types don't flow through render-function
 *  setups, so declare just the method we consume. */
interface ScrollerExpose {
  getScrollElement?: () => HTMLElement | undefined;
}

export default defineComponent({
  name: "HkTabs",
  props: {
    modelValue: { type: String, required: true },
    tabs: { type: Array as PropType<TabItem[]>, required: true },
    variant: { type: String as PropType<"underline" | "pill">, default: "underline" },
    renderPanels: { type: Boolean, default: true },
    /** Wrap the tab list in a horizontal HkScrollContainer. The list
     *  stays centered while it fits and becomes swipe/scroll-driven
     *  once it overflows (safe centering — the overflowing start is
     *  never clipped), with edge fades hinting at hidden tabs and the
     *  active tab scrolled into view on change. */
    scrollable: { type: Boolean, default: false },
    /** Show the scroller's auto-hiding overlay scrollbar for the tab
     *  axis (scrollable only). Off by default — the edge fades alone
     *  hint at hidden tabs; opt in where a drag affordance helps
     *  pointer users (dense strips, embedded toolbars). Read once on
     *  mount (HkScrollContainer builds its track at mount time). */
    scrollbar: { type: Boolean, default: false },
    /** Render a trailing "add" button protruding at the right edge of
     *  the strip — hover-revealed on pointer devices, tap-revealed with
     *  a linger on touch (the shared HkHoverRevealAction behavior). The
     *  button lives OUTSIDE the scroll viewport so it never scrolls
     *  away. Emits `add`. */
    addable: { type: Boolean, default: false },
    /** Accessible label / tooltip for the add button (falls back to the
     *  shared "Add tab" string). */
    addLabel: { type: String, default: "" },
  },
  emits: {
    "update:modelValue": (_value: string) => true,
    /** The add button was pressed (addable only). */
    add: () => true,
  },
  setup(props, { emit, slots }) {
    const { t } = useI18n();
    const triggerRefs = ref<Map<number, HTMLElement>>(new Map());
    const indicatorStyle = ref<Record<string, string>>({});
    const scrollerRef = ref<ScrollerExpose | null>(null);

    const resolvedAddLabel = (): string =>
      props.addLabel || t("hikari::tabs.add", "Add tab");

    function setTriggerRef(el: Element | ComponentPublicInstance | null, idx: number) {
      if (el instanceof HTMLElement) {
        triggerRefs.value.set(idx, el);
      } else {
        triggerRefs.value.delete(idx);
      }
    }

    function updateIndicator() {
      if (props.variant !== "pill") return;
      const idx = props.tabs.findIndex((t) => t.key === props.modelValue);
      const el = triggerRefs.value.get(idx >= 0 ? idx : 0);
      if (!el) return;
      const left = `${el.offsetLeft}px`;
      const width = `${el.offsetWidth}px`;
      if (indicatorStyle.value.left === left && indicatorStyle.value.width === width) return;
      indicatorStyle.value = { left, width };
    }

    /** Nudge the scroller so the active trigger is fully visible with
     *  a small breathing margin on either side. Manual scroll math (not
     *  scrollIntoView) so only the scroller's own axis moves — the
     *  surrounding page never scrolls. */
    function scrollActiveIntoView() {
      const vp = scrollerRef.value?.getScrollElement?.();
      if (!vp) return;
      const idx = props.tabs.findIndex((t) => t.key === props.modelValue);
      const el = triggerRefs.value.get(idx >= 0 ? idx : 0);
      if (!el) return;
      const left = el.offsetLeft;
      const right = left + el.offsetWidth;
      const pad = 24;
      if (left - pad < vp.scrollLeft) {
        vp.scrollLeft = Math.max(0, left - pad);
      } else if (right + pad > vp.scrollLeft + vp.clientWidth) {
        vp.scrollLeft = right + pad - vp.clientWidth;
      }
    }

    function refreshGeometry() {
      updateIndicator();
      if (props.scrollable) scrollActiveIntoView();
    }

    let resizeObserver: ResizeObserver | null = null;
    let scrollerResizeObserver: ResizeObserver | null = null;

    onMounted(() => {
      nextTick(refreshGeometry);
      if (props.variant === "pill") {
        resizeObserver = new ResizeObserver(() => updateIndicator());
        const firstEl = triggerRefs.value.get(0);
        if (firstEl?.parentElement) {
          resizeObserver.observe(firstEl.parentElement);
        }
      }
      if (props.scrollable) {
        // The pill observer watches the content-sized list, so a
        // viewport-only resize (container narrowing) never re-runs the
        // active-tab nudge — observe the scroller viewport itself.
        nextTick(() => {
          const vp = scrollerRef.value?.getScrollElement?.();
          if (!vp) return;
          scrollerResizeObserver = new ResizeObserver(() => scrollActiveIntoView());
          scrollerResizeObserver.observe(vp);
        });
      }
    });

    onBeforeUnmount(() => {
      resizeObserver?.disconnect();
      resizeObserver = null;
      scrollerResizeObserver?.disconnect();
      scrollerResizeObserver = null;
    });

    watch(() => props.modelValue, () => nextTick(refreshGeometry));

    watch(() => props.tabs, () => {
      triggerRefs.value.clear();
      nextTick(refreshGeometry);
    }, { deep: true });

    return () => {
      const list = (
        <div
          class="hk-tabs-list"
          data-variant={props.variant === "pill" ? "pill" : undefined}
          role="tablist"
        >
          {props.variant === "pill" && (
            <div class="hk-tabs-indicator" style={indicatorStyle.value} />
          )}
          {props.tabs.map((tab, idx) => {
            const active = tab.key === props.modelValue;
            const disabled = tab.disabled;
            return (
              <button
                key={tab.key}
                ref={(el) => setTriggerRef(el, idx)}
                type="button"
                role="tab"
                aria-selected={active}
                aria-disabled={disabled || undefined}
                class="hk-tabs-trigger"
                data-active={active || undefined}
                disabled={disabled}
                onClick={() => emit("update:modelValue", tab.key)}
              >
                {slots[`icon-${tab.key}`]?.()}
                {tab.label && <span>{tab.label}</span>}
              </button>
            );
          })}
        </div>
      );

      // Named const, NOT a mutable `strip` binding: the slot closure below
      // executes during HkHoverRevealAction's render — a closure over a
      // variable that already holds the wrapper vnode itself would recurse
      // forever.
      const stripInner = (
        <div class="hk-tabs" data-variant={props.variant} data-scrollable={props.scrollable || undefined} data-addable={props.addable || undefined}>
          {props.scrollable ? (
            <HkScrollContainer
              ref={scrollerRef}
              class="hk-tabs-scroller"
              axis="horizontal"
              scrollbar={props.scrollbar}
              align="center"
              fade
            >
              {list}
            </HkScrollContainer>
          ) : list}

          {props.renderPanels && props.tabs.map((tab) => (
            <div
              key={tab.key}
              role="tabpanel"
              class="hk-tabs-panel"
              data-active={(tab.key === props.modelValue) || undefined}
            >
              {tab.key === props.modelValue && slots[tab.key]?.()}
            </div>
          ))}
        </div>
      );

      // The addable button rides the shared hover-reveal surface: the
      // whole strip is the reveal host and the "+" is its extension, so
      // it protrudes at the strip's right edge (outside the scroll
      // viewport) and appears on hover / touch-tap only.
      if (!props.addable) return stripInner;

      const PlusIcon = iconByName("Plus") as any;
      return (
        <HkHoverRevealAction
          as="span"
          class="hk-tabs-addwrap"
        >
          {{
            default: () => stripInner,
            extension: () => (
              <HkIconButton
                variant="ghost"
                size={24}
                aria-label={resolvedAddLabel()}
                {...{ title: resolvedAddLabel() }}
                onClick={() => emit("add")}
              >
                {{ icon: () => (PlusIcon ? h(PlusIcon, { size: 14 }) : null) }}
              </HkIconButton>
            ),
          }}
        </HkHoverRevealAction>
      );
    };
  },
});
