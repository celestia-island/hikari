// hi-components/src/theme/about_modal.rs
// AboutModal — mirror of the canonical Vue `HkAboutModal` (the version /
// about dialog) and its mountable body `HkAboutBody` (one Vue file exports
// both; the desktop settings pane mounts the body directly, so the modal and
// the pane cannot drift — same shape here).
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkAboutModal.scss`, vendored under
// `src/styles/vue-mirror/`), compiled with `no_hash` so the
// `.s-about-modal*` class names are literal and identical in both forms.
// The sheet also carries the tone-pill (`data-tone`) ink the spec-card rows
// use. DOM contract (mirrors the Vue render output one-to-one):
//
//   Modal (title = title ?? "About", width "30rem")
//     div.s-about-modal
//       div.s-about-modal-backdrop? [aria-hidden]      (the `backdrop` layer)
//       div.s-about-modal-body
//         header.s-about-modal-header
//           div.s-about-modal-logo-frame
//             img.s-about-modal-logo-img?              (logo_src; alt="")
//             | div.s-about-modal-logo {first letter}
//           div.s-about-modal-identity
//             h2.s-about-modal-name {app_name}
//             p.s-about-modal-subtitle
//               span.s-about-modal-version "Version {version}"
//               [tagline] span.s-about-modal-subtitle-sep "·"
//                         span.s-about-modal-tagline {tagline}
//         [credits|description] div.s-about-modal-credits
//           p.s-about-modal-credits-line                (text runs + names)
//           p.s-about-modal-description?
//         [componentVersions] div.s-about-modal-rows
//           div.s-about-modal-row                       (per component)
//             span.s-about-modal-row-label {label}
//             span.s-about-modal-row-value
//               [value] span.s-about-modal-row-number {value}
//               [meta] span.s-about-modal-row-meta [data-tone] {meta}
//         [licenses|links] div.s-about-modal-chips
//           div.s-about-modal-links [data-slot=licenses] > …-links-list > a
//           div.s-about-modal-links [data-slot=links]     > …-links-list > a
//         filings: chips → div.s-about-modal-links [data-slot=filings] …
//                  bare  → div.s-about-modal-footer-links > a.s-about-modal-
//                           link.s-about-modal-footer-link
//         footer.s-about-modal-footer
//           span.hk-badge.hk-badge-muted "© {year} {copyright ?? app_name}"
//         {children}                                    (host tail content)
//
// Every link is `a.s-about-modal-link` with `data-face={chip|plain|accent}`,
// `target="_blank" rel="noopener noreferrer"` and Vue's aria-label rule
// ([`about_link_aria_label`]).
//
// Deltas vs Vue (documented, not accidental):
//   * NO BRAND GLYPH: Vue's only link icon is lucide `Github`; the packed
//     MDI set has no brand glyphs, so the leading mark never renders and
//     `s-about-modal-link-has-icon` is never emitted. An ICON-ONLY link
//     would then mount an invisible but focusable anchor, so it renders the
//     brand NAME as its visible text instead ("GitHub" — the same string
//     Vue uses for the link's accessible name; see
//     [`about_link_visible_text`]). A labeled icon link renders the label
//     alone.
//   * BACKDROP: Vue takes a FACTORY (`backdrop: () => unknown`) so the layer
//     can rebuild a live subtree; the mirror takes the subtree itself
//     (`backdrop: Option<Element>`) — the layer still owns only clipping
//     and pointer-inertness.
//   * YEAR: Vue reads `new Date().getFullYear()`; the mirror reads
//     `platform::now_timestamp()` (ms since epoch, `Date::now()` on the web)
//     through the pure civil-calendar converter [`about_year_from_unix_ms`]
//     — deterministic and testable, same live clock.
//   * The credit/link/row models are data, not slots (they were props in
//     Vue too); only the body tail (`children`) and the backdrop are vnodes.

use hikari_i18n::t;

use crate::basic::{Badge, BadgeVariant};
use crate::feedback::{Modal, ModalProps};
use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct AboutModalComponent;

/// How a link presents itself (Vue: `"chip" | "plain" | "accent"`, default
/// `chip`).
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum AboutLinkFace {
    #[default]
    Chip,
    Plain,
    Accent,
}

impl AboutLinkFace {
    /// The `data-face` value exactly as Vue emits it.
    pub fn data_face(self) -> &'static str {
        match self {
            AboutLinkFace::Chip => "chip",
            AboutLinkFace::Plain => "plain",
            AboutLinkFace::Accent => "accent",
        }
    }
}

/// Leading icon a link can carry (Vue: `"github"` — the only key).
#[derive(Clone, Copy, PartialEq, Debug)]
pub enum AboutLinkIcon {
    Github,
}

impl AboutLinkIcon {
    /// The brand name — locale-invariant, so it doubles as the accessible
    /// name of an icon-only link and (mirror delta) as that link's visible
    /// text.
    pub fn brand_name(self) -> &'static str {
        match self {
            AboutLinkIcon::Github => "GitHub",
        }
    }
}

/// One link (Vue: `HAboutLink`).
#[derive(Clone, PartialEq, Debug, Default)]
pub struct AboutLink {
    /// Visible text; `None`/empty with an `icon` is an icon-only link.
    pub label: Option<String>,
    pub href: String,
    /// Optional leading icon (see the header delta — the mark itself never
    /// renders; the name does).
    pub icon: Option<AboutLinkIcon>,
    /// Link face (Vue default `chip`).
    pub face: Option<AboutLinkFace>,
    /// Accessible name override for an icon-only link.
    pub aria_label: Option<String>,
}

/// One credits-sentence part (Vue: `HAboutCredit` — a literal `text` run or
/// a linked `name`).
#[derive(Clone, PartialEq, Debug, Default)]
pub struct AboutCredit {
    /// Literal sentence fragment (mutually exclusive with `name`).
    pub text: Option<String>,
    /// Linked (or plain) name (mutually exclusive with `text`).
    pub name: Option<String>,
    /// Target for a `name`; no target renders plain text.
    pub href: Option<String>,
    /// Face for a linked `name` (Vue default `chip`).
    pub face: Option<AboutLinkFace>,
}

/// The environment pill's tone (Vue: `metaTone`, default `neutral`).
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum AboutMetaTone {
    #[default]
    Neutral,
    Positive,
    Caution,
    /// The red "not wired up / unreachable" state (see
    /// [`AboutComponentVersion`]).
    Danger,
}

impl AboutMetaTone {
    /// The `data-tone` value exactly as Vue emits it.
    pub fn data_tone(self) -> &'static str {
        match self {
            AboutMetaTone::Neutral => "neutral",
            AboutMetaTone::Positive => "positive",
            AboutMetaTone::Caution => "caution",
            AboutMetaTone::Danger => "danger",
        }
    }
}

/// One software-component version row (Vue: `HAboutComponentVersion`): the
/// mono `value` half plus the optional human-facing `meta` pill. An EMPTY
/// `value` drops the mono cell entirely (the row then reads as one red
/// `danger` label — a host whose component is not wired up).
#[derive(Clone, PartialEq, Debug, Default)]
pub struct AboutComponentVersion {
    pub label: String,
    pub value: String,
    pub meta: Option<String>,
    pub meta_tone: Option<AboutMetaTone>,
}

/// Vue's `data-face` resolution: an unset face is `chip`.
pub fn about_link_face(face: Option<AboutLinkFace>) -> AboutLinkFace {
    face.unwrap_or_default()
}

/// Vue's `visibleLinks` filter: an entry with neither a label nor an icon
/// would render an invisible but focusable link whose only name is its raw
/// URL — drop it (`item.label || item.icon`, truthiness on the label).
/// Every row filters through here.
pub fn about_visible_links(links: &[AboutLink]) -> Vec<&AboutLink> {
    links
        .iter()
        .filter(|link| {
            let labelled = link
                .label
                .as_deref()
                .map(|text| !text.is_empty())
                .unwrap_or(false);
            labelled || link.icon.is_some()
        })
        .collect()
}

/// Vue's aria-label rule: the explicit name wins; a LABELLED link is named
/// by its own text (no attribute); an icon-only link takes the brand name;
/// anything else falls back to the raw href.
pub fn about_link_aria_label(link: &AboutLink) -> Option<String> {
    if let Some(name) = &link.aria_label {
        return Some(name.clone());
    }
    let labelled = link
        .label
        .as_deref()
        .map(|text| !text.is_empty())
        .unwrap_or(false);
    if labelled {
        return None;
    }
    if let Some(icon) = link.icon {
        return Some(icon.brand_name().to_string());
    }
    Some(link.href.clone())
}

/// The link's visible text: the label, or — mirror delta (no brand glyph,
/// see the header) — the brand name for an icon-only link, so the anchor is
/// never invisible.
pub fn about_link_visible_text(link: &AboutLink) -> String {
    if let Some(label) = link.label.as_deref().filter(|text| !text.is_empty()) {
        return label.to_string();
    }
    if let Some(icon) = link.icon {
        return icon.brand_name().to_string();
    }
    String::new()
}

/// Vue's row rule: an empty `value` skips the mono cell (the pill is then
/// the whole value cell).
pub fn about_row_renders_number(value: &str) -> bool {
    !value.is_empty()
}

/// Vue's `data-tone` resolution: an unset tone is `neutral`.
pub fn about_meta_tone(tone: Option<AboutMetaTone>) -> AboutMetaTone {
    tone.unwrap_or_default()
}

/// Vue's logo tile: the first character of the app name, uppercased (`""`
/// for an empty name — the tile then renders bare, like Vue).
pub fn about_logo_initial(app_name: &str) -> String {
    app_name
        .chars()
        .next()
        .map(|first| first.to_uppercase().to_string())
        .unwrap_or_default()
}

/// The credits block's gate (Vue: `props.credits.length > 0 ||
/// props.description` — an EMPTY description string is falsy and does not
/// open the block).
pub fn about_has_credits_block(credits_len: usize, description: Option<&str>) -> bool {
    credits_len > 0 || description.is_some_and(|text| !text.is_empty())
}

