import { defineComponent, h, type Component, type PropType } from "vue";

import HkGaugeRing from "./HkGaugeRing";
import HkProgressBar from "./HkProgressBar";
import "./HkStatCard.scss";

export type StatTone = "success" | "warning" | "error" | "info" | "primary" | "muted";

/**
 * The standard KPI-cell shapes. Every variant shares the card surface
 * (border, radius, background) and the tone palette; they differ only in
 * how the number is presented:
 *
 * - `plain` — text-forward: label row with a tone dot, big value, optional
 *   hint (the original anatomy, still the default).
 * - `chip`  — horizontal: a tone-tinted icon chip beside value + label,
 *   with an optional trailing `aside` slot (tier badge, delta, …).
 *   Every variant also takes a `footer` slot — a free-form content row
 *   under the value/hint for badge rows and deltas.
 * - `ring`  — a single utilization ring with the value inside, the label
 *   (with the icon) underneath, and the hint as the detail line.
 * - `bar`   — label + value on one row over a tone-colored progress bar,
 *   with the hint as the detail line.
 */
export type StatVariant = "plain" | "chip" | "ring" | "bar";

/**
 * Tone → theme-variable CSS color (the exact palette the card paints
 * itself with). Exported so hosts can match sibling chrome — badge
 * variants, inline rings, legend dots — to the card's tone without
 * re-declaring the mapping (and drifting from it).
 */
export function statToneColor(tone: StatTone): string {
  switch (tone) {
    case "success":
      return "rgb(var(--color-success))";
    case "warning":
      return "rgb(var(--color-warning))";
    case "error":
      return "rgb(var(--color-error))";
    case "info":
      return "rgb(var(--color-info, rgb(var(--color-primary))))";
    case "primary":
      return "rgb(var(--color-primary))";
    case "muted":
      return "rgb(var(--color-muted))";
  }
}

const clampPct = (pct: number | undefined): number =>
  pct == null ? 0 : Math.min(100, Math.max(0, pct));

/**
 * HkStatCard — one KPI cell for the admin stat grids.
 *
 * Anatomy (plain, the default): label + value + optional hint, with a
 * tone dot carrying the health semantics (the text hue never changes —
 * tone is expressed by the dot alone, matching the interaction-state
 * precedence rules).
 *
 * ```tsx
 * <HkStatCard label="Hub health" value="2/2" tone="success" hint="entelecheia / arona" />
 * <HkStatCard variant="chip" icon={Cpu} tone="info" label="Running" value={3} />
 * <HkStatCard variant="ring" tone="success" pct={37.5} value="38%" unit="cores"
 *             icon={Cpu} label="Cores" hint="12 / 32 · monthly" />
 * <HkStatCard variant="bar" tone="warning" pct={72} label="Storage" value="72%" hint="47 / 65 GB" />
 * ```
 */
