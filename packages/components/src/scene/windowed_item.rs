// hi-components/src/scene/windowed_item.rs
// WindowedItem — mirror of the canonical Vue `HkWindowedItem`.
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkWindowedItem.scss`, vendored under
// `src/styles/vue-mirror/`), compiled with `no_hash` so the
// `.hk-windowed-item*` class names are literal and identical in both forms.
// DOM contract (mirrors the Vue render output):
//
//   Tag.hk-windowed-item [host class]              (Vue `as`, default `div`)
//        data-state="real"|"placeholder"           (ALWAYS present)
//        [data-windowed-key={itemKey}]             (absent when the host has no key)
//        (style: height:{H}px                      placeholder arm ONLY — the
//                [;top:{V}px])                     reserved box, see the [D] delta
//        [aria-hidden="true"]                      placeholder arm ONLY
//     {children}                                   real arm ONLY (Vue:
//                                                  `showReal ? slots.default() : null`)
//
// A placeholder is a RESERVED BOX: it keeps the item's height so the scroll
// length does not collapse while the item is out of the window, it is invisible
// to pointer input and transparent (`[data-state="placeholder"]` in the sheet),
// and it is hidden from assistive tech. The real arm carries NO style attribute
// at all — exactly Vue's `style={placeholderStyle}` where the placeholder style
// is `undefined` on that arm.
//
// Prop mapping: `itemKey` → `item_key`, `estimatedHeight` → `estimated_height`
// (Vue default 96), `overscanScreens` → `overscan_screens` (Vue default `null`),
// `as` → `tag` (Vue's `as` is a Rust keyword — the same rename `ListTransition`
// applies to Vue's `move`), and the default slot → `children`.
//
// Controlled state (tairitsu 0.5.22 has no per-instance component state —
// ledger L48: `use_signal` allocates a fresh signal on every render and
// `use_state` shares ONE slot per component TYPE). Vue's `inWindow` /
// `measuredHeight` refs become the props `in_window` / `measured_height`; the
// `IntersectionObserver`, the `onceFrame(measure)` pass and the
// `watch(scrollRoot)` re-observation are gone with them. Nothing is stored
// here.
//
// Deltas vs Vue (documented, not accidental):
//   * NO IntersectionObserver and no DOM measurement. The window membership
//     itself is the controlled `in_window` prop: `Some(true)` = the item is in
//     the window (Vue's `inWindow` true), `Some(false)` = it is not, and `None`
//     = there is NO scroll-window context to judge against — Vue's `!ctx` arm,
//     which renders the real content unconditionally. [`windowed_item_in_buffer`]
//     is Vue's `withinBuffer` rect arithmetic, [`windowed_item_root_margin`] the
//     observer's `rootMargin` string and [`windowed_item_overscan_scale`] the
//     drawn-scale factor that widened the buffer, so a host's own observer
//     reproduces Vue's verdict exactly.
//   * `measured_height` is a prop, not a ref: Vue measures the mounted node in a
//     `onceFrame` and re-measures whenever the item re-enters the window. Vue
//     only ever stores a POSITIVE height (`if (h > 0)`), so a host passes the
//     same validated reading; the mirror does not re-clamp it, because clamping
//     here would silently disagree with the sheet's reserved box.
//   * [D] `offset_top` is a MIRROR-ONLY prop (Vue has no equivalent): Vue's item
//     stays in flow (`display: block; break-inside: avoid`) and its position
//     comes from the host's layout, so this file cannot invent one. A host that
//     positions windowed rows ABSOLUTELY (the usual virtualised-list shape)
//     hands the already-computed offset in and the mirror stamps `top:{V}px`
//     next to the reserved height; with the prop left `None` no style attribute
//     appears on the real arm and the DOM is Vue's byte for byte.
//   * [D] `class` is the fallthrough class Vue merges into the root element
//     automatically — spelled as a prop here, appended after `hk-windowed-item`.
//   * The items of a windowed list are a host concern: this component renders
//     ONE item. Vue's `HkScrollWindow` provider (the `useScrollWindow` context
//     carrying the scroll root and the default overscan) is not mirrored — the
//     scroll root is the host's, and the overscan reaches this component as the
//     `overscan_screens` prop or as the `context` argument of
//     [`windowed_item_overscan`].
//   * No i18n: the component renders no user-facing string (a placeholder is an
//     empty reserved box), so this file adds ZERO `hikari_i18n::t` keys.

use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct WindowedItemComponent;

/// Vue's `estimatedHeight` default, in px.
pub const WINDOWED_ITEM_ESTIMATED_HEIGHT: f64 = 96.0;

/// Vue's `overscanScreens` fallback: the last link of
/// `props.overscanScreens ?? ctx?.overscanScreens ?? 1`.
pub const WINDOWED_ITEM_OVERSCAN_SCREENS: f64 = 1.0;

// ── pure functions (the sizing / window arithmetic Vue ran on the DOM) ──

/// Vue: `showReal = inWindow.value || !ctx` — with no scroll-window context the
/// item always renders its real content, so `None` maps to `true` and never to
/// the placeholder arm.
pub fn windowed_item_shows_real(in_window: Option<bool>) -> bool {
    in_window.unwrap_or(true)
}

/// Vue: `measuredHeight.value ?? props.estimatedHeight` — a real measurement
/// wins over the estimate (including `0`, which Vue's own `if (h > 0)` guard
/// makes unreachable; the prop is documented as the validated reading).
pub fn windowed_item_placeholder_height(
    measured_height: Option<f64>,
    estimated_height: f64,
) -> f64 {
    measured_height.unwrap_or(estimated_height)
}

/// JS `Number#toString` for the px values the style attribute carries (`96`
/// stays `96`, not `96.0`): Rust's shortest-round-trip `Display` for `f64`
/// already prints that way, and a zero reading prints `0` whichever way its sign
/// bit points (JS prints `0` for `-0` too). The helper exists so the contract is
/// ASSERTED rather than assumed.
pub fn windowed_item_number(value: f64) -> String {
    if value == 0.0 {
        return "0".to_string();
    }
    format!("{value}")
}

