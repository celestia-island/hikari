// hi-components/src/display/image_viewer.rs
// ImageViewer — mirror of the canonical Vue `HkImageViewer`: the zoomable /
// pannable image canvas `HkImageLightbox` hosts.
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkImageViewer.scss`, vendored under
// `src/styles/vue-mirror/` and guarded by `tests/vue_mirror_drift_tests.rs`),
// compiled with `no_hash` so every `.hk-image-viewer*` class name is literal
// and identical in both forms. DOM contract (one-to-one with the Vue render
// output; deltas marked [D]):
//
//   div.hk-image-viewer [host class]            (style: host style)
//        (wheel / pointerdown / pointermove / pointerup / pointercancel /
//         lostpointercapture / dblclick — PASS-THROUGH, see [D])
//     img.hk-image-viewer-img [.is-loading] [.is-animatable]
//          src alt draggable="false"
//          (style: transform / transform-origin:0 0 / cursor)
//          (onload, onerror)
//     div.hk-image-viewer-loading?             (loading; Spinner size=md)
//     {controls}?                              ([D] host surface, !loading)
//
// Camera model, taken from Vue verbatim: the image is laid out at its natural
// pixel size and transformed with `translate(panX, panY) scale(zoom)` under
// `transform-origin: 0 0`; the resting state is fit-to-container and CENTRED.
// `fit` is `min(1, cw / iw, ch / ih)` — never an upscale — and it is both the
// resting zoom and the zoom floor; [`IMAGE_VIEWER_MAX_ZOOM`] (8) is the
// ceiling. Pan is clamped so a drawn image larger than the viewport can never
// expose a gap (`[viewport - drawn, 0]`), while one that fits is centred.
//
// State home: tairitsu 0.5.22 has no per-instance component state (`use_signal`
// allocates a fresh signal on every render, `use_state` is a single shared hook
// slot — ledger L48), so the camera (`scale` / `offset_*`), the load flags
// (`loading`, `animatable`) and the drag flag (`dragging`) are all CONTROLLED
// PROPS. Every gesture stays with the host: Vue's wheel / double-click / pointer
// handlers, its two-finger pinch tracking, its pointer-capture bookkeeping and
// its ResizeObserver are not ported (all of them need live DOM measurement).
// The mirror keeps Vue's LISTENER SET as pass-through props ([D]) so a host's
// gesture layer can be wired straight onto the canvas, and it exports the camera
// math as pure functions — [`image_viewer_fit_scale`],
// [`image_viewer_clamp_scale`], [`image_viewer_clamp_pan`],
// [`image_viewer_anchor_pan`], [`image_viewer_wheel_scale`],
// [`image_viewer_double_click_target`], [`image_viewer_transform`] — so the
// recognition side only has to hand numbers back.
//
// Deltas vs Vue (documented, not accidental):
//   * [D] CAMERA AS PROPS. Vue owns `zoom`/`panX`/`panY` refs; the mirror takes
//     them as `scale`/`offset_x`/`offset_y` plus `on_*` callbacks. `scale` is an
//     `Option<f64>`: Vue's camera STARTS AT FIT, not at 1, so `None` (the
//     default) is that resting camera and `Some(zoom)` is an explicit request.
//     `loading` is Vue's `loaded` INVERTED (a Rust prop cannot default to `true`
//     without lying about the initial render): `loading: true`, the default, is
//     Vue's initial state.
//   * [D] VIEWPORT AND CONTENT BOXES ARE PROPS. Vue reads the container through
//     `clientWidth/clientHeight` and the image through `naturalWidth/
//     naturalHeight`; tairitsu 0.5.22 exposes no measurement API to a component
//     (and a render-time read would be a side effect), so the host supplies
//     `content_width/height` and `viewport_width/height`. ZERO means "unknown":
//     `fit` falls back to Vue's pre-load `fit = 1` and the pan is rendered
//     verbatim (no clamp to clamp against).
//   * [D] CAMERA NORMALISATION. The mirror applies Vue's own clamps to the props
//     it is handed — `setZoom`'s `[fit, 8]` and `clampPan`'s centring — so the
//     rendered camera can never be an out-of-range request, and the resting
//     state matches Vue's centred fit the moment the boxes are known.
//   * [D] NO MINIMAP / ZOOM BAR. Vue composes `HkMinimap` under the canvas (the
//     percent readout, ±5% steps, reset, and the overview map the viewport
//     rectangle needs measurements for). That component has no Rust mirror yet,
//     so `controls` is the host's slot for a stand-in surface (the
//     `HkZoomToolbar` mirror lands with the scene3d wave).
//   * [D] NO ERROR SURFACE. Vue has none either (only `loading`), and the sheet
//     carries no `.hk-image-viewer-error` rule: the mirror reports the event
//     through `on_error` and leaves the state to the host.
//   * [D] `rotation_turns` — Rust-side EXTENSION, `0` (the default) renders
//     Vue's transform string byte-for-byte. A non-zero quarter turn rotates the
//     drawn image and rotates the fit/pan box with it (see
//     [`image_viewer_drawn_size`]); the host that rotates an EXIF-tagged image
//     or offers an orientation switch gets the same geometry for free.
//   * [D] `is-animatable` is controlled: Vue arms the transform glide two
//     frames after each load-driven reposition (frame 1 commits the transform
//     unarmed, frame 2 arms). A frame clock is not available here, so the host
//     owns the arming and the `.is-animatable` class is a prop.
//   * [D] `lostpointercapture`: tairitsu's `on_event` registers in the bubble
//     phase only, while Vue relies on a CAPTURE-phase listener because the
//     event fires on the element that held capture (usually the `<img>`) and
//     does not bubble. The mirror still exposes the pass-through, but a host
//     that takes pointer capture should also retire the pointer from its own
//     `pointerup`/`pointercancel` path.
//
// New file: the family had no Rust viewer (the legacy `display/zoom_controls.rs`
// is the zoom-button strip, which Vue ships as `HkZoomToolbar` — a different
// component). Nothing is retired here.

