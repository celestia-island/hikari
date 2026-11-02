//! Render-level contracts for the W2a basic-form mirrors.
//!
//! Every mirrored component must render its Vue DOM shape through
//! `VNode::render_to_html` — the same hydration path the crate documents. The
//! per-component unit tests already assert class-name mappings on literals;
//! this table asserts the RENDERED tree carries the Vue classes/attributes, so
//! a structural regression (a wrapper moved, a class renamed, an attribute
//! dropped) reds here instead of shipping.

use hikari_components::basic::*;
use hikari_components::entry::*;
use hikari_components::prelude::*;
use hikari_components::rsx;

fn render(node: Element) -> String {
    node.render_to_html()
}

#[test]
fn button_renders_the_vue_btn_family() {
    let html = render(Button(ButtonProps::default()));
    for needle in ["hk-btn", "hk-btn-md", "hk-btn-primary"] {
        assert!(html.contains(needle), "missing {needle}: {html}");
    }
}

#[test]
fn icon_button_renders_size_and_variant() {
    let html = render(IconButton(IconButtonProps::default()));
    // The sheet keys the size class by the PIXEL step (`hk-icon-button-32`),
    // not by an enum name.
    for needle in [
        "hk-icon-button",
        "hk-icon-button-32",
        "hk-icon-button-ghost",
    ] {
        assert!(html.contains(needle), "missing {needle}: {html}");
    }
}

#[test]
fn icon_button_group_renders_root_and_role() {
    let html = render(IconButtonGroup(IconButtonGroupProps::default()));
    for needle in [
        "hk-icon-group",
        "hk-icon-group-buttons",
        "hk-icon-group-track",
    ] {
        assert!(html.contains(needle), "missing {needle}: {html}");
    }
}

#[test]
fn icon_chip_renders_tone_and_size() {
    let html = render(IconChip(IconChipProps::default()));
    for needle in [
        "hk-icon-chip",
        "hk-icon-chip-md",
        "hk-icon-chip-tone-primary",
    ] {
        assert!(html.contains(needle), "missing {needle}: {html}");
    }
    assert!(html.contains("aria-hidden"), "{html}");
}

#[test]
fn input_renders_label_box_and_error() {
    let html = render(Input(InputProps {
        label: Some("Name".to_string()),
        error: Some("Required".to_string()),
        id: Some("f-1".to_string()),
        ..Default::default()
    }));
    for needle in [
        "hk-input",
        "hk-input-label",
        "hk-input-box",
        "hk-input-error-msg",
    ] {
        assert!(html.contains(needle), "missing {needle}: {html}");
    }
    assert!(html.contains("for=\"f-1\""), "label for must bind: {html}");
}

#[test]
fn textarea_renders_the_vue_field() {
    let html = render(Textarea(TextareaProps::default()));
    assert!(html.contains("<textarea"), "{html}");
    assert!(
        html.contains("hk-textarea-field"),
        "missing field class: {html}"
    );
}

#[test]
fn select_renders_trigger_and_hidden_panel_state() {
    let html = render(Select(SelectProps::default()));
    assert!(html.contains("hk-select"), "missing root class: {html}");
    assert!(
        html.contains("hk-select-trigger"),
        "missing trigger: {html}"
    );
}

#[test]
fn checkbox_renders_box_and_input_nested() {
    let html = render(Checkbox(CheckboxProps::default()));
    assert!(html.contains("hk-checkbox"), "{html}");
    assert!(html.contains("hk-checkbox-box"), "{html}");
    assert!(html.contains("hk-checkbox-input"), "{html}");
}

#[test]
fn radio_group_renders_the_vue_group() {
    let html = render(RadioGroup(RadioGroupProps {
        options: vec![RadioOption::new("a", "A")],
        value: Some("a".to_string()),
        ..Default::default()
    }));
    for needle in ["hk-radio-group", "hk-radio", "hk-radio-box"] {
        assert!(html.contains(needle), "missing {needle}: {html}");
    }
}

#[test]
fn switch_renders_track_and_input() {
    let html = render(Switch(SwitchProps::default()));
    for needle in ["hk-switch", "hk-switch-track", "hk-switch-input"] {
        assert!(html.contains(needle), "missing {needle}: {html}");
    }
}

#[test]
fn slider_renders_track_fill_thumb() {
    let html = render(Slider(SliderProps::default()));
    for needle in ["hk-slider", "hk-slider-fill", "hk-slider-thumb"] {
        assert!(html.contains(needle), "missing {needle}: {html}");
    }
    assert!(html.contains("role=\"slider\""), "{html}");
}

#[test]
fn label_renders_the_shell() {
    let html = render(Label(LabelProps {
        text: Some("Text".to_string()),
        ..Default::default()
    }));
    assert!(html.contains("hk-label hk-label-md"), "{html}");
}

#[test]
fn kbd_renders_key_chunks() {
    let html = render(Kbd(KbdProps {
        keys: "Ctrl+K".to_string(),
        ..Default::default()
    }));
    for needle in ["hk-kbd", "hk-kbd-md", "hk-kbd-key", "hk-kbd-sep"] {
        assert!(html.contains(needle), "missing {needle}: {html}");
    }
}

#[test]
fn badge_renders_data_markers() {
    let html = render(Badge(BadgeProps {
        dot: true,
        mono: true,
        ..Default::default()
    }));
    for needle in [
        "hk-badge",
        "hk-badge-default",
        "data-el=\"dot\"",
        "data-mono",
    ] {
        assert!(html.contains(needle), "missing {needle}: {html}");
    }
    // pill defaults to true → the `false` marker must be ABSENT.
    assert!(!html.contains("data-pill"), "{html}");
}

