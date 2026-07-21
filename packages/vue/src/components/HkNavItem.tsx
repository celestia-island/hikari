import { defineComponent, computed } from "vue";
import "./HkNavItem.scss";

function buildClass(props: { active: boolean; disabled: boolean }, extra: string[] = []) {
  return [
    "hk-nav-item",
    ...extra,
    props.active ? "hk-nav-item-active" : "",
    props.disabled ? "hk-nav-item-disabled" : "",
  ];
}

export default defineComponent({
  name: "HkNavItem",
  props: {
    active: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    to: { type: String, default: undefined },
    href: { type: String, default: undefined },
  },
  emits: {
    click: (_e: MouseEvent) => true,
  },
  setup(props, { slots, emit }) {
    const content = () => (
      <>
        {slots.icon ? <span class="hk-nav-item-icon">{slots.icon()}</span> : null}
        {slots.default ? <span class="hk-nav-item-label">{slots.default()}</span> : null}
      </>
    );

    const dataAttrs = computed(() => ({
      "data-active": props.active ? "" : undefined,
      "data-disabled": props.disabled ? "" : undefined,
    }));

    function onClick(e: MouseEvent) {
      if (props.disabled) {
        e.preventDefault();
        return;
      }
      emit("click", e);
    }

    return () => {
      const cls = buildClass(props, ["hk-nav-item-link"]);

      if (props.to) {
        return (
          <a
            href={props.to}
            class={cls}
            {...dataAttrs.value}
            aria-disabled={props.disabled}
            aria-current={props.active ? "page" : undefined}
            onClick={onClick}
          >
            {content()}
          </a>
        );
      }

      if (props.href) {
        return (
          <a
            href={props.href}
            class={cls}
            {...dataAttrs.value}
            aria-disabled={props.disabled}
            onClick={onClick}
          >
            {content()}
          </a>
        );
      }

      return (
        <button
          type="button"
          class={buildClass(props, ["hk-nav-item-button"])}
          {...dataAttrs.value}
          disabled={props.disabled}
          onClick={(e: MouseEvent) => emit("click", e)}
        >
          {content()}
        </button>
      );
    };
  },
});