/// JS `Math.round` for the observer margin: halves round UP (toward +∞), which
/// is what `(x + 0.5).floor()` does for the non-negative overscan factors this
/// API accepts.
fn windowed_item_js_round(value: f64) -> f64 {
    (value + 0.5).floor()
}

/// Vue's `data-state`: `showReal ? "real" : "placeholder"` — the sheet's only
/// hook for the transparent, pointer-inert reserved box.
pub fn windowed_item_state(show_real: bool) -> &'static str {
    if show_real { "real" } else { "placeholder" }
}

/// Vue: `aria-hidden={showReal ? undefined : "true"}` — the reserved box is
/// hidden from the accessibility tree, the real item never is.
pub fn windowed_item_aria_hidden(show_real: bool) -> Option<&'static str> {
    if show_real { None } else { Some("true") }
}

/// The inline style of the item, in the crate's compact serialization.
///
/// The real arm carries nothing unless the host pinned an offset ([D]
/// `offset_top`); the placeholder arm always carries the reserved `height`, and
/// the `top` comes first when both are present (the geometry reads outermost
/// first — the same order `locale_popup_style` writes).
pub fn windowed_item_style(
    show_real: bool,
    placeholder_height: f64,
    offset_top: Option<f64>,
) -> Option<String> {
    let mut declarations: Vec<String> = Vec::new();
    if let Some(top) = offset_top.filter(|top| top.is_finite()) {
        declarations.push(format!("top:{}px", windowed_item_number(top)));
    }
    if !show_real {
        declarations.push(format!(
            "height:{}px",
            windowed_item_number(placeholder_height)
        ));
    }
    if declarations.is_empty() {
        None
    } else {
        Some(declarations.join(";"))
    }
}

/// Vue `as` prop resolution: an empty tag is not a valid element name, so it
/// falls back to the `div` default instead of rendering a broken root.
pub fn windowed_item_tag(tag: &str) -> &str {
    if tag.is_empty() { "div" } else { tag }
}

