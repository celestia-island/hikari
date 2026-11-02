// hi-components/src/data/filter_trigger.rs
// FilterTrigger — mirror of the canonical Vue `HkFilterTrigger`: the header
// filter affordance. A ghost icon button on the chrome action ladder anchoring
// the `FilterPanel` in a popover on desktop and a bottom sheet on mobile
// (HkPopover `sheetOnMobile`).
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkFilterTrigger.scss`, vendored under
// `src/styles/vue-mirror/` and listed in `scripts/sync-vue-mirror.py`'s W3
// `DATA_SHEETS`), compiled with `no_hash` so every `.hk-filter-trigger*` class
// name is literal and identical in both forms. The active-filter marker (a
// green bottom-right dot while any condition carries a value, user direction
// 2026-10-15) is the generic `HkCornerBadge` wrapped around the button — its
// sheet owns the mark and IS mirrored (registered through
// `StyleRegistry::register_vue_chrome` as "vue-corner-badge").
//
// DOM contract (mirrors the Vue render output):
//
//   span.hk-filter-trigger               (style: position:relative — the layer's
//                                         containing block)
//     span.hk-corner-badge-anchor
//       button.hk-icon-button.hk-icon-button-{32|28}.hk-icon-button-ghost
//              type=button aria-label={label} aria-haspopup=dialog
//              aria-expanded [disabled] [data-active]
//         span.hk-icon-button-icon
//           span[style="display:contents"] > the funnel svg (16)
//       span.hk-corner-badge.hk-corner-badge-success.hk-corner-badge--dot
//              data-corner="bottom-right"
//              (style: --hk-corner-badge-offset) aria-hidden="true"   (active)
//     ── open only ──
//     div.hk-filter-trigger-body        (style: absolute layer geometry)
//       FilterPanel (fields / model / disabled / label + its pass-through state)
//       div.hk-filter-trigger-footer > button.hk-btn.hk-btn-primary.hk-btn-sm
//              {Apply}                                            (narrow only)
//
// Apply semantics (user direction 2026-09-29):
//   * desktop: NO confirm button — edits commit live and the panel is dismissed
//     by clicking out (the HOST owns outside-dismissal, see the deltas);
//   * mobile: ONE confirm button ("应用") that closes the sheet — deliberately
//     no cancel; clearing a condition is done by re-opening the panel and
//     emptying the value, never by a header reset verb.
//
// State contract (the tairitsu 0.5.22 limit this wave works under): Vue keeps
// `open` in a local ref and lets the panel own its own refs. The mirror takes
// the trigger's `open` as a CONTROLLED prop and passes the panel's controlled
// state straight through (`add_menu_open` / `add_highlight` / `open_row` +
// their handlers), so one host wiring drives both layers and the mirror stores
// nothing.
//
// Behaviour deltas vs Vue (documented, not accidental):
//   * no `<Teleport>` and no `HkPopover` mirror use: the body IS the layer —
//     its geometry rides the body's own inline style
//     (`filter_panel::filter_popup_layer_style`) against the trigger's
//     `position: relative` (which its own sheet already declares).
//   * the icon button is composed on the mirrored IconButton's DOM contract
//     (`.hk-icon-button.hk-icon-button-{size}.hk-icon-button-{variant}` +
//     `.hk-icon-button-icon`) instead of nested: Vue passes `aria-haspopup`,
//     `aria-expanded` and `data-active` through `{...attrs}`, and the mirrored
//     `basic::IconButton` has no arbitrary-attribute passthrough. The emitted
//     markup is the same one Vue produces.
//   * `useBreakpoint()` / `useChromeActionSize()` become the `narrow` prop: the
//     host reads `platform::inner_width() < 768` and passes it, which keeps the
//     render pure and testable. `narrow` drives BOTH the chrome step (ghost/28
//     instead of ghost/32) and the mobile confirm footer, exactly the two
//     places Vue reads the breakpoint.
//   * no outside-click close and no auto-flip/viewport clamp: those need a
//     document-level listener and the MEASURED panel box (Vue's popup manager);
//     tairitsu 0.5.22 has neither, so the HOST owns outside dismissal and passes
//     a `Top*` placement for a trigger in the bottom band.

use hikari_i18n::t;

use crate::basic::button::{Button, ButtonProps, ButtonSize, ButtonVariant};
use crate::basic::icon_button::IconButtonSize;
use crate::data::filter_panel::{
    AddMenuState, FilterFieldDef, FilterPanel, FilterPanelProps, FilterState,
    filter_popup_layer_style, glyph_host,
};
use crate::feedback::popover::PopoverPlacement;
use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct FilterTriggerComponent;

/// The funnel glyph at `size={16}` (Vue imports lucide's `Filter`, which is
/// lucide 1.0's `funnel` — the icon node below is that icon's path verbatim).
pub const FILTER_TRIGGER_GLYPH_SVG: &str = r#"<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-funnel" aria-hidden="true"><path d="M10 20a1 1 0 0 0 .553.895l2 1A1 1 0 0 0 14 21v-7a2 2 0 0 1 .517-1.341L21.74 4.67A1 1 0 0 0 21 3H3a1 1 0 0 0-.742 1.67l7.225 7.989A2 2 0 0 1 10 14z"/></svg>"#;

/// The corner mark's clearance from the corner in px (Vue: `offset={1}`).
pub const FILTER_TRIGGER_CORNER_OFFSET: u32 = 1;

// ── pure functions ───────────────────────────────────────────────────────

/// Whether ANY condition carries a value (Vue: the `active` computed — the green
/// dot's condition). Undeclared keys still count: a page that renamed a field
/// under live state must not lose the marker.
pub fn filter_trigger_has_active(state: &FilterState) -> bool {
    state.iter().any(|cond| !cond.value.is_empty())
}

/// The chrome action ladder (Vue: `useChromeActionSize()` — ghost/32 wide,
/// ghost/28 narrow, the same step as the global search and settings buttons).
pub fn filter_trigger_chrome_size(narrow: bool) -> IconButtonSize {
    if narrow {
        IconButtonSize::S28
    } else {
        IconButtonSize::S32
    }
}

/// The trigger button's class list in the mirror's order (`hk-icon-button`, the
/// size step, the variant step).
pub fn filter_trigger_button_classes(narrow: bool) -> String {
    format!(
        "hk-icon-button {} hk-icon-button-ghost",
        filter_trigger_chrome_size(narrow).class_name()
    )
}

/// The corner mark's class list (Vue: HkCornerBadge in its dot form, success
/// tone, bottom-right corner).
pub fn filter_trigger_corner_badge_classes() -> &'static str {
    "hk-corner-badge hk-corner-badge-success hk-corner-badge--dot"
}

/// The corner mark's clearance token (Vue:
/// `style={{ "--hk-corner-badge-offset": `${offset}px` }}`).
pub fn filter_trigger_corner_offset_style(offset: u32) -> String {
    format!("--hk-corner-badge-offset:{offset}px")
}

/// The mobile confirm footer exists only on the narrow form factor (Vue:
/// `isMobile.value &&` around the footer).
pub fn filter_trigger_shows_footer(narrow: bool) -> bool {
    narrow
}

// ── the component ────────────────────────────────────────────────────────

#[define_props]
pub struct FilterTriggerProps {
    /// The page's declared fields (Vue: `fields`, required).
    pub fields: Vec<FilterFieldDef>,

    /// The condition state — the panel edits it live (Vue: `modelValue`).
    pub model_value: FilterState,

    #[default]
    pub disabled: bool,

    /// Accessible name / sheet title (Vue default: the localized "Filters").
    pub label: Option<String>,

    /// Layer placement against the trigger (Vue default `"bottom-end"`).
    #[default(PopoverPlacement::BottomEnd)]
    pub placement: PopoverPlacement,

    /// Vue's `useBreakpoint().isMobile` stand-in: the host passes
    /// `platform::inner_width() < 768`. Drives the chrome step AND the footer.
    #[default]
    pub narrow: bool,

    // ── controlled state (Vue keeps the trigger's open in a local ref) ────
    #[default]
    pub open: bool,

    // ── the panel's controlled state, passed straight through ────────────
    /// The panel's add-condition chooser (Vue: the panel's own `addMenuOpen`).
    #[default]
    pub add_menu_open: bool,

    /// The chooser's highlighted row (Vue: the panel's `addHighlight`).
    #[default(-1)]
    pub add_highlight: i32,

    /// The panel row whose popup control is open (see `FilterPanel`).
    pub open_row: Option<u32>,

    // ── events ───────────────────────────────────────────────────────────
    /// Fires with the desired open state (Vue: the local `open` writes).
    pub on_open_change: Option<EventHandler<bool>>,

    /// Fires with the next condition state (Vue: `update:modelValue`).
    pub on_value_change: Option<EventHandler<FilterState>>,

    /// Fires with the next chooser state (the panel's pass-through).
    pub on_add_menu_change: Option<EventHandler<AddMenuState>>,

    /// Fires with the panel row whose popup should open (the pass-through).
    pub on_open_row_change: Option<EventHandler<Option<u32>>>,
}

#[component]
pub fn FilterTrigger(props: FilterTriggerProps) -> Element {
    let label = props
        .label
        .clone()
        .unwrap_or_else(|| t("components.hk.filterBar.trigger", "Filters"));
    let active = filter_trigger_has_active(&props.model_value);
    let open = props.open;

    let on_open_change = props.on_open_change.clone();
    let mut button = VElement::new("button")
        .class(filter_trigger_button_classes(props.narrow))
        .attr("type", "button")
        .attr("aria-label", label.clone())
        .attr("aria-haspopup", "dialog")
        .attr("aria-expanded", if open { "true" } else { "false" })
        .on_click(move |_event: MouseEvent| {
            if let Some(handler) = on_open_change.as_ref() {
                handler.call(!open);
            }
        })
        .child(rsx! {
            span { class: "hk-icon-button-icon", {glyph_host(FILTER_TRIGGER_GLYPH_SVG)} }
        });
    if props.disabled {
        button = button.attr("disabled", "");
    }
    if active {
        // Vue: `data-active={active.value || undefined}` — presence only.
        button = button.attr("data-active", "");
    }

    let mut anchor = VElement::new("span")
        .class("hk-corner-badge-anchor")
        .child(VNode::Element(Box::new(button)));
    if active {
        anchor = anchor.child(VNode::Element(Box::new(
            VElement::new("span")
                .class(filter_trigger_corner_badge_classes())
                .attr("data-corner", "bottom-right")
                .style(filter_trigger_corner_offset_style(
                    FILTER_TRIGGER_CORNER_OFFSET,
                ))
                .attr("aria-hidden", "true"),
        )));
    }

    let mut root = VElement::new("span")
        .class("hk-filter-trigger")
        .style("position:relative")
        .child(VNode::Element(Box::new(anchor)));

    if props.open {
        let panel = FilterPanel(FilterPanelProps {
            fields: props.fields.clone(),
            model_value: props.model_value.clone(),
            disabled: props.disabled,
            label: Some(label.clone()),
            add_menu_open: props.add_menu_open,
            add_highlight: props.add_highlight,
            open_row: props.open_row,
            on_value_change: props.on_value_change.clone(),
            on_add_menu_change: props.on_add_menu_change.clone(),
            on_open_row_change: props.on_open_row_change.clone(),
        });
        let mut body = VElement::new("div")
            .class("hk-filter-trigger-body")
            .style(filter_popup_layer_style(props.placement, 6.0))
            .child(panel);

        if filter_trigger_shows_footer(props.narrow) {
            let apply_label = t("components.hk.filterBar.apply", "Apply");
            let close_handler = props.on_open_change.clone();
            let apply = Button(ButtonProps {
                variant: ButtonVariant::Primary,
                size: ButtonSize::Sm,
                disabled: props.disabled,
                children: VNode::Text(VText::new(&apply_label)),
                // The sheet's ONE button: confirm = close (edits are already
                // live). No cancel — clearing rides inside the panel.
                onclick: Some(EventHandler::new(move |_event: MouseEvent| {
                    if let Some(handler) = close_handler.as_ref() {
                        handler.call(false);
                    }
                })),
                ..Default::default()
            });
            body = body.child(rsx! {
                div { class: "hk-filter-trigger-footer",
                    {apply}
                }
            });
        }

        root = root.child(VNode::Element(Box::new(body)));
    }

    VNode::Element(Box::new(root))
}

impl StyledComponent for FilterTriggerComponent {
    fn styles() -> &'static str {
        // The canonical Vue sheet, compiled verbatim (no_hash keeps the
        // `.hk-filter-trigger*` names literal so this CSS matches the Vue build).
        // The corner mark's tone rules live in the mirrored HkCornerBadge sheet,
        // registered separately ("vue-corner-badge"), exactly like
        // `basic::IconButton`'s status dot.
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkFilterTrigger.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "filter-trigger"
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::data::filter_panel::{FilterCondition, FilterFieldKind, FilterOperator};

    fn field(key: &str) -> FilterFieldDef {
        FilterFieldDef {
            key: key.to_string(),
            label: key.to_uppercase(),
            kind: FilterFieldKind::Text,
            ..Default::default()
        }
    }

    fn cond(key: &str, value: &str) -> FilterCondition {
        FilterCondition {
            key: key.to_string(),
            op: FilterOperator::Approx,
            value: value.to_string(),
        }
    }

    #[test]
    fn filter_trigger_defaults_match_the_vue_props() {
        let props = FilterTriggerProps::default();
        assert!(props.fields.is_empty());
        assert!(props.model_value.is_empty());
        assert!(!props.disabled);
        assert_eq!(props.label, None);
        // Vue default: "bottom-end".
        assert_eq!(props.placement, PopoverPlacement::BottomEnd);
        assert!(!props.narrow);
        assert!(!props.open);
        assert!(!props.add_menu_open);
        assert_eq!(props.add_highlight, -1);
        assert_eq!(props.open_row, None);
        assert!(props.on_open_change.is_none());
        assert!(props.on_value_change.is_none());
        assert!(props.on_add_menu_change.is_none());
        assert!(props.on_open_row_change.is_none());
    }

    #[test]
    fn filter_trigger_active_marker_needs_a_valued_condition() {
        assert!(!filter_trigger_has_active(&Vec::new()));
        assert!(!filter_trigger_has_active(&vec![cond("name", "")]));
        assert!(filter_trigger_has_active(&vec![cond("name", "香蕉")]));
        // An undeclared key still marks the trigger (the page renamed a field).
        assert!(filter_trigger_has_active(&vec![cond("legacy", "x")]));
    }

    #[test]
    fn filter_trigger_chrome_ladder_matches_the_breakpoint() {
        // Vue: useChromeActionSize — ghost/32 wide, ghost/28 narrow.
        assert_eq!(filter_trigger_chrome_size(false), IconButtonSize::S32);
        assert_eq!(filter_trigger_chrome_size(true), IconButtonSize::S28);
        assert_eq!(
            filter_trigger_button_classes(false),
            "hk-icon-button hk-icon-button-32 hk-icon-button-ghost"
        );
        assert_eq!(
            filter_trigger_button_classes(true),
            "hk-icon-button hk-icon-button-28 hk-icon-button-ghost"
        );
    }

    #[test]
    fn filter_trigger_corner_mark_uses_the_shared_badge_grammar() {
        // Vue: HkCornerBadge dot form, success tone, bottom-right corner,
        // offset 1 — the same component every corner indicator uses.
        assert_eq!(
            filter_trigger_corner_badge_classes(),
            "hk-corner-badge hk-corner-badge-success hk-corner-badge--dot"
        );
        assert_eq!(
            filter_trigger_corner_offset_style(FILTER_TRIGGER_CORNER_OFFSET),
            "--hk-corner-badge-offset:1px"
        );
        assert_eq!(FILTER_TRIGGER_CORNER_OFFSET, 1);
    }

    #[test]
    fn filter_trigger_footer_belongs_to_the_narrow_form_factor() {
        // Vue: no confirm on desktop, ONE confirm on mobile.
        assert!(!filter_trigger_shows_footer(false));
        assert!(filter_trigger_shows_footer(true));
    }

    #[test]
    fn filter_trigger_styles_come_from_the_canonical_vue_sheet() {
        let css = FilterTriggerComponent::styles();
        for class in [".hk-filter-trigger", ".hk-filter-trigger-footer"] {
            assert!(
                css.contains(class),
                "filter-trigger css must carry the vue class {class:?}"
            );
        }
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored filter-trigger sheet"
        );
        // The active marker's tones are HkCornerBadge's sheet, not this one.
        assert!(
            !css.contains("hk-corner-badge--dot"),
            "the corner mark's sheet is registered separately — see the header"
        );
    }

    #[test]
    fn filter_trigger_render_contract() {
        let html = FilterTrigger(FilterTriggerProps {
            fields: vec![field("name")],
            label: Some("Filters".to_string()),
            ..Default::default()
        })
        .render_to_html();

        for needle in [
            // The anchored root (the layer's containing block).
            "class=\"hk-filter-trigger\"",
            "position:relative",
            // The corner-badge anchor + the chrome button.
            "hk-corner-badge-anchor",
            "hk-icon-button hk-icon-button-32 hk-icon-button-ghost",
            "aria-label=\"Filters\"",
            "aria-haspopup=\"dialog\"",
            "aria-expanded=\"false\"",
            // The glyph rides the icon box on a boxless host.
            "hk-icon-button-icon",
            "lucide lucide-funnel",
            "display:contents",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        // Collapsed + inactive: no dot, no panel, no footer.
        assert!(!html.contains("hk-corner-badge--dot"), "{html}");
        assert!(!html.contains("data-active"), "{html}");
        assert!(!html.contains("hk-filter-trigger-body"), "{html}");
        assert!(!html.contains("hk-filter-panel"), "{html}");
        assert!(!html.contains("hk-filter-trigger-footer"), "{html}");
        assert!(!html.contains("disabled"), "{html}");
    }

    #[test]
    fn filter_trigger_render_marks_the_active_state() {
        let html = FilterTrigger(FilterTriggerProps {
            fields: vec![field("name")],
            model_value: vec![cond("name", "香蕉")],
            ..Default::default()
        })
        .render_to_html();
        // The green dot sits at the button's bottom-right corner.
        assert!(
            html.contains("hk-corner-badge hk-corner-badge-success hk-corner-badge--dot"),
            "{html}"
        );
        assert!(html.contains("data-corner=\"bottom-right\""), "{html}");
        assert!(html.contains("--hk-corner-badge-offset:1px"), "{html}");
        assert!(html.contains("aria-hidden=\"true\""), "{html}");
        assert!(html.contains("data-active"), "{html}");
    }

    #[test]
    fn filter_trigger_open_narrow_renders_the_panel_and_confirm() {
        let html = FilterTrigger(FilterTriggerProps {
            fields: vec![field("name")],
            model_value: vec![cond("name", "香蕉")],
            narrow: true,
            open: true,
            ..Default::default()
        })
        .render_to_html();

        for needle in [
            "aria-expanded=\"true\"",
            // Narrow chrome step.
            "hk-icon-button-28",
            // The body IS the layer (no Teleport, no popover wrapper).
            // Bottom-end placement: below the trigger, anchored on its far edge.
            "class=\"hk-filter-trigger-body\"",
            "position:absolute",
            "top:calc(100% + 6px)",
            "right:0",
            // The panel rides inside, fully wired.
            "hk-filter-panel",
            "data-testid=\"hk-filter-panel\"",
            "hk-filter-panel-row",
            "hk-filter-panel-add",
            // The sheet's ONE confirm button.
            "hk-filter-trigger-footer",
            "hk-btn hk-btn-primary hk-btn-sm",
            ">Apply<",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
    }

    #[test]
    fn filter_trigger_open_wide_has_no_confirm_button() {
        let html = FilterTrigger(FilterTriggerProps {
            fields: vec![field("name")],
            open: true,
            ..Default::default()
        })
        .render_to_html();
        // Desktop: NO confirm button — edits commit live.
        assert!(html.contains("hk-filter-trigger-body"), "{html}");
        assert!(html.contains("hk-filter-panel"), "{html}");
        assert!(!html.contains("hk-filter-trigger-footer"), "{html}");
        assert!(!html.contains(">Apply<"), "{html}");
    }
}
