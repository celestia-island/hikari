// hi-components/src/basic/input.rs
// Input — mirror of the canonical Vue `HkInput`: the shared form-field shell
// (caption + box + affixes + message line) every text-ish control draws.
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkInput.scss`, vendored under
// `src/styles/vue-mirror/` and guarded by
// `tests/vue_mirror_drift_tests.rs`), compiled with `no_hash` so the
// `.hk-input*` class names are literal and identical in both forms. The DOM
// contract below mirrors the Vue render output:
//
//   div.hk-input-wrapper
//     label.hk-input-label [for=id]                  (label && !hideLabel)
//       {label} span.hk-input-required (*)           (required)
//     div.hk-input-box .hk-input-box-{size}
//         [.hk-input-box-error] [.hk-input-box-disabled] [.hk-input-box-number]
//         [data-autogrow] [data-number-steppers] [data-align=start|end]
//       span.hk-input-affix.hk-input-prefix           (prefix slot; else prefixIcon)
//       input.hk-input-element
//         or, for `type="textarea"`,
//         textarea.hk-input-element.hk-input-textarea
//             [.hk-input-textarea-autogrow]
//       span.hk-input-affix.hk-input-suffix           (suffix slot; else suffixIcon)
//     p.hk-input-error-msg                            (error wins)
//     p.hk-input-hint                                 (else hint)
//
// Vue prop mapping: `modelValue` → [`InputProps::model_value`], `type` →
// [`InputProps::input_type`] (the name the crate's live call sites already
// use), `size` → [`InputSize`] (`sm`/`md`/`lg`), `variant` → [`InputVariant`],
// `align` → [`InputAlign`] (the `data-align` token), `submitOnEnter` →
// [`InputProps::submit_on_enter`], `hideLabel` → [`InputProps::hide_label`],
// the `#prefix`/`#prefixIcon`/`#suffix`/`#suffixIcon` slots →
// [`InputProps::prefix`]/[`InputProps::prefix_icon`]/
// [`InputProps::suffix`]/[`InputProps::suffix_icon`] (slot wins, exactly Vue's
// priority).
//
// Behaviour deltas vs Vue (documented):
//   * the affix-width custom properties (`--hk-input-affix-start-w` /
//     `--hk-input-affix-end-w`) are NOT published: Vue measures both affix
//     spans with a `ResizeObserver`, and tairitsu 0.5.22 has no
//     per-instance ref + observer pairing. The sheet's `0px` fallbacks keep
//     its symmetric-reservation math exact, so an affixed field reserves the
//     base padding only. The narrow-box auto-degrade (`data-affix-cramped`,
//     2026-11-17) hangs off the SAME per-instance measurement plus the
//     box's `clientWidth`, so the mirror never stamps the marker either —
//     and with the `0px` fallbacks the sheet's cramped rules would degrade
//     to the identical base padding anyway.
//   * no `HkPlaceholderMarquee` overlay (that component has no Rust mirror in
//     this wave); the NATIVE placeholder is always the showing one.
//   * no password variant (`HkPasswordSurface`'s canvas dot matrix) and no
//     `HkNumberSteppers` column: a number field keeps Vue's marker class
//     (`hk-input-box-number`, which retires the native spin buttons) and the
//     native keyboard stepping.
//   * no generated element id: Vue's `useId()` has no tairitsu analogue, so
//     the caption's `for` is emitted only when the caller passes `id`.
//   * `KeyboardEvent` carries no `isComposing`, so the Enter/submit guard is
//     Vue's modifier + disabled/readonly set without the IME check.
//   * Vue drops a caller `class`/`style` on this component (`inheritAttrs:
//     false` + a filtered attrs spread); the mirror appends `class` to the
//     wrapper so hosts can still scope an instance.
//
// Compatibility tail (inert, documented): `data/pagination.rs` and
// `feedback/message_box.rs` still drive this component through the retired
// legacy prop surface. Those fields are accepted and IGNORED — the mirror's
// chrome comes from the Vue sheet only (no `Glow` wrapper) — until their own
// mirror tasks land.

use crate::feedback::{GlowBlur, GlowColor, GlowIntensity};
use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct InputComponent;

/// Field size step. The identifiers are the pre-mirror ones (call sites such
/// as `data/pagination.rs` pass `InputSize::Medium`); the emitted class is
/// Vue's `hk-input-box-{sm,md,lg}` exactly.
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum InputSize {
    Small,
    #[default]
    Medium,
    Large,
}

