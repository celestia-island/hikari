// hi-components/src/basic/token_input.rs
// TokenInput — mirror of the canonical Vue `HkTokenInput`: the standalone
// token-budget EDITOR control — a value segment (press opens the precision
// editor) plus the unit suffix dropdown (auto / K / M / B). It carries no
// outer chrome of its own; hosts drop it into any slot (commonly a
// slider-field's trailing slot, where the composition lives in the host).
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkTokenInput.scss`, vendored under
// `src/styles/vue-mirror/` and guarded by `tests/vue_mirror_drift_tests.rs`),
// compiled with `no_hash` so the `.hk-token-*` class names are literal and
// identical in both forms. The DOM contract below mirrors the Vue render output:
//
//   div.hk-token-input [.is-disabled]
//       role="group" [aria-label]
//     button.hk-token-input-value
//         type="button" [disabled] aria-haspopup="dialog"
//         aria-label="{editorTitle}: {display}" [title]
//       {display}
//     div.hk-select-wrapper.hk-token-input-unit      (the mirrored `Select`
//         ── the shared unit picker: trigger + popout/sheet, exactly Vue's
//            `<HkSelect class="hk-token-input-unit">` composition ──
//
// Vue prop mapping: `modelValue` → [`TokenInputProps::model_value`]
// (`number | null`, `null` = unset, rendered `—`), `unit` →
// [`TokenInputProps::unit`] ([`TokenUnitChoice`]; `auto` compacts), `disabled` →
// [`TokenInputProps::disabled`], `editorTitle` →
// [`TokenInputProps::editor_title`], `ariaLabel` →
// [`TokenInputProps::aria_label`]. The two emits are `update:modelValue` →
// [`TokenInputProps::onupdate_model_value`] and `update:unit` →
// [`TokenInputProps::onupdate_unit`] (carried out of the nested unit picker).
//
// The editor's arithmetic is a PURE surface, ported from `HkTokenValueEditor`
// so a host-side editor reuses the exact semantics:
//   * [`compact_token_count`] — Vue's default formatter (`750`, `128K`, `1.5M`,
//     `2.5B`; plain integers under 1K);
//   * [`trim_token_number`] — Vue's `trim` (`Math.round(n * 100) / 100` then
//     the JavaScript number spelling, no trailing zeros);
//   * [`token_input_display`] — Vue's `display()` (null → `—`, an explicit unit
//     divides, `auto` compacts);
//   * [`seed_editor_unit`] — the unit the editor opens in (the explicit unit,
//     else the value's natural magnitude, else K);
//   * [`rescale_editor_text`] — the editor's value text for an absolute + unit;
//   * [`parse_editor_commit`] — the live-commit rule: only a deliberately
//     emptied field unsets, a transiently unparseable intermediate ("1e", "-",
//     " ") commits NOTHING, and separators (`,`, `_`, whitespace) are dropped;
//   * [`switch_unit_expression`] — a unit flip re-expresses the SAME absolute
//     budget instead of rescaling it.
//
// Behaviour deltas vs Vue (documented, not accidental):
//   * NO PRECISION-EDITOR DIALOG. Vue mounts `HkAdaptiveDialog` (a draggable
//     desktop window / mobile slide-up sheet) around the editor body plus a
//     clear button. This crate has no dialog/portal host in the mirrored
//     surface (`HkAdaptiveDialog` has no Rust mirror in this wave), so the
//     value button only REQUESTS the editor (`onupdate_editor_open(true)`) and
//     the host renders the body — reusing the pure functions above, which are
//     the whole arithmetic of `HkTokenValueEditor`. Consequences: the
//     `hk-token-input-editor-body` / `hk-token-editor*` / `hk-token-input-clear`
//     nodes are NOT rendered here, and Vue's `#editor` slot has no analogue
//     (a slot with a render-scoped payload cannot be mirrored as a prop).
//   * `format` IS A [`Callback`], NOT AN `EventHandler`: Vue's `format` prop is
//     a `(value, unit) => string` function, and tairitsu's `Callback<T, R>`
//     carries a return value (the same shape `utils/positioning.rs` already uses
//     for `get_position`). The mirror keeps Vue's prop name and passes the same
//     pair; `None` keeps the built-in compaction.
//   * the editor's `editorUnit` / dialog `editorOpen` are LOCAL refs in Vue; the
//     mirror makes the open flag a CONTROLLED prop ([`TokenInputProps::editor_open`])
//     like every other mirrored surface, and the unit picker's own open /
//     highlight state rides [`TokenInputProps::unit_open`] /
//     [`TokenInputProps::unit_highlighted_index`] — that is the mirrored
//     `Select`'s own controlled contract (Vue's HkSelect owns both internally).
//   * the unit picker is the mirrored `Select` component, so its DOM is that
//     component's documented contract (`hk-select-wrapper` + `hk-select-trigger`
//     + popout/sheet); Vue nests `HkSelect` in exactly the same place, so the
//     class list matches while the popup host differs (see `basic/select.rs`).
//   * `editorTitle` / the clear label have i18n fallbacks
//     (`hikari::tokenField.editValue` / `hikari::tokenField.clear`); the clear
//     label is unused here because the clear button lives in the un-mirrored
//     dialog body.

