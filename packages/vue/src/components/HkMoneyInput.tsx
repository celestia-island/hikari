// AI-generated: developed with the DeepSeek Harness agent (model DeepSeek V4.1 Flash); human-directed.
import {
  computed,
  defineComponent,
  ref,
  useAttrs,
  useId,
  watch,
  type PropType,
} from "vue";

import { useI18n } from "../i18n/context";
import {
  canonicalMoneyText,
  currencySymbol,
  formatMoney,
  normalizeCurrency,
  parseMoney,
  type HkCurrency,
} from "../utils/currency";
import "./HkMoneyInput.scss";

/**
 * HkMoneyInput — a currency-aware amount field whose model is CANONICAL
 * DECIMAL TEXT (`""`, `"12"`, `"1.5"`, `"-0.25"`: digits, at most one dot,
 * no grouping, no symbol). The host owns that string; this component only
 * converts between it and the human text in the box.
 *
 * ## Why the DOM is never coerced mid-typing
 *
 * A controlled amount field that writes `String(props.modelValue)` back into
 * the input on every keystroke loses the typist: type `1.5` and a parser
 * that normalizes `"1."` → `"1"` rewrites the element under the caret, so the
 * next keystroke lands in a different place (the historical "typed 1.5, got
 * 5" bug). The design rule here is therefore explicit:
 *
 *  - While FOCUSED, the component's own `draft` ref is the source of truth
 *    for the element, and `onInput` assigns the element's EXACT current text
 *    to it — so Vue's patch always writes back the same string and never
 *    moves the caret. `update:modelValue` fires with the canonicalized
 *    text, but the model flowing back does not touch the element while the
 *    field is focused.
 *  - Formatting (grouping + fixed precision) happens on BLUR, and de-
 *    formatting back to canonical text happens on FOCUS. Both are
 *    deliberate points in the interaction, not side effects of typing.
 *  - An empty string is a first-class value ("unset / follow"): it is never
 *    coerced to `0`, and no format pass ever manufactures a number.
 *
 * `min` / `max` are advisory: an out-of-range amount is reported through the
 * localized range message (when the host passes no `error`) and is NEVER
 * clamped behind the user's back — the host decides what an out-of-range
 * amount means. `maxDecimals` defaults to `currency.decimals` and may be
 * larger for per-million rates; it is both the blur precision and the
 * rounding budget of `parseMoney`.
 *
 * A11y: the visible `label` prop is wired with `for`/`id` (Vue `useId` when
 * no `id` is passed), `aria-invalid` follows the error state, and the
 * rendered error line (host `error`, else the internal range/invalid
 * message) is linked through `aria-describedby`.
 */
