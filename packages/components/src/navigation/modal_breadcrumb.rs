// hi-components/src/navigation/modal_breadcrumb.rs
// ModalBreadcrumb — mirror of the canonical Vue `HkModalBreadcrumb`: the
// centred overlay strip that lists the window stack (every modal/drawer
// layer — plus any dropdown-kind surface that currently BLOCKS like one)
// once more than one layer is up.
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkModalBreadcrumb.scss`, vendored under
// `src/styles/vue-mirror/`), compiled with `no_hash` so the
// `.hk-modal-breadcrumb*` class names are literal and identical in both
// forms.
//
// DOM contract (mirrors the Vue render output one-to-one):
//
//   nav.hk-modal-breadcrumb [aria-label=Window layers] [aria-live=polite]
//        (style: top; max-width?)
//     div.hk-modal-breadcrumb-measure [aria-hidden=true]   (the ruler)
//       span.hk-modal-breadcrumb-crumb                     (EVERY layer)
//         [svg.hk-modal-breadcrumb-sep]                    (i > 0)
//         span.hk-modal-breadcrumb-item [.hk-modal-breadcrumb-item-current]
//       span.hk-modal-breadcrumb-crumb > span.hk-modal-breadcrumb-more {…}
//     ── folded || menu open ──
//     span.hk-modal-breadcrumb-crumb
//       button.hk-modal-breadcrumb-more [type=button] [aria-haspopup=dialog]
//           [aria-expanded=true|false] [aria-label=All layers] {…}
//     ── the visible tail ──
//     span.hk-modal-breadcrumb-crumb
//       [svg.hk-modal-breadcrumb-sep]                      (trigger || i > 0)
//       ── truncated label ── button.hk-modal-breadcrumb-item
//           .hk-modal-breadcrumb-item-reveal [.hk-modal-breadcrumb-item-current]
//           [type=button] [aria-haspopup=dialog] [aria-expanded] [aria-label=full name]
//       ── plain label ── span.hk-modal-breadcrumb-item […current] {text}
//   ── both surfaces, through the mirrored Popover ──
//   div.hk-popover-panel…hk-modal-breadcrumb-menu            (menu open)
//     div.hk-menu-list [role=menu] [aria-label=All layers]
//       button.hk-menu-action-item [type=button] [role=menuitem] [data-active?]
//         span.hk-menu-action-item__label {label}           (topmost first)
//   div.hk-popover-panel…                                    (a name revealed)
//     p.hk-modal-breadcrumb-reveal {the whole layer name}
//
// Nothing renders at all while the stack carries fewer than two layers
// (Vue's `visible` computed → `null`).
//
// STATE CONTRACT (the crate's zero-signal rule): Vue owns the fold
// (`hiddenCount`), the menu (`menuOpen`), the reveal (`revealed`) and the
// strip geometry (`topPx` / `maxWidthPx`) in refs, all derived from live
// DOM measurement. The mirror takes every one of them as a CONTROLLED
// prop and exports Vue's decision maths as pure functions so a host
// reproduces the behaviour exactly:
//
//   [`modal_breadcrumb_stack`]        the registry filter + z sort
//   [`modal_breadcrumb_crumbs`]       labels, the width clamp, current
//   [`modal_breadcrumb_fold_count`]   the overflow collapse (measureStrip)
//   [`modal_breadcrumb_crumb_footprint`] / [`modal_breadcrumb_strip_width`]
//                                      the boxless-DOM width estimate
//   [`modal_breadcrumb_content_budget`] / [`modal_breadcrumb_strip_top`]
//   [`modal_breadcrumb_sheet_band`]   the --hk-sheet-top-inset promise
//   [`modal_breadcrumb_clamp_label`]  Vue's East-Asian display-width clamp
//
// Deltas vs Vue (documented, one per deviation):
//   * NO MEASUREMENT API — Vue measures the off-screen clone and the app
//     header (`getBoundingClientRect`, `getComputedStyle`); the crate has
//     no ref/measurement pairing, so [`ModalBreadcrumbProps::hidden_count`],
//     [`ModalBreadcrumbProps::strip_top_px`] and
//     [`ModalBreadcrumbProps::max_width_px`] are host-supplied (the pure
//     helpers above turn measurements into values; the fallback top is
//     Vue's own pre-resync constant, `topGap + STRIP_HEIGHT_PX / 2`). The
//     clone still renders — it is the strip's DOM contract, and a host
//     that measures it gets Vue's ruler verbatim. The resize / slow-tick
//     re-measure loops are host effects.
//   * NO TELEPORT / OVERLAY ROOT / POPUP REGISTRY: the strip renders in
//     place (the host's stacking context decides the paint order) and the
//     layer list arrives as the `layers` prop — the popup-manager filter
//     ([`modal_breadcrumb_stack`]) runs on it here. The menu therefore
//     cannot exclude "its own registered sheet" the way Vue's
//     `menuSheetId` does: a host whose menu popover registers as a
//     blocking layer must drop that id from `layers` itself.
//   * NO DOCUMENT-LEVEL ESCAPE: Vue adds a document keydown listener for
//     the anchored popover forms; the mirrored Popover owns Escape for
//     its own panel (both surfaces compose it), and a host mounts the
//     strip inside its own Escape chain if it needs more.
//   * The all-layers menu rows are `HkMenuPanel`/`HkMenuActionItem` DOM
//     HOOKS (`hk-menu-list` / `hk-menu-action-item*`): those components
//     have no mirror of their own this wave — the same deal
//     `auth/alt_sign_in.rs` documents for its rows.
//   * The chevron is TRUSTED STATIC MARKUP through `dangerous_inner_html`
//     on a `display:contents` host (ledger L49 — an `rsx!` `svg {}` child
//     lands in the HTML namespace); the class sits on the `<svg>` itself
//     exactly like Vue's, so the sheet's `[dir="rtl"]` mirror rule and
//     every other `.hk-modal-breadcrumb-sep` selector still hit.
//   * `hidden_count` is clamped so the LAST layer is never folded away
//     (Vue's own invariant: "if even the current layer alone overflows,
//     it keeps the strip and its own CSS ellipsis does the rest").
//
// I18N: every string rides `hikari_i18n::t` under
// `components.hk.modalBreadcrumb.*` — the English literals are the
// canonical ones from the Vue app dictionary (`hikari::modal.*` in
// `packages/vue/src/i18n/locales/en/components.json`), re-keyed to the
// crate's component namespace (the same mapping `layout/affix_picker.rs`
// applies). New keys (see the wave receipt): stackLabel, allLayers,
// unnamedSheet, unnamedWindow.

// These kernels are line-for-line ports of the upstream JS math: the negated
// comparisons, manual clamps and inline tuple types keep the port auditable
// against the source, so the idiomatic-rewrite lints are off here.
#![allow(clippy::neg_cmp_op_on_partial_ord)]
#![allow(clippy::collapsible_if)]
#![allow(clippy::type_complexity)]
#![allow(clippy::too_many_arguments)]
use hikari_i18n::t;

use crate::feedback::popover::{Popover, PopoverAnchorRect, PopoverPlacement, PopoverProps};
use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct ModalBreadcrumbComponent;

/// Layout constants — the numbers the strip's own stylesheet declares
/// (12px label type, 12px chevron, 8px gaps, 2rem side padding, 1px
/// border, 24px trigger) that a boxless DOM must be judged with (Vue
/// spells the same numbers at the top of its own file).
pub const MODAL_BREADCRUMB_LABEL_FONT_PX: f64 = 12.0;
pub const MODAL_BREADCRUMB_SEPARATOR_PX: f64 = 12.0;
pub const MODAL_BREADCRUMB_GAP_PX: f64 = 8.0;
pub const MODAL_BREADCRUMB_SIDE_PADDING_PX: f64 = 32.0;
pub const MODAL_BREADCRUMB_BORDER_PX: f64 = 1.0;
pub const MODAL_BREADCRUMB_MORE_PX: f64 = 24.0;

/// The strip's own height for the moments no box can be measured (the
/// stylesheet's 12px vertical padding, a ~17px label line, a 1px border).
pub const MODAL_BREADCRUMB_STRIP_HEIGHT_PX: f64 = 43.0;

/// The least daylight between the app's top edge and the strip's own top
/// edge (Vue's `topGap` prop default).
pub const MODAL_BREADCRUMB_DEFAULT_TOP_GAP_PX: f64 = 12.0;

/// Vue's `maxLabelUnits` prop default: the longest a layer label may
/// render, in full-width glyph units (one CJK ideograph = 1, one Latin
/// glyph = 0.5 — the ellipsis counts inside the budget).
pub const MODAL_BREADCRUMB_DEFAULT_MAX_LABEL_UNITS: f64 = 10.0;

/// The single-glyph ellipsis every clamp in this file appends. U+2026 is
/// East-Asian WIDE in the fonts this library renders with, so it counts
/// as one full-width unit (Vue's own note).
pub const MODAL_BREADCRUMB_ELLIPSIS: &str = "\u{2026}";

/// The chevron between two crumbs (Vue's inline `<svg>`), serialized
/// byte for byte as Vue renders it and mounted through
/// `dangerous_inner_html` — see the header.
pub const MODAL_BREADCRUMB_SEP_SVG: &str = r#"<svg class="hk-modal-breadcrumb-sep" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="9 18 15 12 9 6"></polyline></svg>"#;

// ── the display-width clamp (Vue: runtime/displayWidth.ts) ──────────────

/// One code point's width in full-width units (0, 0.5 or 1): combining
/// marks and friends take no room, the wide East-Asian blocks and emoji
/// take a full column, everything else takes half.
pub fn modal_breadcrumb_glyph_units(ch: char) -> f64 {
    match ch as u32 {
        // Zero-width: combining marks, joiners, variation selectors.
        0x0300..=0x036F | 0x200B..=0x200F | 0x2060 | 0xFE00..=0xFE0F => 0.0,
        _ if ch.to_string() == MODAL_BREADCRUMB_ELLIPSIS => 1.0,
        // Full-width: CJK ideographs (incl. compatibility and astral
        // blocks), kana, hangul, CJK punctuation, full-width forms, emoji.
        0x1100..=0x115F
        | 0x2E80..=0x303E
        | 0x3040..=0x33FF
        | 0x3400..=0x4DBF
        | 0x4E00..=0x9FFF
        | 0xA000..=0xA4CF
        | 0xAC00..=0xD7A3
        | 0xF900..=0xFAFF
        | 0xFE10..=0xFE19
        | 0xFE30..=0xFE6F
        | 0xFF01..=0xFF60
        | 0xFFE0..=0xFFE6
        | 0x1F000..=0x1FAFF
        | 0x20000..=0x3FFFD => 1.0,
        _ => 0.5,
    }
}

/// A string's width in full-width units — iterates Unicode scalars, so an
/// astral ideograph counts once, not twice.
pub fn modal_breadcrumb_display_units(text: &str) -> f64 {
    text.chars().map(modal_breadcrumb_glyph_units).sum()
}

/// Vue's `clampToDisplayWidth`: cut `text` so it renders at most
/// `max_units` wide, closing the cut with an ellipsis that is INSIDE the
/// budget. Text that already fits is returned byte-for-byte (callers diff
/// for "truncated"); a non-positive cap yields the empty string.
pub fn modal_breadcrumb_clamp_label(text: &str, max_units: f64) -> String {
    if !(max_units > 0.0) {
        return String::new();
    }
    if modal_breadcrumb_display_units(text) <= max_units {
        return text.to_string();
    }
    let budget = max_units - modal_breadcrumb_display_units(MODAL_BREADCRUMB_ELLIPSIS);
    let mut units = 0.0;
    let mut kept = String::new();
    for ch in text.chars() {
        let width = modal_breadcrumb_glyph_units(ch);
        if units + width > budget {
            break;
        }
        units += width;
        kept.push(ch);
    }
    // A cut landing after trailing whitespace would float the ellipsis;
    // pull the whitespace back under the cut.
    format!(
        "{}{MODAL_BREADCRUMB_ELLIPSIS}",
        kept.trim_end_matches(char::is_whitespace)
    )
}

// ── the stack (Vue: usePopupManager's registry) ─────────────────────────

/// One layer of the popup stack, as the host's registry sees it (Vue:
/// `PopupEntry`).
#[derive(Clone, PartialEq, Debug, Default)]
pub struct ModalBreadcrumbLayer {
    /// Popup-registry id — the value `on_navigate` carries.
    pub id: String,
    /// The registry kind: `"modal"` / `"drawer"` always join the strip, a
    /// `"dropdown"` only while it blocks (see
    /// [`modal_breadcrumb_layer_joins_stack`]).
    pub kind: String,
    /// Whether the surface currently blocks the page like a window (the
    /// mobile bottom-sheet form of a menu/popover).
    pub blocking: bool,
    /// The stack's paint order — the sort key (Vue: `zIndex`, default 0).
    pub z_index: i64,
    /// Full layer name; `None` falls back to the localized last resort.
    pub title: Option<String>,
}

impl ModalBreadcrumbLayer {
    /// A titled window layer.
    pub fn new(
        id: impl Into<String>,
        kind: impl Into<String>,
        z_index: i64,
        title: impl Into<String>,
    ) -> Self {
        Self {
            id: id.into(),
            kind: kind.into(),
            blocking: false,
            z_index,
            title: Some(title.into()),
        }
    }
}

/// Vue's `WINDOW_KINDS` test: windows (modal/drawer) always participate;
/// any other kind only while it BLOCKS like a window.
pub fn modal_breadcrumb_layer_joins_stack(kind: &str, blocking: bool) -> bool {
    matches!(kind, "modal" | "drawer") || blocking
}

/// The layers the strip navigates, sorted by `z_index` (Vue's
/// `stackEntries` computed; a stable sort, like JS `Array.sort` here).
pub fn modal_breadcrumb_stack(layers: &[ModalBreadcrumbLayer]) -> Vec<ModalBreadcrumbLayer> {
    let mut stack: Vec<ModalBreadcrumbLayer> = layers
        .iter()
        .filter(|layer| modal_breadcrumb_layer_joins_stack(&layer.kind, layer.blocking))
        .cloned()
        .collect();
    stack.sort_by_key(|layer| layer.z_index);
    stack
}

/// One crumb of the strip (Vue: `Crumb`).
#[derive(Clone, PartialEq, Debug, Default)]
pub struct ModalBreadcrumbCrumb {
    pub id: String,
    /// Full layer name, never cut — the reveal surface reads this.
    pub label: String,
    /// What the strip renders, cut to the label budget.
    pub text: String,
    /// `text !== label` — the tappable-cut marker.
    pub truncated: bool,
    /// The topmost layer.
    pub current: bool,
}

/// Every layer must carry a real, i18n-resolved name — the generic labels
/// are localized last resorts for production, never a bare "Layer N": an
/// unnamed window reads as a window, an unnamed sheet as a menu (Vue's
/// own contract).
pub fn modal_breadcrumb_unnamed_label(kind: &str) -> String {
    if kind == "dropdown" {
        t("components.hk.modalBreadcrumb.unnamedSheet", "Menu")
    } else {
        t("components.hk.modalBreadcrumb.unnamedWindow", "Window")
    }
}

/// The crumbs for a resolved stack (Vue's `crumbs` computed): the label
/// (title or the localized last resort), the clamped strip text, the
/// truncation flag and the topmost-layer marker.
pub fn modal_breadcrumb_crumbs(
    stack: &[ModalBreadcrumbLayer],
    max_label_units: f64,
) -> Vec<ModalBreadcrumbCrumb> {
    let last = stack.len().saturating_sub(1);
    stack
        .iter()
        .enumerate()
        .map(|(index, layer)| {
            let label = layer
                .title
                .clone()
                .unwrap_or_else(|| modal_breadcrumb_unnamed_label(&layer.kind));
            let text = modal_breadcrumb_clamp_label(&label, max_label_units);
            ModalBreadcrumbCrumb {
                id: layer.id.clone(),
                truncated: text != label,
                label,
                text,
                current: index == last,
            }
        })
        .collect()
}

// ── the overflow collapse (Vue: measureStrip) ───────────────────────────

/// One crumb's footprint, in the strip's LOCAL px (Vue's estimate branch
/// — the measured branch is the host's job): its label, plus the chevron
/// it carries when it follows another crumb, scaled by the ancestor zoom.
/// The strip's inter-crumb gap is NOT part of a crumb's own box (two
/// different boxes — collapsing them counts every gap twice).
pub fn modal_breadcrumb_crumb_footprint(text: &str, index: usize, gap_px: f64, zoom: f64) -> f64 {
    let zoom = if zoom > 0.0 { zoom } else { 1.0 };
    let inner = if index > 0 {
        MODAL_BREADCRUMB_SEPARATOR_PX + gap_px / zoom
    } else {
        0.0
    };
    (modal_breadcrumb_display_units(text) * MODAL_BREADCRUMB_LABEL_FONT_PX + inner) * zoom
}

/// The whole strip's width from per-crumb footprints (Vue's `full`).
pub fn modal_breadcrumb_strip_width(widths: &[f64], gap_px: f64) -> f64 {
    widths.iter().sum::<f64>() + gap_px * (widths.len().saturating_sub(1)) as f64
}

/// The fold: how many LEADING layers collapse behind the "…" trigger.
/// `widths` are the per-crumb footprints (measured or estimated), `more`
/// the trigger's own width. The longest visible tail wins; the last layer
/// is never folded away — if even it alone overflows, it keeps the strip
/// and its own CSS ellipsis does the rest (Vue's loop, verbatim).
pub fn modal_breadcrumb_fold_count(
    widths: &[f64],
    more_width_px: f64,
    gap_px: f64,
    budget_px: f64,
) -> usize {
    let n = widths.len();
    if n <= 1 {
        return 0;
    }
    if !budget_px.is_finite() {
        return 0;
    }
    let full = modal_breadcrumb_strip_width(widths, gap_px);
    if full <= budget_px {
        return 0;
    }
    for hidden in 1..n {
        let tail: f64 = widths[hidden..].iter().map(|width| gap_px + width).sum();
        if more_width_px + tail <= budget_px {
            return hidden;
        }
    }
    n - 1
}

/// The content-box budget the fold is judged against, in the visual px
/// the crumb rects come back in (Vue's `contentBudget`): the viewport
/// minus the shared gutter twice, the strip's side padding and its
/// border — every term but the viewport authored in the strip's LOCAL px
/// and therefore scaled once. A non-positive viewport (SSR, unit DOM)
/// is "no budget yet" (Vue's `Number.POSITIVE_INFINITY`).
pub fn modal_breadcrumb_content_budget(
    viewport_width_px: f64,
    gutter_px: f64,
    zoom: f64,
    padding_px: f64,
    border_px: f64,
) -> f64 {
    if !(viewport_width_px > 0.0) {
        return f64::INFINITY;
    }
    let zoom = if zoom > 0.0 { zoom } else { 1.0 };
    viewport_width_px - gutter_px * 2.0 * zoom - padding_px * zoom - border_px * zoom
}

/// Vue's `topGapPx` sanitize: a non-finite gap would poison both the
/// pre-resync value and every resync (`Math.max(x, NaN)` is NaN); a
/// NEGATIVE gap stays the host's choice.
pub fn modal_breadcrumb_top_gap_px(top_gap: f64) -> f64 {
    if top_gap.is_finite() {
        top_gap
    } else {
        MODAL_BREADCRUMB_DEFAULT_TOP_GAP_PX
    }
}

/// The strip's inline `top`: centred on the app header, but keeping the
/// promised daylight — whichever candidate parks the strip LOWER wins
/// (Vue's `resyncTop`).
pub fn modal_breadcrumb_strip_top(
    app_top_px: f64,
    header_height_px: f64,
    strip_height_px: f64,
    top_gap_px: f64,
) -> f64 {
    app_top_px
        + (header_height_px / 2.0)
            .max(modal_breadcrumb_top_gap_px(top_gap_px) + strip_height_px / 2.0)
}

/// The pre-resync paint position: the clearance rule on the layout
/// fallbacks (Vue's init ref `topGapPx + STRIP_HEIGHT_PX / 2`).
pub fn modal_breadcrumb_fallback_top(top_gap_px: f64) -> f64 {
    modal_breadcrumb_top_gap_px(top_gap_px) + MODAL_BREADCRUMB_STRIP_HEIGHT_PX / 2.0
}

/// The top band the strip publishes while it is up (`--hk-sheet-top-
/// inset`): the strip's own height, with one gap above and one below —
/// the lowest line a mobile bottom sheet may reach (Vue's `publishBand`;
/// writing the property on <body> is the host's step here).
pub fn modal_breadcrumb_sheet_band(top_px: f64, strip_height_px: f64, top_gap_px: f64) -> f64 {
    top_px + strip_height_px / 2.0 + modal_breadcrumb_top_gap_px(top_gap_px)
}

