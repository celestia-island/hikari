// hi-components/src/navigation/localized_input.rs
// LocalizedInput — mirror of the canonical Vue `HkLocalizedInput`:
// single-field multilingual text editor. One input edits ONE language at a
// time: the text is centered (the base `HkInput` element style), a leading
// `Languages` glyph balances the field's left cushion against the wrapped
// language chip on the RIGHT edge, and the chip (a primary badge + caret)
// opens the shared `HkAffixPicker` (multi-select, right anchored, closes on
// pick so the field is immediately editable again).
//
// The picker's tag list carries EVERY language that holds a translation —
// the one being edited included, even while still empty; a tag's primary
// text is that language's CURRENT TRANSLATION (value-driven `tagValues`),
// not its autonym, with the italic "Not set" placeholder for the unfilled
// editing language and the locale code as the muted meta suffix. The
// searchable add-rows cover the languages NOT yet present; picking one adds
// the language and drops the field straight into edit state for it.
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkLocalizedInput.scss`, vendored under
// `src/styles/vue-mirror/` and listed in the mirror manifest), compiled with
// `no_hash` so the `.hk-localized-input*` class names are literal and
// identical in both forms. The field shell rides the mirrored `HkInput`
// sheet, the picker/chip/popup the mirrored `HkAffixPicker` sheet and the
// badge the mirrored `HkBadge` sheet — none re-emitted here. DOM contract
// (mirrors the Vue render output):
//
//   div.hk-localized-input [data-multiline]
//     Input {type text|textarea, rows, autoGrow, size, label, placeholder,
//             disabled, modelValue}
//       #prefixIcon → span[style=display:contents]
//           > <svg .lucide-languages.hk-localized-input-lead 15>
//       #suffix    → AffixPicker (mode multi, side suffix, closeOnSelect)
//           chip → button.hk-affix-chip.hk-localized-input-chip
//             span.hk-badge.hk-badge-primary.hk-localized-input-chip-badge
//                 data-size=sm {chipLabel}
//             span[style=display:contents]
//                 > <svg .lucide-chevron-down.hk-localized-input-chip-caret 12>
//
// Contract (Vue's own words, kept honest by the pure functions below):
//   * `modelValue` is ALWAYS the text of the language being edited;
//   * every keystroke also emits `update:translations` with that language's
//     value merged in (empty values prune the key) — values are stored
//     TRIMMED so the stored map and the field can never diverge on
//     whitespace-only padding;
//   * switching languages commits the current text, swaps `modelValue` to
//     the target's stored text ("" when none) and emits `languagechange`;
//   * erasing a language via its tag × emits `update:translations` without
//     that key; erasing the EDITED language additionally swaps `modelValue`
//     and emits `languagechange` for the fallback (sourceLang when it still
//     holds a translation, else the first remaining one, else sourceLang).
//
// Vue prop mapping: `modelValue` → [`LocalizedInputProps::model_value`],
// `sourceLang` → `source_lang` (default `"en"`), `translations` → the
// INSERTION-ORDERED entry list (a JavaScript object literal's key order is
// insertion order; a `HashMap` would scramble the tag list and the erase
// fallback, so the mirror takes `Vec<(String, String)>` and exposes the
// lookups as pure functions), `localeOptions` → [`LanguageOption`] (the
// crate already owns a `layout::locale_picker::LocaleOption` without the
// flag, so this component's richer shape gets its own name),
// `multiline`/`autoGrow`/`rows`/`label`/`placeholder`/`disabled`/`size` →
// the like-named fields (size rides `basic::InputSize`), the local `editLang`
// ref → the CONTROLLED `edit_lang` prop (ledger L48), the picker's local
// `open`/`query` refs → the pass-through `picker_open`/`picker_query`.
// Emits: `update:modelValue` → `oninput`, `update:translations` →
// `on_translations_change`, `languagechange` → `on_language_change`.
//
// i18n: the three picker strings read `components.hk.localizedInput.*`
// through `hikari_i18n::t` — the crate bundle's namespace (Vue resolves its
// own `hikari::localizedInput.*`; the same literals, a different bundle —
// the `overlay/protocol_modal.rs` remap). `chooseLanguage` / `addLanguage`
// / `noMatches` are NEW keys in this wave; until the catalogs carry them
// the English fallbacks below are what renders.
//
// Behaviour deltas vs Vue (documented, not accidental):
//   * NO TWO-TAP × ARM: Vue's tag × opens the shared `HkMessageBox` confirm
//     (first tap arms, second erases — the picker's `confirmRemove`
//     default). No dialog service exists in this wave, so the picker is
//     opted OUT (`confirm_remove: false`) and the × erases through the same
//     `eraseLanguage` port immediately; a host that wants the arm interposes
//     its own guard on `picker_open` + the pure
//     [`localized_input_erase`] edge.
//   * NO FOCUS MOVE: Vue suppresses the chip's mousedown and refocuses the
//     field after a pick (`nextTick` + `querySelector` on element handles);
//     handles are never populated in this host stack, so the host owns
//     focus.
//   * NO sourceLang WATCHER: Vue commits the current text and follows the
//     app locale when `sourceLang` changes (minus the focus grab). The host
//     drives that edge with the same [`localized_input_switch`] pure
//     function a tag pick uses.
//   * NO `placeholderVariant`: the mirrored `HkInput` renders the NATIVE
//     placeholder only (its marquee overlay has no mirror); Vue's
//     `truncate`/`marquee` distinction disappears with it.
//   * `oninput` forwards `InputEvent.data` (the crate-wide field
//     convention, `basic/input.rs`) instead of Vue's `target.value` re-read.
//   * NO list transitions (HkListTransition squeeze in/out) and no
//     popup-manager stacking context — the picker mirror's own documented
//     deltas, inherited by composition.
//   * the glyphs are lucide `languages` (15) and `chevron-down` (12) nodes,
//     serialized exactly as `lucide-vue-next` renders them (the
//     `layout/affix_picker.rs` serializer output: `lucide` + the host class
//     + the `lucide-{name}-icon` / `lucide-{name}` pair, the 24-unit
//     viewBox, the stroke attribute set, `aria-hidden="true"`), mounted
//     through `dangerous_inner_html` on a `display:contents` host —
//     `rsx!`'s `svg {}` lands in the HTML namespace in this host stack
//     (ledger L49).
//   * interactions bind the MOUSE family (`onclick`), per ledger L67: on
//     wasm32-wasip2 the browser glue dispatches only the mouse family as
//     typed events.

// These kernels are line-for-line ports of the upstream JS math: the negated
// comparisons, manual clamps and inline tuple types keep the port auditable
// against the source, so the idiomatic-rewrite lints are off here.
#![allow(clippy::neg_cmp_op_on_partial_ord)]
#![allow(clippy::collapsible_if)]
#![allow(clippy::type_complexity)]
#![allow(clippy::too_many_arguments)]
use std::collections::HashMap;

use hikari_i18n::t;

use crate::basic::badge::{Badge, BadgeProps, BadgeSize, BadgeVariant};
use crate::basic::input::{Input, InputProps, InputSize};
use crate::feedback::popover::PopoverAnchorRect;
use crate::layout::affix_picker::{
    AffixMode, AffixOption, AffixPicker, AffixPickerProps, AffixSide,
};
use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct LocalizedInputComponent;

/// One selectable language in the editor's language menu (Vue:
/// `HkLocaleOption`). `label` is the SAME text the app's global language
/// switcher shows (the autonym — "简体中文" / "English"); `flag` is the
/// optional glyph the switcher rows carry.
#[derive(Clone, PartialEq, Debug, Default)]
pub struct LanguageOption {
    pub code: String,
    pub label: String,
    pub flag: Option<String>,
}

// ── the pure state machine ───────────────────────────────────────────────

/// A translation map lookup (a `Vec` stands in for the JS object, so this
/// is a scan — the maps are locale-sized).
pub fn localized_input_translation_value<'a>(
    translations: &'a [(String, String)],
    code: &str,
) -> Option<&'a str> {
    translations
        .iter()
        .find(|(key, _)| key == code)
        .map(|(_, value)| value.as_str())
}

/// Vue's `commitTranslations`: upsert `code` with the TRIMMED value in place
/// (an existing key keeps its position, exactly a JS object spread) or prune
/// the key when the value trims to nothing.
pub fn localized_input_commit(
    translations: &[(String, String)],
    code: &str,
    value: &str,
) -> Vec<(String, String)> {
    let mut next = translations.to_vec();
    let trimmed = value.trim();
    if trimmed.is_empty() {
        next.retain(|(key, _)| key != code);
    } else if let Some(slot) = next.iter_mut().find(|(key, _)| key == code) {
        slot.1 = trimmed.to_string();
    } else {
        next.push((code.to_string(), trimmed.to_string()));
    }
    next
}

/// Vue's `filledCodes`: non-empty translation codes, insertion-ordered.
pub fn localized_input_filled_codes(translations: &[(String, String)]) -> Vec<String> {
    translations
        .iter()
        .filter(|(_, value)| !value.trim().is_empty())
        .map(|(key, _)| key.clone())
        .collect()
}

/// Vue's `selectedCodes`: every FILLED code plus the edited one appended
/// when it holds no text yet (the tag list's order).
pub fn localized_input_selected_codes(
    translations: &[(String, String)],
    edit_lang: &str,
) -> Vec<String> {
    let mut codes = localized_input_filled_codes(translations);
    if !codes.iter().any(|code| code == edit_lang) {
        codes.push(edit_lang.to_string());
    }
    codes
}

/// Vue's `addableCount` predicate — how many catalog entries are neither
/// edited nor filled (drives [`localized_input_chip_disabled`]).
pub fn localized_input_addable_count(
    translations: &[(String, String)],
    locale_options: &[LanguageOption],
    edit_lang: &str,
) -> usize {
    let filled = localized_input_filled_codes(translations);
    locale_options
        .iter()
        .filter(|option| option.code != edit_lang && !filled.contains(&option.code))
        .count()
}

/// Vue's `chipDisabled`: the chip is useful while ANY interaction remains —
/// at least one row to switch to / erase, or one language left to add.
pub fn localized_input_chip_disabled(
    disabled: bool,
    translations: &[(String, String)],
    locale_options: &[LanguageOption],
    edit_lang: &str,
) -> bool {
    let filled = localized_input_filled_codes(translations);
    let selected = localized_input_selected_codes(translations, edit_lang);
    disabled
        || (filled.is_empty()
            && localized_input_addable_count(translations, locale_options, edit_lang) == 0
            && selected.len() <= 1)
}

/// Vue's `localeLabel`: the catalog entry's label, or the bare code when the
/// catalog does not carry it.
pub fn localized_input_chip_label(locale_options: &[LanguageOption], edit_lang: &str) -> String {
    locale_options
        .iter()
        .find(|option| option.code == edit_lang)
        .map(|option| option.label.clone())
        .unwrap_or_else(|| edit_lang.to_string())
}

/// The picker's catalog (Vue's `affixOptions`): autonym label, locale code
/// as the muted meta suffix, flag when the app provides one.
pub fn localized_input_affix_options(locale_options: &[LanguageOption]) -> Vec<AffixOption> {
    locale_options
        .iter()
        .map(|option| AffixOption {
            key: option.code.clone(),
            label: option.label.clone(),
            meta: Some(option.code.clone()),
            flag: option.flag.clone(),
            ..Default::default()
        })
        .collect()
}

/// Vue's `switchLanguage`, as one pure transition: commit the edited
/// language's current text (trimmed), move the field to the target, and
/// swap `modelValue` to the target's STORED text (from the pre-commit map,
/// `""` when none). `None` is Vue's no-op — an empty target, or the
/// language already being edited (Vue only dismisses the picker and hands
/// focus back there, and focus is the host's here).
#[derive(Clone, PartialEq, Debug)]
pub struct LocalizedSwitch {
    pub translations: Vec<(String, String)>,
    pub edit_lang: String,
    pub model_value: String,
}
pub fn localized_input_switch(
    translations: &[(String, String)],
    edit_lang: &str,
    model_value: &str,
    target: &str,
) -> Option<LocalizedSwitch> {
    if target.is_empty() || target == edit_lang {
        return None;
    }
    let next_translations = localized_input_commit(translations, edit_lang, model_value);
    let next_value = localized_input_translation_value(translations, target)
        .unwrap_or("")
        .trim()
        .to_string();
    Some(LocalizedSwitch {
        translations: next_translations,
        edit_lang: target.to_string(),
        model_value: next_value,
    })
}

/// Vue's `eraseLanguage`. `None` is the ghost-tag guard — erasing an absent
/// key must not re-emit or disturb the edit state. [`LocalizedErase::Other`]
/// only drops the key (the edit state never moves);
/// [`LocalizedErase::Edited`] additionally moves the field to the fallback
/// language — `source_lang` when it still holds a translation, else the
/// first remaining one, else `source_lang` itself — and swaps `modelValue`
/// to that language's text.
#[derive(Clone, PartialEq, Debug)]
pub enum LocalizedErase {
    Other {
        translations: Vec<(String, String)>,
    },
    Edited {
        translations: Vec<(String, String)>,
        edit_lang: String,
        model_value: String,
    },
}

pub fn localized_input_erase(
    translations: &[(String, String)],
    code: &str,
    edit_lang: &str,
    source_lang: &str,
) -> Option<LocalizedErase> {
    // Vue: `if (!(code in props.translations)) return;` — key PRESENCE, not
    // value emptiness.
    localized_input_translation_value(translations, code)?;
    let next: Vec<(String, String)> = translations
        .iter()
        .filter(|(key, _)| key != code)
        .cloned()
        .collect();
    if code != edit_lang {
        return Some(LocalizedErase::Other { translations: next });
    }
    let remaining = localized_input_filled_codes(&next);
    let target = if localized_input_translation_value(&next, source_lang)
        .map(|value| !value.trim().is_empty())
        .unwrap_or(false)
    {
        source_lang.to_string()
    } else {
        remaining
            .first()
            .cloned()
            .unwrap_or_else(|| source_lang.to_string())
    };
    let next_value = localized_input_translation_value(&next, &target)
        .unwrap_or("")
        .trim()
        .to_string();
    Some(LocalizedErase::Edited {
        translations: next,
        edit_lang: target,
        model_value: next_value,
    })
}

// ── glyphs (lucide, serialized exactly as lucide-vue-next renders them) ──

/// One lucide glyph, serialized exactly as `lucide-vue-next` renders it (the
/// `layout/affix_picker.rs` serializer, replicated here because that one is
/// module-private): `lucide` + the host's class + the
/// `lucide-{name}-icon` / `lucide-{name}` pair, the 24-unit viewBox, the
/// stroke attribute set and the automatic `aria-hidden="true"`.
fn lucide_icon_svg(name: &str, size: u32, body: &str, class: Option<&str>) -> String {
    let classes = match class {
        Some(class) => format!("lucide {class} lucide-{name}-icon lucide-{name}"),
        None => format!("lucide lucide-{name}-icon lucide-{name}"),
    };
    format!(
        "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"{size}\" height=\"{size}\" \
         viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" \
         stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"{classes}\" \
         aria-hidden=\"true\">{body}</svg>"
    )
}

/// lucide `languages`'s six paths (`<Languages size={15}
/// class="hk-localized-input-lead" aria-hidden="true" />`).
const LUCIDE_LANGUAGES_BODY: &str = concat!(
    r#"<path d="m5 8 6 6"></path>"#,
    r#"<path d="m4 14 6-6 2-3"></path>"#,
    r#"<path d="M2 5h12"></path>"#,
    r#"<path d="M7 2h1"></path>"#,
    r#"<path d="m22 22-5-10-5 10"></path>"#,
    r#"<path d="M14 18h6"></path>"#,
);

