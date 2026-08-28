import { computed, defineComponent, onMounted, ref, Teleport, Transition, type PropType } from "vue";

import { useMeasuredHighlight } from "../composables/useMeasuredHighlight";
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
    // Gates the Teleport (a teleported target only exists after mount).
    const mounted = ref(false);

    const triggersRef = ref<HTMLElement | null>(null);
    const activeIndex = computed(() => {
      const idx = props.tabs.findIndex((t) => t.key === activeKey.value);
      return idx >= 0 ? idx : 0;
    });

    // Indicator geometry from real trigger measurements. The old CSS-var
    // percentage math assumed equal-width triggers, but `flex: 1 1 0` +
    // `min-width: auto` lets overflowing labels widen some triggers, which
    // drifted the indicator off the active tab (visible with 4+ tabs).
    const { x, width, ready } = useMeasuredHighlight({
      container: triggersRef,
      activeIndex,
      itemSelector: ".hk-morphing-tabs-trigger",
      extraSources: [() => props.tabs],
    });

    const indicatorStyle = computed(
      () =>
        ({
          transform: `translateX(${x.value}px)`,
          width: `${width.value}px`,
        }) as Record<string, string>,
    );

    onMounted(() => {
      mounted.value = true;
    });

    function renderTriggers() {
      if (props.hideTriggers) return null;
      return (
        <div class="hk-morphing-tabs-triggers" ref={triggersRef} role="tablist" data-ready={ready.value ? "true" : undefined}>
          <div class="hk-morphing-tabs-indicator" aria-hidden="true" style={indicatorStyle.value} />
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
            mounted.value && <Teleport to={props.teleportTo}>{triggerContent}</Teleport>
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
