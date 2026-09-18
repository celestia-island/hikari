import {
  computed,
  defineComponent,
  nextTick,
  onMounted,
  ref,
  useAttrs,
  useId,
  watch,
  type PropType,
} from "vue";

import "./HkOtpInput.scss";

/** One cell's character, or "" while the code is still short. */
type CellChar = string;

/** A cell's characters the human way: leading/trailing whitespace dropped
 *  and commas (the JS `.length` spread hazard) collapsed — a pasted
 *  "123, 456" is a 6-digit code, not a 7-char one. */
function sanitizeText(raw: string): string {
  return raw.replace(/,/g, "").replace(/\s+/g, " ").trim();
}

/** The character class this instance accepts (see `alphanumeric`). */
function charPattern(alphanumeric: boolean): RegExp {
  return alphanumeric ? /[0-9A-Za-z]/ : /[0-9]/;
}

/** First position of `text` that the instance accepts, or -1. */
function firstAccepted(text: string, alphanumeric: boolean): number {
  const pattern = charPattern(alphanumeric);
  for (let i = 0; i < text.length; i += 1) {
    if (pattern.test(text[i]!)) return i;
  }
  return -1;
}

/** Split every string into code points. `[...s]` is what keeps a pasted
 *  emoji/SMP character from being cut in half into two lone surrogates;
 *  `String.prototype.slice` counts UTF-16 units and would. */
function splitChars(value: string): string[] {
  return [...value];
}

/**
 * HkOtpInput — one-cell-per-character code field (the "二次验证" step-up
 * surface, and any other one-time code: TOTP, SMS, e-mail, invite).
 *
 * A row of `length` cells, each holding exactly ONE character. Typing
 * advances, Backspace steps back, ←/→ move, Home/End jump to the ends,
 * and a paste anywhere in the row distributes the whole code across the
 * cells (separators — spaces, hyphens, commas — are dropped, so the
 * "123 456" shape SMS clients hand out just works). Mobile raises the
 * digit pad (`inputmode="numeric"`) and the first cell advertises
 * `autocomplete="one-time-code"` so iOS/Android can offer the SMS code.
 *
 * Value contract:
 * - `modelValue` is the COMPOSED code, always `length` characters or
 *   fewer ("123" while the 4th cell is still empty). It carries no
 *   separators — the dashed grouping of an SMS code is presentational.
 * - `complete` fires on the edge from short to full only; editing a full
 *   code cell-by-cell does not re-fire it until the code goes short
 *   again. `autoSubmit` fires `submitOnEnter` on that same edge, so a
 *   host can wire "submit as soon as the 6th digit lands" with one prop.
 * - Everything typed is filtered: digits only by default, or
 *   `[0-9A-Za-z]` with `alphanumeric` (case is the caller's business —
 *   the component neither upper- nor lower-cases the value).
 *
 * Keyboard/AT contract:
 * - The cells form one `role="group"` carrying `aria-label` (or the
 *   rendered `label`), so screen readers announce a single field rather
 *   than six stray textboxes. Each cell's own `aria-label` comes from
 *   `cellAriaLabel` (default "Digit N").
 * - `error` / `hint` mirror HkInput's shell: the message renders under
 *   the row and is announced via `role="alert"` (error) or wired to the
 *   group with `aria-describedby` (hint).
 * - The rendered `label` is a real `<label>`: an explicit `id` prop makes
 *   it click-focus the first cell, and the group also carries the label
 *   text as its accessible name.
 */
