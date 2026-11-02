// hi-components/src/overlay/popup_select.rs
// PopupSelect — mirror of the canonical Vue `HkPopupSelect`: the controlled
// popup SELECTOR (a field-shaped trigger plus an anchored list popout, with a
// bottom sheet on phones), for dense rows that would read oversized as a
// stock `<select>`.
//
// THE SHEET OWNERSHIP (verified — this file COMPILES it): Vue's
// `HkPopupSelect.tsx` imports `./HkPopupSelect.scss`, i.e. it is the sheet's
// owner, and that sheet is vendored byte-identically under
// `src/styles/vue-mirror/components/HkPopupSelect.scss` (guarded by
// `tests/vue_mirror_drift_tests.rs`). No other mirror claims it, so
// [`PopupSelectComponent::styles`] compiles it with `no_hash` and every
// `.hk-popup-select*` class stays literal and identical in both forms.
//
// THE SURFACE IS REUSED, NOT RE-DERIVED: Vue renders `<HkPopover>` for the
// layer (anchored popout on desktop, `hk-is-sheet` dock on phones) and an
// `HkScrollContainer` for the scrolling viewport. The crate already mirrors
// the popover (`feedback::Popover`, the same twelve-placement grammar with
// inline geometry and an inline sheet arm), so this component MOUNTS THAT
// COMPONENT with the props Vue passes — `placement="bottom"`, `offset={4}`,
// `backdrop={false}`, `sheetOnMobile`, `title={label || placeholder}`,
// `class="hk-popup-select-content"` — instead of hand-rolling a second popout
// geometry. The anchored box therefore comes from
// `feedback::popover::popover_position_style` through that mirror, computed
// as INLINE `position: fixed` styles.
//
// DOM contract (mirrors the Vue render output one-to-one):
//
//   div.hk-popup-select-wrapper [host class]
//     label.hk-popup-select-label?                (label && !hideLabel)
//       {label} span.hk-popup-select-required?    (required)
//     button.hk-popup-select-trigger[.hk-popup-select-trigger-sm]
//         type="button" data-state={open|closed} [data-error] [data-disabled]
//         [disabled] [aria-label]                 (aria-label: hideLabel only)
//       span.hk-popup-select-value {label || placeholder}
//       div.hk-icon.hk-popup-select-arrow         (the chevron; 14px on sm)
//     ── while open: the reused HkPopover surface ──
//     div[data-hk-popout-layer]
//       div.hk-popover-panel.hk-popover-bottom.hii-dropdown-content
//           .hk-popup-select-content                       (Vue's `class`)
//         div.hk-popup-select-viewport                     (style: rhythm)
//           div.hk-popup-select-item                        (one per option)
//               data-highlighted data-select-index data-checked
//             ── with a description ──
//             span.hk-popup-select-item-body
//               span.hk-popup-select-item-label {label}
//               span.hk-popup-select-item-desc {description}
//             ── stock row (no description) ──
//             span {label}
//     p.hk-popup-select-error?                    (error)
//
// Vue prop mapping: `modelValue` → [`PopupSelectProps::model_value`],
// `label`, `placeholder`, `error`, `disabled`, `required`, `size` →
// [`PopupSelectSize`] (`"md"` stock / `"sm"` dense row), `hideLabel` →
// `hide_label`, `options` → [`PopupSelectOption`]. Emits:
// `update:modelValue` → `on_value_change`.
//
// Controlled state: Vue keeps `isOpen`, `highlightedIndex` and `triggerRef` in
// LOCALS and coordinates instances through a module singleton
// (`activePopupId` / `isAnyPopupOpen()` / `closeAllPopups()`). tairitsu 0.5.22
// has no per-instance component state (`use_signal` allocates a fresh signal
// per render, `use_state` shares ONE slot per component type), so `open`,
// `highlighted_index` and `anchor` are CONTROLLED props with
// `on_open_change` / `on_highlight_change` writers — the host owns all three
// exactly as it owns `model_value`. Nothing is stored in the component.
//
// Behaviour deltas vs Vue (documented, not accidental):
//   * NO `<Teleport>` and no popup-manager z band: the reused popover mirror
//     renders the layer IN PLACE (`position: fixed` from the sheet), so the
//     host's stacking context decides the paint order. Vue reads its z from
//     `usePopupManager` across its own overlay root.
//   * NO `HkScrollContainer`: that component has no Rust mirror at all (no
//     `hk-scroll-container*` rule ships in this crate's sheets), so
//     the `.hk-popup-select-viewport` wrapper is rendered directly and carries
//     the container's two jobs INLINE — the row rhythm the sheet would give the
//     inner `.hk-scroll-container-viewport` (flex column, `--space-2` gap and
//     inset) and the scroll that keeps `.hk-popup-select-content`'s own 240px
//     cap meaningful. The overlay-scrollbar chrome (a JS-attached rail) is
//     absent by the same rule.
//   * NO `scrollIntoView` ON THE CURSOR: Vue queries `[data-select-index="…"]`
//     and scrolls it into view. The mirror emits the same `data-select-index`
//     hook so a host can do it; the cursor itself just moves.
//   * NO CROSS-INSTANCE SINGLETON: `activePopupId` closed every other open
//     popup when one opened. The mirror stores nothing, so a host that wants
//     one-open-at-a-time keeps a shared open id in its own state (the same
//     "several rows could technically be open" delta `data/filter_panel.rs`
//     carries) and renders the others closed.
//   * NO `useOverlay` registry entry, no enter/leave transition, no auto-flip
//     (the reused popover mirror's documented delta): Escape closes ONE layer
//     — the trigger consumes the key only while it actually closes `open`, so a
//     closed selector still lets the Escape bubble to the surface hosting it.
//   * `data-highlighted` / `data-checked` / `data-disabled` are PRESENCE markers
//     here (Vue: `cond || undefined`); a serialized `="false"` would still match
//     a `[data-*]` selector, so the mirror emits the attribute only when the
//     flag is on. `data-error` keeps its VALUE (the message), exactly the string
//     Vue passes through.
//   * `pointerenter` highlighting is attached unconditionally — the rows only
//     exist while open, and this surface has no sheet row variant to exclude.
//   * the chevron is `MdiIcon::ChevronDown` through the crate's `Icon` (Vue
//     draws lucide's), sized 14/16 from the `size` step exactly like Vue's
//     `ChevronDown size={size === "sm" ? 14 : 16}`.

