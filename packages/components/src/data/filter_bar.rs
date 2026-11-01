// hi-components/src/data/filter_bar.rs
// FilterBar — mirror of the canonical Vue `HkFilterBar`: the standard filter
// strip for list/table pages, in its two standardized shapes.
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkFilterBar.scss`, vendored under
// `src/styles/vue-mirror/` and listed in `scripts/sync-vue-mirror.py`'s W3
// `DATA_SHEETS`), compiled with `no_hash` so every `.hk-filter-bar*` class name
// is literal and identical in both forms.
//
// Two standardized shapes (a page picks one; hand-rolled rows of inputs are
// retired in favor of this):
//   * `inline` (default) — the bare row: one card surface, aligned fields and a
//     trailing actions column carrying the active-filter count and the reset
//     verb. For pages where the filters ARE the primary interaction.
//   * `popover` — the collapsed shape: one trigger button (icon + label +
//     active-count badge) anchoring a panel that holds the same fields plus an
//     Apply/Reset footer. The default posture for filters — they should not
//     permanently occupy a band of the page.
// Fields are the consumer's own controls in the default slot; the bar owns only
// the chrome, the count and the apply/reset verbs.
//
// DOM contract (mirrors the Vue render output):
//
//   ── inline ──
//   div.hk-filter-bar role=search aria-label={label}
//     div.hk-filter-bar-fields {children}
//     div.hk-filter-bar-actions
//       span.hk-badge.hk-badge-primary.hk-filter-bar-count data-size=sm  (count>0)
//       button.hk-btn.hk-btn-ghost.hk-btn-sm [disabled] {Reset}
//   ── popover ──
//   div.hk-filter-bar.hk-filter-bar-popover      (style: position:relative)
//     button.hk-btn.hk-btn-secondary.hk-btn-sm type=button [disabled]
//            aria-label={label} aria-haspopup=dialog aria-expanded
//       span[style="display:contents"] > the sliders svg
//       span {label}
//       span.hk-badge.hk-badge-primary.hk-filter-bar-count data-size=sm  (count>0)
//     ── open only ──
//     div.hk-filter-bar-panel data-testid=hk-filter-bar-panel
//          (style: absolute layer geometry)
//       {children}
//       div.hk-filter-bar-footer                       (show_footer)
//         button.hk-btn.hk-btn-ghost.hk-btn-sm [disabled] {Reset}
//         button.hk-btn.hk-btn-primary.hk-btn-sm [disabled] {Apply}
//
// State contract (the tairitsu 0.5.22 limit this wave works under): Vue keeps
// `open` in a local ref; the mirror takes it as a CONTROLLED prop
// (`open` in, `on_open_change` out) and stores nothing. Vue's `apply` / `reset`
// events are `on_apply` / `on_reset`; applying closes the panel exactly like
// Vue's handler (`open = false` then `emit("apply")`).
//
// Behaviour deltas vs Vue (documented, not accidental):
//   * no `<Teleport>` and no `HkPopover` mirror use: the panel IS the layer —
//     its geometry rides the panel's own inline style
//     (`filter_panel::filter_popup_layer_style`) against the popover root's
//     `position: relative` (the sheet keeps it `inline-flex`, so the containing
//     block is declared inline). No invented wrapper class is needed.
//   * the trigger and the count chip are composed on their components' own DOM
//     contracts (`.hk-btn.hk-btn-{variant}.hk-btn-{size}`, `.hk-badge`) rather
//     than nested: Vue passes `aria-expanded` / `aria-haspopup` / `class`
//     through `{...attrs}`, and neither mirrored `Button` (no arbitrary-attr
//     passthrough) nor `Badge` (no host-class prop) can carry them. The emitted
//     markup is the same one Vue produces.
//   * the Reset/Apply verb is the mirrored `basic::Button` (its `label` text is
//     the default slot in Vue, so the mirror passes the same words as children).

use hikari_i18n::t;

use crate::basic::button::{Button, ButtonProps, ButtonSize, ButtonVariant};
use crate::data::filter_panel::{filter_popup_layer_style, glyph_host};
use crate::feedback::popover::PopoverPlacement;
use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct FilterBarComponent;

/// The `sliders-horizontal` glyph at `size={14}` (lucide, ISC — the verbatim
/// icon node Vue renders; the crate's inlined-lucide class spelling).
pub const FILTER_BAR_GLYPH_SVG: &str = r#"<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-sliders-horizontal" aria-hidden="true"><path d="M10 5H3"/><path d="M12 19H3"/><path d="M14 3v4"/><path d="M16 17v4"/><path d="M21 12h-9"/><path d="M21 19h-5"/><path d="M21 5h-7"/><path d="M8 10v4"/><path d="M8 12H3"/></svg>"#;

/// The two standardized shapes (Vue: `"inline" | "popover"`).
#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum FilterBarMode {
    #[default]
    Inline,
    Popover,
}

impl FilterBarMode {
    /// The class suffix exactly as Vue appends it (`hk-filter-bar-popover`).
    pub fn token(self) -> &'static str {
        match self {
            FilterBarMode::Inline => "inline",
            FilterBarMode::Popover => "popover",
        }
    }
}

// ── pure functions ───────────────────────────────────────────────────────

/// The root class list in Vue's order: the base class, then the popover
/// modifier when collapsed.
pub fn filter_bar_root_classes(mode: FilterBarMode) -> String {
    match mode {
        FilterBarMode::Inline => "hk-filter-bar".to_string(),
        FilterBarMode::Popover => "hk-filter-bar hk-filter-bar-popover".to_string(),
    }
}

/// The reset verb's disabled flag: at zero active filters the affordance is
/// DISABLED, not hidden (Vue: `disabled || activeCount === 0`).
pub fn filter_bar_reset_disabled(disabled: bool, active_count: u32) -> bool {
    disabled || active_count == 0
}

/// The active-count chip renders only when something is active (Vue:
/// `activeCount > 0`).
pub fn filter_bar_shows_count(active_count: u32) -> bool {
    active_count > 0
}

/// The chip's text (Vue renders the number as the badge's slot content).
pub fn filter_bar_count_text(active_count: u32) -> String {
    active_count.to_string()
}

/// The Apply/Reset footer exists only in the collapsed shape, and only while
/// the page keeps it on (Vue: `mode === "popover" && showFooter`).
pub fn filter_bar_shows_footer(mode: FilterBarMode, show_footer: bool) -> bool {
    mode == FilterBarMode::Popover && show_footer
}

/// The inline shape's accessible name (Vue: `label ?? t(…, "Filters")`).
pub fn filter_bar_label(label: Option<&str>) -> String {
    match label {
        Some(label) => label.to_string(),
        None => t("hikari::filterBar.trigger", "Filters"),
    }
}

/// The count chip's classes: the mirrored Badge's own class pair plus the bar's
/// host hook (Vue appends `class="hk-filter-bar-count"` to the badge root).
pub fn filter_bar_count_classes() -> &'static str {
    "hk-badge hk-badge-primary hk-filter-bar-count"
}

// ── the component ────────────────────────────────────────────────────────

#[define_props]
pub struct FilterBarProps {
    /// Which standardized shape renders (Vue default `"inline"`).
    #[default]
    pub mode: FilterBarMode,

    /// How many filters are currently active (drives the count badge).
    #[default]
    pub active_count: u32,

    /// Accessible name / trigger text (Vue default: the localized "Filters").
    pub label: Option<String>,

    /// popover mode: render the Apply/Reset footer. Keep it off only when the
    /// fields commit live on their own.
    #[default(true)]
    pub show_footer: bool,

    #[default]
    pub disabled: bool,

    /// Layer placement against the trigger (Vue default `"bottom-start"`).
    #[default(PopoverPlacement::BottomStart)]
    pub placement: PopoverPlacement,

    /// popover mode: the panel's visibility (Vue: the local `open` ref).
    #[default]
    pub open: bool,

    /// Fires with the desired open state (Vue: the local `open` writes).
    pub on_open_change: Option<EventHandler<bool>>,

    /// The Apply verb in the footer (Vue: the `apply` emit). Fires AFTER the
    /// close request, exactly Vue's handler order.
    pub on_apply: Option<EventHandler<()>>,

    /// The reset verb (inline actions column / popover footer; Vue: `reset`).
    pub on_reset: Option<EventHandler<()>>,

    /// The consumer's own field controls (Vue: the default slot).
    pub children: Element,
}

/// The active-count chip, composed on the Badge DOM contract so the bar's own
/// `hk-filter-bar-count` hook rides along.
fn count_chip(active_count: u32) -> VNode {
    VNode::Element(Box::new(
        VElement::new("span")
            .class(filter_bar_count_classes())
            .attr("data-size", "sm")
            .child(VNode::Text(VText::new(&filter_bar_count_text(
                active_count,
            )))),
    ))
}

/// The reset verb (Vue: ghost/sm, disabled at zero active filters).
fn reset_button(props: &FilterBarProps, reset_label: String) -> VNode {
    let on_reset = props.on_reset.clone();
    Button(ButtonProps {
        variant: ButtonVariant::Ghost,
        size: ButtonSize::Sm,
        disabled: filter_bar_reset_disabled(props.disabled, props.active_count),
        children: VNode::Text(VText::new(&reset_label)),
        onclick: on_reset.map(|handler| {
            EventHandler::new(move |_event: MouseEvent| {
                handler.call(());
            })
        }),
        ..Default::default()
    })
}

#[component]
pub fn FilterBar(props: FilterBarProps) -> Element {
    let label = filter_bar_label(props.label.as_deref());
    let reset_label = t("hikari::filterBar.reset", "Reset");

    if props.mode == FilterBarMode::Popover {
        return popover_shape(&props, &label, reset_label);
    }

    let mut actions = VElement::new("div").class("hk-filter-bar-actions");
    if filter_bar_shows_count(props.active_count) {
        actions = actions.child(count_chip(props.active_count));
    }
    actions = actions.child(reset_button(&props, reset_label));

    VNode::Element(Box::new(
        VElement::new("div")
            .class(filter_bar_root_classes(FilterBarMode::Inline))
            .attr("role", "search")
            .attr("aria-label", label)
            .child(rsx! {
                div { class: "hk-filter-bar-fields", {props.children.clone()} }
            })
            .child(VNode::Element(Box::new(actions))),
    ))
}

/// The collapsed shape: the trigger button (icon + label + count) and the panel.
fn popover_shape(props: &FilterBarProps, label: &str, reset_label: String) -> Element {
    let label = label.to_string();
    let on_open_change = props.on_open_change.clone();
    let open = props.open;

    let mut trigger = VElement::new("button")
        .class("hk-btn hk-btn-secondary hk-btn-sm")
        .attr("type", "button")
        .attr("aria-label", label.clone())
        .attr("aria-haspopup", "dialog")
        .attr("aria-expanded", if open { "true" } else { "false" })
        .on_click(move |_event: MouseEvent| {
            if let Some(handler) = on_open_change.as_ref() {
                handler.call(!open);
            }
        })
        .child(glyph_host(FILTER_BAR_GLYPH_SVG))
        .child(rsx! {
            span { "{label}" }
        });
    if props.disabled {
        trigger = trigger.attr("disabled", "");
    }
    if filter_bar_shows_count(props.active_count) {
        trigger = trigger.child(count_chip(props.active_count));
    }

    let mut root = VElement::new("div")
        .class(filter_bar_root_classes(FilterBarMode::Popover))
        // The popover root carries a positioning context inline (the sheet only
        // declares `display: inline-flex`).
        .style("position:relative")
        .child(VNode::Element(Box::new(trigger)));

    if props.open {
        let mut panel = VElement::new("div")
            .class("hk-filter-bar-panel")
            .attr("data-testid", "hk-filter-bar-panel")
            .style(filter_popup_layer_style(props.placement, 6.0))
            .child(rsx! {
                {props.children.clone()}
            });

        if filter_bar_shows_footer(props.mode, props.show_footer) {
            let apply_label = t("hikari::filterBar.apply", "Apply");
            let on_apply = props.on_apply.clone();
            let close_handler = props.on_open_change.clone();
            let apply = Button(ButtonProps {
                variant: ButtonVariant::Primary,
                size: ButtonSize::Sm,
                disabled: props.disabled,
                children: VNode::Text(VText::new(&apply_label)),
                onclick: Some(EventHandler::new(move |_event: MouseEvent| {
                    // Vue: `open = false` then `emit("apply")`.
                    if let Some(handler) = close_handler.as_ref() {
                        handler.call(false);
                    }
                    if let Some(handler) = on_apply.as_ref() {
                        handler.call(());
                    }
                })),
                ..Default::default()
            });

            panel = panel.child(rsx! {
                div { class: "hk-filter-bar-footer",
                    {reset_button(props, reset_label)}
                    {apply}
                }
            });
        }

        root = root.child(VNode::Element(Box::new(panel)));
    }

    VNode::Element(Box::new(root))
}

impl StyledComponent for FilterBarComponent {
    fn styles() -> &'static str {
        // The canonical Vue sheet, compiled verbatim (no_hash keeps the
        // `.hk-filter-bar*` names literal so this CSS matches the Vue build).
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkFilterBar.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "filter-bar"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn filter_bar_defaults_match_the_vue_props() {
        let props = FilterBarProps::default();
        // Vue default: mode "inline", activeCount 0, showFooter true.
        assert_eq!(props.mode, FilterBarMode::Inline);
        assert_eq!(props.active_count, 0);
        assert_eq!(props.label, None);
        assert!(props.show_footer);
        assert!(!props.disabled);
        assert_eq!(props.placement, PopoverPlacement::BottomStart);
        assert!(!props.open);
        assert!(props.on_open_change.is_none());
        assert!(props.on_apply.is_none());
        assert!(props.on_reset.is_none());
    }

    #[test]
    fn filter_bar_root_classes_match_the_vue_shapes() {
        assert_eq!(
            filter_bar_root_classes(FilterBarMode::Inline),
            "hk-filter-bar"
        );
        assert_eq!(
            filter_bar_root_classes(FilterBarMode::Popover),
            "hk-filter-bar hk-filter-bar-popover"
        );
        assert_eq!(FilterBarMode::Inline.token(), "inline");
        assert_eq!(FilterBarMode::Popover.token(), "popover");
    }

    #[test]
    fn filter_bar_reset_is_disabled_at_zero_active_filters() {
        // Zero active filters → disabled, not hidden.
        assert!(filter_bar_reset_disabled(false, 0));
        assert!(!filter_bar_reset_disabled(false, 1));
        // The bar's own disabled wins.
        assert!(filter_bar_reset_disabled(true, 3));
    }

    #[test]
    fn filter_bar_count_chip_follows_the_active_count() {
        assert!(!filter_bar_shows_count(0));
        assert!(filter_bar_shows_count(2));
        assert_eq!(filter_bar_count_text(2), "2");
        // The chip keeps the Badge contract + the bar's own hook.
        assert_eq!(
            filter_bar_count_classes(),
            "hk-badge hk-badge-primary hk-filter-bar-count"
        );
    }

    #[test]
    fn filter_bar_footer_belongs_to_the_popover_shape_only() {
        assert!(!filter_bar_shows_footer(FilterBarMode::Inline, true));
        assert!(filter_bar_shows_footer(FilterBarMode::Popover, true));
        assert!(!filter_bar_shows_footer(FilterBarMode::Popover, false));
    }

    #[test]
    fn filter_bar_label_falls_back_to_the_localized_filters() {
        assert_eq!(filter_bar_label(Some("Ledger filters")), "Ledger filters");
        // The fallback is the Vue fallback, whatever the locale resolved.
        assert!(!filter_bar_label(None).is_empty());
    }

    #[test]
    fn filter_bar_styles_come_from_the_canonical_vue_sheet() {
        let css = FilterBarComponent::styles();
        for class in [
            ".hk-filter-bar",
            ".hk-filter-bar-popover",
            ".hk-filter-bar-fields",
            ".hk-filter-bar-actions",
            ".hk-filter-bar-count",
            ".hk-filter-bar-panel",
            ".hk-filter-bar-footer",
        ] {
            assert!(
                css.contains(class),
                "filter-bar css must carry the vue class {class:?}"
            );
        }
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored filter-bar sheet"
        );
    }

    #[test]
    fn filter_bar_inline_render_contract() {
        let html = FilterBar(FilterBarProps {
            active_count: 2,
            label: Some("Ledger filters".to_string()),
            children: rsx! {
                input { "data-probe": "" }
            },
            ..Default::default()
        })
        .render_to_html();

        for needle in [
            // The inline root is a search landmark named by the label.
            "class=\"hk-filter-bar\"",
            "role=\"search\"",
            "aria-label=\"Ledger filters\"",
            // The fields slot lives in its own row.
            "hk-filter-bar-fields",
            "data-probe",
            // The actions column carries the count and the reset verb.
            "hk-filter-bar-actions",
            "hk-badge hk-badge-primary hk-filter-bar-count",
            "data-size=\"sm\"",
            ">2<",
            "hk-btn hk-btn-ghost hk-btn-sm",
            ">Reset<",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        // Inline mode never renders the popover chrome.
        assert!(!html.contains("hk-filter-bar-popover"), "{html}");
        assert!(!html.contains("hk-filter-bar-panel"), "{html}");
        // One active filter or more: the reset verb is live.
        assert!(!html.contains("disabled"), "{html}");
    }

    #[test]
    fn filter_bar_inline_disables_the_reset_verb_at_zero() {
        let html = FilterBar(FilterBarProps::default()).render_to_html();
        assert!(html.contains("disabled"), "{html}");
        // A zero count hides the chip but keeps the verb mounted.
        assert!(!html.contains("hk-filter-bar-count"), "{html}");
        assert!(html.contains("hk-btn-ghost"), "{html}");
    }

    #[test]
    fn filter_bar_popover_starts_collapsed_behind_the_trigger() {
        let html = FilterBar(FilterBarProps {
            mode: FilterBarMode::Popover,
            active_count: 3,
            label: Some("Filters".to_string()),
            ..Default::default()
        })
        .render_to_html();

        for needle in [
            "class=\"hk-filter-bar hk-filter-bar-popover\"",
            "position:relative",
            // The trigger's disclosure contract + its count chip.
            "hk-btn hk-btn-secondary hk-btn-sm",
            "aria-label=\"Filters\"",
            "aria-haspopup=\"dialog\"",
            "aria-expanded=\"false\"",
            "aria-haspopup=\"dialog\"",
            "hk-filter-bar-count",
            ">3<",
            "lucide lucide-sliders-horizontal",
            "display:contents",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        // Collapsed: the panel and the footer are not mounted at all.
        assert!(!html.contains("hk-filter-bar-panel"), "{html}");
        assert!(!html.contains("hk-filter-bar-footer"), "{html}");
    }

    #[test]
    fn filter_bar_popover_open_renders_the_panel_and_footer() {
        let html = FilterBar(FilterBarProps {
            mode: FilterBarMode::Popover,
            open: true,
            active_count: 1,
            label: Some("Filters".to_string()),
            children: rsx! {
                input { "data-probe": "" }
            },
            ..Default::default()
        })
        .render_to_html();

        for needle in [
            "aria-expanded=\"true\"",
            // The panel IS the layer (no Teleport, no popover wrapper).
            "class=\"hk-filter-bar-panel\"",
            "data-testid=\"hk-filter-bar-panel\"",
            "position:absolute",
            "top:calc(100% + 6px)",
            "data-probe",
            // The footer carries both verbs.
            "hk-filter-bar-footer",
            "hk-btn-ghost",
            "hk-btn-primary",
            ">Reset<",
            ">Apply<",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
    }

    #[test]
    fn filter_bar_popover_honours_the_footer_opt_out() {
        let html = FilterBar(FilterBarProps {
            mode: FilterBarMode::Popover,
            open: true,
            show_footer: false,
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains("hk-filter-bar-panel"), "{html}");
        // Keep it off only when the fields commit live on their own.
        assert!(!html.contains("hk-filter-bar-footer"), "{html}");
        assert!(!html.contains(">Apply<"), "{html}");
    }
}
