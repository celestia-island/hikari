// hi-components/src/layout/face_shell.rs
// FaceShell — mirror of the canonical Vue `HkFaceShell` (the ONE frame every
// app face hangs its chrome on).
//
// NO HIKARI SHEET, on purpose. The Vue component ships no stylesheet either:
// it renders host utility classes (`s-admin-shell*`, `.s-status-bar` — defined
// in `packages/vue/src/styles/admin-tokens.scss`) plus exactly three `hk-`
// hooks whose geometry lives in `HkSidebarRail.scss`
// (`hk-sidebar-rail-host` / `-panel` / `-clip`). Those rules are the HOST's
// admin token sheet and the sidebar-rail chrome sheet, neither of which this
// file may register (a layout face owns no CSS in either form). So the mirror
// guarantees the DOM STRUCTURE and the `data-*` hooks only; `styles()` returns
// `""` and this file invents no CSS.
//
// DOM contract (mirrors the Vue render output one-to-one):
//
//   div.s-admin-shell
//     div [style="flex-shrink:0"]                     (header slot)
//     div.s-admin-shell-body [style="padding-bottom:{footer_pad}"]
//       ── isDesktop && !sidebarCollapsed && sidebar slot ──
//       aside.hk-sidebar-rail-host                    (sidebarCollapsible)
//             [data-rail] [data-peeking] [data-pinning]
//             (style: width:{layout width};flex-shrink:0)
//             pointerenter / pointerleave / pointermove / keydown
//         div.hk-sidebar-rail-panel
//               (style: width:{peek panel width};
//                       border-inline-end:1px solid var(--border-faint, …);
//                       background:rgb(var(--color-surface)))
//           div.hk-sidebar-rail-clip
//             div.hk-crossfade.hk-sidebar-rail-swap    (SidebarRailSwap)
//               div.hk-crossfade-item
//                 div.hk-sidebar-rail-generation [data-rail]
//                     (style: width:{pinned generation width})
//                   {the sidebar slot}                 (density = data-rail)
//           div.hk-sidebar-rail-toggle                 (SidebarRailToggle)
//                 [data-expanded] >
//             button.hk-icon-button.hk-icon-button-24.hk-icon-button-ghost
//                    aria-expanded aria-label
//       ── else, same gate without sidebarCollapsible ──
//       aside      (style: width:{sidebarWidth};flex-shrink:0;border-right:…;
//                         background:…;overflow:hidden)
//       main.s-admin-shell-main [data-content-mode="document"|"stage"]
//         ── document mode ──
//         div.s-admin-shell-scroll [style="overflow:auto"]
//           div [style="padding:{content padding}"]
//             {content stage}                         (Crossfade when keyed)
//         ── stage mode ──
//         {content stage}
//       ── !isDesktop ──
//       <Drawer side=left size=280px>                 (mirrored HkDrawer)
//     footer.s-status-bar
//           (style: position:fixed;bottom:0;left:0;right:0;
//                   z-index:var(--hk-z-toolbar))        (footer slot)
//     {overlays slot}
//
// The content stage is Vue's `renderContentStage()`: with a `contentKey` the
// page runs through the family crossfade (`HkCrossfade class="s-admin-shell-swap"`),
// without one the slot renders bare. Both content modes share it; what the
// mode selects is the HOST around it (scroll viewport + padding wrapper in
// document mode, nothing in stage mode).
//
// STATE CONTRACT (ledger L48). Vue keeps `sidebarOpen` (mobile drawer),
// `railCollapsedLocal` (semi-controlled rail channel) and the `useSidebarRail`
// machine (peek dwell 400ms / grace 150ms / toggle suppression / pinning) in
// refs, and reads the live viewport through `useBreakpoint()`. `use_signal`
// allocates a fresh signal per render and `use_state` shares one slot per
// component TYPE in tairitsu 0.5.22, so BOTH are unavailable: every one of
// those values is a CONTROLLED prop here —
//
//   sidebarOpen        → `mobile_open` + `on_mobile_open_change`
//   railCollapsedLocal → `rail_style` + `on_rail_style_change` (the upstream
//                        `v-model:sidebar-rail-style` channel; the mirrored
//                        rail toggle is the emitter)
//   rail.peeking       → `peeking`
//   rail.pinning       → `pinning`
//   viewportWidth      → `viewport_width` (host feeds it; see the delta)
//
// — and the frame stores nothing itself. The pointer/key events the rail
// machine consumes are surfaced as callbacks (`on_rail_pointer_enter` /
// `_leave` / `_move`, `on_rail_keydown`) so a host can implement the machine
// it needs without a fork.
//
// Deltas vs Vue (documented, not accidental):
//   * NO SIDEBAR-RAIL MACHINE. `useSidebarRail` (dwell/grace timers, pointer
//     suppression, Escape, width pinning) needs per-instance state plus
//     timers, which tairitsu 0.5.22 does not expose (L48). The rail GEOMETRY is
//     mirrored (`host` / `panel` / `clip` + the three `data-*` markers), the
//     machine is the host's: it drives `rail_style` / `peeking` / `pinning`
//     through the callbacks above.
//   * THE RAIL SWAP AND THE RAIL TOGGLE ARE COMPOSED, not re-implemented:
//     `layout/sidebar_rail_swap.rs` and `layout/sidebar_rail_toggle.rs` (the
//     sibling mirrors) render the width-pinned generations and the straddling
//     circular chevron INSIDE `.hk-sidebar-rail-clip` / `.hk-sidebar-rail-panel`,
//     exactly where Vue mounts them. Two consequences stay documented:
//       - the swap takes the generation as a plain `Element`, so the SCOPED
//         `{ rail }` parameter is gone: the host branches on its own
//         `rail_style` (the same value this component renders from);
//       - the toggle's click lands on `on_rail_style_change` with the NEXT
//         style (Vue: `rail.toggle`), so the host owns the flip; the peek
//         machine's dwell/grace timers and the pin window are still host-side.
//     Their geometry lives in the vendored `HkSidebarRail.scss`; this face
//     carries no sheet of its own, so that table reaches the bundle through the
//     registry path (`StyleRegistry::register_vue_chrome` → `vue-sidebar-rail`),
//     not through a component `styles()`.
//   * SCOPED SLOTS BECOME CONTROLLED STATE. Vue calls
//     `slots.sidebar({ collapsed, onNavigate, inDrawer, peeking })` and
//     `slots.userPanel({ onNavigate })`; a tairitsu slot is an `Element`, not a
//     render function, so the mirror takes plain `sidebar` / `user_panel`
//     elements and the host reads the density (`rail_active`, `peeking`,
//     `is_desktop`) from ITS OWN props. `onNavigate` (close the drawer / the
//     peek) is the same `on_mobile_open_change(false)` channel.
//   * LIVE VIEWPORT → `viewport_width`. There is no `useBreakpoint()` hook in
//     this wave: the host measures the window and passes the width. `0.0`
//     (the default) means "not measured yet" and reads as DESKTOP — the
//     server/static first paint keeps the desktop frame and never flashes the
//     mobile drawer; the pure [`face_shell_is_desktop`] carries the rule.
//   * `HScrollContainer` (the overlay-scrollbar viewport) is not mirrored; the
//     `s-admin-shell-scroll` host class only carries the flex sizing, so the
//     mirror adds the plain `overflow:auto` the scroller used to supply (the
//     same adaptation `card.rs` documents for its scroll body). The sheet's
//     hover chrome is not painted.
//   * `contentKey` accepts `string | number` in Vue; the prop is a `String`
//     and the host formats a number itself (the value is only an identity).
//   * The `provideMenuGroupState()` provide (a sidebar `HkMenu`'s group fold
//     surviving the rail swap) is retired with the swap: see L48 — a
//     provide/inject channel is a render-scoped hook in this release.
//   * No teleport for the mobile drawer (same delta as the `HkDrawer` mirror):
//     the panel is `position: fixed` in its sheet, so it works in place.
//   * `transitions` (`onTransitionend` → `rail.endPinning()`) has no portable
//     handler in this wave's event set; a host that pins the panel ends the
//     window itself (`pinning: false`).
//
// The four padding-scan helpers Vue exports from this module
// (`scanPaddingSides`, `splitPaddingSides`, `mobileSideGutterFree`, and the
// `PaddingSidesScan` shape) are mirrored below as [`scan_padding_sides`],
// [`split_padding_sides`], [`mobile_side_gutter_free`] and
// [`PaddingSidesScan`], rules and fallbacks verbatim — they are pure and
// unit-tested. `HkAdminShell` re-exports them, exactly like the Vue module
// does.

