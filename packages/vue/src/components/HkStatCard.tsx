import { defineComponent, type PropType } from "vue";

import "./HkStatCard.scss";

export type StatTone = "success" | "warning" | "error" | "info" | "primary" | "muted";

/**
 * HkStatCard — one KPI cell for the admin stat grids.
 *
 * Anatomy: label + value + optional hint, with a tone dot carrying the
 * health semantics (the text hue never changes — tone is expressed by
 * the dot alone, matching the interaction-state precedence rules).
 *
 * ```tsx
 * <HStatCard label="Hub health" value="2/2" tone="success" hint="entelecheia / arona" />
 * ```
 */
export const HkStatCard = defineComponent({
  name: "HkStatCard",
  props: {
    label: { type: String, required: true },
    value: { type: [String, Number], required: true },
    tone: { type: String as PropType<StatTone>, default: "muted" },
    hint: { type: String, default: undefined },
    /** Whole-card click (drill-through to the owning page). */
    clickable: { type: Boolean, default: false },
  },
  emits: { click: (_e: MouseEvent) => true },
  setup(props, { emit }) {
    return () => (
      <div
        class={["hk-stat-card", props.clickable && "hk-stat-card-clickable"]}
        role={props.clickable ? "button" : undefined}
        tabindex={props.clickable ? 0 : undefined}
        onClick={props.clickable ? (e: MouseEvent) => emit("click", e) : undefined}
      >
        <div class="hk-stat-card-head">
          <span class="hk-stat-card-label">{props.label}</span>
          <span class={`hk-stat-card-dot hk-stat-card-dot-${props.tone}`} aria-hidden="true" />
        </div>
        <div class="hk-stat-card-value">{props.value}</div>
        {props.hint && <div class="hk-stat-card-hint" title={props.hint}>{props.hint}</div>}
      </div>
    );
  },
});
