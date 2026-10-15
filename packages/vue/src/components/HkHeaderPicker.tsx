import {
  computed,
  defineComponent,
  nextTick,
  ref,
  watch,
  type PropType,
} from "vue";

import { ChevronDown, Pencil, Trash2 } from "lucide-vue-next";

import { useBreakpoint } from "../runtime/useBreakpoint";
import HkDraggableList from "./HkDraggableList";
import HkIconButton from "./HkIconButton";
import HkSelectPanel, { type SelectPanelPlacement } from "./HkSelectPanel";
import "./HkHeaderPicker.scss";

/** One choice of a header picker. The selection surface is the same
 *  model as a select's; the three extra flags light the STANDARDIZED
 *  per-row affordances (R: 2026-10-15 header-picker direction) — a row
 *  may be renamed, deleted, or (when the whole picker is `reorderable`)
 *  dragged into a new order, so "manage the dynamic set" pages — flash
 *  hubs, office documents, tag rosters — hang their maintenance verbs
 *  on the SAME component instead of one bespoke menu each. */
export interface HkPickerOption {
  value: string;
  label: string;
  disabled?: boolean;
  /** Hidden grip: the row never drags (a pinned default), but the
   *  handle lane stays reserved so the column does not jump. */
  locked?: boolean;
  /** Show the standardized rename action (emits `edit`). */
  editable?: boolean;
  /** Show the standardized delete action (emits `remove`). The picker
   *  itself never confirms — removal is the HOST's decision; this just
   *  makes the affordance uniform. */
  removable?: boolean;
}

/**
 * HkHeaderPicker — the header-centre SELECTOR, the button group's
 * sibling facility. Where `HkTabs` (segmented) serves a small closed
 * enum, this serves an OPEN or machine-managed set (hubs, documents,
 * tags): a dropdown-style trigger reading the current choice, and an
 * opened panel that mirrors the bottom-centre pickers symmetrically —
 *
 * - phone: the same bottom sheet they use, sliding up from the bottom
 *   edge (an edge gesture, identical muscle memory);
 * - desktop: a popout anchored at the trigger growing DOWNWARD from
 *   the header band — the mirror of a bottom-pinned picker growing up.
 *
 * The panel is HkSelectPanel (popup-manager, z-bands, scrim/grabber),
 * so the surface behaves like every other dropdown in the family; this
 * component owns the header-band trigger chrome, the keyboard model,
 * and the standardized row verbs (rename / delete / drag-reorder).
 * Removing/renaming emits to the host — this component never mutates
 * the set, never confirms — the host decides the policy, the family
 * keeps the look.
 */
