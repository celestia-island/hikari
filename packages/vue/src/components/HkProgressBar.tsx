import { computed, defineComponent, type PropType } from "vue";

import "./HkProgressBar.scss";

type ProgressBarStatus = "loading" | "done" | "error";

/**
 * One block of a segmented progress bar. `value` is a percentage (0-100);
 * blocks are laid left-to-right in order and their values must not sum
 * past 100.
 */
export interface HProgressBarSegment {
  value: number;
  /**
   * Any CSS color — including modern `rgb(var(--x) / a)` space-syntax
   * colors. Omit to fall back to the theme primary background.
   */
  color?: string;
  /** Extra class appended to this block. */
  class?: string;
}

export default defineComponent({
  name: "HkProgressBar",
  props: {
    value: { type: Number, default: null },
    secondary: { type: Number, default: null },
    max: { type: Number, default: 100 },
    status: { type: String as PropType<ProgressBarStatus>, default: "loading" },
    size: { type: String as PropType<"xs" | "sm" | "md">, default: "sm" },
    showLabel: { type: Boolean, default: false },
    label: { type: String, default: undefined },
    /**
     * Segmented mode: when set (an empty array included) the track renders
     * one block per segment instead of the `value`/`secondary` fills. Each
     * segment's width is its percentage; `status` is ignored while
     * segments are present.
     */
    segments: { type: Array as PropType<HProgressBarSegment[]>, default: undefined },
  },
  setup(props) {
    const segmented = computed(() => props.segments != null);

    const pct = computed(() => {
      if (props.value == null) return null;
      return Math.min(100, Math.max(0, (props.value / props.max) * 100));
    });

    const secondaryPct = computed(() => {
      if (props.secondary == null) return null;
      return Math.min(100, Math.max(0, (props.secondary / props.max) * 100));
    });

    const displayLabel = computed(() => {
      if (props.label) return props.label;
      // Segmented mode has no single value to render — only an explicit
      // caller label makes sense there.
      if (segmented.value) return "";
      if (pct.value == null) return "";
      return `${Math.round(pct.value)}%`;
    });

    const segWidth = (value: number) => `${Math.min(100, Math.max(0, value))}%`;

    return () => (
      <div class="hk-progress-bar" data-size={props.size}>
        {props.showLabel && (
          <span class="hk-progress-bar-label">{displayLabel.value}</span>
        )}
        <div
          class={[
            "hk-progress-bar-track",
            segmented.value ? "hk-progress-bar-track--segments" : "",
          ]}
        >
          {segmented.value ? (
            (props.segments ?? []).map((s, i) => (
              <div
                key={i}
                class={["hk-progress-bar-seg", s.class]}
                style={{
                  width: segWidth(s.value),
                  ...(s.color ? { background: s.color } : {}),
                }}
              />
            ))
          ) : (
            pct.value != null ? (
              <>
                {secondaryPct.value != null && (
                  <div
                    class={["hk-progress-bar-secondary", `hk-progress-bar-secondary-${props.status}`]}
                    style={{ width: `${secondaryPct.value}%` }}
                  />
                )}
                <div
                  class={["hk-progress-bar-fill", `hk-progress-bar-fill-${props.status}`]}
                  style={{ width: `${pct.value}%` }}
                />
              </>
            ) : (
              <div class={["hk-progress-bar-indeterminate", `hk-progress-bar-indeterminate-${props.status}`]} />
            )
          )}
        </div>
      </div>
    );
  },
});
