import { computed, defineComponent, onMounted, onUnmounted, ref, type CSSProperties, type PropType, Teleport } from "vue";
import "../../../components/src/styles/components/popover.scss";

export default defineComponent({
  name: "HkPopover",
  props: {
    title: { type: String },
    width: { type: String, default: "280px" },
  },
  setup(props, { slots }) {
    const visible = ref(false);
    const triggerRef = ref<HTMLElement | null>(null);
    const popoverRef = ref<HTMLElement | null>(null);

    function toggle() {
      visible.value = !visible.value;
    }

    function onClickOutside(e: MouseEvent) {
      if (
        triggerRef.value && !triggerRef.value.contains(e.target as Node) &&
        popoverRef.value && !popoverRef.value.contains(e.target as Node)
      ) {
        visible.value = false;
      }
    }

    onMounted(() => document.addEventListener("click", onClickOutside));
    onUnmounted(() => document.removeEventListener("click", onClickOutside));

    function positionPopover(): CSSProperties {
      if (!triggerRef.value) return {};
      const rect = triggerRef.value.getBoundingClientRect();
      return {
        position: "fixed",
        top: `${rect.bottom + 4}px`,
        left: `${rect.left}px`,
        minWidth: props.width,
      };
    }

    return () => (
      <>
        <span
          ref={triggerRef}
          class="hi-popover-trigger"
          onClick={(e: MouseEvent) => { e.stopPropagation(); toggle(); }}
        >
          {slots.trigger?.()}
        </span>
        {visible.value && (
          <Teleport to="body">
            <div ref={popoverRef} class="hi-popover" style={positionPopover()}>
              {props.title && <div class="hi-popover-title">{props.title}</div>}
              <div class="hi-popover-content">
                {slots.default?.()}
              </div>
            </div>
          </Teleport>
        )}
      </>
    );
  },
});
