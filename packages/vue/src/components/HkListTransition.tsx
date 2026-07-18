import { defineComponent, TransitionGroup, type PropType } from "vue";

export default defineComponent({
  name: "HkListTransition",
  props: {
    name: { type: String, default: "hi-list" },
    tag: { type: String, default: "div" },
  },
  setup(props, { slots }) {
    return () => (
      <TransitionGroup
        name={props.name}
        tag={props.tag}
        moveClass="hi-list-move"
        enterActiveClass="hi-list-enter-active"
        leaveActiveClass="hi-list-leave-active"
        enterFromClass="hi-list-enter-from"
        leaveToClass="hi-list-leave-to"
      >
        {slots.default?.()}
      </TransitionGroup>
    );
  },
});