use hikari_i18n::t;
use tairitsu_vdom::PointerEvent;

use crate::display::{Crossfade, CrossfadeProps};
use crate::feedback::{Drawer, DrawerProps, DrawerSide};
use crate::layout::sidebar_rail_swap::{SidebarRailSwap, SidebarRailSwapProps};
use crate::layout::sidebar_rail_toggle::{SidebarRailToggle, SidebarRailToggleProps};
use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct FaceShellComponent;

/// Render a boolean STATE marker as a PRESENCE attribute: Vue writes
/// `data-rail={x || undefined}`, so a false flag must be ABSENT rather than
/// `data-rail="false"` (every `[data-rail]` selector in the rail sheet would
/// still match the latter). A data attribute has no boolean form, so the mark
/// serializes as Vue's truthy value `"true"` (the same rule the sibling rail
/// mirrors use).
fn presence(flag: bool) -> Option<&'static str> {
    if flag { Some("true") } else { None }
}

/// CSS-wide keywords. A shorthand rebuilt from one of them is NOT a padding
/// (`inherit 0 inherit` is rejected by every engine), so the declaration
/// would be dropped WHOLE and the page would lose the vertical clearance too
/// — worse than not bleeding. (Vue: `CSS_WIDE_KEYWORDS`.)
pub const CSS_WIDE_KEYWORDS: [&str; 5] = ["inherit", "initial", "unset", "revert", "revert-layer"];

/// A scanned padding shorthand: the top-level `sides` plus whether the value
/// ENDED with every function closed and every quote terminated.
/// `balanced: false` means the scan cannot know where the value ends — CSS
/// closes an open function at EOF, so the authored declaration can still be
/// valid while a rewrite of it cannot be. (Vue: `PaddingSidesScan`.)
#[derive(Clone, PartialEq, Debug, Default)]
pub struct PaddingSidesScan {
    pub sides: Vec<String>,
    pub balanced: bool,
}

