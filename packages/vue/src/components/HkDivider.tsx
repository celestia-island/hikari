import { defineComponent, type PropType } from "vue";

import "./HkDivider.scss";

type DividerOrientation = "horizontal" | "vertical";
type DividerTone = "faint" | "subtle" | "input";
type DividerVariant = "solid" | "dashed";
type DividerSpacing = "none" | "xs" | "sm" | "md" | "lg" | "xl";
type DividerLength = "stretch" | "xs" | "sm" | "md" | "lg" | "xl";

export default defineComponent({
  name: "HkDivider",
  props: {
    orientation: {
      type: String as PropType<DividerOrientation>,
      default: "horizontal",
    },
    tone: {
      type: String as PropType<DividerTone>,
      default: "subtle",
    },
    variant: {
      type: String as PropType<DividerVariant>,
      default: "solid",
    },
    spacing: {
      type: String as PropType<DividerSpacing>,
      default: "none",
    },
    length: {
      type: String as PropType<DividerLength>,
      default: "stretch",
    },
  },
  setup(props) {
    return () => (
      <div
        class={[
          "hk-divider",
          props.orientation === "vertical" && "hk-divider-vertical",
          props.variant === "dashed" && "hk-divider-dashed",
          props.tone === "faint" && "hk-divider-faint",
          props.tone === "input" && "hk-divider-input",
          props.spacing !== "none" && `hk-divider-spacing-${props.spacing}`,
          props.length !== "stretch" && `hk-divider-length-${props.length}`,
        ]}
        aria-hidden="true"
      />
    );
  },
});
