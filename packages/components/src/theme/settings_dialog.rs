// hi-components/src/theme/settings_dialog.rs
// SettingsDialog — mirror of the canonical Vue `HkSettingsDialog` family:
// the sectioned settings shell (left rail + right pane) inside an HModal
// window, its standalone body, and the content vocabulary (group / sub /
// hint). One Vue file exports all of these (`HkSettingsDialog.tsx`:
// `HkSettingsBody`, `HkSettingsDialog`, `HkSettingsGroup`, `HkSettingsSub`,
// `HkSettingsHint`); this file mirrors them one-for-one.
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkSettingsDialog.scss`, vendored under
// `src/styles/vue-mirror/`), compiled with `no_hash` so the
// `.hk-settings*` class names are literal and identical in both forms.
// DOM contract (mirrors the Vue render output):
//
//   Modal (title, width "58rem", contentClass "hk-settings-host")
//     div.hk-settings [data-phone]?          (style: --hk-settings-height)
//       ── desktop ──
//       nav.hk-settings__rail [aria-label]?
//         button.hk-settings__rail-item [.is-active]     (per section)
//           [aria-current=true] [aria-disabled] [disabled]
//           span.hk-settings__rail-icon? > {icon vnode}
//           span.hk-settings__rail-label {label}
//       ── phone (<768px) ──
//       div.hk-settings__topnav               (the same rail buttons)
//       div.hk-settings__pane
//         {children}                           (the ACTIVE section's pane)
//
//   SettingsGroup  → section.hk-settings-group > h3.hk-settings-group-title?
//   SettingsSub    → div.hk-settings-sub       > h4.hk-settings-sub-title?
//   SettingsHint   → p.hk-settings-hint
//
// Section identity is a v-model in Vue (`v-model:section`, unbound = the
// first usable section). tairitsu 0.5.22 has no per-instance component
// state (ledger L48 — `use_signal` reallocates per render, `use_state`
// shares one slot per component type), so the active section is a
// CONTROLLED prop: `section: Option<String>` resolves through
// [`settings_active_section`] (an unbound host lands on the first USABLE
// section every render) and rail presses flow out through
// `on_section_change` — the host writes the key back, the same
// controlled-props split every mirror in this wave documents. The landing
// default is the first USABLE section, never a disabled one, and a
// disabled/unknown deep link NEVER activates (Vue's R1/R2 guards, kept as
// the pure functions below).
//
// Deltas vs Vue (documented, not accidental):
//   * NO HkScrollContainer mirror exists (the crate ships no
//     `hk-scroll-container*` rules), so the rail and the pane carry the
//     sheet's VIEWPORT rhythm inline (the same substitution
//     `overlay/popup_select.rs` documents) and scroll with the native bar:
//     rail `display:flex; flex-direction:column; gap:var(--space-2);
//     padding:var(--space-4) var(--space-12) var(--space-4) 0;
//     overflow-y:auto`, pane `display:flex; flex-direction:column;
//     gap:var(--space-16); overflow-y:auto`. The overlay chrome itself has
//     no tairitsu primitive this wave.
//   * NO HkTransitionContainer around the pane swap: the morph needs the
//     measured outgoing generation (per-instance state), so a section
//     switch hard-cuts instead of dissolving. The pane also does not
//     auto-reset its scroll on a switch (Vue's `scrollTop = 0` pass needs
//     the live viewport element) — the host re-mounts or scrolls itself.
//   * NO useBreakpoint: the phone flip is HOST-DRIVEN — the body takes a
//     `phone: bool` prop (and the dialog forwards it), decided with
//     [`settings_phone_layout`] on the host's live viewport width, the same
//     split `overlay/select_panel.rs` documents for its branch. The phone
//     topnav renders the SAME rail buttons (HTabs has no Rust mirror; the
//     sheet's `[data-phone]` block restyles `.hk-tabs-trigger` children,
//     which are absent here — the strip is a plain centered button band
//     until that mirror lands).
//   * NO per-section slot channel: Vue feeds each pane through
//     `slots[active()]`; the mirror takes ONE `children` element — the host
//     already owns the active key (it is controlled), so it switches the
//     pane content itself.
//   * The rail `icon` is a vnode (`Option<Element>`), not a component —
//     the slot form of Vue's `props.icon`, the same collapse
//     `display/empty_state.rs` documents. Vue renders it at 16px; the
//     mirror passes the vnode through untouched.