// ── class names (the DOM contract, pinned by the tests) ─────────────────

/// One crumb's item class string; the current layer carries the accent
/// (Vue's `itemClass`).
pub fn modal_breadcrumb_item_classes(current: bool) -> String {
    if current {
        "hk-modal-breadcrumb-item hk-modal-breadcrumb-item-current".to_string()
    } else {
        "hk-modal-breadcrumb-item".to_string()
    }
}

/// A truncated label's tappable form (Vue: `` `${itemClass} hk-modal-
/// breadcrumb-item-reveal` `` — the reveal class rides AFTER the item
/// pair, current accent included).
pub fn modal_breadcrumb_reveal_classes(current: bool) -> String {
    format!(
        "{} hk-modal-breadcrumb-item-reveal",
        modal_breadcrumb_item_classes(current)
    )
}

/// The chevron host: the svg markup rides a `display:contents` span (the
/// crate-wide SVG rule — see the header), the class staying on the
/// `<svg>` itself exactly like Vue's.
fn modal_breadcrumb_separator_node() -> VNode {
    VNode::Element(Box::new(
        VElement::new("span")
            .attr("style", "display:contents")
            .dangerous_inner_html(MODAL_BREADCRUMB_SEP_SVG),
    ))
}

// ── props ───────────────────────────────────────────────────────────────

