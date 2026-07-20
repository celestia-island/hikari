import { defineComponent, nextTick, onMounted, ref, watch, type ComponentPublicInstance, type PropType } from "vue";

import "./HkTabs.scss";

interface TabItem {
  key: string;
  label: string;
  disabled?: boolean;
}

export default defineComponent({
  name: "HkTabs",
  props: {
    modelValue: { type: String, required: true },
    tabs: { type: Array as PropType<TabItem[]>, required: true },
    variant: { type: String as PropType<"underline" | "pill">, default: "underline" },
    renderPanels: { type: Boolean, default: true },
  },
  emits: {
    "update:modelValue": (_value: string) => true,
  },
  setup(props, { emit, slots }) {
    const triggerRefs = ref<Map<number, HTMLElement>>(new Map());
    const indicatorStyle = ref<Record<string, string>>({});

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

    let resizeObserver: ResizeObserver | null = null;

    onMounted(() => {
      nextTick(updateIndicator);
      if (props.variant === "pill") {
        resizeObserver = new ResizeObserver(() => updateIndicator());
        const firstEl = triggerRefs.value.get(0);
        if (firstEl?.parentElement) {
          resizeObserver.observe(firstEl.parentElement);
        }
      }
    });

    watch(() => props.modelValue, () => nextTick(updateIndicator));

    watch(() => props.tabs, () => {
      triggerRefs.value.clear();
      nextTick(updateIndicator);
    }, { deep: true });

    return () => (
      <div class="hk-tabs" data-variant={props.variant}>
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
  },
});
