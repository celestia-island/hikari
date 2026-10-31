// hi-components/src/basic/select.rs
// Select — mirror of the canonical Vue `HkSelect`: the field chrome (caption,
// trigger button, error line) plus the opened surface, which is either the
// desktop popout or the mobile bottom sheet (Vue: `HkSelectPanel`).
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkSelect.scss`, vendored under
// `src/styles/vue-mirror/` and guarded by
// `tests/vue_mirror_drift_tests.rs`), compiled with `no_hash` so every
// `.hk-select*` class name is literal and identical in both forms. The DOM
// contract below mirrors the Vue render output:
//
//   div.hk-select-wrapper
//     label.hk-select-label                       (label; Vue puts no `for` on it)
//       {label} span.hk-select-required (*)       (required)
//     button.hk-select-trigger
//         [data-error] [data-disabled] [data-state=open|closed]
//       span.hk-select-value                      (label || placeholder)
//       div.hk-icon.hk-select-arrow               (MdiIcon::ChevronDown)
//     ── desktop popout branch ──
//     div.hk-select-popout-host [data-side] [data-align]   (style: geometry)
//       div.hk-select-popout [aria-label]              (style: height cap)
//         div.hk-select-option
//             [data-highlighted] [data-select-index] [data-checked] [data-disabled]
//           span {label}
//     ── mobile sheet branch (< 768px, Vue: useBreakpoint) ──
//     div.hk-select-sheet-scrim                        (click closes)
//     div.hk-select-sheet-panel role=dialog aria-modal tabindex=-1
//       div.hk-select-sheet-grabber [aria-hidden]      (click closes)
//       div.hk-select-sheet-header
//         div.hk-select-sheet-title {title}
//         button.hk-window-close.hk-select-sheet-close (✕ icon, aria-label)
//       div.hk-select-sheet-body > div.hk-select-sheet-list (style: height cap)
//         div.hk-select-sheet-content > the option rows
//     p.hk-select-error                                (error)
//
// State contract (the tairitsu 0.5.22 limit this wave works under): the Vue
// component keeps `isOpen` / `highlightedIndex` in local `ref`s. tairitsu has
// no per-instance component state — `use_signal` allocates a fresh signal per
// render and `use_state` shares ONE slot per component type — so BOTH are
// CONTROLLED props here: `open` + `highlighted_index` in, `on_open_change` /
// `on_highlight_change` / `on_value_change` out. The mirror never stores
// anything itself; the host owns the two values exactly like it owns
// `modelValue`.
//
// Behaviour deltas vs Vue (documented):
//   * no `<Teleport>` and no popup-manager z-band: the panel renders in place
//     and the sheet's own `position: fixed` lifts it out of flow, so the host's
//     stacking context decides the paint order (Vue reads its z from
//     `usePopupManager`). The retired legacy `PortalEntry::Dropdown` layer is
//     NOT reused — an inline fixed layer keeps the geometry in props instead of
//     a portal registry entry.
//   * no auto-flip and no viewport clamp: both need the MEASURED panel box
//     (Vue's `positionPanel` reads `offsetWidth`/`offsetHeight`) and tairitsu
//     0.5.22 has no ref + measurement pairing. The placed side is used
//     verbatim, which is exactly Vue's `autoFlip: false` path — a trigger in
//     the bottom band should pass a `Top*` placement.
//   * the top-side geometry anchors the FAR edge (`bottom: calc(100vh - …)`)
//     instead of computing `top` from the panel height, so the popout needs no
//     measurement on either axis.
//   * no enter/leave transitions (`hk-select-popout-*-` / `hk-select-sheet-*-`
//     classes are Vue's `<Transition>` names), no overlay scrollbar, no
//     back-guard, no duplicate-title filter, no size morph: all of those are
//     DOM-measurement / history / animation-bus contracts without a tairitsu
//     analogue in this wave.
//   * row content comes from the `options` prop only — Vue's default slot
//     (arbitrary row markup) belongs to `HkSelectPanel`, which is not mirrored
//     as a standalone component here.
//   * `pointerenter` highlighting is attached to every row and guarded by the
//     form factor instead of being conditionally spread (same behaviour: the
//     rows only exist while open, and master's sheet rows never highlight).
//   * `update:modelValue` → [`SelectProps::on_value_change`],
//     `update:open` → [`SelectProps::on_open_change`]; the controlled
//     `highlighted_index` has no Vue prop (it is Vue's local ref).
// Replaces the retired legacy `Select` (Portal-backed dropdown, `Glow` rows,
// hardcoded Chinese placeholder, `hk-select-dropdown` markup with no sheet
// branch).

use hikari_i18n::t;
use hikari_icons::{Icon, MdiIcon};
// The prelude curates the tairitsu event set; `PointerEvent` (the hover
// highlight channel) is not part of it, so it comes from the crate directly —
// the same import `feedback/tooltip.rs` uses.
use tairitsu_vdom::PointerEvent;

use crate::platform;
use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct SelectComponent;

/// The trigger rect the popout anchors against — the SAME rect contract the
/// anchored surfaces already share (`feedback::popover`), reused so the crate
/// keeps exactly one anchor shape.
pub type SelectAnchorRect = crate::feedback::PopoverAnchorRect;

/// One rendered option (Vue: `HkSelectOption`).
#[derive(Clone, PartialEq, Debug, Default)]
pub struct SelectOption {
    /// The value emitted on selection.
    pub value: String,
    /// The row text and the trigger's label when Selected.
    pub label: String,
    /// Disabled rows render but cannot be selected.
    pub disabled: bool,
}

/// Vue's `SelectPanelPlacement`: the six desktop-popout placements. The mobile
/// sheet always slides from the bottom edge, whatever this says.
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum SelectPanelPlacement {
    #[default]
    BottomStart,
    BottomCenter,
    BottomEnd,
    TopStart,
    TopCenter,
    TopEnd,
}

impl SelectPanelPlacement {
    /// The Vue union token (`"bottom-start"` …).
    pub fn token(self) -> &'static str {
        match self {
            SelectPanelPlacement::BottomStart => "bottom-start",
            SelectPanelPlacement::BottomCenter => "bottom-center",
            SelectPanelPlacement::BottomEnd => "bottom-end",
            SelectPanelPlacement::TopStart => "top-start",
            SelectPanelPlacement::TopCenter => "top-center",
            SelectPanelPlacement::TopEnd => "top-end",
        }
    }

    /// `(side, align)` — Vue's `startsWith("top-")` + `endsWith("-center")` /
    /// `endsWith("-end")` resolution.
    pub fn side_align(self) -> (SelectPopoutSide, SelectPopoutAlign) {
        match self {
            SelectPanelPlacement::BottomStart => {
                (SelectPopoutSide::Bottom, SelectPopoutAlign::Start)
            }
            SelectPanelPlacement::BottomCenter => {
                (SelectPopoutSide::Bottom, SelectPopoutAlign::Center)
            }
            SelectPanelPlacement::BottomEnd => (SelectPopoutSide::Bottom, SelectPopoutAlign::End),
            SelectPanelPlacement::TopStart => (SelectPopoutSide::Top, SelectPopoutAlign::Start),
            SelectPanelPlacement::TopCenter => (SelectPopoutSide::Top, SelectPopoutAlign::Center),
            SelectPanelPlacement::TopEnd => (SelectPopoutSide::Top, SelectPopoutAlign::End),
        }
    }
}

/// Which side of the trigger the popout grows from (the host's `data-side`,
/// which also picks the sheet's `transform-origin`).
#[derive(Clone, Copy, PartialEq, Debug)]
pub enum SelectPopoutSide {
    Top,
    Bottom,
}

impl SelectPopoutSide {
    pub fn token(self) -> &'static str {
        match self {
            SelectPopoutSide::Top => "top",
            SelectPopoutSide::Bottom => "bottom",
        }
    }
}

/// How the popout aligns to the trigger on the horizontal axis (the host's
/// `data-align`).
#[derive(Clone, Copy, PartialEq, Debug)]
pub enum SelectPopoutAlign {
    Start,
    Center,
    End,
}

impl SelectPopoutAlign {
    pub fn token(self) -> &'static str {
        match self {
            SelectPopoutAlign::Start => "start",
            SelectPopoutAlign::Center => "center",
            SelectPopoutAlign::End => "end",
        }
    }
}

/// The inline geometry that pins the `position: fixed` popout host to its
/// trigger (Vue: `positionPanel`, minus the measured flip/clamp pass).
///
/// The align arm writes `left` and pulls the panel back by a percentage, so no
/// panel width is needed; the side arm writes `top` for a downward popout and
/// the `100vh` complement for an upward one, so no panel height is needed
/// either. `min-width` carries Vue's `matchAnchorWidth` parity.
pub fn select_popout_style(
    placement: SelectPanelPlacement,
    anchor: SelectAnchorRect,
    offset: f64,
    match_anchor_width: bool,
) -> String {
    let (side, align) = placement.side_align();
    let left = match align {
        SelectPopoutAlign::Start => anchor.x,
        SelectPopoutAlign::Center => anchor.x + anchor.width / 2.0,
        SelectPopoutAlign::End => anchor.x + anchor.width,
    };
    let mut style = match side {
        SelectPopoutSide::Bottom => {
            format!("left:{left}px;top:{}px", anchor.y + anchor.height + offset)
        }
        SelectPopoutSide::Top => {
            format!("left:{left}px;bottom:calc(100vh - {}px)", anchor.y - offset)
        }
    };
    match align {
        SelectPopoutAlign::Start => {}
        SelectPopoutAlign::Center => style.push_str(";transform:translateX(-50%)"),
        SelectPopoutAlign::End => style.push_str(";transform:translateX(-100%)"),
    }
    if match_anchor_width {
        style.push_str(&format!(";min-width:{}px", anchor.width));
    }
    style
}

/// Vue's `displayLabel`: the placeholder for an empty model, the matching
/// option's label, or the raw value when no option matches.
pub fn select_display_label(options: &[SelectOption], value: &str, placeholder: &str) -> String {
    if value.is_empty() {
        return placeholder.to_string();
    }
    match options.iter().find(|option| option.value == value) {
        Some(option) => option.label.clone(),
        None => value.to_string(),
    }
}

/// Vue's `(highlightedIndex ± 1) % length` step, seeded by the caller (the
/// trigger's ArrowDown-on-closed arm sets 0 explicitly, exactly like Vue).
/// An empty option list has no reachable row: Vue's `% 0` is `NaN`, which also
/// resolves to "nothing", so the mirror reports `-1` (no highlight).
pub fn step_highlight(current: i32, count: usize, delta: i32) -> i32 {
    if count == 0 {
        return -1;
    }
    (current + delta).rem_euclid(count as i32)
}

#[define_props]
pub struct SelectProps {
    /// Vue: `modelValue`, default `""`.
    #[default]
    pub model_value: String,

    /// Visible caption above the trigger (Vue: `label`).
    pub label: Option<String>,

    /// Title for the OPENED surface only (mobile sheet heading, popout a11y
    /// name). Vue resolves `panelTitle ?? label ?? ""`.
    pub panel_title: Option<String>,

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

    /// The option model. Vue falls back to its default slot; the mirror renders
    /// these rows only (see the header deltas).
    pub options: Vec<SelectOption>,

    /// Desktop-popout placement (Vue default `"bottom-start"`).
    #[default]
    pub placement: SelectPanelPlacement,

    // ── controlled state (Vue keeps both in local refs) ──────────────────
    /// Panel visibility (Vue: the local `isOpen`).
    #[default]
    pub open: bool,

    /// Keyboard/pointer highlight index; `-1` means "none" (Vue: the local
    /// `highlightedIndex`).
    #[default(-1)]
    pub highlighted_index: i32,

    /// Dock as a bottom sheet below 768px (Vue panel default: `true`).
    #[default(true)]
    pub sheet_on_mobile: bool,

    /// Gap between the trigger and the popout, in px (Vue panel default 4).
    #[default(4.0)]
    pub offset: f64,

    /// Tie the popout's minimum width to the trigger (Vue panel default true).
    #[default(true)]
    pub match_anchor_width: bool,

    /// The trigger rect to anchor against. Without it the popout keeps the
    /// sheet's fixed default position (Vue without `anchorRef`).
    pub anchor: Option<SelectAnchorRect>,

    /// Cap for the scrolling surface, as any CSS length (Vue panel
    /// `maxHeight`, published through `--hk-select-panel-max-height`).
    pub max_height: Option<String>,

    #[default]
    pub class: String,

    /// Fires with the desired open state (Vue: `update:open`).
    pub on_open_change: Option<EventHandler<bool>>,

    /// Fires with the chosen option value (Vue: `update:modelValue`).
    pub on_value_change: Option<EventHandler<String>>,

    /// Fires with the desired highlight index (the Rust-side stand-in for
    /// Vue's local `highlightedIndex` writes).
    pub on_highlight_change: Option<EventHandler<i32>>,
}

/// The controlled event wiring every layer shares: the open flag, the disabled
/// flag, the highlight index and the three callbacks, bundled so the trigger,
/// the popout and the sheet each build their closures from one value.
#[derive(Clone)]
struct SelectWiring {
    open: bool,
    disabled: bool,
    highlighted: i32,
    on_open_change: Option<EventHandler<bool>>,
    on_value_change: Option<EventHandler<String>>,
    on_highlight_change: Option<EventHandler<i32>>,
}

impl SelectWiring {
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
                    self.set_highlight(step_highlight(self.highlighted, option_count, 1));
                } else {
                    self.request_open(true);
                    self.set_highlight(0);
                }
            }
            "ArrowUp" => {
                event.prevent_default();
                if self.open {
                    self.set_highlight(step_highlight(self.highlighted, option_count, -1));
                } else {
                    self.request_open(true);
                }
            }
            "Escape" => {
                // Consume the key only when it actually closed something —
                // the trigger usually lives inside a dialog that closes on a
                // bubbled Escape (Vue's comment, mirrored behaviour).
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
    fn panel_key(&self, event: KeyboardEvent, options: &[SelectOption]) {
        match event.key.as_str() {
            "ArrowDown" => {
                event.prevent_default();
                self.set_highlight(step_highlight(self.highlighted, options.len(), 1));
            }
            "ArrowUp" => {
                event.prevent_default();
                self.set_highlight(step_highlight(self.highlighted, options.len(), -1));
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

#[component]
pub fn Select(props: SelectProps) -> Element {
    let options = props.options.clone();
    let option_count = options.len();
    let display_label = select_display_label(&options, &props.model_value, &props.placeholder);
    // Vue: `displayLabel || placeholder`.
    let trigger_label = if display_label.is_empty() {
        props.placeholder.clone()
    } else {
        display_label
    };
    // Vue: `panelTitle ?? label ?? ""`, then `props.title || undefined`.
    let surface_title = props
        .panel_title
        .clone()
        .or_else(|| props.label.clone())
        .unwrap_or_default();
    let surface_aria_label = Some(surface_title.clone()).filter(|title| !title.is_empty());
    let label_text = props.label.clone().filter(|label| !label.is_empty());
    let error_text = props.error.clone().filter(|error| !error.is_empty());
    // Vue: `dataError={props.error || undefined}` — attribute PRESENCE is what
    // the sheet keys off, the text is the Vue attribute value.
    let data_error = error_text.clone();
    let sheet_mode = props.sheet_on_mobile && platform::inner_width() < 768;
    let is_open = props.open;
    let highlighted = props.highlighted_index;
    let sheet_branch_visible = sheet_mode;

    let mut wrapper_classes = String::from("hk-select-wrapper");
    if !props.class.is_empty() {
        wrapper_classes.push(' ');
        wrapper_classes.push_str(&props.class);
    }

    // Surface cap: Vue writes the same custom property on whichever element
    // scrolls (the popout, or the sheet's list band).
    let cap_style = match &props.max_height {
        Some(max_height) => format!("--hk-select-panel-max-height:{max_height}"),
        None => String::new(),
    };

    let wiring = SelectWiring {
        open: props.open,
        disabled: props.disabled,
        highlighted: props.highlighted_index,
        on_open_change: props.on_open_change.clone(),
        on_value_change: props.on_value_change.clone(),
        on_highlight_change: props.on_highlight_change.clone(),
    };

    // ── option rows ───────────────────────────────────────────────────────
    // Rows exist only while the panel is open (Vue mounts the panel and its
    // slot content on open), so the whole `options` sweep sits behind the
    // `is_open` guard below and a closed select allocates no row vnodes.
    let build_rows = || -> Vec<VNode> {
        let mut rows: Vec<VNode> = Vec::with_capacity(option_count);
        for (index, option) in options.iter().enumerate() {
            let index_i32 = index as i32;
            let is_highlighted = highlighted == index_i32;
            let is_checked = option.value == props.model_value;
            let is_disabled = option.disabled;
            let row_label = option.label.clone();
            let value_for_click = option.value.clone();
            let click_wiring = wiring.clone();
            let enter_wiring = wiring.clone();
            rows.push(rsx! {
                div {
                    class: "hk-select-option",
                    "data-highlighted": is_highlighted,
                    "data-select-index": index_i32,
                    "data-checked": is_checked,
                    "data-disabled": is_disabled,
                    onclick: move |_event: MouseEvent| {
                        if !is_disabled {
                            click_wiring.commit(value_for_click.clone());
                        }
                    },
                    // Vue spreads this only for the desktop popout; the rows
                    // only exist while open, so the form-factor guard is the
                    // whole rule.
                    onpointerenter: move |_event: PointerEvent| {
                        if !sheet_branch_visible {
                            enter_wiring.set_highlight(index_i32);
                        }
                    },
                    span { {row_label} }
                }
            });
        }
        rows
    };

    // ── the opened surface ────────────────────────────────────────────────
    let layer = if is_open {
        Some(if sheet_mode {
            let scrim_wiring = wiring.clone();
            let grabber_wiring = wiring.clone();
            let close_wiring = wiring.clone();
            let key_wiring = wiring.clone();
            let key_options = options.clone();
            let panel_keydown =
                move |event: KeyboardEvent| key_wiring.panel_key(event, &key_options);
            let title = surface_title.clone();
            let aria_label = surface_aria_label.clone();
            let list_cap = cap_style.clone();
            let sheet_rows = VNode::Fragment(build_rows());
            rsx! {
                div {
                    class: "hk-select-sheet-scrim",
                    onclick: move |_event: MouseEvent| scrim_wiring.request_open(false),
                }
                div {
                    class: "hk-select-sheet-panel",
                    "role": "dialog",
                    "aria-modal": "true",
                    "aria-label": aria_label,
                    "tabindex": -1,
                    onkeydown: panel_keydown,
                    div {
                        class: "hk-select-sheet-grabber",
                        "aria-hidden": "true",
                        onclick: move |_event: MouseEvent| grabber_wiring.request_open(false),
                    }
                    div {
                        class: "hk-select-sheet-header",
                        if !title.is_empty() {
                            div { class: "hk-select-sheet-title", {title} }
                        }
                        button {
                            class: "hk-window-close hk-select-sheet-close",
                            "type": "button",
                            "aria-label": t("hikari::modal.close", "Close"),
                            onclick: move |_event: MouseEvent| close_wiring.request_open(false),
                            Icon {
                                icon: MdiIcon::Close,
                                size: 16,
                            }
                        }
                    }
                    div {
                        class: "hk-select-sheet-body",
                        div {
                            class: "hk-select-sheet-list",
                            style: list_cap,
                            div { class: "hk-select-sheet-content",
                                {sheet_rows}
                            }
                        }
                    }
                }
            }
        } else {
            let (side, align) = props.placement.side_align();
            let geometry = match props.anchor {
                Some(anchor) => select_popout_style(
                    props.placement,
                    anchor,
                    props.offset,
                    props.match_anchor_width,
                ),
                None => String::new(),
            };
            let key_wiring = wiring.clone();
            let key_options = options.clone();
            let panel_keydown =
                move |event: KeyboardEvent| key_wiring.panel_key(event, &key_options);
            let aria_label = surface_aria_label.clone();
            let popout_cap = cap_style.clone();
            let popout_rows = VNode::Fragment(build_rows());
            rsx! {
                div {
                    class: "hk-select-popout-host",
                    "data-side": side.token(),
                    "data-align": align.token(),
                    style: geometry,
                    div {
                        class: "hk-select-popout",
                        style: popout_cap,
                        "aria-label": aria_label,
                        onkeydown: panel_keydown,
                        {popout_rows}
                    }
                }
            }
        })
    } else {
        None
    };

    // ── trigger ───────────────────────────────────────────────────────────
    let click_wiring = wiring.clone();
    let trigger_click = move |_event: MouseEvent| {
        if !click_wiring.disabled {
            click_wiring.request_open(!click_wiring.open);
        }
    };
    let key_wiring = wiring.clone();
    let trigger_keydown = move |event: KeyboardEvent| key_wiring.trigger_key(event, option_count);
    let required = props.required;
    let disabled = props.disabled;
    let trigger_state = if is_open { "open" } else { "closed" };

    rsx! {
        div {
            class: wrapper_classes,
            if let Some(label) = label_text {
                label {
                    class: "hk-select-label",
                    {label}
                    if required {
                        span { class: "hk-select-required",
                            "*"
                        }
                    }
                }
            }
            button {
                class: "hk-select-trigger",
                "type": "button",
                "data-error": data_error,
                "data-disabled": disabled,
                "data-state": trigger_state,
                disabled: disabled,
                onclick: trigger_click,
                onkeydown: trigger_keydown,
                span { class: "hk-select-value",
                    {trigger_label}
                }
                Icon {
                    icon: MdiIcon::ChevronDown,
                    size: 16,
                    class: "hk-select-arrow".to_string(),
                }
            }
            if let Some(layer) = layer {
                {layer}
            }
            if let Some(error) = error_text {
                p { class: "hk-select-error",
                    {error}
                }
            }
        }
    }
}

impl StyledComponent for SelectComponent {
    fn styles() -> &'static str {
        // The canonical Vue sheet, compiled verbatim (no_hash keeps the
        // `.hk-select*` names literal so this CSS matches the Vue build).
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkSelect.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "select"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn anchor() -> SelectAnchorRect {
        SelectAnchorRect {
            x: 100.0,
            y: 50.0,
            width: 40.0,
            height: 20.0,
        }
    }

    #[test]
    fn select_placement_tokens_match_the_vue_union() {
        assert_eq!(SelectPanelPlacement::BottomStart.token(), "bottom-start");
        assert_eq!(SelectPanelPlacement::BottomCenter.token(), "bottom-center");
        assert_eq!(SelectPanelPlacement::BottomEnd.token(), "bottom-end");
        assert_eq!(SelectPanelPlacement::TopStart.token(), "top-start");
        assert_eq!(SelectPanelPlacement::TopCenter.token(), "top-center");
        assert_eq!(SelectPanelPlacement::TopEnd.token(), "top-end");
    }

    #[test]
    fn select_placement_parses_side_and_align_like_vue() {
        assert_eq!(
            SelectPanelPlacement::BottomStart.side_align(),
            (SelectPopoutSide::Bottom, SelectPopoutAlign::Start)
        );
        assert_eq!(
            SelectPanelPlacement::BottomCenter.side_align(),
            (SelectPopoutSide::Bottom, SelectPopoutAlign::Center)
        );
        assert_eq!(
            SelectPanelPlacement::TopEnd.side_align(),
            (SelectPopoutSide::Top, SelectPopoutAlign::End)
        );
        assert_eq!(SelectPopoutSide::Top.token(), "top");
        assert_eq!(SelectPopoutSide::Bottom.token(), "bottom");
        assert_eq!(SelectPopoutAlign::Start.token(), "start");
        assert_eq!(SelectPopoutAlign::Center.token(), "center");
        assert_eq!(SelectPopoutAlign::End.token(), "end");
    }

    #[test]
    fn select_popout_geometry_bottom_start() {
        assert_eq!(
            select_popout_style(SelectPanelPlacement::BottomStart, anchor(), 4.0, true),
            "left:100px;top:74px;min-width:40px"
        );
    }

    #[test]
    fn select_popout_geometry_bottom_center_and_end() {
        // The align arm pulls the panel back by a percentage instead of using
        // the measured panel width.
        assert_eq!(
            select_popout_style(SelectPanelPlacement::BottomCenter, anchor(), 4.0, true),
            "left:120px;top:74px;transform:translateX(-50%);min-width:40px"
        );
        assert_eq!(
            select_popout_style(SelectPanelPlacement::BottomEnd, anchor(), 4.0, true),
            "left:140px;top:74px;transform:translateX(-100%);min-width:40px"
        );
    }

    #[test]
    fn select_popout_geometry_top_side_anchors_the_far_edge() {
        // Upward popouts keep the panel's BOTTOM edge `offset` above the
        // trigger, so no panel height is needed.
        assert_eq!(
            select_popout_style(SelectPanelPlacement::TopStart, anchor(), 4.0, true),
            "left:100px;bottom:calc(100vh - 46px);min-width:40px"
        );
        assert_eq!(
            select_popout_style(SelectPanelPlacement::TopEnd, anchor(), 4.0, true),
            "left:140px;bottom:calc(100vh - 46px);transform:translateX(-100%);min-width:40px"
        );
    }

    #[test]
    fn select_popout_geometry_drops_the_width_match_when_disabled() {
        assert_eq!(
            select_popout_style(SelectPanelPlacement::BottomStart, anchor(), 4.0, false),
            "left:100px;top:74px"
        );
    }

    #[test]
    fn select_display_label_matches_the_vue_fallbacks() {
        let options = vec![
            SelectOption {
                value: "a".to_string(),
                label: "A label".to_string(),
                disabled: false,
            },
            SelectOption {
                value: "b".to_string(),
                label: "B label".to_string(),
                disabled: true,
            },
        ];
        // Empty model → placeholder (Vue: `!modelValue`).
        assert_eq!(select_display_label(&options, "", "Pick one"), "Pick one");
        assert_eq!(select_display_label(&options, "b", "Pick one"), "B label");
        // Unmatched value falls back to the raw value.
        assert_eq!(select_display_label(&options, "zzz", "Pick one"), "zzz");
    }

    #[test]
    fn select_highlight_wraps_like_the_vue_modulo() {
        assert_eq!(step_highlight(0, 3, 1), 1);
        assert_eq!(step_highlight(2, 3, 1), 0);
        assert_eq!(step_highlight(0, 3, -1), 2);
        // The trigger's ArrowDown-on-closed arm steps from -1 to 0.
        assert_eq!(step_highlight(-1, 3, 1), 0);
        // No option list → no reachable row (Vue's `% 0` is NaN).
        assert_eq!(step_highlight(0, 0, 1), -1);
    }

    #[test]
    fn select_props_default_matches_the_vue_props() {
        let props = SelectProps::default();
        assert_eq!(props.model_value, "");
        assert_eq!(props.label, None);
        assert_eq!(props.panel_title, None);
        assert_eq!(props.placeholder, "");
        assert_eq!(props.error, None);
        assert!(!props.disabled);
        assert!(!props.required);
        assert!(props.options.is_empty());
        assert_eq!(props.placement, SelectPanelPlacement::BottomStart);
        assert!(!props.open);
        // Vue's local `highlightedIndex` starts at -1.
        assert_eq!(props.highlighted_index, -1);
        assert!(props.sheet_on_mobile);
        assert_eq!(props.offset, 4.0);
        assert!(props.match_anchor_width);
        assert!(props.anchor.is_none());
        assert_eq!(props.max_height, None);
        assert_eq!(props.class, "");
        assert!(props.on_open_change.is_none());
        assert!(props.on_value_change.is_none());
        assert!(props.on_highlight_change.is_none());
    }

    #[test]
    fn select_styles_come_from_the_canonical_vue_sheet() {
        let css = SelectComponent::styles();
        assert!(
            css.contains(".hk-select-wrapper")
                && css.contains(".hk-select-trigger")
                && css.contains(".hk-select-option")
                && css.contains(".hk-select-popout-host")
                && css.contains(".hk-select-sheet-panel"),
            "select css must carry the vue field, popout and sheet classes"
        );
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored select sheet"
        );
        // The retired legacy dropdown markup must not come back.
        assert!(
            !css.contains(".hk-select-dropdown") && !css.contains(".hi-select-option-selected"),
            "legacy select dropdown classes are retired"
        );
    }
}
