import {
  defineComponent,
  onUnmounted,
  ref,
  useAttrs,
  watch,
  type PropType,
  type StyleValue,
} from "vue";
import { useI18n } from "../i18n/context";
import "./HkSearchInput.scss";

const searchIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const clearIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export default defineComponent({
  name: "HkSearchInput",
  // The styled box and the control are two nodes: the box is a chrome
  // wrapper (`.hk-search-input`), the `<input>` inside it is the actual
  // field. Undeclared attributes therefore belong on the FIELD, not the
  // box — the HkInput contract. A consumer that wires this search field
  // as the combobox of a list surface (HkUserPicker) passes `aria-label`,
  // `aria-controls`, `aria-activedescendant` / `aria-expanded`; the old
  // auto-fallthrough onto the wrapper left the input itself unnamed and
  // the active row unpublished. `class` / `style` stay on the wrapper
  // (its historical home). `role` is DECLARED below rather than passed as
  // an attribute: it carries no dash, so the JSX attribute passthrough
  // cannot accept it (the house rule is the same for `role` on HkInput —
  // HkTagInput reaches for a native input when it needs one).
  inheritAttrs: false,
  props: {
    modelValue: { type: String, default: "" },
    placeholder: { type: String, default: undefined },
    disabled: { type: Boolean, default: false },
    size: {
      type: String as PropType<"sm" | "md" | "lg">,
      default: "md",
    },
    debounce: { type: Number, default: 0 },
    clearAriaLabel: { type: String, default: "" },
    /** Role of the FIELD element itself — "combobox" when a panel (the
     *  HkUserPicker popover) owns a list of options behind this search
     *  box. Undefined keeps the native searchbox semantics. */
    role: { type: String, default: undefined },
  },
  emits: {
    "update:modelValue": (_value: string) => true,
    search: (_value: string) => true,
    clear: () => true,
  },
  setup(props, { emit }) {
    const { t } = useI18n();
    const attrs = useAttrs();
    const inputRef = ref<HTMLInputElement | null>(null);
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    /** Undeclared attributes minus the two that keep the wrapper's
     *  historical meaning — every other one (aria wiring, `name`, an
     *  extra listener) is the FIELD's. */
    const fieldAttrs = () => {
      const { class: _class, style: _style, ...rest } = attrs as Record<string, unknown>;
      return rest;
    };

    /** `style` is the one wrapper-bound attribute that needs typing: it
     *  rides the box beside `class`. */
    const wrapperStyle = () => (attrs as { style?: StyleValue }).style;

    function flushSearch(val: string) {
      emit("search", val);
    }

    function debouncedSearch(val: string) {
      if (debounceTimer) clearTimeout(debounceTimer);
      if (props.debounce > 0) {
        debounceTimer = setTimeout(() => flushSearch(val), props.debounce);
      } else {
        flushSearch(val);
      }
    }

    watch(
      () => props.modelValue,
      (val) => {
        debouncedSearch(val);
      },
    );

    onUnmounted(() => {
      if (debounceTimer) clearTimeout(debounceTimer);
    });

    function onInput(e: Event) {
      const val = (e.target as HTMLInputElement).value;
      emit("update:modelValue", val);
    }

    function onKeydown(e: KeyboardEvent) {
      if (e.key === "Enter") {
        if (debounceTimer) clearTimeout(debounceTimer);
        emit("search", (e.target as HTMLInputElement).value);
      }
    }

    function clearValue() {
      emit("update:modelValue", "");
      emit("clear");
      inputRef.value?.focus();
    }

    const wrapperClass = [
      "hk-search-input",
      `hk-search-input-${props.size}`,
      props.disabled ? "hk-search-input-disabled" : "",
    ];

    return () => (
      <div
        class={[...wrapperClass, (attrs as Record<string, unknown>).class]}
        style={wrapperStyle()}
      >
        <span class="hk-search-input-icon">{searchIcon}</span>
        <input
          {...fieldAttrs()}
          ref={inputRef}
          type="search"
          class="hk-search-input-field"
          role={props.role}
          value={props.modelValue}
          placeholder={props.placeholder ?? t("hikari::searchInput.placeholder", "Search…")}
          disabled={props.disabled}
          onInput={onInput}
          onKeydown={onKeydown}
        />
        {props.modelValue && !props.disabled ? (
          <button
            type="button"
            class="hk-search-input-clear"
            onClick={clearValue}
            tabindex={-1}
            aria-label={props.clearAriaLabel || t("hikari::searchInput.clear", "Clear search")}
          >
            {clearIcon}
          </button>
        ) : null}
      </div>
    );
  },
});
