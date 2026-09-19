import { computed, defineComponent, type PropType } from "vue";
import HkTooltip from "./HkTooltip";
import type { TooltipPlacement } from "../runtime/tooltipPosition";
import "./HkIconButtonGroup.scss";

/** One selectable icon in the group. */
export interface HkIconButtonGroupOption {
  /** Stable identity — the value surfaced through v-model / select. */
  key: string;
  /** Accessible name AND the default tooltip text. Required on purpose:
   *  an icon-only control without a label is an a11y hole. */
  label: string;
  /** Icon-only content: a prebuilt vnode (brand SVG, lucide component,
   *  <img>) or anything renderable. Typed loose on purpose (same as
   *  HkAuthMethodList entries): hosts materialize hikari against their
   *  own vue minor, and a hard VNode type breaks typecheck whenever the
   *  host's vue differs. Missing icons fall back to the label's initial. */
  icon?: unknown;
  disabled?: boolean;
  /** Status dot pinned to the item's bottom-right corner. `"success"`
   *  draws a small green dot (step-proven factor, completed requirement);
   *  the dot is decorative — pair it with `disabled` and an updated
   *  tooltip when it means "this one is done". */
  marker?: "success";
  /** Tooltip text override; an EMPTY string suppresses the tooltip. */
  tooltip?: string;
}

/**
 * HkIconButtonGroup — the icon-only variant of the button-group family
 * (the same centered strip grammar as HkTabs, minus the text).
 *
 * The group has exactly TWO fundamental jobs (2026-09-14 user direction
 * — a group is a semantic component, not a generic box to throw buttons
 * into), carried by three working modes:
 *   - a SELECTOR: "single" (radiogroup: one active key via v-model,
 *     re-clicking the active key is a no-op — radio semantics) or
 *     "multiple" (toggle set: v-model is a string[] of active keys,
 *     every item carries aria-pressed)
 *   - a TIGHT ACTION STRIP: "buttons" (no selection state) — related
 *     actions packed shoulder-to-shoulder in ONE shared track, the
 *     toolbar grammar
 *
 * Anything else is NOT a group: independent actions that merely live on
 * the same row (e.g. a login card's third-party provider tiles) render
 * as separate framed buttons with comfortable spacing — see
 * HkAuthMethodList for the reference pattern.
 *
 * Every item is icon-only and rides one size taller than a standard
 * icon button (md = 44px vs the 32px icon button / 40px text button) —
 * the Windows/macOS-style login chooser. Because an icon alone is
 * unlabelable at a glance, each item wraps itself in an HkTooltip
 * (text = the option's label unless overridden), so the hover reveal is
 * built in rather than left to every consumer.
 *
 * Visual variants (`variant`, orthogonal to the semantic `mode` — the
 * 2026-09-17 user direction: a frame is not part of a group's meaning,
 * and hosts must be able to tune it):
 *  - "track" (default): the bordered inset strip — the HkTabs grammar
 *    this component shipped with;
 *  - "plain": no outer frame at all — independent icon buttons packed
 *    shoulder-to-shoulder, each tinting its own active state;
 *  - "slider": frameless and gapless with a sliding thumb pill behind
 *    the active item (single-selection mode; "multiple" falls back to
 *    per-item tints). The thumb rides a CSS-variable index
 *    (`--hk-icon-group-active-index`) times the item-size variable, so
 *    it stays correct when hosts retune the size.
 *
 * Known a11y limitation (documented 2026-09-13): single mode uses a
 * radiogroup role with every item tabbable, not the full WAI-APG roving
 * tabindex. All-items-tabbable keeps keyboard reachability identical
 * across the three modes; roving focus is a follow-up if a host needs
 * strict APG conformance.
 */
