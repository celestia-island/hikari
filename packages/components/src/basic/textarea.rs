// hi-components/src/basic/textarea.rs
// Textarea — mirror of the canonical Vue `HkTextarea`: the standalone
// multi-line field (the one WITHOUT the `HkInput` box chrome — caption,
// affixes and error line live on `HkInput`'s textarea branch instead).
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkTextarea.scss`, vendored under
// `src/styles/vue-mirror/` and guarded by
// `tests/vue_mirror_drift_tests.rs`), compiled with `no_hash` so the
// `.hk-textarea*` class names are literal and identical in both forms. The
// DOM contract below mirrors the Vue render output one-to-one:
//
//   div.hk-textarea [.hk-textarea-disabled] [.hk-textarea-overlimit]
//     textarea.hk-textarea-field [.hk-textarea-field-autogrow]
//     div.hk-textarea-count                        (showCount && maxLength)
//       span[.hk-textarea-count-over] {count}
//       span { " / {maxLength}" }
//
// Vue prop mapping: `modelValue` → [`TextareaProps::model_value`],
// `maxLength` → [`TextareaProps::max_length`], `autoGrow` →
// [`TextareaProps::auto_grow`], `showCount` → [`TextareaProps::show_count`].
// `rows` keeps Vue's default of 4 (`HkInput`'s textarea branch defaults to 3).
//
// Behaviour deltas vs Vue (documented):
//   * `autoGrow` cannot measure the content height: Vue writes
//     `height = scrollHeight` from a `ResizeObserver` callback, and tairitsu
//     0.5.22 has no per-instance element ref + observer pairing. The prop
//     still switches the sheet's autogrow face on (`resize: none;
//     overflow: hidden` + the class), so a host that wants a growing field
//     pins the height itself.
//   * the character count is Vue's `String.length`, i.e. UTF-16 code units
//     (an astral character counts 2) — the mirror counts the same way so the
//     rendered line never disagrees with the Vue form.
//   * the value rides the crate's `value` attribute path (the same one the
//     retired legacy field used) rather than Vue's DOM-property write.
//   * Vue renders only the wrapper; a caller `class` prop is appended to it
//     by the mirror (the retired legacy field accepted one).

use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct TextareaComponent;

#[define_props]
pub struct TextareaProps {
    /// Vue: `modelValue`, default `""`.
    #[default]
    pub model_value: String,

    /// Native placeholder (Vue default undefined).
    pub placeholder: Option<String>,

    #[default]
    pub disabled: bool,

    /// Visible row count (Vue: `rows`, default 4).
    #[default(4)]
    pub rows: u32,

    /// Auto-grow opt-in (Vue: `autoGrow`); see the header delta — the mirror
    /// can only carry the sheet's autogrow face, not the measured height.
    #[default]
    pub auto_grow: bool,

    /// Native `maxlength` cap (Vue: `maxLength`, default undefined). It also
    /// gates the counter line.
    pub max_length: Option<u32>,

    /// Render the `count / max` line (Vue: `showCount`).
    #[default]
    pub show_count: bool,

    #[default]
    pub class: String,

    /// Fires with the field's new text (Vue: `update:modelValue`).
    pub oninput: Option<EventHandler<String>>,

    /// Vue: the `change` emit (a listener the attrs spread brings along).
    /// Fires with the field's committed value.
    pub onchange: Option<EventHandler<ChangeEvent>>,

    /// Attributes set on the field element by name, after the component's
    /// own — `title`, `data-*`, `aria-*`, test hooks (Vue: the attrs spread
    /// on the element). A name the component renders itself takes the
    /// host's value, as a spread attribute does.
    pub attrs: Vec<(String, String)>,

    /// Render the field element alone: no wrapper, no counter line, `class`
    /// on the element and none of the sheet's own classes — the host draws
    /// the chrome and keeps the event wiring.
    #[default]
    pub bare: bool,
}

/// Vue's `charCount` = `modelValue.length`: UTF-16 code units, NOT Unicode
/// scalar values (see the header delta).
fn char_count(value: &str) -> usize {
    value.encode_utf16().count()
}

/// Vue's `isOverLimit`: only a real `maxLength` can be exceeded.
fn is_over_limit(value: &str, max_length: Option<u32>) -> bool {
    match max_length {
        Some(max_length) => char_count(value) > max_length as usize,
        None => false,
    }
}

