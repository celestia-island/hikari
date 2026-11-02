// hi-components/src/layout/admin_shell.rs
// AdminShell — mirror of the canonical Vue `HkAdminShell` (the ADMIN face of
// the generalized shell).
//
// NO HIKARI SHEET, on purpose. Vue's wrapper ships none either: it is a thin,
// behaviour-identical wrapper that renders `HkFaceShell` in DOCUMENT mode, and
// every structural class is a host utility class (`s-admin-shell*` from
// `packages/vue/src/styles/admin-tokens.scss`) supplied by the host. So the
// mirror guarantees the DOM STRUCTURE and the `data-*` hooks only; `styles()`
// returns `""` and this file invents no CSS.
//
// DOM contract = [`crate::layout::face_shell::FaceShell`] with
// `content_mode: document` (the wrapper adds no element of its own):
//
//   div.s-admin-shell                                 (FaceShell root)
//     div [style="flex-shrink:0"]                     (header slot)
//     div.s-admin-shell-body [style="padding-bottom:{footer_pad}"]
//       aside.hk-sidebar-rail-host | aside            (see FaceShell)
//       main.s-admin-shell-main [data-content-mode="document"]
//         div.s-admin-shell-scroll [style="overflow:auto"]
//           div [style="padding:{content_padding}"]   (content / crossfade)
//       <Drawer side=left size=280px>                 (mobile only)
//     footer.s-status-bar                             (footer slot)
//     {overlays slot}
//
// The Vue wrapper's ONE addition over `HkFaceShell` is its own action-bar
// provide (`provideActionBar()`), whose registered actions it hands to the
// header slot as the extra `actions` param. That channel is a provide/inject
// store — a render-scoped hook in this release — so it cannot be mirrored
// (ledger L48): the host passes its actions straight to its own header element
// and the header slot receives no scoped params. Nothing else differs: props,
// slots and rendered classes are the FaceShell ones, including the declared
// `content_mode` forwarding rule (Vue declares `contentMode` on the wrapper so
// a stray attr cannot flip the inner shell into stage mode — here the mode is
// not a prop of this component at all, which is the same guarantee).
//
// STATE CONTRACT (ledger L48). Vue keeps the mobile drawer open state and the
// semi-controlled rail channel inside `HkFaceShell`; both become CONTROLLED
// props on this wrapper (`mobile_open`, `sidebar_rail_style`, `peeking`,
// `pinning`) plus the drawer's change callback (`on_mobile_open_change`) and
// the rail host's pointer/key edges. The wrapper stores nothing itself.
//
// Deltas vs Vue (documented, not accidental):
//   * `sidebarPeekDelay` / `sidebarPeekGrace` are RETIRED with the peek
//     machine: the dwell/grace timers live in `useSidebarRail`, which is not
//     mirrored (FaceShell's header, delta 1), so a forwarded millisecond value
//     would configure nothing. A host that keeps the machine wires its own
//     timings.
//   * The action-bar channel is gone (see above): no `actions` param reaches
//     the header slot, and the header slot is a plain `Element`.
//   * `onSidebarRailStyleChange` keeps its upstream meaning: the wrapper
//     forwards `on_sidebar_rail_style_change` to the inner shell's channel, so
//     the mirrored rail toggle flips the host's state through this face too.
//   * `contentMode` is not a prop: this face IS document mode by definition;
//     stage faces consume `FaceShell` directly (Vue documents the same
//     split).
//   * `HkFaceShell`'s padding-scan surface (`scanPaddingSides`,
//     `splitPaddingSides`, `mobileSideGutterFree`, `PaddingSidesScan`) is
//     re-exported from this module exactly like the Vue module re-exports it,
//     so an importer keyed on the admin name keeps compiling.

// ONE `use` for the whole face-shell dependency (no second `use` from the same
// module: the nightly `imports_granularity = Module` pass would fold them).
// The re-exported half is the Vue module's public surface: the padding-scan
// helpers moved INTO `HkFaceShell` with the content host that applies them, but
// they are still exported from the admin module (its tests and external
// importers know this module as their home). `FaceShellRailStyle` rides along
// because it types this wrapper's `sidebar_rail_style` channel, and the
// composition seam itself (`FaceShell` / its props / its content-mode enum) is
// re-exported so a consumer of the admin face names it from here too.
use tairitsu_vdom::PointerEvent;

pub use crate::layout::face_shell::{
    CSS_WIDE_KEYWORDS, FaceShell, FaceShellContentMode, FaceShellProps, FaceShellRailStyle,
    PaddingSidesScan, mobile_side_gutter_free, scan_padding_sides, split_padding_sides,
};
use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct AdminShellComponent;

