// hi-components/src/overlay/floating_layer.rs
// FloatingLayer — mirror of the canonical Vue `HkFloatingLayer`: viewport-fixed
// chrome that floats at the TOP layer, independent of the window stack (the
// dial / quick-action pad that must survive the next modal opening over it).
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkFloatingLayer.scss`, vendored under
// `src/styles/vue-mirror/`), compiled with `no_hash` so `.hk-floating-layer`
// and its `data-corner` branches are literal and identical in both forms. DOM
// contract (mirrors Vue):
//
//   div.hk-floating-layer
//       data-corner="bottom-right|bottom-left|top-right|top-left"
//       [role=group] [aria-label={aria_label}]   (only with a non-empty label)
//       (style: --hk-float-z / --hk-float-offset-x / --hk-float-offset-y;
//        each custom property is written only when the host sets it)
//     {children}                                  (the chrome widgets)
//
// Geometry: the SHEET owns the corner math — one `data-corner` attribute plus
// the optional `--hk-float-offset-*` values, exactly like the Vue component
// (`--hk-float-inset-x/y` are `max(var(--space-14, .875rem), env(safe-area-*))`
// and each corner rule adds the host offset). [`floating_layer_geometry`] is
// the Rust-side description of that contract (which viewport edges a corner
// pins to and which safe-area variable each inset maxes against) so hosts and
// tests can assert the corner without parsing CSS; it deliberately does NOT
// re-emit the `calc()` / `env()` expressions — the vendored sheet is the only
// copy of those.
//
// Behaviour deltas vs Vue (documented, not accidental):
//   * NO `<Teleport>` / overlay-root: the layer renders in place and the sheet
//     already makes it `position: fixed`, so hosts must keep it out of
//     transformed or `contain`ed ancestors (same delta as the `Modal` /
//     `Drawer` mirrors).
//   * NO popup-manager band: Vue's `--hk-float-z` comes from the live registry
//     (`kind: "tooltip"`). This release has no manager, so the band is the
//     optional `z_index` prop; unset keeps the sheet's fallback
//     `var(--hk-overlay-z-popup, 200)`.
//   * `yieldToWindows` reads a HOST-OWNED flag: Vue asks the manager whether
//     any window is open (`hasLiveWindow`), the mirror takes `windows_open`
//     from the host and gates through the pure [`floating_layer_visible`].
//     A hidden (or yielded) layer simply renders nothing — Vue's `return null`.
//   * no `role`/`aria-label` when the label is empty (Vue passes `undefined`);
//     rsx omits attributes whose value is `None`, so both trees stay exact.
//   * the sheet's `> .hk-fab { position: static }` rule still applies: a floated
//     `Fab` hands its viewport anchoring to this layer.

use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct FloatingLayerComponent;

/// Which viewport corner the layer anchors to (Vue: `FloatCorner`, default
/// `bottom-right`). The token IS the sheet's `data-corner` value.
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum FloatingCorner {
    #[default]
    BottomRight,
    BottomLeft,
    TopRight,
    TopLeft,
}

impl FloatingCorner {
    /// The `data-corner` token the sheet's rules key on.
    pub fn data_value(self) -> &'static str {
        match self {
            FloatingCorner::BottomRight => "bottom-right",
            FloatingCorner::BottomLeft => "bottom-left",
            FloatingCorner::TopRight => "top-right",
            FloatingCorner::TopLeft => "top-left",
        }
    }
}

/// The corner's anchoring contract, as the sheet implements it: which edge each
/// axis pins to and which safe-area variable its inset maxes against.
#[derive(Clone, Copy, PartialEq, Debug)]
pub struct FloatingLayerEdges {
    /// Horizontal pin: `"left"` or `"right"` (the `--hk-float-inset-x` edge).
    pub edge_x: &'static str,

    /// Vertical pin: `"top"` or `"bottom"` (the `--hk-float-inset-y` edge).
    pub edge_y: &'static str,

    /// The safe-area variable the horizontal inset maxes against.
    pub safe_area_x: &'static str,

    /// The safe-area variable the vertical inset maxes against.
    pub safe_area_y: &'static str,
}

/// Resolve a corner to its edges (Vue: the `&[data-corner$="-left"]` /
/// `&[data-corner^="top"]` sheet rules, in Rust form).
pub fn floating_layer_geometry(corner: FloatingCorner) -> FloatingLayerEdges {
    match corner {
        FloatingCorner::BottomRight => FloatingLayerEdges {
            edge_x: "right",
            edge_y: "bottom",
            safe_area_x: "safe-area-inset-right",
            safe_area_y: "safe-area-inset-bottom",
        },
        FloatingCorner::BottomLeft => FloatingLayerEdges {
            edge_x: "left",
            edge_y: "bottom",
            safe_area_x: "safe-area-inset-left",
            safe_area_y: "safe-area-inset-bottom",
        },
        FloatingCorner::TopRight => FloatingLayerEdges {
            edge_x: "right",
            edge_y: "top",
            safe_area_x: "safe-area-inset-right",
            safe_area_y: "safe-area-inset-top",
        },
        FloatingCorner::TopLeft => FloatingLayerEdges {
            edge_x: "left",
            edge_y: "top",
            safe_area_x: "safe-area-inset-left",
            safe_area_y: "safe-area-inset-top",
        },
    }
}

/// The inline custom properties Vue's style binding writes: the per-instance
/// corner offsets (the sheet consumes them in its `calc()`) and the z band.
/// Each one is written only when set, and the whole string is empty when none
/// are — an empty `style` value emits no attribute at all.
pub fn floating_layer_style(
    offset_x: Option<&str>,
    offset_y: Option<&str>,
    z_index: Option<i32>,
) -> String {
    let mut style = String::new();
    if let Some(z) = z_index {
        style.push_str(&format!("--hk-float-z:{z};"));
    }
    if let Some(offset) = offset_x {
        style.push_str(&format!("--hk-float-offset-x:{offset};"));
    }
    if let Some(offset) = offset_y {
        style.push_str(&format!("--hk-float-offset-y:{offset};"));
    }
    style
}

/// Vue's render gate: `!open || (yieldToWindows && hasLiveWindow)` renders
/// nothing. A yielded layer keeps no slot in Vue's manager either; here the
/// host simply stops passing `windows_open`.
pub fn floating_layer_visible(open: bool, yield_to_windows: bool, windows_open: bool) -> bool {
    open && !(yield_to_windows && windows_open)
}

#[define_props]
pub struct FloatingLayerProps {
    /// Controlled open state (Vue: `open`, default TRUE — this surface is
    /// chrome that is shown unless the host hides it).
    #[default(true)]
    pub open: bool,

    #[default]
    pub corner: FloatingCorner,

    /// `--hk-float-offset-x` (Vue: `offsetX`, any CSS length; unset = 0).
    pub offset_x: Option<String>,

    /// `--hk-float-offset-y` (Vue: `offsetY`, any CSS length; unset = 0).
    pub offset_y: Option<String>,

    /// Accessible group name for the chrome (Vue: `ariaLabel`); empty drops
    /// both `role` and `aria-label`, like Vue's `undefined`.
    #[default]
    pub aria_label: String,

    /// Yield the screen while any window is open (Vue: `yieldToWindows`).
    #[default]
    pub yield_to_windows: bool,

    /// HOST-OWNED "a window / dialog is open" flag (Vue: the popup manager's
    /// live window registry, which this release does not have).
    #[default]
    pub windows_open: bool,

    /// `--hk-float-z` band override (Vue: the manager's tooltip band; unset
    /// keeps the sheet fallback `var(--hk-overlay-z-popup, 200)`).
    pub z_index: Option<i32>,

    /// The chrome widgets (Vue: the default slot).
    pub children: Element,
}

#[component]
pub fn FloatingLayer(props: FloatingLayerProps) -> Element {
    if !floating_layer_visible(props.open, props.yield_to_windows, props.windows_open) {
        return empty_vnode();
    }

    let corner = props.corner.data_value();
    let style = floating_layer_style(
        props.offset_x.as_deref(),
        props.offset_y.as_deref(),
        props.z_index,
    );
    // Vue: `role={ariaLabel ? "group" : undefined}` — an empty label emits
    // neither attribute.
    let labelled = !props.aria_label.is_empty();
    let role = if labelled { Some("group") } else { None };
    let aria_label = if labelled {
        Some(props.aria_label.clone())
    } else {
        None
    };

    rsx! {
        div {
            class: "hk-floating-layer",
            "data-corner": corner,
            style: style,
            "role": role,
            "aria-label": aria_label,
            {props.children.clone()}
        }
    }
}

impl StyledComponent for FloatingLayerComponent {
    fn styles() -> &'static str {
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkFloatingLayer.scss", no_hash }
            .0
    }

    fn name() -> &'static str {
        "floating-layer"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn floating_layer_corner_tokens_match_the_sheet() {
        assert_eq!(FloatingCorner::BottomRight.data_value(), "bottom-right");
        assert_eq!(FloatingCorner::BottomLeft.data_value(), "bottom-left");
        assert_eq!(FloatingCorner::TopRight.data_value(), "top-right");
        assert_eq!(FloatingCorner::TopLeft.data_value(), "top-left");
    }

    #[test]
    fn floating_layer_geometry_pins_the_corner_edges() {
        // The sheet's `$="-right"` / `^="bottom"` suffix-prefix pairs.
        let bottom_right = floating_layer_geometry(FloatingCorner::BottomRight);
        assert_eq!(bottom_right.edge_x, "right");
        assert_eq!(bottom_right.edge_y, "bottom");
        assert_eq!(bottom_right.safe_area_x, "safe-area-inset-right");
        assert_eq!(bottom_right.safe_area_y, "safe-area-inset-bottom");

        let top_left = floating_layer_geometry(FloatingCorner::TopLeft);
        assert_eq!((top_left.edge_x, top_left.edge_y), ("left", "top"));
        assert_eq!(top_left.safe_area_x, "safe-area-inset-left");
        assert_eq!(top_left.safe_area_y, "safe-area-inset-top");

        // The mixed corners keep one axis from each rule.
        let top_right = floating_layer_geometry(FloatingCorner::TopRight);
        assert_eq!((top_right.edge_x, top_right.edge_y), ("right", "top"));
        let bottom_left = floating_layer_geometry(FloatingCorner::BottomLeft);
        assert_eq!((bottom_left.edge_x, bottom_left.edge_y), ("left", "bottom"));
    }

    #[test]
    fn floating_layer_style_writes_only_the_set_properties() {
        assert_eq!(floating_layer_style(None, None, None), "");
        // "0px" is a VALUE, not an absence: it is written through verbatim
        // (the sheet's fallback is what an unset property resolves to).
        assert_eq!(
            floating_layer_style(Some("0px"), None, None),
            "--hk-float-offset-x:0px;"
        );
        assert_eq!(
            floating_layer_style(Some("0px"), Some("1rem"), None),
            "--hk-float-offset-x:0px;--hk-float-offset-y:1rem;"
        );
        assert_eq!(
            floating_layer_style(Some("2rem"), Some("-1rem"), Some(1200)),
            "--hk-float-z:1200;--hk-float-offset-x:2rem;--hk-float-offset-y:-1rem;"
        );
    }

    #[test]
    fn floating_layer_visible_matches_the_vue_gate() {
        assert!(floating_layer_visible(true, false, false));
        assert!(floating_layer_visible(true, false, true));
        assert!(floating_layer_visible(true, true, false));
        // Yielding: hidden while a window is open, back afterwards.
        assert!(!floating_layer_visible(true, true, true));
        assert!(!floating_layer_visible(false, false, false));
        assert!(!floating_layer_visible(false, true, true));
    }

    #[test]
    fn floating_layer_defaults_match_the_vue_props() {
        let props = FloatingLayerProps::default();
        // This surface is ON by default (Vue: `open: { default: true }`).
        assert!(props.open);
        assert_eq!(props.corner, FloatingCorner::BottomRight);
        assert!(props.offset_x.is_none());
        assert!(props.offset_y.is_none());
        assert_eq!(props.aria_label, "");
        assert!(!props.yield_to_windows);
        assert!(!props.windows_open);
        assert!(props.z_index.is_none());
    }

    #[test]
    fn floating_layer_renders_the_vue_layer_contract() {
        let html = FloatingLayer(FloatingLayerProps {
            corner: FloatingCorner::BottomLeft,
            offset_x: Some("2rem".to_string()),
            z_index: Some(1200),
            aria_label: "Date dial".to_string(),
            children: rsx! {
                button { class: "host-dial", "type": "button", "Open" }
            },
            ..Default::default()
        })
        .render_to_html();

        assert!(html.contains(r#"class="hk-floating-layer""#), "{html}");
        assert!(html.contains(r#"data-corner="bottom-left""#), "{html}");
        assert!(html.contains("--hk-float-z:1200"), "{html}");
        assert!(html.contains("--hk-float-offset-x:2rem"), "{html}");
        // Only the set offset is written.
        assert!(!html.contains("--hk-float-offset-y"), "{html}");
        // A labelled layer is a group; the widgets render inside it.
        assert!(html.contains(r#"role="group""#), "{html}");
        assert!(html.contains(r#"aria-label="Date dial""#), "{html}");
        assert!(html.contains(r#"class="host-dial""#), "{html}");
    }

    #[test]
    fn floating_layer_unlabelled_emits_no_group_role() {
        let html = FloatingLayer(FloatingLayerProps {
            children: rsx! {
                span { "chrome" }
            },
            ..Default::default()
        })
        .render_to_html();

        assert!(html.contains(r#"class="hk-floating-layer""#), "{html}");
        assert!(!html.contains(r#"role="group""#), "{html}");
        assert!(!html.contains("aria-label"), "{html}");
        // No offsets and no z: the style attribute is omitted entirely.
        assert!(!html.contains("style="), "{html}");
    }

    #[test]
    fn floating_layer_hidden_or_yielded_renders_nothing() {
        let hidden = FloatingLayer(FloatingLayerProps {
            open: false,
            children: rsx! {
                span { "chrome" }
            },
            ..Default::default()
        })
        .render_to_html();
        assert!(hidden.is_empty(), "a hidden layer mounts nothing: {hidden}");

        let yielded = FloatingLayer(FloatingLayerProps {
            yield_to_windows: true,
            windows_open: true,
            children: rsx! {
                span { "chrome" }
            },
            ..Default::default()
        })
        .render_to_html();
        assert!(
            yielded.is_empty(),
            "a yielded layer mounts nothing while a window is open: {yielded}"
        );
    }

    #[test]
    fn floating_layer_styles_come_from_the_canonical_vue_sheet() {
        let css = FloatingLayerComponent::styles();
        assert!(
            css.contains(".hk-floating-layer"),
            "floating-layer css must carry the layer class"
        );
        // The corner rules are `data-corner` attribute selectors and the insets
        // are custom properties; both tokens must survive compilation.
        assert!(
            css.contains("data-corner") && css.contains("--hk-float-inset-x"),
            "floating-layer css must carry the corner geometry contract"
        );
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored floating-layer sheet"
        );
        assert_eq!(FloatingLayerComponent::name(), "floating-layer");
    }
}
