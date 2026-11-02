// hi-components/src/navigation/search_trigger.rs
// SearchTrigger — mirror of the canonical Vue `HkSearchTrigger`: the header
// SEARCH affordance, the exact chrome twin of `HkFilterTrigger` (the
// `data/filter_trigger.rs` mirror — the two sheets are deliberately the same
// grammar, and this file reuses the trigger chrome helpers there). A
// ghost/28 (narrow) or ghost/32 (wide) icon button with the Search glyph,
// marking an ACTIVE keyword with the shared green bottom-right corner dot,
// anchoring a one-field panel in an inline layer.
//
// Keyword semantics (the search-behavior half of the list scaffold):
//   * the draft inside the panel is LOCAL until committed — commits fire
//     debounced while typing (default 300 ms) and immediately on Enter;
//   * an empty keyword is a clear: it commits "" exactly like text, so the
//     host never needs a separate clear verb (and the clear is IMMEDIATE —
//     a debounced clear would leave the dot lingering);
//   * `minLength` (default 1) swallows too-short drafts without clearing an
//     active keyword — the panel edits are free until they reach a
//     committable length (or empty out deliberately).
// What matches the keyword is the HOST's business; this component owns only
// the interaction — one trigger, one panel, one namespace.
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkSearchTrigger.scss`, vendored under
// `src/styles/vue-mirror/` and listed in the mirror manifest), compiled with
// `no_hash` so the `.hk-search-trigger*` class names are literal and
// identical in both forms. The corner dot's tones ride the mirrored
// `HkCornerBadge` sheet (registered as the "vue-corner-badge" chrome); the
// icon button's chrome is the shared `.hk-icon-button*` registry family —
// neither is re-emitted here. DOM contract (mirrors the Vue render output):
//
//   span.hk-search-trigger                    (style: position:relative — the
//                                            layer's containing block)
//     span.hk-corner-badge-anchor
//       button.hk-icon-button.hk-icon-button-{32|28}.hk-icon-button-ghost
//              type=button aria-label={label} aria-haspopup=dialog
//              aria-expanded [disabled] [data-active]
//         span.hk-icon-button-icon
//           span[style=display:contents] > the search svg (16)
//       span.hk-corner-badge.hk-corner-badge-success.hk-corner-badge--dot
//              data-corner=bottom-right
//              (style: --hk-corner-badge-offset:1px) aria-hidden=true (active)
//     ── open only ──
//     div.hk-search-trigger-body              (style: inline layer geometry)
//       SearchInput {draft / placeholder / disabled / debounce / clear label}
//       div.hk-search-trigger-footer > button.hk-btn.hk-btn-primary.hk-btn-sm
//              {Apply}                                            (narrow only)
//
// Vue prop mapping: `modelValue` → [`SearchTriggerProps::model_value`] (the
// ACTIVE keyword, "" = none), `placeholder`, `disabled`, `label` (defaults
// to the localized "Search" — the same word the icon says), `debounce` →
// [`SearchTriggerProps::debounce`] (default 300, ACCEPTED AND INERT — see
// the deltas), `minLength` → `min_length` (default 1), `placement` (Vue
// default `"bottom-end"`), `update:modelValue` → `on_value_change`.
//
// i18n: the three copy strings read `components.hk.search.*` through
// `hikari_i18n::t` — the crate bundle's namespace (Vue resolves its own
// `hikari::search.*`; the same literals, a different bundle — the
// `overlay/protocol_modal.rs` remap). `trigger` / `clear` / `apply` are NEW
// keys in this wave; until the catalogs carry them the English fallbacks
// below are what renders.
//
// STATE CONTRACT (ledger L48): tairitsu 0.5.22 has no per-instance component
// state (`use_signal` allocates a fresh signal per render, `use_state` shares
// ONE slot per component type), so Vue's local `open` / `draft` refs become
// the CONTROLLED `open` / `draft` props with their writers. The
// OPEN-EDGE SEED (`draft = modelValue` on open) and the input's focus grab
// are HOST-DRIVEN — no watcher and no element handles exist here.
//
// Behaviour deltas vs Vue (documented, not accidental):
//   * no `<Teleport>` and no `HkPopover` mirror use (the
//     `data/filter_trigger.rs` delta, same family grammar): the body IS the
//     layer — its geometry rides the body's own inline style
//     (`filter_panel::filter_popup_layer_style`) against the trigger's
//     `position: relative` (which its own sheet already declares). The
//     mobile BOTTOM-SHEET branch does not fork either: both form factors
//     render the same anchored layer, and `narrow` only swaps the chrome
//     step (ghost/28) and adds the ONE confirm footer.
//   * `useBreakpoint()` / `useChromeActionSize()` become the `narrow` prop:
//     the host reads `platform::inner_width() < 768` and passes it, keeping
//     the render pure and testable (the filter-trigger twin does the same).
//   * THE DEBOUNCE IS THE HOST'S: Vue's timer lives inside `HkSearchInput`
//     (its `search` event fires debounced while typing and immediately on
//     Enter); the mirrored `basic/search_input.rs` documents that no
//     render-scoped timer survives a re-render on tairitsu 0.5.22, so
//     `debounce` is passed through INERT and `onsearch` fires on Enter only.
//     The host owns the typing window; `search_trigger_commit_value` is the
//     one commit gate for every edge.
//   * THE CLOSE-FLUSH: Vue commits the draft when the popover tears down
//     (the teardown kills the input's in-flight debounce — the dot must
//     never disagree with what the user last saw). The Apply button runs
//     the flush here; a host-driven close (outside dismissal is the HOST's,
//     the same delta as the filter twin) must run the same
//     `search_trigger_commit_value(draft, …)` edge before writing
//     `open: false`.
//   * no auto-flip/viewport clamp (measured-panel contracts) and no focus
//     move (`nextTick` + `querySelector` on element handles).
//   * the glyph is lucide's `Search` node, serialized exactly as
//     `lucide-vue-next` renders it (the `layout/affix_picker.rs` serializer
//     output: the `lucide lucide-{name}` class pair, 24-unit viewBox, the
//     stroke attribute set, `aria-hidden="true"`), mounted through
//     `dangerous_inner_html` on a `display:contents` host — `rsx!`'s
//     `svg {}` lands in the HTML namespace in this host stack (ledger L49).
//   * interactions bind the MOUSE family (`onclick`), per ledger L67: on
//     wasm32-wasip2 the browser glue dispatches only the mouse family as
//     typed events.
//   * length math counts CHARS where JavaScript counts UTF-16 code units
//     (`value.length`) — identical for every BMP draft.

// These kernels are line-for-line ports of the upstream JS math: the negated
// comparisons, manual clamps and inline tuple types keep the port auditable
// against the source, so the idiomatic-rewrite lints are off here.
#![allow(clippy::neg_cmp_op_on_partial_ord)]
#![allow(clippy::collapsible_if)]
#![allow(clippy::type_complexity)]
#![allow(clippy::too_many_arguments)]
use hikari_i18n::t;

use crate::basic::button::{Button, ButtonProps, ButtonSize, ButtonVariant};
use crate::basic::search_input::{SearchInput, SearchInputProps};
use crate::data::filter_panel::{filter_popup_layer_style, glyph_host};
use crate::data::filter_trigger::{
    FILTER_TRIGGER_CORNER_OFFSET, filter_trigger_chrome_size, filter_trigger_corner_badge_classes,
    filter_trigger_corner_offset_style,
};
use crate::feedback::popover::PopoverPlacement;
use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct SearchTriggerComponent;

/// The lucide `Search` glyph at `size={16}` (Vue imports it from
/// `lucide-vue-next`; the node below is the library's own output — path
/// first, then the circle, the serialization order of the installed
/// package).
pub const SEARCH_TRIGGER_GLYPH_SVG: &str = r#"<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-search" aria-hidden="true"><path d="m21 21-4.34-4.34"></path><circle cx="11" cy="11" r="8"></circle></svg>"#;

/// The popout gap (Vue: HkPopover `offset={6}`).
pub const SEARCH_TRIGGER_LAYER_OFFSET: f64 = 6.0;

// ── pure functions ───────────────────────────────────────────────────────

/// Whether an ACTIVE keyword is set (Vue: the `active` computed — the green
/// dot's condition; `""` is no keyword).
pub fn search_trigger_is_active(model_value: &str) -> bool {
    !model_value.is_empty()
}

/// Vue's `commit` gate, as a pure decision: `disabled` never commits; a
/// NON-EMPTY draft shorter than `max(1, min_length)` never commits (the
/// panel edits stay free); a draft equal to the active keyword is a no-op.
/// `Some(value)` is the `update:modelValue` payload to emit — and an EMPTY
/// draft always passes the gate (clearing is a first-class verb).
pub fn search_trigger_commit_value(
    value: &str,
    min_length: u32,
    model_value: &str,
    disabled: bool,
) -> Option<String> {
    if disabled {
        return None;
    }
    if !value.is_empty() && (value.chars().count() as u32) < min_length.max(1) {
        return None;
    }
    if value == model_value {
        return None;
    }
    Some(value.to_string())
}

/// The trigger button's class list (`hk-icon-button`, the chrome size step,
/// the ghost variant) — the `useChromeActionSize` ladder the filter trigger
/// shares.
pub fn search_trigger_button_classes(narrow: bool) -> String {
    format!(
        "hk-icon-button {} hk-icon-button-ghost",
        filter_trigger_chrome_size(narrow).class_name()
    )
}

// ── the component ────────────────────────────────────────────────────────

#[define_props]
pub struct SearchTriggerProps {
    /// The ACTIVE keyword ("" = none). The panel drafts locally and commits
    /// debounced — this prop changes only on commit (Vue: `modelValue`).
    pub model_value: String,

    /// Input placeholder; `None` falls back to the search input's own
    /// localized "Search…" (Vue: `placeholder`).
    pub placeholder: Option<String>,

    pub disabled: bool,

    /// Accessible name / panel title; defaults to the localized "Search" —
    /// the same word the icon says (Vue: `label`).
    pub label: Option<String>,

    /// Commit debounce while typing, in ms (Vue default 300; ACCEPTED AND
    /// INERT — the host owns the window, see the header deltas).
    #[default(300.0)]
    pub debounce: f64,

    /// Drafts shorter than this do not commit (Vue default 1). Empty always
    /// commits — clearing is a first-class verb.
    #[default(1)]
    pub min_length: u32,

    /// Layer placement against the trigger (Vue default `"bottom-end"`).
    #[default(PopoverPlacement::BottomEnd)]
    pub placement: PopoverPlacement,

    /// Vue's `useBreakpoint().isMobile` stand-in: the host passes
    /// `platform::inner_width() < 768`. Drives the chrome step AND the
    /// confirm footer — exactly the two places Vue reads the breakpoint.
    pub narrow: bool,

    // ── controlled state (Vue keeps the trigger's open/draft in refs) ────
    /// Panel visibility.
    pub open: bool,

    /// The LOCAL draft inside the panel (seeded from `model_value` on the
    /// opening edge — the host's write).
    pub draft: String,

    // ── events ───────────────────────────────────────────────────────────
    /// Fires with the desired open state (Vue: the local `open` writes).
    pub on_open_change: Option<EventHandler<bool>>,

    /// Fires with the next ACTIVE keyword (Vue: `update:modelValue`).
    pub on_value_change: Option<EventHandler<String>>,

    /// Fires with the panel draft's new text (the Rust-side writer for
    /// Vue's local `draft` ref).
    pub on_draft_change: Option<EventHandler<String>>,
}

#[component]
pub fn SearchTrigger(props: SearchTriggerProps) -> Element {
    let label = props
        .label
        .clone()
        .unwrap_or_else(|| t("components.hk.search.trigger", "Search"));
    let active = search_trigger_is_active(&props.model_value);
    let open = props.open;

    // The commit edge every writer shares (the pure gate above).
    let commit_model_value = props.model_value.clone();
    let commit_disabled = props.disabled;
    let commit_min_length = props.min_length;
    let commit_writer = props.on_value_change.clone();
    let request_commit = move |value: String| {
        if let Some(payload) = search_trigger_commit_value(
            &value,
            commit_min_length,
            &commit_model_value,
            commit_disabled,
        ) {
            if let Some(handler) = commit_writer.as_ref() {
                handler.call(payload);
            }
        }
    };

    // The trigger button (composed on the mirrored IconButton's DOM
    // contract — the mirrored `basic::IconButton` has no arbitrary-attribute
    // passthrough; the emitted markup is the same one Vue produces).
    let on_open_change = props.on_open_change.clone();
    let mut button = VElement::new("button")
        .class(search_trigger_button_classes(props.narrow))
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
            span { class: "hk-icon-button-icon", {glyph_host(SEARCH_TRIGGER_GLYPH_SVG)} }
        });
    if props.disabled {
        button = button.attr("disabled", "");
    }
    if active {
        // Vue: `data-active={active.value || undefined}` — presence only.
        button = button.attr("data-active", "");
    }

    // The active-keyword marker rides the generic corner badge — the same
    // green bottom-right dot the filter trigger wears.
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
        .class("hk-search-trigger")
        .style("position:relative")
        .child(VNode::Element(Box::new(anchor)));

    if props.open {
        // The field's own edges: draft updates (an empty one commits the
        // clear IMMEDIATELY — a debounced clear feels broken), Enter commits.
        let draft_writer = props.on_draft_change.clone();
        let clear_commit = request_commit.clone();
        let input = SearchInput(SearchInputProps {
            model_value: props.draft.clone(),
            placeholder: props.placeholder.clone(),
            disabled: props.disabled,
            debounce: props.debounce,
            clear_aria_label: t("components.hk.search.clear", "Clear search"),
            oninput: Some(EventHandler::new(move |value: String| {
                if let Some(handler) = draft_writer.as_ref() {
                    handler.call(value.clone());
                }
                if value.is_empty() {
                    clear_commit(value);
                }
            })),
            onsearch: Some(EventHandler::new(request_commit.clone())),
            ..Default::default()
        });

        let mut body = VElement::new("div")
            .class("hk-search-trigger-body")
            .style(filter_popup_layer_style(
                props.placement,
                SEARCH_TRIGGER_LAYER_OFFSET,
            ))
            .child(input);

        // The sheet's ONE button: confirm = close (commits already rode the
        // input's debounce — the close-flush keeps the last keystroke too).
        if props.narrow {
            let apply_label = t("components.hk.search.apply", "Apply");
            let flush_draft = props.draft.clone();
            let close_flush = request_commit.clone();
            let close_handler = props.on_open_change.clone();
            let apply = Button(ButtonProps {
                variant: ButtonVariant::Primary,
                size: ButtonSize::Sm,
                disabled: props.disabled,
                children: VNode::Text(VText::new(&apply_label)),
                onclick: Some(EventHandler::new(move |_event: MouseEvent| {
                    // Vue's `onPanelOpen(false)`: flush, then close.
                    close_flush(flush_draft.clone());
                    if let Some(handler) = close_handler.as_ref() {
                        handler.call(false);
                    }
                })),
                ..Default::default()
            });
            body = body.child(rsx! {
                div { class: "hk-search-trigger-footer",
                    {apply}
                }
            });
        }

        root = root.child(VNode::Element(Box::new(body)));
    }

    VNode::Element(Box::new(root))
}

impl StyledComponent for SearchTriggerComponent {
    fn styles() -> &'static str {
        // The canonical Vue sheet, compiled verbatim (no_hash keeps the
        // `.hk-search-trigger*` names literal so this CSS matches the Vue
        // build). The corner mark's tones live in the mirrored HkCornerBadge
        // sheet (registered as the "vue-corner-badge" chrome) and the icon
        // button's in the shared registry family — neither is re-emitted.
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkSearchTrigger.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "search-trigger"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn search_trigger_defaults_match_the_vue_props() {
        let props = SearchTriggerProps::default();
        assert_eq!(props.model_value, "");
        assert_eq!(props.placeholder, None);
        assert!(!props.disabled);
        assert_eq!(props.label, None);
        // Vue's `debounce` default is 300 (inert here — the host owns it).
        assert_eq!(props.debounce, 300.0);
        assert_eq!(props.min_length, 1);
        // Vue default: "bottom-end".
        assert_eq!(props.placement, PopoverPlacement::BottomEnd);
        assert!(!props.narrow);
        assert!(!props.open);
        assert_eq!(props.draft, "");
        assert!(props.on_open_change.is_none());
        assert!(props.on_value_change.is_none());
        assert!(props.on_draft_change.is_none());
    }

    #[test]
    fn search_trigger_active_needs_a_keyword() {
        assert!(!search_trigger_is_active(""));
        assert!(search_trigger_is_active("香蕉"));
        // Whitespace is a keyword too (only "" is "none" in Vue).
        assert!(search_trigger_is_active(" "));
    }

    #[test]
    fn search_trigger_commit_value_gates_like_vue() {
        // A new, long-enough draft commits.
        assert_eq!(
            search_trigger_commit_value("work", 1, "", false),
            Some("work".to_string())
        );
        // Clearing is a first-class verb: empty always commits (when the
        // active keyword differs).
        assert_eq!(
            search_trigger_commit_value("", 1, "work", false),
            Some(String::new())
        );
        // An already-empty keyword stays quiet on an empty draft.
        assert_eq!(search_trigger_commit_value("", 1, "", false), None);
        // A no-change draft is a no-op…
        assert_eq!(search_trigger_commit_value("work", 1, "work", false), None);
        // …and so is a too-short one (panel edits are free; at
        // minLength 1 nothing but "" is short — "w" commits there, see
        // the floors-at-1 case below)…
        assert_eq!(search_trigger_commit_value("w", 2, "", false), None);
        assert_eq!(search_trigger_commit_value("wo", 3, "", false), None);
        // …but the EMPTY draft passes every minLength.
        assert_eq!(
            search_trigger_commit_value("", 3, "work", false),
            Some(String::new())
        );
        // minLength 0 floors at 1, exactly Vue's Math.max(1, …).
        assert_eq!(
            search_trigger_commit_value("w", 0, "", false),
            Some("w".to_string())
        );
        // Disabled never commits — not even a clear.
        assert_eq!(search_trigger_commit_value("", 1, "work", true), None);
    }

    #[test]
    fn search_trigger_button_classes_follow_the_chrome_ladder() {
        // Vue: useChromeActionSize — ghost/32 wide, ghost/28 narrow (the
        // same step as the filter twin).
        assert_eq!(
            search_trigger_button_classes(false),
            "hk-icon-button hk-icon-button-32 hk-icon-button-ghost"
        );
        assert_eq!(
            search_trigger_button_classes(true),
            "hk-icon-button hk-icon-button-28 hk-icon-button-ghost"
        );
    }

    #[test]
    fn search_trigger_render_contract() {
        let html = SearchTrigger(SearchTriggerProps {
            label: Some("Search".to_string()),
            ..Default::default()
        })
        .render_to_html();

        for needle in [
            // The anchored root (the layer's containing block).
            r#"class="hk-search-trigger""#,
            "position:relative",
            // The corner-badge anchor + the chrome button.
            "hk-corner-badge-anchor",
            r#"class="hk-icon-button hk-icon-button-32 hk-icon-button-ghost""#,
            r#"aria-label="Search""#,
            r#"aria-haspopup="dialog""#,
            r#"aria-expanded="false""#,
            // The glyph rides the icon box on a boxless host.
            "hk-icon-button-icon",
            "lucide lucide-search",
            "display:contents",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        // Collapsed + inactive: no dot, no panel, no footer, no field.
        assert!(!html.contains("hk-corner-badge--dot"), "{html}");
        assert!(!html.contains("data-active"), "{html}");
        assert!(!html.contains("hk-search-trigger-body"), "{html}");
        assert!(!html.contains("hk-search-trigger-footer"), "{html}");
        assert!(!html.contains("hk-search-input"), "{html}");
        assert!(!html.contains("disabled"), "{html}");
    }

    #[test]
    fn search_trigger_render_marks_the_active_state() {
        let html = SearchTrigger(SearchTriggerProps {
            model_value: "香蕉".to_string(),
            ..Default::default()
        })
        .render_to_html();
        // The green dot sits at the button's bottom-right corner — the same
        // grammar the filter trigger wears.
        assert!(
            html.contains("hk-corner-badge hk-corner-badge-success hk-corner-badge--dot"),
            "{html}"
        );
        assert!(html.contains(r#"data-corner="bottom-right""#), "{html}");
        assert!(html.contains("--hk-corner-badge-offset:1px"), "{html}");
        assert!(html.contains(r#"aria-hidden="true""#), "{html}");
        assert!(html.contains("data-active"), "{html}");
    }

    #[test]
    fn search_trigger_open_narrow_renders_the_field_and_confirm() {
        let html = SearchTrigger(SearchTriggerProps {
            open: true,
            narrow: true,
            draft: "香蕉".to_string(),
            placeholder: Some("Find…".to_string()),
            ..Default::default()
        })
        .render_to_html();

        for needle in [
            r#"aria-expanded="true""#,
            // Narrow chrome step.
            "hk-icon-button-28",
            // The body IS the layer (no Teleport, no popover wrapper).
            r#"class="hk-search-trigger-body""#,
            "position:absolute",
            // The search field rides inside, wired to the draft.
            "hk-search-input",
            r#"value="香蕉""#,
            r#"placeholder="Find…""#,
            // The sheet's ONE confirm button.
            "hk-search-trigger-footer",
            "hk-btn hk-btn-primary hk-btn-sm",
            ">Apply<",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        // The draft carries text: the field's clear affordance is live,
        // labelled with the localized literal.
        assert!(html.contains(r#"aria-label="Clear search""#), "{html}");
    }

    #[test]
    fn search_trigger_open_wide_has_no_confirm_button() {
        let html = SearchTrigger(SearchTriggerProps {
            open: true,
            ..Default::default()
        })
        .render_to_html();
        // Desktop: NO confirm button — commits ride the field's Enter.
        assert!(html.contains("hk-search-trigger-body"), "{html}");
        assert!(html.contains("hk-search-input"), "{html}");
        assert!(!html.contains("hk-search-trigger-footer"), "{html}");
        assert!(!html.contains(">Apply<"), "{html}");
    }

    #[test]
    fn search_trigger_press_writes_the_open_state() {
        let opens = std::rc::Rc::new(std::cell::Cell::new(0usize));
        let counter = std::rc::Rc::clone(&opens);
        let node = SearchTrigger(SearchTriggerProps {
            on_open_change: Some(EventHandler::new(move |open: bool| {
                assert!(open);
                counter.set(counter.get() + 1);
            })),
            ..Default::default()
        });
        // Serialization drops handlers, so walk the tree and INVOKE the
        // trigger's click listener (the `feedback/modal.rs` test pattern).
        fn click_trigger(node: &Element) -> bool {
            match node {
                VNode::Element(el) => {
                    if el.class.to_string().contains("hk-icon-button")
                        && !el.class.to_string().contains("hk-icon-button-icon")
                        && let Some(handler) = el.event_handlers.get("click")
                    {
                        handler.borrow_mut()(
                            Box::new(MouseEvent::default()) as Box<dyn tairitsu_vdom::EventData>
                        );
                        return true;
                    }
                    el.children.iter().any(click_trigger)
                }
                VNode::Fragment(children) => children.iter().any(click_trigger),
                _ => false,
            }
        }
        assert!(click_trigger(&node), "no trigger button found");
        assert_eq!(opens.get(), 1, "the wired open handler must run");
    }

    #[test]
    fn search_trigger_styles_come_from_the_canonical_vue_sheet() {
        let css = SearchTriggerComponent::styles();
        for class in [
            ".hk-search-trigger",
            ".hk-search-trigger-body",
            ".hk-search-trigger-footer",
        ] {
            assert!(
                css.contains(class),
                "search-trigger css must carry the vue class {class:?}"
            );
        }
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored search-trigger sheet"
        );
        // The corner mark's tones are HkCornerBadge's sheet, not this one.
        assert!(
            !css.contains("hk-corner-badge--dot"),
            "the corner mark's sheet is registered separately — see the header"
        );
        assert_eq!(SearchTriggerComponent::name(), "search-trigger");
    }
}