export const HkStatCard = defineComponent({
  name: "HkStatCard",
  props: {
    variant: { type: String as PropType<StatVariant>, default: "plain" },
    label: { type: String, required: true },
    value: { type: [String, Number], required: true },
    tone: { type: String as PropType<StatTone>, default: "muted" },
    hint: { type: String, default: undefined },
    /** Whole-card click (drill-through to the owning page). */
    clickable: { type: Boolean, default: false },
    /** chip/ring: leading icon component (lucide-vue-next style). */
    icon: { type: [Object, Function] as PropType<Component>, default: undefined },
    /** ring/bar: gauge percentage, clamped to 0–100. */
    pct: { type: Number, default: undefined },
    /** ring: sub-label rendered inside the ring under the value (the unit). */
    unit: { type: String, default: undefined },
  },
  emits: { click: (_e: MouseEvent | KeyboardEvent) => true },
  setup(props, { emit, slots }) {
    return () => {
      const shared = {
        class: [
          "hk-stat-card",
          `hk-stat-card-${props.variant}`,
          props.clickable && "hk-stat-card-clickable",
        ],
        role: props.clickable ? "button" : undefined,
        tabindex: props.clickable ? 0 : undefined,
        onClick: props.clickable ? (e: MouseEvent) => emit("click", e) : undefined,
        // role="button" promises keyboard activation (Enter/Space) — the
        // same contract HkContextRing's clickable ring honors. Key events
        // bubbling from a focusable INSIDE the card (an aside button) are
        // left alone so they don't double-fire the card's click.
        onKeydown: props.clickable
          ? (e: KeyboardEvent) => {
              if (e.target !== e.currentTarget) return;
              if (e.key !== "Enter" && e.key !== " ") return;
              e.preventDefault();
              emit("click", e);
            }
          : undefined,
      };

      if (props.variant === "chip") {
        return (
          <div {...shared}>
            <div class="hk-stat-card-chip-body">
              {props.icon && (
                <span
                  class={`hk-stat-card-chip-icon hk-stat-card-chip-icon-${props.tone}`}
                  aria-hidden="true"
                >
                  {h(props.icon, { size: 16 })}
                </span>
              )}
              <div class="hk-stat-card-chip-main">
                <div class="hk-stat-card-chip-value">{props.value}</div>
                <div class="hk-stat-card-chip-label">{props.label}</div>
              </div>
              {slots.aside && <div class="hk-stat-card-aside">{slots.aside()}</div>}
            </div>
            {props.hint && <div class="hk-stat-card-hint">{props.hint}</div>}
            {slots.footer && <div class="hk-stat-card-footer">{slots.footer()}</div>}
          </div>
        );
      }

      if (props.variant === "ring") {
        return (
          <div {...shared}>
            <HkGaugeRing
              size={104}
              strokeWidth={7}
              gap={4}
              animate={false}
              rings={[
                {
                  pct: clampPct(props.pct),
                  color: statToneColor(props.tone),
                  trackColor: "rgb(var(--color-text) / 8%)",
                },
              ]}
              centerValue={String(props.value)}
              centerLabel={props.unit ?? ""}
            />
            <div class="hk-stat-card-ring-label">
              {props.icon && h(props.icon, { size: 13, "aria-hidden": true })}
              <span class="hk-stat-card-ring-label-text">{props.label}</span>
            </div>
            {props.hint && (
              <div class="hk-stat-card-hint hk-stat-card-ring-detail" title={props.hint}>
                {props.hint}
              </div>
            )}
            {slots.footer && <div class="hk-stat-card-footer">{slots.footer()}</div>}
          </div>
        );
      }

      if (props.variant === "bar") {
        return (
          <div {...shared}>
            <div class="hk-stat-card-bar-head">
              <span class="hk-stat-card-label">{props.label}</span>
              <span class="hk-stat-card-bar-value">{props.value}</span>
            </div>
            <HkProgressBar
              max={100}
              size="xs"
              segments={[{ value: clampPct(props.pct), color: statToneColor(props.tone) }]}
            />
            {props.hint && (
              <div class="hk-stat-card-hint hk-stat-card-bar-detail" title={props.hint}>
                {props.hint}
              </div>
            )}
            {slots.footer && <div class="hk-stat-card-footer">{slots.footer()}</div>}
          </div>
        );
      }

      // plain — the original anatomy, unchanged.
      return (
        <div {...shared}>
          <div class="hk-stat-card-head">
            <span class="hk-stat-card-label">{props.label}</span>
            <span class={`hk-stat-card-dot hk-stat-card-dot-${props.tone}`} aria-hidden="true" />
          </div>
          <div class="hk-stat-card-value">{props.value}</div>
          {props.hint && <div class="hk-stat-card-hint" title={props.hint}>{props.hint}</div>}
          {slots.footer && <div class="hk-stat-card-footer">{slots.footer()}</div>}
        </div>
      );
    };
  },
});
