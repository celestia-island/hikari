import { computed, defineComponent, ref, type PropType } from "vue";
import HkInput from "./HkInput";

export default defineComponent({
  name: "HkPasswordInput",
  props: {
    modelValue: { type: String, default: "" },
    placeholder: { type: String },
    disabled: { type: Boolean, default: false },
    error: { type: String },
  },
  emits: {
    "update:modelValue": (_value: string) => true,
  },
  setup(props, { emit }) {
    const showPassword = ref(false);
    const inputType = computed(() => (showPassword.value ? "text" : "password"));

    return () => (
      <HkInput
        modelValue={props.modelValue}
        type={inputType.value}
        placeholder={props.placeholder ?? "Enter password"}
        disabled={props.disabled}
        error={props.error}
        onUpdate:modelValue={(val: string) => emit("update:modelValue", val)}
      >
        {{
          suffix: () => (
            <button type="button" class="hi-password-toggle" onClick={() => (showPassword.value = !showPassword.value)} tabindex={-1}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="hi-password-toggle-icon">
                {showPassword.value ? (
                  <>
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </>
                ) : (
                  <>
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </>
                )}
              </svg>
            </button>
          ),
        }}
      </HkInput>
    );
  },
});
