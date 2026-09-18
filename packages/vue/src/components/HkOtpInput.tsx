import {
  computed,
  defineComponent,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  useAttrs,
  useId,
  watch,
  type PropType,
} from "vue";

import "./HkOtpInput.scss";

/** The custom property the fit publishes on a row. */
const FITTED_FONT_VAR = "--hk-otp-fitted-font";

/** Resolve any CSS length to computed pixels by letting the engine do it:
 *  a detached probe carries `font-size: <value>`, and the computed
 *  font-size always comes back in px. Returns null when the value is not
 *  a length at all (an unresolved `var()` reference, an empty string) —
 *  the engine reports those by refusing the declaration, not by throwing.
 *
 *  This exists because `parseFloat` cannot do the job: it reads
 *  `"1.25rem"` as 1.25, and 1.25 is not a pixel count. Two earlier
 *  versions of the fit cross-bred the units that way (every glyph clamped
 *  to ~1px, then every glyph rendered 320px). */
function probeCssLength(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const probe = document.createElement("span");
  probe.style.position = "absolute";
  probe.style.visibility = "hidden";
  probe.style.pointerEvents = "none";
  // `important` on purpose: a host rule like `body > span { font-size: … }`
  // would otherwise win over the probe's inline declaration and corrupt the
  // measured ceiling (measured: a 1px `!important` host rule drove a whole
  // row's glyph to 1px). Only rules that ALSO say `!important` can still
  // interfere, which is the documented limit of a DOM probe.
  probe.style.setProperty("font-size", trimmed, "important");
  if (probe.style.getPropertyValue("font-size") === "") return null;
  document.body.appendChild(probe);
  const pixels = Number.parseFloat(getComputedStyle(probe).fontSize);
  probe.remove();
  return Number.isFinite(pixels) && pixels > 0 ? pixels : null;
}

/** Probe a length that was read off an element. Same resolver. */
function parseCssLength(raw: string): number | null {
  return probeCssLength(raw);
}

/** The glyph size a host pinned outright, in pixels, or null when the
 *  field is free to size itself.
 *
 *  Read from wherever the pin is declared: the row itself (the documented
 *  `style` route lands there) or the wrapper the row inherits from (a pin
 *  on any ancestor reaches the row through the same inheritance, which is
 *  why the computed value is consulted for the wrapper). The value caps
 *  the fit instead of stopping it — see `fitGlyph` for why a stand-down
 *  was the wrong shape. */
function pinnedCeiling(row: HTMLElement): number | null {
  const onRow = parseCssLength(row.style.getPropertyValue("--hk-otp-font-size"));
  if (onRow != null) return onRow;
  const wrapper = row.parentElement;
  if (!wrapper) return null;
  const declared = parseCssLength(wrapper.style.getPropertyValue("--hk-otp-font-size"));
  if (declared != null) return declared;
  return parseCssLength(getComputedStyle(wrapper).getPropertyValue("--hk-otp-font-size"));
}

/** One cell's character, or "" while the code is still short. */
type CellChar = string;

/** A code the human way: commas are collapsed and whitespace trimmed (the
 *  JS `.length` spread hazard), and the separators pasted codes arrive
 *  wrapped in - spaces, hyphens, tabs, newlines, NBSP - are dropped. What
 *  survives is what the cells will display. */
function sanitizeText(raw: string): string {
  return raw
    .replace(/,/g, "")
    .replace(/[\s\-–—_.]+/g, "")
    .trim();
}

/** A caller-fed value is taken as the code (separators aside), so it must
 *  not smuggle characters the field would never accept into a cell: the
 *  cells and `modelValue` stay in step only when both sides hold the same
 *  alphabet. Filtering here is what makes a host's `"12a34"` display the
 *  same code the field itself would have produced from it. */