export default defineComponent({
  name: "HkHeaderPicker",
  props: {
    modelValue: { type: String, default: "" },
    options: {
      type: Array as PropType<HkPickerOption[]>,
      default: () => [] as HkPickerOption[],
    },
    /** Placeholder when nothing is selected yet. */
    placeholder: { type: String, default: "" },
    /** Title for the OPENED surface only (sheet header / popout a11y). */
    panelTitle: { type: String, default: undefined },
    disabled: { type: Boolean, default: false },
    /** Show drag grips and emit `reorder` (host owns the new order). */
    reorderable: { type: Boolean, default: false },
    /** Desktop-popout side relative to the trigger. The header sits at
     *  the viewport's top, so the popout grows DOWNWARD (bottom-*) —
     *  the mirror of bottom-pinned pickers; auto-flip still rescues a
     *  viewport that cannot fit it. */
    placement: {
      type: String as PropType<SelectPanelPlacement>,
      default: "bottom-start",
    },
    /** Accessible name of the trigger itself. */
    ariaLabel: { type: String, default: undefined },
  },
  emits: {
    "update:modelValue": (_value: string) => true,
    /** A row's standardized rename action was pressed. */
    edit: (_value: string) => true,
    /** A row's standardized delete action was pressed. */
    remove: (_value: string) => true,
    /** Drag-reorder finished (reorderable): host reorders the array. */
    reorder: (_fromIndex: number, _toIndex: number) => true,
  },
  setup(props, { emit }) {
    const isOpen = ref(false);
    const triggerRef = ref<HTMLElement>();
    const panelExpose = ref<{ panelEl: () => HTMLElement | null }>();
    const highlightedIndex = ref(-1);

    // Pointer-hover highlighting only applies to the desktop popout —
    // the mobile sheet rows never had it (spurious tap-highlight).
    const { isMobile } = useBreakpoint();
    const sheetMode = computed(() => isMobile.value);

    const options = computed(() => props.options ?? []);

    const displayLabel = computed(() => {
      if (!props.modelValue) return props.placeholder || "";
      return (
        options.value.find((o) => o.value === props.modelValue)?.label ??
        props.modelValue
      );
    });

    function toggle() {
      if (props.disabled) return;
      isOpen.value = !isOpen.value;
    }

    function select(value: string) {
      emit("update:modelValue", value);
      isOpen.value = false;
    }

    function onEdit(e: MouseEvent, value: string) {
      // The row's verb must not double as a row selection.
      e.stopPropagation();
      emit("edit", value);
    }

    function onRemove(e: MouseEvent, value: string) {
      e.stopPropagation();
      emit("remove", value);
    }

    function onReorder(from: number, to: number) {
      emit("reorder", from, to);
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
            (highlightedIndex.value + 1) % options.value.length;
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (!isOpen.value) {
          isOpen.value = true;
        } else {
          highlightedIndex.value =
            (highlightedIndex.value - 1 + options.value.length) %
            options.value.length;
        }
      } else if (e.key === "Escape") {
        // Consume ONLY when it closed something — the trigger may sit
        // inside a dialog surface whose own Escape must survive.
        if (isOpen.value) {
          e.preventDefault();
          e.stopPropagation();
        }
        isOpen.value = false;
      }
    }

    function onPopoutKeydown(e: KeyboardEvent) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        highlightedIndex.value =
          (highlightedIndex.value + 1) % options.value.length;
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        highlightedIndex.value =
          (highlightedIndex.value - 1 + options.value.length) %
          options.value.length;
      } else if (e.key === "Enter") {
        e.preventDefault();
        const opt = options.value[highlightedIndex.value];
        if (opt && !opt.disabled) select(opt.value);
      } else if (e.key === "Escape") {
        e.preventDefault();
        isOpen.value = false;
      }
    }

    function scrollToHighlighted() {
      const root = panelExpose.value?.panelEl();
      const el = root?.querySelector(`[data-select-index="${highlightedIndex.value}"]`);
      el?.scrollIntoView({ block: "nearest" });
    }

    watch(isOpen, (open) => {
      if (open) {
        const idx = options.value.findIndex((o) => o.value === props.modelValue);
        highlightedIndex.value = idx;
        nextTick(() => scrollToHighlighted());
      } else {
        highlightedIndex.value = -1;
      }
    });

    watch(highlightedIndex, () => scrollToHighlighted());

    /** One standardized row: label + the affordances its flags light.
     *  Selecting the row picks it; the verb buttons stop propagation so
     *  a rename/delete never doubles as a selection. */
    const renderRow = (opt: HkPickerOption, i: number) => (
      <div
        key={opt.value}
        class="hk-select-option hk-header-picker-option"
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
        <span class="hk-header-picker-option-label">{opt.label}</span>
        <span class="hk-header-picker-option-actions">
          {opt.editable && (
            <HkIconButton
              variant="ghost"
              size={24}
              aria-label="Rename"
              onClick={(e: MouseEvent) => onEdit(e, opt.value)}
            >
              {{
                icon: () => <Pencil size={14} />,
              }}
            </HkIconButton>
          )}
          {opt.removable && (
            <HkIconButton
              variant="ghost"
              size={24}
              aria-label="Delete"
              onClick={(e: MouseEvent) => onRemove(e, opt.value)}
            >
              {{
                icon: () => <Trash2 size={14} />,
              }}
            </HkIconButton>
          )}
        </span>
      </div>
    );

    const renderRows = () => {
      if (props.reorderable) {
        return (
          <HkDraggableList
            items={options.value.map((o) => ({ ...o, key: o.value }))}
            lockedKeys={options.value.filter((o) => o.locked).map((o) => o.value)}
            onReorder={onReorder}
          >
            {{
              item: ({ item, index }: { item: HkPickerOption; index: number }) =>
                renderRow(options.value[index] ?? item, index),
            }}
          </HkDraggableList>
        );
      }
      return options.value.map((opt, i) => renderRow(opt, i));
    };

    return () => (
      <div class="hk-header-picker">
        <button
          ref={triggerRef}
          type="button"
          class="hk-select-trigger hk-header-picker-trigger"
          data-state={isOpen.value ? "open" : "closed"}
          data-disabled={props.disabled || undefined}
          disabled={props.disabled}
          aria-haspopup="listbox"
          aria-expanded={isOpen.value}
          aria-label={props.ariaLabel ?? props.panelTitle}
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
          title={props.panelTitle ?? ""}
          placement={props.placement}
          offset={4}
          sheetOnMobile
          onKeydown={onPopoutKeydown}
        >
          {renderRows()}
        </HkSelectPanel>
      </div>
    );
  },
});
