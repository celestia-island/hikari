import { computed, defineComponent, onBeforeUnmount, onMounted, ref } from "vue";

import "./HkSidebar.scss";
import { attachOverlayScrollbars, type OverlayScrollbarHandle } from "../composables/useOverlayScrollbar";

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

    // Persistent layout surface — attach the overlay scrollbar (shared
    // chrome) once and detach on unmount.
    const bodyRef = ref<HTMLElement>();
    // Positioned wrapper containing ONLY the body — the rail host (the
    // panel also contains the header/footer bands).
    const bodyWrapRef = ref<HTMLElement>();
    let bodyScrollbar: OverlayScrollbarHandle | null = null;

    onMounted(() => {
      if (!bodyRef.value) return;
      bodyScrollbar = attachOverlayScrollbars(bodyRef.value, {
        axis: "vertical",
        host: bodyWrapRef.value,
      });
    });

    onBeforeUnmount(() => {
      bodyScrollbar?.detach();
      bodyScrollbar = null;
    });

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
          <div ref={bodyWrapRef} class="hk-sidebar-body-wrap">
            <div ref={bodyRef} class="hk-sidebar-body">{slots.default?.()}</div>
          </div>
          {slots.footer ? (
            <footer class="hk-sidebar-footer">{slots.footer()}</footer>
          ) : null}
        </nav>
      </aside>
    );
  },
});
