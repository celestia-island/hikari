import { defineComponent, type PropType } from "vue";
import type { Ref } from "vue";

const HkLocalePickerPopup = defineComponent({
  name: "HkLocalePickerPopup",
  props: {
    open: { type: Boolean, required: true },
    triggerRef: { type: [Object, null] as PropType<HTMLElement | Ref<HTMLElement | null> | null>, default: null },
    placement: { type: String, default: "right-start" },
    locales: { type: Array as PropType<Array<{ code: string; label: string; flag?: string }>>, required: true },
    currentLocale: { type: String, default: "" },
    t: { type: Function as PropType<(key: string) => string>, default: (k: string) => k },
  },
  emits: ["update:open", "select"],
  setup(props, { emit }) {
    return () => {
      if (!props.open) return null;
      return (
        <div class="hk-locale-picker-popup" role="listbox">
          {props.locales.map((loc) => (
            <button
              key={loc.code}
              class="hk-locale-picker-item"
              data-selected={loc.code === props.currentLocale || undefined}
              role="option"
              aria-selected={loc.code === props.currentLocale}
              onClick={() => {
                emit("select", loc.code);
                emit("update:open", false);
              }}
            >
              {loc.flag && <span class="hk-locale-picker-flag">{loc.flag}</span>}
              <span class="hk-locale-picker-label">{loc.label}</span>
            </button>
          ))}
        </div>
      );
    };
  },
});

export default HkLocalePickerPopup;
