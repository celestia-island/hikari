import { computed, defineComponent, type PropType } from "vue";

export default defineComponent({
  name: "HkTextarea",
  props: {
    modelValue: { type: String, default: "" },
    placeholder: { type: String },
    disabled: { type: Boolean, default: false },
    rows: { type: Number, default: 4 },
  },
  emits: {
    "update:modelValue": (_value: string) => true,
  },
  setup(props, { emit }) {
    const wrapperCls = computed(() => [
      "hi-textarea-wrapper",
      props.disabled ? "hi-textarea-wrapper--disabled" : "",
    ]);

    return () => (
      <div class={wrapperCls.value}>
        <textarea
          class="hi-textarea"
          value={props.modelValue}
          placeholder={props.placeholder}
          disabled={props.disabled}
          rows={props.rows}
          onInput={(e: Event) => emit("update:modelValue", (e.target as HTMLTextAreaElement).value)}
        />
      </div>
    );
  },
});
