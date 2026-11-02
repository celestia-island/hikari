// hi-components/src/theme/splash.rs
// Splash — mirror of the canonical Vue `HkSplash` (the full-viewport
// branding splash: logo, title, subtitle, status badge, actions, footer).
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkSplash.scss`, vendored under
// `src/styles/vue-mirror/` and guarded by `tests/vue_mirror_drift_tests.rs`),
// compiled with `no_hash` so the `.hk-splash*` class names are literal and
// identical in both forms. The sheet carries NO animation classes at all
// (no `@keyframes`, no `transition` — checked, not assumed): the splash is
// a static composition, so the mirror has no animation state to host.
//
// DOM contract (mirrors the Vue render output one-to-one):
//
//   div.hk-splash
//     main.hk-splash-main
//       img.hk-splash-logo [src alt]            (logo set)
//       h1.hk-splash-title {title | title slot} (title prop wins)
//       p.hk-splash-subtitle {subtitle}         (subtitle set)
//       div.hk-splash-description {slot}        (description slot set)
//       div.hk-splash-status
//         Badge(variant=statusVariant[status], size=md) {statusLabel | status}
//       div.hk-splash-actions {slot}            (actions slot set)
//     footer.hk-splash-footer {slot}            (footer slot set)
//
// Vue prop mapping: `logo`/`title`/`subtitle` are falsy-checked strings
// (`props.logo ? …`), so the mirror models them as `Option<String>` where
// `None` and `Some("")` both render nothing — exactly Vue's truthiness.
// `statusLabel || props.status` keeps the same shape: an empty
// `status_label` falls back to the raw status token.
//
// The status → badge-variant table is Vue's `statusVariant` record plus its
// `|| "primary"` guard ([`splash_badge_variant`] takes the RAW string, so a
// host-typo status still lands on the primary badge exactly like Vue); the
// typed [`SplashStatus`] enum is the four tokens the record knows.
//
// The badge face is the MIRRORED `basic::badge::Badge` (Vue composes
// `HkBadge`); the mirror passes the variant/size straight through, so the
// `.hk-badge*` contract is owned by that file, not duplicated here.

use hikari_i18n::t;

use crate::basic::badge::{Badge, BadgeProps, BadgeSize, BadgeVariant};
use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct SplashComponent;

/// The four status tokens (Vue: `"online" | "offline" | "loading" |
/// "coming-soon"`, default `coming-soon`).
#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum SplashStatus {
    Online,
    Offline,
    Loading,
    #[default]
    ComingSoon,
}

impl SplashStatus {
    /// The raw token exactly as Vue prints it into the badge when no
    /// `statusLabel` is set (`{props.statusLabel || props.status}`).
    pub fn as_str(self) -> &'static str {
        match self {
            SplashStatus::Online => "online",
            SplashStatus::Offline => "offline",
            SplashStatus::Loading => "loading",
            SplashStatus::ComingSoon => "coming-soon",
        }
    }

    /// Parse one of the four known tokens; anything else is `None` (the
    /// caller then applies Vue's `statusVariant[s] || "primary"` guard via
    /// [`splash_badge_variant`], which takes the raw string).
    pub fn parse(raw: &str) -> Option<Self> {
        match raw {
            "online" => Some(SplashStatus::Online),
            "offline" => Some(SplashStatus::Offline),
            "loading" => Some(SplashStatus::Loading),
            "coming-soon" => Some(SplashStatus::ComingSoon),
            _ => None,
        }
    }
}

/// Vue's `statusVariant` record + its `|| "primary"` fallback, as one pure
/// step over the RAW status string: online→success, offline→error,
/// loading→warning, coming-soon→primary, unknown→primary.
pub fn splash_badge_variant(raw: &str) -> BadgeVariant {
    match SplashStatus::parse(raw) {
        Some(SplashStatus::Online) => BadgeVariant::Success,
        Some(SplashStatus::Offline) => BadgeVariant::Error,
        Some(SplashStatus::Loading) => BadgeVariant::Warning,
        Some(SplashStatus::ComingSoon) | None => BadgeVariant::Primary,
    }
}

/// The badge's text content: `props.statusLabel || props.status` — an empty
/// label falls back to the raw status token.
pub fn splash_status_text(status: SplashStatus, status_label: &str) -> String {
    if status_label.is_empty() {
        status.as_str().to_string()
    } else {
        status_label.to_string()
    }
}

