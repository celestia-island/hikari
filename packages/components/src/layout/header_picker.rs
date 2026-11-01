// hi-components/src/layout/header_picker.rs
// HeaderPicker — mirror of the canonical Vue `HkHeaderPicker`: the
// header-centre SELECTOR (the mirror twin of the bottom-centre pickers) with
// the standardized per-row maintenance verbs.
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkHeaderPicker.scss`, vendored under
// `src/styles/vue-mirror/` and guarded by `tests/vue_mirror_drift_tests.rs`),
// compiled with `no_hash` so the `.hk-header-picker*` class names are literal
// and identical in both forms. The sheet is a DELTA layer by design: the
// trigger reuses the family's dropdown chrome (`.hk-select-trigger`,
// `.hk-select-value`, `.hk-select-arrow`) and the opened surface is
// `HkSelectPanel`'s (`.hk-select-popout*`) — both painted by the canonical
// `HkSelect.scss`, which the Vue component imports through the panel and which
// `basic/select.rs` compiles into the same bundle. DOM contract:
//
//   div.hk-header-picker [host class]         (style: position:relative — the
//                                              containing block for the
//                                              unmeasured popout arm)
//     button.hk-select-trigger.hk-header-picker-trigger type="button"
//         data-state={open|closed} [data-disabled] [disabled]
//         aria-haspopup="listbox" aria-expanded={true|false} [aria-label]
//       span.hk-select-value {label}          (the placeholder while empty)
//       span[style="display:contents"] > <chevron-down 16 class=hk-select-arrow>
//     ── while open ──
//     div.hk-select-popout-host data-side={…} data-align={…}   (inline geometry)
//       div.hk-select-popout [aria-label]      (keydown: the panel's arrows)
//         div.hk-select-option.hk-header-picker-option     (one per option)
//             data-highlighted data-select-index data-checked data-disabled
//           span.hk-header-picker-option-label {label}
//           span.hk-header-picker-option-actions
//             button.hk-icon-button.hk-icon-button-24.hk-icon-button-ghost
//                 [.hk-header-picker-… nothing — the family chrome]  (editable)
//             … the same button again for removable
//         ── reorderable: the rows ride HkDraggableList's lanes ──
//         div.hk-draggable-list role="list" [data-all-locked]
//           div.hk-draggable-list-item role="listitem" [data-locked]
//             span.hk-draggable-list-handle [data-hidden]      (the grip)
//             div.hk-draggable-list-content > the option row above
//
// Vue prop mapping: `modelValue` → [`HeaderPickerProps::model_value`],
// `options` → `options` ([`HeaderPickerOption`]), `placeholder`,
// `panelTitle` → `panel_title`, `disabled`, `reorderable`, `placement` →
// [`SelectPanelPlacement`] (Vue default `"bottom-center"`), `ariaLabel` →
// `aria_label`. Emits: `update:modelValue` → `on_value_change`, `edit` →
// `on_edit`, `remove` → `on_remove`, `reorder` → `on_reorder`
// ([`HeaderPickerReorder`]). Vue's local `isOpen` / `highlightedIndex` refs are
// the CONTROLLED [`HeaderPickerProps::open`] /
// [`HeaderPickerProps::highlighted_index`] plus their `on_open_change` /
// `on_highlight_change` writers — tairitsu 0.5.22 has no per-instance component
// state (`use_signal` allocates a fresh signal per render, `use_state` shares
// ONE slot per component type), so the host owns both values exactly as it owns
// `model_value`. Nothing is stored in the component.
//
// Pure surface (tested without a DOM): [`header_display_label`] (Vue's
// `displayLabel`), [`header_step_highlight`] (the wrap-around cursor step),
// [`header_reorder_indices`] (a drag's accepted pair) and
// [`header_popout_style`] (the inline geometry).
//
// Behaviour deltas vs Vue (documented, not accidental):
//   * NO `<Teleport>`, no overlay-root, no popup-manager z-band, no mobile
//     sheet, no auto-flip and no outside-click close: the popout renders in
//     place with inline geometry (`header_popout_style`). With an `anchor` rect
//     it is pinned to the trigger exactly like `basic/select.rs` (the same
//     `select_popout_style` calculation, `matchAnchorWidth={false}`); without
//     one it pins to the picker root's `position:relative` box — which is why
//     the root carries that inline declaration (Vue's root is bare; the panel
//     teleports and needs no containing block). Every other panel behaviour —
//     scrim, grabber, focus trap, back-guard, exit transition, overlay
//     scrollbar — is a document/measurement/animation contract this wave does
//     not mirror. The HOST owns outside dismissal.
//   * NO `scrollIntoView` ON THE HIGHLIGHT: Vue measures the panel and scrolls
//     the highlighted row into view. tairitsu 0.5.22 has no ref/measurement
//     pairing, so the cursor moves without following the scroll.
//   * NO GLOBAL POINTER DRAG: Vue's `HkDraggableList` tracks a pointer across
//     the window (rect measurement, placeholder math, auto-scroll). The mirror
//     keeps the SAME lanes and markers (`role="list"` / `listitem`,
//     `.hk-draggable-list-handle`, `data-locked` / `data-hidden` /
//     `data-all-locked`) and drives a MINIMAL pointer path through a
//     thread-local registry: `pointerdown` on a draggable row arms it,
//     `pointerup` on another row commits `on_reorder` (via
//     [`header_reorder_indices`]), and leaving the list abandons the arm.
//     `data-dragging` / `data-placeholder` are never emitted (no re-render
//     source for a live drag), so the lift/placeholder visuals of Vue's sheet
//     stay dormant.
//   * `pointerenter` highlighting is attached unconditionally. Vue spreads it
//     only for the desktop popout because its sheet branch has no hover; the
//     mirror has no sheet branch, so the form-factor guard has nothing to
//     guard.
//   * `HkDraggableList.scss` is NOT part of this wave's vendored set
//     (`manifest.tsv` lists no such sheet), so `.hk-draggable-list*` reaches
//     the Rust form as DOM hooks — the same deal `basic/kbd.rs` documents.
//   * The verbs' aria labels are Vue literals ("Rename" / "Delete") resolved
//     through the i18n bundle with those exact English fallbacks.
//   * The glyphs (chevron-down 16, pencil 14, trash-2 14, the grip) are lucide
//     `lucide-vue-next` nodes rendered through `dangerous_inner_html` on
//     `display:contents` hosts (`rsx!`'s `svg {}` lands in the HTML namespace
//     in this host stack). Markup, 24-unit viewBox, stroke attributes and the
//     `lucide lucide-{name}-icon lucide-{name}` class pair are the library's own
//     output; the Vue source's `size` becomes the width/height pair.

use std::cell::Cell;

use hikari_i18n::t;
// The prelude curates the tairitsu event set; `PointerEvent` (the drag and
// hover-highlight channel) is not part of it (same import as `basic/select.rs`).
use tairitsu_vdom::PointerEvent;

use crate::basic::select::{
    SelectPanelPlacement, SelectPopoutAlign, SelectPopoutSide, select_popout_style,
};
use crate::basic::{IconButton, IconButtonSize, IconButtonVariant};
use crate::feedback::popover::PopoverAnchorRect;
use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct HeaderPickerComponent;

/// One choice of the picker (Vue: `HkPickerOption`). The three extra flags
/// light the STANDARDIZED per-row verbs, so "manage the dynamic set" pages hang
/// their maintenance actions on this component instead of a bespoke menu each.
#[derive(Clone, PartialEq, Debug, Default)]
pub struct HeaderPickerOption {
    /// Stable identity — the value emitted back to the host.
    pub value: String,

    /// The row text and the trigger's label while selected.
    pub label: String,

    /// Disabled rows render but cannot be selected.
    pub disabled: bool,

    /// Hidden grip: the row never drags (a pinned default), but the handle lane
    /// stays reserved so the column does not jump.
    pub locked: bool,

    /// Show the standardized rename action (emits `edit`).
    pub editable: bool,

    /// Show the standardized delete action (emits `remove`). The picker never
    /// confirms — removal is the HOST's decision.
    pub removable: bool,
}

/// A committed drag reorder (Vue: `reorder(fromIndex, toIndex)`).
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub struct HeaderPickerReorder {
    pub from: usize,
    pub to: usize,
}

/// Vue's `displayLabel`: the placeholder for an empty model, the matching
/// option's label, or the raw value when no option matches.
pub fn header_display_label(
    options: &[HeaderPickerOption],
    model_value: &str,
    placeholder: &str,
) -> String {
    if model_value.is_empty() {
        return placeholder.to_string();
    }
    match options.iter().find(|option| option.value == model_value) {
        Some(option) => option.label.clone(),
        None => model_value.to_string(),
    }
}

/// Vue's `(highlightedIndex ± 1) % length` step. An empty option list has no
/// reachable row: Vue's `% 0` is `NaN`, which also resolves to "nothing", so the
/// mirror reports `-1` (no highlight) — the same rule `basic/select.rs` uses.
pub fn header_step_highlight(current: i32, count: usize, delta: i32) -> i32 {
    if count == 0 {
        return -1;
    }
    (current + delta).rem_euclid(count as i32)
}

/// A drag's accepted `(from, to)` pair: both indices inside the list and not the
/// same row. `None` means "no reorder" (Vue's list drops a no-op drag).
pub fn header_reorder_indices(from: usize, to: usize, len: usize) -> Option<(usize, usize)> {
    if from >= len || to >= len || from == to {
        return None;
    }
    Some((from, to))
}

/// The inline geometry of the `position: fixed` popout host.
///
/// With an anchor rect this IS `basic::select::select_popout_style` with
/// `match_anchor_width = false` (Vue: `matchAnchorWidth={false}` — the header
/// pill mirrors the footer's, whose menu hugs its rows instead of stretching to
/// the trigger). WITHOUT one the surface pins to the nearest POSITIONED
/// ancestor (the picker root carries `position: relative` for that), one
/// `offset` away from the trigger edge. Neither arm measures the panel: the
/// align arm translates, the vertical arms write an edge.
pub fn header_popout_style(
    placement: SelectPanelPlacement,
    anchor: Option<PopoverAnchorRect>,
    offset: f64,
) -> String {
    if let Some(anchor) = anchor {
        return select_popout_style(placement, anchor, offset, false);
    }
    let (side, align) = placement.side_align();
    let mut style = String::from("position:absolute");
    match side {
        SelectPopoutSide::Bottom => style.push_str(&format!(";top:calc(100% + {offset}px)")),
        SelectPopoutSide::Top => style.push_str(&format!(";bottom:calc(100% + {offset}px)")),
    }
    match align {
        SelectPopoutAlign::Start => style.push_str(";left:0"),
        SelectPopoutAlign::Center => style.push_str(";left:50%;transform:translateX(-50%)"),
        SelectPopoutAlign::End => style.push_str(";right:0"),
    }
    style
}

thread_local! {
    /// Which row a pointer drag was armed on. The mirror's stand-in for
    /// HkDraggableList's instance-local `drag` ref; non-reactive by design (it
    /// never drives rendering) and a singleton because one pointer drags one row
    /// at a time in a wasm thread — the same registry pattern as
    /// `basic/slider.rs`'s drag flag.
    static HEADER_DRAG_FROM: Cell<Option<usize>> = const { Cell::new(None) };
}

/// Arm the drag on `index` (Vue: `pointerdown` on the item or its handle).
pub fn header_arm_drag(index: usize) {
    HEADER_DRAG_FROM.with(|from| from.set(Some(index)));
}

/// Take the armed row, leaving the registry empty (Vue: `pointerup`).
pub fn header_take_drag() -> Option<usize> {
    HEADER_DRAG_FROM.with(|from| from.replace(None))
}

/// Abandon an armed drag (Vue: `pointercancel` / leaving the list).
pub fn header_clear_drag() {
    HEADER_DRAG_FROM.with(|from| from.set(None));
}

/// Vue's presence-only marker attribute: `data-*` carries `"true"` while the
/// flag is on and is ABSENT otherwise (a serialized `="false"` reads as a value
/// to a `[data-checked]` selector).
fn marker_attr(flag: bool) -> Option<&'static str> {
    if flag { Some("true") } else { None }
}

/// One lucide glyph, serialized exactly as `lucide-vue-next` renders it:
/// `lucide` + the host's class + the `lucide-{name}-icon` / `lucide-{name}`
/// pair, the 24-unit viewBox, the stroke attribute set and the automatic
/// `aria-hidden="true"` the library adds when no a11y prop is passed.
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

/// lucide `chevron-down`'s path (`<ChevronDown size={16} class="hk-select-arrow" />`).
const LUCIDE_CHEVRON_DOWN_BODY: &str = r#"<path d="m6 9 6 6 6-6"></path>"#;
/// lucide `pencil`'s two paths (the rename verb, `<Pencil size={14} />`).
const LUCIDE_PENCIL_BODY: &str = concat!(
    r#"<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"></path>"#,
    r#"<path d="m15 5 4 4"></path>"#
);
/// lucide `trash-2`'s five paths (the delete verb, `<Trash2 size={14} />`).
const LUCIDE_TRASH2_BODY: &str = concat!(
    r#"<path d="M10 11v6"></path><path d="M14 11v6"></path>"#,
    r#"<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path>"#,
    r#"<path d="M3 6h18"></path>"#,
    r#"<path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>"#
);

/// HkDraggableList's default grip: six 1.2-unit dots on a 14-unit box, filled
/// with `currentColor` (byte-identical to the library's default `handle` slot).
const DRAG_HANDLE_SVG: &str = concat!(
    r#"<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">"#,
    r#"<circle cx="4" cy="3" r="1.2"></circle><circle cx="4" cy="7" r="1.2"></circle>"#,
    r#"<circle cx="4" cy="11" r="1.2"></circle><circle cx="10" cy="3" r="1.2"></circle>"#,
    r#"<circle cx="10" cy="7" r="1.2"></circle><circle cx="10" cy="11" r="1.2"></circle>"#,
    "</svg>"
);

/// A glyph mounted through `dangerous_inner_html` on its own
/// `style="display:contents"` host (the crate-wide SVG rule: an rsx `svg {}`
/// child would be an HTML element, and the host must not add a box).
fn glyph_host(markup: String) -> Element {
    rsx! {
        span {
            style: "display:contents",
            dangerous_inner_html: markup,
        }
    }
}

/// The controlled event wiring every layer shares (Vue: `setup(props, { emit })`
/// plus the local refs the mirror promotes to props): one bundle, so the
/// trigger, the rows and the verbs build their closures from one value.
#[derive(Clone)]
struct HeaderPickerWiring {
    open: bool,
    disabled: bool,
    highlighted: i32,
    on_open_change: Option<EventHandler<bool>>,
    on_value_change: Option<EventHandler<String>>,
    on_highlight_change: Option<EventHandler<i32>>,
    on_edit: Option<EventHandler<String>>,
    on_remove: Option<EventHandler<String>>,
    on_reorder: Option<EventHandler<HeaderPickerReorder>>,
}

impl HeaderPickerWiring {
    fn request_open(&self, open: bool) {
        if let Some(handler) = self.on_open_change.as_ref() {
            handler.call(open);
        }
    }

    fn set_highlight(&self, index: i32) {
        if let Some(handler) = self.on_highlight_change.as_ref() {
            handler.call(index);
        }
    }

    /// Vue's `toggle()`: a disabled picker never opens.
    fn toggle(&self) {
        if !self.disabled {
            self.request_open(!self.open);
        }
    }

    /// Vue's `select(value)`: emit the value, then close.
    fn commit(&self, value: String) {
        if let Some(handler) = self.on_value_change.as_ref() {
            handler.call(value);
        }
        self.request_open(false);
    }

    fn edit(&self, value: String) {
        if let Some(handler) = self.on_edit.as_ref() {
            handler.call(value);
        }
    }

    fn remove(&self, value: String) {
        if let Some(handler) = self.on_remove.as_ref() {
            handler.call(value);
        }
    }

    /// Vue's `onReorder(from, to)`: only an accepted pair reaches the host.
    fn request_reorder(&self, from: usize, to: usize, len: usize) {
        if let Some((from, to)) = header_reorder_indices(from, to, len)
            && let Some(handler) = self.on_reorder.as_ref()
        {
            handler.call(HeaderPickerReorder { from, to });
        }
    }

    /// Vue's `onTriggerKeydown`, re-expressed in controlled terms.
    fn trigger_key(&self, event: KeyboardEvent, option_count: usize) {
        if self.disabled {
            return;
        }
        match event.key.as_str() {
            "Enter" | " " => {
                event.prevent_default();
                self.request_open(!self.open);
            }
            "ArrowDown" => {
                event.prevent_default();
                if self.open {
                    self.set_highlight(header_step_highlight(self.highlighted, option_count, 1));
                } else {
                    // Vue opens and seeds the cursor; its `isOpen` watcher then
                    // overwrites the seed with the selected row. The controlled
                    // mirror emits ONE open edge and leaves the highlight to the
                    // host (it owns `highlighted_index`, which this handler
                    // cannot read back).
                    self.request_open(true);
                }
            }
            "ArrowUp" => {
                event.prevent_default();
                if self.open {
                    self.set_highlight(header_step_highlight(self.highlighted, option_count, -1));
                } else {
                    self.request_open(true);
                }
            }
            "Escape" => {
                // Consume the key only when it actually closed something — the
                // trigger may sit inside a dialog whose own Escape must survive.
                if self.open {
                    event.prevent_default();
                    event.stop_propagation();
                }
                self.request_open(false);
            }
            _ => {}
        }
    }

    /// Vue's `onPopoutKeydown`: the panel owns the arrow/enter navigation.
    fn panel_key(&self, event: KeyboardEvent, options: &[HeaderPickerOption]) {
        match event.key.as_str() {
            "ArrowDown" => {
                event.prevent_default();
                self.set_highlight(header_step_highlight(self.highlighted, options.len(), 1));
            }
            "ArrowUp" => {
                event.prevent_default();
                self.set_highlight(header_step_highlight(self.highlighted, options.len(), -1));
            }
            "Enter" => {
                event.prevent_default();
                let highlighted = usize::try_from(self.highlighted).ok();
                if let Some(option) = highlighted.and_then(|index| options.get(index))
                    && !option.disabled
                {
                    self.commit(option.value.clone());
                }
            }
            "Escape" => {
                event.prevent_default();
                event.stop_propagation();
                self.request_open(false);
            }
            _ => {}
        }
    }
}

#[define_props]
pub struct HeaderPickerProps {
    /// Vue: `modelValue`, default `""`.
    #[default]
    pub model_value: String,

    /// The whole choice model (Vue default: an empty list).
    pub options: Vec<HeaderPickerOption>,

    /// Shown while nothing is selected yet (Vue default `""`).
    #[default]
    pub placeholder: String,

    /// Title for the OPENED surface only (Vue passes it as the panel `title`,
    /// which becomes the popout's `aria-label`).
    pub panel_title: Option<String>,

    #[default]
    pub disabled: bool,

    /// Show drag grips and emit `reorder` (the host owns the new order).
    #[default]
    pub reorderable: bool,

    /// Desktop-popout placement (Vue default `"bottom-center"`).
    #[default(SelectPanelPlacement::BottomCenter)]
    pub placement: SelectPanelPlacement,

    /// Accessible name of the trigger itself (Vue falls back to `panelTitle`).
    pub aria_label: Option<String>,

    // ── controlled state (Vue keeps both in local refs) ──────────────────
    /// Panel visibility (Vue: the local `isOpen`).
    pub open: bool,

    /// Keyboard/pointer highlight index; `-1` means "none" (Vue: the local
    /// `highlightedIndex`).
    #[default(-1)]
    pub highlighted_index: i32,

    /// The trigger rect to anchor against (`feedback::popover::
    /// anchor_rect_from_element_id` measures one by id). Without it the popout
    /// pins to the picker root's positioned box.
    pub anchor: Option<PopoverAnchorRect>,

    /// Gap between the trigger and the popout, in px (Vue panel default 4).
    #[default(4.0)]
    pub offset: f64,

    /// Host class appended to the root (family hook; Vue has no `class` prop).
    #[default]
    pub class: String,

    /// Fires with the chosen value (Vue: `update:modelValue`).
    pub on_value_change: Option<EventHandler<String>>,

    /// Fires with the desired open state (Vue: the local ref's writer).
    pub on_open_change: Option<EventHandler<bool>>,

    /// Fires with the desired highlight index.
    pub on_highlight_change: Option<EventHandler<i32>>,

    /// Fires when a row's standardized rename verb is pressed (Vue: `edit`).
    pub on_edit: Option<EventHandler<String>>,

    /// Fires when a row's standardized delete verb is pressed (Vue: `remove`).
    pub on_remove: Option<EventHandler<String>>,

    /// Fires when a drag reorder is accepted (Vue: `reorder`).
    pub on_reorder: Option<EventHandler<HeaderPickerReorder>>,
}