/// Scan a CSS padding shorthand into its top-level tracks: split on
/// TOP-LEVEL whitespace, quote- and function-aware, so whitespace inside a
/// function belongs to that value — `calc(1rem + 2px)`, `var(--pad, 1rem)`
/// and a quoted argument are ONE track. A plain whitespace split shreds them
/// (`["calc(1rem", "+", "2px)"]`) and the rebuilt shorthand is invalid CSS —
/// a browser drops the whole declaration, taking with it the vertical
/// clearance `content_bleed_on_mobile` promises to keep. The depth counter
/// balances parentheses, so nested functions survive; a stray `)` never
/// drives the depth negative. Tabs and newlines are valid CSS separators and
/// split like spaces, and the whitespace around a shorthand yields no empty
/// tracks. (Vue: `scanPaddingSides`.)
pub fn scan_padding_sides(value: &str) -> PaddingSidesScan {
    let mut sides: Vec<String> = Vec::new();
    let mut current = String::new();
    let mut depth: i32 = 0;
    let mut quote: Option<char> = None;
    for ch in value.chars() {
        if let Some(open) = quote {
            current.push(ch);
            if ch == open {
                quote = None;
            }
            continue;
        }
        if ch == '"' || ch == '\'' {
            quote = Some(ch);
            current.push(ch);
            continue;
        }
        if ch == '(' {
            depth += 1;
        } else if ch == ')' {
            depth = (depth - 1).max(0);
        }
        if depth == 0 && ch.is_whitespace() {
            if !current.is_empty() {
                sides.push(std::mem::take(&mut current));
            }
            continue;
        }
        current.push(ch);
    }
    if !current.is_empty() {
        sides.push(current);
    }
    PaddingSidesScan {
        sides,
        balanced: depth == 0 && quote.is_none(),
    }
}

/// The tracks of [`scan_padding_sides`] — for callers that only need the
/// split. (Vue: `splitPaddingSides`.)
pub fn split_padding_sides(value: &str) -> Vec<String> {
    scan_padding_sides(value).sides
}

/// Whether a shorthand ends with a `!important` ANNOTATION (Vue:
/// `/!\s*important\s*$/i`). The annotation belongs to the DECLARATION, not to
/// a track, so a per-side rewrite of such a value is never safe.
fn ends_with_important_annotation(value: &str) -> bool {
    let trimmed = value.trim_end();
    if trimmed.len() < "important".len() {
        return false;
    }
    let suffix = &trimmed[trimmed.len() - "important".len()..];
    if !suffix.eq_ignore_ascii_case("important") {
        return false;
    }
    trimmed[..trimmed.len() - "important".len()]
        .trim_end()
        .ends_with('!')
}

/// The side-gutter-free form of a padding shorthand: the vertical tracks
/// survive, the horizontal ones become zero (`"1rem 2rem"` → `"1rem 0 1rem"`).
/// The value is returned VERBATIM — the page keeps its padding and simply does
/// not bleed — whenever the shorthand cannot be rewritten safely; that
/// fallback IS the contract, because emitting a declaration a browser drops
/// costs the page ALL FOUR sides, including the vertical clearance this prop
/// exists to keep. (Vue: `mobileSideGutterFree`.)
///
/// Verbatim cases, in Vue's order: an empty/whitespace-only value; a value
/// carrying a CSS comment (its text would land in the rebuilt declaration as a
/// garbage track); a value carrying a backslash (this scanner does not decode
/// CSS escapes, and an escape can hide a quote, a parenthesis or a whole
/// keyword — `\69 nherit` IS `inherit` to an engine); a value ending with a
/// `!important` annotation; a scan that ended inside an open function or an
/// unterminated quote; a LONE CSS-wide keyword (it cannot be combined per
/// side).
///
/// Known residual (documented, not fixable at string level): a `var()` whose
/// custom property resolves to MORE than one track cannot keep its vertical
/// half — `padding: var(--multi) 0 var(--multi)` is valid at parse time and
/// invalid at computed-value time, and all four sides collapse.
pub fn mobile_side_gutter_free(value: &str) -> String {
    if value.contains("/*") || value.contains('\\') {
        return value.to_string();
    }
    if ends_with_important_annotation(value) {
        return value.to_string();
    }
    let scan = scan_padding_sides(value);
    if !scan.balanced || scan.sides.is_empty() {
        return value.to_string();
    }
    if scan.sides.len() == 1
        && CSS_WIDE_KEYWORDS
            .iter()
            .any(|keyword| keyword.eq_ignore_ascii_case(&scan.sides[0]))
    {
        return value.to_string();
    }
    let top = &scan.sides[0];
    let bottom = scan.sides.get(2).unwrap_or(top);
    format!("{top} 0 {bottom}")
}

/// The rail state channel (Vue: `"expanded" | "rail"`, default `expanded`).
/// Session-only by design: the library never persists it, a host that wants
/// persistence binds the channel and stores the value itself.
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum FaceShellRailStyle {
    #[default]
    Expanded,
    Rail,
}

impl FaceShellRailStyle {
    /// The wire name of the `v-model:sidebar-rail-style` channel.
    pub fn as_str(self) -> &'static str {
        match self {
            FaceShellRailStyle::Expanded => "expanded",
            FaceShellRailStyle::Rail => "rail",
        }
    }

    /// Parse the wire name; anything unrecognised is the `expanded` default
    /// (Vue's prop validator never rejects a value). Named `from_token` (not
    /// `from_str`) for the crate's wire-token convention — it is not a
    /// `std::str::FromStr` implementation.
    pub fn from_token(value: &str) -> Self {
        match value {
            "rail" => FaceShellRailStyle::Rail,
            _ => FaceShellRailStyle::Expanded,
        }
    }

    /// The state a rail toggle asks for.
    pub fn toggled(self) -> Self {
        match self {
            FaceShellRailStyle::Expanded => FaceShellRailStyle::Rail,
            FaceShellRailStyle::Rail => FaceShellRailStyle::Expanded,
        }
    }
}

/// Content host mode (Vue: `"document" | "stage"`, default `document`).
/// `document` wraps the content in the scroll viewport + padding wrapper;
/// `stage` renders it bare — the face owns scrolling, canvases and floating
/// layers.
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum FaceShellContentMode {
    #[default]
    Document,
    Stage,
}

impl FaceShellContentMode {
    /// The `data-content-mode` value exactly as Vue emits it.
    pub fn as_str(self) -> &'static str {
        match self {
            FaceShellContentMode::Document => "document",
            FaceShellContentMode::Stage => "stage",
        }
    }
}

