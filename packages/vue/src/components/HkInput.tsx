import { computed, defineComponent, nextTick, onBeforeUnmount, onMounted, ref, useAttrs, useId, watch, type PropType } from "vue";

import type { PasswordStrengthEvaluator } from "../utils/password";

import { HkPlaceholderMarquee } from "./HkPlaceholderMarquee";
import HkPasswordSurface from "./HkPasswordSurface";
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
    /**
     * `id` for the field element; the rendered label's `for` points here.
     * Generated via Vue's useId when omitted, so a bare `label` prop is
     * fully associated for screen readers and label clicks with zero
     * caller effort.
     */
    id: { type: String, default: undefined },
    /**
     * Native spellcheck toggle. Undefined keeps the browser default;
     * `false` is the right call for exact-literal entry fields (type-
     * to-confirm gates, addresses, serial paths) where the red squiggle
     * under correct input reads as an error.
     */
    spellcheck: { type: Boolean, default: undefined },
    /** Submit intent on Enter (no modifiers) — shared by every variant
     * (the password surface intercepts Enter the same way). */
    submitOnEnter: { type: Function, default: undefined },
    /** Undefined keeps the element attribute off in the browser for the
     * password variant (where the runtime credential policy resolves
     * it); every other variant falls back to "off". */
    autocomplete: { type: String, default: undefined },
    rows: { type: Number, default: 3 },
    autoGrow: { type: Boolean, default: false },
    size: { type: String as () => "sm" | "md" | "lg", default: "md" },
    /**
     * Input variant. `password` renders the hikari password surface:
     * the canvas dot matrix with input ripples, the centered breathing
     * placeholder, caps-lock / full-width hints, and a selectable
     * right-edge affordance (`passwordTrailing`). `number` maps to the
     * numeric input type. Defaults to "text".
     */
    variant: {
      type: String as () => "text" | "password" | "number",
      default: "text",
    },
    /**
     * Right-edge affordance for `variant="password"`:
     * - "eye" (default): hold-to-reveal button. While held, the canvas
     *   renders a counter-drifting noise kinematogram instead of the
     *   dot matrix: the noise through the password glyphs drifts one
     *   way, the background noise the opposite way — readable by
     *   motion to a human, pure noise (nothing to OCR) in any single
     *   screenshot. Reduced motion falls back to the legacy static
     *   per-glyph jitter; release restores the dots.
     * - "strength": the traffic-light dot (weak / fair / strong via the
     *   shared `passwordLevel` classifier, overridable through
     *   `strengthEvaluator`) with a localized tooltip on hover and on
     *   touch tap. The usual choice for registration fields.
     * - "none": no right-edge affordance at all.
     */
    passwordTrailing: {
      type: String as () => "eye" | "strength" | "none",
      default: "eye",
    },
    /**
     * Overrides the built-in password strength classifier
     * (`passwordLevel` from `@celestia-island/hikari`). Only consulted
     * while `passwordTrailing` is "strength".
     */
    strengthEvaluator: {
      type: Function as PropType<PasswordStrengthEvaluator>,
      default: undefined,
    },
    /**
     * Horizontal alignment of the text line. The centered default
     * reserves affix clearance SYMMETRICALLY — both sides grow by the
     * max of the measured affix widths — so the centered caret, typed
     * text and placeholders stay on the box axis no matter which side
     * carries an icon. `start` / `end` are the explicit edge
     * alignments: they opt out of the symmetric reservation and pad
     * each side only by the affix actually sitting on it.
     */
    align: {
      type: String as () => "center" | "start" | "end",
      default: "center",
    },
    /**
     * Overflow strategy for a placeholder longer than the input line:
     * `marquee` (default) scrolls it like a storefront sign — the text is
     * rendered three times inside a clipping window and the strip travels
     * through a registered pure-CSS keyframes animation (loop geometry on
     * inline custom properties, no per-frame JS — see
     * HkPlaceholderMarquee); `truncate` hard-cuts it with an ellipsis.
     * The marquee parks while the input is focused or holds a value, and
     * under reduced-motion the strip stays parked.
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
    const attrs = useAttrs();
    const inputRef = ref<HTMLElement>();

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

    // The password variant never renders the native element path — it
    // delegates to HkPasswordSurface, which keeps the real input
    // type="password" at all times (the reveal pass draws on the canvas,
    // so the DOM value is never exposed as text).
    const resolvedType = computed(() => {
      if (props.variant === "number") return "number";
      return props.type;
    });

    const filteredAttrs = computed(() => {
      const { class: _, style: __, ...rest } = attrs as Record<string, unknown>;
      return rest;
    });

    // Field identity: the rendered label points at this id, so a bare
    // `label` prop gives a fully associated field (screen readers, label
    // clicks) without caller effort. An explicit `id` prop wins.
    // useId() must run synchronously in setup; it is SSR-safe.
    const generatedId = useId();
    const fieldId = computed(() => props.id ?? generatedId);

    // ── affix width reservation ──────────────────────────────────────
    // The input element overlays the WHOLE box (absolute inset:0) while
    // the prefix/suffix affixes flow above it — so centered text, the
    // native placeholder and the placeholder-marquee window would run
    // underneath the affixes (the localized input's language chip used
    // to catch the scrolling placeholder). Both affixes are measured
    // and published as custom properties on the box; the element's
    // horizontal padding and the marquee window insets consume them.
    // The CSS keys off the alignment: the centered default reserves
    // max(start, end) on BOTH sides so the content box stays symmetric
    // about the box axis (a lone prefix icon must not push the
    // centered line off-center), while an explicit data-align="start"
    // / "end" pads each side only by its own affix.
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
    // The password variant renders its own surface (dot-matrix canvas,
    // placeholder layers, hints, right-edge affordance) — it does not
    // flow through the native input/textarea branch below.
    const isPassword = computed(() => props.variant === "password");

    return () => (
      <div class="hk-input-wrapper">
        {props.label && (
          <label class="hk-input-label" for={fieldId.value}>
            {props.label}
            {props.required && <span class="hk-input-required">*</span>}
          </label>
        )}
        {isPassword.value ? (
          <HkPasswordSurface
            {...filteredAttrs.value}
            modelValue={props.modelValue}
            onUpdate:modelValue={(v: string) => emit("update:modelValue", v)}
            onFocus={(e: FocusEvent) => emit("focus", e)}
            onBlur={(e: FocusEvent) => emit("blur", e)}
            onKeydown={(e: KeyboardEvent) => emit("keydown", e)}
            placeholder={props.placeholder}
            placeholderVariant={props.placeholderVariant}
            disabled={props.disabled}
            readonly={props.readonly}
            required={props.required}
            error={!!props.error}
            name={props.name}
            autocomplete={props.autocomplete}
            id={fieldId.value}
            submitOnEnter={props.submitOnEnter}
            passwordTrailing={props.passwordTrailing}
            strengthEvaluator={props.strengthEvaluator}
            size={props.size}
          >
            {/* Slot forwarding for the password surface: the affix slots
             * behave exactly like the text variants' (#prefix beats
             * #prefixIcon, #suffix beats #suffixIcon, an explicit suffix
             * suppresses the built-in eye/strength affordance). Keep the
             * children an OBJECT LITERAL or a bare identifier — the
             * runtime _isSlot guard passes both through as slots; a
             * ternary/member/call expression gets array-wrapped into the
             * DEFAULT slot by @vue/babel-plugin-jsx and the surface would
             * silently lose every affix (HkInput.password.test pins this
             * with slot-forwarding cases). An absent caller slot forwards
             * an empty array, which the surface reads as "not provided"
             * (comment-only arrays from v-if'd-out templates included). */}
            {{
              prefix: () => slots.prefix?.() ?? [],
              prefixIcon: () => slots.prefixIcon?.() ?? [],
              suffix: () => slots.suffix?.() ?? [],
              suffixIcon: () => slots.suffixIcon?.() ?? [],
            }}
          </HkPasswordSurface>
        ) : (
        <div
          class={boxClass.value}
          style={boxVars.value}
          data-autogrow={isAutoGrow.value || undefined}
          // Textarea boxes never carry the marker: their element is
          // excluded by :not() anyway, and keeping it off also spares
          // a textarea-scoped marquee from the per-side window insets.
          data-align={
            !isTextarea.value && props.align !== "center" ? props.align : undefined
          }
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
              id={fieldId.value}
              type={resolvedType.value}
              value={props.modelValue}
              placeholder={nativePlaceholder.value}
              disabled={props.disabled}
              readonly={props.readonly}
              spellcheck={props.spellcheck}
              name={props.name}
              autocomplete={props.autocomplete ?? "off"}
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
              id={fieldId.value}
              value={props.modelValue}
              placeholder={nativePlaceholder.value}
              disabled={props.disabled}
              readonly={props.readonly}
              spellcheck={props.spellcheck}
              rows={props.rows}
              name={props.name}
              autocomplete={props.autocomplete ?? "off"}
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
                // Intercept Enter ONLY when the consumer wired a submit
                // intent. A textarea must keep the native newline: the
                // old unconditional preventDefault swallowed plain Enter
                // on every submit-less textarea (chat composers in
                // ctrl-enter mode could never insert a line break — the
                // key just did nothing).
                if (
                  e.key === "Enter" &&
                  props.submitOnEnter &&
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
        </div>
        )}
        {props.error ? (
          <p class="hk-input-error-msg">{props.error}</p>
        ) : props.hint ? (
          <p class="hk-input-hint">{props.hint}</p>
        ) : null}
      </div>
    );
  },
});
