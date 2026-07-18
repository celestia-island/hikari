import { computed, defineComponent, ref, watch, type PropType } from "vue";
import "../../../components/src/styles/components/tabs.scss";

export default defineComponent({
  name: "HkTabs",
  props: {
    modelValue: { type: String },
    tabs: { type: Array as PropType<{ key: string; label: string; disabled?: boolean }[]>, required: true },
  },
  emits: {
    "update:modelValue": (_key: string) => true,
  },
  setup(props, { emit, slots }) {
    const activeKey = ref(props.modelValue ?? props.tabs[0]?.key ?? "");

    watch(() => props.modelValue, (v) => { if (v) activeKey.value = v; });
    watch(activeKey, (v) => emit("update:modelValue", v));

    return () => (
      <div class="hikari-tabs">
        <div class="hikari-tabs__nav">
          {props.tabs.map((tab) => (
            <button
              key={tab.key}
              class={["hikari-tabs__tab", activeKey.value === tab.key ? "hikari-tabs__tab--active" : ""]}
              disabled={tab.disabled}
              onClick={() => (activeKey.value = tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div class="hikari-tabs__content">
          {slots.default?.({ activeKey: activeKey.value })}
        </div>
      </div>
    );
  },
});