#[test]
fn avatar_renders_the_image_branch() {
    let html = render(Avatar(AvatarProps {
        src: Some("https://example.test/a.png".to_string()),
        name: Some("alice".to_string()),
        ..Default::default()
    }));
    assert!(html.contains("hk-avatar hk-avatar-md"), "{html}");
    assert!(html.contains("<img"), "missing img: {html}");
    assert!(html.contains("alt=\"alice\""), "{html}");
}

#[test]
fn card_renders_header_body_footer() {
    let html = render(Card(CardProps {
        title: Some("Title".to_string()),
        footer: Some(rsx! { span { "F" } }),
        ..Default::default()
    }));
    for needle in [
        "hk-card",
        "hk-card-header",
        "hk-card-title",
        "hk-card-body",
        "hk-card-footer",
    ] {
        assert!(html.contains(needle), "missing {needle}: {html}");
    }
}

// ── W2b: advanced-input family ───────────────────────────────────────────

#[test]
fn number_input_renders_the_vue_shell() {
    let html = render(NumberInput(NumberInputProps::default()));
    assert!(html.contains("hk-number-input"), "{html}");
    assert!(html.contains("hk-number-input-inner"), "{html}");
}

#[test]
fn otp_input_publishes_the_size_ramp_font() {
    // The sheet's font chain reads `--hk-otp-fitted-font`; without a publish
    // every size falls back to the 1.25rem literal (R2c S1).
    let html = render(OtpInput(OtpInputProps {
        size: hikari_components::basic::OtpSize::Sm,
        ..Default::default()
    }));
    assert!(html.contains("--hk-otp-fitted-font:0.875rem"), "{html}");
    assert!(html.contains("hk-otp-sm"), "{html}");
}

#[test]
fn rolling_number_renders_slots() {
    let html = render(RollingNumber(RollingNumberProps {
        value: "42".to_string(),
        ..Default::default()
    }));
    assert!(html.contains("hk-rolling-number"), "{html}");
    assert!(html.contains("data-el"), "{html}");
}

#[test]
fn search_input_renders_icon_field_and_clear() {
    let html = render(SearchInput(SearchInputProps {
        model_value: "abc".to_string(),
        ..Default::default()
    }));
    for needle in [
        "hk-search-input",
        "hk-search-input-icon",
        "hk-search-input-field",
        "hk-search-input-clear",
    ] {
        assert!(html.contains(needle), "missing {needle}: {html}");
    }
}

#[test]
fn template_text_renders_chips() {
    let html = render(TemplateText(TemplateTextProps {
        content: "Hi {{name}}".to_string(),
        ..Default::default()
    }));
    assert!(html.contains("hk-template-text"), "{html}");
    assert!(html.contains("hk-tpl-chip"), "{html}");
}

#[test]
fn token_input_renders_the_value_trigger() {
    let html = render(TokenInput(TokenInputProps::default()));
    assert!(html.contains("hk-token-input"), "{html}");
    assert!(html.contains("hk-token-input-value"), "{html}");
}

#[test]
fn tag_input_renders_wrapper_and_box() {
    let html = render(TagInput(TagInputProps::default()));
    assert!(html.contains("hk-tag-input-wrapper"), "{html}");
    assert!(html.contains("hk-tag-input-box"), "{html}");
}

#[test]
fn date_tag_renders_the_tag() {
    let html = render(DateTag(DateTagProps {
        value: Some("2024-10-06".to_string()),
        ..Default::default()
    }));
    assert!(html.contains("hk-date-tag"), "{html}");
}

#[test]
fn date_picker_renders_the_trigger() {
    let html = render(DatePicker(DatePickerProps::default()));
    assert!(html.contains("hk-dp"), "{html}");
}

#[test]
fn date_time_picker_renders_the_trigger() {
    let html = render(DateTimePicker(DateTimePickerProps::default()));
    assert!(html.contains("hk-dtp"), "{html}");
}

#[test]
fn time_zone_globe_renders_the_globe_host() {
    let html = render(TimeZoneGlobe(TimeZoneGlobeProps::default()));
    assert!(html.contains("hk-timezone-globe"), "{html}");
    assert!(html.contains("<svg"), "{html}");
}

#[test]
fn slider_field_renders_slider_and_value() {
    let html = render(SliderField(SliderFieldProps::default()));
    assert!(html.contains("hk-slider-field"), "{html}");
    assert!(html.contains("hk-slider-fill"), "{html}");
}

#[test]
fn fab_renders_the_button() {
    let html = render(Fab(FabProps {
        aria_label: "Add".to_string(),
        ..Default::default()
    }));
    assert!(html.contains("hk-fab-button"), "{html}");
    assert!(html.contains("aria-label=\"Add\""), "{html}");
}

#[test]
fn file_field_renders_the_box() {
    let html = render(FileField(FileFieldProps::default()));
    assert!(html.contains("hk-file-field"), "{html}");
}

#[test]
fn file_picker_field_renders_the_row() {
    let html = render(FilePickerField(FilePickerFieldProps::default()));
    assert!(html.contains("hk-file-picker-field"), "{html}");
}

#[test]
fn file_browser_dialog_renders_nothing_when_closed() {
    let html = render(FileBrowserDialog(FileBrowserDialogProps::default()));
    assert!(
        html.is_empty() || !html.contains("hk-file-browser"),
        "{html}"
    );
}

#[test]
fn color_picker_renders_the_trigger() {
    let html = render(ColorPicker(ColorPickerProps::default()));
    assert!(html.contains("hk-color-picker"), "{html}");
}

#[test]
fn phone_input_renders_the_field() {
    let html = render(PhoneInput(PhoneInputProps::default()));
    assert!(html.contains("hk-phone-input"), "{html}");
}