/// lucide `chevron-down`'s path (`<ChevronDown size={12}
/// class="hk-localized-input-chip-caret" />`).
const LUCIDE_CHEVRON_DOWN_BODY: &str = r#"<path d="m6 9 6 6 6-6"></path>"#;

/// The full markup of the two glyphs this component renders.
pub fn localized_input_lead_svg() -> String {
    lucide_icon_svg(
        "languages",
        15,
        LUCIDE_LANGUAGES_BODY,
        Some("hk-localized-input-lead"),
    )
}

pub fn localized_input_caret_svg() -> String {
    lucide_icon_svg(
        "chevron-down",
        12,
        LUCIDE_CHEVRON_DOWN_BODY,
        Some("hk-localized-input-chip-caret"),
    )
}

// ── the component ────────────────────────────────────────────────────────

#[define_props]
pub struct LocalizedInputProps {
    /// The text of the language being edited (Vue: `modelValue`, "").
    pub model_value: String,

    /// The app's source language — the field's first edit target and the
    /// erase fallback (Vue: `sourceLang`, default "en").
    #[default("en".to_string())]
    pub source_lang: String,

    /// Per-language values, INSERTION-ORDERED (see the header prop
    /// mapping). Keys follow the app's locale codes.
    #[default]
    pub translations: Vec<(String, String)>,