export default defineComponent({
  name: "HkMoneyInput",
  inheritAttrs: false,
  props: {
    /** Canonical decimal text. `""` means unset. */
    modelValue: { type: String, default: "" },
    /** Supplies the default precision, the in-field symbol, and the range
     *  message's formatting. Omitted: a bare 2-decimal number field. */
    currency: { type: Object as PropType<HkCurrency>, default: undefined },
    /** Fraction-digit budget. Defaults to `currency.decimals` (2 without a
     *  currency); may be raised for rates. */
    maxDecimals: { type: Number, default: undefined },
    min: { type: Number, default: undefined },
    max: { type: Number, default: undefined },
    label: { type: String, default: undefined },
    error: { type: String, default: undefined },
    disabled: { type: Boolean, default: false },
    required: { type: Boolean, default: false },
    placeholder: { type: String, default: "" },
    size: { type: String as PropType<"sm" | "md" | "lg">, default: "md" },
    /** `id` for the field element; the rendered label points here. */
    id: { type: String, default: undefined },
  },
  emits: {
    "update:modelValue": (_value: string) => true,
  },
  setup(props, { emit }) {
    const attrs = useAttrs();
    const { t } = useI18n();

    const normalized = computed(() => normalizeCurrency(props.currency));
    const decimals = computed(() => {
      const budget = props.maxDecimals ?? (props.currency ? normalized.value.decimals : 2);
      if (!Number.isFinite(budget)) return 2;
      return Math.min(Math.max(Math.trunc(budget), 0), 8);
    });
    const symbol = computed(() => (props.currency ? currencySymbol(normalized.value) : ""));

    const generatedId = useId();
    const fieldId = computed(() => props.id ?? generatedId);
    const errorId = computed(() => `${fieldId.value}-error`);

    const focused = ref(false);
    /** The exact text the element shows. Authoritative while focused. */
    const draft = ref(formatDisplay(props.modelValue));
    /** Localized message for a draft the host did not flag itself. */
    const internalError = ref<string | null>(null);

    function parse(text: string): number | null {
      return parseMoney(text, decimals.value);
    }

    /** Display form: grouped, fixed precision, never a symbol. */
    function formatDisplay(text: string): string {
      if (String(text ?? "").trim() === "") return "";
      const value = parse(text);
      if (value === null) return String(text);
      return formatMoney(value, props.currency ?? { code: "", decimals: decimals.value }, {
        precision: decimals.value,
      });
    }

    /** Editing form: canonical text (no grouping), so the caret walks digits. */
    function formatEditing(text: string): string {
      if (String(text ?? "").trim() === "") return "";
      const value = parse(text);
      if (value === null) return String(text);
      return canonicalMoneyText(value, decimals.value);
    }

    function rangeMessage(value: number): string | null {
      const { min, max } = props;
      if (min !== undefined && value < min) {
        return t("hikari::money.belowMin", "Must be at least {min}").replace(
          "{min}",
          formatMoney(min, props.currency ?? { code: "", decimals: decimals.value }, {
            precision: decimals.value,
          }),
        );
      }
      if (max !== undefined && value > max) {
        return t("hikari::money.aboveMax", "Must be at most {max}").replace(
          "{max}",
          formatMoney(max, props.currency ?? { code: "", decimals: decimals.value }, {
            precision: decimals.value,
          }),
        );
      }
      return null;
    }

    /** Emitted text is canonical and never manufactured: an unparsable draft
     *  does not clear the host's model (the blur pass reports it instead). */
    function emitCanonical(value: number) {
      const next = canonicalMoneyText(value, decimals.value);
      if (next !== props.modelValue) emit("update:modelValue", next);
    }

    function onInput(event: Event) {
      const raw = (event.target as HTMLInputElement).value;
      // Assign the element's own text — the caret must not move.
      draft.value = raw;
      if (raw.trim() === "") {
        internalError.value = null;
        if (props.modelValue !== "") emit("update:modelValue", "");
        return;
      }
      const value = parse(raw);
      if (value === null) return;
      internalError.value = null;
      emitCanonical(value);
    }

    function onFocus() {
      focused.value = true;
      // De-format for editing; only when the text actually differs (a plain
      // canonical model is left untouched, so the caret never jumps).
      const editing = formatEditing(draft.value);
      if (editing !== draft.value) draft.value = editing;
    }

    function onBlur() {
      focused.value = false;
      const raw = draft.value.trim();
      if (raw === "") {
        draft.value = "";
        internalError.value = null;
        if (props.modelValue !== "") emit("update:modelValue", "");
        return;
      }
      const value = parse(raw);
      if (value === null) {
        // Keep exactly what the user typed; report instead of rewriting.
        internalError.value = t("hikari::money.invalid", "Enter a valid amount");
        return;
      }
      internalError.value = rangeMessage(value);
      emitCanonical(value);
      draft.value = formatDisplay(canonicalMoneyText(value, decimals.value));
    }

    // External model changes land in the box only while the field is NOT
    // focused — a host rerender must never overwrite the caret. The watch
    // tracks PRIMITIVES (not the currency object identity): a host that
    // passes an inline currency literal on every render would otherwise
    // reset an unfocused invalid draft each time its parent re-rendered.
    watch(
      () => [props.modelValue, props.currency?.code, decimals.value] as const,
      () => {
        if (focused.value) return;
        internalError.value = null;
        draft.value = formatDisplay(props.modelValue);
      },
    );

    const visibleError = computed(() => props.error ?? internalError.value ?? undefined);

    const boxClass = computed(() => [
      "hk-money-input-box",
      visibleError.value ? "hk-money-input-box-error" : "",
      props.disabled ? "hk-money-input-box-disabled" : "",
    ]);

    const describedBy = computed(() => (visibleError.value ? errorId.value : undefined));

    const filteredAttrs = computed(() => {
      const { class: _class, style: _style, ...rest } = attrs as Record<string, unknown>;
      return rest;
    });

    return () => (
      <div class="hk-money-input" data-size={props.size}>
        {props.label && (
          <label class="hk-money-input-label" for={fieldId.value}>
            {props.label}
            {props.required && <span class="hk-money-input-required">*</span>}
          </label>
        )}
        <div class={boxClass.value} data-focus={focused.value ? "" : undefined}>
          {symbol.value !== "" && (
            <span class="hk-money-input-affix hk-money-input-prefix" aria-hidden="true">
              {symbol.value}
            </span>
          )}
          <input
            id={fieldId.value}
            class="hk-money-input-field"
            // Always the plain text field: a native spinner field rewrites
            // its own value under the caret (the bug class this component
            // exists to avoid), and a decimal keypad needs only `inputmode`.
            type="text"
            inputmode="decimal"
            autocomplete="off"
            spellcheck={false}
            data-1p-ignore
            data-lpignore="true"
            value={draft.value}
            placeholder={props.placeholder}
            disabled={props.disabled}
            required={props.required}
            aria-invalid={visibleError.value ? "true" : undefined}
            aria-describedby={describedBy.value}
            {...filteredAttrs.value}
            onInput={onInput}
            onFocus={onFocus}
            onBlur={onBlur}
          />
        </div>
        {visibleError.value ? (
          <p class="hk-money-input-error" id={errorId.value} role="alert">
            {visibleError.value}
          </p>
        ) : null}
      </div>
    );
  },
});