impl InputSize {
    /// The `hk-input-box-{size}` modifier exactly as Vue emits it.
    pub fn class_name(self) -> &'static str {
        match self {
            InputSize::Small => "hk-input-box-sm",
            InputSize::Medium => "hk-input-box-md",
            InputSize::Large => "hk-input-box-lg",
        }
    }
}

/// Vue's `variant` (`"text" | "password" | "number"`). The password surface is
/// deferred (see the header deltas), so only the two branches this wave can
/// honour are representable — a caller cannot silently ask for a canvas that
/// does not exist.
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum InputVariant {
    #[default]
    Text,
    Number,
}

/// Horizontal alignment of the text line (Vue: `align`, default `center`).
/// Non-center values ride the box's `data-align` attribute, and textarea
/// boxes never carry it (Vue excludes them: their affixes sit in flow beside
/// the element instead of overlaid).
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum InputAlign {
    #[default]
    Center,
    Start,
    End,
}

impl InputAlign {
    /// The `data-align` token, or `None` for the centered default (Vue emits
    /// no attribute at all then).
    pub fn data_align(self) -> Option<&'static str> {
        match self {
            InputAlign::Center => None,
            InputAlign::Start => Some("start"),
            InputAlign::End => Some("end"),
        }
    }
}

/// Vue's `resolvedType`: `variant="number"` wins, otherwise the `type`
/// attribute with its `"text"` default.
fn resolve_input_type(variant: InputVariant, input_type: Option<&str>) -> &str {
    match variant {
        InputVariant::Number => "number",
        InputVariant::Text => input_type.unwrap_or("text"),
    }
}

#[define_props]
pub struct InputProps {
    /// Vue: `modelValue`, default `""`.
    #[default]
    pub model_value: String,

    /// Pre-mirror alias of [`InputProps::model_value`]; wins when `Some`.
    /// Kept for the two un-migrated call sites (see the header note).
    pub value: Option<String>,

    /// Vue's `type` (`"text"`, `"number"`, `"textarea"`, …); `None` renders
    /// `"text"`.
    pub input_type: Option<String>,

    /// Native placeholder. `None` ≡ Vue's `""` (no attribute is emitted).
    pub placeholder: Option<String>,

    /// Caption above the box (Vue: `label`, default undefined).
    pub label: Option<String>,

    /// Error ink + message line; wins over [`InputProps::hint`].
    pub error: Option<String>,

    /// Secondary message line, shown only when there is no error.
    pub hint: Option<String>,

    #[default]
    pub disabled: bool,

    #[default]
    pub readonly: bool,

    /// Appends the `*` marker to the caption (Vue: `required`).
    #[default]
    pub required: bool,

    /// Native `name` attribute.
    pub name: Option<String>,

    /// Element id the caption's `for` points at (Vue: `id`, `useId()` when
    /// omitted — no Rust analogue, see the header deltas).
    pub id: Option<String>,

    /// Native `spellcheck` toggle; `None` keeps the browser default.
    pub spellcheck: Option<bool>,

    /// Submit intent on a modifier-free Enter (Vue: `submitOnEnter`).
    pub submit_on_enter: Option<EventHandler<()>>,

    /// Native `autocomplete`; `None` renders `"off"` (Vue's `?? "off"`).
    pub autocomplete: Option<String>,

    /// Focus the field on mount (Vue leaves this to the attrs spread).
    #[default]
    pub autofocus: bool,

    /// Textarea row count (Vue: `rows`, default 3).
    #[default(3)]
    pub rows: u32,

    /// Textarea auto-grow opt-in (Vue: `autoGrow`); adds the
    /// `data-autogrow` box marker and the element's autogrow class.
    #[default]
    pub auto_grow: bool,

    /// Size step (`hk-input-box-{size}`).
    #[default]
    pub size: InputSize,

    /// Keep `label` semantic but off screen: the element gets
    /// `aria-label={label}` instead (Vue: `hideLabel`).
    #[default]
    pub hide_label: bool,

    /// Input variant; `number` maps the element type.
    #[default]
    pub variant: InputVariant,

    /// Text-line alignment (`data-align`).
    #[default]
    pub align: InputAlign,

