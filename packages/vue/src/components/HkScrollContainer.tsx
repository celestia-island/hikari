import { defineComponent, type PropType } from "vue";

export default defineComponent({
  name: "HkScrollContainer",
  props: {
    maxHeight: { type: String, default: "100%" },
    scrollbar: { type: Boolean, default: true },
  },
  setup(props, { slots }) {
    return () => (
      <div class="hi-scroll-container" style={{ maxHeight: props.maxHeight, overflow: "auto" }}>
        {slots.default?.()}
      </div>
    );
  },
});