// The prelude curates the tairitsu event set; `WheelEvent` / `PointerEvent`
// (the wheel and drag channels) are not part of it — the same crate-level
// import `basic/color_picker.rs` and `feedback/tooltip.rs` use.
use tairitsu_vdom::{PointerEvent, WheelEvent};

use crate::feedback::spinner::{Spinner, SpinnerSize};
use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct ImageViewerComponent;

/// Vue's absolute zoom ceiling (`MAX_ZOOM`), independent of the fit floor.
pub const IMAGE_VIEWER_MAX_ZOOM: f64 = 8.0;

/// Vue's `isZoomed` epsilon: `zoom > fit + 0.001` (floating-point slack so a
/// camera parked exactly at fit never reports zoomed).
pub const IMAGE_VIEWER_ZOOMED_EPSILON: f64 = 0.001;

/// Vue's double-click zoom factor: `Math.min(MAX_ZOOM, fit * 3)`.
pub const IMAGE_VIEWER_DOUBLE_CLICK_ZOOM_FACTOR: f64 = 3.0;

/// Vue's wheel step: `deltaY < 0 ? 1.15 : 1 / 1.15`.
pub const IMAGE_VIEWER_WHEEL_ZOOM_STEP: f64 = 1.15;

/// One full turn expressed in the `rotation_turns` unit.
pub const IMAGE_VIEWER_QUARTER_TURNS: u8 = 4;

// ── the geometry kernels ────────────────────────────────────────────────
// Vue keeps every one of these inside `setup()`; they are pure functions here
// because the host owns the gesture side (see the header).

/// NaN/inf-safe read of a numeric prop: one `NaN` from a host would otherwise
/// poison every later `<`/`>` comparison in this module.
fn image_viewer_finite_or(value: f64, fallback: f64) -> f64 {
    if value.is_finite() { value } else { fallback }
}

/// Normalize a quarter-turn rotation into `0..=3`.
pub fn image_viewer_rotation_turns(turns: u8) -> u8 {
    turns % IMAGE_VIEWER_QUARTER_TURNS
}

/// The box the drawn image occupies after `rotation_turns` quarter turns: an
/// odd turn swaps width and height, an even one leaves them alone.
pub fn image_viewer_drawn_size(content_w: f64, content_h: f64, rotation_turns: u8) -> (f64, f64) {
    if image_viewer_rotation_turns(rotation_turns) % 2 == 1 {
        (content_h, content_w)
    } else {
        (content_w, content_h)
    }
}

/// Vue's `recomputeFit`: `Math.min(1, cw / iw, ch / ih)` over the ROTATED
/// content box, so the camera never upscales past the image's natural size.
/// Vue's pre-load `fit` (1) stands in while any box is unknown.
pub fn image_viewer_fit_scale(
    content_w: f64,
    content_h: f64,
    viewport_w: f64,
    viewport_h: f64,
    rotation_turns: u8,
) -> f64 {
    let (drawn_w, drawn_h) = image_viewer_drawn_size(content_w, content_h, rotation_turns);
    if !drawn_w.is_finite()
        || !drawn_h.is_finite()
        || !viewport_w.is_finite()
        || !viewport_h.is_finite()
        || drawn_w <= 0.0
        || drawn_h <= 0.0
        || viewport_w <= 0.0
        || viewport_h <= 0.0
    {
        return 1.0;
    }
    (viewport_w / drawn_w).min(viewport_h / drawn_h).min(1.0)
}

/// Vue's `setZoom` clamp: `Math.max(fit, Math.min(MAX_ZOOM, next))` — evaluated
/// in that order, so a (pathological) `fit > MAX_ZOOM` still resolves to `fit`
/// instead of trapping the camera above its own resting state.
pub fn image_viewer_clamp_scale(scale: f64, fit: f64) -> f64 {
    let fit = image_viewer_finite_or(fit, 1.0);
    if !scale.is_finite() {
        return fit;
    }
    fit.max(scale.min(IMAGE_VIEWER_MAX_ZOOM))
}

/// Vue's `isZoomed`: `loaded && zoom > fit + 0.001`.
pub fn image_viewer_is_zoomed(loading: bool, scale: f64, fit: f64) -> bool {
    !loading && scale > image_viewer_finite_or(fit, 1.0) + IMAGE_VIEWER_ZOOMED_EPSILON
}