    /// Affix slot (Vue: `#prefix`); wins over [`InputProps::prefix_icon`].
    pub prefix: Option<Element>,

    /// Icon affix (Vue: `#prefixIcon`).
    pub prefix_icon: Option<Element>,

    /// Affix slot (Vue: `#suffix`); wins over [`InputProps::suffix_icon`].
    pub suffix: Option<Element>,

    /// Icon affix (Vue: `#suffixIcon`).
    pub suffix_icon: Option<Element>,

    #[default]
    pub class: String,

    /// Fires with the field's new text (Vue: `update:modelValue`).
    pub oninput: Option<EventHandler<String>>,

    /// Vue: the `focus` emit.
    pub onfocus: Option<EventHandler<FocusEvent>>,

    /// Vue: the `blur` emit.
    pub onblur: Option<EventHandler<FocusEvent>>,

    /// Vue: the `keydown` emit (after the submit-on-Enter interception).
    pub onkeydown: Option<EventHandler<KeyboardEvent>>,

    /// Vue: the `change` emit (a listener the attrs spread brings along).
    /// Fires with the field's committed value.
    pub onchange: Option<EventHandler<ChangeEvent>>,

    /// Attributes set on the field element by name, after the component's
    /// own — `maxlength`, `min`, `step`, `title`, `data-*`, `aria-*`, test
    /// hooks (Vue: the attrs spread on the element). A name the component
    /// renders itself takes the host's value, as a spread attribute does.
    pub attrs: Vec<(String, String)>,

    /// Render the field element alone: no caption, box, affixes or message
    /// line, `class` on the element and none of the sheet's own classes —
    /// the host draws the chrome and keeps the event wiring.
    #[default]
    pub bare: bool,

    // ── compatibility tail (accepted, inert; see the header note) ──────────
    /// Retired glow toggle; the Vue sheet owns the field chrome.
    #[default]
    pub glow: bool,
    /// Retired glow blur step.
    #[default]
    pub glow_blur: GlowBlur,
    /// Retired glow ink.
    #[default]
    pub glow_color: GlowColor,
    /// Retired glow intensity.
    #[default]
    pub glow_intensity: GlowIntensity,
}

impl InputProps {
    /// The rendered value: Vue's `modelValue`, with the retired `value` alias
    /// winning while a pre-mirror call site still passes it.
    fn resolved_value(&self) -> &str {
        self.value.as_deref().unwrap_or(self.model_value.as_str())
    }
}

/// The event wiring both element branches share. `Callback` is cloneable, so
/// this bundle is too: the component builds one handler per event from a copy
/// and moves it into whichever branch renders (an `rsx!` attribute consumes
/// exactly one closure).
#[derive(Clone)]
struct FieldEvents {
    oninput: Option<EventHandler<String>>,
    onfocus: Option<EventHandler<FocusEvent>>,
    onblur: Option<EventHandler<FocusEvent>>,
    onkeydown: Option<EventHandler<KeyboardEvent>>,
    onchange: Option<EventHandler<ChangeEvent>>,
    submit: Option<EventHandler<()>>,
    textarea: bool,
    disabled: bool,
    readonly: bool,
}

impl FieldEvents {
    /// Vue's `@input` handler reads `event.target.value`, so the host is
    /// handed the field's whole value as it stands after the event
    /// (`InputEvent.value`) — what a controlled field stores. The inserted
    /// fragment (`InputEvent.data`) would leave it the last keystroke only,
    /// and nothing at all on a deletion.
    fn input(&self, event: InputEvent) {
        if let Some(handler) = self.oninput.as_ref() {
            handler.call(event.value.clone());
        }
    }

    fn focus(&self, event: FocusEvent) {
        if let Some(handler) = self.onfocus.as_ref() {
            handler.call(event);
        }
    }

    fn blur(&self, event: FocusEvent) {
        if let Some(handler) = self.onblur.as_ref() {
            handler.call(event);
        }
    }

    /// Vue's `change` emit: the event carries the field's committed value.
    fn change(&self, event: ChangeEvent) {
        if let Some(handler) = self.onchange.as_ref() {
            handler.call(event);
        }
    }

