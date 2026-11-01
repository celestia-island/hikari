// hi-components/src/layout/admin_header.rs
// AdminHeader — mirror of the canonical Vue `HkAdminHeader` (the console's
// three-zone top bar).
//
// NO HIKARI SHEET, on purpose. The Vue component ships none either: every
// class it writes is a HOST utility class from
// `packages/vue/src/styles/admin-tokens.scss` — the balanced three-zone
// header (`s-glass-header`, `s-balanced-header`, `s-glass-header--compact`,
// `s-glass-header--chrome`, `s-header-wing-start|center|end`) and the admin
// chrome (`s-admin-header-*`, `s-user-header*`, `s-user-avatar*`). Its one
// popup surface is HkSelectPanel's (`.hk-select-popout*`, painted by
// `HkSelect.scss`) and its rows are HkMenu's (`.hk-menu-level` /
// `.hk-menu-row` / `.hk-menu-check` / `.hk-menu-item-icon` / `.hk-menu-label`
// / `.hk-menu-more`). `HkMenu.scss` is NOT part of the vendored mirror set
// this wave (`manifest.tsv` lists `_menu-item.scss` only), so those row names
// reach the Rust form as DOM hooks — the same deal `layout/locale_picker_popup.rs`
// documents for the same grammar. Layout comes from the host's utility
// classes; the mirror guarantees the DOM STRUCTURE and the `data-*` hooks
// only, so `styles()` returns `""` and this file invents no CSS.
//
// DOM contract (mirrors the Vue render output one-to-one):
//
//   header.s-glass-header.s-balanced-header
//          [.s-glass-header--compact] [.s-glass-header--chrome]
//     div.s-admin-header-user.s-header-wing-start
//       ── show_hamburger ──
//       button.hk-btn.hk-btn-ghost.hk-btn-sm         (mirrored Button)
//         span.hk-btn-label > svg.s-admin-header-hamburger-icon
//       ── identity_mounted ──
//       button.s-admin-header-avatar [aria-label] [aria-haspopup] [aria-expanded]
//         img.s-admin-header-avatar-img [src] [alt]   (url && !avatar_failed)
//         | span.s-user-avatar {initial}
//       ── avatar_action == drawer ──
//       span.s-admin-header-ws-slot [aria-hidden="true"]
//       ── avatar_action == menu && title ──
//       span.s-admin-header-title {title}
//     ── user_menu_open ──  (the HkMenu dropdown surface)
//     div.hk-select-popout-host [data-side] [data-align] (style: geometry)
//       div.hk-select-popout [aria-label] onkeydown
//         div.hk-menu-slot.hk-menu-slot--head          (identity block)
//           ── no username && no email ──
//           div.s-user-header.s-user-header--pending
//             div.hk-spinner-wrapper …                 (mirrored Spinner)
//             div.s-user-header-email {signingInLabel ?? t(signingIn)}
//           ── menu_identity slot ──
//           {menu_identity}
//           ── else ──
//           div.s-user-header.s-user-header--profile
//             span.s-user-avatar-chip [aria-hidden="true"]
//               img.s-user-avatar-img | span.s-user-avatar {initial}
//             div.s-user-header-body
//               div.s-user-header-name {username}
//               div.s-user-header-email {user_email}
//               div.s-user-header-groups > span.hk-badge…  (mirrored Badge)
//         div.hk-menu-level [role="menu"]
//           button.hk-menu-row [data-checked] [data-danger]
//             span.hk-menu-check [data-on]             (reserved column)
//             span.hk-menu-item-icon                   (Icon 16)
//             span.hk-menu-label {label}
//             span.hk-menu-more                         (branch rows)
//           … a branch row's children render as a nested hk-menu-level
//     ── center slot ──
//     div.s-admin-header-center.s-header-wing-center
//     div.s-admin-header-actions.s-header-wing-end
//       ── show_emergency_stop ──
//       button.s-admin-header-emergency [.is-loading] [.is-active]
//              [disabled] [title] {label}
//       {emergency_stop_extra}
//       span.s-admin-header-action {…}                 (one per header_actions)
//       {theme_toggle}
//     {avatar_modal}
//
// STATE CONTRACT (ledger L48). Vue keeps `userMenuOpen`, `avatarModalOpen` and
// the two failed-load latches (`avatarFailed` inside HkAvatarButton,
// `menuAvatarFailed` here) in refs. `use_signal` allocates a fresh signal per
// render and `use_state` shares ONE slot per component TYPE in tairitsu
// 0.5.22, so BOTH are unavailable: `user_menu_open`, `avatar_failed` and
// `menu_avatar_failed` are CONTROLLED props and every transition leaves
// through a callback (`on_user_menu_change`, `on_avatar_error`,
// `on_menu_avatar_error`). The avatar modal's open state moves to the HOST
// with its slot (Vue's scoped `avatar-modal` params are retired — a tairitsu
// slot is an `Element`, not a render function): the `avatar` menu row reaches
// the host through `on_menu_select`. The component stores nothing itself.
//
// Deltas vs Vue (documented, not accidental):
//   * `HkAvatarButton` has no mirror in this wave; its (short) markup is
//     inlined here: the same `button.s-admin-header-avatar`, the same
//     `img.s-admin-header-avatar-img` / `span.s-user-avatar` branch. The
//     failed-load latch is the `avatar_failed` prop (above); its URL-change
//     reset stays in the host.
//   * The dropdown ENGINE is not mirrored. Vue's `HkMenu` owns the level path,
//     the cascading child panel, the hover leave window and the mobile sheet;
//     the mirror renders ONE `hk-menu-level` (plus a nested level per branch
//     row) on HkSelectPanel's surface and closes on a row press, Escape or the
//     host flipping `user_menu_open`. No auto-flip: the anchor rect is used
//     verbatim (`feedback::popover::popover_position_style`), and without one
//     the surface pins to the nearest positioned ancestor.
//   * `HkWindowControls` / `HkThemeToggle` never enter through the header's
//     `chrome` prop here: `chrome` only selects the `--chrome` inset class, and
//     the controls themselves arrive through the host's own slots
//     (`theme_toggle` etc.), exactly as Vue's `slots['theme-toggle']` does.
//   * Glyphs: lucide `Menu` / `Camera` / `Languages` / `ExternalLink` / `LogOut`
//     have no `MdiIcon` counterparts in the crate's minimal set, so the mirror
//     maps them onto the closest members (table in [`admin_header_menu_items`]).
//     The ✓ of the check column and the hamburger keep lucide's markup byte for
//     byte through `dangerous_inner_html` on a `display:contents` host — the
//     crate-wide SVG rule (ledger L49); only trusted static markup travels that
//     path, so there is nothing to escape.
//   * `HGoodBadge`-style group chips: Vue renders `HBadge` with
//     `variant={name === "Administrators" ? "error" : "primary"}` and size sm;
//     the mirror composes the mirrored `Badge` exactly so.
//   * `onForceSignOut`'s PRESENCE is what mounts the identity cluster in Vue
//     (`props.onForceSignOut !== undefined`); here it is
//     `on_force_sign_out.is_some()`, so a host that passes only a handler still
//     gets the trigger.

