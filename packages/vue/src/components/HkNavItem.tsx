import { defineComponent, type PropType } from "vue";
import { RouterLink } from "vue-router";
import HkIcon from "./HkIcon";
import "./HkNavItem.scss";

export default defineComponent({
  name: "HkNavItem",
  props: {
    to: { type: String, default: undefined },
    href: { type: String, default: undefined },
    icon: { type: String as PropType<string | undefined>, default: undefined },
    active: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
  },
  setup(props, { slots }) {
    return () => {
      const content = (
        <>
          {props.icon ? <HkIcon name={props.icon} size={18} /> : null}
          {slots.default?.()}
        </>
      );

      const cls = [
        "hk-nav-item",
        props.active ? "hk-nav-item--active" : "",
        props.disabled ? "hk-nav-item--disabled" : "",
      ].join(" ");

      if (props.to) {
        return (
          <RouterLink to={props.to} class={cls}>
            {content}
          </RouterLink>
        );
      }

      return (
        <a href={props.href ?? "#"} class={cls}>
          {content}
        </a>
      );
    };
  },
});
