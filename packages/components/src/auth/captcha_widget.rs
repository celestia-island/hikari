// hi-components/src/auth/captcha_widget.rs
// CaptchaWidget — mirror of the canonical Vue `HkCaptchaWidget`: the
// provider-agnostic captcha box (`s-captcha-widget*`, upstreamed from
// shittim-chest's plana-legacy layer).
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkCaptchaWidget.scss`, vendored under
// `src/styles/vue-mirror/` and guarded by `tests/vue_mirror_drift_tests.rs`),
// compiled with `no_hash` so the `s-captcha-widget*` class names are literal
// and identical in both forms. DOM contract (mirrors the Vue render output):
//
//   no-op placeholder mode (empty `site_key` or `disabled`):
//     div.s-captcha-widget.s-captcha-widget-placeholder [+class]
//         data-state="placeholder"
//       span[style="display:contents"] > shield-alert svg 16
//       span "{placeholder text}"
//
//   provider mode:
//     div.s-captcha-widget [+class]
//         data-state="{idle|loading|verified|error}"
//         data-provider="{turnstile|recaptcha}"
//       p.s-captcha-widget-loading "{loading text}"      (state=loading only)
//       div.s-captcha-widget-host
//           <challenge_content slot> | span[style="display:contents"] > challenge svg
//
// The pure layer: `captcha_is_placeholder` (Vue's `placeholder` computed),
// `captcha_state_token` / `CAPTCHA_PLACEHOLDER_TOKEN` (the published visual
// state), `captcha_challenge_index` (Vue's `attempt`-driven reset, [D3]),
// `captcha_challenge_layout` + `captcha_challenge_svg` (the host-injected
// challenge, [D2]) and `captcha_classes`.
//
// State (L48): controlled only. Vue keeps `loading` in a local ref and mounts
// the provider widget into a template ref; here `state` and the challenge list
// are props and the widget stores nothing (no signal, no thread_local, no
// timer).
//
// Deltas vs Vue (documented, not accidental):
//   [D1] NO PROVIDER SCRIPT, NO IFRAME. Vue lazily injects the Turnstile /
//     reCAPTCHA CDN script through `document.createElement("script")`, polls
//     `window.turnstile` / `window.grecaptcha`, renders the provider widget
//     into a template ref and drives it through `render` / `reset` / `remove`.
//     tairitsu 0.5.22 has no script loader, no `window` global table, no
//     element ref that survives a render and no DOM mutation API (L48/L49), so
//     NONE of that chain exists here. Consequences: `provider` is carried as
//     data only (`data-provider` on the root) and `scriptUrl` is not part of
//     the Rust surface at all; the `verify` / `error` emits have no in-widget
//     source and are the HOST's own submission path (see [D2]).
//   [D2] THE CHALLENGE IS HOST-INJECTED. Where Vue mounts the provider iframe,
//     the mirror paints a host-supplied challenge: `challenges` (a list, see
//     [D3]) is rendered as a self-contained SVG (`captcha_challenge_svg`) into
//     `.s-captcha-widget-host`, or `challenge_content` (a slot) is rendered
//     there verbatim when the host paints its own. The host — not this
//     component — owns the answer input and the verdict; it publishes the
//     widget's visual state through `state`. That keeps the widget a pure
//     renderer, which is the only shape the framework can host.
//   [D3] `attempt` ROTATES THE CHALLENGE instead of calling provider
//     `reset()`: bumping the (controlled) counter advances
//     `captcha_challenge_index` through the host's list, which is the same
//     "force a fresh challenge" intent Vue uses the provider reset for.
//     Vue's single-use tokens are the host's business (it issues the token).
//   [D4] The root publishes `data-state` (and `data-provider`) so consumers
//     and tests can read the visual state; Vue has no such attribute (its
//     state is internal and its only visible branches are the loading line and
//     the placeholder box). The generic accessibility label of a challenge is
//     `components.hk.captcha.challenge` — the ANSWER is never written into an
//     attribute (the painted glyphs are the challenge itself).
//   [D5] i18n keys read `components.hk.captcha.*` through `hikari_i18n::t`;
//     Vue reads `hikari::captcha.*` with the same English fallbacks, so the
//     English DOM is identical. The keys are NEW (listed in the wave receipt).
//   [D6] a host `class` is appended to the root (Vue merges the fallthrough
//     class itself).

use hikari_i18n::t;

use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct CaptchaWidgetComponent;

// ── enums ────────────────────────────────────────────────────────────────

/// Vue's `provider` (`"turnstile" | "recaptcha"`, default `turnstile`). Carried
/// as data only — no provider script is ever loaded (see [D1]).
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum CaptchaProvider {
    #[default]
    Turnstile,
    Recaptcha,
}

impl CaptchaProvider {
    /// The `data-provider` token.
    pub fn token(self) -> &'static str {
        match self {
            CaptchaProvider::Turnstile => "turnstile",
            CaptchaProvider::Recaptcha => "recaptcha",
        }
    }
}

/// The widget's controlled visual state (Vue: the internal `loading` ref plus
/// whatever the provider reports through its callbacks).
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum CaptchaState {
    /// Rendered, waiting for the host's challenge / verdict.
    #[default]
    Idle,
    /// A challenge request is in flight (Vue: `loading`).
    Loading,
    /// The host accepted a token.
    Verified,
    /// The host reports a failure (Vue: the provider's error callback).
    Error,
}

impl CaptchaState {
    /// The `data-state` token.
    pub fn token(self) -> &'static str {
        match self {
            CaptchaState::Idle => "idle",
            CaptchaState::Loading => "loading",
            CaptchaState::Verified => "verified",
            CaptchaState::Error => "error",
        }
    }
}

/// The `data-state` token of the no-op placeholder box (a LAYOUT state, not one
/// of [`CaptchaState`]'s values — Vue's placeholder render branch).
pub const CAPTCHA_PLACEHOLDER_TOKEN: &str = "placeholder";

/// Vue's `placeholder` computed: an empty site key or a disabled widget means
/// the box is a no-op notice and nothing is ever verified.
pub fn captcha_is_placeholder(site_key: &str, disabled: bool) -> bool {
    site_key.is_empty() || disabled
}

/// The state token the root publishes. In placeholder mode the layout token
/// wins (the box is not a verification surface at all).
pub fn captcha_state_token(placeholder: bool, state: CaptchaState) -> &'static str {
    if placeholder {
        CAPTCHA_PLACEHOLDER_TOKEN
    } else {
        state.token()
    }
}

/// Which host-supplied challenge is current: Vue's "bump `attempt` to force a
/// fresh challenge" (a provider reset) becomes a deterministic index into the
/// host's list ([D3]). An empty list keeps index 0 (nothing to render).
pub fn captcha_challenge_index(attempt: u32, count: usize) -> usize {
    if count == 0 {
        0
    } else {
        (attempt as usize) % count
    }
}

/// The challenge the widget paints: the `attempt`-selected entry of the host's
/// list, or `None` when the host injected none.
pub fn captcha_active_challenge(
    challenges: &[CaptchaChallenge],
    attempt: u32,
) -> Option<&CaptchaChallenge> {
    if challenges.is_empty() {
        None
    } else {
        challenges.get(captcha_challenge_index(attempt, challenges.len()))
    }
}

// ── the challenge data + its layout ([D2]) ───────────────────────────────

/// A host-injected graphic challenge. Vue has no such type — the provider owns
/// the pixels — so this is the [D2] replacement for the iframe.
#[derive(Clone, PartialEq, Debug)]
pub struct CaptchaChallenge {
    /// The characters the host wants painted (the challenge itself).
    pub glyphs: String,
    /// Deterministic noise seed: the same seed paints the same frame.
    pub seed: u32,
    /// Box width in CSS pixels.
    pub width: u32,
    /// Box height in CSS pixels.
    pub height: u32,
}

impl Default for CaptchaChallenge {
    fn default() -> Self {
        Self {
            glyphs: String::new(),
            seed: 0,
            width: CAPTCHA_CHALLENGE_WIDTH,
            height: CAPTCHA_CHALLENGE_HEIGHT,
        }
    }
}

impl CaptchaChallenge {
    /// A challenge with the default 200×60 box.
    pub fn new(glyphs: &str, seed: u32) -> Self {
        Self {
            glyphs: glyphs.to_string(),
            seed,
            ..Self::default()
        }
    }

    /// The box width, clamped into a sane range (0 would collapse the SVG).
    pub fn box_width(&self) -> f64 {
        f64::from(
            self.width
                .clamp(CAPTCHA_CHALLENGE_MIN_SIDE, CAPTCHA_CHALLENGE_MAX_SIDE),
        )
    }

    /// The box height, clamped into a sane range.
    pub fn box_height(&self) -> f64 {
        f64::from(
            self.height
                .clamp(CAPTCHA_CHALLENGE_MIN_SIDE, CAPTCHA_CHALLENGE_MAX_SIDE),
        )
    }
}

/// Default challenge box width (Vue: the provider's iframe size).
pub const CAPTCHA_CHALLENGE_WIDTH: u32 = 200;
/// Default challenge box height.
pub const CAPTCHA_CHALLENGE_HEIGHT: u32 = 60;
const CAPTCHA_CHALLENGE_MIN_SIDE: u32 = 32;
const CAPTCHA_CHALLENGE_MAX_SIDE: u32 = 4_096;
/// One painted glyph: its centre, its font size and its rotation.
#[derive(Clone, Copy, PartialEq, Debug)]
pub struct CaptchaGlyph {
    pub ch: char,
    /// Centre x in the challenge's own pixels.
    pub x: f64,
    /// Centre y in the challenge's own pixels.
    pub y: f64,
    /// Glyph size in px.
    pub size: f64,
    /// Rotation in degrees (positive = clockwise, as the SVG `rotate` wants).
    pub rotate: f64,
}

/// One noise stroke across the challenge box.
#[derive(Clone, Copy, PartialEq, Debug)]
pub struct CaptchaNoiseLine {
    pub x1: f64,
    pub y1: f64,
    pub x2: f64,
    pub y2: f64,
}

/// One noise speck.
#[derive(Clone, Copy, PartialEq, Debug)]
pub struct CaptchaNoiseDot {
    pub cx: f64,
    pub cy: f64,
    pub radius: f64,
}

/// One deterministic LCG step (the same generator the password surface uses for
/// its candidates, so the crate has ONE seeded-random primitive).
fn captcha_next_random(state: &mut u64) -> u64 {
    *state = state
        .wrapping_mul(6_364_136_223_846_793_005)
        .wrapping_add(1_442_695_040_888_963_407);
    *state >> 33
}

/// A uniform 0.0..1.0 draw from the seeded generator.
fn captcha_next_unit(state: &mut u64) -> f64 {
    (captcha_next_random(state) % 1_000_000) as f64 / 1_000_000.0
}

/// The challenge's glyph and noise geometry, resolved from its seed alone: the
/// glyphs are laid out on an even cell grid with a seeded per-glyph jitter
/// (position, size, rotation) and the noise is a fixed count of seeded strokes
/// and specks clipped to the box. Pure and deterministic — the same challenge
/// always paints the same frame, so the widget can be tested without a DOM.
pub fn captcha_challenge_layout(
    challenge: &CaptchaChallenge,
) -> (
    Vec<CaptchaGlyph>,
    Vec<CaptchaNoiseLine>,
    Vec<CaptchaNoiseDot>,
) {
    let width = challenge.box_width();
    let height = challenge.box_height();
    let mut state = u64::from(challenge.seed);

    let glyph_count = challenge.glyphs.chars().count();
    let cell = if glyph_count == 0 {
        width
    } else {
        width / glyph_count as f64
    };
    let base_size = (height * 0.5).clamp(18.0, 34.0);
    let mut glyphs = Vec::with_capacity(glyph_count);
    for (index, ch) in challenge.glyphs.chars().enumerate() {
        let jitter_x = (captcha_next_unit(&mut state) - 0.5) * cell * 0.3;
        let jitter_y = (captcha_next_unit(&mut state) - 0.5) * height * 0.25;
        let size = base_size * (0.85 + captcha_next_unit(&mut state) * 0.3);
        let rotate = (captcha_next_unit(&mut state) - 0.5) * 24.0;
        glyphs.push(CaptchaGlyph {
            ch,
            x: cell * index as f64 + cell * 0.5 + jitter_x,
            y: height * 0.5 + jitter_y,
            size,
            rotate,
        });
    }

    let line_count = 4usize;
    let mut lines = Vec::with_capacity(line_count);
    for _ in 0..line_count {
        lines.push(CaptchaNoiseLine {
            x1: captcha_next_unit(&mut state) * width,
            y1: captcha_next_unit(&mut state) * height,
            x2: captcha_next_unit(&mut state) * width,
            y2: captcha_next_unit(&mut state) * height,
        });
    }

    let dot_count = 24usize;
    let mut dots = Vec::with_capacity(dot_count);
    for _ in 0..dot_count {
        dots.push(CaptchaNoiseDot {
            cx: captcha_next_unit(&mut state) * width,
            cy: captcha_next_unit(&mut state) * height,
            radius: 0.6 + captcha_next_unit(&mut state) * 1.6,
        });
    }

    (glyphs, lines, dots)
}

/// Escape a host string for SVG text content. `dangerous_inner_html` bypasses
/// tairitsu's escaper, so the mirror owns it: the challenge glyphs are the only
/// consumer string that enters injected markup.
fn escape_markup(value: &str) -> String {
    let mut out = String::with_capacity(value.len());
    for ch in value.chars() {
        match ch {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' => out.push_str("&quot;"),
            '\'' => out.push_str("&#39;"),
            _ => out.push(ch),
        }
    }
    out
}

/// The challenge's SVG markup (the [D2] replacement for the provider iframe):
/// a tinted ground, the seeded noise strokes and specks, then one `<text>` per
/// glyph. The glyphs are the only consumer string and are escaped; the
/// accessibility label is the generic `components.hk.captcha.challenge`
/// ("Verification challenge") — the ANSWER never reaches an attribute.
pub fn captcha_challenge_svg(challenge: &CaptchaChallenge) -> String {
    let width = challenge.box_width();
    let height = challenge.box_height();
    let (glyphs, lines, dots) = captcha_challenge_layout(challenge);
    let label = escape_markup(&t(
        "components.hk.captcha.challenge",
        "Verification challenge",
    ));
    let mut svg = format!(
        r#"<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" role="img" aria-label="{label}" class="s-captcha-challenge">"#
    );
    svg.push_str(
        r#"<rect width="100%" height="100%" fill="currentColor" fill-opacity="0.06" rx="6"></rect>"#,
    );
    for line in &lines {
        svg.push_str(&format!(
            r#"<line x1="{:.1}" y1="{:.1}" x2="{:.1}" y2="{:.1}" stroke="currentColor" stroke-opacity="0.22" stroke-width="1"></line>"#,
            line.x1, line.y1, line.x2, line.y2
        ));
    }
    for dot in &dots {
        svg.push_str(&format!(
            r#"<circle cx="{:.1}" cy="{:.1}" r="{:.1}" fill="currentColor" fill-opacity="0.3"></circle>"#,
            dot.cx, dot.cy, dot.radius
        ));
    }
    for glyph in &glyphs {
        svg.push_str(&format!(
            r#"<text x="{:.1}" y="{:.1}" font-size="{:.1}" style="font-family:var(--font-mono, ui-monospace, monospace)" fill="currentColor" text-anchor="middle" dominant-baseline="central" transform="rotate({:.1} {:.1} {:.1})">{}</text>"#,
            glyph.x,
            glyph.y,
            glyph.size,
            glyph.rotate,
            glyph.x,
            glyph.y,
            escape_markup(&glyph.ch.to_string())
        ));
    }
    svg.push_str("</svg>");
    svg
}

// ── classes / glyphs ─────────────────────────────────────────────────────

/// The root class list: the base, the placeholder modifier, the host class.
pub fn captcha_classes(placeholder: bool, extra: &str) -> String {
    let mut classes = String::from("s-captcha-widget");
    if placeholder {
        classes.push_str(" s-captcha-widget-placeholder");
    }
    if !extra.is_empty() {
        classes.push(' ');
        classes.push_str(extra);
    }
    classes
}

/// Vue's `<ShieldAlert size={16} />` (lucide 1.0.0, ISC) in the crate's
/// inlined-lucide spelling — trusted static markup, no consumer string.
const CAPTCHA_SHIELD_SVG: &str = r#"<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-shield-alert-icon lucide-shield-alert" aria-hidden="true"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"></path><path d="M12 8v4"></path><path d="M12 16h.01"></path></svg>"#;

/// A glyph mounted through `dangerous_inner_html` on its own
/// `style="display:contents"` host (the crate-wide SVG rule, L49).
fn glyph_host(markup: &str) -> VNode {
    rsx! {
        span {
            style: "display:contents",
            dangerous_inner_html: markup,
        }
    }
}

// ── props ────────────────────────────────────────────────────────────────

#[define_props]
pub struct CaptchaWidgetProps {
    /// Vue: `siteKey` (required there; the Rust default `""` is Vue's no-op
    /// placeholder mode).
    #[default]
    pub site_key: String,

    /// The provider protocol this deployment targets (data only, [D1]).
    #[default]
    pub provider: CaptchaProvider,

    /// Bump to force a fresh challenge (Vue: the provider `reset`, [D3]).
    #[default]
    pub attempt: u32,

    /// Enter the no-op placeholder mode regardless of the site key.
    #[default]
    pub disabled: bool,

    /// The host's challenge list; `attempt` selects the current entry ([D2]).
    pub challenges: Vec<CaptchaChallenge>,

    /// The controlled visual state (Vue: `loading` + the provider callbacks).
    #[default]
    pub state: CaptchaState,

    /// A host-painted challenge that wins over `challenges` ([D2]).
    pub challenge_content: Option<Element>,

    /// Host class, appended to the root.
    #[default]
    pub class: String,
}

// ── the component ────────────────────────────────────────────────────────

#[component]
pub fn CaptchaWidget(props: CaptchaWidgetProps) -> Element {
    let placeholder = captcha_is_placeholder(&props.site_key, props.disabled);
    let classes = captcha_classes(placeholder, &props.class);

    // The no-op branch is Vue's whole placeholder render: the glyph plus the
    // notice, and no host box at all.
    if placeholder {
        let notice = t(
            "components.hk.captcha.placeholder",
            "Verification is not configured for this deployment (no site key provided)",
        );
        return rsx! {
            div {
                class: classes,
                "data-state": CAPTCHA_PLACEHOLDER_TOKEN,
                {glyph_host(CAPTCHA_SHIELD_SVG)}
                span { "{notice}" }
            }
        };
    }

    let state_token = captcha_state_token(placeholder, props.state);
    let loading = props.state == CaptchaState::Loading;
    let loading_text = if loading {
        Some(t(
            "components.hk.captcha.loading",
            "Loading verification widget…",
        ))
    } else {
        None
    };
    // [D2]: the host slot wins over the injected challenge.
    let challenge_markup =
        captcha_active_challenge(&props.challenges, props.attempt).map(captcha_challenge_svg);

    rsx! {
        div {
            class: classes,
            "data-state": state_token,
            "data-provider": props.provider.token(),
            if let Some(text) = loading_text {
                p { class: "s-captcha-widget-loading",
                    "{text}"
                }
            }
            div { class: "s-captcha-widget-host",
                if let Some(node) = props.challenge_content.clone() {
                    {node}
                } else if let Some(markup) = challenge_markup {
                    {glyph_host(&markup)}
                }
            }
        }
    }
}

impl StyledComponent for CaptchaWidgetComponent {
    fn styles() -> &'static str {
        // The canonical Vue sheet, compiled verbatim (no_hash keeps the
        // `s-captcha-widget*` names literal so this CSS matches the Vue build).
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkCaptchaWidget.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "captcha-widget"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // ── the pure layer ───────────────────────────────────────────────────

    #[test]
    fn captcha_placeholder_mode_matches_the_vue_computed() {
        // Vue: `!siteKey || disabled`.
        assert!(captcha_is_placeholder("", false));
        assert!(captcha_is_placeholder("site-key", true));
        assert!(!captcha_is_placeholder("site-key", false));
        // The published state follows the branch, not the idle default.
        assert_eq!(
            captcha_state_token(true, CaptchaState::Loading),
            CAPTCHA_PLACEHOLDER_TOKEN
        );
        assert_eq!(captcha_state_token(false, CaptchaState::Loading), "loading");
        assert_eq!(CaptchaState::Idle.token(), "idle");
        assert_eq!(CaptchaState::Loading.token(), "loading");
        assert_eq!(CaptchaState::Verified.token(), "verified");
        assert_eq!(CaptchaState::Error.token(), "error");
    }

    #[test]
    fn captcha_challenge_index_rotates_with_the_attempt() {
        assert_eq!(captcha_challenge_index(0, 3), 0);
        assert_eq!(captcha_challenge_index(1, 3), 1);
        assert_eq!(captcha_challenge_index(3, 3), 0);
        assert_eq!(captcha_challenge_index(7, 3), 1);
        // No challenges: the index stays 0 and `active` is None.
        assert_eq!(captcha_challenge_index(5, 0), 0);
        assert_eq!(captcha_active_challenge(&[], 5), None);
        let challenges = vec![
            CaptchaChallenge::new("AB", 1),
            CaptchaChallenge::new("CD", 2),
        ];
        assert_eq!(
            captcha_active_challenge(&challenges, 0).map(|challenge| challenge.glyphs.as_str()),
            Some("AB")
        );
        assert_eq!(
            captcha_active_challenge(&challenges, 1).map(|challenge| challenge.glyphs.as_str()),
            Some("CD")
        );
        assert_eq!(
            captcha_active_challenge(&challenges, 2).map(|challenge| challenge.glyphs.as_str()),
            Some("AB")
        );
    }

    #[test]
    fn captcha_challenge_layout_is_deterministic_and_in_bounds() {
        // The default box.
        let default_challenge = CaptchaChallenge::default();
        assert_eq!(default_challenge.box_width(), 200.0);
        assert_eq!(default_challenge.box_height(), 60.0);
        // A degenerate box is clamped, never collapsed to zero.
        let tiny = CaptchaChallenge {
            glyphs: "ABCD".to_string(),
            seed: 3,
            width: 0,
            height: 0,
        };
        assert_eq!(tiny.box_width(), 32.0);
        assert_eq!(tiny.box_height(), 32.0);

        let challenge = CaptchaChallenge::new("7FK2", 42);
        let (glyphs, lines, dots) = captcha_challenge_layout(&challenge);
        assert_eq!(glyphs.len(), 4);
        assert_eq!(lines.len(), 4);
        assert_eq!(dots.len(), 24);
        // Same seed, same frame.
        assert_eq!(
            captcha_challenge_layout(&challenge),
            captcha_challenge_layout(&challenge)
        );
        // A different seed moves the jitter.
        let other = CaptchaChallenge::new("7FK2", 43);
        assert_ne!(
            captcha_challenge_layout(&challenge),
            captcha_challenge_layout(&other)
        );
        // Characters are preserved in reading order and each keeps its cell.
        let painted: String = glyphs.iter().map(|glyph| glyph.ch).collect();
        assert_eq!(painted, "7FK2");
        let mut previous_x = 0.0;
        for glyph in &glyphs {
            assert!(glyph.x > previous_x, "glyphs advance left to right");
            previous_x = glyph.x;
            assert!(glyph.x > 0.0 && glyph.x < challenge.box_width());
            assert!(glyph.y > 0.0 && glyph.y < challenge.box_height());
            assert!(glyph.size >= 18.0 * 0.85 && glyph.size <= 34.0 * 1.15);
            assert!(glyph.rotate.abs() <= 12.0);
        }
        for line in &lines {
            assert!(line.x1 >= 0.0 && line.x1 <= challenge.box_width());
            assert!(line.y1 >= 0.0 && line.y1 <= challenge.box_height());
            assert!(line.x2 >= 0.0 && line.x2 <= challenge.box_width());
            assert!(line.y2 >= 0.0 && line.y2 <= challenge.box_height());
        }
        for dot in &dots {
            assert!(dot.cx >= 0.0 && dot.cx <= challenge.box_width());
            assert!(dot.cy >= 0.0 && dot.cy <= challenge.box_height());
            assert!(dot.radius >= 0.6 && dot.radius <= 2.2);
        }
        // An empty challenge still paints the ground (and no glyph).
        let (empty_glyphs, _, _) = captcha_challenge_layout(&CaptchaChallenge::default());
        assert!(empty_glyphs.is_empty());
    }

    #[test]
    fn captcha_challenge_svg_escapes_the_host_glyphs() {
        // Seven glyphs, five of them markup-significant.
        let svg = captcha_challenge_svg(&CaptchaChallenge::new("A<b>&\"'", 9));
        assert!(svg.starts_with("<svg"));
        assert!(svg.ends_with("</svg>"));
        assert!(svg.contains(r#"class="s-captcha-challenge""#));
        assert!(svg.contains(r#"role="img""#));
        // The generic accessibility label, never the answer.
        assert!(svg.contains(r#"aria-label="Verification challenge""#));
        // Markup is escaped: a host glyph cannot open a tag or an attribute.
        for escaped in [
            "&lt;</text>",
            "&gt;</text>",
            "&amp;</text>",
            "&quot;</text>",
            "&#39;</text>",
        ] {
            assert!(svg.contains(escaped), "missing {escaped}: {svg}");
        }
        assert!(!svg.contains("<b>"), "{svg}");
        // One text node per glyph, all inside the default box.
        assert_eq!(svg.matches("<text").count(), 7);
        assert_eq!(svg.matches("<line").count(), 4);
        assert_eq!(svg.matches("<circle").count(), 24);
        assert!(svg.contains(r#"width="200" height="60""#), "{svg}");
    }

    #[test]
    fn captcha_classes_match_the_vue_root() {
        assert_eq!(captcha_classes(false, ""), "s-captcha-widget");
        assert_eq!(
            captcha_classes(true, ""),
            "s-captcha-widget s-captcha-widget-placeholder"
        );
        assert_eq!(captcha_classes(false, "host"), "s-captcha-widget host");
        assert_eq!(CaptchaProvider::Turnstile.token(), "turnstile");
        assert_eq!(CaptchaProvider::Recaptcha.token(), "recaptcha");
        assert_eq!(CaptchaProvider::default(), CaptchaProvider::Turnstile);
    }

    #[test]
    fn captcha_shield_glyph_keeps_the_vue_markup() {
        assert!(CAPTCHA_SHIELD_SVG.contains("lucide-shield-alert-icon"));
        assert!(CAPTCHA_SHIELD_SVG.contains(r#"width="16""#));
        assert!(CAPTCHA_SHIELD_SVG.contains(r#"aria-hidden="true""#));
        assert!(!CAPTCHA_SHIELD_SVG.contains("class=\"s-"));
    }

    // ── the DOM contract ─────────────────────────────────────────────────

    #[test]
    fn captcha_props_default_matches_the_vue_props() {
        let props = CaptchaWidgetProps::default();
        // Vue's `siteKey` is required; the Rust default is the no-op mode.
        assert_eq!(props.site_key, "");
        assert_eq!(props.provider, CaptchaProvider::Turnstile);
        assert_eq!(props.attempt, 0);
        assert!(!props.disabled);
        assert!(props.challenges.is_empty());
        assert_eq!(props.state, CaptchaState::Idle);
        assert!(props.challenge_content.is_none());
        assert_eq!(props.class, "");
    }

    #[test]
    fn captcha_renders_the_placeholder_arm() {
        // The no-op mode: an empty site key alone is enough (Vue's computed).
        let html = CaptchaWidget(CaptchaWidgetProps::default()).render_to_html();
        for needle in [
            r#"class="s-captcha-widget s-captcha-widget-placeholder""#,
            r#"data-state="placeholder""#,
            r#"style="display:contents""#,
            "lucide-shield-alert-icon",
            "Verification is not configured for this deployment",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        // The provider box/state never renders in this branch.
        assert!(!html.contains("s-captcha-widget-host"), "{html}");
        assert!(!html.contains("data-provider"), "{html}");
        assert!(!html.contains("s-captcha-widget-loading"), "{html}");

        // `disabled` forces the same branch with a real site key.
        let disabled = CaptchaWidget(CaptchaWidgetProps {
            site_key: "site-key".to_string(),
            disabled: true,
            state: CaptchaState::Error,
            ..Default::default()
        })
        .render_to_html();
        assert!(
            disabled.contains("s-captcha-widget-placeholder"),
            "{disabled}"
        );
        assert!(
            disabled.contains(r#"data-state="placeholder""#),
            "{disabled}"
        );
    }

    #[test]
    fn captcha_renders_the_provider_and_state_arms() {
        // Loading: the status line plus the host box, in Vue's order.
        let loading = CaptchaWidget(CaptchaWidgetProps {
            site_key: "site-key".to_string(),
            state: CaptchaState::Loading,
            class: "host".to_string(),
            challenges: vec![CaptchaChallenge::new("7FK2", 5)],
            ..Default::default()
        })
        .render_to_html();
        for needle in [
            r#"class="s-captcha-widget host""#,
            r#"data-state="loading""#,
            r#"data-provider="turnstile""#,
            r#"class="s-captcha-widget-loading""#,
            "Loading verification widget…",
            r#"class="s-captcha-widget-host""#,
            "s-captcha-challenge",
            r#"aria-label="Verification challenge""#,
        ] {
            assert!(loading.contains(needle), "missing {needle}: {loading}");
        }
        // Vue renders the loading line BEFORE the host box.
        let line_at = loading.find("s-captcha-widget-loading").expect("line");
        let host_at = loading.find("s-captcha-widget-host").expect("host");
        assert!(line_at < host_at, "{loading}");
        // The challenge glyphs are painted, not published as attributes.
        assert!(loading.contains(">7</text>"), "{loading}");

        // Idle, no loading line; the provider token follows the prop.
        let idle = CaptchaWidget(CaptchaWidgetProps {
            site_key: "site-key".to_string(),
            provider: CaptchaProvider::Recaptcha,
            challenges: vec![CaptchaChallenge::new("AB", 1)],
            ..Default::default()
        })
        .render_to_html();
        assert!(idle.contains(r#"data-state="idle""#), "{idle}");
        assert!(idle.contains(r#"data-provider="recaptcha""#), "{idle}");
        assert!(!idle.contains("s-captcha-widget-loading"), "{idle}");

        // Error and verified states publish their token; the host slot wins
        // over the injected challenge.
        let error = CaptchaWidget(CaptchaWidgetProps {
            site_key: "site-key".to_string(),
            state: CaptchaState::Error,
            challenge_content: Some(rsx! {
                span { class: "host-challenge" }
            }),
            challenges: vec![CaptchaChallenge::new("AB", 1)],
            ..Default::default()
        })
        .render_to_html();
        assert!(error.contains(r#"data-state="error""#), "{error}");
        assert!(error.contains(r#"class="host-challenge""#), "{error}");
        assert!(!error.contains("s-captcha-challenge"), "{error}");
        let verified = CaptchaWidget(CaptchaWidgetProps {
            site_key: "site-key".to_string(),
            state: CaptchaState::Verified,
            ..Default::default()
        })
        .render_to_html();
        assert!(verified.contains(r#"data-state="verified""#), "{verified}");
        // No challenge injected: the host box stays (Vue's empty mount point).
        assert!(
            verified.contains(r#"class="s-captcha-widget-host""#),
            "{verified}"
        );

        // `attempt` rotates the painted challenge.
        let rotated = CaptchaWidget(CaptchaWidgetProps {
            site_key: "site-key".to_string(),
            attempt: 1,
            challenges: vec![
                CaptchaChallenge::new("AB", 1),
                CaptchaChallenge::new("CD", 2),
            ],
            ..Default::default()
        })
        .render_to_html();
        assert!(rotated.contains(">C</text>"), "{rotated}");
        assert!(!rotated.contains(">A</text>"), "{rotated}");
    }

    #[test]
    fn captcha_styles_come_from_the_canonical_vue_sheet() {
        let css = CaptchaWidgetComponent::styles();
        for needle in [
            ".s-captcha-widget",
            ".s-captcha-widget-loading",
            ".s-captcha-widget-host",
            ".s-captcha-widget-placeholder",
            "min-height",
        ] {
            assert!(
                css.contains(needle),
                "captcha css must carry the vue hook {needle}"
            );
        }
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored captcha widget sheet"
        );
    }
}
