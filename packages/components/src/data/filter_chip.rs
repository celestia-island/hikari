// hi-components/src/data/filter_chip.rs
// FilterChip — mirror of the canonical Vue `HkFilterChip`: the FACET member of
// the filter family. A chip trigger opens a popover (desktop) / bottom sheet
// (mobile, via HkPopover's `sheetOnMobile`) holding an `HkPillToggleGroup`
// multi-select — the 水表查询 filter-bar grammar.
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkFilterChip.scss`, vendored under
// `src/styles/vue-mirror/` and listed in `scripts/sync-vue-mirror.py`'s W3
// `DATA_SHEETS`), compiled with `no_hash` so every `.hk-filter-chip*` class
// name is literal and identical in both forms.
//
// DOM contract (mirrors the Vue render output):
//
//   span.hk-filter-chip-anchor          (style: position:relative — the layer's
//                                        containing block)
//     button.hk-filter-chip [.hk-filter-chip--on] type=button
//            aria-haspopup=dialog aria-expanded aria-label title
//       span.hk-filter-chip-text {chip text}
//       span[style="display:contents"] > the ▾ svg (class hk-filter-chip-caret)
//     ── open only ──
//     div.hk-filter-chip-body           (style: absolute layer geometry)
//       div.hk-pill-group role=group aria-label={label}
//         button.hk-pill-group-pill [data-active] aria-pressed  {allLabel}
//         button.hk-pill-group-pill [data-active] aria-pressed  {option.label}
//              [span.hk-pill-group-icon]     (option with a glyph)
//       div.hk-filter-chip-hint {hint}    (hint)
//
// Semantics ride the thin group contract: `toggle(value)` reports one option
// toggled, `all()` reports the all-pill — the HOST decides whether all means
// clear or select-everything. The chip label mirrors the selection: the
// all-label when nothing is picked, otherwise the picked labels in canonical
// option order (capped at three plus a `+N` tail, so a wide facet cannot blow
// up the chip strip's width).
//
// State contract (the tairitsu 0.5.22 limit this wave works under): `selected`
// is the single source of truth and is never mutated here; `open` is already a
// CONTROLLED Vue prop here (Vue emits `update:open`) and stays one, so the
// mirror stores nothing at all.
//
// Behaviour deltas vs Vue (documented, not accidental):
//   * no `<Teleport>` and no `HkPopover` mirror use: the popup body IS the
//     layer — its geometry rides the body's own inline style
//     (`filter_popup_layer_style`) against the anchor's `position: relative`,
//     so no invented wrapper class is needed and the host's stacking context
//     decides the paint order (Vue reads its z from `usePopupManager`).
//   * no mobile bottom-sheet branch: `sheetOnMobile` is a viewport-driven
//     presentation Vue gets free from HkPopover; the mirror keeps the anchored
//     layer and the HOST decides the form factor (the sheet geometry lives in
//     `HkPopover.scss`, which is not this component's table).
//   * The pill group's own sheet (`HkPillToggleGroup.scss`) IS vendored and
//     registered as chrome (`vue-pill-toggle-group`), so the emitted
//     `.hk-pill-group*` classes paint; this component's own `styles()` table
//     stays separate (the group is a shared chrome sheet, like HkCornerBadge).
//   * `selected` is a `Vec<String>` (Vue: a `Set`); membership is what the
//     contract needs, and a Vec keeps the prop deterministic + comparable.
//   * `icon` is an `Element` slot (Vue resolves a component/name through
//     `HkPillToggleGroup`'s `resolveIcon`).

use crate::data::filter_panel::{filter_popup_layer_style, glyph_host};
use crate::feedback::popover::PopoverPlacement;
use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct FilterChipComponent;

/// The ▾ caret glyph (lucide `ChevronDown` at `size={12}`; the sheet's
/// `.hk-filter-chip-caret` owns its opacity/box).
pub const FILTER_CHIP_CARET_SVG: &str = r#"<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide hk-filter-chip-caret lucide-chevron-down" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>"#;

/// How many picked labels the chip prints before collapsing the rest into a
/// `+N` tail (Vue hard-codes 3).
pub const FILTER_CHIP_LABEL_CAP: usize = 3;

/// One facet value (Vue: `HkPillToggleGroupOption`).
#[derive(Clone, PartialEq, Debug, Default)]
pub struct FilterChipOption {
    /// Stable identity — the value emitted back through `toggle`.
    pub value: String,
    pub label: String,
    /// Optional leading glyph (Vue resolves a component/name).
    pub icon: Option<Element>,
}

// ── pure functions ───────────────────────────────────────────────────────

/// The picked options in CANONICAL display order (Vue: `picked` — the chip
/// label's source mirrors the option order, not the set's insertion order).
pub fn filter_chip_picked<'a>(
    options: &'a [FilterChipOption],
    selected: &[String],
) -> Vec<&'a FilterChipOption> {
    options
        .iter()
        .filter(|option| selected.contains(&option.value))
        .collect()
}

/// The chip's visible text (Vue: `chipText`): the all-label when nothing is
/// picked, otherwise up to [`FILTER_CHIP_LABEL_CAP`] picked labels joined with
/// ", " plus a ` +N` tail.
pub fn filter_chip_text(
    options: &[FilterChipOption],
    selected: &[String],
    all_label: &str,
) -> String {
    let picked = filter_chip_picked(options, selected);
    if picked.is_empty() {
        return all_label.to_string();
    }
    let names: Vec<&str> = picked.iter().map(|option| option.label.as_str()).collect();
    let head = names
        .iter()
        .take(FILTER_CHIP_LABEL_CAP)
        .copied()
        .collect::<Vec<&str>>()
        .join(", ");
    let rest = names.len().saturating_sub(FILTER_CHIP_LABEL_CAP);
    if rest > 0 {
        format!("{head} +{rest}")
    } else {
        head
    }
}

/// The trigger's accessible name (Vue: `picked.length > 0 ? "label: chipText"
/// : label` — the category alone would mask the selection mirror).
pub fn filter_chip_aria_label(
    label: &str,
    options: &[FilterChipOption],
    selected: &[String],
    all_label: &str,
) -> String {
    if filter_chip_picked(options, selected).is_empty() {
        return label.to_string();
    }
    format!(
        "{label}: {}",
        filter_chip_text(options, selected, all_label)
    )
}

