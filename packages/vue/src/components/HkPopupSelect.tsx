import { ChevronDown } from "lucide-vue-next";
import { computed, defineComponent, nextTick, onBeforeUnmount, ref, watch, type PropType } from "vue";

import HkPopover from "./HkPopover";
import HkScrollContainer from "./HkScrollContainer";
import { useOverlay } from "../runtime/useOverlay";
import "./HkPopupSelect.scss";

export interface HkPopupSelectOption {
  value: string;
  label: string;
}

const activePopupId = ref<string | null>(null);
let popupCounter = 0;

export function isAnyPopupOpen(): boolean {
  return activePopupId.value !== null;
}

export function closeAllPopups(): void {
  activePopupId.value = null;
}

function scrollToElement(selector: string): void {
  const el = document.querySelector(selector) as HTMLElement | null;
  el?.scrollIntoView({ block: "nearest" });
}

export default defineComponent({
  name: "HkPopupSelect",
  props: {
    modelValue: { type: String, default: "" },
    label: { type: String, default: undefined },
    placeholder: { type: String, default: "" },
    error: { type: String, default: undefined },
    disabled: { type: Boolean, default: false },
    required: { type: Boolean, default: false },
    options: {
      type: Array as PropType<HkPopupSelectOption[]>,
      default: undefined,
    },
  },
  emits: {
    "update:modelValue": (_value: string) => true,
  },
  setup(props, { emit, slots }) {
    const instanceId = `hk-popup-select-${++popupCounter}`;
    const isOpen = ref(false);
    const triggerRef = ref<HTMLElement>();
    const highlightedIndex = ref(-1);

    // Registered with the overlay registry so closeAll()/isOverlayOpen()
    // see the open popout. The popover inside handles z-stacking via the
    // popup manager; the legacy module singleton (activePopupId) stays as
    // the cross-instance close coordination. The onCloseRequested hook makes
    // a global closeAll() flip this component's own open ref, which tears
    // the popover down (the activePopupId cleanup runs in the watcher).
    const overlay = useOverlay({
      name: "hk-popup-select",
      onCloseRequested: () => { isOpen.value = false; },
    });

    watch(isOpen, (open) => {
      if (open) {
        activePopupId.value = instanceId;
        overlay.open();
      } else {
        if (activePopupId.value === instanceId) {
          activePopupId.value = null;
        }
        overlay.close();
      }
    });

    onBeforeUnmount(() => {
      overlay.close();
      if (activePopupId.value === instanceId) {
        activePopupId.value = null;
      }
    });

    watch(activePopupId, (id) => {
      if (id !== instanceId && isOpen.value) {
        isOpen.value = false;
      }
    });

    const normalizedOptions = computed<HkPopupSelectOption[]>(
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
          highlightedIndex.value = (highlightedIndex.value + 1) % normalizedOptions.value.length;
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
      scrollToElement(`[data-select-index="${highlightedIndex.value}"]`);
    }

    watch(highlightedIndex, () => {
      scrollToHighlighted();
    });

    return () => (
      <div class="hk-popup-select-wrapper">
        {props.label ? (
          <label class="hk-popup-select-label">
            {props.label}
            {props.required && <span class="hk-popup-select-required">*</span>}
          </label>
        ) : null}
        <button
          ref={triggerRef}
          type="button"
          class="hk-popup-select-trigger"
          data-error={props.error || undefined}
          data-disabled={props.disabled || undefined}
          disabled={props.disabled}
          onClick={toggle}
          onKeydown={onTriggerKeydown}
          data-state={isOpen.value ? "open" : "closed"}
        >
          <span class="hk-popup-select-value">
            {displayLabel.value || props.placeholder}
          </span>
          <ChevronDown size={16} class="hk-popup-select-arrow" />
        </button>
        <HkPopover
          modelValue={isOpen.value}
          onUpdate:modelValue={(v: boolean) => { isOpen.value = v; }}
          anchorRef={triggerRef.value ?? null}
          placement="bottom"
          offset={4}
          backdrop={false}
          sheetOnMobile
          class="hk-popup-select-content"
        >
          <HkScrollContainer class="hk-popup-select-viewport">
            {slots.default
              ? slots.default()
              : normalizedOptions.value.map((opt, i) => (
                  <div
                    key={opt.value}
                    class="hk-popup-select-item"
                    data-highlighted={highlightedIndex.value === i || undefined}
                    data-select-index={i}
                    data-checked={opt.value === props.modelValue || undefined}
                    onClick={() => select(opt.value)}
                    onPointerenter={() => { highlightedIndex.value = i; }}
                  >
                    <span>{opt.label}</span>
                  </div>
                ))}
          </HkScrollContainer>
        </HkPopover>
        {props.error ? <p class="hk-popup-select-error">{props.error}</p> : null}
      </div>
    );
  },
});