    /// The app's locale catalog — the same list its language switcher uses
    /// (Vue: `localeOptions`).
    #[default]
    pub locale_options: Vec<LanguageOption>,

    /// Render the editor as an auto-growing textarea (long-form
    /// translations) instead of a single-line input.
    pub multiline: bool,

    /// Grow the multiline field with its content (multiline only).
    pub auto_grow: bool,

    /// Visible row count of the multiline field (Vue default 3).
    #[default(3)]
    pub rows: u32,

    pub label: Option<String>,

    pub placeholder: String,

    pub disabled: bool,

    /// Field size step (`basic::InputSize`, Vue `"sm" | "md" | "lg"`).
    #[default]
    pub size: InputSize,

    // ── controlled state (Vue keeps editLang + the picker's refs local) ──
    /// The language being edited (Vue's local `editLang` ref, seeded from
    /// `sourceLang`; the host owns moves — every switch rides
    /// `on_language_change`).
    #[default("en".to_string())]
    pub edit_lang: String,

    /// The picker popup's visibility (pass-through).
    pub picker_open: bool,

    /// The picker popup's live filter text (pass-through).
    pub picker_query: String,

    /// The chip rect to anchor the popup against (pass-through;
    /// `feedback::popover::anchor_rect_from_element_id` measures one by id).
    /// `None` pins the popup to the field's positioned box.
    pub picker_anchor: Option<PopoverAnchorRect>,