use hikari_icons::MdiIcon;
// The prelude curates the tairitsu event set; `PointerEvent` (the hover
// highlight channel) is not part of it (same import as `basic/select.rs`).
use tairitsu_vdom::PointerEvent;

use crate::basic::select::step_highlight;
use crate::feedback::Popover;
use crate::feedback::popover::{PopoverAnchorRect, PopoverPlacement};
use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct PopupSelectComponent;

/// One choice of the popup (Vue: `HkPopupSelectOption`).
#[derive(Clone, PartialEq, Debug, Default)]
pub struct PopupSelectOption {
    /// Stable identity — the value emitted back to the host.
    pub value: String,

    /// The row text and the trigger's label while selected.
    pub label: String,

    /// Optional second line inside the same row. Absent keeps the EXACT stock
    /// row (a bare label span, no body wrapper, no optical shift) — Vue's R2
    /// contract.
    pub description: Option<String>,
}

/// Control density (Vue: `"sm" | "md"`, default `"md"`).
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum PopupSelectSize {
    /// Dense rows — filter condition rows, toolbars (2rem trigger).
    Sm,
    /// The form-field stock (2.5rem trigger).
    #[default]
    Md,
}

impl PopupSelectSize {
    /// The trigger's density modifier — Vue's `size === "sm"` class arm.
    /// `Md` contributes nothing (Vue's array entry is `""`).
    pub fn modifier(self) -> &'static str {
        match self {
            PopupSelectSize::Sm => "hk-popup-select-trigger-sm",
            PopupSelectSize::Md => "",
        }
    }

    /// The chevron box in px (Vue: `size === "sm" ? 14 : 16`).
    pub fn chevron_px(self) -> u32 {
        match self {
            PopupSelectSize::Sm => 14,
            PopupSelectSize::Md => 16,
        }
    }

    /// The Vue token (`"sm"` / `"md"`), for hosts that resolve it from config.
    pub fn token(self) -> &'static str {
        match self {
            PopupSelectSize::Sm => "sm",
            PopupSelectSize::Md => "md",
        }
    }
}

/// One rendered row, mapped from the option list.
#[derive(Clone, PartialEq, Debug, Default)]
pub struct PopupSelectRow {
    /// `data-select-index` and the order key.
    pub index: usize,
    /// The value a press commits.
    pub value: String,
    /// The row's first line.
    pub label: String,
    /// The optional second line — its presence switches the row to the
    /// `.hk-popup-select-item-body` anatomy.
    pub description: Option<String>,
    /// `data-highlighted`: the cursor sits on this row.
    pub highlighted: bool,
    /// `data-checked`: the row matches the controlled model.
    pub checked: bool,
}

