import { defineComponent, computed, ref, type PropType } from "vue";
import type { Component } from "vue";
import { ChevronRight } from "lucide-vue-next";
import "./HkNavItem.scss";

interface NavItemChild {
  id: string;
  label: string;
  icon?: Component;
  active?: boolean;
  badge?: string;
}

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
    children: { type: Array as PropType<NavItemChild[]>, default: undefined },
  },
  emits: {
    click: (_e: MouseEvent) => true,
  },
  setup(props, { slots, emit }) {
    const expanded = ref(false);

    function toggle() {
      expanded.value = !expanded.value;
    }

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

    const arrow = () => (
      <ChevronRight
        size={16}
        class={["hk-nav-item-arrow", expanded.value ? "hk-nav-item-arrow-expanded" : ""]}
      />
    );

    const childItems = () => {
      if (!props.children) return null;
      return (
        <div class="hk-nav-item-children">
          {props.children.map((child) => (
            <a
              key={child.id}
              href={`#${child.id}`}
              class={[
                "hk-nav-item",
                "hk-nav-item-link",
                child.active ? "hk-nav-item-active" : "",
              ]}
              data-active={child.active ? "" : undefined}
            >
              {child.icon ? <span class="hk-nav-item-icon">{child.icon}</span> : null}
              <span class="hk-nav-item-label">{child.label}</span>
              {child.badge ? <span class="hk-nav-item-badge">{child.badge}</span> : null}
            </a>
          ))}
        </div>
      );
    };

    return () => {
      if (props.children) {
        const cls = buildClass(props, ["hk-nav-item-button"]);
        return (
          <div>
            <button
              type="button"
              class={cls}
              {...dataAttrs.value}
              disabled={props.disabled}
              onClick={toggle}
            >
              {content()}
              {arrow()}
            </button>
            {expanded.value ? childItems() : null}
          </div>
        );
      }

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
