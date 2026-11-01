// hi-components/src/overlay/context_menu_provider.rs
// ContextMenuProvider — mirror of the canonical Vue `HkContextMenuProvider`,
// the mount-once host of the app's context menu.
//
// THE SHEET OWNERSHIP (verified, not assumed — `styles()` returns `""` for that
// reason): Vue ships NO sheet for this component. `HkContextMenuProvider.tsx`
// renders the default slot plus one `HkMenu` (`variant="popup"`), and the
// popup's canvas is `HkSelectPanel`'s (`.hk-select-popout-host` /
// `.hk-select-popout`, painted by `HkSelect.scss` — mirrored and compiled by
// `basic/select.rs`) while its rows/levels are `HkMenu`'s (`.hk-menu-*`, whose
// sheet is NOT part of the vendored mirror set, so those classes reach the Rust
// form as DOM hooks — the same deal `basic/kbd.rs` documents). The provider
// therefore owns no class of its own; it owns the STATE, the POINTER, and the
// Escape path. (The Vue component's own test suite agrees: its `.content` /
// `.quadrant` specs assert behaviour, never CSS.)
//
// DOM contract (mirrors Vue: the slot, then ONE menu surface):
//
//   {children}                                    (Vue: the default slot)
//   div.hk-select-popout-host                     (only while open + content)
//       data-side="bottom|top" data-align="start|end"
//       (style: pointer-pinned inline geometry — see `context_menu_position_style`)
//     div.hk-select-popout [aria-label={title}]   (keydown: Escape closes)
//       {menu}                                    (host-supplied level/rows)
//
// Control contract (Vue: `provide(CONTEXT_MENU_KEY)` + an internal `ref`):
// Vue's provider holds `open` / `request` / `menuEpoch` in `ref`s and exposes
// `open(request)` / `close()` to the whole tree through provide/inject.
// tairitsu 0.5.22 has neither per-instance component state (`use_signal`
// allocates a fresh signal per render, `use_state` shares ONE slot per
// component type) nor a provide/inject channel, so the mirror is CONTROLLED:
// the host owns `open`, the trigger coordinates `x`/`y`, the optional
// `viewport`, the `title` and the menu content slot, and hears the close
// request through `on_close`. Nothing is stored here.
//
// Placement: the quadrant the pointer sits in decides where the menu grows
// (Vue's `quadrantPlacement`), half-splitting the POPUP viewport — the window
// minus the host's reserved app-chrome band (`popupViewportRect()`). Vue falls
// back to `bottom-start` when there is no DOM; the mirror does the same when the
// host passes no viewport. The panel geometry itself is the shared select-panel
// geometry (`select_popout_style` over a zero-size anchor at the pointer, i.e.
// Vue's synthetic `pointAnchor`), so a context menu sits exactly where every
// other family popup would.
//
// Behaviour deltas vs Vue (documented, not accidental):
//   * NO `provide`/`inject`: `useContextMenu()` / `useContextMenuTrigger()`
//     have no mirror-side analogue — the host passes the request down as props
//     (`open` + `x`/`y` + `menu` + `title`) instead of injecting an API.
//   * NO `menuEpoch` remount identity: Vue bumps an epoch per open so a fresh
//     `HkMenu` starts with clean cascade levels / back-guard / hovered
//     submenus. The mirror renders no menu instance state at all (the level is
//     host content), so there is nothing to reset.
//   * NO MOBILE BOTTOM SHEET: Vue's `HkMenu` opens a full-width sheet with a
//     back guard below 768px. This provider has no sheet of its own — the
//     popout renders at every width, and a host that wants the sheet grammar
//     mounts one.
//   * NO AUTO-FLIP / OUTSIDE-CLICK CLOSE / CASCADE / KEYBOARD ROW NAVIGATION:
//     all of them are HkSelectPanel/HkMenu runtime contracts (document-level
//     listeners, measured boxes, per-level panels). The quadrant choice is a
//     PREFERENCE, exactly as in Vue where the panel still flips afterwards.
//     Escape (on the panel) and the host's own dismissal paths are the close
//     channels; the panel must hold focus for Esc to reach it.
//   * NO MENU GRAMMAR IS INVENTED: the `div.hk-menu-level role="menu"` level and
//     its rows are the host's content slot. An open request with NO content
//     paints nothing (a delta from Vue, whose empty `items` still paints an
//     empty level's box) — `context_menu_surface_shown` is the gate.

