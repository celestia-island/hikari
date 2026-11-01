// packages/components/src/layout/share_bar.rs
// ShareBar — mirror of the canonical Vue `HkShareBar` (the horizontal
// share/proportion bar: label + track/fill + value).
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkShareBar.scss`, vendored under
// `src/styles/vue-mirror/`), compiled with `no_hash` so the
// `.hk-share-bar*` class names are literal and identical in both forms.
//
// DOM contract (mirrors Vue's render output one-to-one):
//
//   div.hk-share-bar[role="img"][aria-label="{label}: {pct}%"] [+host class]
//     span.hk-share-bar-label[title="{label}"]              (the row label)
//     span.hk-share-bar-track
//       span.hk-share-bar-fill (style: width:{pct}%[;background:{color}])
//     span.hk-share-bar-caption                             (`caption` | value)
//
// Vue prop mapping: `label` / `value` / `total` one-to-one (Vue marks all
// three required; the Rust defaults are the zeroed reading), `caption` →
// [`ShareBarProps::caption`] (pre-formatted value text, wins over the raw
// number), `percentOverride` → `percent_override` (the 0–100 override that
// skips the `value`/`total` division), `color` → the fill's optional
// `background`. Every number the sheet sees comes out of
// [`share_bar_percent`], a pure port of Vue's `pct` computed plus its clamp.
//
// State contract: the bar is STATELESS — geometry and colour are derived per
// render from the props, so no local state, no thread-local registry, no DOM
// write (the tairitsu 0.5.22 `use_signal` / `use_state` limits — ledger L48).
//
// The clipboard path (mirror extension, wave brief: wasip2 has NO clipboard):
// Vue's bar owns no copy affordance at all — it is a proportion bar — so the
// canonical DOM stays untouched by default. A host that wants copy-to-clipboard
// passes [`ShareBarProps::on_copy`]; the bar then becomes an activation surface
// (`role="button"`, `tabindex="0"`, `data-copyable`) and fires the handler with
// its own accessible text ([`share_bar_copy_text`]) on click / Enter / Space.
// The mirror NEVER touches a clipboard API; what happens with the text is the
// host's business. Without a handler the node is Vue's byte-for-byte.
//
// Deltas vs Vue (documented, not accidental):
//   * `value.toLocaleString()` has no locale table in this crate: the mirror
//     renders the en-US grouped form ([`share_bar_group_thousands`]), which is
//     what a locale-less Vue host prints.
//   * The width keeps Vue's raw float (`50.0` → `50`, `1/3` →
//     `33.333333333333336`), because the sheet transitions the width and a
//     rounded value would make the fill disagree with the aria-label's one
//     decimal.
//   * `class` is an explicit prop appended last (Vue: attribute fallthrough).

use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct ShareBarComponent;

/// Vue's `pct` computed AND its `Math.max(0, Math.min(100, …))` clamp in one
/// pure step: the explicit override wins, otherwise `value / total * 100`
/// (`0` when `total` is not positive), then clamped into 0–100.
pub fn share_bar_percent(value: f64, total: f64, percent_override: Option<f64>) -> f64 {
    let pct = percent_override.unwrap_or(if total > 0.0 {
        (value / total) * 100.0
    } else {
        0.0
    });
    pct.clamp(0.0, 100.0)
}

/// JS number → string for the geometry (`50.0` prints `50`, like JS, and a
/// signed zero prints `0` — the same normalisation `toFixed` applies).
pub fn share_bar_number(value: f64) -> String {
    if value == 0.0 {
        return "0".to_string();
    }
    format!("{value}")
}

/// The fill's inline width, exactly Vue's `` `${clamped}%` ``.
pub fn share_bar_width(pct: f64) -> String {
    format!("{}%", share_bar_number(pct))
}

/// The fill's full inline style: the width, then the optional host colour —
/// Vue spreads `background` in only when `color` is set.
pub fn share_bar_fill_style(pct: f64, color: Option<&str>) -> String {
    let mut style = format!("width:{}", share_bar_width(pct));
    if let Some(color) = color {
        style.push_str(";background:");
        style.push_str(color);
    }
    style
}

/// Vue's `aria-label`: `"{label}: {clamped.toFixed(1)}%"` — one decimal, so
/// the announcement does not read a long float.
pub fn share_bar_aria_label(label: &str, pct: f64) -> String {
    format!("{label}: {pct:.1}%")
}

/// The payload [`ShareBarProps::on_copy`] receives: the bar's own accessible
/// text. Kept as its own function so the copy contract cannot drift from the
/// announcement it is derived from.
pub fn share_bar_copy_text(label: &str, pct: f64) -> String {
    share_bar_aria_label(label, pct)
}

/// `toLocaleString()`'s en-US grouping (3-digit groups in the integer part,
/// the fraction passed through): the values a share bar carries are counts and
/// one-decimal shares, and this crate has no locale table to consult.
pub fn share_bar_group_thousands(value: f64) -> String {
    // JS prints `NaN` / `Infinity` here too; never group them.
    if !value.is_finite() {
        return format!("{value}");
    }
    let text = format!("{value}");
    let (sign, rest) = match text.strip_prefix('-') {
        Some(rest) => ("-", rest),
        None => ("", text.as_str()),
    };
    let (int_part, frac_part) = match rest.split_once('.') {
        Some((int_part, frac_part)) => (int_part, Some(frac_part)),
        None => (rest, None),
    };
    let mut grouped = String::with_capacity(int_part.len() + int_part.len() / 3);
    for (index, digit) in int_part.chars().enumerate() {
        if index > 0 && (int_part.len() - index) % 3 == 0 {
            grouped.push(',');
        }
        grouped.push(digit);
    }
    match frac_part {
        Some(frac_part) => format!("{sign}{grouped}.{frac_part}"),
        None => format!("{sign}{grouped}"),
    }
}

/// Vue's caption: the pre-formatted `caption` wins, otherwise the raw value
/// through `toLocaleString()`.
pub fn share_bar_caption(caption: Option<&str>, value: f64) -> String {
    match caption {
        Some(caption) => caption.to_string(),
        None => share_bar_group_thousands(value),
    }
}

/// The root class list: `.hk-share-bar` plus the host class appended last.
pub fn share_bar_root_classes(class: &str) -> String {
    let mut classes = String::from("hk-share-bar");
    if !class.is_empty() {
        classes.push(' ');
        classes.push_str(class);
    }
    classes
}

#[define_props]
pub struct ShareBarProps {
    /// The row label (Vue: required `label`).
    pub label: String,

    /// The numerator (Vue: required `value`).
    #[default(0.0)]
    pub value: f64,

    /// The denominator (Vue: required `total`).
    #[default(0.0)]
    pub total: f64,

    /// Pre-formatted value text; defaults to the raw number.
    pub caption: Option<String>,

    /// 0–100 override for the bar width; defaults to `value / total`.
    pub percent_override: Option<f64>,

    /// Bar fill colour (any CSS colour); defaults to the sheet's primary.
    pub color: Option<String>,

    /// Clipboard path (see the file header): fires with the bar's accessible
    /// text. `None` leaves Vue's node untouched — no activation, no clipboard.
    pub on_copy: Option<EventHandler<String>>,

    /// Vue attribute fallthrough onto the root `<div>`.
    #[default]
    pub class: String,
}

#[component]
pub fn ShareBar(props: ShareBarProps) -> Element {
    let pct = share_bar_percent(props.value, props.total, props.percent_override);

    let mut root = VElement::new("div")
        .class(share_bar_root_classes(&props.class))
        .attr("aria-label", share_bar_aria_label(&props.label, pct));
    if let Some(on_copy) = props.on_copy.clone() {
        // Opt-in copy surface: the canonical `role="img"` has no activation
        // path, so the mirror swaps the role instead of stacking two meanings
        // on one node.
        let payload = share_bar_copy_text(&props.label, pct);
        let click_copy = on_copy.clone();
        let click_payload = payload.clone();
        root = root
            .attr("role", "button")
            .attr("tabindex", "0")
            .attr("data-copyable", "")
            .on_click(move |_event: MouseEvent| click_copy.call(click_payload.clone()))
            .on_keydown(move |event: KeyboardEvent| {
                if event.key == "Enter" || event.key == " " {
                    event.prevent_default();
                    on_copy.call(payload.clone());
                }
            });
    } else {
        root = root.attr("role", "img");
    }

    let caption = share_bar_caption(props.caption.as_deref(), props.value);

    root = root.child(rsx! {
        span {
            class: "hk-share-bar-label",
            title: props.label.clone(),
            {props.label.clone()}
        }
    });

    let fill = VElement::new("span")
        .class("hk-share-bar-fill")
        .style(share_bar_fill_style(pct, props.color.as_deref()));
    let track = VElement::new("span")
        .class("hk-share-bar-track")
        .child(VNode::Element(Box::new(fill)));

    root = root.child(VNode::Element(Box::new(track))).child(rsx! {
        span { class: "hk-share-bar-caption", {caption} }
    });

    VNode::Element(Box::new(root))
}

impl StyledComponent for ShareBarComponent {
    fn styles() -> &'static str {
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkShareBar.scss", no_hash }
            .0
    }

    fn name() -> &'static str {
        "share-bar"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn share_bar_defaults_match_the_vue_props() {
        let props = ShareBarProps::default();
        assert_eq!(props.label, "");
        assert_eq!(props.value, 0.0);
        assert_eq!(props.total, 0.0);
        assert!(props.caption.is_none());
        assert!(props.percent_override.is_none());
        assert!(props.color.is_none());
        assert!(props.on_copy.is_none());
        assert_eq!(props.class, "");
    }

    #[test]
    fn share_bar_percent_matches_the_vue_computed() {
        assert_eq!(share_bar_percent(1.0, 4.0, None), 25.0);
        assert_eq!(share_bar_percent(3.0, 4.0, None), 75.0);
        // `total` not positive → 0% (Vue guards the division).
        assert_eq!(share_bar_percent(5.0, 0.0, None), 0.0);
        assert_eq!(share_bar_percent(5.0, -1.0, None), 0.0);
        // The override skips the division but still clamps.
        assert_eq!(share_bar_percent(1.0, 4.0, Some(12.5)), 12.5);
        assert_eq!(share_bar_percent(1.0, 4.0, Some(250.0)), 100.0);
        assert_eq!(share_bar_percent(1.0, 4.0, Some(-8.0)), 0.0);
        // Both directions clamp.
        assert_eq!(share_bar_percent(150.0, 100.0, None), 100.0);
        assert_eq!(share_bar_percent(-5.0, 100.0, None), 0.0);
        // Unclamped arithmetic keeps the full precision the width uses.
        let third = share_bar_percent(1.0, 3.0, None);
        assert!((third - 100.0 / 3.0).abs() < 1e-12, "{third}");
    }

    #[test]
    fn share_bar_geometry_and_label_match_the_vue_rendering() {
        // Width: the raw clamped float; aria-label: one decimal.
        assert_eq!(share_bar_width(50.0), "50%");
        assert_eq!(share_bar_width(0.0), "0%");
        assert_eq!(
            share_bar_width(share_bar_percent(8231.0, 20000.0, None)),
            "41.155%"
        );
        // A repeating fraction keeps its full precision (the sheet transitions
        // this width, so rounding it would desync the fill from the label).
        let third = share_bar_width(share_bar_percent(1.0, 3.0, None));
        assert!(third.starts_with("33.333"), "{third}");
        assert!(third.ends_with('%'), "{third}");
        assert!(!third.contains(".0%"), "{third}");
        assert_eq!(
            share_bar_aria_label("glm-5.2", share_bar_percent(8231.0, 20000.0, None)),
            "glm-5.2: 41.2%"
        );
        assert_eq!(share_bar_aria_label("a", 0.0), "a: 0.0%");
        assert_eq!(share_bar_aria_label("a", 100.0), "a: 100.0%");
        // The fill style carries the width and, only when set, the colour.
        assert_eq!(share_bar_fill_style(50.0, None), "width:50%");
        assert_eq!(
            share_bar_fill_style(50.0, Some("#ff0000")),
            "width:50%;background:#ff0000"
        );
    }

    #[test]
    fn share_bar_caption_falls_back_to_the_grouped_number() {
        assert_eq!(share_bar_caption(Some("41%"), 8231.0), "41%");
        assert_eq!(share_bar_caption(None, 8231.0), "8,231");
        assert_eq!(share_bar_caption(None, 0.0), "0");
        assert_eq!(share_bar_caption(None, 999.0), "999");
        assert_eq!(share_bar_caption(None, 1000.0), "1,000");
        assert_eq!(share_bar_caption(None, 1234567.0), "1,234,567");
        assert_eq!(share_bar_caption(None, -8231.0), "-8,231");
        // A fractional share keeps its fraction, grouped on the integer side.
        assert_eq!(share_bar_caption(None, 1234.5), "1,234.5");
    }

    #[test]
    fn share_bar_copy_text_is_the_accessible_text() {
        let pct = share_bar_percent(8231.0, 20000.0, None);
        // The copy payload IS the aria-label, so the two cannot drift.
        assert_eq!(
            share_bar_copy_text("glm-5.2", pct),
            share_bar_aria_label("glm-5.2", pct)
        );
        assert_eq!(share_bar_copy_text("glm-5.2", pct), "glm-5.2: 41.2%");
    }

    #[test]
    fn share_bar_root_classes_append_the_host_class() {
        assert_eq!(share_bar_root_classes(""), "hk-share-bar");
        assert_eq!(share_bar_root_classes("host"), "hk-share-bar host");
    }

    #[test]
    fn share_bar_renders_the_vue_dom_contract() {
        let html = ShareBar(ShareBarProps {
            label: "glm-5.2".to_string(),
            value: 8231.0,
            total: 20000.0,
            color: Some("#ff0000".to_string()),
            class: "host".to_string(),
            ..Default::default()
        })
        .render_to_html();

        // Attribute order follows the VNode's sorted map; class comes after.
        assert!(
            html.contains(
                r#"<div aria-label="glm-5.2: 41.2%" role="img" class="hk-share-bar host">"#
            ),
            "{html}"
        );
        // No copy handler → no activation surface at all.
        assert!(!html.contains("tabindex"), "{html}");
        assert!(!html.contains("data-copyable"), "{html}");
        // Label (with its title), track + fill, caption — in emission order.
        let label = html.find("hk-share-bar-label").expect("label");
        let track = html.find("hk-share-bar-track").expect("track");
        let fill = html.find("hk-share-bar-fill").expect("fill");
        let caption = html.find("hk-share-bar-caption").expect("caption");
        assert!(label < track && track < fill && fill < caption, "{html}");
        assert!(html.contains(r#"title="glm-5.2""#), "{html}");
        assert!(
            html.contains(r#"style="width:41.155%;background:#ff0000""#),
            "{html}"
        );
        // The caption is the grouped raw value (no `caption` prop supplied).
        assert!(html.contains(">8,231<"), "{html}");
    }

    #[test]
    fn share_bar_copy_is_an_opt_in_activation_surface() {
        let html = ShareBar(ShareBarProps {
            label: "share".to_string(),
            value: 1.0,
            total: 4.0,
            on_copy: Some(event_handler(|_payload: String| {})),
            ..Default::default()
        })
        .render_to_html();

        // The role/activation markers only exist because the host opted in.
        assert!(html.contains(r#"role="button""#), "{html}");
        assert!(html.contains(r#"tabindex="0""#), "{html}");
        assert!(html.contains(r#"data-copyable="""#), "{html}");
        assert!(!html.contains(r#"role="img""#), "{html}");
        // The geometry is unaffected by the copy path.
        assert!(html.contains(r#"aria-label="share: 25.0%""#), "{html}");
        assert!(html.contains(r#"style="width:25%""#), "{html}");
    }

    #[test]
    fn share_bar_handles_an_empty_denominator_and_override() {
        // total = 0 → 0% (no NaN, no division by zero).
        let html = ShareBar(ShareBarProps {
            label: "none".to_string(),
            value: 4.0,
            total: 0.0,
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains(r#"aria-label="none: 0.0%""#), "{html}");
        assert!(html.contains(r#"style="width:0%""#), "{html}");

        // The override wins over the division and renders as supplied.
        let html = ShareBar(ShareBarProps {
            label: "over".to_string(),
            value: 1.0,
            total: 100.0,
            percent_override: Some(80.0),
            caption: Some("80%".to_string()),
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains(r#"aria-label="over: 80.0%""#), "{html}");
        assert!(html.contains(r#"style="width:80%""#), "{html}");
        assert!(html.contains(">80%<"), "{html}");
    }

    #[test]
    fn share_bar_styles_come_from_the_canonical_vue_sheet() {
        let css = ShareBarComponent::styles();
        for needle in [
            ".hk-share-bar",
            "hk-share-bar-label",
            "hk-share-bar-track",
            "hk-share-bar-fill",
            "hk-share-bar-caption",
            "prefers-reduced-motion",
        ] {
            assert!(
                css.contains(needle),
                "share-bar css must carry the vue hook {needle}"
            );
        }
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored share-bar sheet"
        );
    }
}