/// Vue's overscan fallback chain minus the context object:
/// `props.overscanScreens ?? context` (the host passes its provider's
/// `overscanScreens` as `context`; Vue's final `?? 1` is
/// [`WINDOWED_ITEM_OVERSCAN_SCREENS`]).
pub fn windowed_item_overscan(overscan_screens: Option<f64>, context: f64) -> f64 {
    overscan_screens.unwrap_or(context)
}

/// The observer's `rootMargin`: one overscan screen on the top AND the bottom,
/// `0px` horizontally (`${Math.round(overscan * 100)}% 0px …`).
pub fn windowed_item_root_margin(overscan: f64) -> String {
    let percent = windowed_item_js_round(overscan * 100.0);
    format!("{percent}% 0px {percent}% 0px")
}

/// The drawn-scale factor Vue reads through `drawnScale(scrollEl)` and turns
/// into `k`: the vertical scale while the root has laid height, else the
/// horizontal one while it has laid width, else `1`. A non-positive factor also
/// reads as `1` (Vue's `factor > 0 ? factor : 1`), so a degenerate root can
/// never shrink the buffer to nothing.
pub fn windowed_item_overscan_scale(
    scale_x: f64,
    scale_y: f64,
    offset_width: f64,
    offset_height: f64,
) -> f64 {
    let factor = if offset_height > 0.0 {
        scale_y
    } else if offset_width > 0.0 {
        scale_x
    } else {
        1.0
    };
    if factor > 0.0 { factor } else { 1.0 }
}

/// Vue's `withinBuffer`: is the item's DRAWN box within one overscan screen of
/// the scroll root's box? `buffer` widens by the drawn scale `k` because the
/// rects are drawn (a scaled or zoomed root makes them `k` times bigger) while
/// `client_height` is laid out — the mismatch Vue's comment calls out.
pub fn windowed_item_in_buffer(
    item_top: f64,
    item_bottom: f64,
    root_top: f64,
    root_bottom: f64,
    root_client_height: f64,
    overscan: f64,
    scale: f64,
) -> bool {
    let k = if scale > 0.0 { scale } else { 1.0 };
    let buffer = root_client_height * overscan * k;
    item_bottom >= root_top - buffer && item_top <= root_bottom + buffer
}

// ── the component ────────────────────────────────────────────────────────

#[define_props]
pub struct WindowedItemProps {
    /// The item's identity, stamped as `data-windowed-key` (Vue: `itemKey`;
    /// absent when the host has no key).
    pub item_key: Option<String>,

    /// Height reserved by the placeholder before the item is measured, in px
    /// (Vue: `estimatedHeight`, default 96).
    #[default(96.0)]
    pub estimated_height: f64,

    /// The window buffer in screens (Vue: `overscanScreens`, default `null`).
    /// It does not reach the DOM — it is what a host's own observer (and
    /// [`windowed_item_in_buffer`]) consumes.
    pub overscan_screens: Option<f64>,

    /// Host element tag (Vue `as`, default `div`).
    #[default("div".to_string())]
    pub tag: String,

    /// CONTROLLED window membership (Vue: `inWindow` + the presence of the
    /// scroll-window context). `None` = no context at all → the real content
    /// renders unconditionally.
    pub in_window: Option<bool>,

    /// The host's last measured height, in px (Vue: `measuredHeight`). Wins over
    /// `estimated_height`.
    pub measured_height: Option<f64>,

    /// [D] Mirror-only: the item's `top` offset in px for an absolutely
    /// positioned windowed row (Vue leaves positioning to the host's flow).
    pub offset_top: Option<f64>,

    /// Extra class appended to the root (Vue merges the fallthrough class).
    #[default]
    pub class: String,

    /// The item's content (Vue: the default slot). Rendered on the real arm
    /// ONLY.
    pub children: Element,
}

