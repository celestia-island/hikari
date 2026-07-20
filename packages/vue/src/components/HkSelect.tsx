import {
  computed,
  defineComponent,
  nextTick,
  onBeforeUnmount,
  ref,
  watch,
  type PropType,
  Teleport,
} from "vue";
import { ChevronDown, Search } from "lucide-vue-next";
import "./HkSelect.scss";

export interface HkSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export default defineComponent({
  name: "HkSelect",
  props: {
    modelValue: { type: String, default: "" },
    label: { type: String, default: undefined },
    placeholder: { type: String, default: "" },
    error: { type: String, default: undefined },
    disabled: { type: Boolean, default: false },
    required: { type: Boolean, default: false },
    options: {
      type: Array as PropType<HkSelectOption[]>,
      default: () => [] as HkSelectOption[],
    },
  },
  emits: {
    "update:modelValue": (_value: string) => true,
  },
  setup(props, { emit, slots }) {
    const isOpen = ref(false);
    const triggerRef = ref<HTMLElement>();
    const panelRef = ref<HTMLElement>();
    const highlightedIndex = ref(-1);

    function onDocumentClick(e: MouseEvent) {
      if (!isOpen.value) return;
      const target = e.target as Node;
      if (triggerRef.value?.contains(target)) return;
      if (panelRef.value?.contains(target)) return;
      isOpen.value = false;
    }

    watch(isOpen, (open) => {
      if (open) {
        document.addEventListener("click", onDocumentClick, true);
      } else {
        document.removeEventListener("click", onDocumentClick, true);
      }
    });

    onBeforeUnmount(() => {
      document.removeEventListener("click", onDocumentClick, true);
    });

    const normalizedOptions = computed<HkSelectOption[]>(
      () => props.options ?? [],
    );

    const displayLabel = computed(() => {
      if (!props.modelValue) return props.placeholder || "";
      const opt = normalizedOptions.value.find(
        (o) => o.value === props.modelValue,
      );
      return opt?.label ?? props.modelValue;
    });

    function toggle() {
      if (props.disabled) return;
      isOpen.value = !isOpen.value;
    }

    function select(value: string) {
      emit("update:modelValue", value);
      isOpen.value = false;
    }

    function onTriggerKeydown(e: KeyboardEvent) {
      if (props.disabled) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggle();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        if (!isOpen.value) {
          isOpen.value = true;
          highlightedIndex.value = 0;
        } else {
          highlightedIndex.value =
            (highlightedIndex.value + 1) % normalizedOptions.value.length;
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (!isOpen.value) {
          isOpen.value = true;
        } else {
          highlightedIndex.value =
            (highlightedIndex.value - 1 + normalizedOptions.value.length) %
            normalizedOptions.value.length;
        }
      } else if (e.key === "Escape") {
        isOpen.value = false;
      }
    }

    function onPopoutKeydown(e: KeyboardEvent) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        highlightedIndex.value =
          (highlightedIndex.value + 1) % normalizedOptions.value.length;
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        highlightedIndex.value =
          (highlightedIndex.value - 1 + normalizedOptions.value.length) %
          normalizedOptions.value.length;
      } else if (e.key === "Enter") {
        e.preventDefault();
        const opt = normalizedOptions.value[highlightedIndex.value];
        if (opt && !opt.disabled) {
          select(opt.value);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        isOpen.value = false;
      }
    }

    watch(isOpen, (open) => {
      if (open) {
        const idx = normalizedOptions.value.findIndex(
          (o) => o.value === props.modelValue,
        );
        highlightedIndex.value = idx;
        nextTick(() => {
          scrollToHighlighted();
        });
      } else {
        highlightedIndex.value = -1;
      }
    });

    function scrollToHighlighted() {
      const el = panelRef.value?.querySelector(
        `[data-select-index="${highlightedIndex.value}"]`,
      );
      if (el) {
        el.scrollIntoView({ block: "nearest" });
      }
    }

    watch(highlightedIndex, () => {
      scrollToHighlighted();
    });

    const triggerCoords = computed(() => {
      if (!triggerRef.value) return {};
      const rect = triggerRef.value.getBoundingClientRect();
      return {
        position: "fixed" as const,
        top: `${rect.bottom + 4}px`,
        left: `${rect.left}px`,
        minWidth: `${rect.width}px`,
      };
    });

    return () => (
      <div class="hk-select-wrapper">
        {props.label ? (
          <label class="hk-select-label">
            {props.label}
            {props.required && <span class="hk-select-required">*</span>}
          </label>
        ) : null}
        <button
          ref={triggerRef}
          type="button"
          class="hk-select-trigger"
          data-error={props.error || undefined}
          data-disabled={props.disabled || undefined}
          data-state={isOpen.value ? "open" : "closed"}
          disabled={props.disabled}
          onClick={toggle}
          onKeydown={onTriggerKeydown}
        >
          <span class="hk-select-value">{displayLabel.value || props.placeholder}</span>
          <ChevronDown size={16} class="hk-select-arrow" />
        </button>
        {isOpen.value && (
          <Teleport to="body">
            <div
              ref={panelRef}
              class="hk-select-popout"
              style={triggerCoords.value}
              onKeydown={onPopoutKeydown}
            >
              {slots.default
                ? slots.default()
                : normalizedOptions.value.map((opt, i) => (
                    <div
                      key={opt.value}
                      class="hk-select-option"
                      data-highlighted={highlightedIndex.value === i || undefined}
                      data-select-index={i}
                      data-checked={opt.value === props.modelValue || undefined}
                      data-disabled={opt.disabled || undefined}
                      onClick={() => {
                        if (!opt.disabled) select(opt.value);
                      }}
                      onPointerenter={() => {
                        highlightedIndex.value = i;
                      }}
                    >
                      <span>{opt.label}</span>
                    </div>
                  ))}
            </div>
          </Teleport>
        )}
        {props.error ? <p class="hk-select-error">{props.error}</p> : null}
      </div>
    );
  },
});
