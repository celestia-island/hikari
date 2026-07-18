import { computed, defineComponent, type PropType } from "vue";
import "../../../components/src/styles/components/divider.scss";

export default defineComponent({
  name: "HkDivider",
  props: {
    orientation: { type: String as PropType<"horizontal" | "vertical">, default: "horizontal" },
    text: { type: String },
    spacing: { type: String },
  },
  setup(props) {
    const cls = computed(() => [
      "hi-divider",
      `hi-divider-${props.orientation}`,
      props.text ? "hi-divider-with-text" : "",
    ]);

    return () => (
      <div class={cls.value} style={{ margin: props.spacing }}>
        <span class="hi-divider-line" />
        {props.text && <span class="hi-divider-text">{props.text}</span>}
        {props.text && <span class="hi-divider-line" />}
      </div>
    );
  },
});
