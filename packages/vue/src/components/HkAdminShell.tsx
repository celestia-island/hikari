import { computed, defineComponent } from "vue";
import "./HkAdminShell.scss";

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
    const sidebarStyle = computed(() => ({
      width: props.sidebarCollapsed ? "0px" : props.sidebarWidth,
    }));

    function closeDrawer() {
      emit("update:drawerOpen", false);
    }

    function onOverlayClick() {
      closeDrawer();
    }

    return () => (
      <div class="hk-admin-shell">
        <div class="hk-admin-shell-header">
          {slots.header?.()}
        </div>
        <div class="hk-admin-shell-body">
          {props.mobile ? (
            <>
              {props.drawerOpen && (
                <div
                  class="hk-admin-shell-drawer-overlay"
                  onClick={onOverlayClick}
                />
              )}
              <aside
                class={[
                  "hk-admin-shell-drawer",
                  props.drawerOpen ? "hk-admin-shell-drawer--open" : "",
                ]}
              >
                {slots.sidebar?.()}
              </aside>
            </>
          ) : (
            <aside
              class={[
                "hk-admin-shell-sidebar",
                props.sidebarCollapsed ? "hk-admin-shell-sidebar--collapsed" : "",
              ]}
              style={sidebarStyle.value}
            >
              <div class="hk-admin-shell-sidebar-inner">
                {slots.sidebar?.()}
              </div>
            </aside>
          )}
          <main class="hk-admin-shell-main">
            {slots.default?.()}
          </main>
        </div>
        <div class="hk-admin-shell-footer">
          {slots.footer?.()}
        </div>
      </div>
    );
  },
});
