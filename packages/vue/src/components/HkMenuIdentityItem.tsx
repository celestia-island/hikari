import { defineComponent } from "vue";
import "./HkMenuIdentityItem.scss";

/**
 * Standard menu identity row: avatar (image URL or initial fallback)
 * beside name/subtitle, with an optional badges slot. Shares the nav
 * row's padding constraint (see HkMenuPanel) so it lines up with
 * HkMenuActionItem rows and the nav items above.
 */
export default defineComponent({
  name: "HkMenuIdentityItem",
  props: {
    avatarUrl: { type: String, default: "" },
    name: { type: String, default: "" },
    /** Secondary line under the name (login email, department…). */
    subtitle: { type: String, default: "" },
    /** Accessible label for the avatar image. */
    avatarAlt: { type: String, default: "" },
  },
  setup(props, { slots }) {
    return () => (
      <div class="hk-menu-identity-item" role="presentation">
        <div class="hk-menu-identity-item__avatar" aria-hidden="true">
          {props.avatarUrl ? (
            <img src={props.avatarUrl} alt={props.avatarAlt || props.name} class="hk-menu-identity-item__img" />
          ) : (
            <span class="hk-menu-identity-item__fallback">
              {(props.name || "?").charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        <div class="hk-menu-identity-item__text">
          {props.name && <span class="hk-menu-identity-item__name">{props.name}</span>}
          {props.subtitle && (
            <span class="hk-menu-identity-item__subtitle">{props.subtitle}</span>
          )}
          {slots.badges && <div class="hk-menu-identity-item__badges">{slots.badges()}</div>}
        </div>
      </div>
    );
  },
});