    // ── events ───────────────────────────────────────────────────────────
    /// Fires with the edited language's new text (Vue:
    /// `update:modelValue`).
    pub oninput: Option<EventHandler<String>>,

    /// Fires with the next translation map (Vue: `update:translations`).
    pub on_translations_change: Option<EventHandler<Vec<(String, String)>>>,

    /// Fires after the edited language changed (switch or add — Vue:
    /// `languagechange`).
    pub on_language_change: Option<EventHandler<String>>,

    /// The picker's open writer (pass-through).
    pub on_picker_open_change: Option<EventHandler<bool>>,

    /// The picker's filter writer (pass-through).
    pub on_picker_query_change: Option<EventHandler<String>>,
}

#[component]
pub fn LocalizedInput(props: LocalizedInputProps) -> Element {
    // The leading glyph balances the field's left cushion.
    let lead = rsx! {
        span {
            style: "display:contents",
            dangerous_inner_html: localized_input_lead_svg(),
        }
    };

    // The chip: the mirrored Badge (composed, then given the class the
    // mirror's BadgeProps cannot carry — Vue spreads attrs onto HkBadge)
    // beside the caret.
    let chip_label = localized_input_chip_label(&props.locale_options, &props.edit_lang);
    let mut badge = Badge(BadgeProps {
        variant: BadgeVariant::Primary,
        size: BadgeSize::Sm,
        children: VNode::Text(VText::new(&chip_label)),
        ..Default::default()
    });
    if let VNode::Element(el) = &mut badge {
        el.class = el.class.clone().add("hk-localized-input-chip-badge");
    }
    let chip: Element = rsx! {
        {badge}
        span {
            style: "display:contents",
            dangerous_inner_html: localized_input_caret_svg(),
        }
    };

    // The picker's static surface.
    let affix_options = localized_input_affix_options(&props.locale_options);
    let selected = localized_input_selected_codes(&props.translations, &props.edit_lang);
    let chip_disabled = localized_input_chip_disabled(
        props.disabled,
        &props.translations,
        &props.locale_options,
        &props.edit_lang,
    );
    let tag_values: HashMap<String, String> = props.translations.iter().cloned().collect();

    // A tag pick (or an add-row pick) is a language switch: commit the
    // current text, swap the field, announce the move.
    let switch_translations = props.translations.clone();
    let switch_edit_lang = props.edit_lang.clone();
    let switch_model_value = props.model_value.clone();
    let switch_value_writer = props.oninput.clone();
    let switch_map_writer = props.on_translations_change.clone();
    let switch_lang_writer = props.on_language_change.clone();
    let on_pick = move |code: String| {
        if let Some(switch) = localized_input_switch(
            &switch_translations,
            &switch_edit_lang,
            &switch_model_value,
            &code,
        ) {
            if let Some(handler) = switch_map_writer.as_ref() {
                handler.call(switch.translations);
            }
            if let Some(handler) = switch_value_writer.as_ref() {
                handler.call(switch.model_value);
            }
            if let Some(handler) = switch_lang_writer.as_ref() {
                handler.call(switch.edit_lang);
            }
        }
    };

    // A tag × erases that language's translation (the two-tap arm is the
    // documented delta — the × erases through immediately here).
    let erase_translations = props.translations.clone();
    let erase_edit_lang = props.edit_lang.clone();
    let erase_source_lang = props.source_lang.clone();
    let erase_value_writer = props.oninput.clone();
    let erase_map_writer = props.on_translations_change.clone();
    let erase_lang_writer = props.on_language_change.clone();
    let on_erase = move |code: String| {
        match localized_input_erase(
            &erase_translations,
            &code,
            &erase_edit_lang,
            &erase_source_lang,
        ) {
            Some(LocalizedErase::Other { translations }) => {
                if let Some(handler) = erase_map_writer.as_ref() {
                    handler.call(translations);
                }
            }
            Some(LocalizedErase::Edited {
                translations,
                edit_lang,
                model_value,
            }) => {
                if let Some(handler) = erase_map_writer.as_ref() {
                    handler.call(translations);
                }
                if let Some(handler) = erase_value_writer.as_ref() {
                    handler.call(model_value);
                }
                if let Some(handler) = erase_lang_writer.as_ref() {
                    handler.call(edit_lang);
                }
            }
            // A ghost tag (already absent): no re-emit, no edit-state move.
            None => {}
        }
    };

    let picker = AffixPicker(AffixPickerProps {
        options: affix_options,
        mode: AffixMode::Multi,
        side: AffixSide::Suffix,
        selected,
        active_key: Some(props.edit_lang.clone()),
        disabled: chip_disabled,
        // Vue passes closeOnSelect={true} — pick closes the popup so the
        // field is immediately editable again.
        close_on_select: Some(true),
        chip_class: Some("hk-localized-input-chip".to_string()),
        chip_label: Some(t(
            "components.hk.localizedInput.chooseLanguage",
            "Choose editing language",
        )),
        title: Some(t(
            "components.hk.localizedInput.chooseLanguage",
            "Choose editing language",
        )),
        search_placeholder: Some(t(
            "components.hk.localizedInput.addLanguage",
            "Add language",
        )),
        empty_text: Some(t(
            "components.hk.localizedInput.noMatches",
            "No matching language",
        )),
        tag_values: Some(tag_values),
        chip: Some(chip),
        open: props.picker_open,
        query: props.picker_query.clone(),
        anchor: props.picker_anchor,
        on_open_change: props.on_picker_open_change.clone(),
        on_query_change: props.on_picker_query_change.clone(),
        on_select: Some(EventHandler::new(on_pick)),
        // confirm_remove: false — the host-side arm delta, see the header.
        confirm_remove: false,
        on_remove: Some(EventHandler::new(on_erase)),
        ..Default::default()
    });

    // The field's input edge: the new text AND the trimmed merge fire
    // together (a parent can persist drafts without listening to blur).
    let input_edit_lang = props.edit_lang.clone();
    let input_translations = props.translations.clone();
    let input_value_writer = props.oninput.clone();
    let input_map_writer = props.on_translations_change.clone();
    let on_field_input = move |value: String| {
        if let Some(handler) = input_value_writer.as_ref() {
            handler.call(value.clone());
        }
        if let Some(handler) = input_map_writer.as_ref() {
            handler.call(localized_input_commit(
                &input_translations,
                &input_edit_lang,
                &value,
            ));
        }
    };

    rsx! {
        div {
            class: "hk-localized-input",
            // Vue: `data-multiline={props.multiline || undefined}` —
            // presence only (the sheet's selector is attribute-shaped).
            "data-multiline": props.multiline.then_some("true"),
            Input {
                model_value: props.model_value.clone(),
                oninput: Some(EventHandler::new(on_field_input)),
                placeholder: Some(props.placeholder.clone()),
                disabled: props.disabled,
                size: props.size,
                label: props.label.clone(),
                input_type: Some(if props.multiline { "textarea" } else { "text" }.to_string()),
                rows: props.rows,
                auto_grow: props.auto_grow,
                prefix_icon: Some(lead),
                suffix: Some(picker),
            }
        }
    }
}