export const HkOtpInput = defineComponent({
  name: "HkOtpInput",
  inheritAttrs: false,
  props: {
    /** Composed code, at most `length` characters. */
    modelValue: { type: String, default: "" },
    /** Cell count — 6 is the universal TOTP/SMS width. */
    length: { type: Number, default: 6 },
    /** Message under the row; also paints the cells in the error channel. */
    error: { type: String, default: undefined },
    /** Quiet message under the row, shown only while `error` is unset. */
    hint: { type: String, default: undefined },
    /** Visible caption above the row. */
    label: { type: String, default: undefined },
    size: { type: String as () => "sm" | "md" | "lg", default: "md" },
    disabled: { type: Boolean, default: false },
    readonly: { type: Boolean, default: false },
    /** Accept `[0-9A-Za-z]` instead of digits only (invite / recovery codes). */
    alphanumeric: { type: Boolean, default: false },
    /**
     * Split the row into two groups of `length / 2` (the "123 456" SMS
     * shape). Ignored when `length` is odd.
     */
    separated: { type: Boolean, default: false },
    /** Focus the first empty cell when the component mounts. */
    autofocus: { type: Boolean, default: false },
    /** `id` for the first cell; the rendered `label`'s `for` points here. */
    id: { type: String, default: undefined },
    /** Submit intent: fired by Enter in any cell, and by `autoSubmit`. */
    submitOnEnter: { type: Function as PropType<() => void>, default: undefined },
    /** Fire `submitOnEnter` the moment the row fills. */
    autoSubmit: { type: Boolean, default: false },
    /** Accessible name for the row (falls back to `label`). */
    ariaLabel: { type: String, default: undefined },
    /** Per-cell accessible name; `{index}` is replaced by the 1-based position. */
    cellAriaLabel: {
      type: Function as PropType<(index: number) => string>,
      default: undefined,
    },
  },
  emits: {
    "update:modelValue": (_value: string) => true,
    /** The row just reached `length` characters. */
    complete: (_value: string) => true,
    focus: (_e: FocusEvent) => true,
    blur: (_e: FocusEvent) => true,
    keydown: (_e: KeyboardEvent) => true,
  },
  setup(props, { emit, slots }) {
    const attrs = useAttrs();

    /** DOM attributes (autocomplete, data-*, aria-*, tests' id hooks) ride
     *  every cell; `class`/`style` stay the root's — the same split HkInput
     *  makes between its shell and its field element. */
    const forwardedAttrs = computed(() => {
      const { class: _class, style: _style, ...rest } = attrs as Record<string, unknown>;
      return rest;
    });

    const cellCount = computed(() =>
      Math.max(1, Math.min(12, Math.floor(Number(props.length) || 6))),
    );

    const cellInputs = ref<Array<HTMLInputElement | null>>([]);

    /** Cells seeded from the incoming value — a prefilled code (a retry
     *  after a rejected attempt, a code handed over by the host) must be
     *  on screen at first paint, not only after the next emit. */
    function seedCells(raw: unknown, count: number): CellChar[] {
      const chars = splitChars(sanitizeText(String(raw ?? ""))).slice(0, count);
      while (chars.length < count) chars.push("");
      return chars;
    }

    const valueArray = ref<CellChar[]>(seedCells(props.modelValue, cellCount.value));

    /** The last value this component published — lets a paste tell "the
     *  row was short, now it is full" (a completion) from "a full row was
     *  edited" (not one). */
    let lastEmitted = valueArray.value.join("");

    const value = computed(() => valueArray.value.join(""));

    /** Index of the first empty cell (the tail when full). */
    function nextEmptyIndex(): number {
      const cells = valueArray.value;
      for (let i = 0; i < cells.length; i += 1) {
        if (cells[i] === "") return i;
      }
      return cells.length - 1;
    }

    /** Focus one cell and select what it holds, so the next keystroke
     *  replaces rather than appends. */
    function focusCell(index: number) {
      const el = cellInputs.value[index];
      if (!el) return;
      el.focus();
      // A click already placed a caret (or a range) — leave that alone;
      // programmatic focus parks at 0 and needs the select-all to make
      // "type over an existing digit" work.
      if (el.selectionStart === el.selectionEnd) el.select();
    }

    /** Publish a cell array: normalize widths, sync focus, emit the code,
     *  and fire `complete` on the short → full edge only. */
    function publish(nextChars: string[], options: { focus?: number } = {}) {
      const n = cellCount.value;
      const next = nextChars.slice(0, n);
      while (next.length < n) next.push("");
      const nextValue = next.join("");
      const wasFull = lastEmitted.length >= n;

      valueArray.value = next;

      if (nextValue !== lastEmitted) {
        lastEmitted = nextValue;
        emit("update:modelValue", nextValue);
      }
      if (options.focus != null) {
        void nextTick(() => focusCell(options.focus!));
      }
      if (!wasFull && nextValue.length >= n) {
        emit("complete", nextValue);
        if (props.autoSubmit) props.submitOnEnter?.();
      }
    }

    /** Keep the cells in step with a caller-driven `modelValue` (a retry
     *  clearing the field, a code prefilled from the URL, a paste the host
     *  normalized itself). An identical recomposition is a no-op, so our
     *  own emits never bounce back into an extra render or focus jump. */
    watch(
      () => props.modelValue,
      (raw) => {
        const text = sanitizeText(String(raw ?? ""));
        if (text === valueArray.value.join("")) {
          lastEmitted = text.slice(0, cellCount.value);
          return;
        }
        lastEmitted = text.slice(0, cellCount.value);
        valueArray.value = seedCells(text, cellCount.value);
      },
    );

    /** `length` shrinking must not strand characters in removed cells. */
    watch(cellCount, (n) => {
      if (valueArray.value.length === n) return;
      valueArray.value = seedCells(valueArray.value.join(""), n);
    });

    function onCellFocus(e: FocusEvent) {
      const el = e.target as HTMLInputElement;
      if (el.selectionStart === el.selectionEnd) el.select();
      emit("focus", e);
    }

    function onCellInput(index: number, e: Event) {
      const el = e.target as HTMLInputElement;
      const raw = el.value;
      const pattern = charPattern(props.alphanumeric);

      // A phone's IME/keyboard can deliver several characters at once (or
      // a whole code via autofill) — hand the extra characters forward
      // instead of dropping them.
      const typed = splitChars(sanitizeText(raw));
      const first = typed.find((c) => pattern.test(c));
      if (first == null) {
        // Everything offered was filtered out (a letter in digits-only
        // mode, a stray separator): clear the cell the DOM already
        // painted and republish the unchanged code.
        el.value = "";
        valueArray.value = valueArray.value.slice();
        return;
      }

      const rest = typed.slice(typed.indexOf(first) + 1);
      const next = valueArray.value.slice();
      next[index] = first;
      let write = index + 1;
      for (const ch of rest) {
        if (write >= cellCount.value) break;
        if (!pattern.test(ch)) continue;
        next[write] = ch;
        write += 1;
      }
      publish(next, { focus: write < cellCount.value ? write : cellCount.value - 1 });
    }

    /** Backspace: clear this cell, or step back and clear the previous one
     *  (an empty cell in front of a filled row means "the caret is ahead
     *  of the mistake", the behavior every segmented field shares). */
    function onBackspace(index: number, e: KeyboardEvent) {
      const next = valueArray.value.slice();
      // The delete is virtual: the DOM is blocked here and only the
      // published state may change, so the caret never eats a character
      // out of a cell the state still calls occupied.
      e.preventDefault();
      if (next[index] !== "") {
        next[index] = "";
        publish(next, { focus: index });
        return;
      }
      if (index > 0) {
        next[index - 1] = "";
        publish(next, { focus: index - 1 });
      }
    }

    function onCellKeydown(index: number, e: KeyboardEvent) {
      if (e.isComposing) return;
      const key = e.key;

      if (key === "Backspace") {
        onBackspace(index, e);
      } else if (key === "Delete") {
        // The cells never shift: a delete is a local clear. (Shifting
        // would move digits between cells and yank the caret with them.)
        if (valueArray.value[index] !== "") {
          const next = valueArray.value.slice();
          next[index] = "";
          publish(next, { focus: index });
        }
        e.preventDefault();
      } else if (key === "ArrowLeft") {
        e.preventDefault();
        if (index > 0) focusCell(index - 1);
      } else if (key === "ArrowRight") {
        e.preventDefault();
        if (index < cellCount.value - 1) focusCell(index + 1);
      } else if (key === "Home") {
        e.preventDefault();
        focusCell(0);
      } else if (key === "End") {
        e.preventDefault();
        focusCell(cellCount.value - 1);
      } else if (key === "Enter" && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        if (!props.disabled && !props.readonly) {
          e.preventDefault();
          props.submitOnEnter?.();
        }
      }

      emit("keydown", e);
    }

    function onCellPaste(index: number, e: ClipboardEvent) {
      const text = sanitizeText(e.clipboardData?.getData("text") ?? "");
      const pattern = charPattern(props.alphanumeric);
      if (firstAccepted(text, props.alphanumeric) === -1) return; // keep the native paste
      e.preventDefault();

      const accepted = splitChars(text).filter((c) => pattern.test(c));
      const next = valueArray.value.slice();
      let write = index;
      for (const ch of accepted) {
        if (write >= cellCount.value) break;
        next[write] = ch;
        write += 1;
      }
      publish(next, { focus: Math.min(write, cellCount.value - 1) });
    }

    onMounted(() => {
      if (!props.autofocus) return;
      void nextTick(() => focusCell(nextEmptyIndex()));
    });

    const generatedId = useId();
    const firstCellId = computed(() => props.id ?? `${generatedId}-0`);
    const cellId = (index: number) =>
      index === 0 ? firstCellId.value : `${firstCellId.value}-${index}`;

    const cellLabel = (index: number) =>
      props.cellAriaLabel?.(index + 1) ?? `Digit ${index + 1}`;

    const groupClass = computed(() => [
      "hk-otp",
      `hk-otp-${props.size}`,
      props.error ? "hk-otp-error" : "",
      props.disabled ? "hk-otp-disabled" : "",
      props.readonly ? "hk-otp-readonly" : "",
    ]);

    return () => {
      const n = cellCount.value;
      // Glue cell AFTER which the split gap opens (5 of 6 → "123 | 456").
      const splitAfter = props.separated && n % 2 === 0 ? n / 2 - 1 : -1;
      const cells = [];
      for (let index = 0; index < n; index += 1) {
        cells.push(
          <input
            key={index}
            ref={(el: unknown) => {
              cellInputs.value[index] = (el as HTMLInputElement | null) ?? null;
            }}
            id={cellId(index)}
            class="hk-otp-cell"
            type="text"
            value={valueArray.value[index] ?? ""}
            inputmode={props.alphanumeric ? "text" : "numeric"}
            autocomplete={index === 0 ? "one-time-code" : "off"}
            autocapitalize="off"
            autocorrect="off"
            spellcheck={false}
            disabled={props.disabled}
            readonly={props.readonly}
            aria-label={cellLabel(index)}
            aria-disabled={props.disabled ? "true" : undefined}
            aria-invalid={props.error ? "true" : undefined}
            // One character for the digit case (no IME path exists for
            // digits), but NOT for alphanumeric entry: a CJK/emoji IME
            // composition exceeds one UTF-16 unit and maxlength would
            // mangle it mid-composition. The input handler filters either
            // way — maxlength is only the cheap first fence.
            maxlength={props.alphanumeric ? undefined : 1}
            {...forwardedAttrs.value}
            onInput={(e: Event) => onCellInput(index, e)}
            onPaste={(e: ClipboardEvent) => onCellPaste(index, e)}
            onFocus={(e: FocusEvent) => onCellFocus(e)}
            onBlur={(e: FocusEvent) => emit("blur", e)}
            onKeydown={(e: KeyboardEvent) => onCellKeydown(index, e)}
          />,
        );
        if (index === splitAfter) {
          cells.push(<span key={`gap-${index}`} class="hk-otp-gap" aria-hidden="true" />);
        }
      }

      const hintId = `${firstCellId.value}-hint`;

      return (
        <div class="hk-otp-wrapper">
          {props.label && (
            <label
              class="hk-otp-label"
              for={props.id ? firstCellId.value : undefined}
            >
              {props.label}
            </label>
          )}
          <div
            class={groupClass.value}
            role="group"
            aria-label={props.ariaLabel || props.label || undefined}
            aria-describedby={props.hint && !props.error ? hintId : undefined}
          >
            {cells}
            {slots.default?.()}
          </div>
          {props.error ? (
            <p class="hk-otp-error-msg" role="alert">
              {props.error}
            </p>
          ) : props.hint ? (
            <p class="hk-otp-hint" id={hintId}>
              {props.hint}
            </p>
          ) : null}
        </div>
      );
    };
  },
});

export default HkOtpInput;
