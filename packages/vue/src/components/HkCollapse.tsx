import { computed, defineComponent, ref, watch, type PropType } from "vue";
import "../../../components/src/styles/components/collapse.scss";

export default defineComponent({
  name: "HkCollapse",
  props: {
    title: { type: String },
    open: { type: Boolean, default: false },
  },
  emits: {
    "update:open": (_value: boolean) => true,
  },
  setup(props, { emit, slots }) {
    const isOpen = ref(props.open ?? false);

    watch(() => props.open, (val) => {
      if (val != null) isOpen.value = val;
    });

    function toggle() {
      isOpen.value = !isOpen.value;
      emit("update:open", isOpen.value);
    }

    const contentCls = computed(() => [
      "hi-collapse-content",
      isOpen.value ? "hi-collapse-expanded" : "",
    ]);

    return () => (
      <div class="hi-collapse">
        <div class="hi-collapse-header" onClick={toggle}>
          <span class="hi-collapse-arrow" style={{ transform: isOpen.value ? "rotate(90deg)" : "rotate(0deg)" }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </span>
          <div class="hi-collapse-header-content">
            {slots.title ? slots.title() : props.title ? <span>{props.title}</span> : null}
          </div>
        </div>
        <div class={contentCls.value}>
          {slots.default?.()}
        </div>
      </div>
    );
  },
});
