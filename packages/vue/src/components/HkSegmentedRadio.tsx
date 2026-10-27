import { computed, defineComponent, nextTick, ref, type PropType } from "vue";

import "./HkSegmentedRadio.scss";

/** One joined segment of the single-choice strip. */
export interface HkSegmentedRadioOption {
  /** Stable identity — emitted back through `update:modelValue`. */
  value: string;
  label: string;
}

/**
 * HkSegmentedRadio — the single-choice joined strip for filter popovers
 * and compact pickers: a flat bordered track of full-label segments, the
 * picked one carrying the primary tint (multi-select's sibling is
 * HkPillToggleGroup, whose toggle semantics cannot express "exactly
 * one"; HkTabs owns the view-switching indicator strip — this component
 * is the FORM control in that gap, radio semantics throughout).
 *
 * Grammar ported from the two chest filter popovers that hand-rolled
 * this control independently (history TopicFilterMenu 2026-10-21, cruise
 * CruiseNodeFilterMenu 2026-10-26) with DIFFERENT paddings and hover
 * tints — the point of the component is that they converge on one
 * chrome (#demiurge.673 follow-up, 2026-10-27).
 *
 * Keyboard: a true radiogroup — roving tabindex on the picked segment,
 * Arrow/Home/End to move (wrapping), Enter/Space to pick.
 */
export default defineComponent({
  name: "HkSegmentedRadio",
  props: {
    /** Accessible name of the group (the radiogroup's aria-label). */
    label: { type: String, required: true },
    options: {
      type: Array as PropType<HkSegmentedRadioOption[]>,
      default: () => [],
    },
    /** The picked value — single source of truth, never mutated here. */
    modelValue: { type: String, default: "" },
    disabled: { type: Boolean, default: false },
  },
  emits: {
    "update:modelValue": (_value: string) => true,
  },
  setup(props, { emit }) {
    const groupRef = ref<HTMLElement | null>(null);
    const picked = computed(() =>
      props.options.find((item) => item.value === props.modelValue),
    );
    // Duplicate values would render two aria-checked radios (two
    // tabbable segments) and hazard the keyed patch — keep the first
    // occurrence and say so in dev.
    const dedupedOptions = computed(() => {
      const seen = new Set<string>();
      return props.options.filter((item) => {
        if (seen.has(item.value)) return false;
        seen.add(item.value);
        return true;
      });
    });
    if (import.meta.env.DEV && dedupedOptions.value.length !== props.options.length) {
      // eslint-disable-next-line no-console -- dev-only drift alarm
      console.warn(
        "[HkSegmentedRadio] duplicate option values dropped:",
        props.options.map((o) => o.value).join(", "),
      );
    }

    function choose(value: string): void {
      if (value !== props.modelValue) emit("update:modelValue", value);
    }

    function onGroupKeydown(event: KeyboardEvent): void {
      const items = props.options;
      if (items.length === 0) return;
      const index = items.findIndex((item) => item.value === props.modelValue);
      let next: number;
      if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        // Nothing picked yet: the edges are honest neighbors (last /
        // first), not the element at the wrap of index -1.
        next = index === -1
          ? items.length - 1
          : (index - 1 + items.length) % items.length;
      } else if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        next = index === -1 ? 0 : (index + 1) % items.length;
      } else if (event.key === "Home") {
        next = 0;
      } else if (event.key === "End") {
        next = items.length - 1;
      } else {
        return;
      }
      event.preventDefault();
      const value = items[next]!.value;
      choose(value);
      void nextTick(() => {
        // Walk the rendered buttons comparing dataset — a quoted
        // attribute selector with CSS.escape throws on quote-bearing
        // values in happy-dom and misses NUL-bearing ones, which would
        // kill the refocus as an unhandled rejection.
        const target = Array.from(
          groupRef.value?.querySelectorAll<HTMLElement>("[data-option]") ?? [],
        ).find((el) => el.dataset.option === value);
        target?.focus();
      });
    }

    return () => (
      <div
        ref={groupRef}
        class="hk-segmented-radio"
        role="radiogroup"
        aria-label={props.label}
        data-disabled={props.disabled || undefined}
        onKeydown={onGroupKeydown}
      >
        {dedupedOptions.value.map((item) => {
          const active = item.value === props.modelValue;
          return (
            <button
              key={item.value}
              type="button"
              role="radio"
              aria-checked={active}
              tabindex={picked.value ? (active ? 0 : -1) : item === props.options[0] ? 0 : -1}
              class="hk-segmented-radio-option"
              data-option={item.value}
              data-on={active || undefined}
              disabled={props.disabled}
              onClick={() => choose(item.value)}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    );
  },
});