/// The scaled (and rotated) box the image is drawn into — Vue's
/// `imgW * zoom` / `imgH * zoom` pair.
pub fn image_viewer_drawn_box(
    content_w: f64,
    content_h: f64,
    scale: f64,
    rotation_turns: u8,
) -> (f64, f64) {
    let (drawn_w, drawn_h) = image_viewer_drawn_size(content_w, content_h, rotation_turns);
    let scale = image_viewer_finite_or(scale, 1.0);
    (drawn_w * scale, drawn_h * scale)
}

/// One axis of Vue's `clampPan`: a drawn box larger than the viewport may pan
/// between `viewport - drawn` and `0`; one that fits is CENTRED (Vue's resting
/// layout). Unknown boxes (or a non-finite pan) pass the pan through untouched.
fn image_viewer_clamp_pan_axis(drawn: f64, viewport: f64, pan: f64) -> f64 {
    let pan = image_viewer_finite_or(pan, 0.0);
    if !drawn.is_finite() || !viewport.is_finite() || drawn <= 0.0 || viewport <= 0.0 {
        return pan;
    }
    if drawn <= viewport {
        (viewport - drawn) / 2.0
    } else {
        (viewport - drawn).max(pan.min(0.0))
    }
}

/// Vue's `clampPan`, both axes. Call it after every camera write (Vue calls it
/// from `setZoom`, the drag path, the minimap path and `onPanDelta`).
pub fn image_viewer_clamp_pan(
    drawn_w: f64,
    drawn_h: f64,
    viewport_w: f64,
    viewport_h: f64,
    pan_x: f64,
    pan_y: f64,
) -> (f64, f64) {
    (
        image_viewer_clamp_pan_axis(drawn_w, viewport_w, pan_x),
        image_viewer_clamp_pan_axis(drawn_h, viewport_h, pan_y),
    )
}

/// Vue's `center()`: park the drawn box in the middle of the viewport. Unknown
/// boxes park at the origin (Vue's pre-load `translate(0, 0)`).
pub fn image_viewer_center_pan(
    drawn_w: f64,
    drawn_h: f64,
    viewport_w: f64,
    viewport_h: f64,
) -> (f64, f64) {
    if !drawn_w.is_finite()
        || !drawn_h.is_finite()
        || !viewport_w.is_finite()
        || !viewport_h.is_finite()
    {
        return (0.0, 0.0);
    }
    ((viewport_w - drawn_w) / 2.0, (viewport_h - drawn_h) / 2.0)
}

/// Vue's anchored zoom (`setZoom`'s translation half): the content point under
/// `(anchor_x, anchor_y)` keeps its place while the scale moves from `scale` to
/// `target_scale`. Feed the result through [`image_viewer_clamp_pan`], exactly
/// as `setZoom` does. A degenerate `scale` (zero, negative, non-finite) cannot
/// anchor anything, so the pan passes through.
pub fn image_viewer_anchor_pan(
    scale: f64,
    target_scale: f64,
    anchor_x: f64,
    anchor_y: f64,
    pan_x: f64,
    pan_y: f64,
) -> (f64, f64) {
    let pan_x = image_viewer_finite_or(pan_x, 0.0);
    let pan_y = image_viewer_finite_or(pan_y, 0.0);
    let anchor_x = image_viewer_finite_or(anchor_x, 0.0);
    let anchor_y = image_viewer_finite_or(anchor_y, 0.0);
    let target_scale = image_viewer_finite_or(target_scale, scale);
    if !scale.is_finite() || scale <= 0.0 || !target_scale.is_finite() {
        return (pan_x, pan_y);
    }
    let world_x = (anchor_x - pan_x) / scale;
    let world_y = (anchor_y - pan_y) / scale;
    (
        anchor_x - world_x * target_scale,
        anchor_y - world_y * target_scale,
    )
}

/// Vue's wheel step in camera terms: one notch in (negative `deltaY`) zooms in
/// by [`IMAGE_VIEWER_WHEEL_ZOOM_STEP`], one notch out divides by it. The result
/// is a REQUEST — run it through [`image_viewer_clamp_scale`].
pub fn image_viewer_wheel_scale(scale: f64, delta_y: f64) -> f64 {
    let scale = image_viewer_finite_or(scale, 1.0);
    if delta_y < 0.0 {
        scale * IMAGE_VIEWER_WHEEL_ZOOM_STEP
    } else {
        scale / IMAGE_VIEWER_WHEEL_ZOOM_STEP
    }
}

/// Vue's double-click target: zoomed → back to `fit`; at (or below) fit →
/// `Math.min(MAX_ZOOM, fit * 3)`.
pub fn image_viewer_double_click_target(fit: f64, zoomed: bool) -> f64 {
    let fit = image_viewer_finite_or(fit, 1.0);
    if zoomed {
        fit
    } else {
        (fit * IMAGE_VIEWER_DOUBLE_CLICK_ZOOM_FACTOR).min(IMAGE_VIEWER_MAX_ZOOM)
    }
}