use hikari_i18n::t;

use crate::basic::{Select, SelectOption};
use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct TokenInputComponent;

/// The display/entry unit (Vue: `unit: "auto" | TokenUnit`, where
/// `TokenUnit = "K" | "M" | "B"`). `auto` compacts to the value's natural
/// magnitude instead of dividing.
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum TokenUnitChoice {
    #[default]
    Auto,
    Kilo,
    Mega,
    Giga,
}

impl TokenUnitChoice {
    /// The Vue union token (`"auto"` / `"K"` / `"M"` / `"B"`).
    pub fn token(self) -> &'static str {
        match self {
            TokenUnitChoice::Auto => "auto",
            TokenUnitChoice::Kilo => "K",
            TokenUnitChoice::Mega => "M",
            TokenUnitChoice::Giga => "B",
        }
    }

    /// Parse the Vue union token (used to map the unit picker's emitted value
    /// back to the enum).
    pub fn from_token(token: &str) -> Option<Self> {
        match token {
            "auto" => Some(TokenUnitChoice::Auto),
            "K" => Some(TokenUnitChoice::Kilo),
            "M" => Some(TokenUnitChoice::Mega),
            "B" => Some(TokenUnitChoice::Giga),
            _ => None,
        }
    }

    /// Vue's `UNIT_SCALE` multiplier; `None` for `auto` (which compacts
    /// instead of dividing).
    pub fn scale(self) -> Option<f64> {
        match self {
            TokenUnitChoice::Auto => None,
            TokenUnitChoice::Kilo => Some(1e3),
            TokenUnitChoice::Mega => Some(1e6),
            TokenUnitChoice::Giga => Some(1e9),
        }
    }
}

/// What the editor's live commit decided (Vue: the body of `commit()` in
/// `HkTokenValueEditor`).
#[derive(Clone, PartialEq, Debug)]
pub enum TokenEditorCommit {
    /// A transiently unparseable intermediate — commit NOTHING, so live
    /// consumers never see a flicker of `null` while the user types.
    Nothing,

    /// The field was deliberately emptied — unset the value.
    Clear,

    /// A usable positive number: the absolute it commits (`n * UNIT_SCALE[unit]`,
    /// rounded), which the host writes back as `update:modelValue`.
    Commit(f64),
}

/// What a unit flip did to the editor's text (Vue: `switchUnit`).
#[derive(Clone, PartialEq, Debug)]
pub enum TokenUnitFlip {
    /// The picker asked for the unit it already works in — no-op.
    Unchanged,

    /// Re-express the SAME absolute budget under the new scale (never rescale
    /// the number itself).
    Reexpress { text: String, unit: TokenUnitChoice },

    /// The text could not be re-expressed (transiently unparseable); clearing
    /// is the honest move — stale text under a new scale would commit a 1000×
    /// jump on the next keystroke. The value is unset alongside the flip.
    Clear { unit: TokenUnitChoice },
}

