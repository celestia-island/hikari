// hi-components/src/feedback/popover.rs
// Popover — mirror of the canonical Vue `HkPopover`.
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkPopover.scss`, vendored under
// `src/styles/vue-mirror/`). DOM contract (mirrors Vue):
//
//   div.hk-popover-scrim                       (sheet branch, close on click)
//   div.hk-popover-backdrop                    (anchored branch, backdrop)
//   div[data-hk-popout-layer]                  (layer host; z from the host)
//     div.hk-popover-panel
//         [.hk-popover-{placement} | .hk-is-sheet]
//         [.hii-dropdown-content when glass]   (style: --hk-pad, geometry)
//       ── sheet branch ──
//       div.hk-popover-sheet-grabber (aria-hidden; click closes)
//       div.hk-popover-sheet-header > title + close button
//         (button.hk-window-close.hk-popover-sheet-close)
//       children
//
// Placement: the 12 popup placements (side × start/center/end) resolve
// through the pure [`popover_position_style`] helper (side offset default
// 4px, the Vue default). The anchor is passed as a rect
// ([`PopoverAnchorRect`]) — the Rust-side equivalent of Vue's
// `anchorRef` element: callers either measure their trigger via
// `platform::get_bounding_client_rect` or use
// [`anchor_rect_from_element_id`].
//
// Outside click (Vue: `onDocumentClick`, a capture-phase listener on the
// document): while the anchored branch is open, a click that lands outside
// the layer host and outside `anchor_selector` asks the host to close
// (`on_open_change(false)`), through the page-wide shield in
// `overlay::outside_click`. It follows Vue's gate — `close_on_backdrop`
// decides it, and it applies whether or not the backdrop dims the page. The
// sheet branch dismisses through its scrim instead. Pass the trigger in
// `anchor_selector`: it toggles the popover, and closing it first would make
// that toggle reopen it. A surface opened from inside this one renders inside
// the layer host, so its clicks are not outside.
//
// Behaviour deltas vs Vue (documented):
//   * no `<Teleport>` (renders in place; `position: fixed` from the sheet)
//     and no popup-manager z band — the host's stacking context decides;
//   * the auto-flip pass (viewport measure → flip side), the ancestor-zoom
//     division and the `registered`/`after-close` emit edges are Vue runtime
//     contracts without a tairitsu analogue in this wave; the outside-click
//     shield matches on DOM containment instead of the popup-manager z
//     registry (layers render in place, so containment is the nesting);
//   * the mobile sheet branch keys off `sheet_on_mobile` + the live
//     viewport width (Vue's `useBreakpoint`); crossing the breakpoint does
//     not auto-close the open popover.
// Replaces the retired legacy `Popover` (`PopoverPositioning` trigger
// guesswork, no sheet branch) and its `PortalEntry::Popover` layer.

use crate::overlay::outside_click::{self, ShieldKey};
use crate::platform;
use crate::prelude::*;
use crate::styled::StyledComponent;
use crate::utils::{HkPad, hk_pad_style};

pub struct PopoverComponent;

/// One of the twelve popup placements (Vue: `PopupPlacement`).
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum PopoverPlacement {
    Top,
    TopStart,
    TopEnd,
    #[default]
    Bottom,
    BottomStart,
    BottomEnd,
    Left,
    LeftStart,
    LeftEnd,
    Right,
    RightStart,
    RightEnd,
}

impl PopoverPlacement {
    /// The `hk-popover-{placement}` modifier class exactly as Vue emits
    /// it (`top-start` → `hk-popover-top-start`).
    pub fn class_name(self) -> &'static str {
        match self {
            PopoverPlacement::Top => "hk-popover-top",
            PopoverPlacement::TopStart => "hk-popover-top-start",
            PopoverPlacement::TopEnd => "hk-popover-top-end",
            PopoverPlacement::Bottom => "hk-popover-bottom",
            PopoverPlacement::BottomStart => "hk-popover-bottom-start",
            PopoverPlacement::BottomEnd => "hk-popover-bottom-end",
            PopoverPlacement::Left => "hk-popover-left",
            PopoverPlacement::LeftStart => "hk-popover-left-start",
            PopoverPlacement::LeftEnd => "hk-popover-left-end",
            PopoverPlacement::Right => "hk-popover-right",
            PopoverPlacement::RightStart => "hk-popover-right-start",
            PopoverPlacement::RightEnd => "hk-popover-right-end",
        }
    }

    /// `(side, align)` — Vue's `parsePlacement` (`center` when absent).
    pub fn side_align(self) -> (PopoverSide, PopoverAlign) {
        match self {
            PopoverPlacement::Top => (PopoverSide::Top, PopoverAlign::Center),
            PopoverPlacement::TopStart => (PopoverSide::Top, PopoverAlign::Start),
            PopoverPlacement::TopEnd => (PopoverSide::Top, PopoverAlign::End),
            PopoverPlacement::Bottom => (PopoverSide::Bottom, PopoverAlign::Center),
            PopoverPlacement::BottomStart => (PopoverSide::Bottom, PopoverAlign::Start),
            PopoverPlacement::BottomEnd => (PopoverSide::Bottom, PopoverAlign::End),
            PopoverPlacement::Left => (PopoverSide::Left, PopoverAlign::Center),
            PopoverPlacement::LeftStart => (PopoverSide::Left, PopoverAlign::Start),
            PopoverPlacement::LeftEnd => (PopoverSide::Left, PopoverAlign::End),
            PopoverPlacement::Right => (PopoverSide::Right, PopoverAlign::Center),
            PopoverPlacement::RightStart => (PopoverSide::Right, PopoverAlign::Start),
            PopoverPlacement::RightEnd => (PopoverSide::Right, PopoverAlign::End),
        }
    }
}

#[derive(Clone, Copy, PartialEq, Debug)]
pub enum PopoverSide {
    Top,
    Bottom,
    Left,
    Right,
}

#[derive(Clone, Copy, PartialEq, Debug)]
pub enum PopoverAlign {
    Start,
    Center,
    End,
}

/// The trigger geometry the panel anchors against (the Rust-side stand-in
/// for Vue's `anchorRef` element).
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub struct PopoverAnchorRect {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

/// Measure a trigger element by id (`platform::get_element_by_id` +
/// `get_bounding_client_rect`). `None` when the element or the platform
/// measurement is unavailable (non-wasm builds).
#[allow(clippy::let_unit_value)] // native stub element handles are `()`
pub fn anchor_rect_from_element_id(id: &str) -> Option<PopoverAnchorRect> {
    let element = platform::get_element_by_id(id)?;
    let rect = platform::get_bounding_client_rect(&element)?;
    Some(PopoverAnchorRect {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
    })
}

/// The inline geometry that pins a `position: fixed` panel to one side of
/// the anchor (Vue: `computePosition`; side offset default 4 px).
///
/// The returned string carries `left`, `top` and the alignment
/// `transform`. The center arm puts the panel's center on the anchor's
/// center and pulls it back with a `-50%` translation; the start/end arms
/// align the panel's near edge to the anchor's near/far edge.
pub fn popover_position_style(
    placement: PopoverPlacement,
    anchor: PopoverAnchorRect,
    offset: f64,
) -> String {
    let (side, align) = placement.side_align();
    match side {
        PopoverSide::Top | PopoverSide::Bottom => {
            let top = match side {
                PopoverSide::Top => anchor.y - offset,
                _ => anchor.y + anchor.height + offset,
            };
            let (left, tx) = match align {
                PopoverAlign::Start => (anchor.x, "0"),
                PopoverAlign::Center => (anchor.x + anchor.width / 2.0, "-50%"),
                PopoverAlign::End => (anchor.x + anchor.width, "-100%"),
            };
            let ty = if matches!(side, PopoverSide::Top) {
                "-100%"
            } else {
                "0"
            };
            format!("left:{left}px;top:{top}px;transform:translate({tx}, {ty})")
        }
        PopoverSide::Left | PopoverSide::Right => {
            let left = match side {
                PopoverSide::Left => anchor.x - offset,
                _ => anchor.x + anchor.width + offset,
            };
            let (top, ty) = match align {
                PopoverAlign::Start => (anchor.y, "0"),
                PopoverAlign::Center => (anchor.y + anchor.height / 2.0, "-50%"),
                PopoverAlign::End => (anchor.y + anchor.height, "-100%"),
            };
            let tx = if matches!(side, PopoverSide::Left) {
                "-100%"
            } else {
                "0"
            };
            format!("left:{left}px;top:{top}px;transform:translate({tx}, {ty})")
        }
    }
}

#[define_props]
pub struct PopoverProps {
    /// Controlled open state (Vue: `modelValue`).
    #[default]
    pub open: bool,

    #[default]
    pub placement: PopoverPlacement,

    /// Side gap in px (Vue default 4).
    #[default(4.0)]
    pub offset: f64,

    /// Dim/detach the page behind the anchored panel (Vue default true).
    #[default(true)]
    pub backdrop: bool,

    /// Backdrop / scrim click closes (Vue default true). On the anchored
    /// branch it also gates the outside-click shield (Vue: `onDocumentClick`
    /// returns early without it).
    #[default(true)]
    pub close_on_backdrop: bool,

    /// Escape closes (Vue default true).
    #[default(true)]
    pub close_on_escape: bool,

    /// Glass chrome (adds `.hii-dropdown-content`; Vue default true).
    #[default(true)]
    pub glass: bool,

    /// Panel content-inset override (`--hk-pad`; see `utils::pad`).
    pub padding: Option<HkPad>,

    /// The trigger rect to anchor against (see
    /// [`anchor_rect_from_element_id`]); without it the panel keeps the
    /// sheet's fixed default position.
    pub anchor: Option<PopoverAnchorRect>,

    /// A CSS selector for the trigger this popover anchors against (Vue:
    /// `anchorRef`). A click inside it never counts as an outside click: the
    /// trigger toggles the popover, and closing it first would make that
    /// toggle reopen it.
    pub anchor_selector: Option<String>,

    /// Dock as a bottom sheet on mobile-width viewports (<768px), exactly
    /// like Vue's `sheetOnMobile`.
    #[default]
    pub sheet_on_mobile: bool,

    /// i18n-resolved surface name (sheet heading + `aria-label`).
    #[default]
    pub title: String,

    #[default]
    pub class: String,

    pub children: Element,

    /// Fires with the desired open state (Vue: `update:modelValue`).
    pub on_open_change: Option<EventHandler<bool>>,
}

/// Whether an open popover closes on an outside click: the anchored branch
/// only, and only when `closeOnBackdrop` allows it (Vue: the first line of
/// `onDocumentClick`). The sheet branch dismisses through its scrim.
pub fn popover_shields(close_on_backdrop: bool, sheet_branch: bool) -> bool {
    close_on_backdrop && !sheet_branch
}

#[component]
pub fn Popover(props: PopoverProps) -> Element {
    if !props.open {
        return empty_vnode();
    }

    // Vue: sheet branch when `sheetOnMobile` and the live viewport is
    // mobile (`useBreakpoint().isMobile`, < 768px).
    let sheet_branch = props.sheet_on_mobile && platform::inner_width() < 768;

    let panel_classes = {
        let mut classes = String::from("hk-popover-panel");
        if sheet_branch {
            classes.push_str(" hk-is-sheet");
        } else {
            classes.push(' ');
            classes.push_str(props.placement.class_name());
        }
        if props.glass {
            classes.push(' ');
            classes.push_str("hii-dropdown-content");
        }
        if !props.class.is_empty() {
            classes.push(' ');
            classes.push_str(&props.class);
        }
        classes
    };

    let position_style = match props.anchor {
        Some(anchor) if !sheet_branch => {
            popover_position_style(props.placement, anchor, props.offset)
        }
        _ => String::new(),
    };
    let pad_style = hk_pad_style(props.padding);
    let panel_style = if position_style.is_empty() {
        pad_style
    } else if pad_style.is_empty() {
        position_style
    } else {
        format!("{position_style};{pad_style}")
    };

    let on_open_change = props.on_open_change.clone();
    let request_close = {
        let change = on_open_change.clone();
        move || {
            if let Some(handler) = change.as_ref() {
                handler.call(false);
            }
        }
    };

    let close_on_escape = props.close_on_escape;
    let backdrop_close = {
        let close = request_close.clone();
        move |_: MouseEvent| close()
    };
    let grabber_close = {
        let close = request_close.clone();
        move |_: MouseEvent| close()
    };
    let panel_keydown = {
        let close = request_close.clone();
        move |e: KeyboardEvent| {
            if e.key == "Escape" && close_on_escape {
                e.prevent_default();
                e.stop_propagation();
                close();
            }
        }
    };

    let close_button = {
        let close = request_close.clone();
        move |_: MouseEvent| close()
    };

    // Vue: `onDocumentClick` guards the anchored branch only, behind
    // `closeOnBackdrop`. The shield is armed on every render while open and
    // the layer host carries its key, which is how a click tells "inside the
    // surface" from "outside". Where there is no page to listen on (SSR,
    // native) nothing is armed and the key stays out of the markup.
    let shield = popover_shields(props.close_on_backdrop, sheet_branch)
        .then(|| {
            let key = ShieldKey::new();
            let ignore: Vec<String> = props.anchor_selector.iter().cloned().collect();
            outside_click::arm(&key, ignore, request_close.clone()).then_some(key)
        })
        .flatten();
    let shield_attr = shield.as_ref().map(ShieldKey::value);

    // Compose the layer tree explicitly: rsx top-level accepts ONE
    // element/control-flow child, so the scrim/backdrop siblings and the
    // layer host are collected into a fragment-style child list.
    let mut layer_children: Vec<VNode> = Vec::new();
    if sheet_branch && props.close_on_backdrop {
        layer_children.push(rsx! {
            div {
                class: "hk-popover-scrim",
                onclick: backdrop_close.clone(),
            }
        });
    }
    if props.backdrop && !sheet_branch {
        layer_children.push(rsx! {
            div { class: "hk-popover-backdrop" }
        });
    }
    // Locals: the rsx macro consumes the expressions it is handed, so the
    // shared props are cloned once per consumer instead of being read twice.
    let children_sheet = props.children.clone();
    let children_anchored = props.children.clone();
    let panel_title = props.title.clone();
    let sheet_title_text = props.title.clone();
    // Vue marks ONLY the mobile sheet as `aria-modal` + focusable
    // (`tabindex=-1`); the anchored popover is a non-blocking layer whose
    // attributes are omitted. Two branches keep that difference exact.
    let sheet_content = rsx! {
        div {
            class: "hk-popover-sheet-grabber",
            "aria-hidden": "true",
            onclick: grabber_close,
        }
        div { class: "hk-popover-sheet-header",
            if !sheet_title_text.is_empty() {
                div { class: "hk-popover-sheet-title", "{sheet_title_text}" }
            }
            button {
                class: "hk-window-close hk-popover-sheet-close",
                "type": "button",
                "aria-label": hikari_i18n::t("hikari::modal.close", "Close"),
                onclick: close_button,
                Icon {
                    icon: MdiIcon::Close,
                    size: 16,
                }
            }
        }
        {children_sheet}
    };
    let anchored_content = rsx! {
        {children_anchored}
    };
    let panel_keydown_for_anchored = panel_keydown.clone();
    let panel = if sheet_branch {
        rsx! {
            div {
                class: panel_classes,
                style: panel_style,
                "role": "dialog",
                "aria-modal": "true",
                "aria-label": panel_title,
                tabindex: -1,
                onkeydown: panel_keydown,
                {sheet_content}
            }
        }
    } else {
        rsx! {
            div {
                class: panel_classes,
                style: panel_style,
                "role": "dialog",
                onkeydown: panel_keydown_for_anchored,
                {anchored_content}
            }
        }
    };
    layer_children.push(rsx! {
        div {
            "data-hk-popout-layer": "",
            "data-hk-outside": shield_attr,
            {panel}
        }
    });

    rsx! {
        {VNode::Fragment(layer_children)}
    }
}

impl StyledComponent for PopoverComponent {
    fn styles() -> &'static str {
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkPopover.scss", no_hash }
            .0
    }

    fn name() -> &'static str {
        "popover"
    }
}

#[cfg(test)]
mod tests {
    use std::cell::Cell;
    use std::rc::Rc;

    use super::*;

    #[test]
    fn popover_placement_class_names_match_vue() {
        assert_eq!(PopoverPlacement::Top.class_name(), "hk-popover-top");
        assert_eq!(
            PopoverPlacement::BottomStart.class_name(),
            "hk-popover-bottom-start"
        );
        assert_eq!(
            PopoverPlacement::RightEnd.class_name(),
            "hk-popover-right-end"
        );
    }

    #[test]
    fn popover_parses_side_and_align_like_vue() {
        assert_eq!(
            PopoverPlacement::TopStart.side_align(),
            (PopoverSide::Top, PopoverAlign::Start)
        );
        assert_eq!(
            PopoverPlacement::Bottom.side_align(),
            (PopoverSide::Bottom, PopoverAlign::Center)
        );
        assert_eq!(
            PopoverPlacement::LeftEnd.side_align(),
            (PopoverSide::Left, PopoverAlign::End)
        );
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
    fn popover_bottom_center_geometry() {
        assert_eq!(
            popover_position_style(PopoverPlacement::Bottom, anchor(), 4.0),
            "left:120px;top:74px;transform:translate(-50%, 0)"
        );
    }

    #[test]
    fn popover_top_end_geometry() {
        assert_eq!(
            popover_position_style(PopoverPlacement::TopEnd, anchor(), 4.0),
            "left:140px;top:46px;transform:translate(-100%, -100%)"
        );
    }

    #[test]
    fn popover_right_start_geometry() {
        assert_eq!(
            popover_position_style(PopoverPlacement::RightStart, anchor(), 4.0),
            "left:144px;top:50px;transform:translate(0, 0)"
        );
    }

    #[test]
    fn popover_left_center_geometry() {
        assert_eq!(
            popover_position_style(PopoverPlacement::Left, anchor(), 4.0),
            "left:96px;top:60px;transform:translate(-100%, -50%)"
        );
    }

    #[test]
    fn popover_defaults_match_the_vue_props() {
        let props = PopoverProps::default();
        assert!(!props.open);
        assert_eq!(props.placement, PopoverPlacement::Bottom);
        assert_eq!(props.offset, 4.0);
        assert!(props.backdrop);
        assert!(props.close_on_backdrop);
        assert!(props.close_on_escape);
        assert!(props.glass);
        assert!(props.padding.is_none());
        assert!(props.anchor.is_none());
        assert!(props.anchor_selector.is_none());
        assert!(!props.sheet_on_mobile);
        assert_eq!(props.title, "");
    }

    #[test]
    fn popover_shields_the_anchored_branch_behind_close_on_backdrop() {
        assert!(
            popover_shields(true, false),
            "Vue's default: an outside click closes"
        );
        assert!(
            !popover_shields(false, false),
            "`closeOnBackdrop` off: the host dismisses it"
        );
        assert!(
            !popover_shields(true, true),
            "the sheet dismisses through its scrim"
        );
        assert!(!popover_shields(false, true));
    }

    fn open_popover() -> PopoverProps {
        PopoverProps {
            open: true,
            children: rsx! {
                p { "details" }
            },
            ..Default::default()
        }
    }

    /// The shield key the layer host carries, read back from rendered HTML.
    fn shield_key(html: &str) -> Option<String> {
        html.split("data-hk-outside=\"")
            .nth(1)
            .map(|rest| rest.split('"').next().unwrap_or_default().to_string())
    }

    fn close_counter() -> (Rc<Cell<u32>>, EventHandler<bool>) {
        let closes = Rc::new(Cell::new(0));
        let count = Rc::clone(&closes);
        let handler = event_handler(move |open: bool| {
            if !open {
                count.set(count.get() + 1);
            }
        });
        (closes, handler)
    }

    #[test]
    fn an_outside_click_asks_the_host_to_close_and_the_trigger_does_not() {
        let page = outside_click::TestPage::new();
        let (closes, on_open_change) = close_counter();
        let html = Popover(PopoverProps {
            anchor_selector: Some("#trigger".to_string()),
            on_open_change: Some(on_open_change),
            ..open_popover()
        })
        .render_to_html();
        let key = shield_key(&html).expect("the layer host carries the shield key");
        assert!(html.contains("data-hk-popout-layer"), "{html}");
        let surface = format!("[data-hk-outside=\"{key}\"]");
        assert_eq!(page.armed().len(), 1);

        // The trigger toggles the popover itself: closing first would make
        // that toggle reopen it.
        page.click(&["#trigger"], &[&surface]);
        assert_eq!(
            closes.get(),
            0,
            "a click on the trigger is not an outside click"
        );

        page.click(&["main"], &[surface.as_str(), "#trigger"]);
        assert_eq!(closes.get(), 1, "a click elsewhere asks the host to close");
    }

    #[test]
    fn a_click_inside_the_layer_host_is_not_outside() {
        let page = outside_click::TestPage::new();
        let (closes, on_open_change) = close_counter();
        let html = Popover(PopoverProps {
            on_open_change: Some(on_open_change),
            ..open_popover()
        })
        .render_to_html();
        let key = shield_key(&html).expect("the layer host carries the shield key");
        let surface = format!("[data-hk-outside=\"{key}\"]");
        page.click(&[surface.as_str()], &[&surface]);
        assert_eq!(closes.get(), 0);
    }

    #[test]
    fn a_closed_or_unshielded_popover_leaves_no_key_in_the_markup() {
        let page = outside_click::TestPage::new();
        for props in [
            PopoverProps {
                children: rsx! {
                    p { "details" }
                },
                ..Default::default()
            },
            PopoverProps {
                close_on_backdrop: false,
                ..open_popover()
            },
        ] {
            let html = Popover(props).render_to_html();
            assert!(!html.contains("data-hk-outside"), "{html}");
        }
        assert!(page.armed().is_empty());
    }

    #[test]
    fn without_a_page_to_listen_on_the_markup_carries_no_key() {
        // A server render has no listener: its output must not carry a
        // per-render value.
        let html = Popover(open_popover()).render_to_html();
        assert!(!html.contains("data-hk-outside"), "{html}");
    }

    #[test]
    fn popover_styles_come_from_the_canonical_vue_sheet() {
        let css = PopoverComponent::styles();
        assert!(
            css.contains(".hk-popover-panel") && css.contains(".hk-popover-backdrop"),
            "popover css must carry the vue classes"
        );
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored popover sheet"
        );
    }
}
