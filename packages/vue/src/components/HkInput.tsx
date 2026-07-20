import { computed, defineComponent, nextTick, onBeforeUnmount, onMounted, ref, useAttrs, watch } from "vue";
import "./HkInput.scss";

export default defineComponent({
  name: "HkInput",
  inheritAttrs: false,
  props: {
    modelValue: { type: String, default: "" },
    type: { type: String, default: "text" },
    placeholder: { type: String, default: "" },
    label: { type: String, default: undefined },
    error: { type: String, default: undefined },
    hint: { type: String, default: undefined },
    disabled: { type: Boolean, default: false },
    readonly: { type: Boolean, default: false },
    required: { type: Boolean, default: false },
    name: { type: String, default: undefined },
    autocomplete: { type: String, default: "off" },
    rows: { type: Number, default: 3 },
    autoGrow: { type: Boolean, default: false },
    size: { type: String as () => "sm" | "md" | "lg", default: "md" },
  },
  emits: {
    "update:modelValue": (_value: string) => true,
    focus: (_e: FocusEvent) => true,
    blur: (_e: FocusEvent) => true,
    keydown: (_e: KeyboardEvent) => true,
  },
  setup(props, { emit, slots }) {
    const attrs = useAttrs();
    const inputRef = ref<HTMLElement>();

    const filteredAttrs = computed(() => {
      const { class: _, style: __, ...rest } = attrs as Record<string, unknown>;
      return rest;
    });

    function onInput(e: Event) {
      const target = e.target as HTMLInputElement | HTMLTextAreaElement;
      emit("update:modelValue", target.value);
    }

    const isTextarea = computed(() => props.type === "textarea");
    const isAutoGrow = computed(() => props.autoGrow && props.type === "textarea");

    let lastWidth = -1;
    let ro: ResizeObserver | null = null;

    function resize() {
      if (!props.autoGrow || props.type !== "textarea") return;
      const ta = inputRef.value as HTMLTextAreaElement | null;
      if (!ta) return;
      ta.style.height = "auto";
      ta.style.height = `${ta.scrollHeight}px`;
    }

    watch(
      () => props.modelValue,
      () => {
        if (props.autoGrow) nextTick(resize);
      },
    );

    onMounted(() => {
      if (!isAutoGrow.value) return;
      const ta = inputRef.value as HTMLTextAreaElement | null;
      if (!ta) return;
      ro = new ResizeObserver(() => {
        const el = inputRef.value as HTMLTextAreaElement | null;
        if (!el) return;
        const w = el.clientWidth;
        if (w === lastWidth) return;
        lastWidth = w;
        resize();
      });
      ro.observe(ta);
      nextTick(resize);
    });

    onBeforeUnmount(() => ro?.disconnect());

    const boxClass = computed(() => [
      "hk-input-box",
      `hk-input-box--${props.size}`,
      props.error ? "hk-input-box--error" : "",
      props.disabled ? "hk-input-box--disabled" : "",
    ]);

    const isText = !isTextarea.value;

    return () => (
      <div class="hk-input-wrapper">
        {props.label && (
          <label class="hk-input-label">
            {props.label}
            {props.required && <span class="hk-input-required">*</span>}
          </label>
        )}
        <div
          class={boxClass.value}
          data-autogrow={isAutoGrow.value || undefined}
        >
          {slots.prefix && (
            <span class="hk-input-affix hk-input-prefix">
              {slots.prefix()}
            </span>
          )}
          {isText ? (
            <input
              ref={inputRef}
              type={props.type}
              value={props.modelValue}
              placeholder={props.placeholder}
              disabled={props.disabled}
              readonly={props.readonly}
              name={props.name}
              autocomplete={props.autocomplete}
              data-1p-ignore
              data-lpignore="true"
              class="hk-input-element"
              {...filteredAttrs.value}
              onInput={onInput}
              onFocus={(e) => emit("focus", e)}
              onBlur={(e) => emit("blur", e)}
              onKeydown={(e) => emit("keydown", e)}
            />
          ) : (
            <textarea
              ref={inputRef}
              value={props.modelValue}
              placeholder={props.placeholder}
              disabled={props.disabled}
              readonly={props.readonly}
              rows={props.rows}
              name={props.name}
              autocomplete={props.autocomplete}
              data-1p-ignore
              data-lpignore="true"
              class={[
                "hk-input-element",
                "hk-input-textarea",
                isAutoGrow.value ? "hk-input-textarea--autogrow" : "",
              ]}
              {...filteredAttrs.value}
              onInput={onInput}
              onFocus={(e) => emit("focus", e)}
              onBlur={(e) => emit("blur", e)}
              onKeydown={(e) => emit("keydown", e)}
            />
          )}
          {slots.suffix && (
            <span class="hk-input-affix hk-input-suffix">
              {slots.suffix()}
            </span>
          )}
        </div>
        {props.error ? (
          <p class="hk-input-error-msg">{props.error}</p>
        ) : props.hint ? (
          <p class="hk-input-hint">{props.hint}</p>
        ) : null}
      </div>
    );
  },
});
