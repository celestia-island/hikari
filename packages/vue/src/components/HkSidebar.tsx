import { computed, defineComponent, type PropType } from "vue";
import "../../../components/src/styles/components/sidebar.scss";

export default defineComponent({
  name: "HkSidebar",
  props: {
    width: { type: String, default: "240px" },
    collapsed: { type: Boolean, default: false },
  },
  emits: {
    toggle: () => true,
  },
  setup(props, { slots }) {
    const cls = computed(() => [
      "hikari-sidebar",
      props.collapsed ? "hikari-sidebar--collapsed" : "",
    ]);

    const sidebarStyle = computed(() => ({
      width: props.collapsed ? "64px" : props.width,
    }));

    return () => (
      <aside class={cls.value} style={sidebarStyle.value}>
        {slots.default?.()}
      </aside>
    );
  },
});