    /// Vue's Enter interception, then the `keydown` emit. A textarea only
    /// intercepts Enter when a submit intent was wired — a submit-less
    /// textarea must keep the native newline.
    fn key(&self, event: KeyboardEvent) {
        let submit_armed = !self.textarea || self.submit.is_some();
        if event.key == "Enter"
            && submit_armed
            && !event.ctrl_key
            && !event.meta_key
            && !event.alt_key
            && !event.shift_key
            && !self.disabled
            && !self.readonly
        {
            event.prevent_default();
            if let Some(handler) = self.submit.as_ref() {
                handler.call(());
            }
        }
        if let Some(handler) = self.onkeydown.as_ref() {
            handler.call(event);
        }
    }
}

/// Push a class onto a space-separated class list.
fn push_class(classes: &mut String, class: &str) {
    if !class.is_empty() {
        if !classes.is_empty() {
            classes.push(' ');
        }
        classes.push_str(class);
    }
}

#[component]
pub fn Input(props: InputProps) -> Element {
    let value_text = props.resolved_value().to_string();
    let resolved_type = resolve_input_type(props.variant, props.input_type.as_deref()).to_string();
    let is_textarea = resolved_type == "textarea";
    let is_number = resolved_type == "number";
    let is_autogrow = props.auto_grow && is_textarea;

    // Vue truthiness: an empty string is falsy for every one of these.
    let label_text = props.label.clone().filter(|label| !label.is_empty());
    let error_text = props.error.clone().filter(|error| !error.is_empty());
    let hint_text = props.hint.clone().filter(|hint| !hint.is_empty());
    let placeholder = props.placeholder.clone();
    let aria_label = if props.hide_label {
        label_text.clone()
    } else {
        None
    };
    let spellcheck_attr = props
        .spellcheck
        .map(|enabled| if enabled { "true" } else { "false" });
    // Vue: `autocomplete ?? "off"`. A bare field keeps the browser default
    // unless the host says otherwise — the host owns that field.
    let autocomplete = props.autocomplete.clone().or_else(|| {
        if props.bare {
            None
        } else {
            Some("off".to_string())
        }
    });
    let data_align = if is_textarea {
        None
    } else {
        props.align.data_align()
    };
    let rows = props.rows;

    let mut wrapper_classes = String::from("hk-input-wrapper");
    push_class(&mut wrapper_classes, &props.class);

    let mut box_classes = String::from("hk-input-box");
    push_class(&mut box_classes, props.size.class_name());
    if error_text.is_some() {
        push_class(&mut box_classes, "hk-input-box-error");
    }
    if props.disabled {
        push_class(&mut box_classes, "hk-input-box-disabled");
    }
    if is_number {
        push_class(&mut box_classes, "hk-input-box-number");
    }

    let mut element_classes = if props.bare {
        // The host's class alone: a bare field carries none of the sheet's.
        props.class.clone()
    } else {
        String::from("hk-input-element")
    };
    if is_textarea && !props.bare {
        push_class(&mut element_classes, "hk-input-textarea");
        if is_autogrow {
            push_class(&mut element_classes, "hk-input-textarea-autogrow");
        }
    }
    // The password-manager hints ride on the sheet's own field, not on a
    // host's.
    let pm_hints = !props.bare;

    let prefix = props.prefix.clone().or_else(|| props.prefix_icon.clone());
    let suffix = props.suffix.clone().or_else(|| props.suffix_icon.clone());

    let events = FieldEvents {
        oninput: props.oninput.clone(),
        onfocus: props.onfocus.clone(),
        onblur: props.onblur.clone(),
        onkeydown: props.onkeydown.clone(),
        onchange: props.onchange.clone(),
        submit: props.submit_on_enter.clone(),
        textarea: is_textarea,
        disabled: props.disabled,
        readonly: props.readonly,
    };

    // The field element: input or textarea, exactly the two branches Vue
    // renders under the same box. `rsx!` consumes one closure per attribute, so
    // the handlers are built once and moved into whichever branch renders
    // (only one arm executes, so both arms may take the same bindings).
    let oninput_events = events.clone();
    let oninput = move |event: InputEvent| oninput_events.input(event);
    let onfocus_events = events.clone();
    let onfocus = move |event: FocusEvent| onfocus_events.focus(event);
    let onblur_events = events.clone();
    let onblur = move |event: FocusEvent| onblur_events.blur(event);
    let onkeydown_events = events.clone();
    let onkeydown = move |event: KeyboardEvent| onkeydown_events.key(event);
    let onchange_events = events.clone();
    let onchange = move |event: ChangeEvent| onchange_events.change(event);

    let field = if is_textarea {
        rsx! {
            textarea {
                class: element_classes,
                id: props.id.clone(),
                value: value_text,
                placeholder: placeholder,
                disabled: props.disabled,
                readonly: props.readonly,
                spellcheck: spellcheck_attr,
                rows: rows,
                name: props.name.clone(),
                autocomplete: autocomplete,
                autofocus: props.autofocus,
                "data-1p-ignore": pm_hints,
                "data-lpignore": if pm_hints { Some("true") } else { None },
                "aria-label": aria_label,
                oninput: oninput,
                onfocus: onfocus,
                onblur: onblur,
                onkeydown: onkeydown,
                onchange: onchange,
            }
        }
    } else {
        rsx! {
            input {
                class: element_classes,
                id: props.id.clone(),
                "type": resolved_type,
                value: value_text,
                placeholder: placeholder,
                disabled: props.disabled,
                readonly: props.readonly,
                spellcheck: spellcheck_attr,
                name: props.name.clone(),
                autocomplete: autocomplete,
                autofocus: props.autofocus,
                "data-1p-ignore": pm_hints,
                "data-lpignore": if pm_hints { Some("true") } else { None },
                "aria-label": aria_label,
                oninput: oninput,
                onfocus: onfocus,
                onblur: onblur,
                onkeydown: onkeydown,
                onchange: onchange,
            }
        }
    };
    // Vue's attrs spread lands on the field element after the template's own.
    let field = crate::utils::passthrough::onto_root(field, &props.attrs);

    // A bare field is the element and nothing else.
    if props.bare {
        return field;
    }

    let required = props.required;
    let hide_label = props.hide_label;
    let field_id = props.id.clone();

    rsx! {
        div {
            class: wrapper_classes,
            if let Some(label) = label_text {
                if !hide_label {
                    label {
                        class: "hk-input-label",
                        "for": field_id,
                        "{label}"
                        if required {
                            span { class: "hk-input-required",
                                "*"
                            }
                        }
                    }
                }
            }
            div {
                class: box_classes,
                "data-autogrow": is_autogrow,
                "data-number-steppers": is_number,
                "data-align": data_align,
                if let Some(prefix) = prefix {
                    span { class: "hk-input-affix hk-input-prefix",
                        {prefix}
                    }
                }
                {field}
                if let Some(suffix) = suffix {
                    span { class: "hk-input-affix hk-input-suffix",
                        {suffix}
                    }
                }
            }
            if let Some(error) = error_text {
                p { class: "hk-input-error-msg",
                    "{error}"
                }
            } else if let Some(hint) = hint_text {
                p { class: "hk-input-hint",
                    "{hint}"
                }
            }
        }
    }
}