use hikari_i18n::t;

use hikari_icons::{Icon, MdiIcon};

use crate::basic::{
    Badge, BadgeProps, BadgeSize, BadgeVariant, Button, ButtonProps, ButtonSize, ButtonVariant,
};
use crate::feedback::popover::{PopoverAnchorRect, PopoverPlacement, popover_position_style};
use crate::feedback::{Spinner, SpinnerProps, SpinnerSize};
use crate::layout::locale_picker::LocaleOption;
use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct AdminHeaderComponent;

/// Where the avatar trigger points (Vue: `avatarAction`, default `"menu"`).
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum AdminHeaderAvatarAction {
    /// Toggle the user dropdown (desktop).
    #[default]
    Menu,
    /// Emit the click so the shell opens its nav drawer (mobile); the identity
    /// and the page title stay hidden in this mode.
    Drawer,
}

/// One group the signed-in user belongs to (Vue: `userGroups` entry).
#[derive(Clone, PartialEq, Debug, Default)]
pub struct AdminHeaderGroup {
    pub id: String,
    pub name: String,
}

/// One row of the user dropdown (Vue: `HkMenuItem`).
#[derive(Clone, PartialEq, Debug, Default)]
pub struct AdminHeaderMenuItem {
    /// The identity emitted on select (`avatar`, `locale:<code>`,
    /// `go-to-frontend`, `logout`, `force-signout`).
    pub key: String,
    pub label: String,
    /// Leading glyph (see the file-header delta for the lucide → `MdiIcon`
    /// mapping).
    pub icon: Option<MdiIcon>,
    /// The danger ink (Vue: `danger`, the logout row).
    pub danger: bool,
    /// A check column member (Vue: `checked` while `undefined` for non-check
    /// rows).
    pub checked: Option<bool>,
    /// Cascade children (the Language rows).
    pub children: Vec<AdminHeaderMenuItem>,
}

/// What a selected row does (Vue's `onUserMenuSelect` dispatch).
#[derive(Clone, PartialEq, Debug, Default)]
pub enum AdminHeaderMenuAction {
    /// Open the avatar editor (`avatarModalOpen = true` upstream).
    Avatar,
    /// A language child was chosen; the code rides along.
    Locale(String),
    GoToFrontend,
    Logout,
    /// The pending-identity escape hatch (Vue: `props.onForceSignOut?.()`).
    ForceSignOut,
    /// A key this component never emits.
    #[default]
    Unknown,
}

/// Vue's `onUserMenuSelect`, as a pure decision: leaf selection IS the action.
pub fn admin_header_menu_action(key: &str) -> AdminHeaderMenuAction {
    match key {
        "avatar" => AdminHeaderMenuAction::Avatar,
        "go-to-frontend" => AdminHeaderMenuAction::GoToFrontend,
        "logout" => AdminHeaderMenuAction::Logout,
        "force-signout" => AdminHeaderMenuAction::ForceSignOut,
        other => match other.strip_prefix("locale:") {
            Some(code) => AdminHeaderMenuAction::Locale(code.to_string()),
            None => AdminHeaderMenuAction::Unknown,
        },
    }
}

/// Vue's `identityMounted` computed: the cluster is INJECTED, not assumed — the
/// trigger renders only when the host supplied an identity (username / email /
/// avatar) or explicitly opted into the pending flow (`signingInLabel` /
/// `onForceSignOut`).
pub fn admin_header_identity_mounted(
    username: &str,
    user_email: &str,
    avatar_url: &str,
    signing_in_label: Option<&str>,
    has_force_sign_out: bool,
) -> bool {
    !username.is_empty()
        || !user_email.is_empty()
        || !avatar_url.is_empty()
        || signing_in_label.is_some()
        || has_force_sign_out
}

/// Vue's avatar letter: `username?.charAt(0).toUpperCase() || "?"` — so an
/// empty name falls back to `?` (the `||` catches `""` as well as a missing
/// first char).
pub fn admin_header_avatar_initial(username: &str) -> String {
    match username.chars().next() {
        Some(first) if !username.is_empty() => first.to_uppercase().to_string(),
        _ => "?".to_string(),
    }
}

/// The complete header class list in Vue's order (`s-glass-header`,
/// `s-balanced-header`, then the compact and chrome modifiers).
pub fn admin_header_classes(compact: bool, chrome: bool) -> String {
    let mut classes = String::from("s-glass-header s-balanced-header");
    if compact {
        classes.push_str(" s-glass-header--compact");
    }
    if chrome {
        classes.push_str(" s-glass-header--chrome");
    }
    classes
}

/// Vue's emergency-button class list: the base hook plus the two state
/// modifiers (`is-loading` while busy, `is-active` while the stop is engaged).
pub fn admin_header_emergency_classes(loading: bool, active: bool) -> String {
    let mut classes = String::from("s-admin-header-emergency");
    if loading {
        classes.push_str(" is-loading");
    }
    if active {
        classes.push_str(" is-active");
    }
    classes
}

/// The page title renders only in the `menu` action mode and only when the host
/// passed one (Vue: `avatarAction === "menu" && props.title`).
pub fn admin_header_title_shown(action: AdminHeaderAvatarAction, title: &str) -> bool {
    action == AdminHeaderAvatarAction::Menu && !title.is_empty()
}

/// The drawer-mode stand-in that keeps both faces' left wings at the same
/// min-content floor (Vue: the `s-admin-header-ws-slot` aria-hidden blank).
pub fn admin_header_ws_slot_shown(action: AdminHeaderAvatarAction) -> bool {
    action == AdminHeaderAvatarAction::Drawer
}