#[define_props]
pub struct ModalBreadcrumbProps {
    /// The popup stack, straight from the host's registry (Vue reads the
    /// popup manager's); only the window-like layers join — see
    /// [`modal_breadcrumb_stack`].
    #[default]
    pub layers: Vec<ModalBreadcrumbLayer>,

    /// Longest a layer label may render, in full-width glyph units (Vue:
    /// `maxLabelUnits`, default 10).
    #[default(MODAL_BREADCRUMB_DEFAULT_MAX_LABEL_UNITS)]
    pub max_label_units: f64,

    /// Least daylight between the app's top edge and the strip's (Vue:
    /// `topGap`, default 12; non-finite falls back to it).
    #[default(MODAL_BREADCRUMB_DEFAULT_TOP_GAP_PX)]
    pub top_gap: f64,

    /// How many LEADING layers sit behind the "…" trigger (Vue's
    /// `hiddenCount` ref — controlled here; the pure
    /// [`modal_breadcrumb_fold_count`] computes it from measurements).
    /// Clamped so the last layer is never folded away.
    #[default]
    pub hidden_count: usize,

    /// The all-layers menu's visibility (Vue's `menuOpen` ref). While
    /// open, the trigger stays mounted even when nothing is folded.
    #[default]
    pub menu_open: bool,

