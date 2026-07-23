import { defineComponent, type PropType } from "vue";
import { Check } from "lucide-vue-next";
import HkPopover from "./HkPopover";

interface LocaleOption {
  code: string;
  labelKey: string;
  flag?: string;
}

export default defineComponent({
  name: "HkLocalePickerPopup",
  props: {
    open: { type: Boolean, required: true },
    triggerRef: { type: Object as PropType<HTMLElement | null>, required: true },
    placement: { type: String, default: "right-start" },
    locales: { type: Array as PropType<LocaleOption[]>, required: true },
    currentLocale: { type: String, default: "" },
    t: { type: Function as PropType<(key: string) => string>, required: true },
  },
  emits: ["update:open", "select"],
  setup(props, { emit }) {
    function select(code: string) {
      emit("update:open", false);
      emit("select", code);
    }

    return () => (
      <HkPopover
        modelValue={props.open}
        onUpdate:modelValue={(v: boolean) => emit("update:open", v)}
        placement={props.placement}
        anchorRef={props.triggerRef}
        backdrop={false}
        closeOnBackdrop={false}
        closeOnEscape={true}
      >
        <div class="hk-locale-submenu">
          {props.locales.map((loc) => (
            <button
              key={loc.code}
              class="hk-popup-menu-item"
              data-active={(props.currentLocale === loc.code) || undefined}
              onClick={() => select(loc.code)}
            >
              {loc.flag && <span class="hk-locale-flag">{loc.flag}</span>}
              <span>{props.t(loc.labelKey)}</span>
              {props.currentLocale === loc.code && <Check size={14} />}
            </button>
          ))}
        </div>
      </HkPopover>
    );
  },
});