/// Vue's `userMenuItems` computed, resolved against the current props.
///
/// The lucide → `MdiIcon` mapping (see the file header):
/// `Camera` → [`MdiIcon::Image`], `Languages` → [`MdiIcon::Translate`],
/// `ExternalLink` → [`MdiIcon::ArrowExpandHorizontal`],
/// `LogOut` → [`MdiIcon::ArrowRight`].
pub fn admin_header_menu_items(props: &AdminHeaderProps) -> Vec<AdminHeaderMenuItem> {
    // Empty identity (a `fetchUser` race on a hard refresh): ONE
    // force-sign-out escape row — action items floating above no identity read
    // as a broken menu.
    if props.username.is_empty() && props.user_email.is_empty() {
        return vec![AdminHeaderMenuItem {
            key: "force-signout".to_string(),
            label: props
                .force_sign_out_label
                .as_deref()
                .map(str::to_string)
                .unwrap_or_else(|| t("components.hk.adminHeader.forceSignOut", "Sign out")),
            icon: None,
            danger: false,
            checked: None,
            children: Vec::new(),
        }];
    }

    let mut items = vec![AdminHeaderMenuItem {
        key: "avatar".to_string(),
        label: props
            .avatar_menu_label
            .as_deref()
            .map(str::to_string)
            .unwrap_or_else(|| t("components.hk.adminHeader.avatar", "Avatar")),
        icon: Some(MdiIcon::Image),
        danger: false,
        checked: None,
        children: Vec::new(),
    }];

    if !props.locale_options.is_empty() {
        items.push(AdminHeaderMenuItem {
            key: "locale".to_string(),
            label: props
                .locale_menu_label
                .as_deref()
                .map(str::to_string)
                .unwrap_or_else(|| t("components.hk.adminHeader.language", "Language")),
            icon: Some(MdiIcon::Translate),
            danger: false,
            checked: None,
            children: props
                .locale_options
                .iter()
                .map(|option| AdminHeaderMenuItem {
                    key: format!("locale:{}", option.code),
                    label: option.label.clone(),
                    icon: None,
                    danger: false,
                    checked: Some(Some(option.code.as_str()) == props.current_locale.as_deref()),
                    children: Vec::new(),
                })
                .collect(),
        });
    }

    // The external-face link, directly above logout (opt-in via the label so
    // admin-only panels keep the menu at avatar/language/logout).
    if let Some(label) = props.go_to_frontend_label.as_deref() {
        items.push(AdminHeaderMenuItem {
            key: "go-to-frontend".to_string(),
            label: label.to_string(),
            icon: Some(MdiIcon::ArrowExpandHorizontal),
            danger: false,
            checked: None,
            children: Vec::new(),
        });
    }

    items.push(AdminHeaderMenuItem {
        key: "logout".to_string(),
        label: props
            .logout_label
            .as_deref()
            .map(str::to_string)
            .unwrap_or_else(|| t("components.hk.adminHeader.logout", "Logout")),
        icon: Some(MdiIcon::ArrowRight),
        danger: true,
        checked: None,
        children: Vec::new(),
    });

    items
}

/// Whether a level reserves the leading check column (Vue's `checkReserved`:
/// `list.some(item => item.checked !== undefined)`).
pub fn admin_header_check_reserved(items: &[AdminHeaderMenuItem]) -> bool {
    items.iter().any(|item| item.checked.is_some())
}

/// The inline geometry of the `position: fixed` dropdown surface. With an
/// anchor rect the shared twelve-placement helper pins it to the trigger (Vue:
/// HkSelectPanel's `positionPanel`, minus the measured flip pass); without one
/// it pins to the nearest positioned ancestor one `offset` below the bar
/// (`bottom-start`).
pub fn admin_header_menu_style(anchor: Option<PopoverAnchorRect>, offset: f64) -> String {
    match anchor {
        Some(anchor) => popover_position_style(PopoverPlacement::BottomStart, anchor, offset),
        None => format!("position:absolute;left:0;top:calc(100% + {offset}px)"),
    }
}

/// The dropdown's surface name (Vue: the `title` HkMenu publishes as the
/// popout's `aria-label`).
pub fn admin_header_menu_title(label: Option<&String>) -> String {
    match label {
        Some(label) => label.clone(),
        None => t("components.hk.adminHeader.avatarTrigger", "Account menu"),
    }
}

/// One lucide glyph, serialized exactly as `lucide-vue-next` renders it: the
/// 24-unit viewBox, the stroke attribute set, the `lucide lucide-{name}-icon
/// lucide-{name}` class pair, the host class a component passes through
/// (`class=` on the lucide component lands on the svg itself) and the automatic
/// `aria-hidden="true"`.
fn lucide_icon_svg(name: &str, size: u32, body: &str, host_class: &str) -> String {
    let host = if host_class.is_empty() {
        String::new()
    } else {
        format!(" {host_class}")
    };
    format!(
        "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"{size}\" height=\"{size}\" \
         viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" \
         stroke-linecap=\"round\" stroke-linejoin=\"round\" \
         class=\"lucide lucide-{name}-icon lucide-{name}{host}\" aria-hidden=\"true\">{body}</svg>"
    )
}

/// lucide `check`'s path (`<Check size={12} />`).
const LUCIDE_CHECK_BODY: &str = r#"<path d="M20 6 9 17l-5-5"></path>"#;

/// lucide `menu`'s three rules (`<Menu size={20} />`).
const LUCIDE_MENU_BODY: &str = r#"<line x1="4" x2="20" y1="12" y2="12"></line><line x1="4" x2="20" y1="6" y2="6"></line><line x1="4" x2="20" y1="18" y2="18"></line>"#;

/// A glyph mounted through `dangerous_inner_html` on its own
/// `style="display:contents"` host (ledger L49: an rsx `svg {}` child lands in
/// the HTML namespace). Only trusted static markup travels this path.
fn glyph_host(markup: &str) -> Element {
    rsx! {
        span {
            style: "display:contents",
            dangerous_inner_html: markup,
        }
    }
}

/// Vue's presence-only marker: `data-*` carries `"true"` while the flag is on
/// and is ABSENT otherwise (a serialized `="false"` reads as a value to a
/// `[data-checked]` selector).
fn marker_attr(flag: bool) -> Option<&'static str> {
    if flag { Some("true") } else { None }
}

/// One `hk-menu-row` (Vue: `renderRow`). The click is forwarded as the row's
/// key; the caller owns the close (`HkMenu` closes around the emit upstream).
fn menu_row(
    item: &AdminHeaderMenuItem,
    reserved: bool,
    on_select: &Option<EventHandler<String>>,
) -> Element {
    let key = item.key.clone();
    let has_kids = !item.children.is_empty();
    let label = item.label.clone();
    let icon = item.icon;
    let checked = item.checked;
    let danger = item.danger;
    let select = on_select.clone();
    rsx! {
        button {
            "type": "button",
            class: "hk-menu-row",
            "data-checked": marker_attr(checked == Some(true)),
            "data-danger": marker_attr(danger),
            onclick: move |event: MouseEvent| {
                event.stop_propagation();
                if let Some(handler) = select.as_ref() {
                    handler.call(key.clone());
                }
            },
            if reserved {
                // HkMenu reserves the leading column whenever any row of the
                // level carries `checked`.
                span {
                    class: "hk-menu-check",
                    "data-on": marker_attr(checked == Some(true)),
                    "aria-hidden": "true",
                    if checked == Some(true) {
                        {glyph_host(&lucide_icon_svg("check", 12, LUCIDE_CHECK_BODY, ""))}
                    }
                }
            }
            if let Some(icon) = icon {
                span { class: "hk-menu-item-icon",
                    Icon { icon, size: 16 }
                }
            }
            span { class: "hk-menu-label", {label} }
            if has_kids {
                span { class: "hk-menu-more",
                    {glyph_host(&lucide_icon_svg(
                        "chevron-right",
                        14,
                        r#"<path d="m9 18 6-6-6-6"></path>"#,
                        "",
                    ))}
                }
            }
        }
    }
}

