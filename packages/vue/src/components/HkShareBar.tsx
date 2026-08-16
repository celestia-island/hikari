import { defineComponent, type PropType } from "vue";

import "./HkShareBar.scss";

/**
 * HkShareBar — a horizontal share/proportion bar (label + bar + value).
 * Used in usage tables (share of total tokens), quota panels, and any
 * "X of Y" breakdown row.
 *
 * ```tsx
 * <HShareBar label="glm-5.2" value={8_231} total={20_000} caption="41%" />
 * ```
 */
export const HkShareBar = defineComponent({
  name: "HkShareBar",
  props: {
    label: { type: String, required: true },
    value: { type: Number, required: true },
    total: { type: Number, required: true },
    /** Pre-formatted value text (defaults to the raw number). */
    caption: { type: String, default: undefined },
    /** 0–100 override for the bar width; defaults to value/total. */
    percentOverride: { type: Number, default: undefined },
    /** Bar fill color (any CSS color); defaults to primary. */
    color: { type: String, default: undefined },
  },
  setup(props) {
    return () => {
      const pct = props.percentOverride ?? (props.total > 0 ? (props.value / props.total) * 100 : 0);
      const clamped = Math.max(0, Math.min(100, pct));
      return (
        <div class="hk-share-bar" role="img" aria-label={`${props.label}: ${clamped.toFixed(1)}%`}>
          <span class="hk-share-bar-label" title={props.label}>{props.label}</span>
          <span class="hk-share-bar-track">
            <span
              class="hk-share-bar-fill"
              style={{
                width: `${clamped}%`,
                ...(props.color ? { background: props.color } : {}),
              }}
            />
          </span>
          <span class="hk-share-bar-caption">
            {props.caption ?? props.value.toLocaleString()}
          </span>
        </div>
      );
    };
  },
});
