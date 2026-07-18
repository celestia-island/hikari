import { computed, defineComponent, ref, onMounted, onUnmounted, type PropType, type CSSProperties, Teleport } from "vue";
import "../../../components/src/styles/components/select.scss";

export default defineComponent({
  name: "HkSelect",
  props: {
    options: { type: Array as PropType<{ value: string | number; label: string; disabled?: boolean }[]>, required: true },
    modelValue: { type: [String, Number] as PropType<string | number | null>, default: null },
    placeholder: { type: String },
    disabled: { type: Boolean, default: false },
    size: { type: String as PropType<"sm" | "md" | "lg">, default: "md" },
  },
  emits: {
    "update:modelValue": (_value: string | number) => true,
  },
  setup(props, { emit }) {
    const open = ref(false);
    const triggerRef = ref<HTMLElement | null>(null);
    const dropdownRef = ref<HTMLElement | null>(null);

    const selectedLabel = computed(() => {
      const opt = props.options.find((o) => o.value === props.modelValue);
      return opt?.label ?? null;
    });

    function select(value: string | number) {
      emit("update:modelValue", value);
      open.value = false;
    }

    function toggle() {
      if (!props.disabled) {
        open.value = !open.value;
      }
    }

    function onClickOutside(e: MouseEvent) {
      if (
        triggerRef.value && !triggerRef.value.contains(e.target as Node) &&
        dropdownRef.value && !dropdownRef.value.contains(e.target as Node)
      ) {
        open.value = false;
      }
    }

    onMounted(() => document.addEventListener("click", onClickOutside));
    onUnmounted(() => document.removeEventListener("click", onClickOutside));

    const dropdownStyle = computed<CSSProperties>(() => {
      if (!triggerRef.value) return {};
      const rect = triggerRef.value.getBoundingClientRect();
      return {
        position: "fixed",
        top: `${rect.bottom + 4}px`,
        left: `${rect.left}px`,
        width: `${rect.width}px`,
        zIndex: 1000,
      };
    });

    const triggerCls = computed(() => [
      "hi-select-trigger",
      `hi-select-${props.size}`,
      open.value ? "hi-select-open" : "",
      props.disabled ? "hi-select-disabled" : "",
    ]);

    return () => (
      <div class="hi-select-root">
        <div ref={triggerRef} class={triggerCls.value} onClick={toggle}>
          {selectedLabel.value ? (
            <span class="hi-select-value">{selectedLabel.value}</span>
          ) : (
            <span class="hi-select-placeholder">{props.placeholder ?? "Select..."}</span>
          )}
          <span class="hi-select-arrow">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </span>
        </div>
        {open.value && (
          <Teleport to="body">
            <div ref={dropdownRef} class="hi-select-dropdown" style={dropdownStyle.value}>
              {props.options.map((opt) => (
                <div
                  key={opt.value}
                  class={["hi-select-option", opt.value === props.modelValue ? "hi-select-option--selected" : ""]}
                  onClick={() => select(opt.value)}
                >
                  {opt.label}
                </div>
              ))}
            </div>
          </Teleport>
        )}
      </div>
    );
  },
});