/// Whether the chip wears the active face (Vue: `selected.size > 0`).
pub fn filter_chip_is_on(selected: &[String]) -> bool {
    !selected.is_empty()
}

/// Whether the leading all-pill is the active one (Vue: `selected.size === 0`;
/// nothing picked means "all" wears the active tint).
pub fn filter_chip_all_pressed(selected: &[String]) -> bool {
    selected.is_empty()
}

/// The host-side selection after one pill toggle (Vue leaves the set to the
/// host; this is the mirror of its `new Set` toggle/delete pair so hosts do not
/// have to re-derive it).
pub fn filter_chip_toggled(selected: &[String], value: &str) -> Vec<String> {
    let mut next: Vec<String> = selected
        .iter()
        .filter(|current| current.as_str() != value)
        .cloned()
        .collect();
    if !selected.iter().any(|current| current == value) {
        next.push(value.to_string());
    }
    next
}

// ── the component ────────────────────────────────────────────────────────

#[define_props]
pub struct FilterChipProps {
    /// Popup title + the trigger's accessible name (the category).
    pub label: String,

    /// Chip text with nothing picked, and the all-pill's label.
    pub all_label: String,

    /// Facet values in canonical display order (also the chip-label order).
    pub options: Vec<FilterChipOption>,

    /// The picked values — single source of truth, never mutated here.
    pub selected: Vec<String>,

    /// Popup visibility (Vue: the `open` prop + `update:open` emit).
    #[default]
    pub open: bool,

    /// Layer placement against the anchor (Vue default `"bottom-start"`).
    #[default(PopoverPlacement::BottomStart)]
    pub placement: PopoverPlacement,

    /// Bottom hint line below the pill group. Host-provided on purpose: the
    /// facet's semantics (multi-select? radio? clears what?) are the host's
    /// story to tell.
    pub hint: Option<String>,

    /// Fires with the desired open state (Vue: `update:open`).
    pub on_open_change: Option<EventHandler<bool>>,

    /// Fires with the toggled option value (Vue: `toggle`).
    pub on_toggle: Option<EventHandler<String>>,