use crate::feedback::{Modal, ModalProps};
use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct SettingsDialogComponent;

/// One rail entry (Vue: `HkSettingsSection`).
#[derive(Clone, PartialEq, Debug, Default)]
pub struct SettingsSection {
    /// Section identity (also the v-model key in Vue).
    pub key: String,
    /// Rail label.
    pub label: String,
    /// Leading rail icon vnode, rendered at 16px by the host (see the
    /// header delta).
    pub icon: Option<Element>,
    /// A disabled entry renders but cannot be activated.
    pub disabled: bool,
}

/// Vue's `firstUsable`: the first entry that is not disabled, `""` when
/// every entry is disabled (or the list is empty). The landing default is
/// NEVER a disabled section (Vue R2, 2026-10-28).
pub fn settings_first_usable(sections: &[SettingsSection]) -> String {
    sections
        .iter()
        .find(|section| !section.disabled)
        .map(|section| section.key.clone())
        .unwrap_or_default()
}

/// Vue's activation guard: a key activates only when a section carries it
/// AND is not disabled (unknown keys and disabled deep links never win —
/// the section watch's R1 rule).
pub fn settings_section_activatable(sections: &[SettingsSection], key: &str) -> bool {
    sections
        .iter()
        .any(|section| section.key == key && !section.disabled)
}

/// The resolved active section: a bound key that can activate wins;
/// anything else (unbound, disabled, unknown) lands on the first usable
/// section (Vue: `active()`).
pub fn settings_active_section(sections: &[SettingsSection], section: Option<&str>) -> String {
    match section {
        Some(key) if settings_section_activatable(sections, key) => key.to_string(),
        _ => settings_first_usable(sections),
    }
}

/// The family mobile breakpoint (Vue: `useBreakpoint` — `isMobile` is
/// `window.innerWidth < 768`). The mirror installs no watcher; the host
/// calls this with the live width, on open and on resize.
pub fn settings_phone_layout(viewport_width: i32) -> bool {
    viewport_width < 768
}

/// One rail button's class list (Vue: `["hk-settings__rail-item", on ?
/// "is-active" : ""]`, empty strings dropped by Vue's class normalization).
pub fn settings_rail_item_classes(active: bool) -> String {
    if active {
        "hk-settings__rail-item is-active".to_string()
    } else {
        "hk-settings__rail-item".to_string()
    }
}

/// The dialog's shell-height custom property (Vue: the body's
/// `style: { "--hk-settings-height": props.height }`).
pub fn settings_height_style(height: &str) -> String {
    format!("--hk-settings-height:{height}")
}

/// The rail viewport rhythm, inlined (no HkScrollContainer mirror — see the
/// header deltas; the values are the sheet's own
/// `.hk-settings__rail.hk-scroll-container > .hk-scroll-container-viewport`
/// rule, plus the scroller the container used to own).
const SETTINGS_RAIL_STYLE: &str = "display:flex;flex-direction:column;gap:var(--space-2);padding:var(--space-4) var(--space-12) var(--space-4) 0;overflow-y:auto";

/// The pane viewport rhythm, inlined for the same reason (the sheet's
/// `.hk-settings__pane.hk-scroll-container > .hk-scroll-container-viewport`
/// rule plus its scroller).
const SETTINGS_PANE_STYLE: &str =
    "display:flex;flex-direction:column;gap:var(--space-16);overflow-y:auto";

