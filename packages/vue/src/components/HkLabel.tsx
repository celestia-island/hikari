import { defineComponent, type PropType } from "vue";

import "./HkLabel.scss";

/**
 * HkLabel — the unified label/text shell for every control that shows a
 * label position (checkbox, radio, switch, …).
 *
 * Plain text goes through the `text` prop and is rendered as plain text
 * inside the label shell. Rich content (clickable links inside an agreement
 * line, icons, mixed emphasis, …) goes through the default slot — the shell
 * and its typography stay identical either way, so a plain "Remember login"
 * and an agreement line with a clickable link read with the same font.
 *
 * ```tsx
 * <HkLabel text="Remember login" />
 * <HkLabel size="sm">
 *   I have read and agree to the{" "}
 *   <a onClick={openProtocol}>User Agreement</a>
 * </HkLabel>
 * ```
 */
export default defineComponent({
  name: "HkLabel",
  props: {
    /** Plain-text label; rendered as-is (escaped) inside the label shell. */
    text: { type: String, default: undefined },
    size: {
      type: String as PropType<"sm" | "md" | "lg">,
      default: "md",
    },
  },
  setup(props, { slots }) {
    return () => {
      const hasText = !!props.text;
      const hasSlot = !!slots.default;
      if (!hasText && !hasSlot) return null;
      return (
        <span class={["hk-label", `hk-label-${props.size}`]}>
          {hasSlot ? slots.default!() : props.text}
        </span>
      );
    };
  },
});