#[component]
pub fn HeaderPicker(props: HeaderPickerProps) -> Element {
    let options = props.options.clone();
    let option_count = options.len();
    let disabled = props.disabled;
    let is_open = props.open;
    let highlighted = props.highlighted_index;
    let reorderable = props.reorderable;
    let model_value = props.model_value.clone();

    // Vue: `displayLabel || placeholder`.
    let display_label = header_display_label(&options, &props.model_value, &props.placeholder);
    let trigger_label = if display_label.is_empty() {
        props.placeholder.clone()
    } else {
        display_label
    };
    let trigger_state = if is_open { "open" } else { "closed" };
    let aria_expanded = if is_open { "true" } else { "false" };
    // Vue: `aria-label={props.ariaLabel ?? props.panelTitle}` — an empty title
    // never becomes `aria-label=""` (it would name nothing).
    let aria_label = props
        .aria_label
        .clone()
        .or_else(|| props.panel_title.clone())
        .filter(|label| !label.is_empty());
    // Vue: `title={props.panelTitle ?? ""}` on the panel, which HkSelectPanel
    // publishes as the popout's `aria-label` (`title || undefined`).
    let surface_aria = props.panel_title.clone().filter(|title| !title.is_empty());

    let rename_label = t("components.hk.headerPicker.rename", "Rename");
    let delete_label = t("components.hk.headerPicker.delete", "Delete");

    let wiring = HeaderPickerWiring {
        open: props.open,
        disabled,
        highlighted,
        on_open_change: props.on_open_change.clone(),
        on_value_change: props.on_value_change.clone(),
        on_highlight_change: props.on_highlight_change.clone(),
        on_edit: props.on_edit.clone(),
        on_remove: props.on_remove.clone(),
        on_reorder: props.on_reorder.clone(),
    };

    // ── option rows ───────────────────────────────────────────────────────
    let mut rows: Vec<VNode> = Vec::with_capacity(option_count);
    for (index, option) in options.iter().enumerate() {
        let index_i32 = index as i32;
        let is_highlighted = highlighted == index_i32;
        let is_checked = option.value == model_value;
        let row_disabled = option.disabled;
        let row_locked = option.locked;
        let row_editable = option.editable;
        let row_removable = option.removable;
        let row_value = option.value.clone();
        let row_label = option.label.clone();

        let click_wiring = wiring.clone();
        let click_value = row_value.clone();
        let enter_wiring = wiring.clone();

        // The row's verb lane (Vue: `span.hk-header-picker-option-actions`).
        let actions = if row_editable || row_removable {
            let edit_wiring = wiring.clone();
            let edit_value = row_value.clone();
            let edit_label = rename_label.clone();
            let remove_wiring = wiring.clone();
            let remove_value = row_value.clone();
            let remove_label = delete_label.clone();
            Some(rsx! {
                span { class: "hk-header-picker-option-actions",
                    if row_editable {
                        IconButton {
                            variant: IconButtonVariant::Ghost,
                            size: IconButtonSize::S24,
                            aria_label: Some(edit_label),
                            icon_slot: Some(glyph_host(lucide_icon_svg(
                                "pencil",
                                14,
                                LUCIDE_PENCIL_BODY,
                                None,
                            ))),
                            onclick: Some(event_handler(move |event: MouseEvent| {
                                // The row's verb must not double as a selection.
                                event.stop_propagation();
                                edit_wiring.edit(edit_value.clone());
                            })),
                        }
                    }
                    if row_removable {
                        IconButton {
                            variant: IconButtonVariant::Ghost,
                            size: IconButtonSize::S24,
                            aria_label: Some(remove_label),
                            icon_slot: Some(glyph_host(lucide_icon_svg(
                                "trash-2",
                                14,
                                LUCIDE_TRASH2_BODY,
                                None,
                            ))),
                            onclick: Some(event_handler(move |event: MouseEvent| {
                                event.stop_propagation();
                                remove_wiring.remove(remove_value.clone());
                            })),
                        }
                    }
                }
            })
        } else {
            None
        };

        let row = rsx! {
            div {
                class: "hk-select-option hk-header-picker-option",
                "data-highlighted": marker_attr(is_highlighted),
                "data-select-index": index_i32,
                "data-checked": marker_attr(is_checked),
                "data-disabled": marker_attr(row_disabled),
                onclick: move |_event: MouseEvent| {
                    if !row_disabled {
                        click_wiring.commit(click_value.clone());
                    }
                },
                // Vue spreads this only for the desktop popout; the mirror has
                // no sheet branch, so the guard has nothing to guard.
                onpointerenter: move |_event: PointerEvent| {
                    enter_wiring.set_highlight(index_i32);
                },
                span { class: "hk-header-picker-option-label", {row_label} }
                if let Some(actions) = actions {
                    {actions}
                }
            }
        };

        if reorderable {
            // Vue wraps each row in HkDraggableList's lanes; the grip lane is
            // reserved on every row and only hidden, never dropped (a mixed
            // list keeps its grip column aligned).
            let drop_wiring = wiring.clone();
            rows.push(rsx! {
                div {
                    class: "hk-draggable-list-item",
                    "role": "listitem",
                    "data-locked": marker_attr(row_locked),
                    onpointerdown: move |_event: PointerEvent| {
                        if !row_locked && !row_disabled {
                            header_arm_drag(index);
                        }
                    },
                    onpointerup: move |_event: PointerEvent| {
                        if let Some(from) = header_take_drag() {
                            drop_wiring.request_reorder(from, index, option_count);
                        }
                    },
                    span {
                        class: "hk-draggable-list-handle",
                        "data-hidden": marker_attr(row_locked),
                        onpointerdown: move |event: PointerEvent| {
                            event.stop_propagation();
                            if !row_locked && !row_disabled {
                                header_arm_drag(index);
                            }
                        },
                        {glyph_host(DRAG_HANDLE_SVG.to_string())}
                    }
                    div { class: "hk-draggable-list-content",
                        {row}
                    }
                }
            });
        } else {
            rows.push(row);
        }
    }

    // ── the opened surface ────────────────────────────────────────────────
    let layer = if is_open {
        let (side, align) = props.placement.side_align();
        let geometry = header_popout_style(props.placement, props.anchor, props.offset);
        let key_wiring = wiring.clone();
        let key_options = options.clone();
        let panel_keydown = move |event: KeyboardEvent| key_wiring.panel_key(event, &key_options);
        // Vue: `data-all-locked` collapses the grip lane outright when every row
        // is locked (an all-locked lane reads as "missing grips", not "locked").
        let all_locked = !options.is_empty() && options.iter().all(|option| option.locked);
        let row_nodes = VNode::Fragment(rows);
        let panel_body = if reorderable {
            rsx! {
                div {
                    class: "hk-draggable-list",
                    "role": "list",
                    "data-all-locked": marker_attr(all_locked),
                    onpointerleave: move |_event: PointerEvent| header_clear_drag(),
                    {row_nodes}
                }
            }
        } else {
            rsx! {
                {row_nodes}
            }
        };
        Some(rsx! {
            div {
                class: "hk-select-popout-host",
                "data-side": side.token(),
                "data-align": align.token(),
                style: geometry,
                div {
                    class: "hk-select-popout",
                    "aria-label": surface_aria,
                    onkeydown: panel_keydown,
                    {panel_body}
                }
            }
        })
    } else {
        None
    };

    // ── trigger ───────────────────────────────────────────────────────────
    let trigger_wiring = wiring.clone();
    let trigger_click = move |_event: MouseEvent| trigger_wiring.toggle();
    let key_wiring = wiring.clone();
    let trigger_keydown = move |event: KeyboardEvent| key_wiring.trigger_key(event, option_count);

    let mut root_classes = String::from("hk-header-picker");
    if !props.class.is_empty() {
        root_classes.push(' ');
        root_classes.push_str(&props.class);
    }

    rsx! {
        div {
            class: root_classes,
            // The unmeasured popout arm pins against this box (see the header
            // deltas); `position:relative` keeps the inline-flex layout intact.
            style: "position:relative",
            button {
                "type": "button",
                class: "hk-select-trigger hk-header-picker-trigger",
                "data-state": trigger_state,
                "data-disabled": marker_attr(disabled),
                disabled: marker_attr(disabled),
                "aria-haspopup": "listbox",
                "aria-expanded": aria_expanded,
                "aria-label": aria_label,
                onclick: trigger_click,
                onkeydown: trigger_keydown,
                span { class: "hk-select-value", {trigger_label} }
                {glyph_host(lucide_icon_svg(
                    "chevron-down",
                    16,
                    LUCIDE_CHEVRON_DOWN_BODY,
                    Some("hk-select-arrow"),
                ))}
            }
            if let Some(layer) = layer {
                {layer}
            }
        }
    }
}

