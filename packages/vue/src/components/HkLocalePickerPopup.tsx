import { defineComponent, type PropType } from "vue";
import type { Ref } from "vue";

import HkMenu, { type HkMenuItem } from "./HkMenu";

/**
 * Locale picking on top of the generic HkMenu: one menu tree whose leaf
 * items are the supported locales. Desktop cascades from the trigger;
 * mobile opens fullscreen sheets with back-gesture navigation — all
 * inherited from HkMenu, nothing locale-specific here but the mapping.
 */
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
    const items: HkMenuItem[] = props.locales.map((loc) => ({
      key: loc.code,
      label: loc.label,
      flag: loc.flag,
      checked: loc.code === props.currentLocale,
    }));
    return () => {
      const raw = props.triggerRef;
      const anchor =
        raw && "value" in (raw as Ref<HTMLElement | null>)
          ? (raw as Ref<HTMLElement | null>).value
          : (raw as HTMLElement | null);
      return (
      <HkMenu
        open={props.open}
        anchorRef={anchor}
        placement={
          props.placement === "left-start" || props.placement === "right-start"
            ? props.placement
            : "right-start"
        }
        title={(() => {
          const tt = props.t("locale.title");
          return tt && tt !== "locale.title" ? tt : "Language";
        })()}
        items={items}
        onUpdate:open={(v: boolean) => emit("update:open", v)}
        onSelect={(key: string) => emit("select", key)}
      />
      );
    };
  },
});

export default HkLocalePickerPopup;