/// One `hk-menu-level[role=menu]` with its rows (Vue: `levelSurface`). A branch
/// row's children render as a nested level — the mirror has no cascade panel
/// (see the file-header delta), so they stay in ONE surface.
fn menu_level(items: &[AdminHeaderMenuItem], on_select: &Option<EventHandler<String>>) -> Element {
    let reserved = admin_header_check_reserved(items);
    let mut rows: Vec<VNode> = Vec::with_capacity(items.len());
    for item in items {
        rows.push(menu_row(item, reserved, on_select));
        if !item.children.is_empty() {
            rows.push(menu_level(&item.children, on_select));
        }
    }
    rsx! {
        div {
            class: "hk-menu-level",
            "role": "menu",
            {VNode::Fragment(rows)}
        }
    }
}

#[define_props]
pub struct AdminHeaderProps {
    /// The open view's title — the bar labels WHERE you are, never who you are
    /// (empty hides the node).
    #[default]
    pub title: String,

    /// Show the hamburger (mobile: the shell's drawer trigger).
    #[default]
    pub show_hamburger: bool,

    /// Compact bar (`s-glass-header--compact`).
    #[default]
    pub compact: bool,

    /// Chrome inset (`s-glass-header--chrome`): pass true iff the bar renders
    /// the window controls, so the right inset follows the window-controls
    /// contract instead of the content inset.
    #[default]
    pub chrome: bool,

    /// The action cluster (Vue: `actions`, the action-bar channel's rows).
    #[default]
    pub header_actions: Vec<Element>,

    /// Signed-in name: the avatar fallback letter, the dropdown identity block
    /// and the pending-state branch. NEVER rendered as bar text.
    #[default]
    pub username: String,

    /// Avatar image URL (empty renders the letter fallback).
    #[default]
    pub avatar_url: String,

    /// Signed-in email (the dropdown identity block's second line).
    #[default]
    pub user_email: String,

    /// Permission groups (the dropdown's badge row).
    #[default]
    pub user_groups: Vec<AdminHeaderGroup>,

    /// What the avatar trigger does (Vue: `avatarAction`).
    #[default]
    pub avatar_action: AdminHeaderAvatarAction,

    /// Pending-identity label (also the opt-in that mounts the cluster while
    /// the identity is still loading).
    pub signing_in_label: Option<String>,

    /// Pending-state escape hatch label (see [`AdminHeaderProps::on_force_sign_out`]).
    pub force_sign_out_label: Option<String>,

    /// Show the emergency-stop button.
    #[default]
    pub show_emergency_stop: bool,

    /// The stop is currently engaged (`is-active`).
    #[default]
    pub emergency_stop_active: bool,

    /// Engaged label (Vue: `emergencyStopActiveLabel`).
    #[default]
    pub emergency_stop_active_label: String,

    /// Engaged tooltip (Vue: `emergencyStopActiveTitle`).
    #[default]
    pub emergency_stop_active_title: String,

    /// Resting label (Vue: `emergencyStopLabel`).
    #[default]
    pub emergency_stop_label: String,

    /// Resting tooltip (Vue: `emergencyStopTitle`).
    #[default]
    pub emergency_stop_title: String,

    /// Busy state: renders `is-loading` and disables the button.
    #[default]
    pub emergency_stop_loading: bool,

    /// Dropdown label overrides (fall back to the i18n bundle).
    pub avatar_menu_label: Option<String>,

    /// Accessible label for the avatar trigger (`aria-label`).
    pub avatar_trigger_label: Option<String>,

    /// Language row label override.
    pub locale_menu_label: Option<String>,

    /// The offered locales (the Language cascade); empty hides the row.
    #[default]
    pub locale_options: Vec<LocaleOption>,

    /// The active locale code (the cascade's check).
    pub current_locale: Option<String>,

    /// Logout row label override.
    pub logout_label: Option<String>,

    /// The "Administrators" chip label override.
    pub admin_group_label: Option<String>,

    /// "Go to frontend" row label: the row is hidden unless provided.
    pub go_to_frontend_label: Option<String>,

    /// CONTROLLED trigger-image failure latch (Vue: `avatarFailed` inside
    /// HkAvatarButton).
    #[default]
    pub avatar_failed: bool,

    /// CONTROLLED dropdown-image failure latch (Vue: `menuAvatarFailed`).
    #[default]
    pub menu_avatar_failed: bool,

    /// CONTROLLED dropdown visibility (Vue: `userMenuOpen`).
    #[default]
    pub user_menu_open: bool,

    /// The trigger rect to anchor the dropdown against
    /// (`feedback::popover::anchor_rect_from_element_id` measures one by id).
    pub menu_anchor: Option<PopoverAnchorRect>,

    /// Gap between the bar and the surface (Vue: HkMenu's `offset` default 6).
    #[default(6.0)]
    pub menu_offset: f64,

    /// Page-owned centre group (filter strips, segmented pickers).
    pub center: Option<Element>,

    /// Extra controls appended after the emergency stop.
    pub emergency_stop_extra: Option<Element>,

    /// The right wing's trailing control (Vue: `slots['theme-toggle']`).
    pub theme_toggle: Option<Element>,

    /// Host-owned avatar editor, rendered after the bar (Vue: the scoped
    /// `avatar-modal` slot — the host owns its open state, see the header).
    pub avatar_modal: Option<Element>,

    /// Host-owned identity block for the dropdown (Vue: the `identity` slot).
    pub menu_identity: Option<Element>,

    /// Host-owned dropdown body; wins over the built-in rows.
    pub user_menu: Option<Element>,

    /// Hamburger pressed (Vue: the `hamburger` emit).
    pub on_hamburger: Option<EventHandler<()>>,

    /// Avatar trigger pressed in DRAWER mode (Vue: the `avatarClick` emit). In
    /// `menu` mode the press toggles the dropdown instead.
    pub on_avatar_click: Option<EventHandler<()>>,

    /// Fires with the desired dropdown state (Vue: HkMenu's `update:open`).
    pub on_user_menu_change: Option<EventHandler<bool>>,

    /// Fires with the selected row key; see [`admin_header_menu_action`] for
    /// the dispatch Vue performs on the same key.
    pub on_menu_select: Option<EventHandler<String>>,

    /// The pending-state escape hatch (Vue: the `onForceSignOut` function prop;
    /// its PRESENCE mounts the cluster).
    pub on_force_sign_out: Option<EventHandler<()>>,

    /// Emergency stop pressed (Vue: the `emergencyStop` emit).
    pub on_emergency_stop: Option<EventHandler<()>>,

    /// A language child was chosen (Vue: the `localeSelect` emit).
    pub on_locale_select: Option<EventHandler<String>>,