/// Desktop layout gate: Vue's `isDesktop = viewportWidth >= mobileBreakpoint`.
/// A width of `0.0` (or less) means "not measured yet" and reads as DESKTOP —
/// the first paint keeps the desktop frame and never flashes the mobile
/// drawer before the host has measured the window.
pub fn face_shell_is_desktop(viewport_width: f64, mobile_breakpoint: f64) -> bool {
    if viewport_width <= 0.0 {
        return true;
    }
    viewport_width >= mobile_breakpoint
}

/// Vue's `contentStyle` computed: the padding is applied verbatim at every
/// width unless the page opted into `contentBleedOnMobile` AND the viewport is
/// below the breakpoint, where the horizontal half is dropped.
pub fn face_shell_content_padding(
    content_padding: &str,
    bleed_on_mobile: bool,
    is_desktop: bool,
) -> String {
    if is_desktop || !bleed_on_mobile {
        content_padding.to_string()
    } else {
        mobile_side_gutter_free(content_padding)
    }
}

/// Vue's `footerPad()`: the status-bar band exists only when the shell renders
/// one (the footer slot) or the host pins its own bar and says so via the prop
/// — an unreserved shell carries no dead clearance. An explicit
/// `footer_height` always wins (`""` is the caller's "nothing" answer).
pub fn face_shell_footer_padding(footer_height: Option<&str>, has_footer: bool) -> String {
    match footer_height {
        Some(height) => height.to_string(),
        None => {
            if has_footer {
                "var(--s-footer-height)".to_string()
            } else {
                "0px".to_string()
            }
        }
    }
}

/// Vue's `railActive` computed: the icon-rail capability is only live when the
/// host opted in AND the channel says `rail`. Below the breakpoint nothing
/// changes — the mobile drawer stays the only nav surface.
pub fn face_shell_rail_active(sidebar_collapsible: bool, rail_style: FaceShellRailStyle) -> bool {
    sidebar_collapsible && rail_style == FaceShellRailStyle::Rail
}

/// Vue's `hostSidebarWidth` computed — the LAYOUT width, the core contract of
/// the peek: rail width while collapsed OR peeking (the peek overlays; it never
/// reflows content), full width while expanded.
pub fn face_shell_sidebar_layout_width(
    rail_active: bool,
    collapsed_width: &str,
    expanded_width: &str,
) -> String {
    if rail_active {
        collapsed_width.to_string()
    } else {
        expanded_width.to_string()
    }
}

/// Vue's `peekPanelWidth` computed — the PANEL width: full while expanded or
/// peeking (the slide-out lever), rail width otherwise.
pub fn face_shell_peek_panel_width(
    rail_active: bool,
    peeking: bool,
    collapsed_width: &str,
    expanded_width: &str,
) -> String {
    if rail_active && !peeking {
        collapsed_width.to_string()
    } else {
        expanded_width.to_string()
    }
}

/// Vue's sidebar gate: `isDesktop && !sidebarCollapsed && slots.sidebar`.
pub fn face_shell_sidebar_mounted(
    is_desktop: bool,
    sidebar_collapsed: bool,
    has_sidebar: bool,
) -> bool {
    is_desktop && !sidebar_collapsed && has_sidebar
}

#[define_props]
pub struct FaceShellProps {
    /// Hide the desktop sidebar entirely (Vue: `sidebarCollapsed`).
    #[default]
    pub sidebar_collapsed: bool,

    /// Full sidebar width (Vue default `"224px"`).
    #[default("224px".to_string())]
    pub sidebar_width: String,

    /// Opt into the desktop icon-rail capability.
    #[default]
    pub sidebar_collapsible: bool,

    /// Layout width of the icon rail (Vue default `"56px"`).
    #[default("56px".to_string())]
    pub sidebar_collapsed_width: String,

    /// CONTROLLED rail state (Vue: semi-controlled
    /// `v-model:sidebar-rail-style`; delta 1 in the header — the machine that
    /// flips it is the host's).
    #[default]
    pub rail_style: FaceShellRailStyle,

    /// Fires with the style the rail toggle asks for (Vue:
    /// `update:sidebarRailStyle`, emitted by `rail.toggle`). The host owns the
    /// state; the library never persists it.
    pub on_rail_style_change: Option<EventHandler<FaceShellRailStyle>>,

    /// CONTROLLED peek state (`data-peeking`): the slide-out drawer is open
    /// over the content while the LAYOUT keeps the rail width.
    #[default]
    pub peeking: bool,

    /// CONTROLLED pin window (`data-pinning`): a rail → expanded flip snaps the
    /// panel to its final width while only the host width animates.
    #[default]
    pub pinning: bool,

    /// Viewport width at which the desktop layout takes over (Vue default
    /// 1024, the shared `lg` breakpoint).
    #[default(1024.0)]
    pub mobile_breakpoint: f64,

    /// Live viewport width, fed by the host (`0.0` = not measured yet → the
    /// desktop frame; see [`face_shell_is_desktop`]).
    #[default(0.0)]
    pub viewport_width: f64,

    /// Height reserved under the scroll body for a fixed status-bar band.
    /// INJECTION-DRIVEN: `None` tracks whether the shell renders a footer,
    /// `Some("…")` lets a host that pins its OWN fixed bar opt back in (e.g.
    /// `"var(--s-footer-height)"`).
    pub footer_height: Option<String>,

    /// Mobile nav drawer title; `None` falls back to the i18n default.
    pub nav_title: Option<String>,

    /// Extra class for the mobile nav drawer's panel.
    pub drawer_panel_class: Option<String>,

    /// Content host mode (document || stage).
    #[default]
    pub content_mode: FaceShellContentMode,

    /// Content-area padding, applied INSIDE the scroll viewport (Vue default
    /// `"1.5rem"`). Document mode only.
    #[default("1.5rem".to_string())]
    pub content_padding: String,