/// Vue's `trim`: `String(Math.round(n * 100) / 100)` — at most two decimals, no
/// trailing zeros. JavaScript prints an integer-valued double without a decimal
/// point, which is what the integer branch reproduces.
pub fn trim_token_number(value: f64) -> String {
    if !value.is_finite() {
        // JavaScript would print `NaN` / `Infinity`; the display paths guard on
        // finiteness before reaching here, so an empty string is the safe edge.
        return String::new();
    }
    let rounded = (value * 100.0).round() / 100.0;
    if rounded.abs() >= 1e15 {
        // JavaScript switches to exponential notation here (`1e+21`); the
        // mirror keeps Rust's decimal spelling instead of reproducing that edge
        // (no token budget reaches it).
        return format!("{rounded}");
    }
    if rounded == rounded.trunc() {
        return format!("{}", rounded as i64);
    }
    let mut text = format!("{rounded:.2}");
    while text.ends_with('0') {
        text.pop();
    }
    if text.ends_with('.') {
        text.pop();
    }
    text
}

/// Vue's default formatter (`compactTokenCount`): decimal compaction — `1.5M`,
/// `128K`, `750` (plain under 1K); `None` and non-finite values render `""`.
pub fn compact_token_count(value: Option<f64>) -> String {
    let Some(value) = value else {
        return String::new();
    };
    if !value.is_finite() {
        return String::new();
    }
    if value >= 1e9 {
        return format!("{}B", trim_token_number(value / 1e9));
    }
    if value >= 1e6 {
        return format!("{}M", trim_token_number(value / 1e6));
    }
    if value >= 1e3 {
        return format!("{}K", trim_token_number(value / 1e3));
    }
    format!("{}", value.round() as i64)
}

/// Vue's `display()`: `null` renders `—`, an explicit unit divides and appends
/// the letter, `auto` compacts.
pub fn token_input_display(model_value: Option<f64>, unit: TokenUnitChoice) -> String {
    let Some(value) = model_value else {
        return "—".to_string();
    };
    match unit.scale() {
        Some(scale) => format!("{}{}", trim_token_number(value / scale), unit.token()),
        None => compact_token_count(Some(value)),
    }
}

/// Vue's `seedEditorUnit`: the editor works in the explicit display unit, else
/// in the value's natural magnitude (K for unset), else K.
pub fn seed_editor_unit(model_value: Option<f64>, unit: TokenUnitChoice) -> TokenUnitChoice {
    if unit != TokenUnitChoice::Auto {
        return unit;
    }
    match model_value {
        None => TokenUnitChoice::Kilo,
        Some(value) if value >= 1e9 => TokenUnitChoice::Giga,
        Some(value) if value >= 1e6 => TokenUnitChoice::Mega,
        Some(_) => TokenUnitChoice::Kilo,
    }
}

/// Vue's `rescale`: the editor's value text for an absolute + unit; an unset,
/// non-finite or non-positive value shows an empty field.
pub fn rescale_editor_text(model_value: Option<f64>, unit: TokenUnitChoice) -> String {
    let Some(value) = model_value else {
        return String::new();
    };
    if !value.is_finite() || value <= 0.0 {
        return String::new();
    }
    let scale = unit.scale().unwrap_or(1.0);
    trim_token_number(value / scale)
}

/// Vue's `commit()`: the trimmed field text, separators (`,`, `_`, whitespace)
/// dropped, scaled by the editor's unit. Only a deliberately emptied field
/// unsets; a transiently unparseable intermediate commits nothing.
pub fn parse_editor_commit(raw: &str, unit: TokenUnitChoice) -> TokenEditorCommit {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return TokenEditorCommit::Clear;
    }
    let cleaned: String = trimmed
        .chars()
        .filter(|ch| !matches!(ch, ',' | '_') && !ch.is_whitespace())
        .collect();
    let Ok(number) = cleaned.parse::<f64>() else {
        return TokenEditorCommit::Nothing;
    };
    if !number.is_finite() || number <= 0.0 {
        return TokenEditorCommit::Nothing;
    }
    let scale = unit.scale().unwrap_or(1.0);
    TokenEditorCommit::Commit((number * scale).round())
}

