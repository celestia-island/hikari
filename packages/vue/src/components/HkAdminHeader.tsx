import { defineComponent } from "vue";
import HkButton from "./HkButton";
import "./HkAdminHeader.scss";

const sunMoonIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18">
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
);

export default defineComponent({
  name: "HkAdminHeader",
  props: {
    title: { type: String, default: "Admin" },
    username: { type: String, default: "" },
    avatarUrl: { type: String, default: "" },
    authenticated: { type: Boolean, default: false },
  },
  emits: {
    logout: () => true,
    toggleTheme: () => true,
  },
  setup(props, { slots, emit }) {
    return () => (
      <header class="hk-admin-header">
        <div class="hk-admin-header__left">
          {slots["menu-button"]?.()}
          <span class="hk-admin-header__title">{props.title}</span>
          {slots.actions?.()}
        </div>
        <div class="hk-admin-header__right">
          <HkButton
            variant="ghost"
            size="sm"
            ariaLabel="Toggle theme"
            onClick={() => emit("toggleTheme")}
          >
            {sunMoonIcon}
          </HkButton>
          {props.authenticated ? (
            <div class="hk-admin-header__user">
              {props.avatarUrl ? (
                <img
                  class="hk-admin-header__avatar"
                  src={props.avatarUrl}
                  alt={props.username}
                />
              ) : (
                <div class="hk-admin-header__avatar-placeholder">
                  {props.username.charAt(0).toUpperCase()}
                </div>
              )}
              <span class="hk-admin-header__username">{props.username}</span>
              <HkButton variant="ghost" size="sm" onClick={() => emit("logout")}>
                Logout
              </HkButton>
            </div>
          ) : (
            <HkButton variant="primary" size="sm" onClick={() => emit("logout")}>
              Login
            </HkButton>
          )}
        </div>
      </header>
    );
  },
});
