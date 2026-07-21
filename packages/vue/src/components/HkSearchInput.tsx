import { defineComponent, onUnmounted, ref, watch, type PropType } from "vue";
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
  props: {
    modelValue: { type: String, default: "" },
    placeholder: { type: String, default: "Search..." },
    disabled: { type: Boolean, default: false },
    size: {
      type: String as PropType<"sm" | "md" | "lg">,
      default: "md",
    },
    debounce: { type: Number, default: 0 },
  },
  emits: {
    "update:modelValue": (_value: string) => true,
    search: (_value: string) => true,
    clear: () => true,
  },
  setup(props, { emit }) {
    const inputRef = ref<HTMLInputElement | null>(null);
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

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
      <div class={wrapperClass}>
        <span class="hk-search-input-icon">{searchIcon}</span>
        <input
          ref={inputRef}
          type="search"
          class="hk-search-input-field"
          value={props.modelValue}
          placeholder={props.placeholder ?? "Search..."}
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
            aria-label="Clear search"
          >
            {clearIcon}
          </button>
        ) : null}
      </div>
    );
  },
});
