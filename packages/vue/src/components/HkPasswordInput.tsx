import {
  computed,
  defineComponent,
  onMounted,
  onUnmounted,
  ref,
  watch,
  type PropType,
} from "vue";

import { useI18n } from "../i18n/context";

import { onFrame, onceFrame, type AnimationHandle } from "../runtime/animationBus";
import { scheduleCronAfter, type CronHandle } from "../runtime/cronBus";
import { scheduleInterval, type IntervalHandle } from "../runtime/intervalBus";

import HListTransition from "./HkListTransition";
import { HkPlaceholderMarquee, type PlaceholderVariant } from "./HkPlaceholderMarquee";
import "./HkPasswordInput.scss";

interface Ripple {
  radius: number;
  peak: number;
}

type PasswordVariant = "password" | "confirm";
type PasswordIcon = PasswordVariant | "custom";

export default defineComponent({
  name: "HkPasswordInput",
  props: {
    modelValue: { type: String, default: "" },
    /**
     * Placeholder shown when the field is empty and unfocused. When empty,
     * the component falls back to the `variant` default from hikari's own
     * i18n (`hikari::passwordInput.placeholderPassword` /
     * `hikari::passwordInput.placeholderConfirm`). Custom text is usually
     * obtained from the caller's i18n `t()` function, e.g.
     * `:placeholder="t('auth.register.confirmPassword')"`.
     */
    placeholder: { type: String, default: "" },
    /**
     * Overflow strategy when the placeholder text is longer than the field:
     * `marquee` scrolls it like a storefront sign (three copies through a
     * clipping window, driven by the animation bus — same semantics as
     * HkInput); `truncate` hard-cuts it with an ellipsis. Defaults to
     * `truncate` because the password field already renders a custom
     * centered placeholder layer with its own focus states.
     */
    placeholderVariant: {
      type: String as () => PlaceholderVariant,
      default: "truncate",
    },
    /**
     * Selects the default placeholder text and default icon. Only a
     * fallback: an explicit `placeholder` or `icon` prop overrides the
     * variant default. `confirm` pairs the confirm placeholder with a
     * shield-with-check icon so a second field can be visually distinct.
     */
    variant: { type: String as PropType<PasswordVariant>, default: "password" },
    /**
     * Overrides the leading icon. `password` renders the lock, `confirm`
     * renders a shield-with-check, and `custom` renders the `#icon` slot so
     * callers can inject any SVG. Defaults to following `variant`.
     */
    icon: { type: String as PropType<PasswordIcon>, default: undefined },
    label: { type: String, default: undefined },
    error: { type: String, default: undefined },
    hint: { type: String, default: undefined },
    disabled: { type: Boolean, default: false },
    readonly: { type: Boolean, default: false },
    required: { type: Boolean, default: false },
    name: { type: String, default: undefined },
    autocomplete: { type: String, default: undefined },
    strength: { type: Boolean, default: false },
    passwordEnteredText: { type: String, default: undefined },
    allSelectedText: { type: String, default: undefined },
    capsLockText: { type: String, default: undefined },
    /**
     * Submit intent on Enter (no modifiers). Auth forms wire this to their
     * submit handler so pressing Enter in the password field logs in —
     * the native form-submit path does not fire because the visible action
     * button is type="button".
     */
    submitOnEnter: { type: Function, default: undefined },
    fullWidthWarningText: { type: String, default: undefined },
  },
  emits: {
    "update:modelValue": (_value: string) => true,
    focus: (_e: FocusEvent) => true,
    blur: (_e: FocusEvent) => true,
    keydown: (_e: KeyboardEvent) => true,
  },
  setup(props, { emit, slots }) {
    const { t } = useI18n();
    const inputRef = ref<HTMLInputElement>();
    const dotCanvasRef = ref<HTMLCanvasElement>();
    const boxRef = ref<HTMLElement>();
    const focused = ref(false);
    const capsLock = ref(false);
    const fullWidthPaused = ref(false);
    const allSelected = ref(false);
    const composing = ref(false);
    const preComposeValue = ref("");
    const revealing = ref(false);
    const pendingClear = ref(false);
    // Flipped by the opt-in marquee overlay when the placeholder actually
    // overflows — the static text below is then hidden so the scrolling
    // copies do not overprint it.
    const marqueeOverflow = ref(false);
    let lastInputAt = 0;

    const level = computed(() => {
      if (!props.strength || !props.modelValue) return null;
      const v = props.modelValue;
      let score = 0;
      if (v.length >= 8) score++;
      if (/[a-z]/.test(v) && /[A-Z]/.test(v)) score++;
      if (/\d/.test(v)) score++;
      if (/[^a-zA-Z0-9]/.test(v)) score++;
      if (v.length >= 14) score++;
      if (score <= 1) return "weak";
      if (score <= 2) return "fair";
      if (score <= 3) return "strong";
      return "strong";
    });

    const levelLabel = computed(() => {
      const lv = level.value;
      if (!lv) return "";
      if (lv === "weak") return t("hikari::passwordInput.strengthWeak", "Weak");
      if (lv === "fair") return t("hikari::passwordInput.strengthFair", "Fair");
      return t("hikari::passwordInput.strengthStrong", "Strong");
    });

    const resolvedIcon = computed<PasswordIcon>(
      () => props.icon ?? props.variant,
    );

    const variantPlaceholderKey = computed(() =>
      props.variant === "confirm"
        ? "hikari::passwordInput.placeholderConfirm"
        : "hikari::passwordInput.placeholderPassword",
    );

    function startReveal() {
      if (!props.modelValue || props.disabled) return;
      revealing.value = true;
      document.addEventListener("pointerup", endReveal, { once: true });
      document.addEventListener("pointercancel", endReveal, { once: true });
    }

    function endReveal() {
      revealing.value = false;
      document.removeEventListener("pointerup", endReveal);
      document.removeEventListener("pointercancel", endReveal);
    }

    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const ROWS = 3;
    const GAP = 8;
    const DOT_R = 2.2;
    const SIGMA = 2.8;
    // Time-driven animation budget: the ripple ring sweeps the whole dot
    // grid and its peak fades out within 0.3s, regardless of box size.
    const RIPPLE_SWEEP_S = 0.3;
    const PEAK_DECAY_S = 0.3;
    const R_WIDTH = 1.3;
    const R_BOOST = 0.7;
    const PEAK_SPEED = 1 / PEAK_DECAY_S;

    let COLS = 11;
    let R_SPEED = 0;
    let dists: number[][] = [];
    let MAX_D = 1;
    let rgb: [number, number, number] = [88, 166, 255];

    function rebuildGrid(cols: number) {
      if (cols < 3) cols = 3;
      if (cols % 2 === 0) cols--;
      COLS = cols;
      const cc = (COLS - 1) / 2;
      const cr = (ROWS - 1) / 2;
      dists = [];
      for (let r = 0; r < ROWS; r++) {
        dists[r] = [];
        for (let c = 0; c < COLS; c++) {
          const dx = c - cc,
            dy = r - cr;
          dists[r][c] = Math.sqrt(dx * dx + dy * dy);
        }
      }
      MAX_D = Math.sqrt(cc * cc + cr * cr);
      R_SPEED = (MAX_D + R_WIDTH + 0.5) / RIPPLE_SWEEP_S;
    }

    rebuildGrid(11);

    const ripples: Ripple[] = [];
    let ro: ResizeObserver | null = null;

    function syncColor() {
      try {
        const raw = getComputedStyle(document.documentElement)
          .getPropertyValue("--hi-color-primary-rgb")
          .trim();
        if (!raw) {
          const hex = getComputedStyle(document.documentElement)
            .getPropertyValue("--hi-color-primary")
            .trim();
          if (hex.startsWith("#")) {
            rgb = [
              parseInt(hex.slice(1, 3), 16),
              parseInt(hex.slice(3, 5), 16),
              parseInt(hex.slice(5, 7), 16),
            ];
            return;
          }
          const ns = hex.split(/[\s,\(\)]+/).map(Number).filter((n) => !isNaN(n));
          if (ns.length >= 3) rgb = [ns[0], ns[1], ns[2]];
          return;
        }
        const ns = raw.split(/\s+/).map(Number);
        if (ns.length >= 3 && ns.every((n) => !isNaN(n)))
          rgb = [ns[0], ns[1], ns[2]];
      } catch {
        // ignore
      }
    }

    function resize() {
      const cv = dotCanvasRef.value;
      const bx = boxRef.value;
      if (!cv || !bx) return;
      const { width, height } = bx.getBoundingClientRect();
      cv.width = width * dpr;
      cv.height = height * dpr;
      const usable = width * 0.8;
      const cols = Math.max(3, Math.floor(usable / GAP) + 1);
      rebuildGrid(cols);
    }

    function draw(dt: number) {
      const cv = dotCanvasRef.value;
      if (!cv) return;
      const ctx = cv.getContext("2d");
      if (!ctx) return;
      const W = cv.width,
        H = cv.height;
      ctx.clearRect(0, 0, W, H);

      if (revealing.value) return;

      const [pr, pg, pb] = rgb;
      const hasVal = !!props.modelValue;
      const foc = focused.value;

      const gW = (COLS - 1) * GAP;
      const gH = (ROWS - 1) * GAP;
      const aW = W / dpr;
      const aH = H / dpr;
      const ox = (aW - gW) / 2;
      const oy = (aH - gH) / 2;

      const emptyBase = foc ? 0.18 : 0.08;
      const filledResting = foc ? 0.55 : 0.35;

      const totalPeak = ripples.reduce((s, rp) => s + rp.peak, 0);

      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const d = dists[r][c];
          let a: number;
          if (!hasVal) {
            a = emptyBase;
          } else {
            const radial = Math.exp(-(d * d) / (2 * SIGMA * SIGMA));
            const rest = radial * filledResting;
            const peak = radial * totalPeak;
            a = Math.min(1, rest + peak);
          }
          for (let ri = 0; ri < ripples.length; ri++) {
            const rr = ripples[ri].radius;
            a = Math.min(
              1,
              a + Math.max(0, 1 - Math.abs(d - rr) / R_WIDTH) * R_BOOST,
            );
          }
          ctx.beginPath();
          ctx.arc(
            (ox + c * GAP) * dpr,
            (oy + r * GAP) * dpr,
            Math.max(0.5, DOT_R * dpr),
            0,
            Math.PI * 2,
          );
          ctx.fillStyle = `rgba(${pr},${pg},${pb},${a.toFixed(3)})`;
          ctx.fill();
        }
      }

      for (let i = ripples.length - 1; i >= 0; i--) {
        const rp = ripples[i];
        rp.radius += R_SPEED * dt;
        rp.peak = Math.max(0, rp.peak - PEAK_SPEED * dt);
        if (rp.radius > MAX_D + R_WIDTH + 0.5 && rp.peak <= 0) {
          ripples.splice(i, 1);
        }
      }
    }

    let loopHandle: AnimationHandle | null = null;

    function startLoop() {
      if (loopHandle) return;
      // The ripple canvas runs on the shared animation bus at "normal"
      // priority so the reduced-motion switch parks it like every other
      // JS-driven animation. The draw callback clamps the delta exactly
      // like the old self-scheduling rAF loop did.
      loopHandle = onFrame((ctx) => {
        draw(ctx.delta); // the bus already clamps per-entry delta to MAX_DELTA
      }, "normal");
    }

    function stopLoop() {
      loopHandle?.disconnect();
      loopHandle = null;
    }

    function kickRipple() {
      ripples.push({ radius: 0, peak: 1 });
    }

    function clearAndFocus() {
      if (props.disabled || props.readonly) return;
      emit("update:modelValue", "");
      inputRef.value?.focus();
    }

    let flashHandle: CronHandle | null = null;

    function flash() {
      const el = boxRef.value;
      if (!el) return;
      el.removeAttribute("data-flash");
      void el.offsetWidth;
      el.setAttribute("data-flash", "");
      // cronBus one-shot (not the rAF-driven animationBus one) so the
      // attribute cleanup always fires — the animation bus is parked
      // under reduced motion and the flash must never stick.
      flashHandle?.disconnect();
      flashHandle = scheduleCronAfter(() => {
        flashHandle = null;
        el.removeAttribute("data-flash");
      }, 320);
      kickRipple();
    }

    function checkSelection() {
      const el = inputRef.value;
      if (!el || !el.value) {
        allSelected.value = false;
        return;
      }
      allSelected.value =
        el.selectionStart === 0 && el.selectionEnd === el.value.length;
    }

    const FW_RE = /[\uFF01-\uFF5E\u3000]/;

    function onInput(e: Event) {
      const t = e.target as HTMLInputElement;
      lastInputAt = performance.now();
      if (composing.value) return;
      if (pendingClear.value) {
        // Fallback for engines without beforeinput: keep only the part
        // typed beyond the old password, or start over on any other edit.
        pendingClear.value = false;
        const old = props.modelValue;
        if (old && t.value.startsWith(old) && t.value.length > old.length) {
          t.value = t.value.slice(old.length);
        } else {
          t.value = "";
        }
      }
      const v = t.value;
      if (FW_RE.test(v)) {
        const clean = v.replace(FW_RE, "");
        t.value = clean;
        emit("update:modelValue", clean);
        fullWidthPaused.value = true;
        allSelected.value = false;
        return;
      }
      fullWidthPaused.value = false;
      allSelected.value = false;
      emit("update:modelValue", v);
      flash();
      if (!v) {
        // Deleting down to empty can lose focus to an extension/IME bubble
        // in real browsers. Reclaim focus if nothing else has it.
        const el = inputRef.value;
        if (el && document.activeElement !== el) {
          queueMicrotask(() => {
            if (document.activeElement !== el && !props.disabled) {
              el.focus();
            }
          });
        }
      }
    }

    function onKeydown(e: KeyboardEvent) {
      if (e.getModifierState) capsLock.value = e.getModifierState("CapsLock");
      if (e.ctrlKey || e.metaKey) {
        onceFrame(() => checkSelection());
      }
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
    }

    function onKeyup(e: KeyboardEvent) {
      if (e.getModifierState) capsLock.value = e.getModifierState("CapsLock");
      checkSelection();
    }

    function onBeforeinput(e: InputEvent) {
      if (!pendingClear.value) return;
      const inputType = e.inputType || "";
      if (!inputType.startsWith("insert") && !inputType.startsWith("delete")) {
        return;
      }
      const el = inputRef.value;
      if (!el) return;
      pendingClear.value = false;
      // The old password is only a placeholder for the next input: typing
      // (or pasting) starts from an empty field, and deleting clears the
      // whole field instead of nibbling one dot of the old value.
      el.value = "";
      emit("update:modelValue", "");
      if (inputType.startsWith("delete")) {
        e.preventDefault();
        kickRipple();
      }
    }

    function onFocus(e: FocusEvent) {
      focused.value = true;
      if (props.modelValue && !props.readonly && !props.disabled) {
        // Keep the entered password on refocus instead of wiping it: the
        // field now shows a focused placeholder and clears the old value
        // only once the user actually starts typing.
        pendingClear.value = true;
      } else {
        pendingClear.value = false;
        checkAutofill();
      }
      emit("focus", e);
    }

    function onBlur(e: FocusEvent) {
      focused.value = false;
      pendingClear.value = false;
      // If the blur lands within a short window after the last input
      // event (e.g. an extension/IME yanks focus when the field is
      // cleared to empty), reclaim focus. A blur that hands focus to
      // another element (Tab navigation or a click on a focusable
      // control) is deliberate and must not be reclaimed.
      if (
        performance.now() - lastInputAt < 300 &&
        !props.disabled &&
        !props.readonly &&
        !e.relatedTarget
      ) {
        const el = inputRef.value;
        if (el) {
          // cronBus one-shot: the reclaim must run even under reduced
          // motion, where the animation bus is parked.
          focusReclaimHandle?.disconnect();
          focusReclaimHandle = scheduleCronAfter(() => {
            focusReclaimHandle = null;
            el.focus();
          }, 0);
        }
      }
      capsLock.value = false;
      fullWidthPaused.value = false;
      allSelected.value = false;
      // Some IMEs never fire compositionend when the field loses focus
      // mid-composition (or after deleting the whole composed text). A
      // stuck `composing` flag swallows every later onInput — the user
      // clears the field, the placeholder never comes back and typing
      // stops working. Reset the flag and sync any uncommitted value so
      // the model stays in lockstep with the real input.
      if (composing.value) {
        composing.value = false;
        const el = inputRef.value;
        if (el && el.value !== props.modelValue) {
          emit("update:modelValue", el.value);
        }
      }
      checkAutofill();
      emit("blur", e);
    }

    function checkAutofill() {
      const el = inputRef.value;
      if (!el) return;
      if (el.value && !props.modelValue) {
        emit("update:modelValue", el.value);
        flash();
      }
    }

    function onCompositionStart() {
      composing.value = true;
      preComposeValue.value = inputRef.value?.value ?? "";
      fullWidthPaused.value = true;
    }

    function onCompositionEnd() {
      composing.value = false;
      let v = inputRef.value?.value ?? "";
      if (pendingClear.value) {
        // Same fallback as onInput for engines without beforeinput.
        pendingClear.value = false;
        const old = props.modelValue;
        if (old && v.startsWith(old) && v.length > old.length) {
          v = v.slice(old.length);
          if (inputRef.value) inputRef.value.value = v;
        } else if (old) {
          v = "";
          if (inputRef.value) inputRef.value.value = "";
        }
      }
      if (FW_RE.test(v.slice(preComposeValue.value.length))) {
        if (inputRef.value) inputRef.value.value = preComposeValue.value;
        emit("update:modelValue", preComposeValue.value);
        fullWidthPaused.value = true;
        allSelected.value = false;
        return;
      }
      fullWidthPaused.value = false;
      allSelected.value = false;
      emit("update:modelValue", v);
      flash();
      if (!v) {
        // Deleting down to empty can lose focus to an extension/IME bubble
        // in real browsers. Reclaim focus if nothing else has it.
        const el = inputRef.value;
        if (el && document.activeElement !== el) {
          queueMicrotask(() => {
            if (document.activeElement !== el && !props.disabled) {
              el.focus();
            }
          });
        }
      }
    }

    function onSelect() {
      checkSelection();
    }

    function onAutofillAnim(_e: AnimationEvent) {
      const el = inputRef.value;
      if (!el) return;
      if (el.value && el.value !== props.modelValue) {
        emit("update:modelValue", el.value);
        flash();
      }
    }

    function onPointerup() {
      onceFrame(() => checkSelection());
    }

    let autofillHandle: IntervalHandle | null = null;
    let focusReclaimHandle: CronHandle | null = null;

    watch(() => props.modelValue, (v) => {
      // An external clear (or the blur hint's clear-and-focus) must drop
      // the pending-clear state so the placeholder falls back to the
      // waiting-for-input message.
      if (!v) pendingClear.value = false;
    });

    onMounted(() => {
      syncColor();
      resize();
      ro = new ResizeObserver(resize);
      if (boxRef.value) ro.observe(boxRef.value);
      startLoop();
      // Visibility-aware poll (intervalBus parks while hidden, unlike a
      // raw setInterval that keeps burning in background tabs).
      autofillHandle = scheduleInterval(() => {
        if (!focused.value) checkAutofill();
      }, 500);
    });

    onUnmounted(() => {
      stopLoop();
      autofillHandle?.disconnect();
      autofillHandle = null;
      flashHandle?.disconnect();
      flashHandle = null;
      focusReclaimHandle?.disconnect();
      focusReclaimHandle = null;
      if (ro) ro.disconnect();
      endReveal();
    });

    return () => (
      <div class="hk-pwd-wrapper">
        {props.label ? (
          <label class="hk-pwd-label">
            {props.label}
            {props.required ? <span class="hk-pwd-required">*</span> : null}
          </label>
        ) : null}
        <div
          ref={boxRef}
          class="hk-pwd-box"
          data-focused={focused.value || undefined}
          data-error={props.error || undefined}
          data-disabled={props.disabled || undefined}
          data-fw={fullWidthPaused.value || undefined}
        >
          <div
            class={[
              "hk-pwd-lock",
              props.modelValue ? "hk-pwd-lock-filled" : "hk-pwd-lock-empty",
            ]}
            data-icon={resolvedIcon.value}
            data-revealing={revealing.value || undefined}
            onPointerdown={(e: PointerEvent) => {
              e.preventDefault();
              startReveal();
            }}
          >
            {resolvedIcon.value === "custom" ? (
              slots.icon?.()
            ) : resolvedIcon.value === "confirm" ? (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                width="16"
                height="16"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
            ) : (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                width="16"
                height="16"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            )}
          </div>
          <canvas ref={dotCanvasRef} class="hk-pwd-dots" />
          {(!props.modelValue || (pendingClear.value && focused.value)) &&
          !revealing.value ? (
            <span
              key={`ph-${pendingClear.value && props.modelValue ? "has-value" : focused.value ? "focused" : "idle"}`}
              class="hk-pwd-placeholder"
              onPointerdown={(e: PointerEvent) => {
                // Tapping the placeholder refocuses the field — after an
                // extension or IME steals focus the input otherwise stops
                // responding to typing.
                e.preventDefault();
                inputRef.value?.focus();
              }}
            >
              <span
                class="hk-pwd-placeholder-text"
                style={
                  props.placeholderVariant === "marquee" && marqueeOverflow.value
                    ? { visibility: "hidden" }
                    : undefined
                }
              >
                {pendingClear.value && props.modelValue
                  ? t("hikari::passwordInput.focusedHasValuePlaceholder")
                  : focused.value
                    ? t("hikari::passwordInput.focusedPlaceholder")
                    : props.placeholder || t(variantPlaceholderKey.value)}
              </span>
              {props.placeholderVariant === "marquee" && (
                <HkPlaceholderMarquee
                  text={
                    pendingClear.value && props.modelValue
                      ? t("hikari::passwordInput.focusedHasValuePlaceholder")
                      : focused.value
                        ? t("hikari::passwordInput.focusedPlaceholder")
                        : props.placeholder || t(variantPlaceholderKey.value)
                  }
                  variant={props.placeholderVariant}
                  onOverflowChange={(v: boolean) => {
                    marqueeOverflow.value = v;
                  }}
                />
              )}
            </span>
          ) : null}
          {props.modelValue &&
          !focused.value &&
          !revealing.value &&
          !pendingClear.value ? (
            <span
              class="hk-pwd-blur-hint"
              onPointerdown={(e: PointerEvent) => {
                e.preventDefault();
                clearAndFocus();
              }}
            >
              {props.passwordEnteredText ??
                t("hikari::passwordInput.passwordEntered")}
            </span>
          ) : null}
          {focused.value && allSelected.value ? (
            <span class="hk-pwd-select-hint">
              {props.allSelectedText ?? t("hikari::passwordInput.allSelected")}
            </span>
          ) : null}
          {revealing.value ? (
            <span class="hk-pwd-reveal-text">{props.modelValue}</span>
          ) : null}
          <input
            ref={inputRef}
            type="password"
            value={props.modelValue}
            name={props.name}
            autocomplete={props.autocomplete ?? "off"}
            data-1p-ignore
            data-lpignore="true"
            disabled={props.disabled}
            readonly={props.readonly}
            required={props.required}
            class="hk-pwd-input"
            onInput={onInput}
            onBeforeinput={onBeforeinput}
            onFocus={onFocus}
            onBlur={onBlur}
            onKeydown={onKeydown}
            onKeyup={onKeyup}
            onSelect={onSelect}
            onPointerup={onPointerup}
            onCompositionstart={onCompositionStart}
            onCompositionend={onCompositionEnd}
            onAnimationstart={onAutofillAnim}
          />
          {level.value ? (
            <span
              class="hk-pwd-strength"
              data-level={level.value}
              title={levelLabel.value}
              aria-label={levelLabel.value}
            />
          ) : null}
        </div>
        <div class="hk-pwd-hints">
          <HListTransition tag="div">
            {capsLock.value ? (
              <span key="caps" class="hk-pwd-hint" data-variant="caps">
                {props.capsLockText ?? t("hikari::passwordInput.capsLock")}
              </span>
            ) : null}
          </HListTransition>
          <HListTransition tag="div">
            {fullWidthPaused.value ? (
              <span key="fw" class="hk-pwd-hint" data-variant="fw">
                {props.fullWidthWarningText ??
                  t("hikari::passwordInput.fullWidth")}
              </span>
            ) : null}
          </HListTransition>
        </div>
        {props.error ? (
          <p class="hk-pwd-error">{props.error}</p>
        ) : props.hint ? (
          <p class="hk-pwd-hint-text">{props.hint}</p>
        ) : null}
      </div>
    );
  },
});