impl StyledComponent for InputComponent {
    fn styles() -> &'static str {
        // The canonical Vue sheet, compiled verbatim (no_hash keeps the
        // `.hk-input*` names literal so this CSS matches the Vue build).
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkInput.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "input"
    }
}

#[cfg(test)]
mod tests {
    use std::cell::RefCell;
    use std::rc::Rc;

    use super::*;

    #[test]
    fn input_size_class_names_match_the_vue_modifiers() {
        assert_eq!(InputSize::Small.class_name(), "hk-input-box-sm");
        assert_eq!(InputSize::Medium.class_name(), "hk-input-box-md");
        assert_eq!(InputSize::Large.class_name(), "hk-input-box-lg");
    }

    #[test]
    fn input_align_maps_to_the_data_align_tokens() {
        // Vue emits no `data-align` for the centered default.
        assert_eq!(InputAlign::Center.data_align(), None);
        assert_eq!(InputAlign::Start.data_align(), Some("start"));
        assert_eq!(InputAlign::End.data_align(), Some("end"));
    }

    #[test]
    fn input_resolves_the_element_type_like_vue() {
        // Vue's `resolvedType`: the number variant overrides the type attr.
        assert_eq!(resolve_input_type(InputVariant::Text, None), "text");
        assert_eq!(
            resolve_input_type(InputVariant::Text, Some("textarea")),
            "textarea"
        );
        assert_eq!(resolve_input_type(InputVariant::Number, None), "number");
        assert_eq!(
            resolve_input_type(InputVariant::Number, Some("textarea")),
            "number"
        );
    }