/// Vue's `switchUnit`: a unit flip re-expresses the same absolute budget under
/// the new scale; an unparseable, surviving text is cleared instead (see
/// [`TokenUnitFlip::Clear`]).
pub fn switch_unit_expression(
    text: &str,
    from: TokenUnitChoice,
    to: TokenUnitChoice,
) -> TokenUnitFlip {
    if from == to {
        return TokenUnitFlip::Unchanged;
    }
    let cleaned: String = text
        .chars()
        .filter(|ch| !matches!(ch, ',' | '_') && !ch.is_whitespace())
        .collect();
    match cleaned.parse::<f64>() {
        Ok(number) if number.is_finite() && number > 0.0 => {
            let absolute = number * from.scale().unwrap_or(1.0);
            let scale = to.scale().unwrap_or(1.0);
            TokenUnitFlip::Reexpress {
                text: trim_token_number(absolute / scale),
                unit: to,
            }
        }
        // Unparseable text canNOT be re-expressed, but an EMPTY field has
        // nothing to clear either — Vue only clears a non-empty text.
        _ => {
            if text.trim().is_empty() {
                TokenUnitFlip::Reexpress {
                    text: String::new(),
                    unit: to,
                }
            } else {
                TokenUnitFlip::Clear { unit: to }
            }
        }
    }
}

/// The suffix picker's options, exactly Vue's `unitOptions` (labels are the
/// union tokens themselves).
pub fn token_unit_options() -> Vec<SelectOption> {
    [
        TokenUnitChoice::Auto,
        TokenUnitChoice::Kilo,
        TokenUnitChoice::Mega,
        TokenUnitChoice::Giga,
    ]
    .into_iter()
    .map(|unit| SelectOption {
        value: unit.token().to_string(),
        label: unit.token().to_string(),
        disabled: false,
    })
    .collect()
}

/// Vue's `resolvedEditorTitle`: `editorTitle ?? t("hikari::tokenField.editValue",
/// "Edit value")`.
pub fn token_input_editor_title(editor_title: Option<&str>) -> String {
    match editor_title {
        Some(editor_title) => editor_title.to_string(),
        None => t("hikari::tokenField.editValue", "Edit value"),
    }
}

/// Vue's root class list: `hk-token-input`, then `is-disabled` when disabled.
pub fn token_input_classes(disabled: bool) -> String {
    if disabled {
        "hk-token-input is-disabled".to_string()
    } else {
        "hk-token-input".to_string()
    }
}

/// Vue's presence-only boolean attribute (`disabled` when on, absent when off):
/// a serialized `disabled="false"` is still a TRUE HTML boolean.
fn boolean_attr(flag: bool) -> Option<&'static str> {
    if flag { Some("true") } else { None }
}

#[define_props]
pub struct TokenInputProps {
    /// Vue: `modelValue` — the absolute token count; `None` = unset (`null`).
    pub model_value: Option<f64>,

    /// Vue: `unit`, default `auto`.
    #[default]
    pub unit: TokenUnitChoice,

    #[default]
    pub disabled: bool,

    /// The precision editor's title (Vue: `editorTitle`); falls back to
    /// `t("hikari::tokenField.editValue", "Edit value")`.
    pub editor_title: Option<String>,

    /// Accessible name of the whole group (Vue: `ariaLabel`).
    pub aria_label: Option<String>,

    /// Vue's `format` — a host display formatter `(value, unit) => string` that
    /// wins over the built-in compaction. A tairitsu [`Callback`] carries the
    /// return value, so Vue's function prop is expressible here as-is.
    pub format: Option<Callback<(Option<f64>, TokenUnitChoice), String>>,

    /// The precision editor's open flag (Vue: the local `editorOpen` ref); the
    /// dialog body itself is host-side (see the deltas).
    #[default]
    pub editor_open: bool,