    /// Fires when the all-pill is activated (Vue: `all`).
    pub on_all: Option<EventHandler<()>>,
}

#[component]
pub fn FilterChip(props: FilterChipProps) -> Element {
    let selected = props.selected.clone();
    let on = filter_chip_is_on(&selected);
    let chip_text = filter_chip_text(&props.options, &selected, &props.all_label);
    let aria_label =
        filter_chip_aria_label(&props.label, &props.options, &selected, &props.all_label);

    let mut classes = String::from("hk-filter-chip");
    if on {
        classes.push_str(" hk-filter-chip--on");
    }

    let open_handler = props.on_open_change.clone();
    let open = props.open;
    let mut chip = VElement::new("button")
        .class(classes)
        .attr("type", "button")
        .attr("aria-haspopup", "dialog")
        .attr("aria-expanded", if open { "true" } else { "false" })
        .attr("aria-label", aria_label)
        .attr("title", props.label.clone())
        .on_click(move |_event: MouseEvent| {
            if let Some(handler) = open_handler.as_ref() {
                handler.call(!open);
            }
        })
        .child(rsx! {
            span { class: "hk-filter-chip-text", "{chip_text}" }
        })
        .child(glyph_host(FILTER_CHIP_CARET_SVG));

    let mut anchor = VElement::new("span")
        .class("hk-filter-chip-anchor")
        .style("position:relative")
        .child(VNode::Element(Box::new(chip)));

    if props.open {
        anchor = anchor.child(popup_body(&props));
    }

    VNode::Element(Box::new(anchor))
}

/// The popup body: the pill group, plus the host's hint line.
fn popup_body(props: &FilterChipProps) -> VNode {
    let mut group = VElement::new("div")
        .class("hk-pill-group")
        .attr("role", "group")
        .attr("aria-label", props.label.clone());

    // The leading all-pill wears the active tint exactly when nothing is picked.
    let all_pressed = filter_chip_all_pressed(&props.selected);
    let on_all = props.on_all.clone();
    let mut all_pill = VElement::new("button")
        .class("hk-pill-group-pill")
        .attr("type", "button")
        .attr("aria-pressed", if all_pressed { "true" } else { "false" })
        .on_click(move |_event: MouseEvent| {
            if let Some(handler) = on_all.as_ref() {
                handler.call(());
            }
        })
        .child(VNode::Text(VText::new(props.all_label.as_str())));
    if all_pressed {
        all_pill = all_pill.attr("data-active", "");
    }
    group = group.child(VNode::Element(Box::new(all_pill)));

    for option in &props.options {
        let active = props.selected.contains(&option.value);
        let on_toggle = props.on_toggle.clone();
        let value = option.value.clone();
        let mut pill = VElement::new("button")
            .class("hk-pill-group-pill")
            .attr("type", "button")
            .attr("aria-pressed", if active { "true" } else { "false" })
            .on_click(move |_event: MouseEvent| {
                if let Some(handler) = on_toggle.as_ref() {
                    handler.call(value.clone());
                }
            });
        if let Some(icon) = option.icon.clone() {
            pill = pill.child(rsx! {
                span { class: "hk-pill-group-icon", {icon} }
            });
        }
        pill = pill.child(rsx! {
            {VNode::Text(VText::new(option.label.as_str()))}
        });
        if active {
            pill = pill.attr("data-active", "");
        }
        group = group.child(VNode::Element(Box::new(pill)));
    }

    let mut body = VElement::new("div")
        .class("hk-filter-chip-body")
        .style(filter_popup_layer_style(props.placement, 6.0))
        .child(VNode::Element(Box::new(group)));
    if let Some(hint) = props.hint.clone() {
        body = body.child(rsx! {
            div { class: "hk-filter-chip-hint", "{hint}" }
        });
    }
    VNode::Element(Box::new(body))
}

impl StyledComponent for FilterChipComponent {
    fn styles() -> &'static str {
        // The canonical Vue sheet, compiled verbatim (no_hash keeps the
        // `.hk-filter-chip*` names literal so this CSS matches the Vue build).
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkFilterChip.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "filter-chip"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn options() -> Vec<FilterChipOption> {
        vec![
            FilterChipOption {
                value: "deepseek".to_string(),
                label: "DeepSeek".to_string(),
                icon: None,
            },
            FilterChipOption {
                value: "openai".to_string(),
                label: "OpenAI".to_string(),
                icon: None,
            },
            FilterChipOption {
                value: "anthropic".to_string(),
                label: "Anthropic".to_string(),
                icon: None,
            },
            FilterChipOption {
                value: "mistral".to_string(),
                label: "Mistral".to_string(),
                icon: None,
            },
        ]
    }