/// Vue's `displayLabel`: the placeholder for an empty model, the matching
/// option's label, or the raw value when no option matches.
pub fn popup_select_display_label(
    options: &[PopupSelectOption],
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

/// Vue's render expression `displayLabel || props.placeholder`: the resolved
/// label, or the placeholder when that label is empty.
pub fn popup_select_trigger_value(
    options: &[PopupSelectOption],
    model_value: &str,
    placeholder: &str,
) -> String {
    let label = popup_select_display_label(options, model_value, placeholder);
    if label.is_empty() {
        placeholder.to_string()
    } else {
        label
    }
}

/// Vue's row loop: every option becomes one row, marked by the cursor and the
/// model. Host order is preserved (sorting belongs to the caller).
pub fn popup_select_rows(
    options: &[PopupSelectOption],
    model_value: &str,
    highlighted: i32,
) -> Vec<PopupSelectRow> {
    options
        .iter()
        .enumerate()
        .map(|(index, option)| PopupSelectRow {
            index,
            value: option.value.clone(),
            label: option.label.clone(),
            description: option.description.clone(),
            highlighted: highlighted == index as i32,
            checked: option.value == model_value,
        })
        .collect()
}

/// Vue's `watch(isOpen)` open arm: the cursor lands on the current model
/// (`findIndex`) or on "none" (`-1`) when the model matches no row. The mirror
/// exports the seed because the host owns `highlighted_index` (the same
/// division of labour `basic/select.rs` documents for its open edge).
pub fn popup_select_open_highlight(options: &[PopupSelectOption], model_value: &str) -> i32 {
    match options
        .iter()
        .position(|option| option.value == model_value)
    {
        Some(index) => index as i32,
        None => -1,
    }
}

/// The trigger's class list: the stock class plus the density modifier when it
/// has one. Vue builds it as an array with an empty `""` entry for `md`, which
/// the mirror would serialize as a doubled space — so the empty step is
/// dropped instead. (A host class belongs on the WRAPPER: Vue's `class`
/// fallthrough lands on the root, never on the trigger.)
pub fn popup_select_trigger_classes(size: PopupSelectSize) -> String {
    let modifier = size.modifier();
    if modifier.is_empty() {
        String::from("hk-popup-select-trigger")
    } else {
        format!("hk-popup-select-trigger {modifier}")
    }
}

/// The inline style of the `.hk-popup-select-viewport` wrapper.
///
/// Substitutes the unmirrored `HkScrollContainer`: the inner
/// `.hk-scroll-container-viewport` rule in the sheet (`flex column`,
/// `--space-2` gap/inset) plus the scrolling the container owns, so the
/// panel's `max-height: 240px` cap scrolls instead of clipping. See the header
/// deltas — the overlay scrollbar chrome is deliberately absent.
pub fn popup_select_viewport_style() -> &'static str {
    concat!(
        "display:flex;flex-direction:column;",
        "gap:var(--space-2);padding:var(--space-2);",
        "flex:1;min-height:0;overflow-y:auto"
    )
}

/// What a trigger key does (Vue: `onTriggerKeydown`).
#[derive(Clone, Copy, PartialEq, Debug)]
pub enum PopupSelectKeyAction {
    /// Enter / Space: flip the popup.
    Toggle,
    /// Arrow down/up while closed: open. Vue also seeds the cursor here (0 for
    /// ArrowDown, unchanged for ArrowUp) and then OVERWRITES it from its
    /// `isOpen` watcher, so the observable outcome is "open, cursor on the
    /// model" — [`popup_select_open_highlight`] is that seed.
    Open,
    /// Arrow down/up while open: step the cursor, wrapping.
    Step(i32),
    /// Escape while open: close AND consume — one layer only, so a surface
    /// hosting this selector keeps its own Escape.
    CloseAndConsume,
    /// Escape while closed: nothing to close; the key keeps bubbling (Vue
    /// still runs its `isOpen = false` no-op).
    CloseQuietly,
    /// Anything else: the trigger leaves it alone.
    Forward,
}

/// The trigger's key grammar, including the close condition (Vue consumes
/// Escape only when the popup was open).
pub fn popup_select_key_action(key: &str, open: bool) -> PopupSelectKeyAction {
    match key {
        "Enter" | " " => PopupSelectKeyAction::Toggle,
        "ArrowDown" | "ArrowUp" if !open => PopupSelectKeyAction::Open,
        "ArrowDown" => PopupSelectKeyAction::Step(1),
        "ArrowUp" => PopupSelectKeyAction::Step(-1),
        "Escape" => {
            if open {
                PopupSelectKeyAction::CloseAndConsume
            } else {
                PopupSelectKeyAction::CloseQuietly
            }
        }
        _ => PopupSelectKeyAction::Forward,
    }
}

#[define_props]
pub struct PopupSelectProps {
    /// Vue: `modelValue`, default `""`.
    #[default]
    pub model_value: String,

    /// The caption above the control (Vue: `label`).
    pub label: Option<String>,