use crate::basic::select::{SelectPanelPlacement, select_popout_style};
use crate::feedback::PopoverAnchorRect;
use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct ContextMenuProviderComponent;

/// The popup-surface host class (HkSelectPanel's, painted by the mirrored
/// `HkSelect.scss`). The provider renders it, it does not own it.
pub const CONTEXT_MENU_HOST_CLASS: &str = "hk-select-popout-host";

/// The popup surface class inside the host (same sheet, same ownership).
pub const CONTEXT_MENU_PANEL_CLASS: &str = "hk-select-popout";

/// The popup viewport the quadrant halves split: the window minus the app-chrome
/// band the host reserved (Vue: `popupViewportRect()`).
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub struct ContextMenuViewport {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

/// The four quadrant placements a context menu can take (Vue: the
/// `"bottom-start" | "bottom-end" | "top-start" | "top-end"` return union).
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum ContextMenuPlacement {
    #[default]
    BottomStart,
    BottomEnd,
    TopStart,
    TopEnd,
}

impl ContextMenuPlacement {
    /// The Vue union token (`"bottom-start"` …) — also the shared panel's token.
    pub fn token(self) -> &'static str {
        match self {
            ContextMenuPlacement::BottomStart => "bottom-start",
            ContextMenuPlacement::BottomEnd => "bottom-end",
            ContextMenuPlacement::TopStart => "top-start",
            ContextMenuPlacement::TopEnd => "top-end",
        }
    }

    /// The `data-side` value the sheet's rules key on.
    pub fn side(self) -> &'static str {
        match self {
            ContextMenuPlacement::BottomStart | ContextMenuPlacement::BottomEnd => "bottom",
            ContextMenuPlacement::TopStart | ContextMenuPlacement::TopEnd => "top",
        }
    }

    /// The `data-align` value the sheet's rules key on.
    pub fn align(self) -> &'static str {
        match self {
            ContextMenuPlacement::BottomStart | ContextMenuPlacement::TopStart => "start",
            ContextMenuPlacement::BottomEnd | ContextMenuPlacement::TopEnd => "end",
        }
    }

    /// The shared panel placement this quadrant maps onto — one geometry
    /// authority for every family popup (`basic/select.rs`).
    pub fn panel_placement(self) -> SelectPanelPlacement {
        match self {
            ContextMenuPlacement::BottomStart => SelectPanelPlacement::BottomStart,
            ContextMenuPlacement::BottomEnd => SelectPanelPlacement::BottomEnd,
            ContextMenuPlacement::TopStart => SelectPanelPlacement::TopStart,
            ContextMenuPlacement::TopEnd => SelectPanelPlacement::TopEnd,
        }
    }
}

/// Vue's `quadrantPlacement`: the menu grows away from the pointer's nearest
/// edges — downwards when there is more room below, towards the end when there
/// is more room to the left. The halves split the POPUP viewport, so a menu
/// opened over a desktop shell's reserved strip grows into the usable space.
/// With no viewport (Vue: no DOM / SSR) the answer is `bottom-start`.
pub fn context_menu_placement(
    x: f64,
    y: f64,
    viewport: Option<ContextMenuViewport>,
) -> ContextMenuPlacement {
    let Some(frame) = viewport else {
        return ContextMenuPlacement::BottomStart;
    };
    let below = y <= frame.y + frame.height / 2.0;
    let right = x <= frame.x + frame.width / 2.0;
    if below && right {
        ContextMenuPlacement::BottomStart
    } else if below {
        ContextMenuPlacement::BottomEnd
    } else if right {
        ContextMenuPlacement::TopStart
    } else {
        ContextMenuPlacement::TopEnd
    }
}

