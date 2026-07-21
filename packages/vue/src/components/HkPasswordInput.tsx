import {
  computed,
  defineComponent,
  onMounted,
  onUnmounted,
  ref,
  watch,
} from "vue";

import HkListTransition from "./HkListTransition";
import "./HkPasswordInput.scss";

interface Ripple {
  radius: number;
  peak: number;
}

export default defineComponent({
  name: "HkPasswordInput",
  props: {
    modelValue: { type: String, default: "" },
    placeholder: { type: String, default: "" },
    label: { type: String, default: undefined },
    error: { type: String, default: undefined },
    hint: { type: String, default: undefined },
    disabled: { type: Boolean, default: false },
    readonly: { type: Boolean, default: false },
    required: { type: Boolean, default: false },
    name: { type: String, default: undefined },
    autocomplete: { type: String, default: undefined },
    strength: { type: Boolean, default: false },
    passwordEnteredText: { type: String, default: "Password entered" },
    allSelectedText: { type: String, default: "All selected" },
    capsLockText: { type: String, default: "Caps Lock is on" },
    fullWidthWarningText: { type: String, default: "Full-width characters not allowed" },
  },
  emits: {
    "update:modelValue": (_value: string) => true,
    focus: (_e: FocusEvent) => true,
    blur: (_e: FocusEvent) => true,
    keydown: (_e: KeyboardEvent) => true,
  },
  setup(props, { emit }) {
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
      return lv.charAt(0).toUpperCase() + lv.slice(1);
    });

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
    const R_SPEED = 0.22;
    const R_WIDTH = 1.3;
    const R_BOOST = 0.7;
    const PEAK_SPEED = 0.02;

    let COLS = 11;
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
    }

    rebuildGrid(11);

    const ripples: Ripple[] = [];
    let rafId: number | null = null;
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

    function draw() {
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
        rp.radius += R_SPEED;
        rp.peak = Math.max(0, rp.peak - PEAK_SPEED);
        if (rp.radius > MAX_D + R_WIDTH + 0.5 && rp.peak <= 0) {
          ripples.splice(i, 1);
        }
      }
    }

    let running = false;

    function loop() {
      draw();
      rafId = requestAnimationFrame(loop);
    }

    function startLoop() {
      if (running) return;
      running = true;
      loop();
    }

    function stopLoop() {
      running = false;
      if (rafId != null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    }

    function kickRipple() {
      ripples.push({ radius: 0, peak: 1 });
    }

    function clearAndFocus() {
      if (props.disabled || props.readonly) return;
      emit("update:modelValue", "");
      inputRef.value?.focus();
    }

    function flash() {
      const el = boxRef.value;
      if (!el) return;
      el.removeAttribute("data-flash");
      void el.offsetWidth;
      el.setAttribute("data-flash", "");
      setTimeout(() => el.removeAttribute("data-flash"), 320);
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
      if (composing.value) return;
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
    }

    function onKeydown(e: KeyboardEvent) {
      if (e.getModifierState) capsLock.value = e.getModifierState("CapsLock");
      if (e.ctrlKey || e.metaKey) {
        requestAnimationFrame(() => checkSelection());
      }
      emit("keydown", e);
    }

    function onKeyup(e: KeyboardEvent) {
      if (e.getModifierState) capsLock.value = e.getModifierState("CapsLock");
      checkSelection();
    }

    function onFocus(e: FocusEvent) {
      focused.value = true;
      if (props.modelValue && !props.readonly) {
        emit("update:modelValue", "");
        if (inputRef.value) inputRef.value.value = "";
        kickRipple();
      } else {
        checkAutofill();
      }
      emit("focus", e);
    }

    function onBlur(e: FocusEvent) {
      focused.value = false;
      capsLock.value = false;
      fullWidthPaused.value = false;
      allSelected.value = false;
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
      const v = inputRef.value?.value ?? "";
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
      requestAnimationFrame(() => checkSelection());
    }

    let autofillInterval: ReturnType<typeof setInterval> | null = null;

    watch([() => props.modelValue, focused, revealing], () => {
      // kick a draw on state change
    });

    onMounted(() => {
      syncColor();
      resize();
      ro = new ResizeObserver(resize);
      if (boxRef.value) ro.observe(boxRef.value);
      startLoop();
      autofillInterval = setInterval(() => {
        if (!focused.value) checkAutofill();
      }, 500);
    });

    onUnmounted(() => {
      stopLoop();
      if (autofillInterval) clearInterval(autofillInterval);
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
              props.modelValue ? "hk-pwd-lock--filled" : "hk-pwd-lock--empty",
            ]}
            data-revealing={revealing.value || undefined}
            onPointerdown={(e: PointerEvent) => {
              e.preventDefault();
              startReveal();
            }}
          >
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
          </div>
          <canvas ref={dotCanvasRef} class="hk-pwd-dots" />
          {!props.modelValue && !revealing.value ? (
            <span class="hk-pwd-placeholder">{props.placeholder}</span>
          ) : null}
          {props.modelValue && !focused.value && !revealing.value ? (
            <span
              class="hk-pwd-blur-hint"
              onPointerdown={(e: PointerEvent) => {
                e.preventDefault();
                clearAndFocus();
              }}
            >
              {props.passwordEnteredText}
            </span>
          ) : null}
          {focused.value && allSelected.value ? (
            <span class="hk-pwd-select-hint">{props.allSelectedText}</span>
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
          <HkListTransition tag="div">
            {capsLock.value ? (
              <span key="caps" class="hk-pwd-hint" data-variant="caps">
                {props.capsLockText}
              </span>
            ) : null}
          </HkListTransition>
          <HkListTransition tag="div">
            {fullWidthPaused.value ? (
              <span key="fw" class="hk-pwd-hint" data-variant="fw">
                {props.fullWidthWarningText}
              </span>
            ) : null}
          </HkListTransition>
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
