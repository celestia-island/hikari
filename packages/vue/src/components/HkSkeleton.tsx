import { computed, defineComponent, type PropType } from "vue";
import "../../../components/src/styles/components/skeleton.scss";

export default defineComponent({
  name: "HkSkeleton",
  props: {
    width: { type: String, default: "100%" },
    height: { type: String, default: "16px" },
    shape: { type: String as PropType<"rect" | "circle">, default: "rect" },
    active: { type: Boolean, default: true },
  },
  setup(props) {
    const cls = computed(() => [
      "hi-skeleton",
      `hi-skeleton-${props.shape}`,
      props.active ? "hi-skeleton-active" : "",
    ]);

    return () => (
      <div class={cls.value} style={{ width: props.width, height: props.height }} />
    );
  },
});