function sanitizeCode(raw: string, alphanumeric: boolean): string {
  const pattern = charPattern(alphanumeric);
  return splitChars(sanitizeText(raw))
    .filter((c) => pattern.test(c))
    .join("");
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
 * - A caller-fed `modelValue` goes through the same sanitize + filter, so
 *   a host holding the raw shape ("123 456", a value longer than the row,
 *   a letter in digits-only mode) is handed back the code the field
 *   actually holds via `update:modelValue` instead of silently disagreeing
 *   with what is on screen. Re-projecting is the only way the two can stay
 *   in step; hosts that already store a clean code see no event at all.
 * - The row never overflows the box it is given: the size ramp is a
 *   ceiling, and the cells shrink together (keeping their square shape,
 *   and their glyph scaling with them) when the container is narrower
 *   than `length` x ramp.
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
    /**
     * Per-cell accessible name — a function of the 1-based position, so a
     * localized host can return `t("auth.mfa.cell", { n })` and a
     * digits-only host can keep the "Digit N" default.
     */
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
  setup(props, { emit, slots, expose }) {
    const attrs = useAttrs();

    /** DOM attributes (autocomplete, data-*, aria-*, tests' id hooks) ride
     *  every cell; `class`/`style` ride the ROW instead (see the render
     *  below), which is the same split HkInput makes between its wrapper
     *  and its field element. */
    const forwardedAttrs = computed(() => {
      const { class: _class, style: _style, ...rest } = attrs as Record<string, unknown>;
      return rest;
    });

    /** The other half of that split: only `style` belongs on the row
     *  (`class` is merged explicitly in the render, so spreading it here
     *  too would merge the host's classes twice). Anything else — a
     *  `title`, a `data-*`, a stray `id` — stays off the row: the cells
     *  carry the attributes. */
    const rootAttrs = computed(() => {
      const source = attrs as { style?: unknown };
      return {
        style: (source.style ?? undefined) as string | Record<string, string> | undefined,
      };
    });

    /** Cell count, clamped to the range the row can actually render: at
     *  least 1 (a zero-cell field is not a field) and at most 12 (the row
     *  stops being readable past a dozen cells at the narrowest card).
     *  A non-numeric `length` falls back to the 6-digit default. */
    const cellCount = computed(() => {
      const requested = Number(props.length);
      if (!Number.isFinite(requested)) return 6;
      return Math.max(1, Math.min(12, Math.floor(requested)));
    });

    const cellInputs = ref<Array<HTMLInputElement | null>>([]);

    /** Cell index a programmatic focus is heading for, consumed by the
     *  focus handler so it can tell "we moved the caret there" from
     *  "the user navigated there" (see focusCell / onCellFocus). */
    const programmaticFocus = ref<number | null>(null);

    /** Cells seeded from the incoming value — a prefilled code (a retry
     *  after a rejected attempt, a code handed over by the host) must be
     *  on screen at first paint, not only after the next emit. */
    function seedCells(raw: unknown, count: number): CellChar[] {
      const chars = splitChars(sanitizeCode(String(raw ?? ""), props.alphanumeric)).slice(0, count);
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

    /** Focus one cell. `select` expands the caret over the cell's glyph,
     *  which is what makes "type over an existing character" work — but
     *  it stays OFF on a forward advance. Landing on an occupied cell
     *  (the tail cell of a filled row, a cell the typed run already
     *  filled) with an expanded caret leaves that digit highlighted, and
     *  the next keystroke would silently replace it instead of filling
     *  the empty cell ahead.
     *
     *  `programmaticFocus` is what makes that hold: focusing fires a real
     *  focus event, and the focus handler's own select-on-entry default
     *  would otherwise re-expand the caret right after this call asked it
     *  not to. */
    function focusCell(index: number, select = false) {
      const el = cellInputs.value[index];
      if (!el) return;
      // Focusing the cell that already holds focus fires NO focus event, so
      // a marker written there would never be consumed. It cannot disarm a
      // later real click either — the browser fires the focus event exactly
      // when the focused node CHANGES, so a no-op focus() (already-focused
      // cell, or a marker left over from an earlier cell) is invisible to a
      // user: their click either fires a focus (no marker matches, so it
      // selects) or fires nothing at all (the caret keeps the position the
      // click itself set). Chromium probes of both shapes held.
      if (document.activeElement !== el) programmaticFocus.value = index;
      el.focus();
      if (select) el.select();
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
        const target = options.focus;
        // An advance onto the tail cell of a now-full row would park an
        // expanded caret on the digit just typed — stay on the terminal
        // cell instead (`select: false`), which reads as "the code is
        // complete, review it here" and keeps the next keystroke filling
        // nothing rather than eating a digit.
        const stayPut = !valueArray.value[target];
        void nextTick(() => focusCell(target, stayPut));
      }
      if (!wasFull && nextValue.length >= n) {
        emit("complete", nextValue);
        if (props.autoSubmit) props.submitOnEnter?.();
      }
    }

    /** Keep the cells in step with a caller-driven `modelValue`. The
     *  incoming value is sanitized and filtered on the way in, so a host
     *  that holds the raw shape ("123 456", a value longer than the row)
     *  is told what the field actually holds instead of silently
     *  disagreeing with it. An identical recomposition is a no-op. */
    watch(
      () => props.modelValue,
      (raw) => applyIncoming(raw),
    );

    /** `length` shrinking must not strand characters in removed cells. */
    watch(cellCount, () => {
      applyIncoming(valueArray.value.join(""));
    });

    /** Switching `alphanumeric` at runtime changes the field's alphabet,
     *  so cells holding a now-rejected character are re-filtered rather
     *  than left on screen under an inputmode that promises otherwise. */
    watch(
      () => props.alphanumeric,
      () => {
        applyIncoming(valueArray.value.join(""));
      },
    );

    /** Adopt a caller-driven value: sanitize, filter, clamp to the row,
     *  then publish. Emits only when the field's value actually differs
     *  from what the caller passed — a well-behaved caller's exact value
     *  must not bounce back as a spurious update. */
    function applyIncoming(raw: unknown) {
      const rawText = String(raw ?? "");
      const text = sanitizeCode(rawText, props.alphanumeric);
      const chars = seedCells(text, cellCount.value);
      const joined = chars.join("");
      lastEmitted = joined;
      if (joined !== valueArray.value.join("")) valueArray.value = chars;
      if (joined !== rawText) emit("update:modelValue", joined);
    }

    // ── glyph fit ─────────────────────────────────────────────────────
    // The row shrinks its cells to fit any container (see the stylesheet),
    // and a fixed font size would then overflow a shrunken cell. CSS
    // cannot scale the glyph by the cell's own width — a container cannot
    // query itself, and the cells have no children to query against — so
    // the row MEASURES one cell and publishes the glyph size it can hold.
    // The ramp keeps final say: it bounds the fit through
    // --hk-otp-font-max (while --hk-otp-font-size is the host's outright
    // pin, which wins the cascade — see pinnedCeiling).
    const rowEl = ref<HTMLElement | null>(null);
    let fitObserver: ResizeObserver | null = null;
    let pinObserver: MutationObserver | null = null;

    /** Fraction of the cell's width the glyph may occupy, and the floor a
     *  fit never shrinks below (a smaller digit stops being legible well
     *  before it stops fitting). */
    const FIT_RATIO = 0.55;
    const FIT_MIN_PX = 11;
    /** Fallback ceiling for a cell whose ramp value does not resolve (a
     *  host that loaded this sheet without the canonical scale root). */
    const FIT_MAX_PX = 24;

    function fitGlyph(measuredWidth?: number) {
      const row = rowEl.value;
      const cell = row?.firstElementChild;
      if (!row || !(cell instanceof HTMLElement)) return;
      // `measuredWidth` is the seam the unit tests use: a DOM without a
      // layout engine reports every box as 0, so the arithmetic has to be
      // reachable without one. `offsetWidth` is the fallback for engines
      // that lay out but do not implement getBoundingClientRect.
      const width = measuredWidth ?? (cell.getBoundingClientRect().width || cell.offsetWidth);
      if (!width) return;

      const styles = getComputedStyle(cell);
      const pinned = pinnedCeiling(row);
      const ceiling = Math.min(
        // The ramp is the design's ceiling for this size…
        probeCssLength(styles.getPropertyValue("--hk-otp-font-max")) ?? FIT_MAX_PX,
        // …a host pin caps it further wherever the pin is declared…
        pinned ?? Number.POSITIVE_INFINITY,
      );
      const fitted = Math.min(ceiling, Math.max(FIT_MIN_PX, width * FIT_RATIO));

      // …and the value is published UNCONDITIONALLY. The earlier version
      // stood the fit down whenever a pin was present, which turned the fit
      // into state that could only be refreshed by an event this component
      // does not receive: removing a pin changes no box and (on a host-side
      // `style` mutation) no render, so the stale state left the row on the
      // ramp literal — Chromium measured a 20px glyph clipped inside a 13px
      // cell, with zero re-fits across the removal. Publishing always makes
      // the glyph a pure function of the current cell width and pin, which
      // cannot go stale. The pin still wins where it is declared, because
      // `--hk-otp-font-size` precedes `--hk-otp-fitted-font` in the cell's
      // font chain; the pin watcher above is what keeps this published
      // value honest across pin changes that no other observer sees.
      const published = `${fitted.toFixed(1)}px`;
      if (row.style.getPropertyValue(FITTED_FONT_VAR) !== published) {
        row.style.setProperty(FITTED_FONT_VAR, published);
      }
    }

    /** Watch the CELLS, not the row: `length` can change without the row's
     *  own box moving, and it is the cell's width the glyph follows. */
    /** Keep the pin watcher pointed at this row and its wrapper. A custom
     *  property is not a box, so a ResizeObserver cannot see a pin come or
     *  go — an ATTRIBUTE observer can: `--hk-otp-font-size` reaches the row
     *  either as its own inline declaration (the documented `style` route)
     *  or as the wrapper's, which the row inherits. Without this, removing
     *  a pin left the row standing down forever: no box changed, so no
     *  re-fit ever ran, and the glyph fell back to the literal and clipped
     *  (verified in Chromium: 0 re-fits across the removal).
     *
     *  Self-writes are harmless: the fit only publishes when the value
     *  moves, so the observer callback that follows a publish settles
     *  instead of looping. */
    function watchPinSources(node: HTMLElement) {
      pinObserver?.disconnect();
      pinObserver = null;
      if (typeof MutationObserver === "undefined") return;
      pinObserver = new MutationObserver(() => fitGlyph());
      const options: MutationObserverInit = {
        attributes: true,
        attributeFilter: ["style"],
      };
      // Every ancestor, up to the document root. A pin can sit anywhere
      // above the row (a card, a layout column, the app root), and the
      // transition that matters leaves no trace on the row itself: no box
      // change, and a host-side `style` mutation renders nothing.
      //
      // The walk cannot rely on `offsetParent`: `bindRow` first runs while
      // the subtree is still DETACHED (offsetParent null, chain truncated —
      // measured: two nodes observed at mount, seven after the first
      // re-render, and a card mutation silent in between). Walking to the
      // root costs a handful of observers and closes that gap; `onMounted`
      // re-runs it once the row is actually in the document.
      let el: HTMLElement | null = node;
      let guard = 0;
      while (el && guard < 64) {
        pinObserver.observe(el, options);
        el = el.parentElement;
        guard += 1;
      }
    }

    function bindRow(el: unknown) {
      const node = (el as HTMLElement | null) ?? null;
      fitObserver?.disconnect();
      fitObserver = null;
      pinObserver?.disconnect();
      pinObserver = null;
      rowEl.value = node;
      if (!node) return;
      fitGlyph();
      watchPinSources(node);
      if (typeof ResizeObserver === "undefined") return;
      // The observer hands over entries; the fit reads the live box instead.
      fitObserver = new ResizeObserver(() => fitGlyph());
      for (const cell of Array.from(node.children)) fitObserver.observe(cell);
    }

    onBeforeUnmount(() => {
      fitObserver?.disconnect();
      fitObserver = null;
      pinObserver?.disconnect();
      pinObserver = null;
    });

    watch([cellCount, () => props.size], () => {
      void nextTick(() => bindRow(rowEl.value));
    });

    /** Focus arriving on a cell with a glyph in it selects that glyph, so
     *  keyboard/AT navigation and a click both land ready-to-replace.
     *
     *  A focus this component asked for is exempt: `focusCell(…, false)`
     *  is the forward-advance path (typing, pasting), where an expanded
     *  caret would leave the just-written digit highlighted and turn the
     *  next keystroke into a silent rewrite. The exemption is consumed on
     *  arrival — a later user click on that same cell is a normal focus
     *  and selects again. */
    function onCellFocus(event: FocusEvent, index: number) {
      const el = event.target as HTMLInputElement;
      const programmatic = programmaticFocus.value === index;
      programmaticFocus.value = null;
      if (!programmatic && el.selectionStart === el.selectionEnd) el.select();
      emit("focus", event);
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
      if (e.isComposing) {
        // Composition keystrokes are the IME's, not the field's — but the
        // host asked for every keydown (chat-style composers distinguish
        // Enter from Shift+Enter themselves), so the event is forwarded
        // BEFORE the early return rather than swallowed.
        emit("keydown", e);
        return;
      }
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
        // Explicit navigation selects the landing cell: the user asked to
        // go there to edit it, so the next keystroke replaces its digit.
        if (index > 0) focusCell(index - 1, true);
      } else if (key === "ArrowRight") {
        e.preventDefault();
        if (index < cellCount.value - 1) focusCell(index + 1, true);
      } else if (key === "Home") {
        e.preventDefault();
        focusCell(0, true);
      } else if (key === "End") {
        e.preventDefault();
        focusCell(cellCount.value - 1, true);
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
      // The subtree is connected by now: re-point the pin watcher at the
      // real ancestor chain (at bind time the row was still detached and
      // the walk stopped short).
      if (rowEl.value) watchPinSources(rowEl.value);
      // A host whose stored value is not a clean code (over-long, or
      // carrying characters this field never accepts) is told once, at
      // mount, what the field actually holds — the watcher only covers
      // changes that arrive later. A well-behaved caller hears nothing.
      const rawAtMount = String(props.modelValue ?? "");
      if (valueArray.value.join("") !== rawAtMount) {
        emit("update:modelValue", valueArray.value.join(""));
      }
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

    // The fit is exposed so a unit test can drive it with a measurement of
    // its own (see fitGlyph); the browser asserts the real geometry.
    expose({ fitGlyph });
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
            onFocus={(e: FocusEvent) => onCellFocus(e, index)}
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
              // Always wired: the first cell always has an id (explicit or
              // generated), so the caption focuses the row on click even
              // when the caller passed no id — a `for`-less label is a
              // dead caption (HkInput wires `props.id ?? generatedId` too).
              for={firstCellId.value}
            >
              {props.label}
            </label>
          )}
          <div
            // Host `class` / `style` land HERE, on the row: that is what
            // makes the documented geometry hooks reachable as
            // `style="--hk-otp-cell-size: 40px"`, and what lets a utility
            // host layer its own class on the row box. `$attrs` are
            // inherited off (the wrapper must not wear them), so anything
            // not consumed here has to be forwarded explicitly — the
            // cells below take the rest.
            ref={bindRow}
            {...rootAttrs.value}
            class={[groupClass.value, attrs.class]}
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