/// The copyright footer line (Vue: `© {new Date().getFullYear()}
/// {props.copyright ?? props.appName}`).
pub fn about_copyright_text(year: i32, copyright: Option<&str>, app_name: &str) -> String {
    let holder = copyright.unwrap_or(app_name);
    format!("© {year} {holder}")
}

/// Unix milliseconds → the Gregorian year (Vue: `new
/// Date().getFullYear()`; the mirror feeds `platform::now_timestamp()`
/// through this pure converter — Howard Hinnant's `civil_from_days`, the
/// standard proleptic-Gregorian inversion of the Unix epoch).
pub fn about_year_from_unix_ms(ms: f64) -> i32 {
    let days = (ms / 86_400_000.0).floor() as i64;
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097); // [0, 146096]
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146_096) / 365; // [0, 399]
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100); // [0, 365]
    let mp = (5 * doy + 2) / 153; // [0, 11]
    let month = if mp < 10 { mp + 3 } else { mp - 9 }; // [1, 12]
    let year = y + i64::from(month <= 2);
    year as i32
}

/// Wrap an element as a vnode (`tairitsu` has no `From<VElement>` impl).
fn el(node: VElement) -> VNode {
    VNode::Element(Box::new(node))
}

/// The one link renderer every row shares (Vue: `renderLink`) — `extra` is
/// the landing class (`s-about-modal-credit-link` /
/// `s-about-modal-footer-link` / "").
fn about_modal_link_node(link: &AboutLink, extra: &str) -> VNode {
    let mut classes = String::from("s-about-modal-link");
    if !extra.is_empty() {
        classes.push(' ');
        classes.push_str(extra);
    }
    let mut anchor = VElement::new("a")
        .class(classes)
        .attr("data-face", about_link_face(link.face).data_face())
        .attr("href", link.href.as_str())
        .attr("target", "_blank")
        .attr("rel", "noopener noreferrer");
    if let Some(name) = about_link_aria_label(link) {
        anchor = anchor.attr("aria-label", name);
    }
    el(anchor.child(VNode::Text(VText::new(&about_link_visible_text(link)))))
}

