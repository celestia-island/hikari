// hi-components/src/feedback/drawer.rs
// Drawer — mirror of the canonical Vue `HkDrawer` (the docked side / sheet
// window).
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkDrawer.scss`, vendored under
// `src/styles/vue-mirror/` and guarded by
// `tests/vue_mirror_drift_tests.rs`), compiled with `no_hash` so the
// `.hk-drawer*` class names are literal and identical in both forms. The DOM
// contract below mirrors the Vue render output one-to-one:
//
//   div.hk-drawer-overlay [.hk-drawer-overlay-enter-active]   (when `overlay`)
//   div.hk-drawer-panel.hk-drawer-{side}
//       [.{panel_class}] [.hk-drawer-{side}-enter-active]
//       role="dialog" [aria-label] aria-modal tabindex=-1
//       style: docked-axis size + --hk-pad override
//     div.hk-drawer-header                    (when title or header slot)
//       span.hk-drawer-title                  (or the header slot)
//       button.hk-window-close.hk-drawer-close  (when `closable`)
//     div.hk-drawer-body-wrap
//       div.hk-drawer-body                    (children)
//     div.hk-drawer-footer                    (when the footer slot exists)
//
// Behaviour taken from the Vue component: `modelValue` is the ONLY state (the
// component is controlled — it renders nothing while closed), the overlay and
// the ✕ close the panel, Escape closes it, and `size` maps to `width`
// (`max-width: 85vw`) on the left/right sides and to `height`
// (`max-height: 70vh`) on the top/bottom sides — exactly Vue's `panelStyle`.
// The ✕ / the accessibility label are the shared `hk-window-close` chrome, like
// the `HkModal` mirror.
//
// ANIMATION — VISIBLE-STATE EQUIVALENCE. The sheet's
// `-enter-active` / `-enter-from` / `-leave-active` / `-leave-to` rules are Vue
// `<Transition>` hooks: Vue's surface machine applies a `-from` then a `-to` pair
// for one transition and leaves the OPEN state with NO extra class. This mirror
// has no transition driver, so the open panel carries its `-enter-active` (and
// the overlay its own) for the whole open lifetime and never emits a
// `-from` / `-to` pair:
//   * nothing animates in — without the `-from` frame there is no start state to
//     interpolate from (the panel renders at its resting transform),
//   * nothing animates out — closing removes the panel immediately (there is no
//     leave class at all; `-leave-active` / `-leave-to` stay unused).
// The alternative (one frame with `-from`, swap to `-enter-active` on the next
// rAF) needs a persistent per-instance flag, which tairitsu 0.5.22 does not have
// (component-body hooks are render-scoped), so the static class is the honest
// shape for this wave. One visible side effect: the `-enter-active` rule
// (transform only) REPLACES the width/height transition declared on
// `.hk-drawer-panel`, so a host that animates `size` changes loses that morph
// while the panel is open — acceptable here, since the mirror never morphs sizes.
//
// Other adaptation deltas vs Vue (deliberate, listed instead of hidden):
//   * NO TELEPORT — the surface renders in place; the sheet already makes the
//     overlay and the panel `position: fixed`, so there are no in-flow wrappers
//     (and no `.hk-drawer-*` wrapper element that the sheet does not style).
//     Hosts must keep drawers out of transformed or `contain`ed ancestors
//     (same delta as the `HkModal` mirror).
//   * NO POPUP-MANAGER Z BAND — Vue writes the overlay / panel `z-index` from
//     `usePopupManager` (panel = overlay + 1). The mirror writes none: DOM order
//     (overlay, then panel) plus the host's stacking context decide. Hosts that
//     need a band scope it through `panel_class` / their own `--hk-*` token.
//   * NOT IMPLEMENTED (Vue runtime facilities without a tairitsu analogue in
//     this wave): `useSurfaceMachine` (phase machine / `completeNow` reduced
//     motion finalisation), `useSurfaceTransition` (animationBus track),
//     `useSurfaceContentHold` (content frozen over the leave slide),
//     `createBackGuard` (history entry consumed by the back gesture),
//     `attachOverlayScrollbars` (the body's overlay-scrollbar chrome — the
//     native scrollbar is hidden by the sheet, so hosts that need chrome must
//     attach it themselves), `focusFirst` / `trapFocus` (tab trapping and
//     initial focus), and the `afterLeave` emit (no leave transition edge).
//   * ESCAPE is handled on the PANEL (Vue's `onKeydown`), not on the document:
//     without the focus trap the panel must hold focus for Esc to reach it, so
//     the host either focuses the panel (`tabindex="-1"`) after opening or wires
//     Esc itself.
//   * `aria-label` always carries the `title` (empty when the drawer is
//     header-slot-only) because rsx attributes cannot be omitted conditionally;
//     Vue passes `undefined` there, which drops the attribute. An empty label is
//     ignored by AT, but a slot-only drawer should label itself.
//   * `backGuard` is not a prop here (see above); `mask_closable` is the
//     crate-side name for "an overlay click dismisses". Vue has no separate
//     flag — it gates the overlay click on `closable` — so `mask_closable`
//     defaults to TRUE to keep Vue's default behaviour, and the click needs
//     `closable && overlay && mask_closable`.
// Replaces the retired legacy `Drawer` (`hk-drawer-*` legacy sheet with
// hand-rolled keyframes, inline `display/opacity` strings, the
// `DrawerSize` preset enum and its hardcoded 300/500/700px widths).

use hikari_i18n::t;
use hikari_icons::{Icon, MdiIcon};

use crate::prelude::*;
use crate::styled::StyledComponent;
use crate::utils::{HkPad, hk_pad_style};

pub struct DrawerComponent;

/// The edge the panel docks to (Vue: `side`, default `right`).
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum DrawerSide {
    #[default]
    Right,
    Left,
    Top,
    Bottom,
}

impl DrawerSide {
    /// The `hk-drawer-{placement}` modifier class exactly as Vue emits it.
    pub fn class_name(self) -> &'static str {
        match self {
            DrawerSide::Right => "hk-drawer-right",
            DrawerSide::Left => "hk-drawer-left",
            DrawerSide::Top => "hk-drawer-top",
            DrawerSide::Bottom => "hk-drawer-bottom",
        }
    }

    /// The sheet's enter-transition class for this side (see the
    /// visible-state equivalence note in the file header).
    pub fn enter_active_class(self) -> &'static str {
        match self {
            DrawerSide::Right => "hk-drawer-right-enter-active",
            DrawerSide::Left => "hk-drawer-left-enter-active",
            DrawerSide::Top => "hk-drawer-top-enter-active",
            DrawerSide::Bottom => "hk-drawer-bottom-enter-active",
        }
    }

    /// Left/right panels dock against a vertical edge: the size maps to
    /// `width`, everything else to `height` (Vue: `isVertical`).
    pub fn is_vertical(self) -> bool {
        matches!(self, DrawerSide::Left | DrawerSide::Right)
    }

    /// The bare placement string (mirrors Vue's `DrawerSide` union member).
    pub fn as_str(self) -> &'static str {
        match self {
            DrawerSide::Right => "right",
            DrawerSide::Left => "left",
            DrawerSide::Top => "top",
            DrawerSide::Bottom => "bottom",
        }
    }
}

/// The overlay's class list: the sheet's scrim classes plus its own
/// `scrim-fade` enter hook (see the visible-state equivalence note).
pub fn drawer_overlay_classes() -> &'static str {
    "hk-drawer-overlay hk-drawer-overlay-enter-active"
}

/// The panel's class list, in Vue's order (`hk-drawer-panel`, the side
/// modifier, the host's `panelClass`, then the transition class).
pub fn drawer_panel_classes(placement: DrawerSide, panel_class: &str) -> String {
    let mut classes = String::from("hk-drawer-panel ");
    classes.push_str(placement.class_name());
    if !panel_class.is_empty() {
        classes.push(' ');
        classes.push_str(panel_class);
    }
    classes.push(' ');
    classes.push_str(placement.enter_active_class());
    classes
}

/// The panel's docked-axis geometry — the Rust twin of Vue's `panelStyle`
/// (`{ width: size, maxWidth: "85vw" }` for the vertical sides,
/// `{ height: size, maxHeight: "70vh" }` for the horizontal ones).
pub fn drawer_panel_style(placement: DrawerSide, size: &str) -> String {
    if placement.is_vertical() {
        format!("width:{size};max-width:85vw")
    } else {
        format!("height:{size};max-height:70vh")
    }
}

#[define_props]
pub struct DrawerProps {
    /// Controlled open state (Vue: `modelValue`).
    #[default]
    pub open: bool,

    /// The edge the panel docks to (Vue: `side`).
    #[default]
    pub side: DrawerSide,

    /// Header title (`span.hk-drawer-title`); the `header` slot wins when set.
    pub title: Option<String>,

    /// Render the ✕ and allow Escape to close (Vue default true).
    #[default(true)]
    pub closable: bool,

    /// Render the dim overlay (Vue default true). Also feeds `aria-modal`.
    #[default(true)]
    pub overlay: bool,

    /// Let an overlay click dismiss the drawer (needs `closable` too; see the
    /// header note — Vue derives this from `closable`, the default keeps Vue's
    /// behaviour).
    #[default(true)]
    pub mask_closable: bool,

    /// Docked-axis length: `width` on the vertical sides, `height` on the
    /// horizontal ones (Vue's `size`, default `"320px"`).
    #[default("320px".to_string())]
    pub size: String,

    /// Body container-padding override (`--hk-pad`; see `utils::pad`).
    pub padding: Option<HkPad>,

    /// Extra classes for the panel (Vue: `panelClass`).
    #[default]
    pub panel_class: String,

    /// Header slot content; replaces the title span when provided.
    pub header: Option<Element>,

    /// Footer slot content (rendered inside `.hk-drawer-footer`).
    pub footer: Option<Element>,

    /// Body content (Vue: the default slot).
    pub children: Element,

    /// Fired when the user asks to close (✕ / overlay click / Escape). The
    /// host owns the state and must flip `open`.
    pub on_close: Option<EventHandler<MouseEvent>>,
}

#[component]
pub fn Drawer(props: DrawerProps) -> Element {
    // Controlled surface: closed renders nothing (Vue unmounts the panel when
    // the machine reaches `closed`).
    if !props.open {
        return empty_vnode();
    }

    let placement = props.side;
    let closable = props.closable;
    let overlay = props.overlay;
    let mask_closable = props.mask_closable;

    let on_close = props.on_close.clone();
    // Vue: `onOverlayClick` closes only when `closable && overlay`; the crate
    // adds the explicit `mask_closable` gate on top.
    let overlay_on_close = {
        let handler = on_close.clone();
        move |_event: MouseEvent| {
            if closable
                && overlay
                && mask_closable
                && let Some(handler) = handler.as_ref()
            {
                handler.call(MouseEvent::default());
            }
        }
    };
    // Vue listens on the panel (`onKeydown`), so the panel must hold focus —
    // without the focus trap the host has to place focus there (header note).
    let panel_on_keydown = {
        let handler = on_close.clone();
        move |event: KeyboardEvent| {
            if event.key == "Escape" && closable {
                event.prevent_default();
                event.stop_propagation();
                if let Some(handler) = handler.as_ref() {
                    handler.call(MouseEvent::default());
                }
            }
        }
    };
    let close_on_click = {
        let handler = on_close;
        move |_event: MouseEvent| {
            if let Some(handler) = handler.as_ref() {
                handler.call(MouseEvent::default());
            }
        }
    };

    let panel_classes = drawer_panel_classes(placement, &props.panel_class);

    let panel_style = {
        let frame = drawer_panel_style(placement, &props.size);
        let pad = hk_pad_style(props.padding);
        if pad.is_empty() {
            frame
        } else {
            format!("{frame};{pad}")
        }
    };

    // Vue: `header` renders when `title` OR the header slot is present, and the
    // slot replaces the title span.
    let header_shown = props.title.is_some() || props.header.is_some();
    let aria_modal = if overlay { "true" } else { "false" };
    // rsx attributes are unconditional, so the label is always emitted with the
    // title (empty for a header-slot-only drawer — see the header delta note).
    let aria_label = props.title.clone().unwrap_or_default();

    let overlay_node = rsx! {
        div {
            class: drawer_overlay_classes(),
            onclick: overlay_on_close,
        }
    };

    let panel_node = rsx! {
        div {
            class: panel_classes,
            style: panel_style,
            "role": "dialog",
            "aria-modal": aria_modal,
            "aria-label": aria_label,
            tabindex: -1,
            onkeydown: panel_on_keydown,
            if header_shown {
                div { class: "hk-drawer-header",
                    if let Some(header) = &props.header {
                        {header.clone()}
                    } else if let Some(title) = props.title.as_deref() {
                        span { class: "hk-drawer-title",
                            "{title}"
                        }
                    }
                    if closable {
                        button {
                            class: "hk-window-close hk-drawer-close",
                            "type": "button",
                            "aria-label": t("hikari::drawer.close", "Close"),
                            onclick: close_on_click,
                            Icon {
                                icon: MdiIcon::Close,
                                size: 16,
                            }
                        }
                    }
                }
            }
            div { class: "hk-drawer-body-wrap",
                div { class: "hk-drawer-body",
                    {props.children.clone()}
                }
            }
            if let Some(footer) = &props.footer {
                div { class: "hk-drawer-footer",
                    {footer.clone()}
                }
            }
        }
    };

    // Vue renders the overlay and the panel as siblings (overlay first); the
    // `overlay: false` form is the panel alone.
    let mut layers: Vec<Element> = Vec::with_capacity(2);
    if overlay {
        layers.push(overlay_node);
    }
    layers.push(panel_node);
    VNode::Fragment(layers)
}

impl StyledComponent for DrawerComponent {
    fn styles() -> &'static str {
        // The canonical Vue sheet, compiled verbatim (no_hash keeps the
        // `.hk-drawer*` names literal so this CSS matches the Vue build).
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkDrawer.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "drawer"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn drawer_placement_class_names_match_the_vue_modifiers() {
        assert_eq!(DrawerSide::Right.class_name(), "hk-drawer-right");
        assert_eq!(DrawerSide::Left.class_name(), "hk-drawer-left");
        assert_eq!(DrawerSide::Top.class_name(), "hk-drawer-top");
        assert_eq!(DrawerSide::Bottom.class_name(), "hk-drawer-bottom");
        assert_eq!(DrawerSide::Right.as_str(), "right");
        assert_eq!(DrawerSide::Bottom.as_str(), "bottom");
    }

    #[test]
    fn drawer_placement_axis_splits_verticals_from_horizontals() {
        assert!(DrawerSide::Left.is_vertical());
        assert!(DrawerSide::Right.is_vertical());
        assert!(!DrawerSide::Top.is_vertical());
        assert!(!DrawerSide::Bottom.is_vertical());
    }

    #[test]
    fn drawer_panel_style_maps_size_to_the_docked_axis() {
        // Vue's panelStyle: width + maxWidth for the side docks, height +
        // maxHeight for the sheet docks.
        assert_eq!(
            drawer_panel_style(DrawerSide::Right, "320px"),
            "width:320px;max-width:85vw"
        );
        assert_eq!(
            drawer_panel_style(DrawerSide::Left, "22rem"),
            "width:22rem;max-width:85vw"
        );
        assert_eq!(
            drawer_panel_style(DrawerSide::Bottom, "240px"),
            "height:240px;max-height:70vh"
        );
        assert_eq!(
            drawer_panel_style(DrawerSide::Top, "40vh"),
            "height:40vh;max-height:70vh"
        );
    }

    #[test]
    fn drawer_classes_carry_the_visible_state_equivalence() {
        // The open surface keeps its enter-active class (no -from / -to pair can
        // ever apply — see the header note).
        assert_eq!(
            drawer_overlay_classes(),
            "hk-drawer-overlay hk-drawer-overlay-enter-active"
        );
        assert_eq!(
            drawer_panel_classes(DrawerSide::Right, ""),
            "hk-drawer-panel hk-drawer-right hk-drawer-right-enter-active"
        );
        // Vue's order: panel, side modifier, panelClass, transition classes.
        assert_eq!(
            drawer_panel_classes(DrawerSide::Bottom, "settings-drawer"),
            "hk-drawer-panel hk-drawer-bottom settings-drawer hk-drawer-bottom-enter-active"
        );
        assert_eq!(
            DrawerSide::Left.enter_active_class(),
            "hk-drawer-left-enter-active"
        );
    }

    #[test]
    fn drawer_defaults_match_the_vue_props() {
        let props = DrawerProps::default();
        assert!(!props.open);
        assert_eq!(props.side, DrawerSide::Right);
        assert!(props.title.is_none());
        assert!(props.closable);
        assert!(props.overlay);
        // Vue derives the mask dismissal from `closable` (default true), so the
        // crate-side gate defaults to true as well.
        assert!(props.mask_closable);
        assert_eq!(props.size, "320px");
        assert!(props.padding.is_none());
        assert_eq!(props.panel_class, "");
        assert!(props.header.is_none());
        assert!(props.footer.is_none());
        assert!(props.on_close.is_none());
    }

    #[test]
    fn drawer_styles_come_from_the_canonical_vue_sheet() {
        let css = DrawerComponent::styles();
        assert!(
            css.contains(".hk-drawer-overlay") && css.contains(".hk-drawer-panel"),
            "drawer css must carry the vue layers"
        );
        assert!(
            css.contains(".hk-drawer-body-wrap") && css.contains(".hk-drawer-body"),
            "drawer css must carry the vue body band"
        );
        assert!(
            css.contains(".hk-drawer-right-enter-active")
                && css.contains(".hk-drawer-overlay-enter-active"),
            "the visible-state classes this mirror emits must exist in the sheet"
        );
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored drawer sheet"
        );
    }
}