    /// The truncated label whose whole name is revealed (Vue's `revealed`
    /// ref, by crumb id); the surface renders only while the id names a
    /// TRUNCATED crumb still on the stack (Vue's watcher contract).
    pub revealed_id: Option<String>,

    /// The strip's inline `top` (Vue's `topPx` ref). `None` paints on the
    /// fallback geometry ([`modal_breadcrumb_fallback_top`]).
    pub strip_top_px: Option<f64>,

    /// The viewport fence as local px (Vue's `maxWidthPx` ref — the sheet
    /// keeps its own `100vw` fence when `None`).
    pub max_width_px: Option<f64>,

    /// The trigger rect the menu popover anchors against (Vue wires the
    /// trigger's own ref; the mirrored Popover takes geometry).
    pub menu_anchor: Option<PopoverAnchorRect>,

    /// The crumb rect the reveal popover anchors against.
    pub reveal_anchor: Option<PopoverAnchorRect>,

    /// The "…" trigger was pressed (Vue's `openMenu` — which also closes
    /// any open reveal; the host owns that mutual exclusion).
    pub on_open_menu: Option<EventHandler<()>>,

    /// The all-layers menu asked to close (its popover's
    /// `update:modelValue(false)` — backdrop, grabber, Escape).
    pub on_close_menu: Option<EventHandler<()>>,

    /// A truncated, visible crumb was pressed (Vue's `toggleReveal` — the
    /// host toggles `revealed_id`, closing the menu when it opens one).
    pub on_toggle_reveal: Option<EventHandler<String>>,

    /// The reveal surface asked to close.
    pub on_reveal_close: Option<EventHandler<()>>,

    /// A layer was chosen from the all-layers menu (Vue's `selectLayer` →
    /// `manager.closeAbove(id)`): everything stacked ABOVE that layer is
    /// asked to close, top-down — the host owns the close channels.
    pub on_navigate: Option<EventHandler<String>>,
}

// ── render assembly (no decision maths below this line) ─────────────────

/// The measurement clone: EVERY layer at its natural width, plus the
/// "…" trigger, out of flow and out of the a11y tree — the strip's own
/// ruler (see the header delta).
fn modal_breadcrumb_measure_clone(crumbs: &[ModalBreadcrumbCrumb]) -> VNode {
    let mut host = VElement::new("div")
        .class("hk-modal-breadcrumb-measure")
        .attr("aria-hidden", "true");
    for (index, crumb) in crumbs.iter().enumerate() {
        let mut clone = VElement::new("span").class("hk-modal-breadcrumb-crumb");
        if index > 0 {
            clone = clone.child(modal_breadcrumb_separator_node());
        }
        clone = clone.child(VNode::Element(Box::new(
            VElement::new("span")
                .class(modal_breadcrumb_item_classes(crumb.current))
                .child(VNode::Text(VText::new(crumb.text.as_str()))),
        )));
        host = host.child(VNode::Element(Box::new(clone)));
    }
    // The trigger clone: the fold's own width, measured the same way.
    host = host.child(VNode::Element(Box::new(
        VElement::new("span")
            .class("hk-modal-breadcrumb-crumb")
            .child(VNode::Element(Box::new(
                VElement::new("span")
                    .class("hk-modal-breadcrumb-more")
                    .child(VNode::Text(VText::new(MODAL_BREADCRUMB_ELLIPSIS))),
            ))),
    )));
    VNode::Element(Box::new(host))
}

/// The "…" trigger (folded layers, or the menu it opens).
fn modal_breadcrumb_trigger(props: &ModalBreadcrumbProps) -> VNode {
    let expanded = if props.menu_open { "true" } else { "false" };
    let on_open_menu = props.on_open_menu.clone();
    let mut button = VElement::new("button")
        .class("hk-modal-breadcrumb-more")
        .attr("type", "button")
        .attr("aria-haspopup", "dialog")
        .attr("aria-expanded", expanded)
        .attr(
            "aria-label",
            t("components.hk.modalBreadcrumb.allLayers", "All layers"),
        )
        .on_click(move |_event: MouseEvent| {
            if let Some(handler) = on_open_menu.as_ref() {
                handler.call(());
            }
        });
    button = button.child(VNode::Text(VText::new(MODAL_BREADCRUMB_ELLIPSIS)));
    VNode::Element(Box::new(
        VElement::new("span")
            .class("hk-modal-breadcrumb-crumb")
            .child(VNode::Element(Box::new(button))),
    ))
}

/// The visible tail: the unfolded crumbs, each tappable when its label
/// was cut (the full name is the button's accessible name — a cut string
/// is not a name).
fn modal_breadcrumb_tail(
    crumbs: &[ModalBreadcrumbCrumb],
    trigger_shown: bool,
    revealed_id: Option<&str>,
    on_toggle_reveal: &Option<EventHandler<String>>,
) -> Vec<VNode> {
    let mut nodes = Vec::with_capacity(crumbs.len());
    for (index, crumb) in crumbs.iter().enumerate() {
        let mut span = VElement::new("span").class("hk-modal-breadcrumb-crumb");
        // A chevron separates two items — the FIRST rendered item carries
        // none, whether or not the trigger precedes it (Vue:
        // `triggerShown || i > 0`).
        if trigger_shown || index > 0 {
            span = span.child(modal_breadcrumb_separator_node());
        }
        let expanded = if revealed_id == Some(crumb.id.as_str()) {
            "true"
        } else {
            "false"
        };
        let body = if crumb.truncated {
            let id = crumb.id.clone();
            let handler = on_toggle_reveal.clone();
            VNode::Element(Box::new(
                VElement::new("button")
                    .class(modal_breadcrumb_reveal_classes(crumb.current))
                    .attr("type", "button")
                    .attr("aria-haspopup", "dialog")
                    .attr("aria-expanded", expanded)
                    .attr("aria-label", crumb.label.clone())
                    .child(VNode::Text(VText::new(crumb.text.as_str())))
                    .on_click(move |_event: MouseEvent| {
                        if let Some(handler) = handler.as_ref() {
                            handler.call(id.clone());
                        }
                    }),
            ))
        } else {
            VNode::Element(Box::new(
                VElement::new("span")
                    .class(modal_breadcrumb_item_classes(crumb.current))
                    .child(VNode::Text(VText::new(crumb.text.as_str()))),
            ))
        };
        span = span.child(body);
        nodes.push(VNode::Element(Box::new(span)));
    }
    nodes
}