/// The logo image's `alt`: `props.title || t("hikari::logo.fallbackAlt")`.
/// The Rust bundle already carries the key as
/// `components.hk.logo.fallbackAlt` (English `"Logo"`, Vue's own literal).
pub fn splash_logo_alt(title: Option<&str>) -> String {
    match title {
        Some(title) if !title.is_empty() => title.to_string(),
        _ => t("components.hk.logo.fallbackAlt", "Logo"),
    }
}

#[define_props]
pub struct SplashProps {
    /// Logo image source; `None`/empty skips the `img` entirely.
    pub logo: Option<String>,

    /// Heading text; wins over the `title` slot (Vue: `props.title ||`).
    pub title: Option<String>,

    /// Subtitle line; `None`/empty skips the `p`.
    pub subtitle: Option<String>,

    #[default]
    pub status: SplashStatus,

    /// Badge text override (Vue default `""` → falls back to the token).
    #[default]
    pub status_label: String,

    /// Heading fallback (Vue: the `title` slot).
    pub title_slot: Option<Element>,

    /// Extra copy under the subtitle (Vue: the `description` slot).
    pub description: Option<Element>,

    /// Action row under the status badge (Vue: the `actions` slot).
    pub actions: Option<Element>,

    /// Bottom band content (Vue: the `footer` slot).
    pub footer: Option<Element>,
}

#[component]
pub fn Splash(props: SplashProps) -> Element {
    // Vue's truthiness gates: `props.logo ?` / `props.subtitle ?` treat an
    // EMPTY string like an absent prop, so the mirror filters both to None.
    let logo = props.logo.clone().filter(|logo| !logo.is_empty());
    let title = props.title.clone().filter(|title| !title.is_empty());
    let subtitle = props
        .subtitle
        .clone()
        .filter(|subtitle| !subtitle.is_empty());
    let logo_alt = splash_logo_alt(props.title.as_deref());

    let badge = Badge(BadgeProps {
        variant: splash_badge_variant(props.status.as_str()),
        size: BadgeSize::Md,
        children: rsx! {
            {splash_status_text(props.status, &props.status_label)}
        },
        ..Default::default()
    });

    rsx! {
        div { class: "hk-splash",
            main { class: "hk-splash-main",
                if let Some(logo) = &logo {
                    img {
                        class: "hk-splash-logo",
                        src: logo.clone(),
                        alt: logo_alt.clone(),
                    }
                }
                // Vue: `<h1>{props.title || slots.title?.()}</h1>` — the h1
                // always renders; the title prop wins over the slot.
                h1 { class: "hk-splash-title",
                    if let Some(title) = &title {
                        {title.clone()}
                    } else if let Some(slot) = &props.title_slot {
                        {slot.clone()}
                    }
                }
                if let Some(subtitle) = &subtitle {
                    p { class: "hk-splash-subtitle", {subtitle.clone()} }
                }
                if let Some(description) = &props.description {
                    div { class: "hk-splash-description", {description.clone()} }
                }
                div { class: "hk-splash-status",
                    {badge}
                }
                if let Some(actions) = &props.actions {
                    div { class: "hk-splash-actions", {actions.clone()} }
                }
            }
            if let Some(footer) = &props.footer {
                footer { class: "hk-splash-footer", {footer.clone()} }
            }
        }
    }
}

impl StyledComponent for SplashComponent {
    fn styles() -> &'static str {
        // The canonical Vue sheet, compiled verbatim (no_hash keeps the
        // `.hk-splash*` names literal so this CSS matches the Vue build).
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkSplash.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "splash"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn splash_defaults_match_the_vue_props() {
        let props = SplashProps::default();
        assert_eq!(props.status, SplashStatus::ComingSoon);
        assert_eq!(props.status_label, "");
        assert!(props.logo.is_none());
        assert!(props.title.is_none());
        assert!(props.subtitle.is_none());
        assert!(props.title_slot.is_none());
        assert!(props.description.is_none());
        assert!(props.actions.is_none());
        assert!(props.footer.is_none());
    }

    #[test]
    fn splash_status_table_is_vues_statusvariant_record() {
        assert_eq!(
            splash_badge_variant("online"),
            BadgeVariant::Success,
            "online → success"
        );
        assert_eq!(
            splash_badge_variant("offline"),
            BadgeVariant::Error,
            "offline → error"
        );
        assert_eq!(
            splash_badge_variant("loading"),
            BadgeVariant::Warning,
            "loading → warning"
        );
        assert_eq!(
            splash_badge_variant("coming-soon"),
            BadgeVariant::Primary,
            "coming-soon → primary"
        );
        // The `|| "primary"` guard: a status the record does not know still
        // lands on the primary badge, exactly like Vue.
        assert_eq!(splash_badge_variant("typo"), BadgeVariant::Primary);
    }

