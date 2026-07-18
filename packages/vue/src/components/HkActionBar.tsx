import { defineComponent, type PropType } from "vue";

export default defineComponent({
  name: "HkActionBar",
  props: {
    gap: { type: String, default: "0.5rem" },
  },
  setup(props, { slots }) {
    return () => (
      <div class="hi-action-bar" style={{ gap: props.gap }}>
        {slots.default?.()}
      </div>
    );
  },
});