/// One link group (`div.s-about-modal-links[data-slot]`); `None` when no
/// entry survives the visibility filter (Vue: `renderLinks`).
fn about_modal_links_group(links: &[AboutLink], slot: &str) -> Option<VNode> {
    let visible = about_visible_links(links);
    if visible.is_empty() {
        return None;
    }
    let list = visible
        .iter()
        .map(|link| about_modal_link_node(link, ""))
        .collect::<Vec<_>>();
    Some(el(VElement::new("div")
        .class("s-about-modal-links")
        .attr("data-slot", slot)
        .child(el(VElement::new("div")
            .class("s-about-modal-links-list")
            .children(list)))))
}

/// The credits sentence (Vue: `renderCredits`) — `None` when no part has a
/// `text` or a `name`.
fn about_modal_credits_line(credits: &[AboutCredit]) -> Option<VNode> {
    let parts: Vec<&AboutCredit> = credits
        .iter()
        .filter(|part| {
            part.text.as_deref().map(|t| !t.is_empty()).unwrap_or(false)
                || part.name.as_deref().map(|n| !n.is_empty()).unwrap_or(false)
        })
        .collect();
    if parts.is_empty() {
        return None;
    }
    let mut line = VElement::new("p").class("s-about-modal-credits-line");
    for part in parts {
        let node = if let Some(name) = part.name.as_deref().filter(|n| !n.is_empty()) {
            match part.href.as_deref().filter(|h| !h.is_empty()) {
                Some(href) => about_modal_link_node(
                    &AboutLink {
                        label: Some(name.to_string()),
                        href: href.to_string(),
                        face: part.face,
                        ..Default::default()
                    },
                    "s-about-modal-credit-link",
                ),
                None => el(VElement::new("span")
                    .class("s-about-modal-credit-name")
                    .child(VNode::Text(VText::new(name)))),
            }
        } else if let Some(text) = part.text.as_deref().filter(|t| !t.is_empty()) {
            VNode::Text(VText::new(text))
        } else {
            continue;
        };
        line = line.child(node);
    }
    Some(el(line))
}