    /// The nested unit picker's open flag (the mirrored `Select`'s controlled
    /// contract; Vue's HkSelect owns this internally).
    #[default]
    pub unit_open: bool,

    /// The nested unit picker's highlight index (`-1` = none), same contract.
    #[default(-1)]
    pub unit_highlighted_index: i32,

    /// Vue: `update:modelValue` (fired by the host's editor, using the pure
    /// commit rules this module exposes).
    pub onupdate_model_value: Option<EventHandler<Option<f64>>>,

    /// Vue: `update:unit` — the suffix picker asked for another unit.
    pub onupdate_unit: Option<EventHandler<TokenUnitChoice>>,

    /// The value button asked to open the precision editor (Vue: `openEditor`).
    pub onupdate_editor_open: Option<EventHandler<bool>>,

    /// Nested unit picker: `update:open`.
    pub on_unit_open_change: Option<EventHandler<bool>>,

    /// Nested unit picker: the highlight moved.
    pub on_unit_highlight_change: Option<EventHandler<i32>>,
}

#[component]
pub fn TokenInput(props: TokenInputProps) -> Element {
    let classes = token_input_classes(props.disabled);
    let title = token_input_editor_title(props.editor_title.as_deref());
    // Vue: `if (props.format) return props.format(props.modelValue, props.unit)`
    // before every built-in branch.
    let display = match props.format.as_ref() {
        Some(formatter) => formatter.call((props.model_value, props.unit)),
        None => token_input_display(props.model_value, props.unit),
    };
    let disabled = props.disabled;

    // The value button's accessible name: Vue's
    // `aria-label={`${resolvedEditorTitle}: ${display()}`}`.
    let value_aria_label = format!("{title}: {display}");

    let on_update_editor_open = props.onupdate_editor_open.clone();
    let onupdate_unit = props.onupdate_unit.clone();

    // The unit picker: Vue nests `<HkSelect class="hk-token-input-unit">`, so
    // the mirror composes the mirrored Select with the same class (which lands
    // on its wrapper, exactly where HkSelect's root carries it).
    let unit_change = move |value: String| {
        if let Some(next) = TokenUnitChoice::from_token(&value)
            && let Some(handler) = onupdate_unit.as_ref()
        {
            handler.call(next);
        }
    };

    rsx! {
        div { class: classes, role: "group", "aria-label": props.aria_label.clone(),
            button {
                "type": "button",
                class: "hk-token-input-value",
                disabled: boolean_attr(disabled),
                "aria-haspopup": "dialog",
                "aria-label": value_aria_label,
                title: title,
                onclick: move |_event: MouseEvent| {
                    // Vue's `openEditor`: `if (props.disabled) return;` then seed
                    // the editor unit and open the dialog.
                    if !disabled
                        && let Some(handler) = on_update_editor_open.as_ref()
                    {
                        handler.call(true);
                    }
                },
                "{display}"
            }
            Select {
                class: "hk-token-input-unit".to_string(),
                model_value: props.unit.token().to_string(),
                options: token_unit_options(),
                disabled,
                open: props.unit_open,
                highlighted_index: props.unit_highlighted_index,
                on_value_change: Some(event_handler(unit_change)),
                on_open_change: props.on_unit_open_change.clone(),
                on_highlight_change: props.on_unit_highlight_change.clone(),
            }
        }
    }
}