    fn selected(values: &[&str]) -> Vec<String> {
        values.iter().map(|value| value.to_string()).collect()
    }

    #[test]
    fn filter_chip_defaults_match_the_vue_props() {
        let props = FilterChipProps::default();
        assert_eq!(props.label, "");
        assert_eq!(props.all_label, "");
        assert!(props.options.is_empty());
        assert!(props.selected.is_empty());
        assert!(!props.open);
        // Vue default: "bottom-start".
        assert_eq!(props.placement, PopoverPlacement::BottomStart);
        assert_eq!(props.hint, None);
        assert!(props.on_open_change.is_none());
        assert!(props.on_toggle.is_none());
        assert!(props.on_all.is_none());
    }

    #[test]
    fn filter_chip_picks_keep_the_canonical_option_order() {
        // The Set's insertion order must NOT leak into the label: mistral was
        // picked first, deepseek last, yet the canonical order decides.
        let option_list = options();
        let picked_values = selected(&["mistral", "deepseek"]);
        let picked = filter_chip_picked(&option_list, &picked_values);
        assert_eq!(
            picked
                .iter()
                .map(|option| option.label.as_str())
                .collect::<Vec<_>>(),
            vec!["DeepSeek", "Mistral"]
        );
        // Unknown values are simply not picked.
        let none = selected(&["nope"]);
        assert!(filter_chip_picked(&option_list, &none).is_empty());
    }

    #[test]
    fn filter_chip_text_falls_back_to_the_all_label() {
        let options = options();
        assert_eq!(
            filter_chip_text(&options, &[], "All providers"),
            "All providers"
        );
        assert_eq!(
            filter_chip_text(&options, &selected(&["openai"]), "All providers"),
            "OpenAI"
        );
        // Several picks join with ", " in canonical order.
        assert_eq!(
            filter_chip_text(&options, &selected(&["anthropic", "openai"]), "All"),
            "OpenAI, Anthropic"
        );
    }

    #[test]
    fn filter_chip_text_caps_the_tail_at_three_plus_n() {
        let options = options();
        // Exactly the cap: no tail.
        assert_eq!(
            filter_chip_text(
                &options,
                &selected(&["deepseek", "openai", "anthropic"]),
                "All"
            ),
            "DeepSeek, OpenAI, Anthropic"
        );
        // One past the cap: the fourth collapses into "+1".
        assert_eq!(
            filter_chip_text(
                &options,
                &selected(&["deepseek", "openai", "anthropic", "mistral"]),
                "All"
            ),
            "DeepSeek, OpenAI, Anthropic +1"
        );
    }

    #[test]
    fn filter_chip_aria_label_mirrors_the_selection() {
        let options = options();
        // Nothing picked: the category alone.
        assert_eq!(
            filter_chip_aria_label("Provider", &options, &[], "All providers"),
            "Provider"
        );
        // Picked: "category: chip text" — the mirror must stay audible.
        assert_eq!(
            filter_chip_aria_label(
                "Provider",
                &options,
                &selected(&["deepseek", "openai", "anthropic", "mistral"]),
                "All providers"
            ),
            "Provider: DeepSeek, OpenAI, Anthropic +1"
        );
    }

    #[test]
    fn filter_chip_active_faces_match_the_vue_flags() {
        assert!(!filter_chip_is_on(&[]));
        assert!(filter_chip_is_on(&selected(&["openai"])));
        // Nothing picked = the all-pill wears the active tint.
        assert!(filter_chip_all_pressed(&[]));
        assert!(!filter_chip_all_pressed(&selected(&["openai"])));
    }

    #[test]
    fn filter_chip_toggled_adds_and_removes_one_value() {
        assert_eq!(filter_chip_toggled(&[], "openai"), selected(&["openai"]));
        assert_eq!(
            filter_chip_toggled(&selected(&["openai"]), "openai"),
            Vec::<String>::new()
        );
        // Untouched neighbours survive.
        assert_eq!(
            filter_chip_toggled(&selected(&["openai", "mistral"]), "mistral"),
            selected(&["openai"])
        );
    }