#[define_props]
pub struct AboutBodyProps {
    /// Application display name (Vue: required).
    #[default]
    pub app_name: String,

    /// Application version (e.g. "0.1.4"; Vue: required).
    #[default]
    pub version: String,

    /// Optional logo image URL — replaces the first-letter tile.
    pub logo_src: Option<String>,

    /// Optional one-liner beside the version (the app tagline). An EMPTY
    /// string renders nothing (Vue's truthiness test).
    pub tagline: Option<String>,

    /// Optional centered small line under the credits (organization blurb).
    pub description: Option<String>,

    /// Credits sentence: text runs and linked names.
    #[default]
    pub credits: Vec<AboutCredit>,

    /// License links (e.g. SySL-1.0 / BUSL-1.1), rendered centered.
    #[default]
    pub licenses: Vec<AboutLink>,

    /// Software-component version rows (WebUI / engines).
    #[default]
    pub component_versions: Vec<AboutComponentVersion>,

    /// Copyright holder in the footer (defaults to the app name).
    pub copyright: Option<String>,

    /// External links (site domains, the project's GitHub home).
    #[default]
    pub links: Vec<AboutLink>,

    /// Legal links above the copyright (ICP filings).
    #[default]
    pub footer_links: Vec<AboutLink>,

    /// Render the legal filings as a chip group instead of the bare
    /// footer-text row (the desktop surface's standing direction).
    #[default]
    pub filings_as_chips: bool,

    /// Decorative backdrop subtree, rendered behind the content inside a
    /// clipped, pointer-inert layer (Vue: a factory; see the header delta).
    pub backdrop: Option<Element>,

    /// Host tail content, appended after the copyright footer (Vue: the
    /// default slot).
    pub children: Option<Element>,
}

