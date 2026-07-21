import { computed, defineComponent, onMounted, ref, Teleport, Transition, type PropType } from "vue";

import "./HkMorphingTabs.scss";

export interface TabItem {
  key: string;
  label: string;
  disabled?: boolean;
}

export default defineComponent({
  name: "HkMorphingTabs",
  props: {
    modelValue: { type: String, required: true },
    tabs: { type: Array as PropType<TabItem[]>, required: true },
    teleportTo: { type: String, default: undefined },
    tag: { type: String, default: "div" },
    hideTriggers: { type: Boolean, default: false },
  },
  emits: {
    "update:modelValue": (_value: string) => true,
  },
  setup(props, { emit, slots }) {
    const activeKey = computed(() => props.modelValue);
    const ready = ref(false);

    const tabCount = computed(() => props.tabs.length);
    const tabIndex = computed(() => {
      const idx = props.tabs.findIndex((t) => t.key === activeKey.value);
      return idx >= 0 ? idx : 0;
    });

    const indicatorStyle = computed(
      () =>
        ({
          "--tab-count": tabCount.value,
          "--tab-index": tabIndex.value,
        }) as Record<string, string | number>,
    );

    onMounted(() => {
      ready.value = true;
    });

    function renderTriggers() {
      if (props.hideTriggers) return null;
      return (
        <div class="hk-morphing-tabs-triggers" role="tablist">
          <div class="hk-morphing-tabs-indicator" style={indicatorStyle.value} />
          {props.tabs.map((tab) => {
            const isActive = activeKey.value === tab.key;
            return (
              <button
                key={tab.key}
                role="tab"
                aria-selected={isActive}
                aria-controls={`hk-morphing-tabpanel-${tab.key}`}
                tabindex={isActive ? 0 : -1}
                disabled={tab.disabled}
                class={[
                  "hk-morphing-tabs-trigger",
                  { "hk-morphing-tabs-trigger-active": isActive },
                ]}
                onClick={() => emit("update:modelValue", tab.key)}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      );
    }

    return () => {
      const Tag = props.tag as "div" | "section" | "nav";
      const triggerContent = renderTriggers();

      return (
        <Tag class="hk-morphing-tabs">
          {props.teleportTo ? (
            ready.value && <Teleport to={props.teleportTo}>{triggerContent}</Teleport>
          ) : (
            <div class="hk-morphing-tabs-header">{triggerContent}</div>
          )}

          <div class="hk-morphing-tabs-content">
            <Transition name="hk-morphing-crossfade" mode="out-in" appear>
              <div
                key={activeKey.value}
                class="hk-morphing-tabs-panel"
                role="tabpanel"
                id={`hk-morphing-tabpanel-${activeKey.value}`}
                aria-label={props.tabs.find((t) => t.key === activeKey.value)?.label}
              >
                {slots[activeKey.value]?.()}
              </div>
            </Transition>
          </div>

          {slots.footer && (
            <div class="hk-morphing-tabs-footer">
              <Transition name="hk-morphing-bar" mode="out-in" appear>
                <div key={activeKey.value} class="hk-morphing-tabs-footer-inner">
                  {slots.footer({ activeKey: activeKey.value })}
                </div>
              </Transition>
            </div>
          )}
        </Tag>
      );
    };
  },
});