#[component]
pub fn ModalBreadcrumb(props: ModalBreadcrumbProps) -> Element {
    let stack = modal_breadcrumb_stack(&props.layers);
    // Vue's `visible`: the strip exists only with a real stack to cross.
    if stack.len() <= 1 {
        return empty_vnode();
    }
    let crumbs = modal_breadcrumb_crumbs(&stack, props.max_label_units);

    // The fold, clamped so the last layer always keeps the strip.
    let hidden = props.hidden_count.min(crumbs.len() - 1);
    let folded = hidden > 0;
    let trigger_shown = folded || props.menu_open;
    let tail: Vec<ModalBreadcrumbCrumb> = crumbs[hidden..].to_vec();

    let top_px = props
        .strip_top_px
        .unwrap_or_else(|| modal_breadcrumb_fallback_top(props.top_gap));
    let mut strip_style = format!("top:{}px", top_px);
    if let Some(max_width) = props.max_width_px {
        strip_style.push_str(&format!(";max-width:{max_width}px"));
    }

    let mut nav = VElement::new("nav")
        .class("hk-modal-breadcrumb")
        .attr(
            "aria-label",
            t("components.hk.modalBreadcrumb.stackLabel", "Window layers"),
        )
        .attr("aria-live", "polite")
        .style(strip_style);
    nav = nav.child(modal_breadcrumb_measure_clone(&crumbs));
    if trigger_shown {
        nav = nav.child(modal_breadcrumb_trigger(&props));
    }
    for node in modal_breadcrumb_tail(
        &tail,
        trigger_shown,
        props.revealed_id.as_deref(),
        &props.on_toggle_reveal,
    ) {
        nav = nav.child(node);
    }

    // ── the all-layers menu (mirrored Popover + the menu-row hooks) ────
    let menu_label = t("components.hk.modalBreadcrumb.allLayers", "All layers");
    let mut menu_rows = Vec::with_capacity(crumbs.len());
    for (index, crumb) in crumbs.iter().rev().enumerate() {
        let id = crumb.id.clone();
        let on_navigate = props.on_navigate.clone();
        let mut row = VElement::new("button")
            .class("hk-menu-action-item")
            .attr("type", "button")
            .attr("role", "menuitem");
        if index == 0 {
            row = row.attr("data-active", "true");
        }
        row = row
            .child(VNode::Element(Box::new(
                VElement::new("span")
                    .class("hk-menu-action-item__label")
                    .child(VNode::Text(VText::new(crumb.label.as_str()))),
            )))
            .on_click(move |_event: MouseEvent| {
                // Picking the current layer (nothing above it) just
                // dismisses the menu; picking any other asks the host to
                // close everything above it, top-down.
                if let Some(handler) = on_navigate.as_ref() {
                    handler.call(id.clone());
                }
            });
        menu_rows.push(VNode::Element(Box::new(row)));
    }
    let menu_list = VElement::new("div")
        .class("hk-menu-list")
        .attr("role", "menu")
        .attr("aria-label", menu_label.clone())
        .children(menu_rows);

    let on_close_menu = props.on_close_menu.clone();
    let menu_popover = Popover(PopoverProps {
        open: props.menu_open,
        placement: PopoverPlacement::BottomStart,
        // 16px clears the strip's 12px padding plus its 1px border (the
        // trigger sits inside the padding box; 4px would tuck the menu's
        // first pixels under the strip's own bar).
        offset: 16.0,
        sheet_on_mobile: true,
        title: menu_label,
        class: "hk-modal-breadcrumb-menu".to_string(),
        anchor: props.menu_anchor,
        on_open_change: Some(EventHandler::new(move |open: bool| {
            // The popover only ever asks to CLOSE here (open rides the
            // trigger's own on_open_menu channel).
            if !open {
                if let Some(handler) = on_close_menu.as_ref() {
                    handler.call(());
                }
            }
        })),
        children: VNode::Element(Box::new(menu_list)),
        ..Default::default()
    });

    // ── the truncated-name reveal ──────────────────────────────────────
    // Open only while the id names a TRUNCATED crumb still on the stack
    // (Vue's watcher: the layer gone, or its name no longer cut, closes
    // the surface; a retitle follows the live name for free).
    let revealed = props.revealed_id.as_deref().and_then(|id| {
        crumbs
            .iter()
            .find(|crumb| crumb.id == id && crumb.truncated)
    });
    let on_reveal_close = props.on_reveal_close.clone();
    let reveal_popover = Popover(PopoverProps {
        open: revealed.is_some(),
        placement: PopoverPlacement::BottomStart,
        offset: 16.0,
        sheet_on_mobile: true,
        // The name is the surface's reason to exist, so it names it.
        title: revealed
            .map(|crumb| crumb.label.clone())
            .unwrap_or_default(),
        anchor: props.reveal_anchor,
        on_open_change: Some(EventHandler::new(move |open: bool| {
            if !open {
                if let Some(handler) = on_reveal_close.as_ref() {
                    handler.call(());
                }
            }
        })),
        children: match revealed {
            Some(crumb) => VNode::Element(Box::new(
                VElement::new("p")
                    .class("hk-modal-breadcrumb-reveal")
                    .child(VNode::Text(VText::new(crumb.label.as_str()))),
            )),
            None => empty_vnode(),
        },
        ..Default::default()
    });

    VNode::Fragment(vec![
        VNode::Element(Box::new(nav)),
        menu_popover,
        reveal_popover,
    ])
}

impl StyledComponent for ModalBreadcrumbComponent {
    fn styles() -> &'static str {
        // The canonical Vue sheet, compiled verbatim (no_hash keeps the
        // `.hk-modal-breadcrumb*` names literal so this CSS matches the
        // Vue build).
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkModalBreadcrumb.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "modal-breadcrumb"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn layer(id: &str, kind: &str, z: i64, title: &str) -> ModalBreadcrumbLayer {
        ModalBreadcrumbLayer::new(id, kind, z, title)
    }

    fn long_stack() -> Vec<ModalBreadcrumbLayer> {
        vec![
            layer("root", "modal", 1000, "Root window"),
            layer("mid", "modal", 1002, "Mid"),
            layer("top", "modal", 1004, "Top"),
        ]
    }