impl StyledComponent for HeaderPickerComponent {
    fn styles() -> &'static str {
        // The canonical Vue sheet, compiled verbatim (no_hash keeps the
        // `.hk-header-picker*` names literal so this CSS matches Vue). It is a
        // DELTA layer: the trigger chrome (`.hk-select-trigger*`) and the
        // popout (`.hk-select-popout*`) come from the mirrored `HkSelect.scss`,
        // which `basic/select.rs` compiles — exactly the split the Vue
        // component ships.
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkHeaderPicker.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "header-picker"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn options() -> Vec<HeaderPickerOption> {
        vec![
            HeaderPickerOption {
                value: "hub-1".to_string(),
                label: "General".to_string(),
                editable: true,
                removable: true,
                ..Default::default()
            },
            HeaderPickerOption {
                value: "hub-2".to_string(),
                label: "Pinned".to_string(),
                // A pinned default: grip hidden, lane reserved.
                locked: true,
                ..Default::default()
            },
            HeaderPickerOption {
                value: "hub-3".to_string(),
                label: "Archive".to_string(),
                disabled: true,
                ..Default::default()
            },
        ]
    }

    fn anchor() -> PopoverAnchorRect {
        PopoverAnchorRect {
            x: 100.0,
            y: 50.0,
            width: 40.0,
            height: 20.0,
        }
    }