export default defineComponent({
  name: "HkIconButtonGroup",
  inheritAttrs: false,
  props: {
    options: { type: Array as unknown as () => HkIconButtonGroupOption[], required: true },
    /** Active key ("single") or keys ("multiple"); null when nothing is
     *  active — required/ignored by "buttons" mode. */
    modelValue: { type: [String, Array] as PropType<string | string[] | null>, default: null },
    mode: { type: String as PropType<"buttons" | "single" | "multiple">, default: "buttons" },
    /** Visual treatment of the strip — see the component doc. */
    variant: { type: String as PropType<"track" | "plain" | "slider">, default: "track" },
    size: { type: String as PropType<"sm" | "md" | "lg">, default: "md" },
    disabled: { type: Boolean, default: false },
    tooltipPlacement: { type: String as PropType<TooltipPlacement>, default: "top" },
    tooltipDelay: { type: Number, default: 300 },
  },
  emits: {
    /** v-model for "single" (string) and "multiple" (string[]). */
    "update:modelValue": (_value: string | string[]) => true,
    /** An item was activated (or toggled). Never fires for a no-op
     *  re-click of the already-active key in "single" mode. */
    select: (_key: string) => true,
  },
  setup(props, { emit, attrs }) {
    const cls = computed(() => [
      "hk-icon-group",
      `hk-icon-group-${props.mode}`,
      `hk-icon-group-${props.variant}`,
      `hk-icon-group-${props.size}`,
    ]);

    const groupRole = computed(() => (props.mode === "single" ? "radiogroup" : "group"));

    /** Index of the single active option, -1 when none — drives the
     *  slider thumb's CSS-variable position. */
    const activeIndex = computed(() =>
      props.options.findIndex((o) => isActive(o.key)),
    );

    /** The slider thumb exists only for a single-selection strip with an
     *  active key: "multiple" tints each item instead (one thumb cannot
     *  hop between simultaneous selections), "buttons" has no selection
     *  at all. */
    const showThumb = computed(
      () =>
        props.variant === "slider" &&
        props.mode === "single" &&
        activeIndex.value >= 0,
    );

    const thumbStyle = computed(() => ({
      // The transition lives in the stylesheet; the position is pure
      // arithmetic on the active index so a retuned item-size variable
      // keeps the thumb aligned without JS measurement.
      "--hk-icon-group-active-index": String(Math.max(activeIndex.value, 0)),
    }));

    function isActive(key: string): boolean {
      if (props.mode === "multiple") {
        return Array.isArray(props.modelValue) && props.modelValue.includes(key);
      }
      if (props.mode === "single") {
        return props.modelValue === key;
      }
      return false;
    }

    function onSelect(option: HkIconButtonGroupOption) {
      if (props.disabled || option.disabled) return;
      if (props.mode === "single") {
        if (isActive(option.key)) return; // radio semantics: no re-fire
        emit("update:modelValue", option.key);
      } else if (props.mode === "multiple") {
        const current = Array.isArray(props.modelValue) ? props.modelValue : [];
        const next = current.includes(option.key)
          ? current.filter((k) => k !== option.key)
          : [...current, option.key];
        emit("update:modelValue", next);
      }
      emit("select", option.key);
    }

    return () => (
      <div class={cls.value} role={groupRole.value} {...attrs}>
        {showThumb.value && (
          <span
            class="hk-icon-group-slider-thumb"
            aria-hidden="true"
            style={thumbStyle.value}
          />
        )}
        {props.options.map((option) => {
          const tooltip = option.tooltip !== undefined ? option.tooltip : option.label;
          const active = isActive(option.key);
          const button = (
            <button
              key={option.key}
              type="button"
              class="hk-icon-group-item"
              data-key={option.key}
              data-active={active || undefined}
              data-marker={option.marker || undefined}
              role={props.mode === "single" ? "radio" : undefined}
              aria-checked={props.mode === "single" ? active : undefined}
              aria-pressed={props.mode === "multiple" ? active : undefined}
              aria-label={option.label}
              title={undefined} // the HkTooltip popup owns the hover text
              disabled={props.disabled || option.disabled}
              onClick={() => onSelect(option)}
            >
              <span class="hk-icon-group-item-icon">
                {option.icon != null
                  ? option.icon
                  : (
                    <span class="hk-icon-group-item-initial" aria-hidden="true">
                      {option.label.charAt(0).toUpperCase()}
                    </span>
                  )}
              </span>
              {option.marker && (
                <span
                  class={`hk-icon-group-item-marker hk-icon-group-item-marker-${option.marker}`}
                  aria-hidden="true"
                />
              )}
            </button>
          );
          // An empty tooltip override suppresses the wrapper entirely.
          return tooltip
            ? (
              <HkTooltip
                key={option.key}
                text={tooltip}
                placement={props.tooltipPlacement}
                delay={props.tooltipDelay}
              >
                {button}
              </HkTooltip>
            )
            : button;
        })}
      </div>
    );
  },
});