    /// Identity of the content page on stage: `Some(key)` swaps pages through
    /// the family crossfade, `None` renders the slot bare.
    pub content_key: Option<String>,

    /// Whether the content on screen is a CANVAS that must span the full phone
    /// width (opt-in, per page — never a shell-wide rule).
    #[default]
    pub content_bleed_on_mobile: bool,

    /// CONTROLLED mobile drawer state (Vue: `sidebarOpen`).
    #[default]
    pub mobile_open: bool,

    /// Header region (Vue: the scoped `header` slot — see the header delta for
    /// the params it loses).
    pub header: Option<Element>,

    /// Nav content: the desktop sidebar and the mobile drawer body.
    pub sidebar: Option<Element>,

    /// Drawer footer content (Vue: `userPanel`, identity + account actions).
    pub user_panel: Option<Element>,

    /// The content slot.
    pub content: Element,

    /// Fixed status-bar band (Vue: `footer`, the shell's own `.s-status-bar`).
    pub footer: Option<Element>,

    /// Floating layers rendered last, inside the shell root.
    pub overlays: Option<Element>,

    /// Fires with the desired mobile drawer state (Vue: the drawer's
    /// `update:modelValue`, plus the `onNavigate` / `onOpenDrawer` channels the
    /// scoped slots used to carry).
    pub on_mobile_open_change: Option<EventHandler<bool>>,

    /// Pointer entered the rail host (Vue: `onPointerenter` → `useSidebarRail`).
    pub on_rail_pointer_enter: Option<EventHandler<PointerEvent>>,

    /// Pointer left the rail host (Vue: `onPointerleave` → grace timer).
    pub on_rail_pointer_leave: Option<EventHandler<PointerEvent>>,

    /// Pointer moved over the rail host (Vue: toggle-containment test).
    pub on_rail_pointer_move: Option<EventHandler<PointerEvent>>,

    /// Key pressed on the rail host (Vue: Escape closes the peek).
    pub on_rail_keydown: Option<EventHandler<KeyboardEvent>>,
}

#[component]
pub fn FaceShell(props: FaceShellProps) -> Element {
    let is_desktop = face_shell_is_desktop(props.viewport_width, props.mobile_breakpoint);
    let rail_active = face_shell_rail_active(props.sidebar_collapsible, props.rail_style);
    let sidebar_mounted =
        face_shell_sidebar_mounted(is_desktop, props.sidebar_collapsed, props.sidebar.is_some());
    let footer_pad =
        face_shell_footer_padding(props.footer_height.as_deref(), props.footer.is_some());
    let content_padding = face_shell_content_padding(
        &props.content_padding,
        props.content_bleed_on_mobile,
        is_desktop,
    );
    let layout_width = face_shell_sidebar_layout_width(
        rail_active,
        &props.sidebar_collapsed_width,
        &props.sidebar_width,
    );
    let panel_width = face_shell_peek_panel_width(
        rail_active,
        props.peeking,
        &props.sidebar_collapsed_width,
        &props.sidebar_width,
    );
    let document_mode = props.content_mode == FaceShellContentMode::Document;

    // Vue: `rail.toggle` — the toggle asks for the OTHER style; the host owns
    // the channel.
    let rail_style_for_toggle = props.rail_style;
    let rail_style_change = props.on_rail_style_change.clone();
    let rail_toggle = rail_style_change.map(|handler| {
        EventHandler::new(move |_event: ()| {
            handler.call(rail_style_for_toggle.toggled());
        })
    });

    // Vue's `renderContentStage()`: keyed → the family crossfade, bare
    // otherwise; identical in both content modes.
    let stage: Element = match &props.content_key {
        Some(key) => Crossfade(CrossfadeProps {
            swap_key: key.clone(),
            class: "s-admin-shell-swap".to_string(),
            children: props.content.clone(),
            ..Default::default()
        }),
        None => props.content.clone(),
    };

    // The mobile nav drawer: side left, 280px, the nav title, the drawer panel
    // class and the `userPanel` footer (identity + account actions).
    let drawer_title = props
        .nav_title
        .clone()
        .unwrap_or_else(|| t("components.hk.faceShell.navTitle", "Navigation"));
    let close_channel = props.on_mobile_open_change.clone();
    let drawer_on_close = close_channel.map(|handler| {
        EventHandler::new(move |_event: MouseEvent| {
            handler.call(false);
        })
    });

    let rail_enter = props.on_rail_pointer_enter.clone();
    let rail_leave = props.on_rail_pointer_leave.clone();
    let rail_move = props.on_rail_pointer_move.clone();
    let rail_keydown = props.on_rail_keydown.clone();

    rsx! {
        div { class: "s-admin-shell",
            if let Some(header) = &props.header {
                div { style: "flex-shrink:0", {header.clone()} }
            }
            div {
                class: "s-admin-shell-body",
                style: format!("padding-bottom:{footer_pad}"),
                if sidebar_mounted {
                    if props.sidebar_collapsible {
                        aside {
                            class: "hk-sidebar-rail-host",
                            "data-rail": presence(rail_active),
                            "data-peeking": presence(props.peeking),
                            "data-pinning": presence(props.pinning),
                            style: format!("width:{layout_width};flex-shrink:0"),
                            onpointerenter: move |event: PointerEvent| {
                                if let Some(handler) = rail_enter.as_ref() {
                                    handler.call(event);
                                }
                            },
                            onpointerleave: move |event: PointerEvent| {
                                if let Some(handler) = rail_leave.as_ref() {
                                    handler.call(event);
                                }
                            },
                            onpointermove: move |event: PointerEvent| {
                                if let Some(handler) = rail_move.as_ref() {
                                    handler.call(event);
                                }
                            },
                            onkeydown: move |event: KeyboardEvent| {
                                if let Some(handler) = rail_keydown.as_ref() {
                                    handler.call(event);
                                }
                            },
                            div {
                                class: "hk-sidebar-rail-panel",
                                style: format!(
                                    "width:{panel_width};border-inline-end:1px solid var(--border-faint, rgb(var(--color-border) / 10%));background:rgb(var(--color-surface))"
                                ),
                                div {
                                    class: "hk-sidebar-rail-clip",
                                    // Vue: `rail={railActive && !peeking}` — a peek
                                    // shows the FULL density while the layout keeps the
                                    // rail width.
                                    {SidebarRailSwap(SidebarRailSwapProps {
                                        rail: rail_active && !props.peeking,
                                        rail_width: props.sidebar_collapsed_width.clone(),
                                        expanded_width: props.sidebar_width.clone(),
                                        children: props.sidebar.clone().unwrap_or_else(empty_vnode),
                                        ..Default::default()
                                    })}
                                }
                                // Vue: `expanded={!railActive}`, a DIRECT child of the
                                // panel (it must never be clipped).
                                {SidebarRailToggle(SidebarRailToggleProps {
                                    expanded: !rail_active,
                                    on_toggle: rail_toggle.clone(),
                                    ..Default::default()
                                })}
                            }
                        }
                    } else {
                        aside {
                            style: format!(
                                "width:{};flex-shrink:0;border-right:1px solid var(--border-faint, rgb(var(--color-border) / 10%));background:rgb(var(--color-surface));overflow:hidden",
                                props.sidebar_width
                            ),
                            {props.sidebar.clone().unwrap_or_else(empty_vnode)}
                        }
                    }
                }
                main {
                    class: "s-admin-shell-main",
                    "data-content-mode": props.content_mode.as_str(),
                    if document_mode {
                        // Padding lives INSIDE the scroll viewport (an inner
                        // wrapper) so card box-shadows are not clipped at the
                        // viewport edges.
                        div {
                            class: "s-admin-shell-scroll",
                            style: "overflow:auto",
                            div { style: format!("padding:{content_padding}"),
                                {stage.clone()}
                            }
                        }
                    } else {
                        {stage.clone()}
                    }
                }
                if !is_desktop {
                    {Drawer(DrawerProps {
                        open: props.mobile_open,
                        side: DrawerSide::Left,
                        title: Some(drawer_title),
                        size: "280px".to_string(),
                        panel_class: props.drawer_panel_class.clone().unwrap_or_default(),
                        footer: props.user_panel.clone(),
                        children: props.sidebar.clone().unwrap_or_else(empty_vnode),
                        on_close: drawer_on_close,
                        ..Default::default()
                    })}
                }
            }
            if let Some(footer) = &props.footer {
                footer {
                    class: "s-status-bar",
                    style: "position:fixed;bottom:0;left:0;right:0;z-index:var(--hk-z-toolbar)",
                    {footer.clone()}
                }
            }
            if let Some(overlays) = &props.overlays {
                {overlays.clone()}
            }
        }
    }
}

