import { computed, defineComponent, useAttrs, type PropType } from "vue";

import "./HkButton.scss";
import HIcon from "./HkIcon";
import HKbd from "./HkKbd";
import HSpinner from "./HkSpinner";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "outline";
export type ButtonSize = "sm" | "md" | "lg";

export default defineComponent({
  name: "HkButton",
  inheritAttrs: false,
  props: {
    variant: { type: String as PropType<ButtonVariant>, default: "primary" },
    size: { type: String as PropType<ButtonSize>, default: "md" },
    loading: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    block: { type: Boolean, default: false },
    ariaLabel: { type: String, default: undefined },
    shortcut: { type: String, default: undefined },
    icon: { type: String, default: undefined },
    suffix: { type: String, default: undefined },
  },
  emits: {
    click: (_e: MouseEvent) => true,
  },
  setup(props, { emit, slots }) {
    const attrs = useAttrs();

    const buttonClass = computed(() => [
      "hk-btn",
      `hk-btn-${props.variant}`,
      `hk-btn-${props.size}`,
      props.block ? "hk-btn-block" : "",
      props.loading ? "hk-btn-loading" : "",
      props.shortcut ? "hk-btn-has-shortcut" : "",
    ]);

    return () => {
      // Icon-only contract (2026-09-10 user direction): a button carrying
      // just a prefix/suffix glyph and no text collapses to the same
      // square footprint the HIconButton family guarantees — a bare icon
      // in a padded text button reads as a squat rectangle otherwise.
      // Re-evaluated per render, NOT a computed: slots.default is not
      // reactive, so a cached flag would go stale when a parent toggles
      // the label slot without touching the icon props.
      const iconOnly = !slots.default && Boolean(props.icon || props.suffix);

      return (
        <button
          {...attrs}
          type={(attrs.type as "button" | "submit" | "reset") || "button"}
          disabled={props.disabled || props.loading}
          class={[buttonClass.value, iconOnly ? "hk-btn-icon-only" : "", attrs.class]}
          style={attrs.style || undefined}
          aria-label={props.ariaLabel}
          aria-busy={props.loading || undefined}
          onClick={(e) => emit("click", e)}
        >
          {props.loading ? <HSpinner size="xs" tone="current" /> : null}
          {!props.loading && props.icon ? (
            <span class="hk-btn-icon">
              <HIcon name={props.icon} size={16} />
            </span>
          ) : null}
          {slots.default?.()}
          {props.suffix ? (
            <span class="hk-btn-suffix">
              <HIcon name={props.suffix} size={16} />
            </span>
          ) : null}
          {props.shortcut ? (
            <HKbd keys={props.shortcut!} size="sm" />
          ) : null}
        </button>
      );
    };
  },
});