/// Wrap an element as a vnode (`tairitsu` has no `From<VElement>` impl).
fn el(node: VElement) -> VNode {
    VNode::Element(Box::new(node))
}

/// One rail button (Vue's rail loop): `on` is `active === key && !disabled`.
fn settings_rail_button(
    section: &SettingsSection,
    on: bool,
    on_section_change: &Option<EventHandler<String>>,
) -> VNode {
    let mut button = VElement::new("button")
        .class(settings_rail_item_classes(on))
        .attr("type", "button")
        .attr_opt("aria-current", on.then(|| "true".to_string()))
        .attr_opt(
            "aria-disabled",
            section.disabled.then(|| "true".to_string()),
        );
    if section.disabled {
        // A presence-only boolean, like rsx's `disabled: true`.
        button
            .attributes
            .insert("disabled".to_string(), "disabled".to_string());
    }
    if let Some(icon) = &section.icon {
        button = button.child(el(VElement::new("span")
            .class("hk-settings__rail-icon")
            .attr("aria-hidden", "true")
            .child(icon.clone())));
    }
    button = button.child(el(VElement::new("span")
        .class("hk-settings__rail-label")
        .child(VNode::Text(VText::new(&section.label)))));

    // Vue's `pick(key)`: the belt-and-braces activation guard, then the
    // emit. The state itself is host-owned (ledger L48 — header deltas).
    let key = section.key.clone();
    let activatable = !section.disabled;
    let handler = on_section_change.clone();
    el(button.on_click(move |_event: MouseEvent| {
        if !activatable {
            return;
        }
        if let Some(handler) = handler.as_ref() {
            handler.call(key.clone());
        }
    }))
}

#[define_props]
pub struct SettingsBodyProps {
    /// Rail entries, in rail order.
    #[default]
    pub sections: Vec<SettingsSection>,

    /// Active section key (Vue: `v-model:section`; `None` = unbound — the
    /// first usable section, re-resolved every render).
    pub section: Option<String>,

    /// Accessible name for the rail navigation.
    pub nav_label: Option<String>,

    /// Host-decided phone layout (see [`settings_phone_layout`] and the
    /// header deltas).
    #[default]
    pub phone: bool,

    /// Host style for the root (the dialog's `--hk-settings-height` rides
    /// here; Vue's attribute fallthrough).
    #[default]
    pub style: String,

    /// Fired when a rail entry is pressed (Vue: `update:section`); the host
    /// writes the key back into `section`.
    pub on_section_change: Option<EventHandler<String>>,

    /// The ACTIVE section's pane content (Vue: the per-section slots — see
    /// the header deltas).
    pub children: Element,
}

/// HkSettingsBody — the sectioned shell, standalone (page-embeddable).
#[component]
pub fn SettingsBody(props: SettingsBodyProps) -> Element {
    let active = settings_active_section(&props.sections, props.section.as_deref());

    let mut root = VElement::new("div").class("hk-settings");
    // Vue: `data-phone={isMobile || undefined}` — present (empty) on phone
    // only; the sheet's `[data-phone]` column layout keys on PRESENCE, so a
    // desktop root must carry no attribute at all.
    if props.phone {
        root = root.attr("data-phone", "");
    }
    if !props.style.is_empty() {
        root = root.style(props.style.as_str());
    }

    // The nav band: the desktop rail, or the phone topnav strip (same
    // buttons — see the header deltas for the HTabs substitution).
    let nav = if props.phone {
        VElement::new("div").class("hk-settings__topnav")
    } else {
        let mut rail = VElement::new("nav")
            .class("hk-settings__rail")
            .style(SETTINGS_RAIL_STYLE);
        if let Some(label) = props.nav_label.as_deref().filter(|text| !text.is_empty()) {
            rail = rail.attr("aria-label", label);
        }
        rail
    };
    let mut nav = nav;
    for section in &props.sections {
        let on = active == section.key && !section.disabled;
        nav = nav.child(settings_rail_button(section, on, &props.on_section_change));
    }
    root = root.child(el(nav));

    let pane = VElement::new("div")
        .class("hk-settings__pane")
        .style(SETTINGS_PANE_STYLE)
        .child(props.children.clone());
    el(root.child(el(pane)))
}