#[component]
pub fn Textarea(props: TextareaProps) -> Element {
    let count = char_count(&props.model_value);
    let over_limit = is_over_limit(&props.model_value, props.max_length);
    let show_count = props.show_count && props.max_length.is_some();

    let mut wrapper_classes = String::from("hk-textarea");
    if props.disabled {
        wrapper_classes.push_str(" hk-textarea-disabled");
    }
    if over_limit {
        wrapper_classes.push_str(" hk-textarea-overlimit");
    }
    if !props.class.is_empty() {
        wrapper_classes.push(' ');
        wrapper_classes.push_str(&props.class);
    }

    let field_classes = if props.bare {
        // The host's class alone: a bare field carries none of the sheet's.
        props.class.clone()
    } else if props.auto_grow {
        "hk-textarea-field hk-textarea-field-autogrow".to_string()
    } else {
        "hk-textarea-field".to_string()
    };

    let count_class = if over_limit {
        "hk-textarea-count-over"
    } else {
        ""
    };
    // `Option<u32>` has no attribute conversion on the tairitsu side, so the
    // native cap is handed over as its string form (omitted when unset).
    let maxlength_attr = props.max_length.map(|value| value.to_string());
    // Children text never interpolates inside `rsx!` (only the `"{expr}"`
    // shorthand does), so the counter pair is pre-rendered.
    let count_text = format!("{count}");
    let limit_text = format!(" / {}", props.max_length.unwrap_or_default());

    let oninput_handler = props.oninput.clone();
    // Vue's `@input` reads `event.target.value`: the host is handed the
    // field's whole value after the event, not the fragment it inserted.
    let oninput = move |event: InputEvent| {
        if let Some(handler) = oninput_handler.as_ref() {
            handler.call(event.value.clone());
        }
    };
    // Vue's `change` emit: the event carries the field's committed value.
    let onchange_handler = props.onchange.clone();
    let onchange = move |event: ChangeEvent| {
        if let Some(handler) = onchange_handler.as_ref() {
            handler.call(event);
        }
    };

    // Vue's attrs spread lands on the field element after the template's own.
    let field = crate::utils::passthrough::onto_root(
        rsx! {
            textarea {
                class: field_classes,
                value: props.model_value.clone(),
                placeholder: props.placeholder.clone(),
                disabled: props.disabled,
                rows: props.rows,
                maxlength: maxlength_attr,
                oninput: oninput,
                onchange: onchange,
            }
        },
        &props.attrs,
    );

    // A bare field is the element and nothing else.
    if props.bare {
        return field;
    }

    rsx! {
        div {
            class: wrapper_classes,
            {field}
            if show_count {
                div { class: "hk-textarea-count",
                    span { class: count_class, {count_text} }
                    span { {limit_text} }
                }
            }
        }
    }
}

impl StyledComponent for TextareaComponent {
    fn styles() -> &'static str {
        // The canonical Vue sheet, compiled verbatim (no_hash keeps the
        // `.hk-textarea*` names literal so this CSS matches the Vue build).
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkTextarea.scss", no_hash }
            .0
    }

    fn name() -> &'static str {
        "textarea"
    }
}

#[cfg(test)]
mod tests {
    use std::cell::RefCell;
    use std::rc::Rc;

    use super::*;

    #[test]
    fn textarea_props_default_matches_the_vue_props() {
        let props = TextareaProps::default();
        assert_eq!(props.model_value, "");
        assert_eq!(props.placeholder, None);
        assert!(!props.disabled);
        // Vue's HkTextarea default is 4 (HkInput's textarea branch uses 3).
        assert_eq!(props.rows, 4);
        assert!(!props.auto_grow);
        assert_eq!(props.max_length, None);
        assert!(!props.show_count);
        assert_eq!(props.class, "");
        assert!(props.oninput.is_none());
    }

    #[test]
    fn a_textarea_input_event_hands_the_host_the_field_s_value() {
        // Vue's `@input` reads `event.target.value`; the inserted fragment
        // would leave a controlled textarea the last keystroke only.
        let received = Rc::new(RefCell::new(Vec::<String>::new()));
        let sink = Rc::clone(&received);
        let node = Textarea(TextareaProps {
            oninput: Some(EventHandler::new(move |value: String| {
                sink.borrow_mut().push(value);
            })),
            ..Default::default()
        });
        assert!(
            crate::testing::type_into(&node, "textarea", "hk-textarea-field", "d", "typed"),
            "no textarea with an input listener is rendered"
        );
        assert!(
            crate::testing::type_into(&node, "textarea", "hk-textarea-field", "", "type"),
            "no textarea with an input listener is rendered"
        );
        assert_eq!(
            *received.borrow(),
            vec!["typed".to_string(), "type".to_string()]
        );
    }

