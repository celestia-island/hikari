// hi-components/src/basic/otp_input.rs
// OtpInput — mirror of the canonical Vue `HkOtpInput`: the one-cell-per-character
// code field (TOTP / SMS / e-mail / invite codes).
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkOtpInput.scss`, vendored under
// `src/styles/vue-mirror/` and guarded by `tests/vue_mirror_drift_tests.rs`),
// compiled with `no_hash` so the `.hk-otp*` class names are literal and
// identical in both forms. DOM contract (mirrors Vue one-to-one):
//
//   div.hk-otp-wrapper
//     label.hk-otp-label [for=firstCellId]                 (label)
//     div.hk-otp.hk-otp-{sm|md|lg}                         (the row)
//         [.hk-otp-error] [.hk-otp-disabled] [.hk-otp-readonly] [class]
//         role="group" [aria-label] [aria-describedby]
//       input.hk-otp-cell  (xN, one per character)
//           id class="hk-otp-cell" type="text" value
//           inputmode="numeric|text" autocomplete="one-time-code|off"
//           autocapitalize="off" autocorrect="off" spellcheck="false"
//           aria-label [aria-disabled] [aria-invalid]
//           [disabled] [readonly]
//       span.hk-otp-gap                                  (separated, even rows)
//     p.hk-otp-error-msg role="alert"                      (error)
//     p.hk-otp-hint id={firstCellId}-hint                  (else hint)
//
// Vue prop mapping: `modelValue` → [`OtpInputProps::model_value`], `length` →
// [`OtpInputProps::length`], `cellAriaLabel` →
// [`OtpInputProps::cell_aria_label`] (`Callback<usize, String>`, called with
// the 1-based position), the `update:modelValue` / `complete` / `focus` /
// `blur` / `keydown` emits → `on_input` / `on_complete` / `on_focus` /
// `on_blur` / `on_keydown`.
//
// The value math is Vue's, helper by helper: `sanitizeText`, `sanitizeCode`,
// `seedCells`, the typed-run distribution, the paste distribution, the
// backspace/delete rules and the `separated` split all live in the pure
// functions above the component, so they are testable without a DOM.
//
// State is controlled-only (`model_value` in, one code out), so no tairitsu
// `Signal`/`use_state` is involved. The only non-reactive bit is the
// composition flag, a module-level `thread_local!` cell — the same singleton
// precedent as `basic/slider.rs`'s drag flag (it never drives rendering).
//
// Behaviour deltas vs Vue (documented):
//   * **no programmatic focus.** tairitsu 0.5.22 exposes no `focus()` (no DOM
//     op, no per-instance ref callback that survives the render), so Vue's
//     `focusCell()` has no analogue. Auto-advance, ←/→, Home/End and the
//     backspace step-back therefore publish the index Vue would have focused
//     through [`OtpInputProps::on_cursor_change`]; the HOST performs the
//     focus. Vue's caret work (`el.select()`, the `programmaticFocus` marker
//     that keeps an advance from selecting the digit just typed) is DOM-only
//     and not mirrored — the emitted index carries the same information.
//   * **the cells are a pure projection of `model_value`.** There is no
//     internal `valueArray` / `lastEmitted` mirror (a per-render `Signal`
//     cannot survive a re-render and a single-slot `use_state` would be
//     shared by every OTP field on the page). `model_value` is sanitized,
//     filtered and clamped on the way in exactly like Vue's
//     `applyIncoming()`, so a host holding the raw shape ("123 456", an
//     over-long value, a letter in digits-only mode) still shows the code the
//     field actually holds. The short → full `complete` edge is computed from
//     the incoming prop vs the code being published, which is the same test
//     Vue applies to its `lastEmitted` mirror. Two consequences: (a) a
//     keystroke whose characters are all filtered out cannot force the
//     repaint Vue obtains by replacing its array, so the browser's own text
//     may linger in that cell until the next model change; (b) an `input`
//     event that offers no text at all is read as a native deletion and
//     clears that cell through the model (Vue repaints instead).
//   * **paste rides the input event.** tairitsu 0.5.22 has no
//     `ClipboardEvent`, so `clipboardData` is unreadable and Vue's
//     `onCellPaste` is replaced by the same distribution applied to
//     `InputEvent::data` whenever `input_type` names a paste (otherwise the
//     typed-run branch runs, which starts writing at the NEXT cell — Vue's
//     own split). `InputEvent::data` is read as "the text the input offers":
//     for a one-character cell the two host conventions (the inserted run vs
//     the cell's whole value) coincide, an empty offer is a deletion, and only
//     a longer offer has to pick a convention — the header's paste branch
//     above. The digit-mode `maxlength="1"` fence is consequently NOT emitted:
//     it would clamp a pasted run to one character inside the browser, i.e.
//     throw away exactly the text this branch needs. The alphabet filter is the
//     fence (as it already is in alphanumeric mode, where Vue omits `maxlength`
//     for the IME path).
//   * **the composition guard is a flag.** `KeyboardEvent` carries no
//     `isComposing`, so `compositionstart` / `compositionend` maintain a
//     thread-local `COMPOSING` flag; while it is set the keydown handler
//     forwards the event and returns before any interception, which is
//     exactly Vue's branch. One IME composition is in flight at a time in a
//     wasm thread, so the flag does not need a per-instance key (the slider's
//     single-drag flag is the same call).
//   * **no generated ids, no attribute fan-out.** Vue's `useId()` has no
//     analogue, so the cell ids exist only when `id` is passed (`id`,
//     `id-1`, …) — and the caption's `for` and the hint's
//     `aria-describedby` are emitted only then (Vue always wires both to a
//     generated id). Vue forwards every other `$attrs` entry to each cell
//     (tests' `data-*` hooks, a stray `id`); a Rust props struct is closed,
//     so there is no attribute bag to fan out.
//   * **`autofocus` is dropped.** Vue focuses the first empty cell on mount;
//     with no focus API the prop could only be accepted and ignored, so it is
//     not part of the surface — a host focuses through
//     [`otp_next_empty_index`] (or `on_cursor_change` after the first edit).
//   * `error` / `hint` / `label` use Vue truthiness (an empty string is
//     absent), and `separated` only splits an EVEN row, like Vue's
//     `length % 2 === 0` guard.

use std::cell::Cell;

use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct OtpInputComponent;

/// The three size ramps (Vue: `"sm" | "md" | "lg"`, default `md`). Class-only:
/// the sheet owns the cell box, the gap and the font ceiling per ramp.
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum OtpSize {
    Sm,
    #[default]
    Md,
    Lg,
}

impl OtpSize {
    /// The glyph size Vue's ramp caps the fit at (`--hk-otp-font-max`:
    /// sm = text-base 0.875rem, md = text-xl 1.25rem, lg = text-2xl 1.5rem).
    /// Vue publishes the MEASURED fit per row; the mirror cannot measure, so it
    /// publishes the cap (see the file header delta).
    pub fn pinned_font(self) -> &'static str {
        match self {
            OtpSize::Sm => "0.875rem",
            OtpSize::Md => "1.25rem",
            OtpSize::Lg => "1.5rem",
        }
    }

    /// The `hk-otp-{size}` row class exactly as Vue emits it.
    pub fn modifier(self) -> &'static str {
        match self {
            OtpSize::Sm => "hk-otp-sm",
            OtpSize::Md => "hk-otp-md",
            OtpSize::Lg => "hk-otp-lg",
        }
    }
}

thread_local! {
    /// Whether an IME composition is in flight on a cell. Vue reads
    /// `KeyboardEvent.isComposing`; tairitsu 0.5.22 has no such field, so the
    /// flag is maintained from the composition events (see the header delta).
    static COMPOSING: Cell<bool> = const { Cell::new(false) };
}

fn otp_is_composing() -> bool {
    COMPOSING.with(|flag| flag.get())
}

fn set_otp_composing(composing: bool) {
    COMPOSING.with(|flag| flag.set(composing));
}

/// Vue's `sanitizeText`: commas are collapsed and the separator family
/// (whitespace, hyphen / en dash / em dash, underscore, period) is dropped.
/// Vue's trailing `.trim()` is redundant once `\s` is removed and is omitted.
pub fn otp_sanitize_text(raw: &str) -> String {
    let mut out = String::with_capacity(raw.len());
    for ch in raw.chars() {
        if ch == ','
            || ch.is_whitespace()
            || matches!(ch, '-' | '\u{2013}' | '\u{2014}' | '_' | '.')
        {
            continue;
        }
        out.push(ch);
    }
    out
}

/// The character class this instance accepts (Vue: `charPattern`).
pub fn otp_accepts(ch: char, alphanumeric: bool) -> bool {
    if alphanumeric {
        ch.is_ascii_alphanumeric()
    } else {
        ch.is_ascii_digit()
    }
}

/// Vue's `sanitizeCode`: separators dropped, then everything outside the
/// instance's alphabet filtered out (a host's `"12a34"` becomes `"1234"`).
pub fn otp_sanitize_code(raw: &str, alphanumeric: bool) -> String {
    otp_sanitize_text(raw)
        .chars()
        .filter(|ch| otp_accepts(*ch, alphanumeric))
        .collect()
}

/// Cell count clamped into the range the row can render (Vue: at least 1, at
/// most 12, `Math.floor`; a non-finite `length` falls back to 6 — `i32` can
/// only carry the finite half of that guard).
pub fn otp_cell_count(length: i32) -> usize {
    length.clamp(1, 12) as usize
}

/// Vue's `seedCells`: the code's characters, truncated to the row and padded
/// with empty cells.
pub fn otp_seed_cells(code: &str, count: usize) -> Vec<String> {
    let mut cells: Vec<String> = code.chars().take(count).map(String::from).collect();
    while cells.len() < count {
        cells.push(String::new());
    }
    cells
}

/// The rendered cells for a `modelValue`: sanitize → filter → clamp → seed.
pub fn otp_project(raw: &str, count: usize, alphanumeric: bool) -> Vec<String> {
    otp_seed_cells(&otp_sanitize_code(raw, alphanumeric), count)
}

/// The composed code (Vue: `valueArray.join("")`).
pub fn otp_code_of(cells: &[String]) -> String {
    cells.concat()
}

/// Whether the code fills the row (Vue compares `nextValue.length >= n`, so a
/// non-contiguous fill can never count as complete — same test here).
pub fn otp_is_full(code: &str, count: usize) -> bool {
    code.chars().count() >= count
}

/// Index of the first empty cell, or the tail cell when the row is full
/// (Vue: `nextEmptyIndex()`).
pub fn otp_next_empty_index(cells: &[String]) -> usize {
    match cells.iter().position(|cell| cell.is_empty()) {
        Some(index) => index,
        None => cells.len().saturating_sub(1),
    }
}

/// Index of the cell AFTER which the `separated` gap opens; `None` for an
/// unseparated or odd row (Vue: `n % 2 === 0 ? n / 2 - 1 : -1`).
pub fn otp_split_after(count: usize, separated: bool) -> Option<usize> {
    if separated && count > 0 && count.is_multiple_of(2) {
        Some(count / 2 - 1)
    } else {
        None
    }
}

/// Normalize a cell slice to `count` entries (the component always passes a
/// projected row, this keeps the pure helpers total).
fn otp_padded(cells: &[String], count: usize) -> Vec<String> {
    let mut padded = cells.to_vec();
    padded.truncate(count);
    while padded.len() < count {
        padded.push(String::new());
    }
    padded
}

/// Vue's `onCellInput` distribution: the first accepted character of the
/// offered run fills `index`, the remaining accepted characters flow forward.
/// `None` means the run held nothing this instance accepts (Vue clears the
/// painted cell and republishes the unchanged code).
///
/// The second element is the cursor Vue would move to (`write`, or the tail
/// cell once the run fills the row).
pub fn otp_type_run(
    cells: &[String],
    index: usize,
    run: &str,
    count: usize,
    alphanumeric: bool,
) -> Option<(Vec<String>, usize)> {
    if count == 0 || index >= count {
        return None;
    }
    let typed: Vec<char> = otp_sanitize_text(run).chars().collect();
    let first_at = typed.iter().position(|ch| otp_accepts(*ch, alphanumeric))?;
    let mut next = otp_padded(cells, count);
    next[index] = String::from(typed[first_at]);
    let mut write = index + 1;
    for ch in &typed[first_at + 1..] {
        if write >= count {
            break;
        }
        if !otp_accepts(*ch, alphanumeric) {
            continue;
        }
        next[write] = String::from(*ch);
        write += 1;
    }
    let cursor = if write < count { write } else { count - 1 };
    Some((next, cursor))
}

/// Vue's `onCellPaste` distribution: the accepted characters are written from
/// the pasted cell onward. `None` when nothing is accepted (Vue keeps the
/// native paste then, which the mirror cannot reproduce — see the header).
pub fn otp_spread_paste(
    cells: &[String],
    index: usize,
    text: &str,
    count: usize,
    alphanumeric: bool,
) -> Option<(Vec<String>, usize)> {
    if count == 0 {
        return None;
    }
    let accepted: Vec<char> = otp_sanitize_text(text)
        .chars()
        .filter(|ch| otp_accepts(*ch, alphanumeric))
        .collect();
    if accepted.is_empty() {
        return None;
    }
    let mut next = otp_padded(cells, count);
    let mut write = index.min(count);
    for ch in accepted {
        if write >= count {
            break;
        }
        next[write] = String::from(ch);
        write += 1;
    }
    Some((next, write.min(count - 1)))
}

/// Vue's `onBackspace`: clear this cell, or — when it is already empty — step
/// back and clear the previous one. `None` means there is nothing in front of
/// the caret (the first cell is empty) and Vue publishes nothing at all.
pub fn otp_backspace(cells: &[String], index: usize, count: usize) -> Option<(Vec<String>, usize)> {
    if count == 0 || index >= count {
        return None;
    }
    let mut next = otp_padded(cells, count);
    if !next[index].is_empty() {
        next[index] = String::new();
        return Some((next, index));
    }
    if index > 0 {
        next[index - 1] = String::new();
        return Some((next, index - 1));
    }
    None
}

/// Vue's Delete branch: the cells never shift, so a delete is a local clear —
/// and it only publishes when the cell actually held a character.
pub fn otp_clear_cell(
    cells: &[String],
    index: usize,
    count: usize,
) -> Option<(Vec<String>, usize)> {
    if count == 0 || index >= count {
        return None;
    }
    let mut next = otp_padded(cells, count);
    if next[index].is_empty() {
        return None;
    }
    next[index] = String::new();
    Some((next, index))
}

/// Push a class onto a space-separated class list.
fn otp_push_class(classes: &mut String, class: &str) {
    if class.is_empty() {
        return;
    }
    if !classes.is_empty() {
        classes.push(' ');
    }
    classes.push_str(class);
}

/// The event bundle every cell handler shares. `Callback` is cloneable, so a
/// copy per cell is cheap and the row never has to reach back for the props.
#[derive(Clone)]
struct OtpPublish {
    on_input: Option<EventHandler<String>>,
    on_complete: Option<EventHandler<String>>,
    on_cursor_change: Option<EventHandler<usize>>,
    submit_on_enter: Option<EventHandler<()>>,
    auto_submit: bool,
}

impl OtpPublish {
    /// Vue's `publish(next, { focus })`: emit the code when it moved, ask the
    /// host to move the caret, and fire `complete` (+ `autoSubmit`) on the
    /// short → full edge only.
    fn publish(&self, next: Vec<String>, cursor: usize, previous: &str, count: usize) {
        let next_code = otp_code_of(&next);
        if next_code != previous
            && let Some(handler) = self.on_input.as_ref()
        {
            handler.call(next_code.clone());
        }
        if let Some(handler) = self.on_cursor_change.as_ref() {
            handler.call(cursor);
        }
        if !otp_is_full(previous, count) && otp_is_full(&next_code, count) {
            if let Some(handler) = self.on_complete.as_ref() {
                handler.call(next_code);
            }
            if self.auto_submit
                && let Some(handler) = self.submit_on_enter.as_ref()
            {
                handler.call(());
            }
        }
    }

    /// A caret move that leaves the code untouched (arrows / Home / End).
    fn move_cursor(&self, cursor: usize) {
        if let Some(handler) = self.on_cursor_change.as_ref() {
            handler.call(cursor);
        }
    }
}

#[define_props]
pub struct OtpInputProps {
    /// The composed code, at most `length` characters (Vue: `modelValue`).
    #[default]
    pub model_value: String,

    /// Cell count; clamped to `1..=12` like Vue's `cellCount`.
    #[default(6)]
    pub length: i32,

    /// Error ink + message line; also marks every cell `aria-invalid`.
    pub error: Option<String>,

    /// Quiet message under the row, shown only while `error` is unset.
    pub hint: Option<String>,

    /// Visible caption above the row.
    pub label: Option<String>,

    #[default]
    pub size: OtpSize,

    #[default]
    pub disabled: bool,

    #[default]
    pub readonly: bool,

    /// Accept `[0-9A-Za-z]` instead of digits only (invite / recovery codes).
    #[default]
    pub alphanumeric: bool,

    /// Split an even row into two groups (the "123 456" SMS shape).
    #[default]
    pub separated: bool,

    /// First cell's id (Vue: `id`); cell *n* gets `{id}-{n}`. No id is
    /// generated when this is `None` (see the header delta).
    pub id: Option<String>,

    /// Submit intent: Enter in any cell, and `auto_submit` on the fill edge.
    pub submit_on_enter: Option<EventHandler<()>>,

    /// Fire `submit_on_enter` the moment the row fills (Vue: `autoSubmit`).
    #[default]
    pub auto_submit: bool,

    /// Accessible name for the row (Vue: `ariaLabel`, falls back to `label`).
    pub aria_label: Option<String>,

    /// Per-cell accessible name (Vue: `cellAriaLabel`, called with the 1-based
    /// position).
    pub cell_aria_label: Option<Callback<usize, String>>,

    /// The caret index Vue would have moved to (see the header delta) —
    /// auto-advance after a keystroke/paste, the step-back target after
    /// Backspace, the landing cell after ←/→/Home/End.
    pub on_cursor_change: Option<EventHandler<usize>>,

    /// Vue: `update:modelValue`, emitted with the sanitized code.
    pub on_input: Option<EventHandler<String>>,

    /// Vue: `complete`, fired on the short → full edge only.
    pub on_complete: Option<EventHandler<String>>,

    /// Vue: the `focus` emit (per cell).
    pub on_focus: Option<EventHandler<FocusEvent>>,

    /// Vue: the `blur` emit (per cell).
    pub on_blur: Option<EventHandler<FocusEvent>>,

    /// Vue: the `keydown` emit, forwarded after the field's own handling.
    pub on_keydown: Option<EventHandler<KeyboardEvent>>,

    /// Host classes, appended to the row (Vue merges `$attrs.class` there).
    #[default]
    pub class: String,

    /// Host style, applied to the row (Vue merges `$attrs.style` there).
    #[default]
    pub style: String,
}

#[component]
pub fn OtpInput(props: OtpInputProps) -> Element {
    let count = otp_cell_count(props.length);
    let alphanumeric = props.alphanumeric;
    let cells = otp_project(&props.model_value, count, alphanumeric);
    let code = otp_code_of(&cells);

    // Vue truthiness: an empty string is falsy for all three.
    let error_text = props.error.clone().filter(|error| !error.is_empty());
    let hint_text = props.hint.clone().filter(|hint| !hint.is_empty());
    let label_text = props.label.clone().filter(|label| !label.is_empty());

    let mut row_classes = String::from("hk-otp");
    otp_push_class(&mut row_classes, props.size.modifier());
    if error_text.is_some() {
        otp_push_class(&mut row_classes, "hk-otp-error");
    }
    if props.disabled {
        otp_push_class(&mut row_classes, "hk-otp-disabled");
    }
    if props.readonly {
        otp_push_class(&mut row_classes, "hk-otp-readonly");
    }
    otp_push_class(&mut row_classes, &props.class);

    let group_label = props
        .aria_label
        .clone()
        .filter(|value| !value.is_empty())
        .or_else(|| label_text.clone());
    let first_cell_id = props.id.clone();
    let hint_id = props.id.as_ref().map(|id| format!("{id}-hint"));
    let described_by = if error_text.is_none() && hint_text.is_some() {
        hint_id.clone()
    } else {
        None
    };

    let publish = OtpPublish {
        on_input: props.on_input.clone(),
        on_complete: props.on_complete.clone(),
        on_cursor_change: props.on_cursor_change.clone(),
        submit_on_enter: props.submit_on_enter.clone(),
        auto_submit: props.auto_submit,
    };
    let split_after = otp_split_after(count, props.separated);
    let has_error = error_text.is_some();
    let disabled = props.disabled;
    let readonly = props.readonly;

    // The cells are pre-built: an rsx `for` body cannot carry the per-cell
    // `let` bindings each handler needs, and every closure must own its index.
    let mut cell_nodes: Vec<VNode> = Vec::with_capacity(count + 1);
    for index in 0..count {
        let cell_value = cells.get(index).cloned().unwrap_or_default();
        let cell_id = first_cell_id.as_ref().map(|id| {
            if index == 0 {
                id.clone()
            } else {
                format!("{id}-{index}")
            }
        });
        let cell_label = match props.cell_aria_label.as_ref() {
            Some(formatter) => formatter.call(index + 1),
            None => format!("Digit {}", index + 1),
        };

        let mut cell = VElement::new("input")
            .class("hk-otp-cell")
            .attr("type", "text")
            .attr("value", cell_value)
            .attr("inputmode", if alphanumeric { "text" } else { "numeric" })
            .attr(
                "autocomplete",
                if index == 0 { "one-time-code" } else { "off" },
            )
            .attr("autocapitalize", "off")
            .attr("autocorrect", "off")
            .attr("spellcheck", "false")
            .attr("aria-label", cell_label);
        if let Some(id) = cell_id {
            cell = cell.attr("id", id);
        }
        if disabled {
            cell = cell
                .attr("disabled", "disabled")
                .attr("aria-disabled", "true");
        }
        if readonly {
            cell = cell.attr("readonly", "readonly");
        }
        if has_error {
            cell = cell.attr("aria-invalid", "true");
        }

        // `input` — typed runs, and the paste branch (see the header delta).
        let input_publish = publish.clone();
        let input_cells = cells.clone();
        let input_previous = code.clone();
        cell = cell.on_input(move |event: InputEvent| {
            let run = event.data.clone();
            if otp_sanitize_text(&run).is_empty() {
                // No text offered: the browser removed the cell's glyph (a
                // deletion the keydown path never saw, e.g. the IME's).
                if let Some((next, cursor)) = otp_clear_cell(&input_cells, index, count) {
                    input_publish.publish(next, cursor, &input_previous, count);
                }
                return;
            }
            let spread = if event.input_type.to_ascii_lowercase().contains("paste") {
                otp_spread_paste(&input_cells, index, &run, count, alphanumeric)
            } else {
                otp_type_run(&input_cells, index, &run, count, alphanumeric)
            };
            if let Some((next, cursor)) = spread {
                input_publish.publish(next, cursor, &input_previous, count);
            }
        });

        // `keydown` — Vue's interception set, minus the caret work.
        let key_publish = publish.clone();
        let key_cells = cells.clone();
        let key_previous = code.clone();
        let key_onkeydown = props.on_keydown.clone();
        cell = cell.on_keydown(move |event: KeyboardEvent| {
            if otp_is_composing() {
                // Composition keystrokes are the IME's, not the field's — but
                // the host asked for every keydown, so it is forwarded before
                // the early return rather than swallowed (Vue's branch).
                if let Some(handler) = key_onkeydown.as_ref() {
                    handler.call(event.clone());
                }
                return;
            }
            match event.key.as_str() {
                "Backspace" => {
                    event.prevent_default();
                    if let Some((next, cursor)) = otp_backspace(&key_cells, index, count) {
                        key_publish.publish(next, cursor, &key_previous, count);
                    }
                }
                "Delete" => {
                    event.prevent_default();
                    if let Some((next, cursor)) = otp_clear_cell(&key_cells, index, count) {
                        key_publish.publish(next, cursor, &key_previous, count);
                    }
                }
                "ArrowLeft" => {
                    event.prevent_default();
                    if index > 0 {
                        key_publish.move_cursor(index - 1);
                    }
                }
                "ArrowRight" => {
                    event.prevent_default();
                    if index + 1 < count {
                        key_publish.move_cursor(index + 1);
                    }
                }
                "Home" => {
                    event.prevent_default();
                    key_publish.move_cursor(0);
                }
                "End" => {
                    event.prevent_default();
                    key_publish.move_cursor(count - 1);
                }
                "Enter"
                    if !event.ctrl_key
                        && !event.meta_key
                        && !event.alt_key
                        && !event.shift_key
                        && !disabled
                        && !readonly =>
                {
                    event.prevent_default();
                    if let Some(handler) = key_publish.submit_on_enter.as_ref() {
                        handler.call(());
                    }
                }
                _ => {}
            }
            if let Some(handler) = key_onkeydown.as_ref() {
                handler.call(event);
            }
        });

        // focus / blur — Vue emits both per cell.
        let focus_handler = props.on_focus.clone();
        cell = cell.on_focus(move |event: FocusEvent| {
            if let Some(handler) = focus_handler.as_ref() {
                handler.call(event);
            }
        });
        let blur_handler = props.on_blur.clone();
        cell = cell.on_blur(move |event: FocusEvent| {
            if let Some(handler) = blur_handler.as_ref() {
                handler.call(event);
            }
        });

        // Composition is not a typed event in tairitsu 0.5.22; the boxed
        // payload is unused, only the edge matters.
        cell = cell.on_event("compositionstart", move |_event: Box<dyn EventData>| {
            set_otp_composing(true);
        });
        cell = cell.on_event("compositionend", move |_event: Box<dyn EventData>| {
            set_otp_composing(false);
        });

        cell_nodes.push(VNode::Element(Box::new(cell)));

        if Some(index) == split_after {
            let gap = VElement::new("span")
                .class("hk-otp-gap")
                .attr("aria-hidden", "true");
            cell_nodes.push(VNode::Element(Box::new(gap)));
        }
    }

    // `--hk-otp-fitted-font` is what the sheet's font-size chain reads; Vue
    // measures one cell and publishes it per row. Without a publish every size
    // renders the 1.25rem literal, so sm/lg would be visibly wrong.
    let fitted_font = format!("--hk-otp-fitted-font:{}", props.size.pinned_font());

    rsx! {
        div {
            class: "hk-otp-wrapper",
            style: fitted_font,
            if let Some(label) = label_text {
                label {
                    class: "hk-otp-label",
                    "for": first_cell_id,
                    "{label}"
                }
            }
            div {
                class: row_classes,
                style: props.style.clone(),
                "role": "group",
                "aria-label": group_label,
                "aria-describedby": described_by,
                {VNode::Fragment(cell_nodes)}
            }
            if let Some(error) = error_text {
                p {
                    class: "hk-otp-error-msg",
                    "role": "alert",
                    "{error}"
                }
            } else if let Some(hint) = hint_text {
                p {
                    class: "hk-otp-hint",
                    id: hint_id,
                    "{hint}"
                }
            }
        }
    }
}

impl StyledComponent for OtpInputComponent {
    fn styles() -> &'static str {
        // The canonical Vue sheet, compiled verbatim (no_hash keeps the
        // `.hk-otp*` names literal so this CSS matches the Vue build).
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkOtpInput.scss", no_hash }
            .0
    }

    fn name() -> &'static str {
        "otp-input"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn otp_sanitize_drops_the_separators_vue_drops() {
        // Commas vanish, the hyphen/space/dash family is dropped.
        assert_eq!(otp_sanitize_text("123 456"), "123456");
        assert_eq!(otp_sanitize_text("123-456"), "123456");
        assert_eq!(otp_sanitize_text(" 123\u{2013}456 "), "123456");
        assert_eq!(otp_sanitize_text("1,2,3_4.5"), "12345");
        // Nothing else is touched — letters and symbols survive here and are
        // filtered by the alphabet, not by the sanitizer.
        assert_eq!(otp_sanitize_text("12a34+"), "12a34+");
        assert_eq!(otp_sanitize_text(""), "");
    }

    #[test]
    fn otp_code_sanitize_filters_the_instance_alphabet() {
        assert_eq!(otp_sanitize_code("12a34", false), "1234");
        assert_eq!(otp_sanitize_code("12a34", true), "12a34");
        assert_eq!(otp_sanitize_code("AB-12 cd", true), "AB12cd");
        // Case is the caller's business: nothing is upper- or lower-cased.
        assert_eq!(otp_sanitize_code("aBc", true), "aBc");
        assert!(otp_accepts('7', false) && !otp_accepts('a', false));
        assert!(otp_accepts('a', true) && otp_accepts('7', true));
        assert!(!otp_accepts('-', true));
    }

    #[test]
    fn otp_cell_count_clamps_the_row() {
        assert_eq!(otp_cell_count(6), 6);
        assert_eq!(otp_cell_count(1), 1);
        assert_eq!(otp_cell_count(12), 12);
        // Vue: Math.max(1, Math.min(12, …)) — a zero/negative row is still a
        // field, and the tail stops at a dozen cells.
        assert_eq!(otp_cell_count(0), 1);
        assert_eq!(otp_cell_count(-5), 1);
        assert_eq!(otp_cell_count(99), 12);
    }

    #[test]
    fn otp_project_pads_and_clamps_the_incoming_value() {
        let cells = otp_project("12", 4, false);
        assert_eq!(cells, vec!["1", "2", "", ""]);
        assert_eq!(otp_code_of(&cells), "12");
        // A host holding the raw shape is handed back the code the field holds.
        let cells = otp_project("123 456", 4, false);
        assert_eq!(otp_code_of(&cells), "1234");
        let cells = otp_project("12a34", 6, false);
        assert_eq!(otp_code_of(&cells), "1234");
        // Only the first empty cell counts; a full row answers with its tail.
        assert_eq!(otp_next_empty_index(&otp_project("12", 4, false)), 2);
        assert_eq!(otp_next_empty_index(&otp_project("1234", 4, false)), 3);
    }

    #[test]
    fn otp_type_run_advances_like_vue() {
        let cells = otp_project("", 6, false);
        let (next, cursor) = otp_type_run(&cells, 0, "1", 6, false).expect("accepted run");
        assert_eq!(otp_code_of(&next), "1");
        assert_eq!(next[0], "1");
        // Auto-advance: the caret lands on the next cell…
        assert_eq!(cursor, 1);
        // …and on the tail cell once the run fills the row.
        let (next, cursor) = otp_type_run(&cells, 0, "1234567", 6, false).expect("accepted run");
        assert_eq!(otp_code_of(&next), "123456");
        assert_eq!(cursor, 5);
        // A multi-character run hands the extra characters forward (Vue's
        // IME/autofill branch) and a rejected character is skipped.
        let (next, cursor) = otp_type_run(&cells, 2, "3a4", 6, false).expect("accepted run");
        assert_eq!(next[2], "3");
        assert_eq!(next[3], "4");
        assert_eq!(cursor, 4);
        // Nothing in this instance's alphabet → no publish at all.
        assert!(otp_type_run(&cells, 0, "abc", 6, false).is_none());
        assert!(otp_type_run(&cells, 6, "1", 6, false).is_none());
    }

    #[test]
    fn otp_paste_fills_from_the_pasted_cell() {
        let cells = otp_project("", 6, false);
        // Separators are dropped before distribution ("123 456" just works).
        let (next, cursor) = otp_spread_paste(&cells, 0, "123 456", 6, false).expect("paste");
        assert_eq!(otp_code_of(&next), "123456");
        assert_eq!(cursor, 5);
        // Pasted at cell 1: the code starts there and is clamped to the row.
        let (next, cursor) = otp_spread_paste(&cells, 1, "123456", 6, false).expect("paste");
        assert_eq!(next[0], "");
        assert_eq!(otp_code_of(&next), "12345");
        assert_eq!(cursor, 5);
        // A paste with nothing acceptable keeps the native behaviour (None).
        assert!(otp_spread_paste(&cells, 0, "abc", 6, false).is_none());
    }

    #[test]
    fn otp_backspace_clears_then_steps_back() {
        let cells = otp_project("123", 6, false);
        // An occupied cell is cleared in place.
        let (next, cursor) = otp_backspace(&cells, 1, 6).expect("backspace");
        assert_eq!(otp_code_of(&next), "13");
        assert_eq!(cursor, 1);
        // An empty cell steps back and clears the previous one.
        let (next, cursor) = otp_backspace(&cells, 3, 6).expect("backspace");
        assert_eq!(otp_code_of(&next), "12");
        assert_eq!(cursor, 2);
        // Ahead of the first cell there is nothing left to delete.
        assert!(otp_backspace(&otp_project("", 6, false), 0, 6).is_none());
        // Delete is a local clear and only publishes on an occupied cell.
        let (next, cursor) = otp_clear_cell(&cells, 2, 6).expect("delete");
        assert_eq!(otp_code_of(&next), "12");
        assert_eq!(cursor, 2);
        assert!(otp_clear_cell(&cells, 4, 6).is_none());
    }

    #[test]
    fn otp_separated_split_only_opens_on_an_even_row() {
        assert_eq!(otp_split_after(6, true), Some(2));
        assert_eq!(otp_split_after(4, true), Some(1));
        // Vue: ignored for odd rows and for the unseparated default.
        assert_eq!(otp_split_after(5, true), None);
        assert_eq!(otp_split_after(6, false), None);
        assert_eq!(otp_split_after(0, true), None);
    }

    #[test]
    fn otp_complete_edge_needs_a_full_row() {
        assert!(!otp_is_full("12345", 6));
        assert!(otp_is_full("123456", 6));
        assert!(otp_is_full("1234567", 6));
        // A non-contiguous fill can never reach the row width (Vue compares
        // the joined length, not the occupied-cell count).
        let holes = otp_project("1", 6, false);
        assert_eq!(otp_code_of(&holes).chars().count(), 1);
        assert!(!otp_is_full(&otp_code_of(&holes), 6));
    }

    #[test]
    fn otp_props_default_matches_the_vue_props() {
        let props = OtpInputProps::default();
        assert_eq!(props.model_value, "");
        // Vue's `length` default is 6 (the universal TOTP/SMS width).
        assert_eq!(props.length, 6);
        assert_eq!(props.error, None);
        assert_eq!(props.hint, None);
        assert_eq!(props.label, None);
        assert_eq!(props.size, OtpSize::Md);
        assert!(!props.disabled);
        assert!(!props.readonly);
        assert!(!props.alphanumeric);
        assert!(!props.separated);
        assert!(!props.auto_submit);
        assert_eq!(props.id, None);
        assert_eq!(props.aria_label, None);
        assert!(props.cell_aria_label.is_none());
        assert!(props.on_cursor_change.is_none());
        assert!(props.on_input.is_none());
        assert!(props.on_complete.is_none());
        assert!(props.on_focus.is_none());
        assert!(props.on_blur.is_none());
        assert!(props.on_keydown.is_none());
        assert!(props.submit_on_enter.is_none());
        assert_eq!(props.class, "");
        assert_eq!(props.style, "");
    }

    #[test]
    fn otp_size_classes_match_the_vue_ramps() {
        assert_eq!(OtpSize::Sm.modifier(), "hk-otp-sm");
        assert_eq!(OtpSize::Md.modifier(), "hk-otp-md");
        assert_eq!(OtpSize::Lg.modifier(), "hk-otp-lg");
        assert_eq!(OtpSize::default(), OtpSize::Md);
    }

    #[test]
    fn otp_renders_the_vue_row_contract() {
        let html = OtpInput(OtpInputProps {
            model_value: "12".to_string(),
            label: Some("Verification code".to_string()),
            hint: Some("Six digits".to_string()),
            id: Some("otp".to_string()),
            style: "max-width:20rem".to_string(),
            class: "host".to_string(),
            ..Default::default()
        })
        .render_to_html();
        for needle in [
            "hk-otp-wrapper",
            "hk-otp-label",
            "hk-otp hk-otp-md",
            "hk-otp-cell",
            "role=\"group\"",
            "aria-label=\"Verification code\"",
            "aria-describedby=\"otp-hint\"",
            "id=\"otp\"",
            "id=\"otp-1\"",
            "value=\"1\"",
            "value=\"2\"",
            "inputmode=\"numeric\"",
            "autocomplete=\"one-time-code\"",
            "autocomplete=\"off\"",
            "spellcheck=\"false\"",
            "hk-otp-hint",
            "id=\"otp-hint\"",
            "hk-otp-md host",
            "max-width:20rem",
            "aria-label=\"Digit 1\"",
            "aria-label=\"Digit 6\"",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        assert_eq!(
            html.matches("hk-otp-cell").count(),
            6,
            "one cell per character: {html}"
        );
    }

    #[test]
    fn otp_renders_the_error_separated_and_alphanumeric_arms() {
        let html = OtpInput(OtpInputProps {
            separated: true,
            alphanumeric: true,
            disabled: true,
            error: Some("Wrong code".to_string()),
            hint: Some("ignored while an error shows".to_string()),
            aria_label: Some("One-time code".to_string()),
            ..Default::default()
        })
        .render_to_html();
        for needle in [
            "hk-otp-gap",
            "hk-otp-error",
            "hk-otp-disabled",
            "role=\"alert\"",
            "aria-invalid=\"true\"",
            "aria-disabled=\"true\"",
            "inputmode=\"text\"",
            "disabled=\"disabled\"",
            "aria-label=\"One-time code\"",
            "aria-hidden=\"true\"",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        // The error wins the message slot; the hint is not rendered at all.
        assert!(!html.contains("hk-otp-hint"), "{html}");
        // The digit-mode maxlength fence is not emitted (paste needs the run).
        assert!(!html.contains("maxlength"), "{html}");
    }

    #[test]
    fn otp_styles_come_from_the_canonical_vue_sheet() {
        let css = OtpInputComponent::styles();
        for needle in [
            ".hk-otp-wrapper",
            ".hk-otp-cell",
            ".hk-otp-gap",
            ".hk-otp-error-msg",
            ".hk-otp-hint",
            ".hk-otp-sm",
            "aspect-ratio",
            "--hk-otp-fitted-font",
        ] {
            assert!(
                css.contains(needle),
                "otp css must carry the vue hook {needle}"
            );
        }
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored otp sheet"
        );
    }
}