    #[test]
    fn header_display_label_matches_the_vue_fallbacks() {
        let options = options();
        // Empty model → placeholder (Vue: `!modelValue`).
        assert_eq!(
            header_display_label(&options, "", "Pick a hub"),
            "Pick a hub"
        );
        assert_eq!(
            header_display_label(&options, "hub-2", "Pick a hub"),
            "Pinned"
        );
        // Unmatched value falls back to the raw value.
        assert_eq!(
            header_display_label(&options, "hub-9", "Pick a hub"),
            "hub-9"
        );
        assert_eq!(header_display_label(&[], "", ""), "");
    }

    #[test]
    fn header_highlight_wraps_like_the_vue_modulo() {
        assert_eq!(header_step_highlight(0, 3, 1), 1);
        assert_eq!(header_step_highlight(2, 3, 1), 0);
        assert_eq!(header_step_highlight(0, 3, -1), 2);
        // The trigger's ArrowDown-on-closed arm steps from -1 to 0.
        assert_eq!(header_step_highlight(-1, 3, 1), 0);
        // No option list → no reachable row (Vue's `% 0` is NaN).
        assert_eq!(header_step_highlight(0, 0, 1), -1);
    }

    #[test]
    fn header_reorder_accepts_only_real_moves() {
        assert_eq!(header_reorder_indices(0, 2, 3), Some((0, 2)));
        assert_eq!(header_reorder_indices(2, 0, 3), Some((2, 0)));
        // A no-op drag and an out-of-range index are both dropped, so the host
        // never receives a reorder it cannot apply.
        assert_eq!(header_reorder_indices(1, 1, 3), None);
        assert_eq!(header_reorder_indices(0, 3, 3), None);
        assert_eq!(header_reorder_indices(3, 0, 3), None);
        assert_eq!(header_reorder_indices(0, 0, 0), None);
    }