impl StyledComponent for LocalizedInputComponent {
    fn styles() -> &'static str {
        // The canonical Vue sheet, compiled verbatim (no_hash keeps the
        // `.hk-localized-input*` names literal so this CSS matches the Vue
        // build). The field shell, the picker and the badge carry their own
        // mirrored sheets.
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkLocalizedInput.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "localized-input"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn translations(entries: &[(&str, &str)]) -> Vec<(String, String)> {
        entries
            .iter()
            .map(|(code, value)| (code.to_string(), value.to_string()))
            .collect()
    }

    fn options(entries: &[(&str, &str)]) -> Vec<LanguageOption> {
        entries
            .iter()
            .map(|(code, label)| LanguageOption {
                code: code.to_string(),
                label: label.to_string(),
                flag: None,
            })
            .collect()
    }

    #[test]
    fn localized_input_commit_upserts_trimmed_and_prunes() {
        let map = translations(&[("en", "Hello"), ("ja", "こんにちは")]);
        // A new key appends; an existing key keeps its position.
        let added = localized_input_commit(&map, "zh-Hans", "  你好  ");
        assert_eq!(added[0], ("en".to_string(), "Hello".to_string()));
        assert_eq!(added[2], ("zh-Hans".to_string(), "你好".to_string()));
        let replaced = localized_input_commit(&map, "en", " Hi ");
        assert_eq!(replaced[0], ("en".to_string(), "Hi".to_string()));
        assert_eq!(replaced.len(), 2);
        // A whitespace-only value prunes the key.
        let pruned = localized_input_commit(&map, "ja", "   ");
        assert_eq!(pruned, translations(&[("en", "Hello")]));
        // Pruning an absent key changes nothing.
        assert_eq!(localized_input_commit(&map, "ko", "   "), map);
    }