    /// A stack whose first layer's name overruns the 10-unit budget (17
    /// half-width units), so it renders as a truncated, tappable crumb.
    fn truncating_stack() -> Vec<ModalBreadcrumbLayer> {
        vec![
            layer("root", "modal", 1000, "Root window with a very long title"),
            layer("mid", "modal", 1002, "Mid"),
            layer("top", "modal", 1004, "Top"),
        ]
    }

    // ── props defaults ─────────────────────────────────────────────────

    #[test]
    fn modal_breadcrumb_defaults_match_the_vue_props() {
        let props = ModalBreadcrumbProps::default();
        assert!(props.layers.is_empty());
        assert_eq!(
            props.max_label_units,
            MODAL_BREADCRUMB_DEFAULT_MAX_LABEL_UNITS
        );
        assert_eq!(props.top_gap, MODAL_BREADCRUMB_DEFAULT_TOP_GAP_PX);
        assert_eq!(props.hidden_count, 0);
        assert!(!props.menu_open);
        assert!(props.revealed_id.is_none());
        assert!(props.strip_top_px.is_none());
        assert!(props.max_width_px.is_none());
        assert!(props.menu_anchor.is_none());
        assert!(props.reveal_anchor.is_none());
        assert!(props.on_open_menu.is_none());
        assert!(props.on_close_menu.is_none());
        assert!(props.on_toggle_reveal.is_none());
        assert!(props.on_reveal_close.is_none());
        assert!(props.on_navigate.is_none());

        let layer = ModalBreadcrumbLayer::default();
        assert_eq!(layer.id, "");
        assert_eq!(layer.kind, "");
        assert!(!layer.blocking);
        assert_eq!(layer.z_index, 0);
        assert!(layer.title.is_none());
    }

    // ── the display-width clamp (pure) ────────────────────────────────

    #[test]
    fn modal_breadcrumb_glyph_units_match_the_vue_tables() {
        // Full-width: CJK ideographs, kana, hangul, full-width punctuation.
        assert_eq!(modal_breadcrumb_glyph_units('备'), 1.0);
        assert_eq!(modal_breadcrumb_glyph_units('あ'), 1.0);
        assert_eq!(modal_breadcrumb_glyph_units('한'), 1.0);
        assert_eq!(modal_breadcrumb_glyph_units('，'), 1.0);
        // Astral: an emoji counts once, whole.
        assert_eq!(modal_breadcrumb_glyph_units('🌟'), 1.0);
        assert_eq!(modal_breadcrumb_glyph_units('\u{20000}'), 1.0);
        // Half-width: Latin, digits, half punctuation.
        assert_eq!(modal_breadcrumb_glyph_units('a'), 0.5);
        assert_eq!(modal_breadcrumb_glyph_units('Z'), 0.5);
        assert_eq!(modal_breadcrumb_glyph_units('7'), 0.5);
        assert_eq!(modal_breadcrumb_glyph_units(' '), 0.5);
        // Zero-width: combining marks and variation selectors.
        assert_eq!(modal_breadcrumb_glyph_units('\u{0301}'), 0.0);
        assert_eq!(modal_breadcrumb_glyph_units('\u{FE0F}'), 0.0);
        // The ellipsis is WIDE: one full unit.
        assert_eq!(modal_breadcrumb_glyph_units('\u{2026}'), 1.0);
    }

    #[test]
    fn modal_breadcrumb_display_units_sums_scalars() {
        assert_eq!(modal_breadcrumb_display_units(""), 0.0);
        // Twenty Latin glyphs == ten ideographs (the clamp's premise).
        assert_eq!(modal_breadcrumb_display_units("abcdefghijklmnopqrst"), 10.0);
        assert_eq!(modal_breadcrumb_display_units("自动化测试流水线冒烟"), 10.0);
        // A combining mark rides along without budget.
        assert_eq!(modal_breadcrumb_display_units("e\u{0301}"), 0.5);
    }

    #[test]
    fn modal_breadcrumb_clamp_label_keeps_the_ellipsis_inside_the_budget() {
        // Already fitting: byte-for-byte, so callers diff for truncated.
        let short = "自动化测试";
        assert_eq!(modal_breadcrumb_clamp_label(short, 10.0), short);
        // Ten ideographs cap → nine ideographs plus the ellipsis.
        assert_eq!(
            modal_breadcrumb_clamp_label("自动化测试流水线冒烟请巡检", 10.0),
            "自动化测试流水线冒\u{2026}"
        );
        // Latin cuts at double the length for the same budget.
        assert_eq!(
            modal_breadcrumb_clamp_label("abcdefghijklmnopqrstuvwxyz", 5.0),
            "abcdefgh\u{2026}"
        );
        // A cut after trailing whitespace pulls the whitespace back.
        assert_eq!(
            modal_breadcrumb_clamp_label("你好世界 世界", 6.0),
            "你好世界\u{2026}"
        );
        // The ellipsis is a full unit: a 1-unit budget keeps ONLY it.
        assert_eq!(modal_breadcrumb_clamp_label("abcd", 1.0), "\u{2026}");
        // A non-positive cap yields the empty string.
        assert_eq!(modal_breadcrumb_clamp_label("abc", 0.0), "");
    }

    // ── the stack and its crumbs (pure) ───────────────────────────────

    #[test]
    fn modal_breadcrumb_stack_filters_and_sorts_like_the_registry() {
        let layers = vec![
            layer("top", "modal", 1004, "Top"),
            layer("menu", "dropdown", 1005, "Anchored menu"),
            // The docked sheet: a dropdown-kind surface in its BLOCKING
            // form (`ModalBreadcrumbLayer::new` defaults blocking=false,
            // the anchored-menu shape).
            ModalBreadcrumbLayer {
                blocking: true,
                ..layer("sheet", "dropdown", 1003, "Docked sheet")
            },
            layer("mid", "modal", 1002, "Mid"),
            layer("plain", "tooltip", 1006, "Never"),
        ];
        let stack = modal_breadcrumb_stack(&layers);
        // Windows always join; a dropdown joins only while it blocks
        // (the sheet above); the anchored menu and tooltip never do.
        assert_eq!(
            stack.iter().map(|l| l.id.as_str()).collect::<Vec<_>>(),
            vec!["mid", "sheet", "top"]
        );

        assert!(modal_breadcrumb_layer_joins_stack("modal", false));
        assert!(modal_breadcrumb_layer_joins_stack("drawer", false));
        assert!(!modal_breadcrumb_layer_joins_stack("dropdown", false));
        assert!(modal_breadcrumb_layer_joins_stack("dropdown", true));
        // Toasts never carry the blocking flag in the registry — only a
        // dropdown-kind surface ever docks as a blocking sheet — so the
        // never-window kinds stay out in every reachable state.
        assert!(!modal_breadcrumb_layer_joins_stack("toast", false));
    }