#[define_props]
pub struct SettingsDialogProps {
    /// Controlled open state (Vue: `modelValue`).
    #[default]
    pub open: bool,

    /// Modal title (Vue default `""`).
    #[default]
    pub title: String,

    /// Modal max-width (CSS value or HkModal preset; Vue default `"58rem"`).
    #[default("58rem".to_string())]
    pub width: String,

    /// Rail entries — passed through to the body.
    #[default]
    pub sections: Vec<SettingsSection>,

    /// Active section key (Vue: `v-model:section`).
    pub section: Option<String>,

    /// Accessible name for the rail navigation.
    pub nav_label: Option<String>,

    /// Shell height — the stable frame the pane scrolls inside (Vue
    /// default `"calc(70vh - 6.5rem)"`).
    #[default("calc(70vh - 6.5rem)".to_string())]
    pub height: String,

    /// Host-decided phone layout (forwarded to the body).
    #[default]
    pub phone: bool,

    /// The ACTIVE section's pane content.
    pub children: Element,

    /// Fired when the user asks to close (Vue: `update:modelValue`).
    pub on_open_change: Option<EventHandler<bool>>,

    /// Fired when a rail entry is pressed (Vue: `update:section`); the host
    /// writes the key back into `section`.
    pub on_section_change: Option<EventHandler<String>>,
}

/// HkSettingsDialog — the settings window: an HModal carrying the body with
/// a stable frame height, so the modal body's scroller stays idle and the
/// pane is the only scrollbar (the sheet's `hk-settings-host` rules).
#[component]
pub fn SettingsDialog(props: SettingsDialogProps) -> Element {
    if !props.open {
        return empty_vnode();
    }

    let on_open_change = props.on_open_change.clone();
    let on_close = Some(event_handler(move |_event: MouseEvent| {
        if let Some(handler) = on_open_change.as_ref() {
            handler.call(false);
        }
    }));

    Modal(ModalProps {
        open: true,
        title: Some(props.title.clone()),
        width: props.width.clone(),
        content_class: "hk-settings-host".to_string(),
        on_close,
        children: SettingsBody(SettingsBodyProps {
            sections: props.sections.clone(),
            section: props.section.clone(),
            nav_label: props.nav_label.clone(),
            phone: props.phone,
            style: settings_height_style(&props.height),
            children: props.children.clone(),
            on_section_change: props.on_section_change.clone(),
        }),
        ..Default::default()
    })
}

/// HkSettingsGroup — one titled card in the content pane (Vue:
/// `HkSettingsGroup`); the rendering lives in the pure
/// [`settings_group_node`] so hosts can build the same card off-tree.
pub fn settings_group_node(title: Option<&str>, children: VNode) -> VNode {
    let mut group = VElement::new("section").class("hk-settings-group");
    // Vue: `props.title ? <h3>…` — an empty string title renders no heading.
    if let Some(title) = title.filter(|text| !text.is_empty()) {
        group = group.child(el(VElement::new("h3")
            .class("hk-settings-group-title")
            .child(VNode::Text(VText::new(title)))));
    }
    el(group.child(children))
}

#[define_props]
pub struct SettingsGroupProps {
    pub title: Option<String>,
    pub children: Element,
}

#[component]
pub fn SettingsGroup(props: SettingsGroupProps) -> Element {
    settings_group_node(props.title.as_deref(), props.children.clone())
}

