import {
  computed,
  defineComponent,
  nextTick,
  ref,
  watch,
  type PropType,
} from "vue";


import { ChevronDown } from "lucide-vue-next";
import { useBreakpoint } from "../runtime/useBreakpoint";
import HkSelectPanel from "./HkSelectPanel";
import "./HkSelect.scss";

export interface HkSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

/**
 * Dropdown select. The opened panel — desktop popout and mobile sheet —
 * lives in HkSelectPanel, the dropdown surface custom triggers may also
 * invoke directly; this component owns the field chrome (label, trigger
 * button, error) and the option model with keyboard navigation.
 */
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
    /** The panel surface (HkSelectPanel) — row queries stay scoped to it. */
    const panelExpose = ref<{ panelEl: () => HTMLElement | null }>();
    const highlightedIndex = ref(-1);

    // Pointer-hover highlighting only applies to the desktop popout —
    // master's sheet rows never had it (spurious tap-highlight on touch).
    const { isMobile } = useBreakpoint();
    const sheetMode = computed(() => isMobile.value);

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

    function scrollToHighlighted() {
      // Scoped to OUR panel surface — a document-scoped query could hit
      // another concurrently open panel's rows (HkPopupSelect rows carry
      // the same data attribute).
      const root = panelExpose.value?.panelEl();
      const el = root?.querySelector(
        `[data-select-index="${highlightedIndex.value}"]`,
      );
      el?.scrollIntoView({ block: "nearest" });
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

    watch(highlightedIndex, () => {
      scrollToHighlighted();
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
        <HkSelectPanel
          ref={panelExpose}
          open={isOpen.value}
          onUpdate:open={(v: boolean) => { isOpen.value = v; }}
          anchorRef={triggerRef.value ?? null}
          title={props.label ?? ""}
          placement="bottom-start"
          offset={4}
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
                  {...(isOpen.value && !sheetMode.value
                    ? { onPointerenter: () => { highlightedIndex.value = i; } }
                    : {})}
                >
                  <span>{opt.label}</span>
                </div>
              ))}
        </HkSelectPanel>
        {props.error ? <p class="hk-select-error">{props.error}</p> : null}
      </div>
    );
  },
});
