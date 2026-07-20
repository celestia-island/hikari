import { computed, defineComponent, type CSSProperties, type PropType } from "vue";
import "./HkBadge.scss";

export type BadgeVariant =
  | "default"
  | "primary"
  | "success"
  | "error"
  | "warning"
  | "info"
  | "muted";

export default defineComponent({
  name: "HkBadge",
  props: {
    variant: { type: String as PropType<BadgeVariant>, default: "default" },
    dot: { type: Boolean, default: false },
    size: { type: String as PropType<"sm" | "md">, default: "md" },
    mono: { type: Boolean, default: false },
    uppercase: { type: Boolean, default: false },
    pill: { type: Boolean, default: true },
    color: { type: String, default: undefined },
    bgColor: { type: String, default: undefined },
    borderColor: { type: String, default: undefined },
  },
  setup(props, { slots }) {
    const style = computed<CSSProperties>(() => {
      const s: Record<string, string> = {};
      if (props.color) s["--hk-badge-text"] = props.color;
      if (props.bgColor) s["--hk-badge-bg"] = props.bgColor;
      if (props.borderColor) s["--hk-badge-border"] = props.borderColor;
      return s as CSSProperties;
    });

    return () => (
      <span
        class={["hk-badge", `hk-badge-${props.variant}`]}
        data-size={props.size}
        data-pill={props.pill ? undefined : "false"}
        data-mono={props.mono ? "" : undefined}
        data-uppercase={props.uppercase ? "" : undefined}
        data-dot-only={(props.dot && !slots.default) || undefined}
        style={Object.keys(style.value).length ? style.value : undefined}
      >
        {props.dot ? <span data-el="dot" /> : null}
        {slots.default?.()}
      </span>
    );
  },
});
