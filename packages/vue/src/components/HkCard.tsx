import { computed, defineComponent, type PropType } from "vue";
import "../../../components/src/styles/components/card.scss";
import "../../../components/src/styles/components/card-vars.scss";

export default defineComponent({
  name: "HkCard",
  props: {
    padding: { type: String as PropType<"none" | "sm" | "md" | "lg">, default: "md" },
    hoverable: { type: Boolean, default: false },
  },
  setup(props, { slots }) {
    const cls = computed(() => [
      "hikari-card",
      `hikari-card--${props.padding}`,
      props.hoverable ? "hikari-card--hoverable" : "",
    ]);

    return () => (
      <div class={cls.value}>
        {slots.default?.()}
      </div>
    );
  },
});