    #[test]
    fn textarea_counts_utf16_code_units_like_vue() {
        assert_eq!(char_count(""), 0);
        assert_eq!(char_count("hello"), 5);
        assert_eq!(char_count("中文"), 2);
        // `String.length` is UTF-16: an astral character counts 2.
        assert_eq!(char_count("😀"), 2);
    }

    #[test]
    fn textarea_over_limit_only_applies_with_a_max_length() {
        assert!(!is_over_limit("abcdef", None));
        assert!(!is_over_limit("abcd", Some(4)));
        assert!(is_over_limit("abcde", Some(4)));
        // Equality is not "over" — Vue compares with `>`.
        assert!(!is_over_limit("", Some(0)));
        assert!(is_over_limit("a", Some(0)));
    }

    #[test]
    fn textarea_styles_come_from_the_canonical_vue_sheet() {
        let css = TextareaComponent::styles();
        assert!(
            css.contains(".hk-textarea-field") && css.contains(".hk-textarea-count"),
            "textarea css must carry the vue classes"
        );
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored textarea sheet"
        );
        // The retired legacy inline sheet used the shared `.hk-input*` family
        // plus `--hi-*` tokens; neither may come back through this mirror.
        assert!(
            !css.contains(".hk-input") && !css.contains("--hi-text-primary"),
            "legacy .hk-input / --hi-* rules are retired for the textarea"
        );
    }

    /// Invoke the change listener of the first textarea in `node`.
    fn commit(node: &Element) -> bool {
        fn walk(node: &VNode) -> bool {
            match node {
                VNode::Element(element) => {
                    if element.tag == "textarea"
                        && let Some(handler) = element.event_handlers.get("change")
                    {
                        handler.borrow_mut()(Box::new(ChangeEvent::new().value("committed")));
                        return true;
                    }
                    element.children.iter().any(walk)
                }
                VNode::Fragment(children) => children.iter().any(walk),
                _ => false,
            }
        }
        walk(node)
    }

    #[test]
    fn a_textarea_change_event_reaches_the_host() {
        let received = Rc::new(RefCell::new(Vec::<String>::new()));
        let sink = Rc::clone(&received);
        let node = Textarea(TextareaProps {
            onchange: Some(EventHandler::new(move |event: ChangeEvent| {
                sink.borrow_mut().push(event.value);
            })),
            ..Default::default()
        });
        assert!(
            commit(&node),
            "no textarea with a change listener is rendered"
        );
        assert_eq!(*received.borrow(), vec!["committed".to_string()]);
    }

    #[test]
    fn textarea_host_attributes_land_on_the_field_element() {
        let html = Textarea(TextareaProps {
            attrs: vec![
                ("readonly".to_string(), "readonly".to_string()),
                ("data-testid".to_string(), "log".to_string()),
            ],
            ..Default::default()
        })
        .render_to_html();
        let field = html
            .split('<')
            .find(|tag| tag.starts_with("textarea "))
            .unwrap_or_else(|| panic!("no field element in {html}"));
        assert!(field.contains(r#"readonly="readonly""#), "{field}");
        assert!(field.contains(r#"data-testid="log""#), "{field}");
        assert!(!html.contains("hk-textarea-count"), "{html}");
        assert!(
            html.contains(r#"class="hk-textarea""#),
            "the wrapper is still there: {html}"
        );
    }

    #[test]
    fn a_bare_textarea_is_the_field_element_alone() {
        let html = Textarea(TextareaProps {
            bare: true,
            class: "share-log".to_string(),
            show_count: true,
            max_length: Some(20),
            ..Default::default()
        })
        .render_to_html();
        assert!(
            html.starts_with("<textarea "),
            "the element is the root: {html}"
        );
        assert!(html.contains(r#"class="share-log""#), "{html}");
        assert!(
            !html.contains("hk-textarea"),
            "no sheet chrome on a bare field: {html}"
        );
        assert!(
            !html.contains("<div"),
            "no wrapper and no counter line: {html}"
        );
    }
}