/// The inline geometry that pins the `position: fixed` popout host to the
/// POINTER (Vue: `pointAnchor`, a zero-size rect at the open point). No offset
/// and no width match: a context menu anchors at the cursor, not at a trigger
/// box.
pub fn context_menu_position_style(x: f64, y: f64, placement: ContextMenuPlacement) -> String {
    select_popout_style(
        placement.panel_placement(),
        PopoverAnchorRect {
            x,
            y,
            width: 0.0,
            height: 0.0,
        },
        0.0,
        false,
    )
}

/// Vue renders its one menu unconditionally; the mirror needs the content slot,
/// so an open request WITHOUT content paints no surface at all (header delta).
pub fn context_menu_surface_shown(open: bool, has_menu: bool) -> bool {
    open && has_menu
}

#[define_props]
pub struct ContextMenuProviderProps {
    /// Controlled menu state (Vue: the provider's own `open` ref).
    #[default]
    pub open: bool,

    /// Pointer client X of the request (Vue: `request.x`).
    #[default]
    pub x: f64,

    /// Pointer client Y of the request (Vue: `request.y`).
    #[default]
    pub y: f64,

    /// The popup viewport the quadrant halves split (Vue:
    /// `popupViewportRect()`); `None` resolves to `bottom-start` like Vue does
    /// without a DOM.
    pub viewport: Option<ContextMenuViewport>,

    /// Accessible name of the menu surface (Vue: `request.title`; empty drops
    /// the attribute).
    #[default]
    pub title: String,

    /// Close request (Escape, or the host's own dismissal paths). The host owns
    /// `open` and must flip it (Vue: `request.onClose`).
    pub on_close: Option<EventHandler<()>>,

    /// The menu content — the level/rows (`div.hk-menu-level[role=menu]` …) the
    /// host supplies, since `HkMenu` is not mirrored in this wave.
    pub menu: Option<Element>,

    /// The app subtree the provider wraps (Vue: the default slot).
    pub children: Element,
}

#[component]
pub fn ContextMenuProvider(props: ContextMenuProviderProps) -> Element {
    // Closed (or an open request with no content): the provider renders the app
    // subtree and nothing else — Vue's closed `HkMenu` mounts no surface.
    if !context_menu_surface_shown(props.open, props.menu.is_some()) {
        return props.children.clone();
    }

    let placement = context_menu_placement(props.x, props.y, props.viewport);
    let geometry = context_menu_position_style(props.x, props.y, placement);
    // Vue: `title={request.value?.title ?? ""}` flows into HkSelectPanel's
    // `aria-label={props.title || undefined}` — empty drops the attribute.
    let aria_label = if props.title.is_empty() {
        None
    } else {
        Some(props.title.clone())
    };
    let menu = props.menu.clone().unwrap_or_else(empty_vnode);
    let on_close = props.on_close.clone();
    let panel_keydown = move |event: KeyboardEvent| {
        if event.key == "Escape" {
            event.prevent_default();
            event.stop_propagation();
            if let Some(handler) = on_close.as_ref() {
                handler.call(());
            }
        }
    };

    // The slot first, then the one menu surface (Vue's fragment order).
    let surface = rsx! {
        div {
            class: CONTEXT_MENU_HOST_CLASS,
            "data-side": placement.side(),
            "data-align": placement.align(),
            style: geometry,
            div {
                class: CONTEXT_MENU_PANEL_CLASS,
                "aria-label": aria_label,
                onkeydown: panel_keydown,
                {menu}
            }
        }
    };
    VNode::Fragment(vec![props.children.clone(), surface])
}