impl StyledComponent for TokenInputComponent {
    fn styles() -> &'static str {
        // The canonical Vue sheet, compiled verbatim (no_hash keeps the
        // `.hk-token-*` names literal so this CSS matches the Vue build).
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkTokenInput.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "token-input"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn token_input_unit_tokens_and_scales_match_vue() {
        assert_eq!(TokenUnitChoice::Auto.token(), "auto");
        assert_eq!(TokenUnitChoice::Kilo.token(), "K");
        assert_eq!(TokenUnitChoice::Mega.token(), "M");
        assert_eq!(TokenUnitChoice::Giga.token(), "B");
        // Vue's `UNIT_SCALE`; `auto` compacts instead of dividing.
        assert_eq!(TokenUnitChoice::Auto.scale(), None);
        assert_eq!(TokenUnitChoice::Kilo.scale(), Some(1e3));
        assert_eq!(TokenUnitChoice::Mega.scale(), Some(1e6));
        assert_eq!(TokenUnitChoice::Giga.scale(), Some(1e9));
        // Round trip through the picker's value tokens.
        for unit in [
            TokenUnitChoice::Auto,
            TokenUnitChoice::Kilo,
            TokenUnitChoice::Mega,
            TokenUnitChoice::Giga,
        ] {
            assert_eq!(TokenUnitChoice::from_token(unit.token()), Some(unit));
        }
        assert_eq!(TokenUnitChoice::from_token("k"), None);
        assert_eq!(TokenUnitChoice::from_token(""), None);
    }

    #[test]
    fn token_input_defaults_match_the_vue_props() {
        let props = TokenInputProps::default();
        // Vue: `modelValue: null` — unset.
        assert_eq!(props.model_value, None);
        assert_eq!(props.unit, TokenUnitChoice::Auto);
        assert!(!props.disabled);
        assert_eq!(props.editor_title, None);
        assert_eq!(props.aria_label, None);
        // No formatter → the built-in compaction renders.
        assert!(props.format.is_none());
        assert!(!props.editor_open);
        assert!(!props.unit_open);
        assert_eq!(props.unit_highlighted_index, -1);
        assert!(props.onupdate_model_value.is_none());
        assert!(props.onupdate_unit.is_none());
        assert!(props.onupdate_editor_open.is_none());
        assert!(props.on_unit_open_change.is_none());
        assert!(props.on_unit_highlight_change.is_none());
    }

    #[test]
    fn token_input_trim_matches_the_javascript_number_spelling() {
        // `Math.round(n * 100) / 100`, printed without trailing zeros.
        assert_eq!(trim_token_number(1.5), "1.5");
        assert_eq!(trim_token_number(128.0), "128");
        assert_eq!(trim_token_number(1.005), "1");
        assert_eq!(trim_token_number(1.234), "1.23");
        assert_eq!(trim_token_number(0.0015), "0");
        assert_eq!(trim_token_number(-5.0), "-5");
        assert_eq!(trim_token_number(f64::NAN), "");
    }

    #[test]
    fn token_input_compaction_matches_the_vue_formatter() {
        assert_eq!(compact_token_count(None), "");
        assert_eq!(compact_token_count(Some(f64::INFINITY)), "");
        assert_eq!(compact_token_count(Some(f64::NAN)), "");
        assert_eq!(compact_token_count(Some(0.0)), "0");
        assert_eq!(compact_token_count(Some(750.0)), "750");
        assert_eq!(compact_token_count(Some(999.0)), "999");
        assert_eq!(compact_token_count(Some(1_000.0)), "1K");
        assert_eq!(compact_token_count(Some(1_500.0)), "1.5K");
        assert_eq!(compact_token_count(Some(128_000.0)), "128K");
        assert_eq!(compact_token_count(Some(1_500_000.0)), "1.5M");
        assert_eq!(compact_token_count(Some(2_500_000_000.0)), "2.5B");
    }

    #[test]
    fn token_input_display_matches_the_vue_display() {
        // `null` renders the em dash before any unit logic.
        assert_eq!(token_input_display(None, TokenUnitChoice::Auto), "—");
        assert_eq!(token_input_display(None, TokenUnitChoice::Kilo), "—");
        // `auto` compacts.
        assert_eq!(
            token_input_display(Some(1_500_000.0), TokenUnitChoice::Auto),
            "1.5M"
        );
        // An explicit unit divides and appends its letter.
        assert_eq!(
            token_input_display(Some(1_500_000.0), TokenUnitChoice::Kilo),
            "1500K"
        );
        assert_eq!(
            token_input_display(Some(1_500_000.0), TokenUnitChoice::Mega),
            "1.5M"
        );
        assert_eq!(
            token_input_display(Some(2_500_000_000.0), TokenUnitChoice::Giga),
            "2.5B"
        );
        assert_eq!(
            token_input_display(Some(1_500.0), TokenUnitChoice::Kilo),
            "1.5K"
        );
    }