/// Format a camera number the way Vue's template literal does (JS
/// `String(number)`): shortest round-trip digits, `-0` collapsed to `0`, and any
/// non-finite value parked at `0` so a NaN can never reach the style attribute.
pub fn image_viewer_css_length(value: f64) -> String {
    if !value.is_finite() || value == 0.0 {
        return "0".to_string();
    }
    value.to_string()
}

/// Vue's `<img>` transform: `translate(Xpx, Ypx) scale(S)` under
/// `transform-origin: 0 0` — the exact camera string the minimap's viewport-rect
/// math assumes. At `rotation_turns == 0` this is byte-for-byte Vue's.
///
/// A quarter turn rotates around that same `0 0` origin, which would push the
/// image out of its box, so the rotation branch prepends a compensation
/// translate INSIDE the scale: `rotate(90deg)` maps `[0, w] x [0, h]` onto
/// `[-h, 0] x [0, w]`, hence `translate(h, 0)` (and `translate(w, h)` for 180°,
/// `translate(0, w)` for 270°).
pub fn image_viewer_transform(
    content_w: f64,
    content_h: f64,
    scale: f64,
    pan_x: f64,
    pan_y: f64,
    rotation_turns: u8,
) -> String {
    let scale = image_viewer_css_length(scale);
    let pan_x = image_viewer_css_length(pan_x);
    let pan_y = image_viewer_css_length(pan_y);
    let mut transform = format!("translate({pan_x}px, {pan_y}px) scale({scale})");
    let width = image_viewer_css_length(content_w);
    let height = image_viewer_css_length(content_h);
    match image_viewer_rotation_turns(rotation_turns) {
        1 => transform.push_str(&format!(" translate({height}px, 0px) rotate(90deg)")),
        2 => transform.push_str(&format!(" translate({width}px, {height}px) rotate(180deg)")),
        3 => transform.push_str(&format!(" translate(0px, {width}px) rotate(270deg)")),
        _ => {}
    }
    transform
}

/// Vue's inline cursor: `isZoomed ? (dragging ? "grabbing" : "grab") : "zoom-in"`.
pub fn image_viewer_cursor(zoomed: bool, dragging: bool) -> &'static str {
    if !zoomed {
        "zoom-in"
    } else if dragging {
        "grabbing"
    } else {
        "grab"
    }
}

/// The root class list (`hk-image-viewer` plus the host class, appended last
/// like Vue's attribute fallthrough).
pub fn image_viewer_classes(class: &str) -> String {
    let mut classes = String::from("hk-image-viewer");
    if !class.is_empty() {
        classes.push(' ');
        classes.push_str(class);
    }
    classes
}

/// The `<img>` class list: `is-loading` while the load is pending, and
/// `is-animatable` only when the host has armed the transform glide.
pub fn image_viewer_img_classes(loading: bool, animatable: bool) -> String {
    let mut classes = String::from("hk-image-viewer-img");
    if loading {
        classes.push_str(" is-loading");
    }
    if animatable {
        classes.push_str(" is-animatable");
    }
    classes
}

#[define_props]
pub struct ImageViewerProps {
    /// Image URL (Vue: `src`, required there; Rust props must be
    /// `Default`-constructible, so an empty string is the "unset" value).
    #[default]
    pub src: String,

    /// Alternate text (Vue default `""`).
    #[default]
    pub alt: String,

    /// Camera zoom (Vue's `zoom`). `None` keeps Vue's resting camera — the fit
    /// scale from [`image_viewer_fit_scale`] — while `Some(zoom)` is an explicit
    /// request, normalized into `[fit, 8]` at render time.
    pub scale: Option<f64>,

    /// Camera pan X in container px (Vue's `panX`), clamped at render time.
    #[default(0.0)]
    pub offset_x: f64,

    /// Camera pan Y in container px (Vue's `panY`), clamped at render time.
    #[default(0.0)]
    pub offset_y: f64,

    /// Quarter turns of host-side rotation ([D] extension; `0` = Vue).
    #[default]
    pub rotation_turns: u8,

    /// Vue's `!loaded`: render the spinner, fade the image in and report "not
    /// zoomed" while the load is pending.
    #[default(true)]
    pub loading: bool,

    /// Vue's `.is-animatable`: arm the transform glide (see the header [D]).
    #[default]
    pub animatable: bool,

    /// Vue's `dragging` flag, used only for the `grabbing` cursor.
    #[default]
    pub dragging: bool,

    /// Natural image width in px (Vue: `naturalWidth`). `0` = unknown.
    #[default(0.0)]
    pub content_width: f64,

    /// Natural image height in px (Vue: `naturalHeight`). `0` = unknown.
    #[default(0.0)]
    pub content_height: f64,

    /// Container width in px (Vue: `clientWidth`). `0` = unknown.
    #[default(0.0)]
    pub viewport_width: f64,

    /// Container height in px (Vue: `clientHeight`). `0` = unknown.
    #[default(0.0)]
    pub viewport_height: f64,

    /// Host class appended after `hk-image-viewer`.
    #[default]
    pub class: String,

    /// Host style attribute (Vue attribute fallthrough; omitted when empty).
    #[default]
    pub style: String,

    /// Host control surface ([D] stand-in for Vue's `HkMinimap`), rendered
    /// inside the canvas once the load has settled.
    pub controls: Option<Element>,