/// HkAboutBody — the About dialog's body, mountable OUTSIDE a modal (the
/// desktop settings pane mounts it in its own pane).
#[component]
pub fn AboutBody(props: AboutBodyProps) -> Element {
    let mut root = VElement::new("div").class("s-about-modal");
    if let Some(backdrop) = &props.backdrop {
        root = root.child(el(VElement::new("div")
            .class("s-about-modal-backdrop")
            .attr("aria-hidden", "true")
            .child(backdrop.clone())));
    }

    let mut body = VElement::new("div").class("s-about-modal-body");

    // ── identity hero ───────────────────────────────────────────────────
    let logo_inner = match props.logo_src.as_deref().filter(|src| !src.is_empty()) {
        Some(src) => el(VElement::new("img")
            .class("s-about-modal-logo-img")
            .attr("src", src)
            .attr("alt", "")
            .attr("draggable", "false")),
        None => el(VElement::new("div")
            .class("s-about-modal-logo")
            .child(VNode::Text(VText::new(&about_logo_initial(
                &props.app_name,
            ))))),
    };
    let mut subtitle = VElement::new("p")
        .class("s-about-modal-subtitle")
        .child(el(VElement::new("span")
            .class("s-about-modal-version")
            .child(VNode::Text(VText::new(&format!(
                "{} {}",
                t("components.hk.aboutModal.version", "Version"),
                props.version
            ))))));
    if let Some(tagline) = props.tagline.as_deref().filter(|text| !text.is_empty()) {
        subtitle = subtitle
            .child(el(VElement::new("span")
                .class("s-about-modal-subtitle-sep")
                .attr("aria-hidden", "true")
                .child(VNode::Text(VText::new("·")))))
            .child(el(VElement::new("span")
                .class("s-about-modal-tagline")
                .child(VNode::Text(VText::new(tagline)))));
    }
    let header = VElement::new("header")
        .class("s-about-modal-header")
        .child(el(VElement::new("div")
            .class("s-about-modal-logo-frame")
            .child(logo_inner)))
        .child(el(VElement::new("div")
            .class("s-about-modal-identity")
            .child(el(VElement::new("h2")
                .class("s-about-modal-name")
                .child(VNode::Text(VText::new(&props.app_name)))))
            .child(el(subtitle))));
    body = body.child(el(header));

    // ── credits block ───────────────────────────────────────────────────
    if about_has_credits_block(props.credits.len(), props.description.as_deref()) {
        let mut block = VElement::new("div").class("s-about-modal-credits");
        if let Some(line) = about_modal_credits_line(&props.credits) {
            block = block.child(line);
        }
        if let Some(description) = props.description.as_deref().filter(|text| !text.is_empty()) {
            block = block.child(el(VElement::new("p")
                .class("s-about-modal-description")
                .child(VNode::Text(VText::new(description)))));
        }
        body = body.child(el(block));
    }

    // ── spec card ───────────────────────────────────────────────────────
    if !props.component_versions.is_empty() {
        let mut rows = VElement::new("div").class("s-about-modal-rows");
        for component in &props.component_versions {
            let mut value_cell = VElement::new("span").class("s-about-modal-row-value");
            if about_row_renders_number(&component.value) {
                value_cell = value_cell.child(el(VElement::new("span")
                    .class("s-about-modal-row-number")
                    .child(VNode::Text(VText::new(&component.value)))));
            }
            if let Some(meta) = component.meta.as_deref().filter(|text| !text.is_empty()) {
                value_cell = value_cell.child(el(VElement::new("span")
                    .class("s-about-modal-row-meta")
                    .attr(
                        "data-tone",
                        about_meta_tone(component.meta_tone).data_tone(),
                    )
                    .child(VNode::Text(VText::new(meta)))));
            }
            rows = rows.child(el(VElement::new("div")
                .class("s-about-modal-row")
                .child(el(VElement::new("span")
                    .class("s-about-modal-row-label")
                    .child(VNode::Text(VText::new(&component.label)))))
                .child(el(value_cell))));
        }
        body = body.child(el(rows));
    }

    // ── license / external link rows ────────────────────────────────────
    // Vue's gate reads the RAW lengths (the visibility filter runs inside
    // each group), so an all-invisible list still opens the block.
    if !props.licenses.is_empty() || !props.links.is_empty() {
        let mut chips = VElement::new("div").class("s-about-modal-chips");
        if let Some(group) = about_modal_links_group(&props.licenses, "licenses") {
            chips = chips.child(group);
        }
        if let Some(group) = about_modal_links_group(&props.links, "links") {
            chips = chips.child(group);
        }
        body = body.child(el(chips));
    }

    // ── legal filings ───────────────────────────────────────────────────
    if props.filings_as_chips {
        if let Some(group) = about_modal_links_group(&props.footer_links, "filings") {
            body = body.child(group);
        }
    } else if !about_visible_links(&props.footer_links).is_empty() {
        let row = VElement::new("div")
            .class("s-about-modal-footer-links")
            .children(
                about_visible_links(&props.footer_links)
                    .iter()
                    .map(|link| about_modal_link_node(link, "s-about-modal-footer-link"))
                    .collect::<Vec<_>>(),
            );
        body = body.child(el(row));
    }

    // ── copyright footer ────────────────────────────────────────────────
    let year = about_year_from_unix_ms(crate::platform::now_timestamp());
    let copyright_line = about_copyright_text(year, props.copyright.as_deref(), &props.app_name);
    let footer = VElement::new("div")
        .class("s-about-modal-footer")
        .child(Badge(BadgeProps {
            variant: BadgeVariant::Muted,
            children: VNode::Text(VText::new(&copyright_line)),
            ..Default::default()
        }));
    body = body.child(el(footer));

    // Host tail content, still inside the body's flow (Vue: slots.default).
    if let Some(children) = &props.children {
        body = body.child(children.clone());
    }

    el(root.child(el(body)))
}

#[define_props]
pub struct AboutModalProps {
    /// Controlled open state (Vue: `modelValue`).
    #[default]
    pub open: bool,

    /// Modal title override (Vue: `title`, defaulting to "About").
    pub title: Option<String>,

