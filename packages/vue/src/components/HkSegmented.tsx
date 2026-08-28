import { computed, defineComponent, ref, type PropType } from "vue";

import { useMeasuredHighlight } from "../composables/useMeasuredHighlight";
import "./HkSegmented.scss";

/** One segment of an [HkSegmented] group. */
export interface HkSegmentedOption {
  value: string;
  label: string;
  /** Optional icon rendered before the label. */
  icon?: unknown;
  /** Disables just this segment. */
  disabled?: boolean;
}

/**
 * HkSegmented — a compact segmented control (button group) for switching
 * between a small set of mutually exclusive modes. The desktop/tablet form
 * is the classic joined pill track; ≤ the mobile breakpoint it widens to
 * full-bleed tappable segments (larger hit areas), so touch users are not
 * left with sub-target tap zones.
 *
 * Semantics: this is a *mode picker*, not navigation (use HkTabs for nav)
 * and not a long option list (use HkPopupSelect / HkSelect).
 */
export default defineComponent({
  name: "HkSegmented",
  props: {
    /** Currently selected value (v-model). */
    modelValue: { type: String, default: "" },
    options: {
      type: Array as PropType<HkSegmentedOption[]>,
      required: true,
    },
    /** Disable the whole group. */
    disabled: { type: Boolean, default: false },
    /** Visual size — sm matches form-control heights. */
    size: {
      type: String as PropType<"sm" | "md">,
      default: "md",
    },
    /** Grow to fill the container width (segments share it equally). */
    block: { type: Boolean, default: false },
    /** Override the viewport breakpoint (default 768px) under which the
     *  touch-optimized full-bleed form renders. */
    mobileBreakpoint: { type: Number, default: 768 },
  },
  emits: {
    "update:modelValue": (_value: string) => true,
  },
  setup(props, { emit }) {
    const rootRef = ref<HTMLElement | null>(null);
    // -1 (no match, e.g. the default "") clears the thumb instead of
    // pointing it at the first segment — mirrors aria-checked all-false.
    const activeIndex = computed(() =>
      props.options.findIndex((o) => o.value === props.modelValue),
    );
    // Sliding thumb geometry from real measurements — options of unequal
    // label width would drift percentage math. Until a non-zero width is
    // measured (jsdom/SSR never get there) the per-segment checked styling
    // below remains as the fallback.
    const { x, width, ready } = useMeasuredHighlight({
      container: rootRef,
      activeIndex,
      itemSelector: ".hk-segmented__segment",
      extraSources: [() => props.options],
    });
    const thumbStyle = computed(() => ({
      transform: `translateX(${x.value}px)`,
      width: `${width.value}px`,
    }));

    function select(v: string) {
      if (props.disabled) return;
      const opt = props.options.find((o) => o.value === v);
      if (opt?.disabled) return;
      if (v === props.modelValue) return;
      emit("update:modelValue", v);
    }

    return () => (
      <div
        class="hk-segmented"
        ref={rootRef}
        data-size={props.size}
        data-block={props.block || undefined}
        data-disabled={props.disabled || undefined}
        data-ready={ready.value ? "true" : undefined}
        role="radiogroup"
      >
        <span class="hk-segmented__thumb" aria-hidden="true" style={thumbStyle.value} />
        {props.options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            class="hk-segmented__segment"
            role="radio"
            aria-checked={opt.value === props.modelValue}
            data-checked={opt.value === props.modelValue || undefined}
            data-disabled={props.disabled || opt.disabled || undefined}
            disabled={props.disabled || opt.disabled}
            onClick={() => select(opt.value)}
          >
            {opt.icon != null && <span class="hk-segmented__icon">{opt.icon as any}</span>}
            <span class="hk-segmented__label">{opt.label}</span>
          </button>
        ))}
      </div>
    );
  },
});