    #[test]
    fn header_drag_registry_arms_and_takes_once() {
        header_clear_drag();
        assert_eq!(header_take_drag(), None);
        header_arm_drag(2);
        // A press on the row body takes the arm away; a second release finds
        // nothing (one pointer drags one row).
        assert_eq!(header_take_drag(), Some(2));
        assert_eq!(header_take_drag(), None);
        // Re-arming overwrites — the latest press owns the drag.
        header_arm_drag(0);
        header_arm_drag(1);
        assert_eq!(header_take_drag(), Some(1));
        header_clear_drag();
        assert_eq!(header_take_drag(), None);
    }

    #[test]
    fn header_popout_geometry_anchors_or_pins_to_the_root() {
        // Anchored: the select panel's own calculation, matchAnchorWidth=false.
        assert_eq!(
            header_popout_style(SelectPanelPlacement::BottomCenter, Some(anchor()), 4.0),
            "left:120px;top:74px;transform:translateX(-50%)"
        );
        assert_eq!(
            header_popout_style(SelectPanelPlacement::BottomStart, Some(anchor()), 4.0),
            "left:100px;top:74px"
        );
        // Unmeasured: an absolute edge pin against the picker root.
        assert_eq!(
            header_popout_style(SelectPanelPlacement::BottomCenter, None, 4.0),
            "position:absolute;top:calc(100% + 4px);left:50%;transform:translateX(-50%)"
        );
        assert_eq!(
            header_popout_style(SelectPanelPlacement::TopEnd, None, 4.0),
            "position:absolute;bottom:calc(100% + 4px);right:0"
        );
    }

