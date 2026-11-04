// overlay/ambient_layer.rs
// AmbientLayer — mirror of the canonical Vue `HkAmbientLayer`: the shared host
// for always-visible, NON-INTERACTIVE annotations that must paint above every
// popup (the modal backdrop included).
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkAmbientLayer.scss`, vendored under
// `src/styles/vue-mirror/`), compiled with `no_hash` so `.hk-ambient-layer`
// and its `[data-pointer-events="auto"]` branch are literal and identical in
// both forms. DOM contract (mirrors Vue):
//
//   div.hk-ambient-layer
//       data-pointer-events="none|auto"
//       [role=region aria-label={label}]          (only with a non-empty label)
//       (style: z-index:calc(var(--hk-z-hud, 90050) + {zIndex - 1}))
//     {children}
//
// The 2026-11-05 identify defect is the reason this exists on both sides: the
// screen-identify card was teleported to `<body>` with a hand-written
// `z-index: 5000`, so the modal tree (Vue document band 90000) buried it and
// the card showed through the scrim as dimmed background. Layer selection is
// a LIBRARY decision: Vue owns it with `#hk-hud-root` + `--hk-z-hud` +
// `--hk-overlay-z-hud`; the Rust form has no Teleport/HUD root, so the wrapper
// itself carries the band.
//
// Behaviour deltas vs Vue (documented, not accidental):
//   * NO `<Teleport>` / `#hk-hud-root`: the layer renders in place. The sheet
//     already makes it `position: fixed`, and the wrapper's inline
//     `z-index: calc(var(--hk-z-hud, 90050) + {zIndex - 1})` puts it on the
//     same document band the Vue HUD root occupies — above the overlay tree
//     (90000), below the error landing / window titlebar. Hosts must keep it
//     out of transformed or `contain`ed ancestors (same delta as `FloatingLayer`
//     and the `Modal` / `Drawer` mirrors).
//   * `zIndex` orders ambient layers against each other ON that band (Vue: the
//     local order inside the HUD root, default 1). The emitted value is
//     `band + zIndex - 1`, so the default seat is the band floor and larger
//     numbers stack nearer the user.
//   * no `role`/`aria-label` when the label is empty (Vue passes `undefined`);
//     rsx omits attributes whose value is `None`, so both trees stay exact.
//   * the pointer opt-in targets the wrapper's children only: the wrapper
//     spans the viewport, so re-enabling pointer events on it would swallow
//     every click behind an "interactive" HUD (the R2 S2 fix shipped in Vue).

use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct AmbientLayerComponent;

/// Hikari's ambient-HUD document band (`--hk-z-hud` in the canonical scale
/// sheet). The fallback mirrors `overlay/hudRoot.ts`'s `HUD_ROOT_DOCUMENT_Z`.
pub const AMBIENT_LAYER_DOCUMENT_Z: i32 = 90050;

/// Whether the layer's CONTENT accepts pointer input (Vue: `pointerEvents`,
/// default `"none"` — an annotation must not block the window it annotates).
#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum AmbientLayerPointerEvents {
    #[default]
    None,
    Auto,
}

impl AmbientLayerPointerEvents {
    /// The `data-pointer-events` token the sheet's opt-in rule keys on.
    pub fn data_value(self) -> &'static str {
        match self {
            AmbientLayerPointerEvents::None => "none",
            AmbientLayerPointerEvents::Auto => "auto",
        }
    }
}

/// The wrapper's inline stacking style (Vue: `String(props.zIndex)` inside the
/// HUD root). The band rides `--hk-z-hud` so a themed scale sheet can move it;
/// the `90050` fallback matches the canonical sheet. `z_index` is clamped to
/// `>= 1`, matching Vue's default seat.
pub fn ambient_layer_style(z_index: i32) -> String {
    let local = z_index.max(1) - 1;
    format!("z-index:calc(var(--hk-z-hud, {AMBIENT_LAYER_DOCUMENT_Z}) + {local})")
}

/// The accessible landmark pair (Vue: `role={label ? "region" : undefined}`
/// with the same label): an empty/absent label emits neither attribute.
pub fn ambient_layer_landmark(label: Option<&str>) -> Option<&'static str> {
    match label {
        Some(value) if !value.is_empty() => Some("region"),
        _ => None,
    }
}

#[define_props]
pub struct AmbientLayerProps {
    /// Whether the layer's CONTENT accepts pointer input (default `none`).
    #[default]
    pub pointer_events: AmbientLayerPointerEvents,

    /// Stacking order among ambient layers (Vue: `zIndex`, default 1).
    #[default(1)]
    pub z_index: i32,

    /// Accessible name for the layer as a landmark (Vue: `ariaLabel`); an
    /// empty value drops both `role` and `aria-label`.
    pub label: Option<String>,

    /// The annotation widgets (Vue: the default slot).
    pub children: Element,
}

#[component]
pub fn AmbientLayer(props: AmbientLayerProps) -> Element {
    let style = ambient_layer_style(props.z_index);
    // Vue binds `aria-label={props.label}` unconditionally, so an empty label
    // still emits `aria-label=""` (with no role); match that exactly.
    let role = ambient_layer_landmark(props.label.as_deref());
    let aria_label = props.label.clone();

    let root = VElement::new("div")
        .class("hk-ambient-layer")
        .attr("data-pointer-events", props.pointer_events.data_value())
        .attr("role", role)
        .attr("aria-label", aria_label)
        .style(style)
        .child(props.children.clone());

    VNode::Element(Box::new(root))
}

impl StyledComponent for AmbientLayerComponent {
    fn styles() -> &'static str {
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkAmbientLayer.scss", no_hash }
            .0
    }

    fn name() -> &'static str {
        "ambient-layer"
    }
}
