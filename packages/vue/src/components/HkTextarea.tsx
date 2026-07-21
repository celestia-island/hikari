import {
  computed,
  defineComponent,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";
import "./HkTextarea.scss";

export default defineComponent({
  name: "HkTextarea",
  props: {
    modelValue: { type: String, default: "" },
    placeholder: { type: String, default: undefined },
    disabled: { type: Boolean, default: false },
    rows: { type: Number, default: 4 },
    autoGrow: { type: Boolean, default: false },
    maxLength: { type: Number, default: undefined },
    showCount: { type: Boolean, default: false },
  },
  emits: {
    "update:modelValue": (_value: string) => true,
  },
  setup(props, { emit }) {
    const textareaRef = ref<HTMLTextAreaElement | null>(null);
    let ro: ResizeObserver | null = null;
    let lastWidth = -1;

    function autoResize() {
      const ta = textareaRef.value;
      if (!ta || !props.autoGrow) return;
      ta.style.height = "auto";
      ta.style.height = `${ta.scrollHeight}px`;
    }

    watch(
      () => props.modelValue,
      () => {
        if (props.autoGrow) nextTick(autoResize);
      },
    );

    onMounted(() => {
      if (!props.autoGrow) return;
      const ta = textareaRef.value;
      if (!ta) return;
      ro = new ResizeObserver(() => {
        const el = textareaRef.value;
        if (!el) return;
        const w = el.clientWidth;
        if (w === lastWidth) return;
        lastWidth = w;
        autoResize();
      });
      ro.observe(ta);
      nextTick(autoResize);
    });

    onBeforeUnmount(() => ro?.disconnect());

    function onInput(e: Event) {
      emit("update:modelValue", (e.target as HTMLTextAreaElement).value);
    }

    const charCount = computed(() => props.modelValue.length);
    const isOverLimit = computed(() =>
      props.maxLength != null && charCount.value > props.maxLength
    );

    const wrapperClass = computed(() => [
      "hk-textarea",
      props.disabled ? "hk-textarea-disabled" : "",
      isOverLimit.value ? "hk-textarea-overlimit" : "",
    ]);

    return () => (
      <div class={wrapperClass.value}>
        <textarea
          ref={textareaRef}
          class={[
            "hk-textarea-field",
            props.autoGrow ? "hk-textarea-field-autogrow" : "",
          ]}
          value={props.modelValue}
          placeholder={props.placeholder}
          disabled={props.disabled}
          rows={props.rows}
          maxlength={props.maxLength}
          onInput={onInput}
        />
        {props.showCount && props.maxLength != null ? (
          <div class="hk-textarea-count">
            <span class={isOverLimit.value ? "hk-textarea-count-over" : ""}>
              {charCount.value}
            </span>
            <span> / {props.maxLength}</span>
          </div>
        ) : null}
      </div>
    );
  },
});