    #[test]
    fn filter_chip_styles_come_from_the_canonical_vue_sheet() {
        let css = FilterChipComponent::styles();
        for class in [
            ".hk-filter-chip-anchor",
            ".hk-filter-chip",
            ".hk-filter-chip--on",
            ".hk-filter-chip-caret",
            ".hk-filter-chip-body",
            ".hk-filter-chip-body",
            ".hk-filter-chip-hint",
        ] {
            assert!(
                css.contains(class),
                "filter-chip css must carry the vue class {class:?}"
            );
        }
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored filter-chip sheet"
        );
        // The pill group lives in the shared chrome registration, not in this
        // component's own table.
        assert!(
            !css.contains(".hk-pill-group"),
            "the pill group chrome belongs to `vue-pill-toggle-group`, not here"
        );
    }

    #[test]
    fn filter_chip_render_contract() {
        let html = FilterChip(FilterChipProps {
            label: "Provider".to_string(),
            all_label: "All providers".to_string(),
            options: options(),
            selected: selected(&["openai"]),
            ..Default::default()
        })
        .render_to_html();

        for needle in [
            // The anchor is the positioned host for the layer.
            "class=\"hk-filter-chip-anchor\"",
            "position:relative",
            // The trigger's chrome + disclosure contract.
            "class=\"hk-filter-chip hk-filter-chip--on\"",
            "type=\"button\"",
            "aria-haspopup=\"dialog\"",
            "aria-expanded=\"false\"",
            "aria-label=\"Provider: OpenAI\"",
            "title=\"Provider\"",
            // The chip text + the caret's boxless host.
            "hk-filter-chip-text",
            ">OpenAI<",
            "hk-filter-chip-caret",
            "display:contents",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        // Closed: the popup body does not render at all (Vue's HkPopover).
        assert!(!html.contains("hk-filter-chip-body"), "{html}");
        assert!(!html.contains("hk-pill-group"), "{html}");
    }

    #[test]
    fn filter_chip_render_opens_the_pill_group_and_hint() {
        let html = FilterChip(FilterChipProps {
            label: "Provider".to_string(),
            all_label: "All providers".to_string(),
            options: options(),
            selected: selected(&["anthropic"]),
            open: true,
            hint: Some("Multi-select hint line".to_string()),
            ..Default::default()
        })
        .render_to_html();

        for needle in [
            "aria-expanded=\"true\"",
            // The body IS the layer (no Teleport, no popover wrapper).
            "class=\"hk-filter-chip-body\"",
            "position:absolute",
            "top:calc(100% + 6px)",
            // The thin group contract.
            "class=\"hk-pill-group\"",
            "role=\"group\"",
            "aria-label=\"Provider\"",
            "hk-pill-group-pill",
            // Nothing-selected? No: one pill is pressed, the all-pill is not.
            "aria-pressed=\"true\"",
            "data-active",
            // The hint line below the group.
            "hk-filter-chip-hint",
            "Multi-select hint line",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        // The all-pill plus one pill per option.
        assert_eq!(html.matches("hk-pill-group-pill").count(), 5, "{html}");
        // Exactly one pill is active (the picked one).
        assert_eq!(html.matches("data-active").count(), 1, "{html}");
    }

    #[test]
    fn filter_chip_render_marks_the_all_pill_when_nothing_is_picked() {
        let html = FilterChip(FilterChipProps {
            label: "Provider".to_string(),
            all_label: "All providers".to_string(),
            options: options(),
            open: true,
            ..Default::default()
        })
        .render_to_html();
        // The trigger text falls back to the all-label and stays off-face.
        assert!(html.contains(">All providers<"), "{html}");
        assert!(!html.contains("hk-filter-chip--on"), "{html}");
        assert!(html.contains("aria-label=\"Provider\""), "{html}");
        // The all-pill carries the active tint, the options do not.
        assert_eq!(html.matches("data-active").count(), 1, "{html}");
        assert_eq!(html.matches("aria-pressed=\"true\"").count(), 1, "{html}");
    }
}