    #[test]
    fn localized_input_codes_follow_the_vue_computeds() {
        let map = translations(&[("en", "Hello"), ("ja", "  "), ("zh-Hans", "你好")]);
        // Only non-empty values fill; order is insertion order.
        assert_eq!(
            localized_input_filled_codes(&map),
            vec!["en".to_string(), "zh-Hans".to_string()]
        );
        // The edited language is appended when it holds no text yet…
        assert_eq!(
            localized_input_selected_codes(&map, "ja"),
            vec!["en".to_string(), "zh-Hans".to_string(), "ja".to_string()]
        );
        // …and keeps its filled position otherwise.
        assert_eq!(
            localized_input_selected_codes(&map, "en"),
            vec!["en".to_string(), "zh-Hans".to_string()]
        );
        // The value lookup scans the entries.
        assert_eq!(localized_input_translation_value(&map, "ja"), Some("  "));
        assert_eq!(localized_input_translation_value(&map, "ko"), None);
    }

    #[test]
    fn localized_input_chip_disabled_needs_something_to_do() {
        let catalog = options(&[("en", "English"), ("ja", "日本語")]);
        // Filled translations: the chip works.
        assert!(!localized_input_chip_disabled(
            false,
            &translations(&[("en", "Hello")]),
            &catalog,
            "en"
        ));
        // Addable languages alone also keep it alive…
        assert!(!localized_input_chip_disabled(
            false,
            &translations(&[]),
            &catalog,
            "en"
        ));
        // …but an empty map, an empty catalog and nothing to switch to
        // disable it (Vue's three-way no-op).
        assert!(localized_input_chip_disabled(
            false,
            &translations(&[]),
            &[],
            "en"
        ));
        // `disabled` always wins.
        assert!(localized_input_chip_disabled(
            true,
            &translations(&[("en", "Hello")]),
            &catalog,
            "en"
        ));
        // The chip label falls back to the bare code off-catalog.
        assert_eq!(localized_input_chip_label(&catalog, "en"), "English");
        assert_eq!(localized_input_chip_label(&catalog, "ko"), "ko");
    }

    #[test]
    fn localized_input_switch_commits_and_swaps_like_vue() {
        let map = translations(&[("en", "Hello"), ("ja", "こんにちは")]);
        // Switch: commit the current text under the OLD language, swap the
        // field to the target's stored text.
        let switched = localized_input_switch(&map, "en", "  Bonjour  ", "fr").unwrap();
        assert_eq!(
            switched.translations,
            translations(&[("en", "Bonjour"), ("ja", "こんにちは")])
        );
        assert_eq!(switched.edit_lang, "fr");
        // The target held nothing: the field empties.
        assert_eq!(switched.model_value, "");

        // The target's stored text loads (pre-commit map, trimmed).
        let to_ja = localized_input_switch(&map, "en", "Hello", "ja").unwrap();
        assert_eq!(to_ja.model_value, "こんにちは");
        // The commit replaced "en" in place — the map keeps its order.
        assert_eq!(
            to_ja.translations[0],
            ("en".to_string(), "Hello".to_string())
        );

        // Vue's no-ops: an empty target and the edited language itself.
        assert!(localized_input_switch(&map, "en", "Hello", "").is_none());
        assert!(localized_input_switch(&map, "en", "Hello", "en").is_none());
    }