#[component]
pub fn WindowedItem(props: WindowedItemProps) -> Element {
    let show_real = windowed_item_shows_real(props.in_window);
    let height = windowed_item_placeholder_height(props.measured_height, props.estimated_height);

    let named_classes = if props.class.is_empty() {
        "hk-windowed-item".to_string()
    } else {
        format!("hk-windowed-item {}", props.class)
    };

    let mut root = VElement::new(windowed_item_tag(&props.tag))
        .class(named_classes)
        .attr("data-state", windowed_item_state(show_real))
        .attr("data-windowed-key", props.item_key.clone())
        .attr("aria-hidden", windowed_item_aria_hidden(show_real))
        .style(windowed_item_style(show_real, height, props.offset_top));

    // Vue renders `showReal ? slots.default?.() : null`: the placeholder arm
    // carries no children at all.
    if show_real {
        root = root.child(props.children.clone());
    }

    VNode::Element(Box::new(root))
}

impl StyledComponent for WindowedItemComponent {
    fn styles() -> &'static str {
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkWindowedItem.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "windowed-item"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn item(in_window: Option<bool>) -> WindowedItemProps {
        WindowedItemProps {
            item_key: Some("row-7".to_string()),
            in_window,
            children: rsx! {
                span { class: "row-body", "row-7 content" }
            },
            ..Default::default()
        }
    }

    #[test]
    fn windowed_item_defaults_match_the_vue_props() {
        let props = WindowedItemProps::default();
        assert!(props.item_key.is_none());
        assert_eq!(props.estimated_height, 96.0);
        assert_eq!(props.estimated_height, WINDOWED_ITEM_ESTIMATED_HEIGHT);
        assert!(props.overscan_screens.is_none());
        assert_eq!(props.tag, "div");
        // No published window state == Vue's `!ctx` arm.
        assert!(props.in_window.is_none());
        assert!(props.measured_height.is_none());
        assert!(props.offset_top.is_none());
        assert_eq!(props.class, "");
        // Vue's last-resort overscan is one screen.
        assert_eq!(WINDOWED_ITEM_OVERSCAN_SCREENS, 1.0);
    }

    #[test]
    fn windowed_item_placeholder_height_prefers_the_measurement() {
        assert_eq!(windowed_item_placeholder_height(None, 96.0), 96.0);
        assert_eq!(windowed_item_placeholder_height(Some(120.0), 96.0), 120.0);
        // A measured ZERO still wins: the prop is the validated reading Vue
        // stores (its `if (h > 0)` guard lives upstream).
        assert_eq!(windowed_item_placeholder_height(Some(0.0), 96.0), 0.0);
        // Single-row / single-item boundary: an estimate alone still reserves.
        assert_eq!(windowed_item_placeholder_height(None, 0.0), 0.0);
    }

    #[test]
    fn windowed_item_shows_real_without_a_window_context() {
        assert!(windowed_item_shows_real(None));
        assert!(windowed_item_shows_real(Some(true)));
        assert!(!windowed_item_shows_real(Some(false)));
        assert_eq!(windowed_item_state(true), "real");
        assert_eq!(windowed_item_state(false), "placeholder");
        // Only the placeholder arm is hidden from assistive tech.
        assert_eq!(windowed_item_aria_hidden(true), None);
        assert_eq!(windowed_item_aria_hidden(false), Some("true"));
    }

    #[test]
    fn windowed_item_style_arms_reserve_only_the_placeholder() {
        // The real arm carries NO style unless the host pinned an offset.
        assert_eq!(windowed_item_style(true, 96.0, None), None);
        // The placeholder arm reserves the height ...
        assert_eq!(
            windowed_item_style(false, 96.0, None),
            Some("height:96px".to_string())
        );
        // ... including a fractional measured height (no `96.0` spelling).
        assert_eq!(
            windowed_item_style(false, 96.5, None),
            Some("height:96.5px".to_string())
        );
        // ... and a zero reserve still renders (an empty box, not no style).
        assert_eq!(
            windowed_item_style(false, 0.0, None),
            Some("height:0px".to_string())
        );
        // [D] the pinned offset rides both arms, before the height.
        assert_eq!(
            windowed_item_style(true, 96.0, Some(288.0)),
            Some("top:288px".to_string())
        );
        assert_eq!(
            windowed_item_style(false, 96.0, Some(288.0)),
            Some("top:288px;height:96px".to_string())
        );
        // A non-finite offset is not a coordinate: it is dropped.
        assert_eq!(windowed_item_style(true, 96.0, Some(f64::NAN)), None);
    }

