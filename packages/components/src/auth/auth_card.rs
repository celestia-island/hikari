// hi-components/src/auth/auth_card.rs
// AuthCard — mirror of the canonical Vue `HkAuthCard`: the shared shell of
// every Celestia auth screen (login, register, setup) — a centered header
// (logo / title / subtitle) over a column form body.
//
// Vue ships NO sheet for this component. The card's geometry is the `s-*`
// auth vocabulary in `packages/vue/src/styles/admin-tokens.scss`
// (`.s-auth-card` / `.s-auth-card-height` / `.s-auth-header` /
// `.s-auth-title` / `.s-auth-subtitle` / `.s-auth-form` /
// `.s-auth-methods` / `.s-auth-footer`, and the ONE width contract
// `var(--hk-auth-card-max-width, 28rem)`), vendored byte-identically under
// `src/styles/vue-mirror/styles/` and registered as the `vue-admin-tokens`
// chrome layer by `StyleRegistry::register_vue_chrome`
// (`styled::vue_admin_tokens_css`). [`AuthCardComponent::styles`] therefore
// returns `""`: this mirror owns the DOM and the class names only. A sheet
// here would fork the geometry contract away from the Vue form — a host must
// load that registry layer (or the builder bundle) for the card to paint.
//
// DOM contract (attribute-for-attribute with `HkAuthCard.tsx`):
//
//   div.s-auth-card-height          (style: --hk-auth-card-max-width, emitted
//                                    only when `max_width` is set)
//     div.s-auth-card
//       div.s-auth-header
//         {logo}                    (logo element; omitted when None)
//         h1.s-auth-title           {title}
//         p.s-auth-subtitle         (only when subtitle is non-empty)
//       div.s-auth-form             {children}       (Vue's default slot)
//       div.s-auth-methods          (only when a methods element is given)
//       div.s-auth-footer           (only when a footer element is given)
//
// Slot contract (the same one Vue documents): `methods` is a FULL-WIDTH
// block between the form and the footer so alternative sign-in buttons line
// up with the inputs, while `footer` is a fit-content centered column of
// rows. Both wrappers are omitted — not rendered empty — when the slot has no
// element: an always-present slot would paint the sheet's padded, top-margined
// box as dead space under the form (`HkSignInCard`'s forwarding note).
//
// Vue prop mapping: `title` (required in Vue) → [`AuthCardProps::title`],
// `subtitle` → [`AuthCardProps::subtitle`], the `logo` / `default` /
// `methods` / `footer` slots → [`AuthCardProps::logo`] /
// [`AuthCardProps::children`] / [`AuthCardProps::methods`] /
// [`AuthCardProps::footer`], `smoothHeight` → [`AuthCardProps::smooth_height`],
// `attrs.class` (Vue falls it through to the root wrapper) →
// [`AuthCardProps::class`].
//
// Behaviour deltas vs Vue (documented, not accidental):
//   * `smoothHeight` is ACCEPTED AND INERT. Vue drives it with a
//     `ResizeObserver` on the card, an explicit wrapper `height`, a
//     `--measuring` clip class and a 450 ms backstop timer. tairitsu 0.5.22
//     has no per-instance element ref + observer pairing that survives a
//     re-render (the same limit `basic/input.rs` documents for the affix
//     widths), so no height is seeded and height changes snap instead of
//     animating. The `.s-auth-card-height` wrapper still renders — the DOM
//     shape stays stable for descendants and for host selectors that name
//     `.s-auth-card` as a direct child — and the sheet's `height` transition
//     plus its `prefers-reduced-motion` opt-out stay harmless without it.
//   * `max_width` is a Rust-side convenience with a Vue-side single source of
//     truth: Vue publishes the cap ONLY as the `--hk-auth-card-max-width`
//     custom property (fallback = the `HK_AUTH_CARD_MAX_WIDTH` constant in
//     `packages/vue/src/theme/authCard.ts`). The mirror resolves a preset
//     name (or passes any CSS length through) and publishes that very
//     property inline on the wrapper, so the wrapper and the card stay on one
//     number by construction. `"md"` is the canonical [`HK_AUTH_CARD_MAX_WIDTH`].
//   * a raw `style` passthrough is retired in favour of `max_width`; `class`
//     is an explicit prop (better than Vue's implicit attrs fall-through,
//     same shape as `basic/button.rs`).
//
// State: controlled props only — no `use_signal` / `use_state` (L48).

use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct AuthCardComponent;