    /// The image finished loading (Vue's `load` handler) — the host flips
    /// `loading` from here.
    pub on_load: Option<EventHandler<()>>,

    /// The image failed (Vue surfaces no error UI; see the header).
    pub on_error: Option<EventHandler<()>>,

    /// Wheel pass-through (Vue: `passive:false` + `preventDefault`; calling
    /// `prevent_default` on the event is the host's call).
    pub on_wheel: Option<EventHandler<WheelEvent>>,

    /// Pointerdown pass-through (Vue: registers the pointer + captures it).
    pub on_pointer_down: Option<EventHandler<PointerEvent>>,

    /// Pointermove pass-through (Vue: panned / pinch frames).
    pub on_pointer_move: Option<EventHandler<PointerEvent>>,

    /// Pointerup pass-through (Vue: retires the pointer).
    pub on_pointer_up: Option<EventHandler<PointerEvent>>,

    /// Pointercancel pass-through (Vue: retires the pointer).
    pub on_pointer_cancel: Option<EventHandler<PointerEvent>>,

    /// Capture-loss pass-through (see the header's [D] about the phase).
    pub on_lost_pointer_capture: Option<EventHandler<PointerEvent>>,

    /// Double-click pass-through (Vue: `setZoom` to
    /// [`image_viewer_double_click_target`], anchored at the pointer).
    pub on_double_click: Option<EventHandler<MouseEvent>>,
}

#[component]
pub fn ImageViewer(props: ImageViewerProps) -> Element {
    // Vue's camera, normalized exactly like `setZoom` + `clampPan` would.
    // `scale: None` is Vue's resting camera: fit, never an upscale.
    let fit = image_viewer_fit_scale(
        props.content_width,
        props.content_height,
        props.viewport_width,
        props.viewport_height,
        props.rotation_turns,
    );
    let scale = image_viewer_clamp_scale(props.scale.unwrap_or(fit), fit);
    let zoomed = image_viewer_is_zoomed(props.loading, scale, fit);
    let (drawn_w, drawn_h) = image_viewer_drawn_box(
        props.content_width,
        props.content_height,
        scale,
        props.rotation_turns,
    );
    let (pan_x, pan_y) = image_viewer_clamp_pan(
        drawn_w,
        drawn_h,
        props.viewport_width,
        props.viewport_height,
        props.offset_x,
        props.offset_y,
    );

    let transform = image_viewer_transform(
        props.content_width,
        props.content_height,
        scale,
        pan_x,
        pan_y,
        props.rotation_turns,
    );
    let cursor = image_viewer_cursor(zoomed, props.dragging);
    let img_style = format!("transform:{transform};transform-origin:0 0;cursor:{cursor}");
    let img_classes = image_viewer_img_classes(props.loading, props.animatable);
    let classes = image_viewer_classes(&props.class);

    let host_style = if props.style.is_empty() {
        None
    } else {
        Some(props.style.clone())
    };
    let controls = if props.loading {
        empty_vnode()
    } else {
        props.controls.clone().unwrap_or_else(empty_vnode)
    };

    // Pass-through wiring: the props are consumed once each, so clone per
    // listener (Callback is a cheap `Rc` clone).
    let on_load = props.on_load.clone();
    let on_error = props.on_error.clone();
    let on_wheel = props.on_wheel.clone();
    let on_pointer_down = props.on_pointer_down.clone();
    let on_pointer_move = props.on_pointer_move.clone();
    let on_pointer_up = props.on_pointer_up.clone();
    let on_pointer_cancel = props.on_pointer_cancel.clone();
    let on_lost_pointer_capture = props.on_lost_pointer_capture.clone();
    let on_double_click = props.on_double_click.clone();

    rsx! {
        div {
            class: classes,
            style: host_style,
            onwheel: move |e: WheelEvent| {
                if let Some(handler) = on_wheel.as_ref() {
                    handler.call(e.clone());
                }
            },
            onpointerdown: move |e: PointerEvent| {
                if let Some(handler) = on_pointer_down.as_ref() {
                    handler.call(e.clone());
                }
            },
            onpointermove: move |e: PointerEvent| {
                if let Some(handler) = on_pointer_move.as_ref() {
                    handler.call(e.clone());
                }
            },
            onpointerup: move |e: PointerEvent| {
                if let Some(handler) = on_pointer_up.as_ref() {
                    handler.call(e.clone());
                }
            },
            onpointercancel: move |e: PointerEvent| {
                if let Some(handler) = on_pointer_cancel.as_ref() {
                    handler.call(e.clone());
                }
            },
            onlostpointercapture: move |e: PointerEvent| {
                if let Some(handler) = on_lost_pointer_capture.as_ref() {
                    handler.call(e.clone());
                }
            },
            // `dblclick` is NOT one of the mouse events tairitsu's rsx types
            // (click/mousedown/mouseup/mousemove/mouseenter/mouseleave), so the
            // macro hands this listener the boxed event and the mirror
            // downcasts it back to `MouseEvent` for the host.
            ondblclick: move |event: Box<dyn EventData>| {
                if let Some(handler) = on_double_click.as_ref()
                    && let Some(mouse) = event.as_any().downcast_ref::<MouseEvent>()
                {
                    handler.call(mouse.clone());
                }
            },
            img {
                class: img_classes,
                src: props.src.clone(),
                alt: props.alt.clone(),
                style: img_style,
                "draggable": "false",
                onload: move |_| {
                    if let Some(handler) = on_load.as_ref() {
                        handler.call(());
                    }
                },
                onerror: move |_| {
                    if let Some(handler) = on_error.as_ref() {
                        handler.call(());
                    }
                },
            }
            if props.loading {
                div {
                    class: "hk-image-viewer-loading",
                    Spinner { size: SpinnerSize::Md }
                }
            }
            {controls}
        }
    }
}