    /// Shown while the model is empty (Vue default `""`).
    #[default]
    pub placeholder: String,

    /// Error ink + message line (`data-error` on the trigger).
    pub error: Option<String>,

    #[default]
    pub disabled: bool,

    /// Appends the `*` marker to the caption (Vue: `required`).
    #[default]
    pub required: bool,

    /// Control density (Vue default `"md"`).
    #[default]
    pub size: PopupSelectSize,

    /// Suppress the caption while keeping `label` semantic: the trigger takes
    /// it as `aria-label` and the sheet keeps it as its heading (Vue:
    /// `hideLabel`).
    #[default]
    pub hide_label: bool,

    /// The choice model. Vue falls back to its default slot; the mirror renders
    /// these rows only (see the header deltas).
    pub options: Vec<PopupSelectOption>,

    // ── controlled state (Vue keeps these in locals / the module singleton) ─
    /// Popup visibility (Vue: the local `isOpen`).
    #[default]
    pub open: bool,

    /// Keyboard/pointer highlight; `-1` means "none" (Vue: the local
    /// `highlightedIndex`).
    #[default(-1)]
    pub highlighted_index: i32,

    /// The trigger rect the popout anchors against — Vue's `triggerRef`
    /// (`feedback::popover::anchor_rect_from_element_id` measures one by id).
    /// Without it the reused popover mirror keeps the sheet's fixed default
    /// position.
    pub anchor: Option<PopoverAnchorRect>,

    /// Host class on the wrapper (Vue: attrs fallthrough on the root).
    #[default]
    pub class: String,

    /// Fires with the desired open state (Vue: the local ref's writer).
    pub on_open_change: Option<EventHandler<bool>>,

    /// Fires with the chosen option value (Vue: `update:modelValue`).
    pub on_value_change: Option<EventHandler<String>>,

    /// Fires with the desired highlight index.
    pub on_highlight_change: Option<EventHandler<i32>>,
}

/// The controlled wiring every layer shares — the trigger, the rows and the
/// key handler build their closures from one value.
#[derive(Clone)]
struct PopupSelectWiring {
    open: bool,
    disabled: bool,
    highlighted: i32,
    on_open_change: Option<EventHandler<bool>>,
    on_value_change: Option<EventHandler<String>>,
    on_highlight_change: Option<EventHandler<i32>>,
}

impl PopupSelectWiring {
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

    /// Vue's `select(value)`: emit the value, then close.
    fn commit(&self, value: String) {
        if let Some(handler) = self.on_value_change.as_ref() {
            handler.call(value);
        }
        self.request_open(false);
    }

    /// Vue's `toggle()`: a disabled selector never opens.
    fn toggle(&self) {
        if !self.disabled {
            self.request_open(!self.open);
        }
    }

    /// Vue's `onTriggerKeydown`, re-expressed in controlled terms.
    fn trigger_key(&self, event: KeyboardEvent, option_count: usize) {
        if self.disabled {
            return;
        }
        match popup_select_key_action(event.key.as_str(), self.open) {
            PopupSelectKeyAction::Toggle => {
                event.prevent_default();
                self.toggle();
            }
            PopupSelectKeyAction::Open => {
                event.prevent_default();
                self.request_open(true);
            }
            PopupSelectKeyAction::Step(delta) => {
                event.prevent_default();
                // The W2a wrap-around step — one cursor rule for the family.
                self.set_highlight(step_highlight(self.highlighted, option_count, delta));
            }
            PopupSelectKeyAction::CloseAndConsume => {
                event.prevent_default();
                event.stop_propagation();
                self.request_open(false);
            }
            PopupSelectKeyAction::CloseQuietly => {
                self.request_open(false);
            }
            PopupSelectKeyAction::Forward => {}
        }
    }
}

/// Vue's presence-only marker attribute: `data-*` carries `"true"` while the
/// flag is on and is ABSENT otherwise (a serialized `="false"` reads as a value
/// to a `[data-checked]` selector).
fn marker_attr(flag: bool) -> Option<&'static str> {
    if flag { Some("true") } else { None }
}

