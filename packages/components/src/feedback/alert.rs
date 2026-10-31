// hi-components/src/feedback/alert.rs
// Alert — mirror of the canonical Vue `HkAlert`.
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkAlert.scss`, vendored under
// `src/styles/vue-mirror/`), compiled with `no_hash` so the `.hk-alert*`
// class names are literal and identical in both forms. The DOM contract
// below mirrors the Vue render output one-to-one:
//
//   div.hk-alert .hk-alert-{variant} .hk-alert-{size} [.hk-alert-banner]
//                [.hk-alert-no-title]      (style: --hk-pad override)
//     span.hk-alert-icon        → slot `icon` or the variant default icon
//     div.hk-alert-body
//       p.hk-alert-title        → optional
//       p.hk-alert-text         → body slot or the `message` prop
//     button.hk-alert-close     → when `closable` (X icon, aria-label)
//
// Dismissal is uncontrolled in Vue: the ✕ hides THIS instance locally and
// emits `close` (no v-model); reopening requires remounting at the call
// site. Replaces the retired legacy implementation (Glow-wrapped `--hi-*`
// variant, `description` prop, wrong default variant).

use hikari_i18n::t;
use hikari_icons::{Icon, MdiIcon};

use crate::prelude::*;
use crate::styled::StyledComponent;
use crate::utils::{HkPad, hk_pad_style};

pub struct AlertComponent;

/// The four semantic variants. Vue default is `error`.
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum AlertVariant {
    #[default]
    Error,
    Warning,
    Info,
    Success,
}

impl AlertVariant {
    /// The `hk-alert-{variant}` modifier class exactly as Vue emits it.
    pub fn class_name(self) -> &'static str {
        match self {
            AlertVariant::Error => "hk-alert-error",
            AlertVariant::Warning => "hk-alert-warning",
            AlertVariant::Info => "hk-alert-info",
            AlertVariant::Success => "hk-alert-success",
        }
    }

    /// The default icon per variant. Delta vs Vue (documented): success
    /// renders `Check` — the packed MDI set has no `CheckCircle`.
    pub fn default_icon(self) -> MdiIcon {
        match self {
            AlertVariant::Error | AlertVariant::Warning => MdiIcon::AlertTriangle,
            AlertVariant::Info => MdiIcon::Information,
            AlertVariant::Success => MdiIcon::Check,
        }
    }
}

/// The three sizes: `hk-alert-sm` / `-md` / `-lg` (Vue default `md`).
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum AlertSize {
    Sm,
    #[default]
    Md,
    Lg,
}

impl AlertSize {
    /// The `hk-alert-{size}` modifier class exactly as Vue emits it.
    pub fn class_name(self) -> &'static str {
        match self {
            AlertSize::Sm => "hk-alert-sm",
            AlertSize::Md => "hk-alert-md",
            AlertSize::Lg => "hk-alert-lg",
        }
    }
}

#[define_props]
pub struct AlertProps {
    /// Semantic variant; also picks the default icon and the ink color.
    #[default]
    pub variant: AlertVariant,

    /// Body text (Vue: `message`, required). The `body` slot wins when
    /// provided.
    #[default]
    pub message: String,

    /// Optional bold heading above the body (`hk-alert-title`).
    pub title: Option<String>,

    /// Render the ✕ button; clicking hides this instance and fires
    /// [`AlertProps::on_close`].
    #[default]
    pub closable: bool,

    /// Full-width banner presentation (`hk-alert-banner`).
    #[default]
    pub banner: bool,

    /// Size step (`hk-alert-{size}`).
    #[default]
    pub size: AlertSize,

    /// Shared container-padding override (`--hk-pad`; see `utils::pad`).
    pub padding: Option<HkPad>,

    /// Icon slot: replaces the per-variant default icon.
    pub icon: Option<Element>,

    /// Body slot (Vue: the default slot). When `Some`, it replaces the
    /// `message` text.
    pub body: Option<Element>,

    /// Keep rendering the alert (Vue: the uncontrolled local dismissal flag;
    /// see the file-header delta — the host owns this on the Rust side).
    #[default(true)]
    pub visible: bool,

    /// Fired when the ✕ button is clicked; the host flips `visible`.
    pub on_close: Option<EventHandler<MouseEvent>>,

    #[default]
    pub class: String,
}

#[component]
pub fn Alert(props: AlertProps) -> Element {
    // Delta vs Vue (documented): tairitsu 0.5.22 has no per-instance
    // component state (`use_signal` allocates per render; `use_state` shares
    // ONE slot per component type), so the uncontrolled local dismissal flag
    // becomes a CONTROLLED `visible` prop: the ✕ still fires `on_close` and
    // the host flips `visible` (or unmounts the alert).
    let dismissed = !props.visible;

    let root_classes = {
        let mut classes = String::from("hk-alert");
        classes.push(' ');
        classes.push_str(props.variant.class_name());
        classes.push(' ');
        classes.push_str(props.size.class_name());
        if props.banner {
            classes.push(' ');
            classes.push_str("hk-alert-banner");
        }
        if props.title.as_deref().map(str::is_empty).unwrap_or(true) {
            classes.push(' ');
            classes.push_str("hk-alert-no-title");
        }
        if !props.class.is_empty() {
            classes.push(' ');
            classes.push_str(&props.class);
        }
        classes
    };

    // Vue: the slot icon replaces the default; the default rides the
    // `.hk-alert-icon` span either way.
    let icon = match props.icon {
        Some(ref custom) => custom.clone(),
        None => rsx! {
            Icon {
                icon: props.variant.default_icon(),
                size: 18,
            }
        },
    };

    // Vue: `body` (default slot) wins over `message`.
    let body = match props.body {
        Some(ref slot) => slot.clone(),
        None => VNode::Text(VText::new(&props.message)),
    };

    let root_style = hk_pad_style(props.padding);
    let on_close_handler = props.on_close.clone();

    rsx! {
        if !dismissed {
            div {
                class: root_classes,
                style: root_style,
                span { class: "hk-alert-icon",
                    {icon}
                }
                div { class: "hk-alert-body",
                    if let Some(ref title) = props.title {
                        if !title.is_empty() {
                            p { class: "hk-alert-title",
                                "{title}"
                            }
                        }
                    }
                    p { class: "hk-alert-text",
                        {body}
                    }
                }
                if props.closable {
                    button {
                        class: "hk-alert-close",
                        "type": "button",
                        "aria-label": t("hikari::alert.close", "Close"),
                        onclick: move |_| {
                            if let Some(handler) = on_close_handler.as_ref() {
                                handler.call(MouseEvent::default());
                            }
                        },
                        Icon {
                            icon: MdiIcon::Close,
                            size: 14,
                        }
                    }
                }
            }
        }
    }
}

impl StyledComponent for AlertComponent {
    fn styles() -> &'static str {
        // The canonical Vue sheet, compiled verbatim (no_hash keeps the
        // `.hk-alert*` names literal so this CSS matches the Vue build).
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkAlert.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "alert"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn alert_variant_class_names_match_the_vue_modifiers() {
        assert_eq!(AlertVariant::Error.class_name(), "hk-alert-error");
        assert_eq!(AlertVariant::Warning.class_name(), "hk-alert-warning");
        assert_eq!(AlertVariant::Info.class_name(), "hk-alert-info");
        assert_eq!(AlertVariant::Success.class_name(), "hk-alert-success");
    }

    #[test]
    fn alert_size_class_names_match_the_vue_modifiers() {
        assert_eq!(AlertSize::Sm.class_name(), "hk-alert-sm");
        assert_eq!(AlertSize::Md.class_name(), "hk-alert-md");
        assert_eq!(AlertSize::Lg.class_name(), "hk-alert-lg");
    }

    #[test]
    fn alert_defaults_match_the_vue_props() {
        let props = AlertProps::default();
        // Vue default variant is "error" (not the legacy Rust "info").
        assert_eq!(props.variant, AlertVariant::Error);
        assert_eq!(props.size, AlertSize::Md);
        assert!(!props.closable);
        assert!(!props.banner);
        assert!(props.title.is_none());
        assert!(props.padding.is_none());
        assert!(props.body.is_none());
        assert!(props.on_close.is_none());
    }

    #[test]
    fn alert_variant_default_icons() {
        // Delta vs Vue (documented): the packed MDI set has no CheckCircle,
        // so success falls to Check; error/warning share AlertTriangle.
        assert_eq!(AlertVariant::Error.default_icon(), MdiIcon::AlertTriangle);
        assert_eq!(AlertVariant::Warning.default_icon(), MdiIcon::AlertTriangle);
        assert_eq!(AlertVariant::Info.default_icon(), MdiIcon::Information);
        assert_eq!(AlertVariant::Success.default_icon(), MdiIcon::Check);
    }

    #[test]
    fn alert_styles_come_from_the_canonical_vue_sheet() {
        let css = AlertComponent::styles();
        assert!(
            css.contains(".hk-alert") && css.contains(".hk-alert-body"),
            "alert css must carry the vue classes"
        );
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored alert sheet"
        );
        // The legacy sheet's Glow wrapper hook must be gone with it.
        assert!(
            !css.contains("hk-alert-glow-wrapper"),
            "legacy glow wrapper hook is retired"
        );
    }
}