impl StyledComponent for FaceShellComponent {
    fn styles() -> &'static str {
        // The Vue face has no sheet of its own: layout comes from the host's
        // admin token classes (`s-admin-shell*`), and the rail geometry from
        // `HkSidebarRail.scss`, which reaches the bundle through the registry
        // path (`StyleRegistry::register_vue_chrome`, the `vue-sidebar-rail`
        // row) rather than through a component table. See the file header.
        ""
    }

    fn name() -> &'static str {
        "face-shell"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn padding_scan_splits_top_level_tracks_like_vue() {
        assert_eq!(split_padding_sides("1rem 2rem"), vec!["1rem", "2rem"]);
        // Whitespace around the shorthand yields no empty tracks.
        assert_eq!(split_padding_sides("  1rem   2rem  "), vec!["1rem", "2rem"]);
        // Tabs and newlines are separators too.
        assert_eq!(
            split_padding_sides("1rem\t2rem\n3rem"),
            vec!["1rem", "2rem", "3rem"]
        );
        // Whitespace inside a function belongs to that track.
        assert_eq!(
            split_padding_sides("calc(1rem + 2px) var(--pad, 1rem)"),
            vec!["calc(1rem + 2px)", "var(--pad, 1rem)"]
        );
        // Nested functions survive; a quoted argument holds whitespace.
        assert_eq!(
            split_padding_sides("clamp(1rem, min(2vw, 3px), 3px) 'a b'"),
            vec!["clamp(1rem, min(2vw, 3px), 3px)", "'a b'"]
        );
        // A stray `)` never drives the depth negative.
        assert_eq!(split_padding_sides(") 2rem"), vec![")", "2rem"]);
    }

    #[test]
    fn padding_scan_flags_unbalanced_values() {
        assert!(scan_padding_sides("1rem 2rem").balanced);
        assert!(scan_padding_sides("calc(1rem + 2px)").balanced);
        assert!(!scan_padding_sides("calc(1rem + 2px").balanced);
        assert!(!scan_padding_sides("'1rem").balanced);
    }

    #[test]
    fn mobile_gutter_free_rewrites_only_the_horizontal_tracks() {
        assert_eq!(mobile_side_gutter_free("1rem 2rem"), "1rem 0 1rem");
        assert_eq!(mobile_side_gutter_free("1rem"), "1rem 0 1rem");
        assert_eq!(mobile_side_gutter_free("1rem 2rem 3rem"), "1rem 0 3rem");
        // Four tracks: the top track plus the bottom (3rd) one survive.
        assert_eq!(
            mobile_side_gutter_free("1rem 2rem 3rem 4rem"),
            "1rem 0 3rem"
        );
        assert_eq!(
            mobile_side_gutter_free("calc(1rem + 2px) 2rem"),
            "calc(1rem + 2px) 0 calc(1rem + 2px)"
        );
    }

    #[test]
    fn mobile_gutter_free_bails_out_to_the_authored_value() {
        // Nothing to strip.
        assert_eq!(mobile_side_gutter_free(""), "");
        assert_eq!(mobile_side_gutter_free("   "), "   ");
        // A lone CSS-wide keyword cannot ride a per-side rewrite.
        assert_eq!(mobile_side_gutter_free("inherit"), "inherit");
        assert_eq!(mobile_side_gutter_free("REVERT"), "REVERT");
        // A comment / an escape can hide a track: the literal is not the value.
        assert_eq!(
            mobile_side_gutter_free("1rem /* x */ 2rem"),
            "1rem /* x */ 2rem"
        );
        assert_eq!(
            mobile_side_gutter_free("1rem \\69 nherit"),
            "1rem \\69 nherit"
        );
        // `!important` annotates the DECLARATION, not a track.
        assert_eq!(
            mobile_side_gutter_free("2rem !important"),
            "2rem !important"
        );
        assert_eq!(mobile_side_gutter_free("2rem!important"), "2rem!important");
        // An unfinishable scan has no knowable end.
        assert_eq!(
            mobile_side_gutter_free("calc(1rem + 2px"),
            "calc(1rem + 2px"
        );
    }

    #[test]
    fn face_shell_breakpoint_picks_the_desktop_frame() {
        assert!(face_shell_is_desktop(1024.0, 1024.0));
        assert!(face_shell_is_desktop(1440.0, 1024.0));
        assert!(!face_shell_is_desktop(1023.0, 1024.0));
        assert!(face_shell_is_desktop(768.0, 768.0));
        assert!(!face_shell_is_desktop(767.0, 768.0));
        // Unmeasured (`0.0`) reads as desktop so the first paint keeps the
        // desktop frame.
        assert!(face_shell_is_desktop(0.0, 1024.0));
    }

    #[test]
    fn face_shell_content_padding_bleeds_only_on_mobile() {
        assert_eq!(
            face_shell_content_padding("1.5rem", true, true),
            "1.5rem",
            "desktop is never affected"
        );
        assert_eq!(
            face_shell_content_padding("1.5rem", false, false),
            "1.5rem",
            "bleed is opt-in"
        );
        assert_eq!(
            face_shell_content_padding("1.5rem", true, false),
            "1.5rem 0 1.5rem",
            "below the breakpoint the horizontal half is dropped"
        );
        assert_eq!(
            face_shell_content_padding("inherit", true, false),
            "inherit",
            "an unrewritable padding keeps its gutters"
        );
    }

    #[test]
    fn face_shell_footer_padding_tracks_the_rendered_band() {
        assert_eq!(
            face_shell_footer_padding(None, true),
            "var(--s-footer-height)"
        );
        assert_eq!(face_shell_footer_padding(None, false), "0px");
        assert_eq!(
            face_shell_footer_padding(Some("3.5rem"), false),
            "3.5rem",
            "an explicit height reaches the reservation even without a footer"
        );
    }

    #[test]
    fn face_shell_rail_widths_follow_the_peek_contract() {
        assert_eq!(
            face_shell_sidebar_layout_width(true, "56px", "224px"),
            "56px",
            "the layout keeps the rail width while the peek overlays"
        );
        assert_eq!(
            face_shell_sidebar_layout_width(false, "56px", "224px"),
            "224px"
        );
        assert_eq!(
            face_shell_peek_panel_width(true, false, "56px", "224px"),
            "56px",
            "a parked rail panel is rail width"
        );
        assert_eq!(
            face_shell_peek_panel_width(true, true, "56px", "224px"),
            "224px",
            "peeking slides the full panel out"
        );
        assert_eq!(
            face_shell_peek_panel_width(false, false, "56px", "224px"),
            "224px"
        );
    }

    #[test]
    fn face_shell_rail_state_channel_round_trips() {
        assert!(!face_shell_rail_active(false, FaceShellRailStyle::Rail));
        assert!(face_shell_rail_active(true, FaceShellRailStyle::Rail));
        assert!(!face_shell_rail_active(true, FaceShellRailStyle::Expanded));
        assert_eq!(FaceShellRailStyle::default(), FaceShellRailStyle::Expanded);
        assert_eq!(FaceShellRailStyle::from_token("rail").as_str(), "rail");
        assert_eq!(
            FaceShellRailStyle::from_token("nonsense").as_str(),
            "expanded"
        );
        assert_eq!(FaceShellRailStyle::Expanded.toggled().as_str(), "rail");
    }

    #[test]
    fn face_shell_sidebar_mount_gate_matches_vue() {
        assert!(face_shell_sidebar_mounted(true, false, true));
        assert!(
            !face_shell_sidebar_mounted(false, false, true),
            "mobile drawer era"
        );
        assert!(
            !face_shell_sidebar_mounted(true, true, true),
            "collapsed hides it"
        );
        assert!(!face_shell_sidebar_mounted(true, false, false), "no slot");
    }

    #[test]
    fn face_shell_defaults_match_the_vue_props() {
        let props = FaceShellProps::default();
        assert!(!props.sidebar_collapsed);
        assert_eq!(props.sidebar_width, "224px");
        assert!(!props.sidebar_collapsible);
        assert_eq!(props.sidebar_collapsed_width, "56px");
        assert_eq!(props.rail_style, FaceShellRailStyle::Expanded);
        assert!(props.on_rail_style_change.is_none());
        assert!(!props.peeking);
        assert!(!props.pinning);
        assert_eq!(props.mobile_breakpoint, 1024.0);
        assert_eq!(props.viewport_width, 0.0);
        assert!(props.footer_height.is_none());
        assert!(props.nav_title.is_none());
        assert!(props.drawer_panel_class.is_none());
        assert_eq!(props.content_mode, FaceShellContentMode::Document);
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
    fn face_shell_renders_the_document_shell() {
        let html = FaceShell(FaceShellProps {
            viewport_width: 1280.0,
            content: rsx! { p { "page" } },
            ..Default::default()
        })
        .render_to_html();
        for needle in [
            "class=\"s-admin-shell\"",
            "class=\"s-admin-shell-body\"",
            "padding-bottom:0px",
            "class=\"s-admin-shell-main\"",
            "data-content-mode=\"document\"",
            "class=\"s-admin-shell-scroll\"",
            "padding:1.5rem",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        // No sidebar slot + no footer slot: neither surface is mounted, and the
        // rail state markers (which only ride the rail aside) stay ABSENT.
        assert!(!html.contains("<aside"), "{html}");
        assert!(!html.contains("s-status-bar"), "{html}");
        assert!(!html.contains("hk-drawer-panel"), "{html}");
        assert_list_absent(&html, &["data-rail", "data-peeking", "data-pinning"]);
    }

    #[test]
    fn face_shell_stage_mode_skips_the_scroll_viewport() {
        let html = FaceShell(FaceShellProps {
            viewport_width: 1280.0,
            content_mode: FaceShellContentMode::Stage,
            content: rsx! { p { "stage" } },
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains("data-content-mode=\"stage\""), "{html}");
        assert!(!html.contains("s-admin-shell-scroll"), "{html}");
        assert!(!html.contains("padding:1.5rem"), "{html}");
    }

    #[test]
    fn face_shell_rail_host_carries_the_state_markers() {
        // Rail density with the peek open: the host keeps the rail footprint,
        // the panel slid to full width and the swap handed over the FULL
        // generation.
        let html = FaceShell(FaceShellProps {
            viewport_width: 1280.0,
            sidebar_collapsible: true,
            rail_style: FaceShellRailStyle::Rail,
            peeking: true,
            sidebar: Some(rsx! { nav { "links" } }),
            content: rsx! { p { "page" } },
            ..Default::default()
        })
        .render_to_html();
        for needle in [
            "class=\"hk-sidebar-rail-host\"",
            "data-rail=\"true\"",
            "data-peeking=\"true\"",
            "hk-sidebar-rail-panel",
            "hk-sidebar-rail-clip",
            "hk-sidebar-rail-swap",
            "hk-sidebar-rail-generation",
            "hk-sidebar-rail-toggle",
            "width:56px;flex-shrink:0",
            "width:224px;border-inline-end:1px solid var(--border-faint",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        // The pin window is closed here, so its marker must be absent.
        assert!(!html.contains("data-pinning"), "{html}");
    }

    #[test]
    fn face_shell_rail_swap_pins_the_generation_and_the_toggle_flips() {
        // Parked rail: the swap pins the RAIL generation at the collapsed width.
        // Vue's toggle reports the SIDEBAR state (`expanded={!railActive}`), so a
        // parked rail renders `aria-expanded="false"` — clicking expands it.
        let html = FaceShell(FaceShellProps {
            viewport_width: 1280.0,
            sidebar_collapsible: true,
            rail_style: FaceShellRailStyle::Rail,
            sidebar: Some(rsx! { nav { "links" } }),
            content: rsx! { p { "page" } },
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains("hk-sidebar-rail-generation"), "{html}");
        assert!(html.contains("data-rail=\"true\""), "{html}");
        assert!(html.contains("width:56px"), "{html}");
        assert!(html.contains("aria-expanded=\"false\""), "{html}");
        // No peek: nothing records one.
        assert!(!html.contains("data-peeking"), "{html}");

        // Expanded sidebar: no rail density marker anywhere in the rail family.
        let html = FaceShell(FaceShellProps {
            viewport_width: 1280.0,
            sidebar_collapsible: true,
            rail_style: FaceShellRailStyle::Expanded,
            sidebar: Some(rsx! { nav { "links" } }),
            content: rsx! { p { "page" } },
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains("hk-sidebar-rail-swap"), "{html}");
        assert!(html.contains("width:224px"), "{html}");
        // Expanded: the toggle now reports the open state.
        assert!(html.contains("aria-expanded=\"true\""), "{html}");
        assert!(!html.contains("data-rail"), "{html}");
    }

    #[test]
    fn face_shell_mobile_renders_the_nav_drawer() {
        let html = FaceShell(FaceShellProps {
            viewport_width: 640.0,
            mobile_open: true,
            sidebar: Some(rsx! { nav { "links" } }),
            content: rsx! { p { "page" } },
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains("hk-drawer-panel"), "{html}");
        assert!(html.contains("hk-drawer-left"), "{html}");
        assert!(html.contains("Navigation"), "{html}");
        assert!(html.contains("width:280px"), "{html}");
        // Below the breakpoint the desktop sidebar is gone.
        assert!(!html.contains("<aside"), "{html}");
    }

    #[test]
    fn face_shell_has_no_sheet_of_its_own() {
        assert_eq!(
            <FaceShellComponent as StyledComponent>::styles(),
            "",
            "the Vue face ships no sheet; the mirror must invent none"
        );
        assert_eq!(
            <FaceShellComponent as StyledComponent>::name(),
            "face-shell"
        );
    }

    /// `assert!` helper: every needle must be absent from `html`.
    fn assert_list_absent(html: &str, needles: &[&str]) {
        for needle in needles {
            assert!(!html.contains(needle), "unexpected {needle}: {html}");
        }
    }
}