#[component]
pub fn PopupSelect(props: PopupSelectProps) -> Element {
    let options = props.options.clone();
    let option_count = options.len();
    let disabled = props.disabled;
    let is_open = props.open;
    let highlighted = props.highlighted_index;
    // Vue: `displayLabel || props.placeholder`.
    let trigger_text = popup_select_trigger_value(&options, &props.model_value, &props.placeholder);
    // Vue: `label && !hideLabel` — the caption is suppressed when hidden.
    let label_text = if props.hide_label {
        None
    } else {
        props.label.clone().filter(|label| !label.is_empty())
    };
    // The trigger keeps the accessible name when the caption is hidden.
    let hidden_caption = props.label.clone().filter(|label| !label.is_empty());
    let error_text = props.error.clone().filter(|error| !error.is_empty());
    let trigger_classes = popup_select_trigger_classes(props.size);
    let chevron_px = props.size.chevron_px();
    let trigger_state = if is_open { "open" } else { "closed" };
    // Vue: `aria-label={props.hideLabel ? props.label : undefined}`.
    let trigger_aria_label = if props.hide_label {
        hidden_caption
    } else {
        None
    };
    // Vue: the sheet takes `label || placeholder || undefined` as its title.
    let sheet_title = props
        .label
        .clone()
        .filter(|label| !label.is_empty())
        .or_else(|| Some(props.placeholder.clone()).filter(|placeholder| !placeholder.is_empty()))
        .unwrap_or_default();
    let required = props.required;

    let wiring = PopupSelectWiring {
        open: is_open,
        disabled,
        highlighted,
        on_open_change: props.on_open_change.clone(),
        on_value_change: props.on_value_change.clone(),
        on_highlight_change: props.on_highlight_change.clone(),
    };

    // ── rows ──────────────────────────────────────────────────────────────
    // Rows exist only while the popup is open (Vue mounts the popover's slot
    // content on that edge), so the sweep sits behind the `is_open` guard.
    let build_rows = || -> Vec<VNode> {
        let mut rows: Vec<VNode> = Vec::with_capacity(option_count);
        for row in popup_select_rows(&options, &props.model_value, highlighted) {
            let index_i32 = row.index as i32;
            let is_highlighted = row.highlighted;
            let is_checked = row.checked;
            let row_label = row.label;
            let row_description = row.description;
            let click_wiring = wiring.clone();
            let click_value = row.value;
            let enter_wiring = wiring.clone();
            rows.push(rsx! {
                div {
                    class: "hk-popup-select-item",
                    "data-highlighted": marker_attr(is_highlighted),
                    "data-select-index": index_i32,
                    "data-checked": marker_attr(is_checked),
                    onclick: move |_event: MouseEvent| click_wiring.commit(click_value.clone()),
                    onpointerenter: move |_event: PointerEvent| {
                        enter_wiring.set_highlight(index_i32);
                    },
                    // Vue: a described option grows the two-line body; a stock
                    // row keeps the bare label span (the R2 contract).
                    match row_description {
                        Some(description) => rsx! {
                            span { class: "hk-popup-select-item-body",
                                span { class: "hk-popup-select-item-label", {row_label} }
                                span { class: "hk-popup-select-item-desc", {description} }
                            }
                        },
                        None => rsx! {
                            span { {row_label} }
                        },
                    }
                }
            });
        }
        rows
    };

    // ── the layer (the reused HkPopover mirror) ───────────────────────────
    let layer = if is_open {
        let rows = VNode::Fragment(build_rows());
        let viewport_style = popup_select_viewport_style();
        let viewport = rsx! {
            div {
                class: "hk-popup-select-viewport",
                style: viewport_style,
                {rows}
            }
        };
        let anchor = props.anchor;
        let on_open_change = props.on_open_change.clone();
        rsx! {
            // Vue mounts `HkPopover` with exactly these props (backdrop off,
            // sheet on mobile, the field label as the sheet title, the content
            // class); the crate's mirror supplies the anchored/sheet geometry
            // inline and renders in place (no Teleport — see the deltas).
            Popover {
                open: is_open,
                placement: PopoverPlacement::Bottom,
                offset: 4.0,
                backdrop: false,
                close_on_backdrop: true,
                close_on_escape: true,
                glass: true,
                anchor,
                sheet_on_mobile: true,
                title: sheet_title,
                class: "hk-popup-select-content".to_string(),
                on_open_change,
                {viewport}
            }
        }
    } else {
        // Nothing is stored and nothing is mounted while closed.
        empty_vnode()
    };

    // ── trigger ───────────────────────────────────────────────────────────
    let trigger_wiring = wiring.clone();
    let trigger_click = move |_event: MouseEvent| trigger_wiring.toggle();
    let key_wiring = wiring.clone();
    let trigger_keydown = move |event: KeyboardEvent| key_wiring.trigger_key(event, option_count);

    let mut wrapper_classes = String::from("hk-popup-select-wrapper");
    if !props.class.is_empty() {
        wrapper_classes.push(' ');
        wrapper_classes.push_str(&props.class);
    }

    rsx! {
        div {
            class: wrapper_classes,
            if let Some(label) = label_text {
                label {
                    class: "hk-popup-select-label",
                    {label}
                    if required {
                        span { class: "hk-popup-select-required",
                            "*"
                        }
                    }
                }
            }
            button {
                "type": "button",
                class: trigger_classes,
                "aria-label": trigger_aria_label,
                "data-error": error_text.clone(),
                "data-disabled": marker_attr(disabled),
                "data-state": trigger_state,
                disabled: marker_attr(disabled),
                onclick: trigger_click,
                onkeydown: trigger_keydown,
                span { class: "hk-popup-select-value",
                    {trigger_text}
                }
                Icon {
                    icon: MdiIcon::ChevronDown,
                    size: chevron_px,
                    class: "hk-popup-select-arrow".to_string(),
                }
            }
            {layer}
            if let Some(error) = error_text {
                p { class: "hk-popup-select-error",
                    {error}
                }
            }
        }
    }
}