    /// Every `HkAboutBody` branding prop, passed through verbatim.
    #[default]
    pub app_name: String,
    #[default]
    pub version: String,
    pub logo_src: Option<String>,
    pub tagline: Option<String>,
    pub description: Option<String>,
    #[default]
    pub credits: Vec<AboutCredit>,
    #[default]
    pub licenses: Vec<AboutLink>,
    #[default]
    pub component_versions: Vec<AboutComponentVersion>,
    pub copyright: Option<String>,
    #[default]
    pub links: Vec<AboutLink>,
    #[default]
    pub footer_links: Vec<AboutLink>,
    #[default]
    pub filings_as_chips: bool,
    pub backdrop: Option<Element>,
    pub children: Option<Element>,

    /// Fired when the user asks to close (Vue: `update:modelValue`); the
    /// shell only ever requests `false`.
    pub on_open_change: Option<EventHandler<bool>>,
}

/// HkAboutModal — a centered Modal wrapping [`AboutBody`] (Vue default width
/// `"30rem"`).
#[component]
pub fn AboutModal(props: AboutModalProps) -> Element {
    if !props.open {
        return empty_vnode();
    }

    let title = match props.title.as_deref() {
        Some(text) => text.to_string(),
        None => t("components.hk.aboutModal.title", "About"),
    };

    let on_open_change = props.on_open_change.clone();
    let on_close = Some(event_handler(move |_event: MouseEvent| {
        if let Some(handler) = on_open_change.as_ref() {
            handler.call(false);
        }
    }));

    Modal(ModalProps {
        open: true,
        title: Some(title),
        width: "30rem".to_string(),
        on_close,
        children: AboutBody(AboutBodyProps {
            app_name: props.app_name.clone(),
            version: props.version.clone(),
            logo_src: props.logo_src.clone(),
            tagline: props.tagline.clone(),
            description: props.description.clone(),
            credits: props.credits.clone(),
            licenses: props.licenses.clone(),
            component_versions: props.component_versions.clone(),
            copyright: props.copyright.clone(),
            links: props.links.clone(),
            footer_links: props.footer_links.clone(),
            filings_as_chips: props.filings_as_chips,
            backdrop: props.backdrop.clone(),
            children: props.children.clone(),
        }),
        ..Default::default()
    })
}

impl StyledComponent for AboutModalComponent {
    fn styles() -> &'static str {
        // The canonical Vue sheet, compiled verbatim (no_hash keeps the
        // `.s-about-modal*` names literal so this CSS matches Vue).
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkAboutModal.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "about-modal"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn about_face_and_tone_attrs_match_vue() {
        assert_eq!(AboutLinkFace::Chip.data_face(), "chip");
        assert_eq!(AboutLinkFace::Plain.data_face(), "plain");
        assert_eq!(AboutLinkFace::Accent.data_face(), "accent");
        assert_eq!(about_link_face(None), AboutLinkFace::Chip);
        assert_eq!(about_meta_tone(None), AboutMetaTone::Neutral);
        assert_eq!(AboutMetaTone::Positive.data_tone(), "positive");
        assert_eq!(AboutMetaTone::Caution.data_tone(), "caution");
        assert_eq!(AboutMetaTone::Danger.data_tone(), "danger");
    }

    #[test]
    fn about_visible_links_drop_the_nameless_and_markless() {
        let links = vec![
            AboutLink {
                label: Some("Site".to_string()),
                href: "https://example.com".to_string(),
                ..Default::default()
            },
            AboutLink {
                href: "https://example.com".to_string(),
                ..Default::default()
            },
            AboutLink {
                label: Some(String::new()),
                href: "https://example.com".to_string(),
                ..Default::default()
            },
            AboutLink {
                href: "https://github.com/celestia".to_string(),
                icon: Some(AboutLinkIcon::Github),
                ..Default::default()
            },
        ];
        let visible = about_visible_links(&links);
        assert_eq!(visible.len(), 2);
        assert_eq!(visible[0].label.as_deref(), Some("Site"));
        assert!(visible[1].icon.is_some());
    }

    #[test]
    fn about_link_aria_label_follows_vue_precedence() {
        // An explicit name wins, labelled links carry no attribute, an
        // icon-only link takes the brand name, the rest the raw href.
        let named = AboutLink {
            label: Some(String::new()),
            href: "https://github.com/x".to_string(),
            icon: Some(AboutLinkIcon::Github),
            aria_label: Some("Our code".to_string()),
            ..Default::default()
        };
        assert_eq!(about_link_aria_label(&named).as_deref(), Some("Our code"));
        let labelled = AboutLink {
            label: Some("Docs".to_string()),
            href: "https://example.com".to_string(),
            ..Default::default()
        };
        assert_eq!(about_link_aria_label(&labelled), None);
        let icon_only = AboutLink {
            href: "https://github.com/x".to_string(),
            icon: Some(AboutLinkIcon::Github),
            ..Default::default()
        };
        assert_eq!(about_link_aria_label(&icon_only).as_deref(), Some("GitHub"));
        // Mirror delta: an icon-only link is VISIBLE via the brand name.
        assert_eq!(about_link_visible_text(&icon_only), "GitHub");
        assert_eq!(about_link_visible_text(&labelled), "Docs");
    }

