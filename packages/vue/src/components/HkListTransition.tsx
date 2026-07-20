import { defineComponent, TransitionGroup, type PropType } from "vue";

import "./HkListTransition.scss";

type ListAnimVariant = "pop" | "slide" | "fade" | "grow" | "reveal";

export default defineComponent({
  name: "HkListTransition",
  props: {
    tag: { type: String, default: "div" },
    variant: { type: String as PropType<ListAnimVariant>, default: "pop" },
    move: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
  },
  setup(props, { slots }) {
    return () => {
      const name = props.disabled ? "hk-list-none" : `hk-list-${props.variant}`;
      return (
        <TransitionGroup
          tag={props.tag}
          name={name}
          moveClass={props.move ? undefined : "hk-list-move-disabled"}
        >
          {slots.default?.()}
        </TransitionGroup>
      );
    };
  },
});