#[define_props]
pub struct AdminShellProps {
    /// Hide the desktop sidebar entirely (forwarded).
    #[default]
    pub sidebar_collapsed: bool,

    /// Full sidebar width (Vue default `"224px"`).
    #[default("224px".to_string())]
    pub sidebar_width: String,

    /// Opt into the desktop icon-rail capability (forwarded).
    #[default]
    pub sidebar_collapsible: bool,

    /// Layout width of the icon rail (Vue default `"56px"`).
    #[default("56px".to_string())]
    pub sidebar_collapsed_width: String,

    /// CONTROLLED rail state channel (Vue: `v-model:sidebar-rail-style`).
    #[default]
    pub sidebar_rail_style: FaceShellRailStyle,

    /// Fires with the style the rail toggle asks for (Vue:
    /// `update:sidebarRailStyle`, forwarded straight through this wrapper).
    pub on_sidebar_rail_style_change: Option<EventHandler<FaceShellRailStyle>>,

    /// CONTROLLED peek state (forwarded).
    #[default]
    pub peeking: bool,

    /// CONTROLLED pin window (forwarded).
    #[default]
    pub pinning: bool,

    /// Viewport width at which the desktop layout takes over (Vue default
    /// 1024).
    #[default(1024.0)]
    pub mobile_breakpoint: f64,

    /// Live viewport width, fed by the host (`0.0` = not measured yet).
    #[default(0.0)]
    pub viewport_width: f64,

    /// Height reserved under the scroll body for a fixed status-bar band
    /// (injection-driven, see [`FaceShellProps::footer_height`]).
    pub footer_height: Option<String>,

    /// Mobile nav drawer title.
    pub nav_title: Option<String>,

    /// Extra class for the mobile nav drawer's panel.
    pub drawer_panel_class: Option<String>,

    /// Content-area padding inside the scroll viewport (Vue default
    /// `"1.5rem"`).
    #[default("1.5rem".to_string())]
    pub content_padding: String,

    /// Identity of the content page on stage (`Some` runs the crossfade).
    pub content_key: Option<String>,

    /// Canvas page opt-in: drop the phone side gutters (see FaceShell).
    #[default]
    pub content_bleed_on_mobile: bool,

    /// CONTROLLED mobile drawer state.
    #[default]
    pub mobile_open: bool,

    /// Header region (Vue: the `header` slot — no `actions` param, see the
    /// file header).
    pub header: Option<Element>,

    /// Nav content: desktop sidebar + mobile drawer body.
    pub sidebar: Option<Element>,

    /// Drawer footer content (Vue: `userPanel`).
    pub user_panel: Option<Element>,

    /// The content slot.
    pub content: Element,

    /// Fixed status-bar band.
    pub footer: Option<Element>,

    /// Floating layers rendered last.
    pub overlays: Option<Element>,

    /// Fires with the desired mobile drawer state (Vue: the drawer's
    /// `update:modelValue` and the slots' `onNavigate` / `onOpenDrawer`).
    pub on_mobile_open_change: Option<EventHandler<bool>>,

    /// Pointer entered the rail host (Vue: the peek machine's enter edge).
    pub on_rail_pointer_enter: Option<EventHandler<PointerEvent>>,

    /// Pointer left the rail host.
    pub on_rail_pointer_leave: Option<EventHandler<PointerEvent>>,

    /// Pointer moved over the rail host.
    pub on_rail_pointer_move: Option<EventHandler<PointerEvent>>,

    /// Key pressed on the rail host (Vue: Escape closes the peek).
    pub on_rail_keydown: Option<EventHandler<KeyboardEvent>>,
}