/// The canonical card cap, mirroring `HK_AUTH_CARD_MAX_WIDTH` in
/// `packages/vue/src/theme/authCard.ts` — which is also the fallback literal
/// of the `max-width` rule on `.s-auth-card` / `.s-auth-card-height`
/// (`styles/authCardWidth.test.ts` keeps the TS side and the sheet equal;
/// this constant carries the same literal into the Rust form).
pub const HK_AUTH_CARD_MAX_WIDTH: &str = "28rem";

/// The custom property both `.s-auth-card` and `.s-auth-card-height` resolve
/// for their maximum width (Vue: `HK_AUTH_CARD_MAX_WIDTH_VAR`). A host may
/// also set it on any ancestor to cap every auth surface at once.
pub const HK_AUTH_CARD_MAX_WIDTH_VAR: &str = "--hk-auth-card-max-width";

/// Named width presets accepted by [`AuthCardProps::max_width`]. `md` is the
/// canonical [`HK_AUTH_CARD_MAX_WIDTH`]; `sm` / `lg` are Rust-side
/// conveniences (Vue has exactly one width — see the file header delta), and
/// any other CSS `max-width` value passes through verbatim.
pub const AUTH_CARD_WIDTH_PRESETS: &[(&str, &str)] = &[
    ("sm", "22rem"),
    ("md", HK_AUTH_CARD_MAX_WIDTH),
    ("lg", "36rem"),
];

/// Resolve the `max_width` prop to a concrete CSS length: presets map through
/// [`AUTH_CARD_WIDTH_PRESETS`] (compared after trimming), everything else
/// passes through untouched — exactly the shape of `feedback/modal.rs`'s
/// `resolve_modal_width`, because Vue takes the property value as-is.
pub fn resolve_auth_card_width(width: &str) -> String {
    let key = width.trim();
    for (name, value) in AUTH_CARD_WIDTH_PRESETS {
        if *name == key {
            return (*value).to_string();
        }
    }
    width.to_string()
}

/// The inline style publishing the card cap for one `max_width` value — an
/// empty string when the prop is unset, so the sheet's own
/// `var(--hk-auth-card-max-width, 28rem)` fallback wins (and no `style`
/// attribute is emitted at all). A blank/whitespace value counts as unset: it
/// would otherwise publish an invalid length and clamp the card to its
/// content.
pub fn auth_card_width_style(max_width: Option<&str>) -> String {
    let trimmed = max_width
        .map(|width| width.trim())
        .filter(|w| !w.is_empty());
    match trimmed {
        Some(width) => format!(
            "{}:{}",
            HK_AUTH_CARD_MAX_WIDTH_VAR,
            resolve_auth_card_width(width)
        ),
        None => String::new(),
    }
}

/// Vue's `subtitle && <p>` test: an empty string is falsy, so `Some("")` also
/// renders no line (a nullish-only test would print an empty paragraph).
pub fn auth_card_has_subtitle(subtitle: Option<&str>) -> bool {
    subtitle.is_some_and(|text| !text.is_empty())
}

#[define_props]
pub struct AuthCardProps {
    /// Header title (Vue: `title`, required). A missing title renders the
    /// same empty `h1` Vue renders when its required prop is omitted.
    #[default]
    pub title: String,

    /// Header subtitle; empty/absent renders no line.
    pub subtitle: Option<String>,

    /// Header logo slot (Vue: the `logo` slot), rendered before the title
    /// inside `.s-auth-header`.
    pub logo: Option<Element>,

    /// Card body — Vue's default slot, rendered inside `.s-auth-form`.
    pub children: Element,

    /// The `methods` slot: the full-width block between the form and the
    /// footer (typically the alternative-method list). Omitted when absent.
    pub methods: Option<Element>,

    /// The `footer` slot: one centered row per child under the card body.
    pub footer: Option<Element>,

    /// Vue: `smoothHeight` (default true). Accepted and inert — the wave's
    /// mirrors have no observer pairing; see the file header delta.
    #[default(true)]
    pub smooth_height: bool,

    /// Card cap: a preset name (`sm` / `md` / `lg`) or any CSS `max-width`
    /// value; unset keeps the sheet's own `28rem` fallback. Published inline
    /// as [`HK_AUTH_CARD_MAX_WIDTH_VAR`].
    pub max_width: Option<String>,

    /// Host class, appended to the `.s-auth-card-height` wrapper (Vue falls
    /// `attrs.class` through to the root element).
    #[default]
    pub class: String,
}

