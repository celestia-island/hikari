import { defineComponent } from "vue";
import HkButton from "./HkButton";

export default defineComponent({
  name: "HkAdminHeader",
  props: {
    title: { type: String, default: "" },
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
      <header class="hk-admin-header" style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        height: "3rem", padding: "0 1rem", flexShrink: 0,
        background: "rgb(var(--color-surface) / 0.85)", backdropFilter: "blur(16px)",
        borderBottom: "1px solid rgb(var(--color-border) / 0.1)", zIndex: 30,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          {slots["menu-button"]?.()}
          <span style={{ fontWeight: 600, fontSize: "var(--text-lg)", color: "rgb(var(--color-text))" }}>{props.title || "Arona"}</span>
          {slots.actions?.()}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <HkButton variant="ghost" size="sm" onClick={() => emit("toggleTheme")}>🌓</HkButton>
          {props.authenticated ? (
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              {props.avatarUrl ? <img src={props.avatarUrl} style={{ width: 24, height: 24, borderRadius: "50%" }} /> : null}
              <span style={{ fontSize: "var(--text-sm)", color: "rgb(var(--color-text))" }}>{props.username}</span>
              <HkButton variant="ghost" size="sm" onClick={() => emit("logout")}>Logout</HkButton>
            </div>
          ) : (
            <HkButton variant="primary" size="sm" onClick={() => emit("logout")}>Login</HkButton>
          )}
        </div>
      </header>
    );
  },
});