/// Project this wrapper's props onto the inner shell. `content_mode` is PINNED
/// to `Document` — the admin face is the document face by definition, and a
/// host cannot opt into stage mode through this wrapper (Vue declares
/// `contentMode` on the wrapper for exactly that reason).
pub fn admin_shell_face_props(props: &AdminShellProps) -> FaceShellProps {
    FaceShellProps {
        sidebar_collapsed: props.sidebar_collapsed,
        sidebar_width: props.sidebar_width.clone(),
        sidebar_collapsible: props.sidebar_collapsible,
        sidebar_collapsed_width: props.sidebar_collapsed_width.clone(),
        rail_style: props.sidebar_rail_style,
        on_rail_style_change: props.on_sidebar_rail_style_change.clone(),
        peeking: props.peeking,
        pinning: props.pinning,
        mobile_breakpoint: props.mobile_breakpoint,
        viewport_width: props.viewport_width,
        footer_height: props.footer_height.clone(),
        nav_title: props.nav_title.clone(),
        drawer_panel_class: props.drawer_panel_class.clone(),
        content_mode: FaceShellContentMode::Document,
        content_padding: props.content_padding.clone(),
        content_key: props.content_key.clone(),
        content_bleed_on_mobile: props.content_bleed_on_mobile,
        mobile_open: props.mobile_open,
        header: props.header.clone(),
        sidebar: props.sidebar.clone(),
        user_panel: props.user_panel.clone(),
        content: props.content.clone(),
        footer: props.footer.clone(),
        overlays: props.overlays.clone(),
        on_mobile_open_change: props.on_mobile_open_change.clone(),
        on_rail_pointer_enter: props.on_rail_pointer_enter.clone(),
        on_rail_pointer_leave: props.on_rail_pointer_leave.clone(),
        on_rail_pointer_move: props.on_rail_pointer_move.clone(),
        on_rail_keydown: props.on_rail_keydown.clone(),
    }
}

#[component]
pub fn AdminShell(props: AdminShellProps) -> Element {
    // Vue: `h(HkFaceShell, forwardedProps, slots)` — the wrapper renders no
    // element of its own.
    FaceShell(admin_shell_face_props(&props))
}