    #[test]
    fn about_row_and_credits_gates_match_vue() {
        // An empty value drops the mono cell (the danger pill is the value).
        assert!(about_row_renders_number("0.5.22"));
        assert!(!about_row_renders_number(""));
        // The credits block: raw credits length OR a non-empty description.
        assert!(about_has_credits_block(1, None));
        assert!(about_has_credits_block(0, Some("blurb")));
        // An EMPTY description is falsy in Vue — no block.
        assert!(!about_has_credits_block(0, Some("")));
        assert!(!about_has_credits_block(0, None));
    }

    #[test]
    fn about_logo_initial_and_copyright_match_vue() {
        assert_eq!(about_logo_initial("hikari"), "H");
        assert_eq!(about_logo_initial("伊欧"), "伊");
        assert_eq!(about_logo_initial(""), "");
        assert_eq!(
            about_copyright_text(2026, None, "Celestia"),
            "© 2026 Celestia"
        );
        assert_eq!(
            about_copyright_text(2026, Some("Island Co."), "Celestia"),
            "© 2026 Island Co."
        );
    }

    #[test]
    fn about_year_converter_matches_the_calendar() {
        assert_eq!(about_year_from_unix_ms(0.0), 1970);
        // 2023-11-14T21:33:20Z.
        assert_eq!(about_year_from_unix_ms(1_700_000_000_000.0), 2023);
        // 2024-01-01T00:00:00Z — the boundary itself.
        assert_eq!(about_year_from_unix_ms(1_704_067_200_000.0), 2024);
        // New Year's Eve 23:59:59.999 is still the old year.
        assert_eq!(about_year_from_unix_ms(1_704_067_199_999.0), 2023);
        // 2100-03-01 — the century NON-leap edge (Feb 2100 had 28 days).
        assert_eq!(about_year_from_unix_ms(4_107_542_400_000.0), 2100);
    }

    #[test]
    fn about_defaults_match_the_vue_props() {
        let props = AboutModalProps::default();
        assert!(!props.open);
        assert!(props.title.is_none());
        assert_eq!(props.app_name, "");
        assert_eq!(props.version, "");
        assert!(props.logo_src.is_none());
        assert!(props.tagline.is_none());
        assert!(props.description.is_none());
        assert!(props.credits.is_empty());
        assert!(props.licenses.is_empty());
        assert!(props.component_versions.is_empty());
        assert!(props.copyright.is_none());
        assert!(props.links.is_empty());
        assert!(props.footer_links.is_empty());
        assert!(!props.filings_as_chips);
        assert!(props.backdrop.is_none());
        assert!(props.children.is_none());
        assert!(props.on_open_change.is_none());
    }