    #[test]
    fn localized_input_erase_follows_the_vue_fallback() {
        let map = translations(&[("en", "Hello"), ("ja", "こんにちは"), ("ko", "안녕")]);
        // Erasing another language never disturbs the edit state.
        match localized_input_erase(&map, "ko", "en", "en") {
            Some(LocalizedErase::Other { translations }) => {
                assert_eq!(translations.len(), 2);
                assert!(!translations.iter().any(|(key, _)| key == "ko"));
            }
            other => panic!("expected Other, got {other:?}"),
        }
        // Erasing the edited language: sourceLang still filled → the field
        // moves there with its text.
        match localized_input_erase(&map, "ja", "ja", "en") {
            Some(LocalizedErase::Edited {
                translations,
                edit_lang,
                model_value,
            }) => {
                assert!(!translations.iter().any(|(key, _)| key == "ja"));
                assert_eq!(edit_lang, "en");
                assert_eq!(model_value, "Hello");
            }
            other => panic!("expected Edited, got {other:?}"),
        }
        // sourceLang empty → the FIRST remaining translation takes over.
        let no_en = translations(&[("ja", ""), ("ko", "안녕"), ("zh-Hans", "你好")]);
        match localized_input_erase(&no_en, "ja", "ja", "en") {
            Some(LocalizedErase::Edited { edit_lang, .. }) => assert_eq!(edit_lang, "ko"),
            other => panic!("expected Edited, got {other:?}"),
        }
        // Everything gone → the source language itself.
        let only = translations(&[("ja", "こんにちは")]);
        match localized_input_erase(&only, "ja", "ja", "en") {
            Some(LocalizedErase::Edited {
                edit_lang,
                model_value,
                translations,
            }) => {
                assert_eq!(edit_lang, "en");
                assert_eq!(model_value, "");
                assert!(translations.is_empty());
            }
            other => panic!("expected Edited, got {other:?}"),
        }
        // A ghost tag (absent key) is a full no-op.
        assert!(localized_input_erase(&map, "ko", "en", "en").is_some());
        assert!(localized_input_erase(&map, "fr", "en", "en").is_none());
    }

    #[test]
    fn localized_input_defaults_match_the_vue_props() {
        let props = LocalizedInputProps::default();
        assert_eq!(props.model_value, "");
        assert_eq!(props.source_lang, "en");
        assert!(props.translations.is_empty());
        assert!(props.locale_options.is_empty());
        assert!(!props.multiline);
        assert!(!props.auto_grow);
        assert_eq!(props.rows, 3);
        assert_eq!(props.label, None);
        assert_eq!(props.placeholder, "");
        assert!(!props.disabled);
        assert_eq!(props.size, InputSize::Medium);
        // Vue seeds the local editLang from sourceLang ("en").
        assert_eq!(props.edit_lang, "en");
        assert!(!props.picker_open);
        assert_eq!(props.picker_query, "");
        assert!(props.picker_anchor.is_none());
        assert!(props.oninput.is_none());
        assert!(props.on_translations_change.is_none());
        assert!(props.on_language_change.is_none());
        assert!(props.on_picker_open_change.is_none());
        assert!(props.on_picker_query_change.is_none());
    }

    #[test]
    fn localized_input_affix_options_carry_the_catalog() {
        let catalog = vec![LanguageOption {
            code: "zh-Hans".to_string(),
            label: "简体中文".to_string(),
            flag: Some("🇨🇳".to_string()),
        }];
        let affix = localized_input_affix_options(&catalog);
        assert_eq!(affix.len(), 1);
        assert_eq!(affix[0].key, "zh-Hans");
        assert_eq!(affix[0].label, "简体中文");
        // The locale code rides as the muted meta suffix.
        assert_eq!(affix[0].meta.as_deref(), Some("zh-Hans"));
        assert_eq!(affix[0].flag.as_deref(), Some("🇨🇳"));
    }