#[component]
pub fn AuthCard(props: AuthCardProps) -> Element {
    let title = props.title.clone();
    let subtitle = if auth_card_has_subtitle(props.subtitle.as_deref()) {
        props.subtitle.clone()
    } else {
        None
    };
    let logo = props.logo.clone();
    let children = props.children.clone();
    let methods = props.methods.clone();
    let footer = props.footer.clone();
    let wrapper_style = auth_card_width_style(props.max_width.as_deref());

    let mut wrapper_classes = String::from("s-auth-card-height");
    if !props.class.is_empty() {
        wrapper_classes.push(' ');
        wrapper_classes.push_str(&props.class);
    }

    rsx! {
        div { class: wrapper_classes, style: wrapper_style,
            div { class: "s-auth-card",
                div { class: "s-auth-header",
                    if let Some(logo) = logo {
                        {logo}
                    }
                    h1 { class: "s-auth-title", "{title}" }
                    if let Some(subtitle) = subtitle {
                        p { class: "s-auth-subtitle", "{subtitle}" }
                    }
                }
                div { class: "s-auth-form",
                    {children}
                }
                if let Some(methods) = methods {
                    div { class: "s-auth-methods", {methods} }
                }
                if let Some(footer) = footer {
                    div { class: "s-auth-footer", {footer} }
                }
            }
        }
    }
}

