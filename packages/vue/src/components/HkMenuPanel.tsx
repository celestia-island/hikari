import { defineComponent } from "vue";
import "./HkMenuPanel.scss";

/**
 * Detachable menu container with a single, shared layout constraint.
 *
 * The admin nav drawer nests three paddings (drawer body → sidebar panel
 * → nav row), so consumer-built footer menus used to need per-app CSS
 * hacks to line their left edge up with the nav items above. This panel
 * owns the constraint instead: it pads with the same inset as the nav
 * rows (`--hk-menu-panel-inset`, default 12px) and its items carry the
 * nav row's own padding, so `HkMenuActionItem` / `HkMenuIdentityItem`
 * children always land on the nav text edge — in a drawer footer, a
 * popup, or any other host.
 *
 * Fully pluggable: no drawer/popover dependency, no state. Drop it
 * anywhere a vertical menu list belongs.
 */
export default defineComponent({
  name: "HkMenuPanel",
  props: {
    /** Accessible label for the menu list. */
    label: { type: String, default: undefined },
  },
  setup(props, { slots }) {
    return () => (
      <div class="hk-menu-list" role="menu" aria-label={props.label}>
        {slots.default?.()}
      </div>
    );
  },
});