    #[test]
    fn input_props_default_matches_the_vue_props() {
        let props = InputProps::default();
        assert_eq!(props.model_value, "");
        // The retired alias is unset, so `modelValue` is authoritative.
        assert_eq!(props.value, None);
        assert_eq!(props.resolved_value(), "");
        assert_eq!(props.input_type, None);
        assert_eq!(props.placeholder, None);
        assert_eq!(props.label, None);
        assert_eq!(props.error, None);
        assert_eq!(props.hint, None);
        assert!(!props.disabled);
        assert!(!props.readonly);
        assert!(!props.required);
        assert_eq!(props.name, None);
        assert_eq!(props.id, None);
        assert_eq!(props.spellcheck, None);
        assert_eq!(props.autocomplete, None);
        assert!(!props.autofocus);
        // Vue's HkInput `rows` default is 3 (HkTextarea's is 4).
        assert_eq!(props.rows, 3);
        assert!(!props.auto_grow);
        assert_eq!(props.size, InputSize::Medium);
        assert!(!props.hide_label);
        assert_eq!(props.variant, InputVariant::Text);
        assert_eq!(props.align, InputAlign::Center);
        // `Element` / `EventHandler` are not `Debug`, so the slot and event
        // props are pinned by presence only.
        assert!(props.prefix.is_none());
        assert!(props.prefix_icon.is_none());
        assert!(props.suffix.is_none());
        assert!(props.suffix_icon.is_none());
        assert_eq!(props.class, "");
        assert!(props.oninput.is_none());
        assert!(props.onfocus.is_none());
        assert!(props.onblur.is_none());
        assert!(props.onkeydown.is_none());
        assert!(props.submit_on_enter.is_none());
    }

    #[test]
    fn input_legacy_value_alias_wins_over_model_value() {
        // Documented compat rule: `value: Some(..)` (retired call sites) beats
        // the Vue-named `model_value`.
        let props = InputProps {
            model_value: "vue".to_string(),
            value: Some("legacy".to_string()),
            ..Default::default()
        };
        assert_eq!(props.resolved_value(), "legacy");

        let props = InputProps {
            model_value: "vue".to_string(),
            ..Default::default()
        };
        assert_eq!(props.resolved_value(), "vue");
    }

