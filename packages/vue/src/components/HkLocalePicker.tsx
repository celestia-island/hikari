import { defineComponent, ref, type PropType } from "vue";

import HkLocalePickerPopup from "./HkLocalePickerPopup";
import "./HkLocalePicker.scss";

export interface LocaleOption {
  code: string;
  label: string;
}

/**
 * HkLocalePicker — the compact trigger + dropdown locale picker. The
 * dropdown hand-rolled its own absolutely-positioned stock (inline
 * styles, JS-painted hover, no sheet, no roles — the 2026-10-31 sweep's
 * finding #8); it now rides HkLocalePickerPopup (HkMenu), so the rows
 * speak the menu-item grammar, the panel anchors/cascades/flips like
 * every menu, and phones get the sheet family. The public surface is
 * unchanged: locales / currentLocale props, `select` event.
 */
export const HkLocalePicker = defineComponent({
  name: "HkLocalePicker",
  props: {
    locales: {
      type: Array as PropType<LocaleOption[]>,
      default: () => [],
    },
    currentLocale: {
      type: String,
      default: "en",
    },
  },
  emits: ["select"],
  setup(props, { emit }) {
    const open = ref(false);
    const trigger = ref<HTMLElement | null>(null);

    function handleSelect(code: string | string[]) {
      const code0 = Array.isArray(code) ? code[0] : code;
      if (code0) emit("select", code0);
      open.value = false;
    }

    return () => (
      <div style={{ position: "relative" }} ref={trigger}>
        <button
          type="button"
          class="hk-locale-picker-trigger"
          aria-haspopup="menu"
          aria-expanded={open.value}
          onClick={() => (open.value = !open.value)}
        >
          {props.currentLocale.toUpperCase()}
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
            <path
              d="M2 3.5l3 3 3-3"
              fill="none"
              stroke="currentColor"
              stroke-width="1.2"
            />
          </svg>
        </button>
        <HkLocalePickerPopup
          open={open.value}
          triggerRef={trigger.value}
          placement="bottom-end"
          locales={props.locales.map((loc) => ({ code: loc.code, label: loc.label }))}
          currentLocale={props.currentLocale}
          onUpdate:open={(v: boolean) => (open.value = v)}
          onSelect={handleSelect}
        />
      </div>
    );
  },
});
