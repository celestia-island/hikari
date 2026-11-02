// hi-components/src/theme/logo.rs
// Logo — mirror of the canonical Vue `HkLogo` (the brand mark: image, or a
// tone-filled placeholder carrying the initial / a layers glyph).
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkLogo.scss`, vendored under
// `src/styles/vue-mirror/` and guarded by `tests/vue_mirror_drift_tests.rs`),
// compiled with `no_hash` so the `.hk-logo*` class names are literal and
// identical in both forms.
//
// DOM contract (mirrors the Vue render output one-to-one):
//
//   a.hk-logo [href=safeHref(href) style="line-height:0" onclick]   (href set)
//   div.hk-logo [style="line-height:0" onclick]                     (otherwise)
//     img.hk-logo-img [src alt] (style: width/height = size)        (src set)
//     div.hk-logo-placeholder [role=img aria-label] (style: …)      (otherwise)
//       span.hk-logo-initial {alt[0] upper-cased}                   (alt set)
//       span[style=display:contents][dangerous_inner_html=<svg …>]  (no alt)
//
// Vue prop mapping: `src` is truthy-checked (`props.src ?`), so `None` and
// `Some("")` both take the placeholder branch. `alt` stays a plain string
// (Vue default `""`, rendered verbatim as the img `alt`). `size` resolves
// through the `sizeMap` record with its `?? sizeMap.md` guard
// ([`logo_size_from_str`] takes the RAW string; the typed [`LogoSize`] is
// the five tokens the record knows). `href` runs through `safeHref` — the
// mirror REUSES `layout::nav_item::safe_href` (the same audited port of
// `utils/safeHref.ts`) instead of forking the scheme allowlist.
//
// The placeholder glyph is Vue's inline JSX `<svg>` (the lucide "layers"
// geometry with `width="60%" height="60%"`), emitted verbatim through
// `dangerous_inner_html` on its own `display:contents` host — the crate-wide
// SVG rule (ledger L49): an rsx `svg {}` child would build an HTML-namespace
// element, and the host must not add a box.
//
// Interaction (ledger L67, mouse family): both hosts bind `onclick` and
// re-emit the mouse event through `onclick` — the component keeps NO state
// (nothing to store; the tairitsu 0.5.22 `use_signal` / `use_state` limits —
// ledger L48 — never come into play).

use hikari_i18n::t;

use crate::layout::nav_item::safe_href;
use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct LogoComponent;

/// Vue's `sizeMap` record: the five size tokens as CSS lengths.
pub const LOGO_SIZE_MAP: &[(&str, &str)] = &[
    ("xs", "1.25rem"),
    ("sm", "1.625rem"),
    ("md", "2rem"),
    ("lg", "3.5rem"),
    ("xl", "5rem"),
];

/// The placeholder glyph, byte-identical to Vue's inline JSX `<svg>` (the
/// lucide "layers" paths; `60%` box inside the tone-filled placeholder).
/// Mounted through `dangerous_inner_html` — see the header (ledger L49).
const LOGO_PLACEHOLDER_SVG: &str = r#"<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="60%" height="60%"><path d="M12 2L2 7l10 5 10-5-10-5z"></path><path d="M2 17l10 5 10-5"></path><path d="M2 12l10 5 10-5"></path></svg>"#;

/// The five size steps (Vue default `md`).
#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum LogoSize {
    Xs,
    Sm,
    #[default]
    Md,
    Lg,
    Xl,
}

impl LogoSize {
    /// The `sizeMap` entry exactly as Vue prints it into the inline style.
    pub fn rem(self) -> &'static str {
        match self {
            LogoSize::Xs => "1.25rem",
            LogoSize::Sm => "1.625rem",
            LogoSize::Md => "2rem",
            LogoSize::Lg => "3.5rem",
            LogoSize::Xl => "5rem",
        }
    }

    /// Parse one of the five tokens; anything else is `None` (the caller
    /// then applies Vue's `sizeMap[s] ?? sizeMap.md` guard via
    /// [`logo_size_from_str`], which takes the raw string).
    pub fn parse(raw: &str) -> Option<Self> {
        match raw {
            "xs" => Some(LogoSize::Xs),
            "sm" => Some(LogoSize::Sm),
            "md" => Some(LogoSize::Md),
            "lg" => Some(LogoSize::Lg),
            "xl" => Some(LogoSize::Xl),
            _ => None,
        }
    }
}

/// Vue's `logoSize()` in one pure step over the RAW size string: the
/// `sizeMap` lookup with its `?? sizeMap.md` guard — an unknown token
/// (including the empty string) resolves to `md`'s length.
pub fn logo_size_from_str(raw: &str) -> &'static str {
    LogoSize::parse(raw).unwrap_or_default().rem()
}

/// Vue's placeholder `aria-label`: `props.alt || t("hikari::logo.
/// fallbackAlt")` — an EMPTY alt falls through to the locale string (the
/// Rust bundle already carries it as `components.hk.logo.fallbackAlt`).
pub fn logo_aria_label(alt: &str) -> String {
    if alt.is_empty() {
        t("components.hk.logo.fallbackAlt", "Logo")
    } else {
        alt.to_string()
    }
}

/// Vue's `props.alt.charAt(0).toUpperCase()` — the initial the placeholder
/// shows when an `alt` exists. Multi-char upper-case expansions travel with
/// the character (`ß` → `SS`), matching JavaScript's `toUpperCase`.
pub fn logo_initial(alt: &str) -> String {
    alt.chars()
        .next()
        .map(|c| c.to_uppercase().to_string())
        .unwrap_or_default()
}

/// The paint-inert host the placeholder glyph hangs on (ledger L49:
/// `dangerous_inner_html` suppresses an element's own children, so the
/// markup cannot sit beside a sibling — hence the dedicated host).
fn logo_glyph_host() -> Element {
    VNode::Element(Box::new(
        VElement::new("span")
            .style("display:contents")
            .dangerous_inner_html(LOGO_PLACEHOLDER_SVG),
    ))
}

#[define_props]
pub struct LogoProps {
    /// Image source; `None`/empty renders the placeholder face.
    pub src: Option<String>,

    /// Image `alt` / placeholder label / initial source (Vue default `""`).
    #[default]
    pub alt: String,

    #[default]
    pub size: LogoSize,

    /// Anchor target; runs through `safeHref` (Vue: `utils/safeHref.ts`).
    pub href: Option<String>,

    /// Re-emits the host's mouse click (Vue: the `click` emit).
    pub onclick: Option<EventHandler<MouseEvent>>,
}

#[component]
pub fn Logo(props: LogoProps) -> Element {
    let size = props.size.rem();
    let box_style = format!("width:{size};height:{size}");

    let has_src = props.src.as_deref().is_some_and(|src| !src.is_empty());
    let face = if has_src {
        rsx! {
            img {
                class: "hk-logo-img",
                src: props.src.clone().unwrap_or_default(),
                alt: props.alt.clone(),
                style: box_style,
            }
        }
    } else {
        let aria_label = logo_aria_label(&props.alt);
        let inner = if props.alt.is_empty() {
            logo_glyph_host()
        } else {
            rsx! {
                span { class: "hk-logo-initial", {logo_initial(&props.alt)} }
            }
        };
        rsx! {
            div {
                class: "hk-logo-placeholder",
                style: box_style,
                "role": "img",
                "aria-label": aria_label,
                {inner}
            }
        }
    };

    let onclick = props.onclick.clone();
    // Mouse family (ledger L67): the click re-emits verbatim on both hosts.
    let on_click = move |event: MouseEvent| {
        if let Some(handler) = onclick.as_ref() {
            handler.call(event);
        }
    };

    match props.href.as_deref().filter(|href| !href.is_empty()) {
        Some(href) => rsx! {
            a {
                class: "hk-logo",
                href: safe_href(Some(href)),
                style: "line-height:0",
                onclick: on_click,
                {face}
            }
        },
        None => rsx! {
            div {
                class: "hk-logo",
                style: "line-height:0",
                onclick: on_click,
                {face}
            }
        },
    }
}

impl StyledComponent for LogoComponent {
    fn styles() -> &'static str {
        // The canonical Vue sheet, compiled verbatim (no_hash keeps the
        // `.hk-logo*` names literal so this CSS matches the Vue build).
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkLogo.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "logo"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn logo_defaults_match_the_vue_props() {
        let props = LogoProps::default();
        assert_eq!(props.size, LogoSize::Md);
        assert_eq!(props.alt, "");
        assert!(props.src.is_none());
        assert!(props.href.is_none());
        assert!(props.onclick.is_none());
    }

    #[test]
    fn logo_size_table_is_vues_sizemap() {
        assert_eq!(LogoSize::Xs.rem(), "1.25rem");
        assert_eq!(LogoSize::Sm.rem(), "1.625rem");
        assert_eq!(LogoSize::Md.rem(), "2rem");
        assert_eq!(LogoSize::Lg.rem(), "3.5rem");
        assert_eq!(LogoSize::Xl.rem(), "5rem");
        // The record itself stays the single source the resolver reads.
        assert_eq!(LOGO_SIZE_MAP.len(), 5);
    }

    #[test]
    fn logo_unknown_sizes_fall_back_to_md() {
        // Vue: `sizeMap[props.size] ?? sizeMap.md` — typos AND the empty
        // string resolve to md, never to a missing length.
        assert_eq!(logo_size_from_str("md"), "2rem");
        assert_eq!(logo_size_from_str("xxl"), "2rem");
        assert_eq!(logo_size_from_str(""), "2rem");
        assert_eq!(logo_size_from_str("xs"), "1.25rem");
    }

    #[test]
    fn logo_aria_label_prefers_alt_then_the_locale_fallback() {
        assert_eq!(logo_aria_label("Celestia"), "Celestia");
        assert_eq!(logo_aria_label(""), "Logo");
    }

    #[test]
    fn logo_initial_upper_cases_the_first_char_only() {
        assert_eq!(logo_initial("alice"), "A");
        assert_eq!(logo_initial("bob"), "B");
        // Vue never reaches this branch with an empty alt (the SVG renders
        // instead); the helper still answers "" instead of panicking.
        assert_eq!(logo_initial(""), "");
    }

    #[test]
    fn logo_placeholder_svg_is_vues_layers_glyph() {
        // The markup is trusted static payload (ledger L49); the needles
        // pin it to Vue's JSX: same viewBox, stroke tuning, 60% box and
        // the three layer paths.
        for needle in [
            r#"viewBox="0 0 24 24""#,
            r#"stroke-width="1.5""#,
            r#"width="60%" height="60%""#,
            r#"<path d="M12 2L2 7l10 5 10-5-10-5z"></path>"#,
            r#"<path d="M2 17l10 5 10-5"></path>"#,
            r#"<path d="M2 12l10 5 10-5"></path>"#,
        ] {
            assert!(
                LOGO_PLACEHOLDER_SVG.contains(needle),
                "placeholder svg must stay byte-identical to Vue's (missing {needle})"
            );
        }
    }

    #[test]
    fn logo_renders_the_img_face_with_the_size_style() {
        let html = Logo(LogoProps {
            src: Some("/brand.png".to_string()),
            alt: "Celestia".to_string(),
            ..Default::default()
        })
        .render_to_html();

        // Attributes serialize sorted (alt, src), then class, then style.
        assert!(
            html.contains(
                r#"<img alt="Celestia" src="/brand.png" class="hk-logo-img" style="width:2rem;height:2rem">"#
            ),
            "{html}"
        );
        // The div host carries the click seam and no anchor chrome.
        assert!(
            html.contains(r#"<div class="hk-logo" style="line-height:0""#),
            "{html}"
        );
        assert!(!html.contains("<a "), "no href prop → no anchor: {html}");
        assert!(!html.contains("hk-logo-placeholder"), "{html}");
    }

    #[test]
    fn logo_renders_the_placeholder_initial_and_glyph_faces() {
        // With an alt: the initial span, no glyph.
        let initial = Logo(LogoProps {
            alt: "celestial".to_string(),
            ..Default::default()
        })
        .render_to_html();
        assert!(
            initial.contains(
                r#"<div aria-label="celestial" role="img" class="hk-logo-placeholder" style="width:2rem;height:2rem">"#
            ),
            "{initial}"
        );
        assert!(
            initial.contains(r#"<span class="hk-logo-initial">C</span>"#),
            "{initial}"
        );
        assert!(!initial.contains("<svg"), "{initial}");

        // Without an alt: the locale aria-label and the layers glyph on its
        // display:contents host.
        let glyph = Logo(LogoProps::default()).render_to_html();
        assert!(glyph.contains(r#"aria-label="Logo""#), "{glyph}");
        assert!(
            glyph.contains(r#"<span style="display:contents"><svg viewBox="0 0 24 24""#),
            "the glyph must ride its display:contents host (ledger L49): {glyph}"
        );
    }

    #[test]
    fn logo_href_host_neutralizes_dangerous_schemes() {
        let html = Logo(LogoProps {
            href: Some("javascript:alert(1)".to_string()),
            ..Default::default()
        })
        .render_to_html();
        // safeHref: the anchor stays clickable but inert ("#").
        // (Attributes serialize before class: href first. A plain escaped
        // literal — the `#"` pair would close an r#""# raw string early.)
        assert!(html.contains("<a href=\"#\" class=\"hk-logo\""), "{html}");
        assert!(!html.contains("javascript:"), "{html}");

        let ok = Logo(LogoProps {
            href: Some("https://celestia.world".to_string()),
            ..Default::default()
        })
        .render_to_html();
        assert!(ok.contains(r#"href="https://celestia.world""#), "{ok}");
    }

    #[test]
    fn logo_styles_come_from_the_canonical_vue_sheet() {
        let css = LogoComponent::styles();
        for class_name in [
            ".hk-logo",
            ".hk-logo-img",
            ".hk-logo-placeholder",
            ".hk-logo-initial",
        ] {
            assert!(
                css.contains(class_name),
                "logo css must come from the vue-mirror sheet (missing {class_name})"
            );
        }
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored logo sheet"
        );
    }
}