impl StyledComponent for ImageViewerComponent {
    fn styles() -> &'static str {
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkImageViewer.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "image-viewer"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The litmus box the Vue tests use: an 800x600 image in a 400x300 canvas
    /// (fit 0.5, drawn 400x300 at fit).
    const CONTENT_W: f64 = 800.0;
    const CONTENT_H: f64 = 600.0;
    const VIEWPORT_W: f64 = 400.0;
    const VIEWPORT_H: f64 = 300.0;

    #[test]
    fn viewer_defaults_match_the_vue_initial_state() {
        let props = ImageViewerProps::default();
        assert_eq!(props.src, "");
        assert_eq!(props.alt, "");
        // `None` is Vue's resting camera (fit), not an explicit 1x zoom.
        assert_eq!(props.scale, None);
        assert_eq!(props.offset_x, 0.0);
        assert_eq!(props.offset_y, 0.0);
        assert_eq!(props.rotation_turns, 0);
        // Vue's initial render is `loaded = false`, i.e. loading.
        assert!(props.loading);
        assert!(!props.animatable);
        assert!(!props.dragging);
        assert_eq!(props.content_width, 0.0);
        assert_eq!(props.content_height, 0.0);
        assert_eq!(props.viewport_width, 0.0);
        assert_eq!(props.viewport_height, 0.0);
        assert_eq!(props.class, "");
        assert_eq!(props.style, "");
        assert!(props.controls.is_none());
        assert!(props.on_load.is_none());
        assert!(props.on_error.is_none());
        assert!(props.on_wheel.is_none());
        assert!(props.on_pointer_down.is_none());
        assert!(props.on_pointer_move.is_none());
        assert!(props.on_pointer_up.is_none());
        assert!(props.on_pointer_cancel.is_none());
        assert!(props.on_lost_pointer_capture.is_none());
        assert!(props.on_double_click.is_none());
    }

    #[test]
    fn viewer_classes_match_the_vue_markers() {
        assert_eq!(image_viewer_classes(""), "hk-image-viewer");
        assert_eq!(
            image_viewer_classes("hk-image-lightbox-stage-viewer"),
            "hk-image-viewer hk-image-lightbox-stage-viewer"
        );

        assert_eq!(
            image_viewer_img_classes(false, false),
            "hk-image-viewer-img"
        );
        assert_eq!(
            image_viewer_img_classes(true, false),
            "hk-image-viewer-img is-loading"
        );
        assert_eq!(
            image_viewer_img_classes(false, true),
            "hk-image-viewer-img is-animatable"
        );
        assert_eq!(
            image_viewer_img_classes(true, true),
            "hk-image-viewer-img is-loading is-animatable"
        );

        // Vue: `isZoomed ? (dragging ? "grabbing" : "grab") : "zoom-in"`.
        assert_eq!(image_viewer_cursor(false, false), "zoom-in");
        assert_eq!(image_viewer_cursor(false, true), "zoom-in");
        assert_eq!(image_viewer_cursor(true, false), "grab");
        assert_eq!(image_viewer_cursor(true, true), "grabbing");
    }

    #[test]
    fn viewer_fit_never_upscales_past_the_natural_size() {
        // The litmus box: 800x600 into 400x300 → 0.5 on both axes.
        assert_eq!(
            image_viewer_fit_scale(CONTENT_W, CONTENT_H, VIEWPORT_W, VIEWPORT_H, 0),
            0.5
        );
        // A small image in a big canvas keeps its natural size (min with 1).
        assert_eq!(image_viewer_fit_scale(100.0, 100.0, 400.0, 300.0, 0), 1.0);
        // Portrait into a landscape canvas: the tighter axis wins (0.25).
        assert_eq!(image_viewer_fit_scale(800.0, 1200.0, 400.0, 300.0, 0), 0.25);
        // Unknown boxes keep Vue's pre-load fit.
        assert_eq!(image_viewer_fit_scale(0.0, 0.0, 400.0, 300.0, 0), 1.0);
        assert_eq!(image_viewer_fit_scale(800.0, 600.0, 0.0, 0.0, 0), 1.0);
        // A NaN box cannot produce a NaN fit.
        assert_eq!(
            image_viewer_fit_scale(f64::NAN, CONTENT_H, VIEWPORT_W, VIEWPORT_H, 0),
            1.0
        );
    }