    #[test]
    fn localized_input_glyphs_match_the_lucide_serialization() {
        let lead = localized_input_lead_svg();
        assert!(
            lead.contains(
                r#"class="lucide hk-localized-input-lead lucide-languages-icon lucide-languages""#
            ),
            "{lead}"
        );
        assert!(lead.contains(r#"width="15" height="15""#), "{lead}");
        assert!(lead.contains(r#"<path d="m5 8 6 6"></path>"#), "{lead}");
        assert!(lead.contains(r#"aria-hidden="true""#), "{lead}");
        let caret = localized_input_caret_svg();
        assert!(
            caret.contains(r#"class="lucide hk-localized-input-chip-caret lucide-chevron-down-icon lucide-chevron-down""#),
            "{caret}"
        );
        assert!(caret.contains(r#"width="12" height="12""#), "{caret}");
        assert!(
            caret.contains(r#"<path d="m6 9 6 6 6-6"></path>"#),
            "{caret}"
        );
    }

    #[test]
    fn localized_input_renders_the_vue_contract() {
        let html = LocalizedInput(LocalizedInputProps {
            model_value: "Hello".to_string(),
            translations: translations(&[("en", "Hello")]),
            locale_options: options(&[("en", "English"), ("ja", "日本語")]),
            label: Some("Display name".to_string()),
            ..Default::default()
        })
        .render_to_html();

        for needle in [
            r#"class="hk-localized-input""#,
            // The base field shell (label + box + element).
            r#"class="hk-input-wrapper""#,
            r#"class="hk-input-label">Display name<"#,
            r#"class="hk-input-element""#,
            r#"value="Hello""#,
            // The leading Languages glyph (a display:contents host).
            "display:contents",
            "lucide-languages",
            "hk-localized-input-lead",
            // The suffix chip: the picker base + this component's class.
            "hk-input-affix hk-input-suffix",
            "hk-affix-chip",
            "hk-localized-input-chip",
            // The chip badge (label text, sm) + the caret.
            "hk-badge hk-badge-primary",
            "hk-localized-input-chip-badge",
            r#"data-size="sm""#,
            ">English<",
            "hk-localized-input-chip-caret",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        // Single-line default: no textarea, no multiline marker, and the
        // popup (closed) renders no rows.
        assert!(!html.contains("hk-input-textarea"), "{html}");
        assert!(!html.contains("data-multiline"), "{html}");
        assert!(!html.contains("hk-affix-row"), "{html}");
    }

    #[test]
    fn localized_input_multiline_renders_the_textarea_branch() {
        let html = LocalizedInput(LocalizedInputProps {
            multiline: true,
            rows: 5,
            auto_grow: true,
            locale_options: options(&[("en", "English"), ("ja", "日本語")]),
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains(r#"data-multiline="true""#), "{html}");
        // The base field's own textarea grammar (rows + autogrow markers).
        assert!(html.contains("hk-input-textarea"), "{html}");
        assert!(html.contains(r#"rows="5""#), "{html}");
        assert!(html.contains("hk-input-textarea-autogrow"), "{html}");
        // No input element in the textarea branch.
        assert!(!html.contains(r#"<input"#), "{html}");
    }

    #[test]
    fn localized_input_field_input_fires_both_writers() {
        let values = std::rc::Rc::new(std::cell::RefCell::new(Vec::<String>::new()));
        let maps = std::rc::Rc::new(std::cell::RefCell::new(Vec::new()));
        let value_sink = std::rc::Rc::clone(&values);
        let map_sink = std::rc::Rc::clone(&maps);

        let node = LocalizedInput(LocalizedInputProps {
            model_value: "Hell".to_string(),
            translations: translations(&[("en", "Hell")]),
            locale_options: options(&[("en", "English"), ("ja", "日本語")]),
            oninput: Some(EventHandler::new(move |value: String| {
                value_sink.borrow_mut().push(value);
            })),
            on_translations_change: Some(EventHandler::new(move |map| {
                map_sink.borrow_mut().push(map);
            })),
            ..Default::default()
        });

        // Serialization drops handlers, so walk the tree and INVOKE the
        // field's input listener (the `feedback/modal.rs` test pattern):
        // deleting the wiring leaves it a no-op.
        fn type_into_field(node: &Element) -> bool {
            match node {
                VNode::Element(el) => {
                    if el.tag == "input"
                        && el.class.to_string().contains("hk-input-element")
                        && let Some(handler) = el.event_handlers.get("input")
                    {
                        handler.borrow_mut()(Box::new(InputEvent::new().data("Hello"))
                            as Box<dyn tairitsu_vdom::EventData>);
                        return true;
                    }
                    el.children.iter().any(type_into_field)
                }
                VNode::Fragment(children) => children.iter().any(type_into_field),
                _ => false,
            }
        }
        assert!(type_into_field(&node), "no field element found");
        // update:modelValue fires with the raw text…
        assert_eq!(*values.borrow(), vec!["Hello".to_string()]);
        // …and update:translations fires with the trimmed merge.
        assert_eq!(*maps.borrow(), vec![translations(&[("en", "Hello")])]);
    }

    #[test]
    fn localized_input_styles_come_from_the_canonical_vue_sheet() {
        let css = LocalizedInputComponent::styles();
        for class in [
            ".hk-localized-input",
            ".hk-localized-input-lead",
            ".hk-localized-input-chip",
            ".hk-localized-input-chip-badge",
            ".hk-localized-input-chip-caret",
        ] {
            assert!(
                css.contains(class),
                "localized-input css must carry the vue class {class:?}"
            );
        }
        // The multiline branch pins the affixes and widens the textarea.
        assert!(css.contains(".hk-localized-input[data-multiline]"), "{css}");
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored localized-input sheet"
        );
        assert_eq!(LocalizedInputComponent::name(), "localized-input");
    }
}
