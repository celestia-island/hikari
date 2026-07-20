import { computed, defineComponent, type PropType } from "vue";

import "./HkProgressBar.scss";

type ProgressBarStatus = "loading" | "done" | "error";

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
  },
  setup(props) {
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
      if (pct.value == null) return "";
      return `${Math.round(pct.value)}%`;
    });

    return () => (
      <div class="hk-progress-bar" data-size={props.size}>
        {props.showLabel && (
          <span class="hk-progress-bar-label">{displayLabel.value}</span>
        )}
        <div class="hk-progress-bar-track">
          {pct.value != null ? (
            <>
              {secondaryPct.value != null && (
                <div
                  class={["hk-progress-bar-secondary", `hk-progress-bar-secondary--${props.status}`]}
                  style={{ width: `${secondaryPct.value}%` }}
                />
              )}
              <div
                class={["hk-progress-bar-fill", `hk-progress-bar-fill--${props.status}`]}
                style={{ width: `${pct.value}%` }}
              />
            </>
          ) : (
            <div class={["hk-progress-bar-indeterminate", `hk-progress-bar-indeterminate--${props.status}`]} />
          )}
        </div>
      </div>
    );
  },
});