    #[test]
    fn header_picker_defaults_match_the_vue_props() {
        let props = HeaderPickerProps::default();
        assert_eq!(props.model_value, "");
        assert!(props.options.is_empty());
        assert_eq!(props.placeholder, "");
        assert_eq!(props.panel_title, None);
        assert!(!props.disabled);
        assert!(!props.reorderable);
        // Vue's `placement` default is bottom-center (the header pill mirrors
        // the footer platform pill).
        assert_eq!(props.placement, SelectPanelPlacement::BottomCenter);
        assert_eq!(props.aria_label, None);
        assert!(!props.open);
        assert_eq!(props.highlighted_index, -1);
        assert!(props.anchor.is_none());
        assert_eq!(props.offset, 4.0);
        assert_eq!(props.class, "");
        assert!(props.on_value_change.is_none());
        assert!(props.on_open_change.is_none());
        assert!(props.on_highlight_change.is_none());
        assert!(props.on_edit.is_none());
        assert!(props.on_remove.is_none());
        assert!(props.on_reorder.is_none());
    }

    #[test]
    fn header_picker_renders_the_closed_trigger_contract() {
        let html = HeaderPicker(HeaderPickerProps {
            model_value: "hub-2".to_string(),
            options: options(),
            panel_title: Some("Hubs".to_string()),
            ..Default::default()
        })
        .render_to_html();

        assert!(html.contains(r#"class="hk-header-picker""#), "{html}");
        assert!(
            html.contains(r#"class="hk-select-trigger hk-header-picker-trigger""#),
            "{html}"
        );
        assert!(html.contains(r#"data-state="closed""#), "{html}");
        assert!(html.contains(r#"aria-haspopup="listbox""#), "{html}");
        assert!(html.contains(r#"aria-expanded="false""#), "{html}");
        // Vue: `ariaLabel ?? panelTitle`.
        assert!(html.contains(r#"aria-label="Hubs""#), "{html}");
        // The selected option's label wins over the raw value.
        assert!(
            html.contains(r#"class="hk-select-value">Pinned<"#),
            "{html}"
        );
        // The chevron keeps Vue's class on the svg itself (the sheet pins it
        // absolutely inside the trigger).
        assert!(
            html.contains("lucide hk-select-arrow lucide-chevron-down-icon lucide-chevron-down"),
            "{html}"
        );
        // Closed: no panel and no falsy marker attributes.
        assert!(!html.contains("hk-select-popout"), "{html}");
        assert!(!html.contains("hk-header-picker-option"), "{html}");
        assert!(!html.contains(r#"data-disabled="false""#), "{html}");
        assert!(!html.contains(r#"data-checked="false""#), "{html}");
    }

    #[test]
    fn header_picker_renders_the_open_row_contract() {
        let html = HeaderPicker(HeaderPickerProps {
            model_value: "hub-2".to_string(),
            options: options(),
            open: true,
            highlighted_index: 0,
            anchor: Some(anchor()),
            panel_title: Some("Hubs".to_string()),
            ..Default::default()
        })
        .render_to_html();

        // The popout: geometry + resolved side/align + its accessible name.
        assert!(html.contains(r#"class="hk-select-popout-host""#), "{html}");
        assert!(html.contains(r#"data-side="bottom""#), "{html}");
        assert!(html.contains(r#"data-align="center""#), "{html}");
        assert!(
            html.contains(r#"style="left:120px;top:74px;transform:translateX(-50%)""#),
            "{html}"
        );
        assert!(html.contains(r#"class="hk-select-popout""#), "{html}");
        assert!(html.contains(r#"aria-label="Hubs""#), "{html}");
        // One standardized row per option, with the cursor and the check.
        assert_eq!(
            html.matches(r#"class="hk-select-option hk-header-picker-option""#)
                .count(),
            3,
            "{html}"
        );
        assert!(html.contains(r#"data-select-index="0""#), "{html}");
        assert!(html.contains(r#"data-highlighted="true""#), "{html}");
        assert_eq!(
            html.matches(r#"data-highlighted="true""#).count(),
            1,
            "{html}"
        );
        assert!(html.contains(r#"data-checked="true""#), "{html}");
        assert!(html.contains(r#"data-disabled="true""#), "{html}");
        assert!(
            html.contains(r#"class="hk-header-picker-option-label""#),
            "{html}"
        );
        // The verb lane: rename + delete on the first row only, ghost 24px
        // buttons named through the i18n bundle.
        assert!(
            html.contains(r#"class="hk-header-picker-option-actions""#),
            "{html}"
        );
        assert!(
            html.contains("hk-icon-button hk-icon-button-24 hk-icon-button-ghost"),
            "{html}"
        );
        assert!(html.contains(r#"aria-label="Rename""#), "{html}");
        assert!(html.contains(r#"aria-label="Delete""#), "{html}");
        assert!(html.contains("lucide-pencil"), "{html}");
        assert!(html.contains("lucide-trash-2"), "{html}");
    }

    #[test]
    fn header_picker_renders_the_reorderable_lanes() {
        let html = HeaderPicker(HeaderPickerProps {
            options: options(),
            open: true,
            reorderable: true,
            ..Default::default()
        })
        .render_to_html();

        // HkDraggableList's lanes: the list root, its items and the reserved
        // grip lane.
        assert!(html.contains(r#"class="hk-draggable-list""#), "{html}");
        assert!(html.contains(r#"role="list""#), "{html}");
        assert_eq!(
            html.matches(r#"class="hk-draggable-list-item""#).count(),
            3,
            "{html}"
        );
        assert_eq!(
            html.matches(r#"class="hk-draggable-list-handle""#).count(),
            3,
            "{html}"
        );
        // The locked row keeps its lane but hides the grip (Vue: `data-hidden`);
        // one row is locked here, so exactly one grip hides.
        assert_eq!(html.matches(r#"data-hidden="true""#).count(), 1, "{html}");
        assert_eq!(html.matches(r#"data-locked="true""#).count(), 1, "{html}");
        // Mixed list → the lane is NOT collapsed.
        assert!(!html.contains(r#"data-all-locked"#), "{html}");
        assert!(
            html.contains(r#"class="hk-draggable-list-content""#),
            "{html}"
        );
    }

    #[test]
    fn header_picker_styles_come_from_the_canonical_vue_sheet() {
        let css = HeaderPickerComponent::styles();
        assert!(
            css.contains(".hk-header-picker")
                && css.contains(".hk-header-picker-trigger")
                && css.contains(".hk-header-picker-option"),
            "header picker css must carry the vue delta classes"
        );
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored header picker sheet"
        );
        // The trigger chrome stays the select sheet's; a duplicated
        // `.hk-select-trigger` rule here would drift from the family.
        assert!(
            !css.contains(".hk-select-trigger {") && css.contains(".hk-header-picker-trigger"),
            "the header sheet must only override the shared trigger"
        );
        assert_eq!(HeaderPickerComponent::name(), "header-picker");
    }
}
