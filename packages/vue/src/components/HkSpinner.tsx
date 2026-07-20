import { computed, defineComponent, type PropType } from "vue";
import "./HkSpinner.scss";

export type SpinnerSize = "xs" | "sm" | "md" | "lg" | "xl";

export default defineComponent({
  name: "HkSpinner",
  props: {
    size: {
      type: [String, Number] as PropType<SpinnerSize | number>,
      default: "md",
    },
    text: { type: String, default: undefined },
    center: { type: Boolean, default: false },
    tone: { type: String as PropType<"primary" | "current">, default: "primary" },
  },
  setup(props) {
    const sizeClass = computed(() =>
      typeof props.size === "string" ? `hk-spinner-${props.size}` : "",
    );
    const sizeStyle = computed(() =>
      typeof props.size === "number"
        ? { width: `${props.size}px`, height: `${props.size}px` }
        : null,
    );

    return () => (
      <div class={["hk-spinner-wrapper", props.center && "hk-spinner-centered"]}>
        <div
          class={[
            "hk-spinner",
            sizeClass.value,
            props.tone === "current" && "hk-spinner-current",
          ]}
          style={sizeStyle.value ?? undefined}
        />
        {props.text ? <span class="hk-spinner-text">{props.text}</span> : null}
      </div>
    );
  },
});