    #[test]
    fn splash_status_tokens_round_trip_and_default() {
        assert_eq!(SplashStatus::default(), SplashStatus::ComingSoon);
        assert_eq!(
            SplashStatus::parse("coming-soon"),
            Some(SplashStatus::ComingSoon)
        );
        assert_eq!(SplashStatus::parse("online"), Some(SplashStatus::Online));
        assert_eq!(SplashStatus::parse("offline"), Some(SplashStatus::Offline));
        assert_eq!(SplashStatus::parse("loading"), Some(SplashStatus::Loading));
        assert_eq!(SplashStatus::parse("nope"), None);
        assert_eq!(SplashStatus::Loading.as_str(), "loading");
    }

    #[test]
    fn splash_status_text_follows_statuslabel_or_status() {
        assert_eq!(
            splash_status_text(SplashStatus::ComingSoon, ""),
            "coming-soon",
            "empty label falls back to the raw token"
        );
        assert_eq!(
            splash_status_text(SplashStatus::Online, "All systems go"),
            "All systems go"
        );
    }

    #[test]
    fn splash_logo_alt_prefers_the_title_then_the_locale_fallback() {
        assert_eq!(splash_logo_alt(Some("Celestia")), "Celestia");
        // Vue's `props.title ||` is truthiness: an EMPTY title falls through.
        assert_eq!(splash_logo_alt(Some("")), "Logo");
        assert_eq!(splash_logo_alt(None), "Logo");
    }

    #[test]
    fn splash_renders_the_vue_dom_contract() {
        let html = Splash(SplashProps::default()).render_to_html();
        for needle in [
            r#"class="hk-splash""#,
            r#"class="hk-splash-main""#,
            r#"class="hk-splash-title""#,
            r#"class="hk-splash-status""#,
            // Default status → the primary badge, md size, raw token text.
            r#"class="hk-badge hk-badge-primary""#,
            r#"data-size="md""#,
            ">coming-soon<",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        // Nothing was passed: the optional boxes stay absent.
        for absent in [
            "hk-splash-logo",
            "hk-splash-subtitle",
            "hk-splash-description",
            "hk-splash-actions",
            "hk-splash-footer",
        ] {
            assert!(!html.contains(absent), "{absent} must not render: {html}");
        }
    }

    #[test]
    fn splash_renders_every_optional_box_when_fed() {
        let html = Splash(SplashProps {
            logo: Some("/brand.png".to_string()),
            title: Some("Celestia".to_string()),
            subtitle: Some("the island".to_string()),
            status: SplashStatus::Online,
            status_label: "Online".to_string(),
            description: Some(rsx! { { "desc" } }),
            actions: Some(rsx! { { "act" } }),
            footer: Some(rsx! { { "foot" } }),
            ..Default::default()
        })
        .render_to_html();

        for needle in [
            // Attributes serialize sorted (alt, src), then class; img is void.
            r#"<img alt="Celestia" src="/brand.png" class="hk-splash-logo">"#,
            ">Celestia<",
            r#"class="hk-splash-subtitle""#,
            r#"class="hk-splash-description""#,
            r#"class="hk-splash-actions""#,
            r#"class="hk-splash-footer""#,
            r#"class="hk-badge hk-badge-success""#,
            ">Online<",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
    }

    #[test]
    fn splash_styles_come_from_the_canonical_vue_sheet() {
        let css = SplashComponent::styles();
        for class_name in [
            ".hk-splash",
            ".hk-splash-main",
            ".hk-splash-logo",
            ".hk-splash-title",
            ".hk-splash-subtitle",
            ".hk-splash-description",
            ".hk-splash-status",
            ".hk-splash-actions",
            ".hk-splash-footer",
        ] {
            assert!(
                css.contains(class_name),
                "splash css must come from the vue-mirror sheet (missing {class_name})"
            );
        }
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored splash sheet"
        );
        // The sheet carries no animation classes (verified against the
        // canonical source): the guard keeps that a stated fact, not luck.
        assert!(!css.contains("@keyframes"), "splash sheet is static");
        assert!(!css.contains("animation"), "splash sheet is static");
    }
}