    #[test]
    fn token_input_editor_unit_seeding_matches_vue() {
        // An explicit display unit is the editor's unit.
        for unit in [
            TokenUnitChoice::Kilo,
            TokenUnitChoice::Mega,
            TokenUnitChoice::Giga,
        ] {
            assert_eq!(seed_editor_unit(Some(1.0), unit), unit);
            assert_eq!(seed_editor_unit(None, unit), unit);
        }
        // `auto` seeds from the value's natural magnitude; unset → K.
        assert_eq!(
            seed_editor_unit(None, TokenUnitChoice::Auto),
            TokenUnitChoice::Kilo
        );
        assert_eq!(
            seed_editor_unit(Some(999.0), TokenUnitChoice::Auto),
            TokenUnitChoice::Kilo
        );
        assert_eq!(
            seed_editor_unit(Some(1_500_000.0), TokenUnitChoice::Auto),
            TokenUnitChoice::Mega
        );
        assert_eq!(
            seed_editor_unit(Some(2_500_000_000.0), TokenUnitChoice::Auto),
            TokenUnitChoice::Giga
        );
    }

    #[test]
    fn token_input_editor_rescale_matches_vue() {
        assert_eq!(rescale_editor_text(None, TokenUnitChoice::Kilo), "");
        assert_eq!(rescale_editor_text(Some(0.0), TokenUnitChoice::Kilo), "");
        assert_eq!(rescale_editor_text(Some(-1.0), TokenUnitChoice::Kilo), "");
        assert_eq!(
            rescale_editor_text(Some(f64::INFINITY), TokenUnitChoice::Kilo),
            ""
        );
        assert_eq!(
            rescale_editor_text(Some(1_500.0), TokenUnitChoice::Kilo),
            "1.5"
        );
        assert_eq!(
            rescale_editor_text(Some(1_500_000.0), TokenUnitChoice::Mega),
            "1.5"
        );
    }

    #[test]
    fn token_input_editor_commit_matches_the_vue_live_commit_rule() {
        // A deliberately emptied field unsets.
        assert_eq!(
            parse_editor_commit("", TokenUnitChoice::Kilo),
            TokenEditorCommit::Clear
        );
        assert_eq!(
            parse_editor_commit("   ", TokenUnitChoice::Kilo),
            TokenEditorCommit::Clear
        );
        // Transiently unparseable intermediates commit NOTHING (no null
        // flicker while typing).
        for transient in ["1e", "-", "+", "abc", "0", "-2", "0.0"] {
            assert_eq!(
                parse_editor_commit(transient, TokenUnitChoice::Kilo),
                TokenEditorCommit::Nothing,
                "{transient:?} must commit nothing"
            );
        }
        // Separators are dropped, and the unit scales the absolute.
        assert_eq!(
            parse_editor_commit(" 128 ", TokenUnitChoice::Kilo),
            TokenEditorCommit::Commit(128_000.0)
        );
        assert_eq!(
            parse_editor_commit("1,500", TokenUnitChoice::Kilo),
            TokenEditorCommit::Commit(1_500_000.0)
        );
        assert_eq!(
            parse_editor_commit("1_5", TokenUnitChoice::Kilo),
            TokenEditorCommit::Commit(15_000.0)
        );
        assert_eq!(
            parse_editor_commit("1.5", TokenUnitChoice::Mega),
            TokenEditorCommit::Commit(1_500_000.0)
        );
    }