impl StyledComponent for ContextMenuProviderComponent {
    fn styles() -> &'static str {
        // NO sheet of its own — verified, not assumed: Vue ships no
        // `HkContextMenuProvider.scss`; the surface is HkSelectPanel's
        // (`.hk-select-popout*`, painted by the mirrored `HkSelect.scss` that
        // `basic/select.rs` compiles) and the menu rows/levels are HkMenu's
        // (`.hk-menu-*` — hook-only this wave, exactly like `basic/kbd.rs`).
        // Registering this name is still correct: it pins the component's
        // identity in the registry bundle with no CSS of its own.
        ""
    }

    fn name() -> &'static str {
        "context-menu-provider"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn viewport() -> ContextMenuViewport {
        ContextMenuViewport {
            x: 0.0,
            y: 0.0,
            width: 1000.0,
            height: 800.0,
        }
    }

    #[test]
    fn context_menu_quadrants_match_the_vue_halves() {
        let frame = Some(viewport());
        // Upper-left half: grow down and right.
        assert_eq!(
            context_menu_placement(100.0, 100.0, frame),
            ContextMenuPlacement::BottomStart
        );
        // Upper-right half: grow down and left.
        assert_eq!(
            context_menu_placement(900.0, 100.0, frame),
            ContextMenuPlacement::BottomEnd
        );
        // Lower-left half: grow up and right.
        assert_eq!(
            context_menu_placement(100.0, 700.0, frame),
            ContextMenuPlacement::TopStart
        );
        // Lower-right half: grow up and left.
        assert_eq!(
            context_menu_placement(900.0, 700.0, frame),
            ContextMenuPlacement::TopEnd
        );
        // Vue's comparisons are `<=`: the exact halves stay in the near arm.
        assert_eq!(
            context_menu_placement(500.0, 400.0, frame),
            ContextMenuPlacement::BottomStart
        );
        // A reserved app-chrome band shifts the split, not the quadrant count.
        let banded = Some(ContextMenuViewport {
            x: 0.0,
            y: 56.0,
            width: 1000.0,
            height: 400.0,
        });
        assert_eq!(
            context_menu_placement(500.0, 300.0, banded),
            ContextMenuPlacement::TopStart
        );
        // No viewport: Vue's no-DOM answer.
        assert_eq!(
            context_menu_placement(0.0, 0.0, None),
            ContextMenuPlacement::BottomStart
        );
        assert_eq!(
            context_menu_placement(999.0, 999.0, None),
            ContextMenuPlacement::BottomStart
        );
    }

    #[test]
    fn context_menu_tokens_match_the_shared_panel_union() {
        for placement in [
            ContextMenuPlacement::BottomStart,
            ContextMenuPlacement::BottomEnd,
            ContextMenuPlacement::TopStart,
            ContextMenuPlacement::TopEnd,
        ] {
            // One geometry authority: the quadrant token IS the panel token.
            assert_eq!(placement.token(), placement.panel_placement().token());
        }
        assert_eq!(ContextMenuPlacement::BottomStart.side(), "bottom");
        assert_eq!(ContextMenuPlacement::BottomStart.align(), "start");
        assert_eq!(ContextMenuPlacement::BottomEnd.side(), "bottom");
        assert_eq!(ContextMenuPlacement::BottomEnd.align(), "end");
        assert_eq!(ContextMenuPlacement::TopStart.side(), "top");
        assert_eq!(ContextMenuPlacement::TopStart.align(), "start");
        assert_eq!(ContextMenuPlacement::TopEnd.side(), "top");
        assert_eq!(ContextMenuPlacement::TopEnd.align(), "end");
        // The surface classes are the select panel's (see `styles()`).
        assert_eq!(CONTEXT_MENU_HOST_CLASS, "hk-select-popout-host");
        assert_eq!(CONTEXT_MENU_PANEL_CLASS, "hk-select-popout");
    }

    #[test]
    fn context_menu_coordinates_pin_the_pointer() {
        // Downward quadrants put the panel's TOP edge on the pointer.
        assert_eq!(
            context_menu_position_style(100.0, 50.0, ContextMenuPlacement::BottomStart),
            "left:100px;top:50px"
        );
        assert_eq!(
            context_menu_position_style(100.0, 50.0, ContextMenuPlacement::BottomEnd),
            "left:100px;top:50px;transform:translateX(-100%)"
        );
        // Upward quadrants pin the BOTTOM edge, so no panel height is needed.
        assert_eq!(
            context_menu_position_style(100.0, 50.0, ContextMenuPlacement::TopStart),
            "left:100px;bottom:calc(100vh - 50px)"
        );
        assert_eq!(
            context_menu_position_style(100.0, 50.0, ContextMenuPlacement::TopEnd),
            "left:100px;bottom:calc(100vh - 50px);transform:translateX(-100%)"
        );
        // A zero-size anchor never publishes a min-width.
        assert!(
            !context_menu_position_style(0.0, 0.0, ContextMenuPlacement::BottomStart)
                .contains("min-width")
        );
    }

    #[test]
    fn context_menu_surface_gate_matches_the_mirror_contract() {
        assert!(!context_menu_surface_shown(false, false));
        assert!(!context_menu_surface_shown(false, true));
        // An open request without content paints nothing (header delta).
        assert!(!context_menu_surface_shown(true, false));
        assert!(context_menu_surface_shown(true, true));
    }

    #[test]
    fn context_menu_provider_defaults_match_the_vue_request() {
        let props = ContextMenuProviderProps::default();
        assert!(!props.open);
        assert_eq!(props.x, 0.0);
        assert_eq!(props.y, 0.0);
        assert!(props.viewport.is_none());
        assert_eq!(props.title, "");
        assert!(props.on_close.is_none());
        assert!(props.menu.is_none());
    }

    #[test]
    fn context_menu_provider_renders_the_slot_then_the_popout() {
        let html = ContextMenuProvider(ContextMenuProviderProps {
            open: true,
            x: 100.0,
            y: 50.0,
            viewport: Some(viewport()),
            title: "Actions".to_string(),
            menu: Some(rsx! {
                div { class: "hk-menu-level", "role": "menu",
                    button { class: "hk-menu-row", "type": "button", "Copy" }
                }
            }),
            children: rsx! {
                main { class: "host-app", "app" }
            },
            ..Default::default()
        })
        .render_to_html();

        // The app subtree renders first, untouched.
        assert!(html.contains(r#"class="host-app""#), "{html}");
        // The popup surface: the select-panel host with the quadrant markers …
        assert!(html.contains(r#"class="hk-select-popout-host""#), "{html}");
        assert!(html.contains(r#"data-side="bottom""#), "{html}");
        assert!(html.contains(r#"data-align="start""#), "{html}");
        // … pinned to the pointer …
        assert!(html.contains(r#"style="left:100px;top:50px""#), "{html}");
        // … with the popout, its accessible name and the host's menu content.
        assert!(html.contains(r#"class="hk-select-popout""#), "{html}");
        assert!(html.contains(r#"aria-label="Actions""#), "{html}");
        assert!(html.contains(r#"class="hk-menu-level""#), "{html}");
        assert!(html.contains(r#"role="menu""#), "{html}");
        assert!(html.contains(">Copy<"), "{html}");
    }

    #[test]
    fn context_menu_provider_closed_renders_the_slot_only() {
        let html = ContextMenuProvider(ContextMenuProviderProps {
            viewport: Some(viewport()),
            menu: Some(rsx! {
                div { class: "hk-menu-level", "role": "menu" }
            }),
            children: rsx! {
                main { class: "host-app", "app" }
            },
            ..Default::default()
        })
        .render_to_html();

        assert!(html.contains(r#"class="host-app""#), "{html}");
        assert!(!html.contains("hk-select-popout-host"), "{html}");
        assert!(!html.contains("hk-select-popout"), "{html}");
    }

    #[test]
    fn context_menu_provider_ships_no_sheet_of_its_own() {
        // Verified ownership: Vue ships no `HkContextMenuProvider.scss`; the
        // surface comes from the mirrored HkSelect sheet and the rows from
        // HkMenu (hook-only this wave).
        assert_eq!(ContextMenuProviderComponent::styles(), "");
        assert_eq!(
            ContextMenuProviderComponent::name(),
            "context-menu-provider"
        );
    }
}
