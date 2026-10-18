import { defineComponent } from "vue";
import "./HkMenuActionItem.scss";

/**
 * Standard menu row: icon + label button speaking the unified menu-item
 * spec (metrics/icon cell/states — see _menu-item.scss). Pluggable —
 * renders as a bare button, so it works inside HkMenuPanel, a popover,
 * or any other menu host; attrs (including a template `ref`) fall
 * through to the button element.
 */
export default defineComponent({
  name: "HkMenuActionItem",
  props: {
    /** Leading icon node (e.g. `<Camera size={14} />`). Rendered inside
     * the spec's fixed icon cell, so any size centers uniformly. Typed
     * loosely (plain Object) so consumers building on a different vue
     * copy than hikari's own node_modules never hit VNode type identity
     * errors. */
    icon: { type: Object, default: undefined },
    label: { type: String, required: true },
    /** Destructive styling (logout, delete…). */
    danger: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    /** Selected/current row — the unified menu-item grammar's [data-active]
     *  face (primary wash + strong border + primary text; see
     *  _menu-item.scss). For lists that mark "you are here", e.g. the
     *  modal-breadcrumb layer picker highlighting the current layer. */
    active: { type: Boolean, default: false },
  },
  emits: {
    click: (_e: MouseEvent) => true,
  },
  setup(props, { emit, slots }) {
    return () => (
      <button
        type="button"
        class={["hk-menu-action-item", props.danger ? "hk-menu-action-item--danger" : ""]}
        data-danger={props.danger || undefined}
        data-active={props.active || undefined}
        disabled={props.disabled}
        role="menuitem"
        onClick={(e: MouseEvent) => emit("click", e)}
      >
        {props.icon && <span class="hk-menu-action-item__icon">{props.icon}</span>}
        <span class="hk-menu-action-item__label">{props.label}</span>
        {slots.suffix?.()}
      </button>
    );
  },
});