impl StyledComponent for AdminShellComponent {
    fn styles() -> &'static str {
        // The Vue wrapper ships no sheet: it forwards to `HkFaceShell`, whose
        // layout is the host's admin token sheet. See the file header.
        ""
    }

    fn name() -> &'static str {
        "admin-shell"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn admin_shell_defaults_match_the_vue_props() {
        let props = AdminShellProps::default();
        assert!(!props.sidebar_collapsed);
        assert_eq!(props.sidebar_width, "224px");
        assert!(!props.sidebar_collapsible);
        assert_eq!(props.sidebar_collapsed_width, "56px");
        assert_eq!(props.sidebar_rail_style, FaceShellRailStyle::Expanded);
        assert!(props.on_sidebar_rail_style_change.is_none());
        assert!(!props.peeking);
        assert!(!props.pinning);
        assert_eq!(props.mobile_breakpoint, 1024.0);
        assert_eq!(props.viewport_width, 0.0);
        assert!(props.footer_height.is_none());
        assert!(props.nav_title.is_none());
        assert!(props.drawer_panel_class.is_none());
        assert_eq!(props.content_padding, "1.5rem");
        assert!(props.content_key.is_none());
        assert!(!props.content_bleed_on_mobile);
        assert!(!props.mobile_open);
        assert!(props.header.is_none());
        assert!(props.sidebar.is_none());
        assert!(props.user_panel.is_none());
        assert!(props.footer.is_none());
        assert!(props.overlays.is_none());
        assert!(props.on_mobile_open_change.is_none());
        assert!(props.on_rail_pointer_enter.is_none());
        assert!(props.on_rail_pointer_leave.is_none());
        assert!(props.on_rail_pointer_move.is_none());
        assert!(props.on_rail_keydown.is_none());
    }

    #[test]
    fn admin_shell_forwards_every_prop_and_pins_the_document_mode() {
        let props = AdminShellProps {
            sidebar_collapsed: true,
            sidebar_width: "260px".to_string(),
            sidebar_collapsible: true,
            sidebar_collapsed_width: "48px".to_string(),
            sidebar_rail_style: FaceShellRailStyle::Rail,
            peeking: true,
            pinning: true,
            mobile_breakpoint: 768.0,
            viewport_width: 390.0,
            footer_height: Some("var(--s-footer-height)".to_string()),
            nav_title: Some("Menu".to_string()),
            drawer_panel_class: Some("flush".to_string()),
            content_padding: "2rem".to_string(),
            content_key: Some("providers".to_string()),
            content_bleed_on_mobile: true,
            mobile_open: true,
            // The rail channel is one of the two callbacks the wrapper relays
            // (Vue: `update:sidebarRailStyle` riding attrs fallthrough).
            on_sidebar_rail_style_change: Some(EventHandler::new(|_style: FaceShellRailStyle| {})),
            ..Default::default()
        };
        let face = admin_shell_face_props(&props);
        // The one thing the wrapper decides on its own: the content mode.
        assert_eq!(face.content_mode, FaceShellContentMode::Document);
        // Everything else is a verbatim forward.
        assert!(face.sidebar_collapsed);
        assert_eq!(face.sidebar_width, "260px");
        assert!(face.sidebar_collapsible);
        assert_eq!(face.sidebar_collapsed_width, "48px");
        assert_eq!(face.rail_style, FaceShellRailStyle::Rail);
        assert!(
            face.on_rail_style_change.is_some(),
            "the rail channel forwards straight through the wrapper"
        );
        assert!(face.peeking);
        assert!(face.pinning);
        assert_eq!(face.mobile_breakpoint, 768.0);
        assert_eq!(face.viewport_width, 390.0);
        assert_eq!(
            face.footer_height.as_deref(),
            Some("var(--s-footer-height)")
        );
        assert_eq!(face.nav_title.as_deref(), Some("Menu"));
        assert_eq!(face.drawer_panel_class.as_deref(), Some("flush"));
        assert_eq!(face.content_padding, "2rem");
        assert_eq!(face.content_key.as_deref(), Some("providers"));
        assert!(face.content_bleed_on_mobile);
        assert!(face.mobile_open);
    }

    #[test]
    fn admin_shell_reexports_the_padding_scan_helpers() {
        // The Vue module keeps these names as its public surface; the mirror's
        // re-export must behave identically.
        assert_eq!(split_padding_sides("1rem 2rem"), vec!["1rem", "2rem"]);
        assert!(scan_padding_sides("calc(1rem + 2px)").balanced);
        assert!(!scan_padding_sides("calc(1rem + 2px").balanced);
        assert_eq!(
            PaddingSidesScan {
                sides: vec!["1rem".to_string()],
                balanced: true,
            }
            .sides
            .len(),
            1
        );
        assert_eq!(CSS_WIDE_KEYWORDS.len(), 5);
    }

    #[test]
    fn admin_shell_reexported_bleed_rule_matches_the_face_shell() {
        assert_eq!(mobile_side_gutter_free("1.5rem 2rem"), "1.5rem 0 1.5rem");
        assert_eq!(mobile_side_gutter_free("inherit"), "inherit");
        assert_eq!(
            mobile_side_gutter_free("2rem !important"),
            "2rem !important"
        );
    }

    #[test]
    fn admin_shell_renders_the_document_shell() {
        let html = AdminShell(AdminShellProps {
            viewport_width: 1280.0,
            content: rsx! { p { "page" } },
            ..Default::default()
        })
        .render_to_html();
        for needle in [
            "class=\"s-admin-shell\"",
            "class=\"s-admin-shell-body\"",
            "class=\"s-admin-shell-main\"",
            "data-content-mode=\"document\"",
            "class=\"s-admin-shell-scroll\"",
            "padding:1.5rem",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
    }

    #[test]
    fn admin_shell_forwards_the_rail_host_and_the_mobile_drawer() {
        // Desktop rail: the three hk- hooks plus the state markers ride through
        // the wrapper untouched.
        let rail = AdminShell(AdminShellProps {
            viewport_width: 1280.0,
            sidebar_collapsible: true,
            sidebar_rail_style: FaceShellRailStyle::Rail,
            sidebar: Some(rsx! { nav { "links" } }),
            content: rsx! { p { "page" } },
            ..Default::default()
        })
        .render_to_html();
        assert!(rail.contains("hk-sidebar-rail-host"), "{rail}");
        assert!(rail.contains("hk-sidebar-rail-panel"), "{rail}");
        assert!(rail.contains("hk-sidebar-rail-clip"), "{rail}");
        // The rail HOST carries its own marker; assert on the aside so the
        // nested rail-swap generation cannot satisfy the check.
        assert!(rail.contains("<aside data-rail=\"true\""), "{rail}");

        // Mobile: the nav drawer, titled by the forwarded `nav_title`.
        let drawer = AdminShell(AdminShellProps {
            viewport_width: 640.0,
            mobile_open: true,
            nav_title: Some("Tools".to_string()),
            sidebar: Some(rsx! { nav { "links" } }),
            content: rsx! { p { "page" } },
            ..Default::default()
        })
        .render_to_html();
        assert!(drawer.contains("hk-drawer-panel"), "{drawer}");
        assert!(drawer.contains("Tools"), "{drawer}");
        assert!(!drawer.contains("<aside"), "{drawer}");
    }

    #[test]
    fn admin_shell_has_no_sheet_of_its_own() {
        assert_eq!(
            <AdminShellComponent as StyledComponent>::styles(),
            "",
            "the Vue wrapper ships no sheet; the mirror must invent none"
        );
        assert_eq!(
            <AdminShellComponent as StyledComponent>::name(),
            "admin-shell"
        );
    }
}
