import { computed, defineComponent } from "vue";

import "./HkSidebar.scss";

export default defineComponent({
  name: "HkSidebar",
  props: {
    collapsed: { type: Boolean, default: false },
    mobile: { type: Boolean, default: false },
    width: { type: String, default: "280px" },
  },
  emits: {
    close: () => true,
  },
  setup(props, { emit, slots }) {
    const panelWidth = computed(() => (props.collapsed ? "56px" : props.width));

    return () => (
      <aside
        class="hk-sidebar"
        data-mobile={props.mobile || undefined}
        data-collapsed={props.collapsed || undefined}
        style={props.mobile ? undefined : { width: panelWidth.value }}
        onClick={(e) => {
          if (e.target === e.currentTarget && props.mobile) {
            emit("close");
          }
        }}
      >
        <nav
          class="hk-sidebar-panel"
          style={{ width: props.mobile ? undefined : panelWidth.value }}
        >
          {slots.header ? (
            <header class="hk-sidebar-header">{slots.header()}</header>
          ) : null}
          <div class="hk-sidebar-body">{slots.default?.()}</div>
          {slots.footer ? (
            <footer class="hk-sidebar-footer">{slots.footer()}</footer>
          ) : null}
        </nav>
      </aside>
    );
  },
});