    #[test]
    fn viewer_zoom_clamps_into_fit_and_max() {
        // Vue: `Math.max(fit, Math.min(MAX_ZOOM, next))`.
        assert_eq!(image_viewer_clamp_scale(2.0, 0.5), 2.0);
        assert_eq!(image_viewer_clamp_scale(0.1, 0.5), 0.5);
        assert_eq!(image_viewer_clamp_scale(99.0, 0.5), IMAGE_VIEWER_MAX_ZOOM);
        assert_eq!(image_viewer_clamp_scale(8.0, 0.5), 8.0);
        // A NaN request falls to the resting camera instead of poisoning the
        // transform string.
        assert_eq!(image_viewer_clamp_scale(f64::NAN, 0.5), 0.5);
        // `fit > MAX_ZOOM` resolves to fit (the clamp order matters).
        assert_eq!(image_viewer_clamp_scale(1.0, 10.0), 10.0);
    }

    #[test]
    fn viewer_zoomed_uses_the_vue_epsilon_and_the_load_gate() {
        assert!(!image_viewer_is_zoomed(false, 0.5, 0.5));
        // Barely above fit is still "zoomed", below the epsilon is not.
        assert!(image_viewer_is_zoomed(false, 0.502, 0.5));
        assert!(!image_viewer_is_zoomed(false, 0.5005, 0.5));
        // Vue gates the whole marker on `loaded`.
        assert!(!image_viewer_is_zoomed(true, 4.0, 0.5));
    }

    #[test]
    fn viewer_pan_clamps_to_the_panned_bounds_and_centres_a_fitting_box() {
        // Drawn 1600x1200 in 400x300: the pan window is [-1200, 0] / [-900, 0].
        assert_eq!(
            image_viewer_clamp_pan(1600.0, 1200.0, VIEWPORT_W, VIEWPORT_H, -500.0, 400.0),
            (-500.0, 0.0)
        );
        assert_eq!(
            image_viewer_clamp_pan(1600.0, 1200.0, VIEWPORT_W, VIEWPORT_H, -9999.0, -9999.0),
            (-1200.0, -900.0)
        );
        assert_eq!(
            image_viewer_clamp_pan(1600.0, 1200.0, VIEWPORT_W, VIEWPORT_H, 500.0, 500.0),
            (0.0, 0.0)
        );
        // A box that fits is CENTRED, regardless of the requested pan.
        assert_eq!(
            image_viewer_clamp_pan(200.0, 150.0, VIEWPORT_W, VIEWPORT_H, 123.0, -50.0),
            (100.0, 75.0)
        );
        // Unknown boxes cannot clamp: the request renders verbatim.
        assert_eq!(
            image_viewer_clamp_pan(0.0, 0.0, 0.0, 0.0, -42.0, 17.0),
            (-42.0, 17.0)
        );
        // Centring agrees with `center_pan`, and an unknown viewport parks at 0.
        assert_eq!(
            image_viewer_center_pan(200.0, 150.0, VIEWPORT_W, VIEWPORT_H),
            (100.0, 75.0)
        );
        assert_eq!(image_viewer_center_pan(0.0, 0.0, 0.0, 0.0), (0.0, 0.0));
    }

    #[test]
    fn viewer_double_click_toggles_between_fit_and_three_times_fit() {
        // At fit (fit 0.5) → 1.5; the litmus zoom the Vue tests assert.
        assert_eq!(image_viewer_double_click_target(0.5, false), 1.5);
        // Zoomed → back to fit.
        assert_eq!(image_viewer_double_click_target(0.5, true), 0.5);
        // fit * 3 can never pass the ceiling (4 * 3 = 12 → 8).
        assert_eq!(
            image_viewer_double_click_target(4.0, false),
            IMAGE_VIEWER_MAX_ZOOM
        );
    }

    #[test]
    fn viewer_anchored_zoom_keeps_the_anchor_point_still() {
        // Vue's setZoom: content point under the cursor stays put.
        let (pan_x, pan_y) = image_viewer_anchor_pan(1.0, 3.0, 200.0, 150.0, 0.0, 0.0);
        assert_eq!((pan_x, pan_y), (-400.0, -300.0));
        // A zero/negative scale cannot anchor: the pan passes through.
        assert_eq!(
            image_viewer_anchor_pan(0.0, 3.0, 10.0, 10.0, 7.0, 8.0),
            (7.0, 8.0)
        );
        // Wheel step: one notch in and back out returns the same scale.
        assert_eq!(image_viewer_wheel_scale(1.0, -1.0), 1.15);
        assert_eq!(
            image_viewer_wheel_scale(image_viewer_wheel_scale(1.0, -1.0), 1.0),
            1.0
        );
    }

