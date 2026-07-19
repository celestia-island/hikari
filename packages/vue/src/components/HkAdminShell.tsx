import { defineComponent } from "vue";

export default defineComponent({
  name: "HkAdminShell",
  props: {
    sidebarCollapsed: { type: Boolean, default: false },
    sidebarWidth: { type: String, default: "240px" },
    mobile: { type: Boolean, default: false },
    drawerOpen: { type: Boolean, default: false },
  },
  emits: {
    "update:drawerOpen": (_v: boolean) => true,
    "update:sidebarCollapsed": (_v: boolean) => true,
  },
  setup(props, { slots, emit }) {
    return () => (
      <div class="hk-admin-shell" style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
        {slots.header?.()}
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          {!props.mobile ? (
            <aside style={{ width: props.sidebarCollapsed ? "0px" : props.sidebarWidth, flexShrink: 0, overflow: "hidden", transition: "width 0.3s ease" }}>
              {slots.sidebar?.()}
            </aside>
          ) : null}
          <main style={{ flex: 1, overflow: "auto", background: "rgb(var(--color-background))" }}>
            {slots.default?.()}
          </main>
        </div>
        {slots.footer?.()}
      </div>
    );
  },
});