    #[test]
    fn windowed_item_number_formats_like_js_number_to_string() {
        assert_eq!(windowed_item_number(96.0), "96");
        assert_eq!(windowed_item_number(0.0), "0");
        // `-0` prints `0`, exactly as JS does.
        assert_eq!(windowed_item_number(-0.0), "0");
        assert_eq!(windowed_item_number(96.5), "96.5");
        assert_eq!(windowed_item_number(0.25), "0.25");
        assert_eq!(windowed_item_number(1200.0), "1200");
    }

    #[test]
    fn windowed_item_overscan_resolution_and_observer_margin() {
        // The prop wins over the context, which wins over the 1-screen default.
        assert_eq!(windowed_item_overscan(Some(2.0), 1.0), 2.0);
        assert_eq!(windowed_item_overscan(None, 1.5), 1.5);
        assert_eq!(
            windowed_item_overscan(None, WINDOWED_ITEM_OVERSCAN_SCREENS),
            1.0
        );
        // Vue's `Math.round(overscan * 100)` on both vertical edges only.
        assert_eq!(windowed_item_root_margin(0.0), "0% 0px 0% 0px");
        assert_eq!(windowed_item_root_margin(1.0), "100% 0px 100% 0px");
        assert_eq!(windowed_item_root_margin(0.5), "50% 0px 50% 0px");
        assert_eq!(windowed_item_root_margin(1.5), "150% 0px 150% 0px");
        // JS rounds halves UP (`Math.round(0.5) === 1`).
        assert_eq!(windowed_item_root_margin(0.005), "1% 0px 1% 0px");
        assert_eq!(windowed_item_root_margin(0.33), "33% 0px 33% 0px");
    }

    #[test]
    fn windowed_item_overscan_scale_picks_the_laid_axis() {
        // A laid-out height makes the VERTICAL scale authoritative ...
        assert_eq!(windowed_item_overscan_scale(2.0, 3.0, 100.0, 400.0), 3.0);
        // ... a width-only root falls back to the horizontal one ...
        assert_eq!(windowed_item_overscan_scale(2.0, 3.0, 100.0, 0.0), 2.0);
        // ... and a root with neither laid dimension reads as 1.
        assert_eq!(windowed_item_overscan_scale(2.0, 3.0, 0.0, 0.0), 1.0);
        // A non-positive scale can never shrink the buffer below 1×.
        assert_eq!(windowed_item_overscan_scale(0.0, -1.0, 100.0, 400.0), 1.0);
    }

    #[test]
    fn windowed_item_in_buffer_widens_by_one_screen() {
        // Fully inside: both edges are within the root box.
        assert!(windowed_item_in_buffer(
            120.0, 220.0, 100.0, 400.0, 300.0, 1.0, 1.0
        ));
        // Just above the root: in buffer while the 300px window reaches it.
        assert!(windowed_item_in_buffer(
            -200.0, -100.0, 100.0, 400.0, 300.0, 1.0, 1.0
        ));
        // Past the buffer: out of the window.
        assert!(!windowed_item_in_buffer(
            -500.0, -400.0, 100.0, 400.0, 300.0, 1.0, 1.0
        ));
        // Below the root, past the buffer.
        assert!(!windowed_item_in_buffer(
            900.0, 980.0, 100.0, 400.0, 300.0, 1.0, 1.0
        ));
        // The buffer SCALES with the drawn scale k ...
        assert!(windowed_item_in_buffer(
            -500.0, -400.0, 100.0, 400.0, 300.0, 1.0, 2.0
        ));
        // ... and a degenerate scale reads as 1 instead of collapsing it.
        assert!(windowed_item_in_buffer(
            -200.0, -100.0, 100.0, 400.0, 300.0, 1.0, 0.0
        ));
        // Overscan 0 still admits an item touching the root box.
        assert!(windowed_item_in_buffer(
            0.0, 100.0, 100.0, 400.0, 300.0, 0.0, 1.0
        ));
        assert!(!windowed_item_in_buffer(
            -2.0, -1.0, 100.0, 400.0, 300.0, 0.0, 1.0
        ));
    }