    #[test]
    fn modal_breadcrumb_crumbs_carry_labels_clamps_and_current() {
        let stack = vec![
            layer("root", "modal", 1000, "Root window with a very long title"),
            layer("top", "dropdown", 1002, "菜单"),
        ];
        let crumbs = modal_breadcrumb_crumbs(&stack, 10.0);
        assert_eq!(crumbs.len(), 2);
        assert_eq!(crumbs[0].id, "root");
        assert_eq!(crumbs[0].label, "Root window with a very long title");
        assert!(crumbs[0].truncated);
        assert!(!crumbs[0].current);
        assert!(crumbs[1].current);
        assert_eq!(crumbs[1].label, "菜单");
        assert_eq!(crumbs[1].text, "菜单");
        assert!(!crumbs[1].truncated);

        // Unnamed layers read as their KIND, never "Layer N".
        let unnamed = vec![
            ModalBreadcrumbLayer {
                id: "w".to_string(),
                kind: "modal".to_string(),
                z_index: 1000,
                ..Default::default()
            },
            ModalBreadcrumbLayer {
                id: "d".to_string(),
                kind: "dropdown".to_string(),
                z_index: 1002,
                ..Default::default()
            },
        ];
        let crumbs = modal_breadcrumb_crumbs(&unnamed, 10.0);
        assert_eq!(crumbs[0].label, "Window");
        assert_eq!(crumbs[1].label, "Menu");
        assert_eq!(modal_breadcrumb_unnamed_label("modal"), "Window");
    }

    // ── the overflow collapse (pure) ──────────────────────────────────

    #[test]
    fn modal_breadcrumb_fold_count_folds_leading_layers_never_the_last() {
        // Three 100px crumbs, 8px gaps, 24px trigger.
        let widths = [100.0, 100.0, 100.0];
        // The whole strip fits: nothing folds.
        assert_eq!(modal_breadcrumb_fold_count(&widths, 24.0, 8.0, 400.0), 0);
        // Trigger + tail of two fits: fold one.
        assert_eq!(modal_breadcrumb_fold_count(&widths, 24.0, 8.0, 300.0), 1);
        // Only trigger + last crumb fits: fold two (n - 1).
        assert_eq!(modal_breadcrumb_fold_count(&widths, 24.0, 8.0, 200.0), 2);
        // Even the last crumb alone overflows: it still keeps the strip.
        assert_eq!(modal_breadcrumb_fold_count(&widths, 24.0, 8.0, 50.0), 2);
        // A single crumb never folds; an infinite budget never folds.
        assert_eq!(modal_breadcrumb_fold_count(&[500.0], 24.0, 8.0, 10.0), 0);
        assert_eq!(
            modal_breadcrumb_fold_count(&widths, 24.0, 8.0, f64::INFINITY),
            0
        );
        // The width bookkeeping: gaps sit BETWEEN crumbs, n - 1 of them.
        assert_eq!(modal_breadcrumb_strip_width(&widths, 8.0), 316.0);
        assert_eq!(modal_breadcrumb_strip_width(&[], 8.0), 0.0);
    }

    #[test]
    fn modal_breadcrumb_crumb_footprint_counts_its_own_box_only() {
        // The first crumb is its label alone (12px per full-width unit).
        assert_eq!(
            modal_breadcrumb_crumb_footprint("自动化", 0, 8.0, 1.0),
            36.0
        );
        // A follower adds the chevron and its own inner gap, but never
        // the strip's inter-crumb gap (a different box — counting it here
        // too would count every gap after the first twice).
        assert_eq!(
            modal_breadcrumb_crumb_footprint("自", 1, 8.0, 1.0),
            12.0 + 12.0 + 8.0
        );
        // Everything is authored in LOCAL px and scales with the zoom.
        assert_eq!(modal_breadcrumb_crumb_footprint("自", 0, 8.0, 2.0), 24.0);
        // A hostile zoom falls back to identity instead of NaN.
        assert_eq!(modal_breadcrumb_crumb_footprint("自", 0, 8.0, 0.0), 12.0);
        assert_eq!(
            modal_breadcrumb_crumb_footprint("自", 0, 8.0, f64::NAN),
            12.0
        );
    }

    #[test]
    fn modal_breadcrumb_budget_top_and_band_follow_the_vue_geometry() {
        // No viewport yet: no budget at all (never fold on a boxless DOM).
        assert!(modal_breadcrumb_content_budget(0.0, 16.0, 1.0, 64.0, 2.0).is_infinite());
        // vw - 2·gutter·z - padding·z - border·z.
        assert_eq!(
            modal_breadcrumb_content_budget(1000.0, 16.0, 1.0, 64.0, 2.0),
            902.0
        );
        assert_eq!(
            modal_breadcrumb_content_budget(1000.0, 16.0, 2.0, 64.0, 2.0),
            804.0
        );
        // Centre on the header, but never above the promised daylight:
        // whichever candidate parks the strip LOWER wins (the standard
        // short header centres ABOVE the clearance, so clearance wins).
        assert_eq!(modal_breadcrumb_strip_top(0.0, 48.0, 43.0, 12.0), 33.5);
        assert_eq!(modal_breadcrumb_strip_top(0.0, 20.0, 43.0, 12.0), 33.5);
        // A tall header centres BELOW the clearance, so centring wins.
        assert_eq!(modal_breadcrumb_strip_top(0.0, 100.0, 43.0, 12.0), 50.0);
        assert_eq!(modal_breadcrumb_strip_top(5.0, 100.0, 43.0, 12.0), 55.0);
        // The pre-resync paint position and the sheet band promise.
        assert_eq!(modal_breadcrumb_fallback_top(12.0), 33.5);
        assert_eq!(modal_breadcrumb_fallback_top(f64::NAN), 33.5);
        assert_eq!(modal_breadcrumb_top_gap_px(f64::NAN), 12.0);
        assert_eq!(modal_breadcrumb_top_gap_px(-5.0), -5.0);
        assert_eq!(modal_breadcrumb_sheet_band(24.0, 43.0, 12.0), 57.5);
    }

    // ── class-name mapping ────────────────────────────────────────────

    #[test]
    fn modal_breadcrumb_layout_constants_are_the_sheets_own_numbers() {
        // The numbers the strip's own stylesheet declares — a boxless DOM
        // (and a host feeding [`modal_breadcrumb_content_budget`]) is
        // judged with these, never with guesses.
        assert_eq!(MODAL_BREADCRUMB_LABEL_FONT_PX, 12.0);
        assert_eq!(MODAL_BREADCRUMB_SEPARATOR_PX, 12.0);
        assert_eq!(MODAL_BREADCRUMB_GAP_PX, 8.0);
        assert_eq!(MODAL_BREADCRUMB_SIDE_PADDING_PX, 32.0);
        assert_eq!(MODAL_BREADCRUMB_BORDER_PX, 1.0);
        assert_eq!(MODAL_BREADCRUMB_MORE_PX, 24.0);
        assert_eq!(MODAL_BREADCRUMB_STRIP_HEIGHT_PX, 43.0);
        assert_eq!(MODAL_BREADCRUMB_DEFAULT_TOP_GAP_PX, 12.0);
        assert_eq!(MODAL_BREADCRUMB_DEFAULT_MAX_LABEL_UNITS, 10.0);
        assert_eq!(MODAL_BREADCRUMB_ELLIPSIS, "\u{2026}");
    }