    /// The frontend row was chosen (Vue: the `goToFrontend` emit).
    pub on_go_to_frontend: Option<EventHandler<()>>,

    /// The logout row was chosen (Vue: the `logout` emit).
    pub on_logout: Option<EventHandler<()>>,

    /// The trigger image failed to load (sets the controlled `avatar_failed`).
    pub on_avatar_error: Option<EventHandler<()>>,

    /// The dropdown image failed to load (sets `menu_avatar_failed`).
    pub on_menu_avatar_error: Option<EventHandler<()>>,
}

#[component]
pub fn AdminHeader(props: AdminHeaderProps) -> Element {
    let identity_mounted = admin_header_identity_mounted(
        &props.username,
        &props.user_email,
        &props.avatar_url,
        props.signing_in_label.as_deref(),
        props.on_force_sign_out.is_some(),
    );
    let drawer_mode = props.avatar_action == AdminHeaderAvatarAction::Drawer;
    let title_shown = admin_header_title_shown(props.avatar_action, &props.title);
    let classes = admin_header_classes(props.compact, props.chrome);

    // ── the avatar trigger (Vue: HkAvatarButton, inlined) ────────────────
    let trigger_label = props
        .avatar_trigger_label
        .clone()
        .unwrap_or_else(|| t("components.hk.adminHeader.avatarTrigger", "Account menu"));
    let trigger_popup = if drawer_mode { "dialog" } else { "menu" };
    let trigger_expanded = if drawer_mode {
        None
    } else {
        // Vue: `expanded={avatarAction === "menu" ? userMenuOpen : undefined}`
        // — Vue always emits the attribute in menu mode (a `false` value lands
        // as `aria-expanded="false"`), and omits it entirely in drawer mode.
        Some(if props.user_menu_open {
            "true"
        } else {
            "false"
        })
    };
    let trigger_img = !props.avatar_url.is_empty() && !props.avatar_failed;
    let avatar_initial = admin_header_avatar_initial(&props.username);
    let trigger_src = props.avatar_url.clone();
    let trigger_alt = props.username.clone();

    // Click: drawer mode emits; menu mode toggles the controlled channel.
    let avatar_click = props.on_avatar_click.clone();
    let menu_change = props.on_user_menu_change.clone();
    let menu_open_for_click = props.user_menu_open;
    let on_avatar_press = move |event: MouseEvent| {
        event.stop_propagation();
        if drawer_mode {
            if let Some(handler) = avatar_click.as_ref() {
                handler.call(());
            }
            return;
        }
        if let Some(handler) = menu_change.as_ref() {
            handler.call(!menu_open_for_click);
        }
    };
    let avatar_error = props.on_avatar_error.clone();

    let hamburger = props.on_hamburger.clone();

    // ── the emergency stop ───────────────────────────────────────────────
    let emergency_classes =
        admin_header_emergency_classes(props.emergency_stop_loading, props.emergency_stop_active);
    let emergency_label = if props.emergency_stop_active {
        props.emergency_stop_active_label.clone()
    } else {
        props.emergency_stop_label.clone()
    };
    let emergency_title = if props.emergency_stop_active {
        props.emergency_stop_active_title.clone()
    } else {
        props.emergency_stop_title.clone()
    };
    let emergency_stop = props.on_emergency_stop.clone();

    // ── the dropdown ─────────────────────────────────────────────────────
    let menu_title = admin_header_menu_title(props.avatar_trigger_label.as_ref());
    let menu_style = admin_header_menu_style(props.menu_anchor, props.menu_offset);
    let close_menu = {
        let change = props.on_user_menu_change.clone();
        move || {
            if let Some(handler) = change.as_ref() {
                handler.call(false);
            }
        }
    };
    let menu_keydown = {
        let close = close_menu.clone();
        move |event: KeyboardEvent| {
            // Vue's Escape path: the panel asks its owner to close, and only
            // consumes the key when it actually closed something (so a host
            // dialog's own Escape still works).
            if event.key.as_str() == "Escape" {
                event.prevent_default();
                event.stop_propagation();
                close();
            }
        }
    };

    let on_select = props.on_menu_select.clone();
    let select_with_dispatch = {
        let close = close_menu.clone();
        let select = on_select.clone();
        let locale_select = props.on_locale_select.clone();
        let go_to_frontend = props.on_go_to_frontend.clone();
        let logout = props.on_logout.clone();
        let force_sign_out = props.on_force_sign_out.clone();
        move |key: String| {
            if let Some(handler) = select.as_ref() {
                handler.call(key.clone());
            }
            // Vue dispatches the row's own side effect alongside the HkMenu
            // `select` emit; the mirror keeps BOTH channels so a host can use
            // either the raw key or the typed emits.
            match admin_header_menu_action(&key) {
                AdminHeaderMenuAction::Locale(code) => {
                    if let Some(handler) = locale_select.as_ref() {
                        handler.call(code);
                    }
                }
                AdminHeaderMenuAction::GoToFrontend => {
                    if let Some(handler) = go_to_frontend.as_ref() {
                        handler.call(());
                    }
                }
                AdminHeaderMenuAction::Logout => {
                    if let Some(handler) = logout.as_ref() {
                        handler.call(());
                    }
                }
                AdminHeaderMenuAction::ForceSignOut => {
                    if let Some(handler) = force_sign_out.as_ref() {
                        handler.call(());
                    }
                }
                // `avatar` opens the host's editor through `on_menu_select`,
                // and an unknown key is the host's to ignore.
                AdminHeaderMenuAction::Avatar | AdminHeaderMenuAction::Unknown => {}
            }
            close();
        }
    };
    let select_handler: Option<EventHandler<String>> =
        Some(EventHandler::new(select_with_dispatch));

    let menu_items = admin_header_menu_items(&props);
    let identity_pending = props.username.is_empty() && props.user_email.is_empty();
    let signing_in = props
        .signing_in_label
        .clone()
        .unwrap_or_else(|| t("components.hk.adminHeader.signingIn", "Signing in…"));
    let menu_avatar_initial = avatar_initial.clone();
    let menu_avatar_img = !props.avatar_url.is_empty() && !props.menu_avatar_failed;
    let menu_avatar_src = props.avatar_url.clone();
    let menu_avatar_alt = props.username.clone();
    let menu_avatar_error = props.on_menu_avatar_error.clone();
    let admin_group_label = props
        .admin_group_label
        .clone()
        .unwrap_or_else(|| t("components.hk.adminHeader.adminGroup", "Administrators"));
    let show_username = !props.username.is_empty();
    let show_email = !props.user_email.is_empty();
    let show_groups = !props.user_groups.is_empty();
    let username = props.username.clone();
    let user_email = props.user_email.clone();
    let user_groups = props.user_groups.clone();
    let menu_identity = props.menu_identity.clone();
    let user_menu = props.user_menu.clone();
    let menu_open = props.user_menu_open;

    rsx! {
        header {
            class: classes,
            div {
                class: "s-admin-header-user s-header-wing-start",
                if props.show_hamburger {
                    {Button(ButtonProps {
                        variant: ButtonVariant::Ghost,
                        size: ButtonSize::Sm,
                        children: glyph_host(&lucide_icon_svg(
                            "menu",
                            20,
                            LUCIDE_MENU_BODY,
                            "s-admin-header-hamburger-icon",
                        )),
                        onclick: {
                            let handler = hamburger.clone();
                            Some(EventHandler::new(move |_event: MouseEvent| {
                                if let Some(handler) = handler.as_ref() {
                                    handler.call(());
                                }
                            }))
                        },
                        ..Default::default()
                    })}
                }
                if identity_mounted {
                    button {
                        class: "s-admin-header-avatar",
                        "aria-label": trigger_label,
                        "aria-haspopup": trigger_popup,
                        "aria-expanded": trigger_expanded,
                        onclick: on_avatar_press,
                        if trigger_img {
                            img {
                                class: "s-admin-header-avatar-img",
                                src: trigger_src,
                                alt: trigger_alt,
                                onerror: move |_event: Box<dyn EventData>| {
                                    if let Some(handler) = avatar_error.as_ref() {
                                        handler.call(());
                                    }
                                },
                            }
                        } else {
                            span { class: "s-user-avatar", {avatar_initial} }
                        }
                    }
                }
                if admin_header_ws_slot_shown(props.avatar_action) {
                    span { class: "s-admin-header-ws-slot", "aria-hidden": "true" }
                }
                if title_shown {
                    span { class: "s-admin-header-title", {props.title.clone()} }
                }
            }
            if menu_open {
                div {
                    class: "hk-select-popout-host",
                    "data-side": "bottom",
                    "data-align": "start",
                    style: menu_style,
                    div {
                        class: "hk-select-popout",
                        "aria-label": menu_title,
                        onkeydown: menu_keydown,
                        div {
                            class: "hk-menu-slot hk-menu-slot--head",
                            if identity_pending {
                                div {
                                    class: "s-user-header s-user-header--pending",
                                    Spinner { size: SpinnerSize::Sm }
                                    div { class: "s-user-header-email", {signing_in} }
                                }
                            } else if let Some(identity) = &menu_identity {
                                {identity.clone()}
                            } else {
                                div {
                                    class: "s-user-header s-user-header--profile",
                                    span {
                                        class: "s-user-avatar-chip",
                                        "aria-hidden": "true",
                                        if menu_avatar_img {
                                            img {
                                                class: "s-user-avatar-img",
                                                src: menu_avatar_src,
                                                alt: "",
                                                onerror: move |_event: Box<dyn EventData>| {
                                                    if let Some(handler) = menu_avatar_error.as_ref() {
                                                        handler.call(());
                                                    }
                                                },
                                            }
                                        } else {
                                            span { class: "s-user-avatar", {menu_avatar_initial} }
                                        }
                                    }
                                    div {
                                        class: "s-user-header-body",
                                        if show_username {
                                            div { class: "s-user-header-name", {username} }
                                        }
                                        if show_email {
                                            div { class: "s-user-header-email", {user_email} }
                                        }
                                        if show_groups {
                                            div {
                                                class: "s-user-header-groups",
                                                for group in user_groups.iter() {
                                                    {
                                                        // Vue: `variant={name === "Administrators" ? "error" : "primary"}`
                                                        // with the Administrators label resolved
                                                        // through i18n. Both are resolved BEFORE the
                                                        // rsx tree: an `if` expression is not an
                                                        // attribute value the macro accepts.
                                                        let administrators = group.name == "Administrators";
                                                        let variant = if administrators {
                                                            BadgeVariant::Error
                                                        } else {
                                                            BadgeVariant::Primary
                                                        };
                                                        let label = if administrators {
                                                            admin_group_label.clone()
                                                        } else {
                                                            group.name.clone()
                                                        };
                                                        rsx! {
                                                            Badge {
                                                                variant,
                                                                size: BadgeSize::Sm,
                                                                children: VNode::Text(VText::new(label.as_str())),
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        if let Some(custom) = &user_menu {
                            {custom.clone()}
                        } else {
                            {menu_level(&menu_items, &select_handler)}
                        }
                    }
                }
            }
            if let Some(center) = &props.center {
                div { class: "s-admin-header-center s-header-wing-center",
                    {center.clone()}
                }
            }
            div {
                class: "s-admin-header-actions s-header-wing-end",
                if props.show_emergency_stop {
                    button {
                        class: emergency_classes,
                        disabled: props.emergency_stop_loading,
                        title: emergency_title,
                        onclick: move |_event: MouseEvent| {
                            if let Some(handler) = emergency_stop.as_ref() {
                                handler.call(());
                            }
                        },
                        {emergency_label}
                    }
                }
                if let Some(extra) = &props.emergency_stop_extra {
                    {extra.clone()}
                }
                for action in props.header_actions.iter() {
                    span { class: "s-admin-header-action", {action.clone()} }
                }
                if let Some(toggle) = &props.theme_toggle {
                    {toggle.clone()}
                }
            }
            if let Some(modal) = &props.avatar_modal {
                {modal.clone()}
            }
        }
    }
}

impl StyledComponent for AdminHeaderComponent {
    fn styles() -> &'static str {
        // The Vue bar ships no sheet of its own: the balanced header geometry
        // and the admin chrome are host token classes (`s-*`), and the dropdown
        // rows ride HkSelect's surface sheet + HkMenu's (unvendored) row
        // grammar. See the file header.
        ""
    }

    fn name() -> &'static str {
        "admin-header"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn locale(code: &str) -> LocaleOption {
        LocaleOption {
            code: code.to_string(),
            label: code.to_uppercase(),
        }
    }

    #[test]
    fn admin_header_defaults_match_the_vue_props() {
        let props = AdminHeaderProps::default();
        assert_eq!(props.title, "");
        assert!(!props.show_hamburger);
        assert!(!props.compact);
        assert!(!props.chrome);
        assert!(props.header_actions.is_empty());
        assert_eq!(props.username, "");
        assert_eq!(props.avatar_url, "");
        assert_eq!(props.user_email, "");
        assert!(props.user_groups.is_empty());
        assert_eq!(props.avatar_action, AdminHeaderAvatarAction::Menu);
        assert!(props.signing_in_label.is_none());
        assert!(props.force_sign_out_label.is_none());
        assert!(!props.show_emergency_stop);
        assert!(!props.emergency_stop_active);
        assert_eq!(props.emergency_stop_active_label, "");
        assert_eq!(props.emergency_stop_active_title, "");
        assert_eq!(props.emergency_stop_label, "");
        assert_eq!(props.emergency_stop_title, "");
        assert!(!props.emergency_stop_loading);
        assert!(props.avatar_menu_label.is_none());
        assert!(props.avatar_trigger_label.is_none());
        assert!(props.locale_menu_label.is_none());
        assert!(props.locale_options.is_empty());
        assert!(props.current_locale.is_none());
        assert!(props.logout_label.is_none());
        assert!(props.admin_group_label.is_none());
        assert!(props.go_to_frontend_label.is_none());
        assert!(!props.avatar_failed);
        assert!(!props.menu_avatar_failed);
        assert!(!props.user_menu_open);
        assert!(props.menu_anchor.is_none());
        assert_eq!(props.menu_offset, 6.0);
        assert!(props.center.is_none());
        assert!(props.emergency_stop_extra.is_none());
        assert!(props.theme_toggle.is_none());
        assert!(props.avatar_modal.is_none());
        assert!(props.menu_identity.is_none());
        assert!(props.user_menu.is_none());
        assert!(props.on_hamburger.is_none());
        assert!(props.on_avatar_click.is_none());
        assert!(props.on_user_menu_change.is_none());
        assert!(props.on_menu_select.is_none());
        assert!(props.on_force_sign_out.is_none());
        assert!(props.on_emergency_stop.is_none());
        assert!(props.on_locale_select.is_none());
        assert!(props.on_go_to_frontend.is_none());
        assert!(props.on_logout.is_none());
        assert!(props.on_avatar_error.is_none());
        assert!(props.on_menu_avatar_error.is_none());
    }

    #[test]
    fn admin_header_class_lists_match_the_vue_order() {
        assert_eq!(
            admin_header_classes(false, false),
            "s-glass-header s-balanced-header"
        );
        assert_eq!(
            admin_header_classes(true, true),
            "s-glass-header s-balanced-header s-glass-header--compact s-glass-header--chrome"
        );
        assert_eq!(
            admin_header_emergency_classes(false, false),
            "s-admin-header-emergency"
        );
        assert_eq!(
            admin_header_emergency_classes(true, true),
            "s-admin-header-emergency is-loading is-active"
        );
    }

    #[test]
    fn admin_header_identity_gate_matches_the_vue_computed() {
        // Nothing supplied and no pending opt-in: no account surface.
        assert!(!admin_header_identity_mounted("", "", "", None, false));
        assert!(admin_header_identity_mounted("ada", "", "", None, false));
        assert!(admin_header_identity_mounted("", "ada@x", "", None, false));
        assert!(admin_header_identity_mounted("", "", "/a.png", None, false));
        // The two pending-flow opt-ins mount the cluster on their own.
        assert!(admin_header_identity_mounted(
            "",
            "",
            "",
            Some("Signing in…"),
            false
        ));
        assert!(admin_header_identity_mounted("", "", "", None, true));
    }

    #[test]
    fn admin_header_avatar_initial_matches_the_vue_fallback() {
        assert_eq!(admin_header_avatar_initial("ada"), "A");
        assert_eq!(admin_header_avatar_initial("bob"), "B");
        // Vue's `|| "?"` catches the empty-string case as well.
        assert_eq!(admin_header_avatar_initial(""), "?");
        assert_eq!(admin_header_avatar_initial("éclair"), "É");
    }

    #[test]
    fn admin_header_title_and_ws_slot_follow_the_action_mode() {
        assert!(admin_header_title_shown(
            AdminHeaderAvatarAction::Menu,
            "Providers"
        ));
        assert!(!admin_header_title_shown(AdminHeaderAvatarAction::Menu, ""));
        assert!(!admin_header_title_shown(
            AdminHeaderAvatarAction::Drawer,
            "Providers"
        ));
        assert!(admin_header_ws_slot_shown(AdminHeaderAvatarAction::Drawer));
        assert!(!admin_header_ws_slot_shown(AdminHeaderAvatarAction::Menu));
    }

    #[test]
    fn admin_header_menu_items_match_the_vue_computed() {
        // Empty identity → ONE force-sign-out escape row.
        let items = admin_header_menu_items(&AdminHeaderProps::default());
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].key, "force-signout");
        assert_eq!(items[0].label, "Sign out");
        assert!(items[0].icon.is_none());

        // Full menu: avatar → language cascade → frontend link → logout.
        let items = admin_header_menu_items(&AdminHeaderProps {
            username: "ada".to_string(),
            user_email: "ada@example.test".to_string(),
            locale_options: vec![locale("en"), locale("zh-Hans")],
            current_locale: Some("zh-Hans".to_string()),
            go_to_frontend_label: Some("Go to frontend".to_string()),
            ..Default::default()
        });
        let keys: Vec<&str> = items.iter().map(|item| item.key.as_str()).collect();
        assert_eq!(keys, vec!["avatar", "locale", "go-to-frontend", "logout"]);
        assert_eq!(items[0].label, "Avatar");
        assert_eq!(items[1].label, "Language");
        assert_eq!(items[3].label, "Logout");
        assert!(items[3].danger, "logout is the danger row");
        assert_eq!(items[1].children.len(), 2);
        assert_eq!(items[1].children[0].key, "locale:en");
        assert_eq!(items[1].children[0].checked, Some(false));
        assert_eq!(items[1].children[1].checked, Some(true));

        // The frontend row is opt-in: without a label it disappears.
        let items = admin_header_menu_items(&AdminHeaderProps {
            username: "ada".to_string(),
            user_email: "ada@example.test".to_string(),
            ..Default::default()
        });
        let keys: Vec<&str> = items.iter().map(|item| item.key.as_str()).collect();
        assert_eq!(keys, vec!["avatar", "logout"]);

        // Host labels win over the i18n fallbacks.
        let items = admin_header_menu_items(&AdminHeaderProps {
            username: "ada".to_string(),
            avatar_menu_label: Some("Portrait".to_string()),
            locale_menu_label: Some("Sprache".to_string()),
            logout_label: Some("Abmelden".to_string()),
            ..Default::default()
        });
        assert_eq!(items[0].label, "Portrait");
        assert_eq!(items[1].label, "Abmelden");
    }

    #[test]
    fn admin_header_check_column_is_reserved_like_vue() {
        let no_check = admin_header_menu_items(&AdminHeaderProps {
            username: "ada".to_string(),
            user_email: "a@b".to_string(),
            ..Default::default()
        });
        assert!(!admin_header_check_reserved(&no_check));
        let with_locales = admin_header_menu_items(&AdminHeaderProps {
            username: "ada".to_string(),
            user_email: "a@b".to_string(),
            locale_options: vec![locale("en")],
            ..Default::default()
        });
        // The TOP level carries no `checked`, so it reserves nothing; the
        // locale level (every child carries `checked`) does.
        assert!(!admin_header_check_reserved(&with_locales));
        let locale_level = &with_locales[1].children;
        assert!(admin_header_check_reserved(locale_level));
    }

    #[test]
    fn admin_header_menu_action_dispatch_matches_the_vue_select() {
        assert_eq!(
            admin_header_menu_action("avatar"),
            AdminHeaderMenuAction::Avatar
        );
        assert_eq!(
            admin_header_menu_action("locale:zh-Hans"),
            AdminHeaderMenuAction::Locale("zh-Hans".to_string())
        );
        assert_eq!(
            admin_header_menu_action("go-to-frontend"),
            AdminHeaderMenuAction::GoToFrontend
        );
        assert_eq!(
            admin_header_menu_action("logout"),
            AdminHeaderMenuAction::Logout
        );
        assert_eq!(
            admin_header_menu_action("force-signout"),
            AdminHeaderMenuAction::ForceSignOut
        );
        assert_eq!(
            admin_header_menu_action("locale:"),
            AdminHeaderMenuAction::Locale(String::new())
        );
        assert_eq!(
            admin_header_menu_action("nonsense"),
            AdminHeaderMenuAction::Unknown
        );
    }

    #[test]
    fn admin_header_menu_geometry_pins_to_the_anchor_or_the_ancestor() {
        // Without an anchor the surface falls back to the nearest positioned
        // ancestor, one offset below.
        assert_eq!(
            admin_header_menu_style(None, 6.0),
            "position:absolute;left:0;top:calc(100% + 6px)"
        );
        // With one, the shared placement helper takes over (bottom-start).
        let anchor = PopoverAnchorRect {
            x: 32.0,
            y: 40.0,
            width: 28.0,
            height: 28.0,
        };
        let style = admin_header_menu_style(Some(anchor), 6.0);
        assert!(style.contains("left:32px"), "{style}");
        assert!(style.contains("top:74px"), "{style}");
        assert!(style.contains("translate(0, 0)"), "{style}");
    }

    #[test]
    fn admin_header_renders_the_three_zone_bar() {
        let html = AdminHeader(AdminHeaderProps {
            title: "Providers".to_string(),
            show_hamburger: true,
            username: "ada".to_string(),
            show_emergency_stop: true,
            emergency_stop_label: "Stop".to_string(),
            emergency_stop_title: "Engage the stop".to_string(),
            ..Default::default()
        })
        .render_to_html();
        for needle in [
            "class=\"s-glass-header s-balanced-header\"",
            "class=\"s-admin-header-user s-header-wing-start\"",
            "class=\"hk-btn hk-btn-ghost hk-btn-sm\"",
            "lucide lucide-menu-icon lucide-menu s-admin-header-hamburger-icon",
            "display:contents",
            "class=\"s-admin-header-avatar\"",
            "aria-haspopup=\"menu\"",
            "aria-expanded=\"false\"",
            "class=\"s-user-avatar\"",
            "class=\"s-admin-header-title\"",
            "Providers",
            "class=\"s-admin-header-actions s-header-wing-end\"",
            "class=\"s-admin-header-emergency\"",
            "title=\"Engage the stop\"",
            "Stop",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        // Menu is closed: no dropdown surface, and the centre wing only
        // renders when the host provides one.
        assert!(!html.contains("hk-select-popout-host"), "{html}");
        assert!(!html.contains("s-admin-header-center"), "{html}");
        assert!(!html.contains("disabled"), "{html}");
    }

    #[test]
    fn admin_header_renders_the_dropdown_and_identity_block() {
        let html = AdminHeader(AdminHeaderProps {
            username: "ada".to_string(),
            user_email: "ada@example.test".to_string(),
            user_groups: vec![AdminHeaderGroup {
                id: "admins".to_string(),
                name: "Administrators".to_string(),
            }],
            avatar_url: "https://example.test/a.png".to_string(),
            user_menu_open: true,
            locale_options: vec![locale("en"), locale("zh-Hans")],
            current_locale: Some("en".to_string()),
            ..Default::default()
        })
        .render_to_html();
        for needle in [
            "class=\"hk-select-popout-host\"",
            "data-side=\"bottom\"",
            "data-align=\"start\"",
            "class=\"hk-select-popout\"",
            "aria-label=\"Account menu\"",
            "hk-menu-slot hk-menu-slot--head",
            "s-user-header s-user-header--profile",
            "s-user-avatar-chip",
            "s-user-avatar-img",
            "s-user-header-name",
            "ada@example.test",
            "s-user-header-groups",
            "hk-badge hk-badge-error",
            "Administrators",
            "class=\"hk-menu-level\"",
            "role=\"menu\"",
            "class=\"hk-menu-row\"",
            "hk-menu-item-icon",
            "hk-menu-label",
            "data-danger=\"true\"",
            "hk-menu-check",
            "data-on=\"true\"",
            "lucide lucide-check-icon",
            "hk-menu-more",
            "lucide lucide-chevron-right-icon",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        // The trigger shows the image, not the letter (a URL is set and the
        // latch is clear).
        assert!(
            html.matches("s-admin-header-avatar-img").count() == 1,
            "only the trigger carries the trigger-image hook: {html}"
        );
        // `data-checked` is presence-only: the unchecked locale rows omit it.
        assert!(!html.contains("data-checked=\"false\""), "{html}");
    }

    #[test]
    fn admin_header_renders_the_pending_identity_and_drawer_mode() {
        let html = AdminHeader(AdminHeaderProps {
            avatar_action: AdminHeaderAvatarAction::Drawer,
            signing_in_label: Some("Restoring session…".to_string()),
            user_menu_open: true,
            title: "Hidden in drawer mode".to_string(),
            ..Default::default()
        })
        .render_to_html();
        // Drawer mode: the trigger points at a dialog, no expanded state, the
        // ws-slot stand-in and no title.
        assert!(html.contains("aria-haspopup=\"dialog\""), "{html}");
        assert!(!html.contains("aria-expanded"), "{html}");
        assert!(html.contains("s-admin-header-ws-slot"), "{html}");
        assert!(!html.contains("s-admin-header-title"), "{html}");
        // The pending identity block: spinner row with the host's label, one
        // force-sign-out row (the escape hatch is what mounted the cluster).
        assert!(
            html.contains("s-user-header s-user-header--pending"),
            "{html}"
        );
        assert!(html.contains("Restoring session…"), "{html}");
        assert!(html.contains("hk-spinner"), "{html}");
        // The escape row's KEY is a handler argument (Vue's VDOM key never
        // reaches the DOM either); the label is what proves the row rendered.
        assert!(html.contains("Sign out"), "{html}");
        assert!(!html.contains("s-user-header--profile"), "{html}");
        assert!(!html.contains("s-user-header-groups"), "{html}");
    }

    #[test]
    fn admin_header_has_no_sheet_of_its_own() {
        assert_eq!(
            <AdminHeaderComponent as StyledComponent>::styles(),
            "",
            "the Vue bar ships no sheet; the mirror must invent none"
        );
        assert_eq!(
            <AdminHeaderComponent as StyledComponent>::name(),
            "admin-header"
        );
    }
}
