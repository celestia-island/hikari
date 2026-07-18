import { computed, defineComponent, useAttrs, type PropType } from "vue";
import "../../../components/src/styles/components/input.scss";
import "../../../components/src/styles/components/input-vars.scss";
import "../../../components/src/styles/components/input_wrapper.scss";

export default defineComponent({
  name: "HkInput",
  inheritAttrs: false,
  props: {
    modelValue: { type: [String, Number] as PropType<string | number>, default: "" },
    type: { type: String, default: "text" },
    placeholder: { type: String },
    disabled: { type: Boolean, default: false },
    error: { type: String },
  },
  emits: {
    "update:modelValue": (_value: string | number) => true,
  },
  setup(props, { emit, slots }) {
    const attrs = useAttrs();
    const inputAttrs = computed(() => {
      const { class: _, ...rest } = attrs as Record<string, unknown>;
      return rest;
    });

    const wrapperCls = computed(() => [
      "hi-input-wrapper",
      props.error ? "hi-input-wrapper--error" : "",
    ]);

    return () => (
      <>
        <div class={wrapperCls.value}>
          {slots.prefix && (
            <div class="hi-input-wrapper-left">
              <span class="hi-input-wrapper-item">
                {slots.prefix()}
              </span>
            </div>
          )}
          <div class="hi-input-wrapper-input">
            <input
              type={props.type}
              value={props.modelValue}
              placeholder={props.placeholder}
              disabled={props.disabled}
              {...inputAttrs.value}
              onInput={(e: Event) => emit("update:modelValue", (e.target as HTMLInputElement).value)}
            />
          </div>
          {slots.suffix && (
            <div class="hi-input-wrapper-right">
              <span class="hi-input-wrapper-item">
                {slots.suffix()}
              </span>
            </div>
          )}
        </div>
        {props.error && <span class="hikari-input__error">{props.error}</span>}
      </>
    );
  },
});