    #[test]
    fn modal_breadcrumb_class_names_match_the_vue_sheet() {
        assert_eq!(
            modal_breadcrumb_item_classes(false),
            "hk-modal-breadcrumb-item"
        );
        assert_eq!(
            modal_breadcrumb_item_classes(true),
            "hk-modal-breadcrumb-item hk-modal-breadcrumb-item-current"
        );
        assert_eq!(
            modal_breadcrumb_reveal_classes(true),
            "hk-modal-breadcrumb-item hk-modal-breadcrumb-item-current hk-modal-breadcrumb-item-reveal"
        );
        assert_eq!(
            modal_breadcrumb_reveal_classes(false),
            "hk-modal-breadcrumb-item hk-modal-breadcrumb-item-reveal"
        );
        assert!(
            MODAL_BREADCRUMB_SEP_SVG
                .starts_with(r#"<svg class="hk-modal-breadcrumb-sep" width="12" height="12""#)
        );
    }

    // ── DOM contract ──────────────────────────────────────────────────

    #[test]
    fn modal_breadcrumb_renders_the_unfolded_strip() {
        let html = ModalBreadcrumb(ModalBreadcrumbProps {
            layers: long_stack(),
            strip_top_px: Some(24.0),
            max_width_px: Some(600.0),
            ..Default::default()
        })
        .render_to_html();

        for needle in [
            r#"class="hk-modal-breadcrumb""#,
            r#"aria-label="Window layers""#,
            r#"aria-live="polite""#,
            "top:24px",
            "max-width:600px",
            r#"class="hk-modal-breadcrumb-measure""#,
            r#"aria-hidden="true""#,
            r#"class="hk-modal-breadcrumb-crumb""#,
            r#"class="hk-modal-breadcrumb-sep""#,
            r#"class="hk-modal-breadcrumb-item hk-modal-breadcrumb-item-current""#,
            ">Top</span>",
            ">Root window</span>",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        // Unfolded, no menu: no trigger, no tail reveal buttons, no popovers
        // (every title here fits the 10-unit budget whole).
        assert!(!html.contains(r#"aria-label="All layers""#), "{html}");
        assert!(!html.contains("hk-modal-breadcrumb-item-reveal"), "{html}");
        assert!(!html.contains("hk-popover-panel"), "{html}");
        // The ruler carries every layer PLUS the trigger clone; the tail
        // renders them again: 3 clone crumbs + 1 clone trigger + 3 tail.
        assert_eq!(
            html.matches(r#"class="hk-modal-breadcrumb-crumb""#).count(),
            7,
            "{html}"
        );
        assert!(
            html.matches("hk-modal-breadcrumb-sep").count() >= 2,
            "{html}"
        );
        assert!(!html.contains("aria-label=\"Root window"), "{html}");
    }

    #[test]
    fn modal_breadcrumb_renders_the_folded_tail_with_its_trigger() {
        let html = ModalBreadcrumb(ModalBreadcrumbProps {
            layers: long_stack(),
            hidden_count: 2,
            ..Default::default()
        })
        .render_to_html();

        for needle in [
            r#"class="hk-modal-breadcrumb-more""#,
            r#"type="button""#,
            r#"aria-haspopup="dialog""#,
            r#"aria-expanded="false""#,
            r#"aria-label="All layers""#,
            ">Top</span>",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        // The first layer still lays out inside the hidden ruler.
        assert!(html.contains("Root window"), "{html}");
        // The fallback top paints (topGap 12 + 43/2).
        assert!(html.contains("top:33.5px"), "{html}");
        // No menu open, nothing truncated in the tail: no reveal button.
        assert!(!html.contains("hk-modal-breadcrumb-item-reveal"), "{html}");
    }

    #[test]
    fn modal_breadcrumb_renders_truncated_labels_as_reveal_buttons() {
        let html = ModalBreadcrumb(ModalBreadcrumbProps {
            layers: truncating_stack(),
            ..Default::default()
        })
        .render_to_html();

        for needle in [
            r#"class="hk-modal-breadcrumb-item hk-modal-breadcrumb-item-reveal""#,
            // The FULL name is the button's accessible name (a cut string
            // is not a name)…
            r#"aria-label="Root window with a very long title""#,
            // …while the strip renders the cut (18 half-width glyphs fit
            // the 10-unit budget of 9 + the ellipsis).
            ">Root window with a\u{2026}</button>",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        // The current layer is whole: no reveal button on it.
        assert_eq!(
            html.matches("hk-modal-breadcrumb-item-reveal").count(),
            1,
            "{html}"
        );
    }

    #[test]
    fn modal_breadcrumb_renders_the_menu_and_the_reveal_surfaces() {
        let html = ModalBreadcrumb(ModalBreadcrumbProps {
            layers: truncating_stack(),
            menu_open: true,
            revealed_id: Some("root".to_string()),
            menu_anchor: Some(PopoverAnchorRect {
                x: 40.0,
                y: 12.0,
                width: 24.0,
                height: 24.0,
            }),
            reveal_anchor: Some(PopoverAnchorRect {
                x: 80.0,
                y: 12.0,
                width: 60.0,
                height: 24.0,
            }),
            ..Default::default()
        })
        .render_to_html();

        // The menu popover, its inset class, and the rows: topmost first,
        // the current layer on the selected face. The menu being open
        // keeps the trigger mounted even though nothing is folded.
        for needle in [
            "hk-modal-breadcrumb-menu",
            r#"class="hk-menu-list""#,
            r#"role="menu""#,
            r#"class="hk-menu-action-item""#,
            r#"role="menuitem""#,
            r#"class="hk-menu-action-item__label""#,
            r#"data-active="true""#,
            "hk-popover-bottom-start",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        assert_eq!(
            html.matches(r#"class="hk-menu-action-item""#).count(),
            3,
            "{html}"
        );
        // The menu's aria-expanded flips with it.
        assert!(html.contains(r#"aria-expanded="true""#), "{html}");
        // The reveal surface carries the whole name, twice: as the
        // surface's own title and as its wrapping body line.
        assert_eq!(
            html.matches("hk-modal-breadcrumb-reveal").count(),
            1,
            "{html}"
        );
        assert!(
            html.contains("Root window with a very long title"),
            "{html}"
        );
    }

    #[test]
    fn modal_breadcrumb_renders_nothing_below_two_layers() {
        let single = ModalBreadcrumb(ModalBreadcrumbProps {
            layers: vec![layer("only", "modal", 1000, "Only")],
            ..Default::default()
        })
        .render_to_html();
        assert!(!single.contains("hk-modal-breadcrumb"), "{single}");

        // An anchored dropdown never joins, so it cannot lift the strip.
        let anchored = ModalBreadcrumb(ModalBreadcrumbProps {
            layers: vec![
                layer("only", "modal", 1000, "Only"),
                layer("menu", "dropdown", 1002, "Menu"),
            ],
            ..Default::default()
        })
        .render_to_html();
        assert!(
            !anchored.contains(r#"class="hk-modal-breadcrumb""#),
            "{anchored}"
        );
    }

    #[test]
    fn modal_breadcrumb_styles_come_from_the_canonical_vue_sheet() {
        let css = ModalBreadcrumbComponent::styles();
        for needle in [
            ".hk-modal-breadcrumb",
            ".hk-modal-breadcrumb-measure",
            ".hk-modal-breadcrumb-more",
            ".hk-modal-breadcrumb-sep",
            ".hk-modal-breadcrumb-item-reveal",
            ".hk-modal-breadcrumb-reveal",
            ".hk-modal-breadcrumb-menu",
        ] {
            assert!(
                css.contains(needle),
                "modal-breadcrumb css must carry the vue hook {needle}"
            );
        }
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored modal-breadcrumb sheet"
        );
        assert_eq!(ModalBreadcrumbComponent::name(), "modal-breadcrumb");
    }
}
