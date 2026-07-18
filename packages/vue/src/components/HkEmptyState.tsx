import { defineComponent, type PropType } from "vue";

export default defineComponent({
  name: "HkEmptyState",
  props: {
    title: { type: String },
    description: { type: String },
  },
  setup(props, { slots }) {
    return () => (
      <div class="hi-empty-state">
        {slots.icon && (
          <div class="hi-empty-state-icon">
            {slots.icon()}
          </div>
        )}
        {props.title && <h4 class="hi-empty-state-title">{props.title}</h4>}
        {props.description && <p class="hi-empty-state-description">{props.description}</p>}
        {slots.action && (
          <div class="hi-empty-state-action">
            {slots.action()}
          </div>
        )}
        {slots.default?.()}
      </div>
    );
  },
});
