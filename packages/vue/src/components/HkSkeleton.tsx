import { defineComponent, type PropType } from "vue";
import "./HkSkeleton.scss";

export type SkeletonTone = "primary" | "muted";

export default defineComponent({
  name: "HkSkeleton",
  props: {
    width: { type: String, default: "100%" },
    height: { type: String, default: "16px" },
    radius: { type: String, default: "var(--hk-radius-sm, 4px)" },
    animated: { type: Boolean, default: true },
    tone: { type: String as PropType<SkeletonTone>, default: "primary" },
  },
  setup(props) {
    return () => (
      <div
        class="hk-skeleton"
        data-tone={props.tone}
        data-animated={props.animated || undefined}
        style={{
          width: props.width,
          height: props.height,
          borderRadius: props.radius,
        }}
        aria-hidden="true"
      />
    );
  },
});