    #[test]
    fn about_modal_renders_the_vue_dialog() {
        let html = AboutModal(AboutModalProps {
            open: true,
            app_name: "Celestia".to_string(),
            version: "0.1.4".to_string(),
            tagline: Some("Island OS".to_string()),
            description: Some("From the island, by the island".to_string()),
            credits: vec![
                AboutCredit {
                    text: Some("来自 ".to_string()),
                    ..Default::default()
                },
                AboutCredit {
                    name: Some("Celestia Island".to_string()),
                    href: Some("https://example.com".to_string()),
                    face: Some(AboutLinkFace::Accent),
                    ..Default::default()
                },
                AboutCredit {
                    name: Some("伊欧".to_string()),
                    ..Default::default()
                },
            ],
            component_versions: vec![
                AboutComponentVersion {
                    label: "WebUI".to_string(),
                    value: "0.1.4".to_string(),
                    ..Default::default()
                },
                AboutComponentVersion {
                    label: "Edge engine".to_string(),
                    value: String::new(),
                    meta: Some("unreachable".to_string()),
                    meta_tone: Some(AboutMetaTone::Danger),
                },
            ],
            licenses: vec![AboutLink {
                label: Some("SySL-1.0".to_string()),
                href: "https://example.com/license".to_string(),
                ..Default::default()
            }],
            links: vec![AboutLink {
                href: "https://github.com/celestia".to_string(),
                icon: Some(AboutLinkIcon::Github),
                face: Some(AboutLinkFace::Plain),
                ..Default::default()
            }],
            footer_links: vec![AboutLink {
                label: Some("京ICP备00000000号".to_string()),
                href: "https://beian.example.com".to_string(),
                face: Some(AboutLinkFace::Plain),
                ..Default::default()
            }],
            ..Default::default()
        })
        .render_to_html();
        for needle in [
            // The Modal shell (Vue default title/width).
            r#"class="hk-modal-root""#,
            r#"aria-label="About""#,
            // The body.
            r#"class="s-about-modal""#,
            "s-about-modal-header",
            "s-about-modal-logo-frame",
            "s-about-modal-logo\">C",
            "s-about-modal-name",
            "s-about-modal-version",
            "Version 0.1.4",
            "s-about-modal-subtitle-sep",
            "Island OS",
            "s-about-modal-credits-line",
            "s-about-modal-credit-link",
            r#"data-face="accent""#,
            "s-about-modal-credit-name",
            "s-about-modal-description",
            "s-about-modal-rows",
            "s-about-modal-row-number",
            "0.1.4",
            // The unreachable engine: pill alone, mono cell dropped.
            r#"data-tone="danger""#,
            "unreachable",
            "s-about-modal-links-list",
            r#"data-slot="licenses""#,
            r#"data-slot="links""#,
            "SySL-1.0",
            // The icon-only GitHub link stays visible (mirror delta).
            ">GitHub<",
            "s-about-modal-footer-links",
            "s-about-modal-footer-link",
            "京ICP备00000000号",
            "s-about-modal-footer",
            "hk-badge-muted",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        // The empty-value row carries no mono number cell.
        let edge = html.find("Edge engine").expect("edge row");
        let number = html
            .find("s-about-modal-row-number")
            .expect("a number cell exists (WebUI)");
        assert!(
            number < edge,
            "the edge row must not open a mono cell: {html}"
        );
        // Every link opens a new tab,noopener.
        assert!(html.contains(r#"target="_blank""#), "{html}");
        assert!(html.contains(r#"rel="noopener noreferrer""#), "{html}");
        // The copyright holder defaults to the app name; the year comes from
        // the platform clock (0 in the native test stub → 1970).
        assert!(html.contains("© 1970 Celestia"), "{html}");
    }

    #[test]
    fn about_modal_filings_as_chips_swaps_the_row() {
        let base = AboutModalProps {
            open: true,
            app_name: "Celestia".to_string(),
            version: "0.1.4".to_string(),
            footer_links: vec![AboutLink {
                label: Some("京ICP备00000000号".to_string()),
                href: "https://beian.example.com".to_string(),
                ..Default::default()
            }],
            ..Default::default()
        };
        let bare = AboutModal(base.clone()).render_to_html();
        assert!(bare.contains("s-about-modal-footer-links"), "{bare}");
        assert!(!bare.contains(r#"data-slot="filings""#), "{bare}");

        let chips = AboutModal(AboutModalProps {
            filings_as_chips: true,
            ..base
        })
        .render_to_html();
        assert!(chips.contains(r#"data-slot="filings""#), "{chips}");
        assert!(!chips.contains("s-about-modal-footer-links"), "{chips}");
    }

    #[test]
    fn about_modal_logo_src_swaps_the_tile() {
        let html = AboutModal(AboutModalProps {
            open: true,
            app_name: "Celestia".to_string(),
            version: "0.1.4".to_string(),
            logo_src: Some("/logo.png".to_string()),
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains(r#"src="/logo.png""#), "{html}");
        assert!(html.contains(r#"alt="""#), "{html}");
        assert!(!html.contains("s-about-modal-logo\""), "{html}");
    }

    #[test]
    fn about_modal_closed_renders_nothing() {
        let html = AboutModal(AboutModalProps {
            app_name: "Celestia".to_string(),
            version: "0.1.4".to_string(),
            ..Default::default()
        })
        .render_to_html();
        assert!(html.is_empty(), "a closed about mounts nothing: {html}");
    }

    #[test]
    fn about_modal_styles_come_from_the_canonical_vue_sheet() {
        let css = AboutModalComponent::styles();
        for needle in [
            ".s-about-modal",
            ".s-about-modal-header",
            ".s-about-modal-row-meta",
            ".s-about-modal-link[data-face=plain]",
            ".s-about-modal-footer-links",
        ] {
            assert!(css.contains(needle), "about css must carry {needle}: {css}");
        }
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored about sheet"
        );
        assert_eq!(AboutModalComponent::name(), "about-modal");
    }
}
