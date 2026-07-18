import { computed, defineComponent, ref, watch, Teleport, type PropType } from "vue";
import "../../../components/src/styles/components/drawer.scss";

export default defineComponent({
  name: "HkDrawer",
  props: {
    open: { type: Boolean, default: false },
    placement: { type: String as PropType<"left" | "right" | "top" | "bottom">, default: "right" },
    width: { type: String, default: "400px" },
    title: { type: String },
  },
  emits: {
    "update:open": (_value: boolean) => true,
    close: () => true,
  },
  setup(props, { emit, slots }) {
    const visible = ref(props.open);

    watch(() => props.open, (val) => {
      visible.value = val;
    });

    function close() {
      visible.value = false;
      emit("update:open", false);
      emit("close");
    }

    function isHorizontal() {
      return props.placement === "left" || props.placement === "right";
    }

    const drawerCls = computed(() => [
      "hi-drawer",
      `hi-drawer-${props.placement}`,
      visible.value ? "hi-drawer-open" : "",
    ]);

    const sizeStyle = computed(() => {
      if (isHorizontal()) return { width: props.width };
      return { height: props.width };
    });

    return () => (
      <>
        {visible.value && (
          <Teleport to="body">
            <div class="hi-drawer-mask hi-drawer-mask-visible" onClick={close} />
            <div class={drawerCls.value} style={sizeStyle.value}>
              {props.title && (
                <div class="hi-drawer-header">
                  <h3 class="hi-drawer-title">{props.title}</h3>
                  <button class="hi-drawer-close" onClick={close}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              )}
              <div class="hi-drawer-body">
                {slots.default?.()}
              </div>
              {slots.footer && (
                <div class="hi-drawer-footer">
                  {slots.footer()}
                </div>
              )}
            </div>
          </Teleport>
        )}
      </>
    );
  },
});