/// HkSettingsSub — a titled sub-block inside a group (Vue: `HkSettingsSub`);
/// pure renderer [`settings_sub_node`].
pub fn settings_sub_node(title: Option<&str>, children: VNode) -> VNode {
    let mut sub = VElement::new("div").class("hk-settings-sub");
    if let Some(title) = title.filter(|text| !text.is_empty()) {
        sub = sub.child(el(VElement::new("h4")
            .class("hk-settings-sub-title")
            .child(VNode::Text(VText::new(title)))));
    }
    el(sub.child(children))
}

#[define_props]
pub struct SettingsSubProps {
    pub title: Option<String>,
    pub children: Element,
}

#[component]
pub fn SettingsSub(props: SettingsSubProps) -> Element {
    settings_sub_node(props.title.as_deref(), props.children.clone())
}

/// HkSettingsHint — the small muted explanation line under a control (Vue:
/// `HkSettingsHint`); pure renderer [`settings_hint_node`].
pub fn settings_hint_node(children: VNode) -> VNode {
    el(VElement::new("p").class("hk-settings-hint").child(children))
}

#[define_props]
pub struct SettingsHintProps {
    pub children: Element,
}

#[component]
pub fn SettingsHint(props: SettingsHintProps) -> Element {
    settings_hint_node(props.children.clone())
}

impl StyledComponent for SettingsDialogComponent {
    fn styles() -> &'static str {
        // The canonical Vue sheet, compiled verbatim (no_hash keeps the
        // `.hk-settings*` names literal so this CSS matches Vue).
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkSettingsDialog.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "settings-dialog"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sections() -> Vec<SettingsSection> {
        vec![
            SettingsSection {
                key: "locked".to_string(),
                label: "Locked".to_string(),
                disabled: true,
                ..Default::default()
            },
            SettingsSection {
                key: "general".to_string(),
                label: "General".to_string(),
                ..Default::default()
            },
            SettingsSection {
                key: "network".to_string(),
                label: "Network".to_string(),
                ..Default::default()
            },
        ]
    }

    #[test]
    fn settings_first_usable_never_lands_on_a_disabled_section() {
        assert_eq!(settings_first_usable(&sections()), "general");
        // All disabled → the empty fallback (nothing can activate).
        let all_disabled = vec![SettingsSection {
            key: "a".to_string(),
            disabled: true,
            ..Default::default()
        }];
        assert_eq!(settings_first_usable(&all_disabled), "");
        assert_eq!(settings_first_usable(&[]), "");
    }

    #[test]
    fn settings_activation_guard_matches_the_vue_watch() {
        assert!(settings_section_activatable(&sections(), "general"));
        // A disabled key never activates, unknown keys neither.
        assert!(!settings_section_activatable(&sections(), "locked"));
        assert!(!settings_section_activatable(&sections(), "nope"));
        assert!(!settings_section_activatable(&[], "general"));
    }

    #[test]
    fn settings_active_section_resolves_like_vue() {
        // Unbound → first usable (never the disabled head).
        assert_eq!(settings_active_section(&sections(), None), "general");
        // A usable deep link wins.
        assert_eq!(
            settings_active_section(&sections(), Some("network")),
            "network"
        );
        // A disabled (or unknown) deep link keeps the first usable section.
        assert_eq!(
            settings_active_section(&sections(), Some("locked")),
            "general"
        );
        assert_eq!(
            settings_active_section(&sections(), Some("nope")),
            "general"
        );
    }

    #[test]
    fn settings_phone_layout_follows_the_family_breakpoint() {
        assert!(settings_phone_layout(0));
        assert!(settings_phone_layout(767));
        assert!(!settings_phone_layout(768));
        assert!(!settings_phone_layout(1440));
    }

    #[test]
    fn settings_class_and_style_helpers_match_vue() {
        assert_eq!(settings_rail_item_classes(false), "hk-settings__rail-item");
        assert_eq!(
            settings_rail_item_classes(true),
            "hk-settings__rail-item is-active"
        );
        assert_eq!(
            settings_height_style("calc(70vh - 6.5rem)"),
            "--hk-settings-height:calc(70vh - 6.5rem)"
        );
    }