impl StyledComponent for PopupSelectComponent {
    fn styles() -> &'static str {
        // The canonical Vue sheet, compiled verbatim (`no_hash` keeps the
        // `.hk-popup-select*` names literal so this CSS matches the Vue
        // build). This component is the sheet's OWNER — `HkPopupSelect.tsx`
        // imports it and no sibling mirror compiles it.
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkPopupSelect.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "popup-select"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn options() -> Vec<PopupSelectOption> {
        vec![
            PopupSelectOption {
                value: "a".to_string(),
                label: "Alpha".to_string(),
                description: None,
            },
            PopupSelectOption {
                value: "b".to_string(),
                label: "Beta".to_string(),
                description: Some("second line".to_string()),
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
    fn popup_select_display_label_matches_the_vue_fallbacks() {
        // Empty model → placeholder (Vue: `!props.modelValue`).
        assert_eq!(
            popup_select_display_label(&options(), "", "Pick one"),
            "Pick one"
        );
        assert_eq!(
            popup_select_display_label(&options(), "b", "Pick one"),
            "Beta"
        );
        // Unmatched value falls back to the raw value.
        assert_eq!(
            popup_select_display_label(&options(), "zzz", "Pick one"),
            "zzz"
        );
        // And an empty resolved label falls back to the placeholder again.
        assert_eq!(
            popup_select_trigger_value(&options(), "", "Pick one"),
            "Pick one"
        );
        assert_eq!(
            popup_select_trigger_value(&options(), "a", "Pick one"),
            "Alpha"
        );
        // Both empty stays empty (Vue renders an empty value span).
        assert_eq!(popup_select_trigger_value(&[], "", ""), "");
    }

    #[test]
    fn popup_select_size_drives_the_classes_and_the_chevron() {
        let stock = popup_select_trigger_classes(PopupSelectSize::Md);
        assert_eq!(stock, "hk-popup-select-trigger");
        let dense = popup_select_trigger_classes(PopupSelectSize::Sm);
        assert_eq!(dense, "hk-popup-select-trigger hk-popup-select-trigger-sm");
        // Vue: `ChevronDown size={size === "sm" ? 14 : 16}`.
        assert_eq!(PopupSelectSize::Sm.chevron_px(), 14);
        assert_eq!(PopupSelectSize::Md.chevron_px(), 16);
        assert_eq!(PopupSelectSize::Sm.token(), "sm");
        assert_eq!(PopupSelectSize::Md.token(), "md");
        // `Md` contributes no modifier at all — Vue's array entry is `""`, and
        // the mirror never emits the doubled space that would come with it.
        assert!(PopupSelectSize::Md.modifier().is_empty());
        assert!(!stock.contains("  "));
        assert!(!dense.contains("  "));
    }

    #[test]
    fn popup_select_rows_map_the_vue_row_markers() {
        let rows = popup_select_rows(&options(), "a", 1);
        assert_eq!(rows.len(), 2);
        assert_eq!(rows[0].index, 0);
        assert_eq!(rows[1].index, 1);
        assert_eq!(rows[0].label, "Alpha");
        // The description is what switches the row anatomy; `None` is stock.
        assert!(rows[0].description.is_none());
        assert_eq!(rows[1].description.as_deref(), Some("second line"));
        // One cursor row, one checked row.
        assert!(!rows[0].highlighted);
        assert!(rows[1].highlighted);
        assert!(rows[0].checked);
        assert!(!rows[1].checked);
        // `-1` highlights nothing — Vue's post-close cursor.
        assert!(
            popup_select_rows(&options(), "a", -1)
                .iter()
                .all(|row| !row.highlighted)
        );
    }

    #[test]
    fn popup_select_open_highlight_seeds_from_the_model() {
        // Vue's `watch(isOpen)` open arm: findIndex(modelValue), else -1.
        assert_eq!(popup_select_open_highlight(&options(), "b"), 1);
        assert_eq!(popup_select_open_highlight(&options(), "a"), 0);
        assert_eq!(popup_select_open_highlight(&options(), ""), -1);
        assert_eq!(popup_select_open_highlight(&options(), "zzz"), -1);
        assert_eq!(popup_select_open_highlight(&[], "a"), -1);
    }

    #[test]
    fn popup_select_key_actions_close_one_layer() {
        assert_eq!(
            popup_select_key_action("Enter", false),
            PopupSelectKeyAction::Toggle
        );
        assert_eq!(
            popup_select_key_action(" ", true),
            PopupSelectKeyAction::Toggle
        );
        // Closed arrows OPEN (Vue then reseeds the cursor from the model).
        assert_eq!(
            popup_select_key_action("ArrowDown", false),
            PopupSelectKeyAction::Open
        );
        assert_eq!(
            popup_select_key_action("ArrowUp", false),
            PopupSelectKeyAction::Open
        );
        // Open arrows step the W2a wrap-around cursor.
        assert_eq!(
            popup_select_key_action("ArrowDown", true),
            PopupSelectKeyAction::Step(1)
        );
        assert_eq!(
            popup_select_key_action("ArrowUp", true),
            PopupSelectKeyAction::Step(-1)
        );
        // Escape consumes only when it actually closed the popup.
        assert_eq!(
            popup_select_key_action("Escape", true),
            PopupSelectKeyAction::CloseAndConsume
        );
        assert_eq!(
            popup_select_key_action("Escape", false),
            PopupSelectKeyAction::CloseQuietly
        );
        assert_eq!(
            popup_select_key_action("Tab", true),
            PopupSelectKeyAction::Forward
        );
        // The step itself is the W2a helper (same cursor rule as the panel).
        assert_eq!(step_highlight(0, 2, -1), 1);
        assert_eq!(step_highlight(1, 2, 1), 0);
        assert_eq!(step_highlight(0, 0, 1), -1);
    }

    #[test]
    fn popup_select_viewport_style_substitutes_the_scroll_container() {
        let style = popup_select_viewport_style();
        // The inner `.hk-scroll-container-viewport` rhythm, inline.
        assert!(style.contains("display:flex"), "{style}");
        assert!(style.contains("flex-direction:column"), "{style}");
        assert!(style.contains("gap:var(--space-2)"), "{style}");
        assert!(style.contains("padding:var(--space-2)"), "{style}");
        // …plus the scrolling that keeps the panel's 240px cap meaningful.
        assert!(style.contains("overflow-y:auto"), "{style}");
        // Single declarations, no doubled separators.
        assert!(!style.contains(";;"), "{style}");
    }

    #[test]
    fn popup_select_defaults_match_the_vue_props() {
        let props = PopupSelectProps::default();
        assert_eq!(props.model_value, "");
        assert!(props.label.is_none());
        assert_eq!(props.placeholder, "");
        assert!(props.error.is_none());
        assert!(!props.disabled);
        assert!(!props.required);
        // Vue's `size` default is `"md"`.
        assert_eq!(props.size, PopupSelectSize::Md);
        assert!(!props.hide_label);
        assert!(props.options.is_empty());
        assert!(!props.open);
        // Vue's local `highlightedIndex` starts at -1.
        assert_eq!(props.highlighted_index, -1);
        assert!(props.anchor.is_none());
        assert_eq!(props.class, "");
        assert!(props.on_open_change.is_none());
        assert!(props.on_value_change.is_none());
        assert!(props.on_highlight_change.is_none());
    }

    #[test]
    fn popup_select_renders_the_vue_closed_contract() {
        let html = PopupSelect(PopupSelectProps {
            model_value: "a".to_string(),
            label: Some("Channel".to_string()),
            placeholder: "Pick one".to_string(),
            error: Some("Required".to_string()),
            required: true,
            size: PopupSelectSize::Sm,
            options: options(),
            class: "host".to_string(),
            ..Default::default()
        })
        .render_to_html();

        assert!(
            html.contains(r#"class="hk-popup-select-wrapper host""#),
            "{html}"
        );
        assert!(html.contains(r#"class="hk-popup-select-label""#), "{html}");
        // The required marker sits inside the caption.
        assert!(
            html.contains(r#"class="hk-popup-select-required">*<"#),
            "{html}"
        );
        // The trigger: density step, state, error value, disabled absent.
        assert!(
            html.contains("hk-popup-select-trigger hk-popup-select-trigger-sm"),
            "{html}"
        );
        assert!(html.contains(r#"data-state="closed""#), "{html}");
        assert!(html.contains(r#"data-error="Required""#), "{html}");
        assert!(!html.contains(r#"data-disabled"#), "{html}");
        assert!(!html.contains(r#"disabled="#), "{html}");
        // The resolved value, never the placeholder, for a matched model.
        assert!(
            html.contains(r#"class="hk-popup-select-value">Alpha<"#),
            "{html}"
        );
        assert!(html.contains("hk-popup-select-arrow"), "{html}");
        // `data-error` renders the message line below the control.
        assert!(html.contains(r#"class="hk-popup-select-error""#), "{html}");
        // Closed: no layer, no rows, no sheet title.
        assert!(!html.contains("hk-popover-panel"), "{html}");
        assert!(!html.contains("hk-popup-select-item"), "{html}");
    }

    #[test]
    fn popup_select_renders_the_vue_open_contract() {
        let html = PopupSelect(PopupSelectProps {
            model_value: "a".to_string(),
            label: Some("Channel".to_string()),
            placeholder: "Pick one".to_string(),
            hide_label: true,
            size: PopupSelectSize::Sm,
            options: options(),
            open: true,
            highlighted_index: 1,
            anchor: Some(anchor()),
            ..Default::default()
        })
        .render_to_html();

        // `hideLabel`: no caption, but the label still names the trigger.
        assert!(!html.contains("hk-popup-select-label"), "{html}");
        assert!(html.contains(r#"aria-label="Channel""#), "{html}");
        assert!(html.contains(r#"data-state="open""#), "{html}");
        // The reused HkPopover surface, carrying this sheet's content class.
        assert!(html.contains("hk-popover-panel"), "{html}");
        assert!(html.contains("hk-popup-select-content"), "{html}");
        // Inline anchored geometry (no Teleport, no z band).
        assert!(
            html.contains(r#"style="left:120px;top:74px;transform:translate(-50%, 0)""#),
            "{html}"
        );
        // The substituted scroll container's rhythm travels inline.
        assert!(html.contains("hk-popup-select-viewport"), "{html}");
        assert!(html.contains("overflow-y:auto"), "{html}");
        // One marker row per option, in host order.
        assert_eq!(
            html.matches(r#"class="hk-popup-select-item""#).count(),
            2,
            "{html}"
        );
        assert!(html.contains(r#"data-select-index="0""#), "{html}");
        assert!(html.contains(r#"data-select-index="1""#), "{html}");
        assert!(html.contains(r#"data-highlighted="true""#), "{html}");
        assert!(html.contains(r#"data-checked="true""#), "{html}");
        // Presence-only markers never serialize a `false`.
        assert!(!html.contains(r#"data-highlighted="false""#), "{html}");
        assert!(!html.contains(r#"data-checked="false""#), "{html}");
        // Stock row = bare label span; described row = the two-line body.
        assert!(
            html.contains(r#"class="hk-popup-select-item-body""#),
            "{html}"
        );
        assert!(
            html.contains(r#"class="hk-popup-select-item-label">Beta<"#),
            "{html}"
        );
        assert!(
            html.contains(r#"class="hk-popup-select-item-desc">second line<"#),
            "{html}"
        );
        // The exact R2 stock anatomy: `<div ...><span>Alpha</span></div>`.
        assert!(html.contains("<span>Alpha</span>"), "{html}");
    }

    #[test]
    fn popup_select_disabled_trigger_carries_the_attribute() {
        let html = PopupSelect(PopupSelectProps {
            disabled: true,
            options: options(),
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains(r#"data-disabled="true""#), "{html}");
        assert!(html.contains(r#"disabled="true""#), "{html}");
        // The placeholder shows through an empty model.
        assert!(html.contains(r#"class="hk-popup-select-value""#), "{html}");
        assert!(!html.contains("hk-popover-panel"), "{html}");
    }

    #[test]
    fn popup_select_styles_come_from_its_own_canonical_sheet() {
        let css = PopupSelectComponent::styles();
        assert!(
            css.contains(".hk-popup-select-wrapper")
                && css.contains(".hk-popup-select-trigger")
                && css.contains(".hk-popup-select-trigger-sm")
                && css.contains(".hk-popup-select-value")
                && css.contains(".hk-popup-select-arrow")
                && css.contains(".hk-popup-select-content")
                && css.contains(".hk-popup-select-viewport")
                && css.contains(".hk-popup-select-item")
                && css.contains(".hk-popup-select-item-body")
                && css.contains(".hk-popup-select-item-label")
                && css.contains(".hk-popup-select-item-desc")
                && css.contains(".hk-popup-select-error"),
            "popup-select css must carry the vue classes"
        );
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored popup-select sheet"
        );
        assert_eq!(PopupSelectComponent::name(), "popup-select");
        // The sheet is the owner's own (`HkPopupSelect.tsx` imports it), so the
        // vendored copy must be the one compiled here.
        assert!(
            css.contains("hk-popup-select-item[data-highlighted]")
                || css.contains("[data-highlighted]"),
            "the sheet's highlight rule must survive the mirror"
        );
    }
}