impl StyledComponent for AuthCardComponent {
    fn styles() -> &'static str {
        // Vue ships no sheet for this component: the geometry is the shared
        // `s-*` auth vocabulary in the vendored `admin-tokens.scss`, shipped
        // by the `vue-admin-tokens` registry chrome (see the file header).
        ""
    }

    fn name() -> &'static str {
        "auth-card"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn auth_card_defaults_match_the_vue_props() {
        let props = AuthCardProps::default();
        assert_eq!(props.title, "");
        assert_eq!(props.subtitle, None);
        assert!(props.logo.is_none());
        // The default slot is the empty fragment `VNode::default()` renders.
        assert!(matches!(props.children, VNode::Fragment(ref nodes) if nodes.is_empty()));
        assert!(props.methods.is_none());
        assert!(props.footer.is_none());
        // Vue: `smoothHeight` defaults to true.
        assert!(props.smooth_height);
        // Unset width → the sheet's `28rem` fallback governs.
        assert_eq!(props.max_width, None);
        assert_eq!(props.class, "");
    }

    #[test]
    fn auth_card_width_presets_resolve_like_the_modal_presets() {
        // Every preset in the table resolves, and `md` is exactly the
        // canonical constant the sheet's fallback carries.
        for &(name, value) in AUTH_CARD_WIDTH_PRESETS {
            assert_eq!(resolve_auth_card_width(name), value, "preset {name}");
        }
        assert_eq!(resolve_auth_card_width("md"), HK_AUTH_CARD_MAX_WIDTH);
        assert_eq!(resolve_auth_card_width("md"), "28rem");
        // The preset lookup trims; the value is returned as written.
        assert_eq!(resolve_auth_card_width(" sm "), "22rem");
        assert_eq!(resolve_auth_card_width("lg"), "36rem");
        // Arbitrary CSS max-widths pass through verbatim (Vue takes the
        // custom property value as-is).
        assert_eq!(resolve_auth_card_width("560px"), "560px");
        assert_eq!(
            resolve_auth_card_width("min(28rem, 80vw)"),
            "min(28rem, 80vw)"
        );
        assert_eq!(resolve_auth_card_width(" 32rem "), " 32rem ");
    }

    #[test]
    fn auth_card_width_style_publishes_the_canonical_property() {
        assert_eq!(auth_card_width_style(None), "");
        // Blank input counts as unset — never publish an invalid length.
        assert_eq!(auth_card_width_style(Some("")), "");
        assert_eq!(auth_card_width_style(Some("   ")), "");
        assert_eq!(
            auth_card_width_style(Some("md")),
            "--hk-auth-card-max-width:28rem"
        );
        assert_eq!(
            auth_card_width_style(Some("sm")),
            "--hk-auth-card-max-width:22rem"
        );
        assert_eq!(
            auth_card_width_style(Some("40rem")),
            "--hk-auth-card-max-width:40rem"
        );
        // The published property IS the one the vendored sheet resolves.
        assert_eq!(HK_AUTH_CARD_MAX_WIDTH_VAR, "--hk-auth-card-max-width");
    }

    #[test]
    fn auth_card_subtitle_truthiness_matches_vue() {
        // Vue: `props.subtitle && <p>` — an empty string is falsy.
        assert!(!auth_card_has_subtitle(None));
        assert!(!auth_card_has_subtitle(Some("")));
        assert!(auth_card_has_subtitle(Some("Continue to your account")));
    }

    #[test]
    fn auth_card_renders_the_vue_dom_contract() {
        // Bare card: wrapper → card → header/title + empty form; no subtitle
        // line, no slot wrappers, and no `style` attribute at all.
        let html = AuthCard(AuthCardProps::default()).render_to_html();
        assert!(html.contains(r#"class="s-auth-card-height""#), "{html}");
        assert!(html.contains(r#"class="s-auth-card""#), "{html}");
        assert!(html.contains(r#"class="s-auth-header""#), "{html}");
        assert!(html.contains(r#"class="s-auth-title""#), "{html}");
        assert!(html.contains(r#"class="s-auth-form""#), "{html}");
        assert!(!html.contains("s-auth-subtitle"), "{html}");
        assert!(!html.contains("s-auth-methods"), "{html}");
        assert!(!html.contains("s-auth-footer"), "{html}");
        assert!(!html.contains("style="), "{html}");
        // The slot wrappers nest in Vue's order: header, form, methods, footer.
        let header = html.find("s-auth-header").unwrap();
        let form = html.find("s-auth-form").unwrap();
        assert!(header < form, "{html}");

        // Full card: logo first inside the header, then the subtitle line,
        // the methods block, the footer block and the published width cap.
        let html = AuthCard(AuthCardProps {
            title: "Sign in".to_string(),
            subtitle: Some("Continue to your account".to_string()),
            logo: Some(rsx! {
                span { class: "test-logo" }
            }),
            children: rsx! {
                div { class: "test-body" }
            },
            methods: Some(rsx! {
                div { class: "test-methods" }
            }),
            footer: Some(rsx! {
                span { class: "test-footer" }
            }),
            max_width: Some("sm".to_string()),
            class: "host-class".to_string(),
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains("Sign in"), "{html}");
        assert!(html.contains("Continue to your account"), "{html}");
        assert!(html.contains(r#"class="test-logo""#), "{html}");
        assert!(html.contains(r#"class="test-body""#), "{html}");
        assert!(html.contains(r#"class="test-methods""#), "{html}");
        assert!(html.contains(r#"class="test-footer""#), "{html}");
        assert!(
            html.contains(r#"class="s-auth-card-height host-class""#),
            "{html}"
        );
        assert!(
            html.contains(r#"style="--hk-auth-card-max-width:22rem""#),
            "{html}"
        );
        let logo = html.find("test-logo").unwrap();
        let title = html.find("Sign in").unwrap();
        assert!(
            logo < title,
            "the logo slot renders before the title: {html}"
        );
        let form = html.find("s-auth-form").unwrap();
        let methods = html.find("s-auth-methods").unwrap();
        let footer = html.find("s-auth-footer").unwrap();
        assert!(form < methods && methods < footer, "{html}");

        // `smoothHeight: false` keeps the wrapper (Vue renders it either way).
        let html = AuthCard(AuthCardProps {
            smooth_height: false,
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains(r#"class="s-auth-card-height""#), "{html}");
    }

    #[test]
    fn auth_card_ships_no_sheet_of_its_own() {
        // The card's geometry is NOT this component's to ship: Vue has no
        // `HkAuthCard.scss`, so the mirror must not invent one.
        assert_eq!(AuthCardComponent::styles(), "");
        assert_eq!(AuthCardComponent::name(), "auth-card");

        // …it comes from the registered `vue-admin-tokens` chrome layer.
        let mut registry = StyleRegistry::default();
        registry.register_vue_chrome();
        let css = registry
            .get("vue-admin-tokens")
            .expect("the admin token chrome must be registered");
        for class in [
            ".s-auth-card-height",
            ".s-auth-card",
            ".s-auth-header",
            ".s-auth-title",
            ".s-auth-subtitle",
            ".s-auth-form",
            ".s-auth-methods",
            ".s-auth-footer",
        ] {
            assert!(
                css.contains(class),
                "the vendored admin tokens must carry the card class {class:?}"
            );
        }
        // The one width contract the presets resolve.
        assert!(
            css.contains("var(--hk-auth-card-max-width, 28rem)"),
            "the card width contract moved; keep HK_AUTH_CARD_MAX_WIDTH in sync"
        );
    }
}