    #[test]
    fn input_styles_come_from_the_canonical_vue_sheet() {
        let css = InputComponent::styles();
        assert!(
            css.contains(".hk-input-wrapper")
                && css.contains(".hk-input-box")
                && css.contains(".hk-input-element")
                && css.contains(".hk-input-affix"),
            "input css must carry the vue classes"
        );
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored input sheet"
        );
        // The retired legacy sheet's token family must not come back.
        assert!(
            !css.contains("--hi-input-text-color"),
            "legacy --hi-input-* vars are retired"
        );
    }

    #[test]
    fn an_input_event_hands_the_host_the_field_s_value() {
        // A controlled field stores what the field holds after the event, the
        // way Vue's handler reads `event.target.value` — never the fragment
        // this one keystroke inserted, which is the last character while
        // typing and nothing at all on a deletion.
        let received = Rc::new(RefCell::new(Vec::<String>::new()));
        let sink = Rc::clone(&received);
        let events = FieldEvents {
            oninput: Some(EventHandler::new(move |value: String| {
                sink.borrow_mut().push(value);
            })),
            onfocus: None,
            onblur: None,
            onkeydown: None,
            onchange: None,
            submit: None,
            textarea: false,
            disabled: false,
            readonly: false,
        };
        events.input(InputEvent::new().data("o").value("Hello"));
        events.input(InputEvent::new().data("").value("Hell"));
        assert_eq!(
            *received.borrow(),
            vec!["Hello".to_string(), "Hell".to_string()]
        );
    }

    #[test]
    fn the_rendered_field_is_wired_to_the_same_payload() {
        let received = Rc::new(RefCell::new(Vec::<String>::new()));
        let sink = Rc::clone(&received);
        let node = Input(InputProps {
            oninput: Some(EventHandler::new(move |value: String| {
                sink.borrow_mut().push(value);
            })),
            ..Default::default()
        });
        assert!(
            crate::testing::type_into(&node, "input", "hk-input-element", "o", "Hello"),
            "no input element with an input listener is rendered"
        );
        assert_eq!(*received.borrow(), vec!["Hello".to_string()]);
    }

    #[test]
    fn a_change_event_reaches_the_host() {
        // Vue: a `change` listener through the attrs spread; the event
        // carries the field's committed value.
        let received = Rc::new(RefCell::new(Vec::<String>::new()));
        let sink = Rc::clone(&received);
        let events = FieldEvents {
            oninput: None,
            onfocus: None,
            onblur: None,
            onkeydown: None,
            onchange: Some(EventHandler::new(move |event: ChangeEvent| {
                sink.borrow_mut().push(event.value);
            })),
            submit: None,
            textarea: false,
            disabled: false,
            readonly: false,
        };
        events.change(ChangeEvent::new().value("committed"));
        assert_eq!(*received.borrow(), vec!["committed".to_string()]);
    }

    #[test]
    fn a_rendered_change_event_reaches_the_host() {
        // The listener has to be wired to the element the component renders,
        // on every branch: the field, the textarea branch and the bare form.
        for (props, tag, class_part) in [
            (InputProps::default(), "input", "hk-input-element"),
            (
                InputProps {
                    input_type: Some("textarea".to_string()),
                    ..Default::default()
                },
                "textarea",
                "",
            ),
            (
                InputProps {
                    bare: true,
                    ..Default::default()
                },
                "input",
                "",
            ),
        ] {
            let received = Rc::new(RefCell::new(Vec::<String>::new()));
            let sink = Rc::clone(&received);
            let node = Input(InputProps {
                onchange: Some(EventHandler::new(move |event: ChangeEvent| {
                    sink.borrow_mut().push(event.value);
                })),
                ..props
            });
            assert!(
                crate::testing::commit_on(&node, tag, class_part, "committed"),
                "no {tag} with a change listener is rendered: {}",
                node.render_to_html()
            );
            assert_eq!(*received.borrow(), vec!["committed".to_string()]);
        }
    }

    #[test]
    fn host_attributes_land_on_the_field_element() {
        let html = Input(InputProps {
            attrs: vec![
                ("maxlength".to_string(), "14".to_string()),
                ("data-testid".to_string(), "nick".to_string()),
            ],
            ..Default::default()
        })
        .render_to_html();
        let field = html
            .split('<')
            .find(|tag| tag.starts_with("input "))
            .unwrap_or_else(|| panic!("no field element in {html}"));
        assert!(field.contains(r#"maxlength="14""#), "{field}");
        assert!(field.contains(r#"data-testid="nick""#), "{field}");
        // The sheet's own chrome is still around it.
        assert!(html.contains("hk-input-wrapper"), "{html}");
    }

    #[test]
    fn a_bare_input_is_the_field_element_alone() {
        let html = Input(InputProps {
            bare: true,
            class: "nick-input".to_string(),
            placeholder: Some("Nickname".to_string()),
            attrs: vec![("maxlength".to_string(), "14".to_string())],
            ..Default::default()
        })
        .render_to_html();
        assert!(
            html.starts_with("<input "),
            "the element is the root: {html}"
        );
        assert!(html.contains(r#"class="nick-input""#), "{html}");
        assert!(html.contains(r#"type="text""#), "{html}");
        assert!(html.contains(r#"maxlength="14""#), "{html}");
        assert!(
            !html.contains("hk-input"),
            "no sheet chrome on a bare field: {html}"
        );
        assert!(!html.contains("data-lpignore"), "{html}");
        assert!(!html.contains("<div"), "{html}");
    }

    #[test]
    fn a_bare_textarea_branch_is_the_element_alone_too() {
        let html = Input(InputProps {
            bare: true,
            input_type: Some("textarea".to_string()),
            class: "notes".to_string(),
            ..Default::default()
        })
        .render_to_html();
        assert!(
            html.starts_with("<textarea "),
            "the element is the root: {html}"
        );
        assert!(
            html.contains(r#"class="notes""#),
            "no sheet class on a bare field: {html}"
        );
        assert!(!html.contains("hk-input"), "{html}");
        // No class passed: no class attribute, like a host's own element.
        let plain = Input(InputProps {
            bare: true,
            ..Default::default()
        })
        .render_to_html();
        assert!(
            plain.starts_with("<input "),
            "the element is the root: {plain}"
        );
        assert!(!plain.contains("class="), "{plain}");
    }
}