    #[test]
    fn viewer_rotation_swaps_the_drawn_box_and_compensates_the_origin() {
        // Quarter turns are normalized; odd turns swap the box.
        assert_eq!(
            image_viewer_drawn_size(CONTENT_W, CONTENT_H, 0),
            (800.0, 600.0)
        );
        assert_eq!(
            image_viewer_drawn_size(CONTENT_W, CONTENT_H, 1),
            (600.0, 800.0)
        );
        assert_eq!(
            image_viewer_drawn_size(CONTENT_W, CONTENT_H, 2),
            (800.0, 600.0)
        );
        assert_eq!(
            image_viewer_drawn_size(CONTENT_W, CONTENT_H, 3),
            (600.0, 800.0)
        );
        assert_eq!(image_viewer_rotation_turns(5), 1);
        // Fit follows the rotated box: 600x800 into 400x300 → 0.375.
        assert_eq!(
            image_viewer_fit_scale(CONTENT_W, CONTENT_H, VIEWPORT_W, VIEWPORT_H, 1),
            0.375
        );
        // The rotated transform carries the origin compensation.
        assert_eq!(
            image_viewer_transform(CONTENT_W, CONTENT_H, 1.0, 0.0, 0.0, 1),
            "translate(0px, 0px) scale(1) translate(600px, 0px) rotate(90deg)"
        );
        assert_eq!(
            image_viewer_transform(CONTENT_W, CONTENT_H, 1.0, 0.0, 0.0, 2),
            "translate(0px, 0px) scale(1) translate(800px, 600px) rotate(180deg)"
        );
        assert_eq!(
            image_viewer_transform(CONTENT_W, CONTENT_H, 1.0, 0.0, 0.0, 3),
            "translate(0px, 0px) scale(1) translate(0px, 800px) rotate(270deg)"
        );
    }

    #[test]
    fn viewer_transform_matches_the_vue_camera_string() {
        // Vue at rest / panned: `translate(panX, panY) scale(zoom)`.
        assert_eq!(
            image_viewer_transform(CONTENT_W, CONTENT_H, 0.5, -10.0, -20.0, 0),
            "translate(-10px, -20px) scale(0.5)"
        );
        // JS `String(number)` parity, including `-0` and non-finite parking.
        assert_eq!(image_viewer_css_length(1.0), "1");
        assert_eq!(image_viewer_css_length(0.5), "0.5");
        assert_eq!(image_viewer_css_length(-0.0), "0");
        assert_eq!(image_viewer_css_length(f64::NAN), "0");
        assert_eq!(image_viewer_css_length(f64::INFINITY), "0");
    }

    #[test]
    fn viewer_render_carries_the_camera_and_the_state_classes() {
        // Loaded, zoomed camera with known boxes: the transform is the clamped
        // camera, the cursor follows it and the spinner is gone.
        let html = ImageViewer(ImageViewerProps {
            src: "/wallpaper.svg".to_string(),
            alt: "wallpaper".to_string(),
            loading: false,
            scale: Some(2.0),
            offset_x: -100.0,
            offset_y: -50.0,
            content_width: CONTENT_W,
            content_height: CONTENT_H,
            viewport_width: VIEWPORT_W,
            viewport_height: VIEWPORT_H,
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains(r#"class="hk-image-viewer-img""#), "{html}");
        assert!(
            html.contains("transform:translate(-100px, -50px) scale(2)"),
            "the camera must ride the img style: {html}"
        );
        assert!(html.contains("transform-origin:0 0"), "{html}");
        assert!(html.contains("cursor:grab"), "{html}");
        assert!(html.contains(r#"draggable="false""#), "{html}");
        assert!(
            !html.contains("hk-image-viewer-loading"),
            "a settled load must not render the spinner: {html}"
        );

        // A too-small scale is normalized onto the fit floor (Vue's setZoom).
        let html = ImageViewer(ImageViewerProps {
            loading: false,
            scale: Some(0.1),
            content_width: CONTENT_W,
            content_height: CONTENT_H,
            viewport_width: VIEWPORT_W,
            viewport_height: VIEWPORT_H,
            ..Default::default()
        })
        .render_to_html();
        assert!(
            html.contains("scale(0.5)"),
            "the camera must clamp onto the fit floor: {html}"
        );
        // Clamped onto the fit floor == not zoomed, so Vue's cursor stays
        // `zoom-in` (the `grab` cursor belongs to the zoomed state).
        assert!(html.contains("cursor:zoom-in"), "{html}");

        // `scale: None` is Vue's resting camera: fit + centred (drawn ==
        // viewport here, so the clamp centres it at the origin).
        let html = ImageViewer(ImageViewerProps {
            loading: false,
            content_width: CONTENT_W,
            content_height: CONTENT_H,
            viewport_width: VIEWPORT_W,
            viewport_height: VIEWPORT_H,
            ..Default::default()
        })
        .render_to_html();
        assert!(
            html.contains("transform:translate(0px, 0px) scale(0.5)"),
            "the resting camera is fit + centred: {html}"
        );
        // Parked exactly at fit, the canvas is not "zoomed" yet.
        assert!(html.contains("cursor:zoom-in"), "{html}");

        // The default render is Vue's initial state: pending + animatable off.
        let html = ImageViewer(ImageViewerProps::default()).render_to_html();
        assert!(
            html.contains("hk-image-viewer-img is-loading"),
            "the default render is loading: {html}"
        );
        assert!(html.contains("hk-image-viewer-loading"), "{html}");
        assert!(html.contains("cursor:zoom-in"), "{html}");
    }

    #[test]
    fn viewer_styles_come_from_the_canonical_vue_sheet() {
        let css = ImageViewerComponent::styles();
        assert!(
            css.contains(".hk-image-viewer") && css.contains(".hk-image-viewer-img"),
            "image viewer css must carry the vue classes"
        );
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored image viewer sheet"
        );
    }
}
