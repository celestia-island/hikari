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
      const cls = buildClass(props, ["hk-nav-item--link"]);

      if (props.to) {
        return (
          <RouterLink
            to={props.to}
            class={buildClass(props, ["hk-nav-item-link"])}
            {...dataAttrs.value}
            aria-disabled={props.disabled}
            aria-current={props.active ? "page" : undefined}
            onClick={onClick}
          >
            {({ navigate, isActive, isExactActive }: any) => {
              const active = isActive || isExactActive || props.active;
              const cls = buildClass({ active, disabled: props.disabled }, ["hk-nav-item-link"]);
              return (
                <a
                  href={props.to}
                  class={cls}
                  data-active={active ? "" : undefined}
                  data-disabled={props.disabled ? "" : undefined}
                  aria-disabled={props.disabled}
                  aria-current={active ? "page" : undefined}
                  onClick={(e: MouseEvent) => {
                    if (props.disabled) {
                      e.preventDefault();
                      return;
                    }
                    navigate(e);
                    emit("click", e);
                  }}
                >
                  {content()}
                </a>
              );
            }}
          </RouterLink>
        );
      }

      if (props.href) {
        return (
          <a
            href={props.href}
            class={buildClass(props, ["hk-nav-item-link"])}
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
