import { Eye, EyeOff } from "lucide-vue-next";
import { computed, defineComponent, nextTick, onBeforeUnmount, onMounted, ref, useAttrs, watch } from "vue";

import { useI18n } from "../i18n/context";

import { HkPlaceholderMarquee } from "./HkPlaceholderMarquee";
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
    /** Submit intent on Enter (no modifiers) — see HkPasswordInput. */
    submitOnEnter: { type: Function, default: undefined },
    autocomplete: { type: String, default: "off" },
    rows: { type: Number, default: 3 },
    autoGrow: { type: Boolean, default: false },
    size: { type: String as () => "sm" | "md" | "lg", default: "md" },
    /**
     * Input variant. `password` renders a password field with a built-in
     * visibility toggle (HPasswordInput layers strength / caps-lock /
     * full-width extras on top of this base behavior). `number` maps to the
     * numeric input type. Defaults to "text".
     */
    variant: {
      type: String as () => "text" | "password" | "number",
      default: "text",
    },
    /**
     * Overflow strategy for a placeholder longer than the input line:
     * `marquee` (default) scrolls it like a storefront sign — the text is
     * rendered three times inside a clipping window and the strip is
     * translated through the hikari animation bus; `truncate` hard-cuts it
     * with an ellipsis. The marquee parks while the input is focused or
     * holds a value, and under reduced-motion the strip stays parked.
     */
    placeholderVariant: {
      type: String as () => "marquee" | "truncate",
      default: "marquee",
    },
  },
  emits: {
    "update:modelValue": (_value: string) => true,
    focus: (_e: FocusEvent) => true,
    blur: (_e: FocusEvent) => true,
    keydown: (_e: KeyboardEvent) => true,
  },
  setup(props, { emit, slots }) {
    const { t } = useI18n();
    const attrs = useAttrs();
    const inputRef = ref<HTMLElement>();

    const revealing = ref(false);
    const marqueeRef = ref<{
      setActive(active: boolean): void;
      measure(): void;
    }>();
    const isEmpty = computed(() => String(props.modelValue ?? "") === "");
    // Flipped by the marquee overlay once it measures the placeholder
    // actually overflowing the input line. While false, the native
    // placeholder does the showing and the overlay stays a hidden probe.
    const placeholderOverflows = ref(false);
    watch([isEmpty, () => props.disabled], ([empty, disabled]) => {
      // The overlay unmounts on these flips — drop the stale overflow flag
      // so the native placeholder returns the moment the field is cleared.
      if (!empty || disabled) placeholderOverflows.value = false;
    });

    const forwardFocus = (active: boolean) => {
      marqueeRef.value?.setActive(active);
    };

    // In marquee mode the native placeholder is suppressed only while the
    // scrolling overlay is actually needed (overflowing); the truncate
    // variant always keeps it native.
    const nativePlaceholder = computed(() =>
      props.placeholderVariant === "truncate" || !placeholderOverflows.value
        ? props.placeholder
        : "",
    );

    const resolvedType = computed(() => {
      if (props.variant === "password") {
        return revealing.value ? "text" : "password";
      }
      if (props.variant === "number") return "number";
      return props.type;
    });

    const filteredAttrs = computed(() => {
      const { class: _, style: __, ...rest } = attrs as Record<string, unknown>;
      return rest;
    });

    // ── affix width reservation ──────────────────────────────────────
    // The input element overlays the WHOLE box (absolute inset:0) while
    // the prefix/suffix affixes flow above it — so centered text, the
    // native placeholder and the placeholder-marquee window would run
    // underneath the affixes (the localized input's language chip used
    // to catch the scrolling placeholder). Both affixes are measured
    // and published as custom properties on the box; the element's
    // horizontal padding and the marquee window insets consume them,
    // so the text line always ends short of the chip.
    const prefixEl = ref<HTMLElement | null>(null);
    const suffixEl = ref<HTMLElement | null>(null);
    const affixStartW = ref(0);
    const affixEndW = ref(0);

    function measureAffixes() {
      affixStartW.value = prefixEl.value?.offsetWidth ?? 0;
      affixEndW.value = suffixEl.value?.offsetWidth ?? 0;
    }

    const affixRO: ResizeObserver | null =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(measureAffixes) : null;
    onBeforeUnmount(() => {
      affixRO?.disconnect();
    });

    /** Stable ref callback for one affix slot — observes the live span
     *  so width changes (a longer chip label, a swapped icon) re-publish
     *  the custom properties without any consumer involvement. */
    function bindAffix(which: "start" | "end") {
      const slot = () => (which === "start" ? prefixEl : suffixEl);
      const set = (node: HTMLElement | null) => {
        if (which === "start") prefixEl.value = node;
        else suffixEl.value = node;
      };
      return (el: unknown) => {
        const node = (el as HTMLElement | null) ?? null;
        const prev = slot().value;
        if (node == null) {
          if (!prev) return;
          // Vue fires ref(null) BEFORE detaching the element (unmount
          // calls setRef at the top, removes the node at the bottom), and
          // on a cross-branch swap (suffix ↔ suffixIcon ↔ password
          // toggle) a trailing null can arrive AFTER a newer element
          // already took the slot. So neither "is it connected right
          // now" nor "is the slot still pointing at it" can be judged
          // synchronously — defer past the patch and clear only when the
          // tracked element is STILL this one and really detached.
          void nextTick(() => {
            const tracked = slot().value;
            if (tracked !== prev || tracked.isConnected) return;
            affixRO?.unobserve(prev);
            set(null);
            measureAffixes();
          });
          return;
        }
        if (prev && prev !== node) affixRO?.unobserve(prev);
        set(node);
        affixRO?.observe(node);
        measureAffixes();
      };
    }
    const prefixAffixRef = bindAffix("start");
    const suffixAffixRef = bindAffix("end");

    const boxVars = computed(
      () =>
        ({
          "--hk-input-affix-start-w": `${affixStartW.value}px`,
          "--hk-input-affix-end-w": `${affixEndW.value}px`,
        }) as Record<string, string>,
    );

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
      `hk-input-box-${props.size}`,
      props.error ? "hk-input-box-error" : "",
      props.disabled ? "hk-input-box-disabled" : "",
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
          style={boxVars.value}
          data-autogrow={isAutoGrow.value || undefined}
        >
          {slots.prefix && (
            <span ref={prefixAffixRef} class="hk-input-affix hk-input-prefix">
              {slots.prefix()}
            </span>
          )}
          {slots.prefixIcon && !slots.prefix && (
            <span ref={prefixAffixRef} class="hk-input-affix hk-input-prefix">
              {slots.prefixIcon()}
            </span>
          )}
          {isText ? (
            <input
              ref={inputRef}
              type={resolvedType.value}
              value={props.modelValue}
              placeholder={nativePlaceholder.value}
              disabled={props.disabled}
              readonly={props.readonly}
              name={props.name}
              autocomplete={props.autocomplete}
              data-1p-ignore
              data-lpignore="true"
              class="hk-input-element"
              {...filteredAttrs.value}
              onInput={onInput}
              onFocus={(e) => { forwardFocus(true); emit("focus", e); }}
              onBlur={(e) => { forwardFocus(false); emit("blur", e); }}
              onKeydown={(e) => {
                if (
                  e.key === "Enter" &&
                  !e.isComposing &&
                  !e.ctrlKey &&
                  !e.metaKey &&
                  !e.altKey &&
                  !e.shiftKey &&
                  !props.disabled &&
                  !props.readonly
                ) {
                  e.preventDefault();
                  props.submitOnEnter?.();
                }
                emit("keydown", e);
              }}
            />
          ) : (
            <textarea
              ref={inputRef}
              value={props.modelValue}
              placeholder={nativePlaceholder.value}
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
                isAutoGrow.value ? "hk-input-textarea-autogrow" : "",
              ]}
              {...filteredAttrs.value}
              onInput={onInput}
              onFocus={(e) => { forwardFocus(true); emit("focus", e); }}
              onBlur={(e) => { forwardFocus(false); emit("blur", e); }}
              onKeydown={(e) => {
                if (
                  e.key === "Enter" &&
                  !e.isComposing &&
                  !e.ctrlKey &&
                  !e.metaKey &&
                  !e.altKey &&
                  !e.shiftKey &&
                  !props.disabled &&
                  !props.readonly
                ) {
                  e.preventDefault();
                  props.submitOnEnter?.();
                }
                emit("keydown", e);
              }}
            />
          )}
          {props.placeholder &&
            props.placeholderVariant === "marquee" &&
            isEmpty.value &&
            !props.disabled && (
              <HkPlaceholderMarquee
                ref={marqueeRef}
                text={props.placeholder}
                variant={props.placeholderVariant}
                onOverflowChange={(v: boolean) => {
                  placeholderOverflows.value = v;
                }}
              />
            )}
          {slots.suffix && (
            <span ref={suffixAffixRef} class="hk-input-affix hk-input-suffix">
              {slots.suffix()}
            </span>
          )}
          {slots.suffixIcon && !slots.suffix && (
            <span ref={suffixAffixRef} class="hk-input-affix hk-input-suffix">
              {slots.suffixIcon()}
            </span>
          )}
          {props.variant === "password" && !slots.suffix && !slots.suffixIcon && (
            <span ref={suffixAffixRef} class="hk-input-affix hk-input-suffix">
              <button
                type="button"
                class="hk-input-password-toggle"
                aria-label={
                  revealing.value
                    ? t("hikari::input.hidePassword", "Hide password")
                    : t("hikari::input.showPassword", "Show password")
                }
                onClick={() => { revealing.value = !revealing.value; }}
              >
                {revealing.value ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
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