    #[test]
    fn settings_group_sub_hint_nodes_match_vue() {
        let group = settings_group_node(Some("Appearance"), empty_vnode()).render_to_html();
        assert!(group.contains(r#"class="hk-settings-group""#), "{group}");
        assert!(group.contains("hk-settings-group-title"), "{group}");
        assert!(group.contains("Appearance"), "{group}");
        // An empty title renders no heading (Vue's truthiness test).
        let bare = settings_group_node(Some(""), empty_vnode()).render_to_html();
        assert!(!bare.contains("hk-settings-group-title"), "{bare}");
        let bare = settings_group_node(None, empty_vnode()).render_to_html();
        assert!(!bare.contains("hk-settings-group-title"), "{bare}");

        let sub = settings_sub_node(Some("Advanced"), empty_vnode()).render_to_html();
        assert!(sub.contains(r#"class="hk-settings-sub""#), "{sub}");
        assert!(sub.contains("hk-settings-sub-title"), "{sub}");
        let bare = settings_sub_node(None, empty_vnode()).render_to_html();
        assert!(!bare.contains("hk-settings-sub-title"), "{bare}");

        let hint = settings_hint_node(VNode::Text(VText::new("Restart to apply"))).render_to_html();
        assert!(hint.contains(r#"class="hk-settings-hint""#), "{hint}");
        assert!(hint.contains("Restart to apply"), "{hint}");
    }

    #[test]
    fn settings_defaults_match_the_vue_props() {
        let dialog = SettingsDialogProps::default();
        assert!(!dialog.open);
        assert_eq!(dialog.title, "");
        assert_eq!(dialog.width, "58rem");
        assert!(dialog.sections.is_empty());
        assert!(dialog.section.is_none());
        assert!(dialog.nav_label.is_none());
        assert_eq!(dialog.height, "calc(70vh - 6.5rem)");
        assert!(!dialog.phone);
        assert!(dialog.on_open_change.is_none());
        assert!(dialog.on_section_change.is_none());

        let body = SettingsBodyProps::default();
        assert!(body.sections.is_empty());
        assert!(body.section.is_none());
        assert!(body.nav_label.is_none());
        assert!(!body.phone);
        assert_eq!(body.style, "");
    }

    #[test]
    fn settings_dialog_renders_the_modal_window_and_the_rail() {
        let html = SettingsDialog(SettingsDialogProps {
            open: true,
            title: "Settings".to_string(),
            nav_label: Some("Settings sections".to_string()),
            sections: sections(),
            section: Some("network".to_string()),
            children: rsx! {
                div { class: "pane-body", "Network pane" }
            },
            ..Default::default()
        })
        .render_to_html();
        for needle in [
            // The Modal shell with the settings host class and frame height.
            r#"class="hk-modal-root""#,
            r#"aria-label="Settings""#,
            "hk-modal-content hk-settings-host",
            "--hk-settings-height:calc(70vh - 6.5rem)",
            // The rail: every entry renders, the disabled one is marked.
            r#"class="hk-settings__rail""#,
            r#"aria-label="Settings sections""#,
            "hk-settings__rail-item",
            "hk-settings__rail-label",
            ">General<",
            ">Locked<",
            r#"aria-disabled="true""#,
            "disabled=\"disabled\"",
            // The active section is framed and marked current.
            "hk-settings__rail-item is-active",
            r#"aria-current="true""#,
            ">Network<",
            // The pane carries the host content.
            r#"class="hk-settings__pane""#,
            "Network pane",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        // Desktop: no phone band, no data-phone (presence-keyed layout).
        assert!(!html.contains("data-phone"), "{html}");
        assert!(!html.contains("hk-settings__topnav"), "{html}");
        // Exactly one active entry, and it is Network's — the disabled head
        // must never win the landing default.
        assert_eq!(html.matches("is-active").count(), 1, "{html}");
        let active = html.find("is-active").expect("an active entry");
        let locked = html.find(">Locked<").expect("the locked entry");
        let network = html.find(">Network<").expect("the active label");
        assert!(
            locked < active,
            "the disabled head must never be the active one: {html}"
        );
        assert!(
            active < network,
            "the active class must sit on Network's button: {html}"
        );
    }

    #[test]
    fn settings_body_phone_flips_to_the_topnav_band() {
        let html = SettingsBody(SettingsBodyProps {
            sections: sections(),
            phone: true,
            children: empty_vnode(),
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains(r#"data-phone="""#), "{html}");
        assert!(html.contains(r#"class="hk-settings__topnav""#), "{html}");
        // The strip still renders the same rail buttons.
        assert!(html.contains("hk-settings__rail-item"), "{html}");
        assert!(html.contains(">General<"), "{html}");
        assert!(!html.contains(r#"<nav"#), "{html}");
    }

    #[test]
    fn settings_rail_press_flows_out_through_the_guard() {
        use std::cell::Cell;
        use std::rc::Rc;
        let picked: Rc<Cell<usize>> = Rc::new(Cell::new(0));
        let counter = Rc::clone(&picked);
        let node = SettingsBody(SettingsBodyProps {
            sections: sections(),
            on_section_change: Some(EventHandler::new(move |_key: String| {
                counter.set(counter.get() + 1);
            })),
            children: empty_vnode(),
            ..Default::default()
        });
        // Walk the tree and INVOKE the rail buttons' click listeners: the
        // disabled entry must stay inert, the usable one must flow out.
        fn click_rail(node: &Element, label: &str, should_emit: bool, hits: &Cell<usize>) {
            match node {
                VNode::Element(element) => {
                    let is_button = element.tag == "button"
                        && element
                            .children
                            .iter()
                            .any(|child| child.render_to_html().contains(label));
                    if is_button {
                        let before = hits.get();
                        let handler = element.event_handlers.get("click").expect("wired");
                        handler.borrow_mut()(
                            Box::new(MouseEvent::default()) as Box<dyn tairitsu_vdom::EventData>
                        );
                        assert_eq!(
                            hits.get() - before,
                            if should_emit { 1 } else { 0 },
                            "the {label} press must be guarded"
                        );
                        return;
                    }
                    for child in &element.children {
                        click_rail(child, label, should_emit, hits);
                    }
                }
                VNode::Fragment(children) => {
                    for child in children {
                        click_rail(child, label, should_emit, hits);
                    }
                }
                _ => {}
            }
        }
        click_rail(&node, "Locked", false, &picked);
        click_rail(&node, "Network", true, &picked);
        assert_eq!(picked.get(), 1, "only the usable entry emits");
    }

    #[test]
    fn settings_dialog_closed_renders_nothing() {
        let html = SettingsDialog(SettingsDialogProps {
            sections: sections(),
            children: empty_vnode(),
            ..Default::default()
        })
        .render_to_html();
        assert!(html.is_empty(), "a closed dialog mounts nothing: {html}");
    }

    #[test]
    fn settings_dialog_styles_come_from_the_canonical_vue_sheet() {
        let css = SettingsDialogComponent::styles();
        for needle in [
            ".hk-settings",
            ".hk-settings__rail-item",
            ".hk-settings__pane",
            ".hk-settings-host .hk-settings",
            ".hk-settings-group",
            ".hk-settings-sub",
            ".hk-settings-hint",
        ] {
            assert!(
                css.contains(needle),
                "settings css must carry {needle}: {css}"
            );
        }
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored settings sheet"
        );
        assert_eq!(SettingsDialogComponent::name(), "settings-dialog");
    }
}