    #[test]
    fn token_input_unit_flip_reexpresses_the_same_absolute() {
        // 1.5M ⇄ 1500K: the budget is constant, only the expression changes.
        assert_eq!(
            switch_unit_expression("1.5", TokenUnitChoice::Mega, TokenUnitChoice::Kilo),
            TokenUnitFlip::Reexpress {
                text: "1500".to_string(),
                unit: TokenUnitChoice::Kilo,
            }
        );
        // The same unit is a no-op.
        assert_eq!(
            switch_unit_expression("1.5", TokenUnitChoice::Mega, TokenUnitChoice::Mega),
            TokenUnitFlip::Unchanged
        );
        // An empty field just flips (nothing to re-express, nothing to clear).
        assert_eq!(
            switch_unit_expression("", TokenUnitChoice::Kilo, TokenUnitChoice::Mega),
            TokenUnitFlip::Reexpress {
                text: String::new(),
                unit: TokenUnitChoice::Mega,
            }
        );
        // Unparseable surviving text cannot be re-expressed → clear.
        assert_eq!(
            switch_unit_expression("1e", TokenUnitChoice::Kilo, TokenUnitChoice::Mega),
            TokenUnitFlip::Clear {
                unit: TokenUnitChoice::Mega,
            }
        );
    }

    #[test]
    fn token_input_unit_options_match_the_vue_list() {
        let options = token_unit_options();
        let tokens: Vec<&str> = options.iter().map(|option| option.value.as_str()).collect();
        assert_eq!(tokens, vec!["auto", "K", "M", "B"]);
        // Vue labels are the tokens themselves, and no row is disabled.
        for option in &options {
            assert_eq!(option.label, option.value);
            assert!(!option.disabled);
        }
    }

    #[test]
    fn token_input_titles_and_classes_match_vue() {
        assert_eq!(token_input_editor_title(None), "Edit value");
        assert_eq!(token_input_editor_title(Some("Budget")), "Budget");
        assert_eq!(token_input_classes(false), "hk-token-input");
        assert_eq!(token_input_classes(true), "hk-token-input is-disabled");
    }

    #[test]
    fn token_input_renders_the_vue_dom_contract() {
        let html = TokenInput(TokenInputProps {
            aria_label: Some("Token budget".to_string()),
            ..Default::default()
        })
        .render_to_html();
        // The group shell, the value trigger and the nested unit picker.
        assert!(html.contains(r#"class="hk-token-input""#), "{html}");
        assert!(html.contains(r#"role="group""#), "{html}");
        assert!(html.contains(r#"aria-label="Token budget""#), "{html}");
        assert!(html.contains(r#"class="hk-token-input-value""#), "{html}");
        assert!(html.contains(r#"type="button""#), "{html}");
        assert!(html.contains(r#"aria-haspopup="dialog""#), "{html}");
        assert!(html.contains(r#"title="Edit value""#), "{html}");
        // An unset value shows Vue's em dash, also inside the trigger's name.
        assert!(html.contains(r#"aria-label="Edit value: —""#), "{html}");
        assert!(html.contains("—"), "{html}");
        // The unit picker is the mirrored Select with the token class.
        assert!(
            html.contains("hk-select-wrapper hk-token-input-unit"),
            "{html}"
        );
        // No falsy boolean attribute on the enabled trigger.
        assert!(!html.contains(r#"disabled="false""#), "{html}");

        // A disabled, explicit-unit field: the wrapper marker, the presence-only
        // attribute and the divided display with its unit letter.
        let html = TokenInput(TokenInputProps {
            model_value: Some(1_500_000.0),
            unit: TokenUnitChoice::Kilo,
            disabled: true,
            editor_title: Some("Budget".to_string()),
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains("hk-token-input is-disabled"), "{html}");
        assert!(html.contains(r#"disabled="true""#), "{html}");
        assert!(html.contains("1500K"), "{html}");
        assert!(html.contains(r#"aria-label="Budget: 1500K""#), "{html}");
    }

    #[test]
    fn token_input_styles_come_from_the_canonical_vue_sheet() {
        let css = TokenInputComponent::styles();
        for class in [
            ".hk-token-input",
            ".hk-token-input.is-disabled",
            ".hk-token-input-value",
            ".hk-token-input-unit",
            ".hk-token-input-editor-body",
            ".hk-token-editor",
            ".hk-token-input-clear",
        ] {
            assert!(
                css.contains(class),
                "token-input css must carry the vue class {class:?}"
            );
        }
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored token input sheet"
        );
    }
}