    #[test]
    fn windowed_item_tag_falls_back_to_div() {
        assert_eq!(windowed_item_tag(""), "div");
        assert_eq!(windowed_item_tag("li"), "li");
        assert_eq!(windowed_item_tag("section"), "section");
    }

    #[test]
    fn windowed_item_renders_the_vue_dom_contract() {
        // The REAL arm: full content, no style, no aria-hidden.
        let real = WindowedItem(item(Some(true))).render_to_html();
        for needle in [
            r#"class="hk-windowed-item""#,
            r#"data-state="real""#,
            r#"data-windowed-key="row-7""#,
            r#"class="row-body""#,
            "row-7 content",
        ] {
            assert!(real.contains(needle), "missing {needle}: {real}");
        }
        assert!(!real.contains("aria-hidden"), "{real}");
        assert!(!real.contains("style="), "{real}");

        // The PLACEHOLDER arm: the reserved box, no children.
        let placeholder = WindowedItem(WindowedItemProps {
            measured_height: Some(120.0),
            ..item(Some(false))
        })
        .render_to_html();
        for needle in [
            r#"class="hk-windowed-item""#,
            r#"data-state="placeholder""#,
            r#"data-windowed-key="row-7""#,
            r#"aria-hidden="true""#,
            r#"style="height:120px""#,
        ] {
            assert!(
                placeholder.contains(needle),
                "missing {needle}: {placeholder}"
            );
        }
        // No content at all while the item is out of the window.
        assert!(!placeholder.contains("row-body"), "{placeholder}");
        assert!(!placeholder.contains("row-7 content"), "{placeholder}");

        // No window context at all == Vue's `!ctx` arm: the real content.
        let contextless = WindowedItem(item(None)).render_to_html();
        assert!(
            contextless.contains(r#"data-state="real""#),
            "{contextless}"
        );
        assert!(contextless.contains("row-body"), "{contextless}");

        // The estimate reserves the box before any measurement.
        let estimated = WindowedItem(item(Some(false))).render_to_html();
        assert!(estimated.contains(r#"style="height:96px""#), "{estimated}");

        // [D] a pinned offset rides the style; the host tag and class stick.
        let pinned = WindowedItem(WindowedItemProps {
            tag: "li".to_string(),
            class: "roster-row".to_string(),
            offset_top: Some(288.0),
            ..item(Some(false))
        })
        .render_to_html();
        assert!(pinned.starts_with("<li"), "{pinned}");
        assert!(
            pinned.contains(r#"class="hk-windowed-item roster-row""#),
            "{pinned}"
        );
        assert!(
            pinned.contains(r#"style="top:288px;height:96px""#),
            "{pinned}"
        );
        assert!(pinned.ends_with("</li>"), "{pinned}");

        // An empty `tag` still renders a valid root; a keyless item stamps no
        // `data-windowed-key`.
        let anonymous = WindowedItem(WindowedItemProps {
            tag: String::new(),
            item_key: None,
            ..Default::default()
        })
        .render_to_html();
        assert!(anonymous.starts_with("<div"), "{anonymous}");
        assert!(!anonymous.contains("data-windowed-key"), "{anonymous}");
    }

    #[test]
    fn windowed_item_styles_come_from_the_canonical_vue_sheet() {
        let css = WindowedItemComponent::styles();
        assert!(
            // grass preserves the selector text, but the quote style of an
            // attribute selector is not this test's contract — the class and
            // the state hook are.
            css.contains(".hk-windowed-item") && css.contains("[data-state"),
            "windowed item css must carry the vue classes"
        );
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored windowed item sheet"
        );
    }
}
