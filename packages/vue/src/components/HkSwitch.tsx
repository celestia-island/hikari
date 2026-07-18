import { computed, defineComponent, type PropType } from "vue";
import "../../../components/src/styles/components/switch.scss";

export default defineComponent({
  name: "HkSwitch",
  props: {
    modelValue: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    size: { type: String as PropType<"sm" | "md" | "lg">, default: "md" },
    color: { type: String as PropType<"primary" | "secondary" | "danger" | "warning" | "info"> },
    label: { type: String },
  },
  emits: {
    "update:modelValue": (_value: boolean) => true,
  },
  setup(props, { emit }) {
    function toggle() {
      if (!props.disabled) {
        emit("update:modelValue", !props.modelValue);
      }
    }

    const labelCls = computed(() => [
      "hi-switch-label",
      props.disabled ? "hi-switch-disabled" : "",
    ]);

    const switchCls = computed(() => [
      "hi-switch",
      `hi-switch-${props.size}`,
      props.modelValue ? "hi-switch-checked" : "",
      props.color ? `hi-switch-color-${props.color}` : "",
    ]);

    return () => (
      <label class={labelCls.value}>
        <div class={switchCls.value} onClick={(e: MouseEvent) => { e.preventDefault(); toggle(); }}>
          <div class="hi-switch-track">
            <div class="hi-switch-thumb">
              <span class="hi-switch-thumb-dot" />
            </div>
          </div>
        </div>
        {props.label && <span class="hi-switch-text">{props.label}</span>}
      </label>
    );
  },
});
