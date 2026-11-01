// hi-components/src/basic/color_picker.rs
// ColorPicker — mirror of the canonical Vue `HkColorPicker`: a color swatch
// trigger plus an RGB panel (three channel sliders, a hex field, and the
// optional hue/saturation/lightness band the host clamps against).
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkColorPicker.scss`, vendored under
// `src/styles/vue-mirror/` and guarded by `tests/vue_mirror_drift_tests.rs`),
// compiled with `no_hash` so the `.hk-color-picker*` class names are literal
// and identical in both forms. The hex field is the mirrored
// [`crate::basic::input::Input`] — Vue nests `HkInput` the same way. DOM
// contract:
//
//   div.hk-color-picker[data-layout=stack|row] [class] [style]
//     button.hk-color-picker-swatch-btn      type="button"
//                                            aria-haspopup/aria-expanded/aria-label
//       div.hk-color-picker-swatch           style="background:#rrggbb"
//       span.hk-color-picker-label           (label)
//     div.hk-color-picker-panel              (only while `open`; inline geometry)
//       div.hk-color-picker-body
//         div.hk-color-picker-controls
//           div.hk-color-picker-sliders
//             div.hk-color-picker-slider-row  (x3: r, g, b)
//               span.hk-color-picker-slider-label  R|G|B
//               div.hk-color-picker-channel-slider
//                 div.hk-color-picker-slider-track style="background:linear-…"
//                 div.hk-color-picker-slider-thumb style="left:{pct}%"
//               span.hk-color-picker-slider-value  {0..255}
//           div.hk-color-picker-hex-row
//             div.hk-input-wrapper                  (the nested HkInput mirror)
//               div.hk-input-box.hk-input-box-md
//                 span.hk-input-affix.hk-input-prefix
//                   span.hk-color-picker-hex-hash  "#"
//                 input.hk-input-element value="{rrggbb}"
//           div.hk-color-picker-band                    (hue clamp present)
//             div.hk-color-picker-hue-band  style="background:linear-…"
//               div.hk-color-picker-hue-band-thumb style="left:{pct}%;background:#…"
//             div.hk-color-picker-band-caption  "S 20–80% · L 30–90%"
//           div.hk-color-picker-band-caption            (bands without a hue clamp)
//
// Vue prop mapping: `r`/`g`/`b` → [`ColorPickerProps::r`]/`g`/`b` (Vue marks
// them required; Rust props must be `Default`-constructible, so they default to
// black), `hueClamp` → [`ColorPickerProps::hue_clamp`], `sRange`/`lRange` →
// `s_range`/`l_range`, `layout` → [`ColorPickerLayout`] (the `data-layout`
// token), `change` → [`ColorPickerProps::on_change`].
//
// The color math is Vue's `theme/tokenGroups.ts`, function by function:
// `rgbToHsl` / `hslToRgb` / `wrapHue` / `hueDelta` / `clampHue` /
// `clampRgbToBands` plus the picker's own `rgbToHex`, `channelGradient`,
// `getValueFromX` math and the band geometry all live in the free functions
// below, so they are testable without a DOM.
//
// Every emitted value passes through the same band clamp the host applies on
// save (Vue's `clampRGB` defense in depth), so an out-of-band swipe can never
// leak a color the host would have to correct.
//
// Behaviour deltas vs Vue (documented):
//   * **the panel is inline, not a popover.** Vue mounts an `HkPopover`
//     (portal, popup-manager z band, auto-flip, `sheetOnMobile` bottom sheet).
//     The mirror renders `div.hk-color-picker-panel` in place with inline
//     ABSOLUTE geometry (`position:relative` + `top:calc(100% + 6px)`, Vue's
//     `bottom-start` + `offset: 6`), so the sheet's panel chrome still applies
//     but the mobile sheet rule (`.hk-popover-panel.hk-is-sheet.
//     hk-color-picker-panel`) never matches and there is no backdrop, no
//     Escape/outside-click dismissal and no `title` heading. `open` is
//     CONTROLLED (`open` + `on_open_change`) because tairitsu 0.5.22 has no
//     per-instance component state — the host owns dismissal, exactly like the
//     floating action button's dial.
//   * **the trigger carries the disclosure aria.** Vue leaves the swatch
//     button bare and lets `HkPopover` own the dialog semantics; with no popover
//     the mirror puts `aria-haspopup` / `aria-expanded` / `aria-label` on the
//     button so the open state is announced.
//   * **no window-level drag listeners.** Vue adds `pointermove` / `pointerup`
//     / `pointercancel` to `window` on pointerdown and removes them on release
//     (plus on unmount). A component here cannot own window listeners and
//     `setPointerCapture` is not exposed, so a drag keeps tracking only while
//     the pointer stays inside the channel slider; `pointerup` / `pointercancel`
//     on the slider still end it. This is the same trade the `Slider` mirror
//     documents.
//   * **pointer reads need a host measurement.** Vue measures its live
//     `trackRef` rect; the mirror asks for the event's `currentTarget` rect
//     (`tairitsu_vdom::get_bounding_client_rect`) and degrades to a no-op when
//     the host cannot measure (a non-DOM build reports a zero-width rect), so a
//     touch drag never emits a bogus value.
//   * **no sliders' own `aria`.** Vue's `ColorSlider` is a bare div pair (the
//     channel row is a pointer-only control with a visible numeric readout);
//     the mirror keeps exactly that and does not invent a `role="slider"`
//     surface the canonical component does not have.
//   * `open` is a real prop, so a host can start the panel open (Vue's `isOpen`
//     always starts closed). Host `class`/`style` land on the root, which is
//     Vue's default attribute fallthrough.

use std::cell::Cell;

use tairitsu_vdom::{DomHandle, PointerEvent, get_bounding_client_rect};

use crate::basic::input::{Input, InputProps};
use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct ColorPickerComponent;

/// An RGB triple (Vue: the `change` payload `{ r, g, b }`).
#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub struct ColorRgb {
    pub r: u8,
    pub g: u8,
    pub b: u8,
}

/// Vue's `HueClamp`: a hue band locked to `center ± range` degrees, circular.
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub struct ColorHueClamp {
    /// Band center in degrees (wrapped on read).
    pub center: f64,
    /// Allowed distance from the center in degrees, both directions.
    pub range: f64,
}

/// One channel of the RGB panel (Vue's `CHANNELS` table).
#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum ColorChannel {
    #[default]
    R,
    G,
    B,
}

impl ColorChannel {
    /// The prop key (Vue: `channel`), also the gradient selector.
    pub fn key(self) -> &'static str {
        match self {
            ColorChannel::R => "r",
            ColorChannel::G => "g",
            ColorChannel::B => "b",
        }
    }

    /// The slider row's caption letter (Vue: `CHANNELS[].label`).
    pub fn label(self) -> &'static str {
        match self {
            ColorChannel::R => "R",
            ColorChannel::G => "G",
            ColorChannel::B => "B",
        }
    }

    /// The three rows, in Vue's render order.
    pub const ALL: [ColorChannel; 3] = [ColorChannel::R, ColorChannel::G, ColorChannel::B];
}

/// Trigger layout (Vue: `"stack" | "row"`, default `stack`).
#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum ColorPickerLayout {
    /// Swatch above the label (dialogs with few colors).
    #[default]
    Stack,
    /// Swatch left, single-line label right with ellipsis (dense grids).
    Row,
}

impl ColorPickerLayout {
    /// The root's `data-layout` value exactly as Vue emits it.
    pub fn data_value(self) -> &'static str {
        match self {
            ColorPickerLayout::Stack => "stack",
            ColorPickerLayout::Row => "row",
        }
    }
}

/// The hue band's visual affordance (Vue's `hueBand` computed).
#[derive(Clone, PartialEq, Debug, Default)]
pub struct ColorHueBand {
    /// `linear-gradient(...)` across the permitted arc.
    pub gradient: String,
    /// The current hue's position inside that arc, `0..=100` percent.
    pub pct: f64,
}

thread_local! {
    /// Which channel a pointer drag is currently driving. Non-reactive by
    /// design (it never drives rendering) and a singleton because one pointer
    /// drags one slider at a time in a wasm thread — the same registry pattern
    /// as `basic/slider.rs`'s drag flag.
    static DRAGGING_CHANNEL: Cell<Option<ColorChannel>> = const { Cell::new(None) };
}

fn color_dragging() -> Option<ColorChannel> {
    DRAGGING_CHANNEL.with(|channel| channel.get())
}

fn set_color_dragging(channel: Option<ColorChannel>) {
    DRAGGING_CHANNEL.with(|cell| cell.set(channel));
}

/// JavaScript `Math.round` for the non-negative channel range (ties go up,
/// which is also `f64::round`'s behaviour there).
fn color_round(value: f64) -> f64 {
    value.round()
}

/// Clamp into `0..=255` and round — Vue's `clamp(v)` applied where a channel
/// value is finally written.
pub fn color_clamp_channel(value: f64) -> u8 {
    if value.is_nan() {
        return 0;
    }
    color_round(value.clamp(0.0, 255.0)) as u8
}

/// The channel carried by this triple (Vue: `props[def.key]`).
pub fn color_channel_value(rgb: ColorRgb, channel: ColorChannel) -> u8 {
    match channel {
        ColorChannel::R => rgb.r,
        ColorChannel::G => rgb.g,
        ColorChannel::B => rgb.b,
    }
}

/// The triple with one channel replaced (Vue: `next[ch] = clamp(value)`).
pub fn color_with_channel(rgb: ColorRgb, channel: ColorChannel, value: u8) -> ColorRgb {
    match channel {
        ColorChannel::R => ColorRgb { r: value, ..rgb },
        ColorChannel::G => ColorRgb { g: value, ..rgb },
        ColorChannel::B => ColorRgb { b: value, ..rgb },
    }
}

/// Vue's `rgbToHex`: `#rrggbb`, lowercase, zero-padded per channel.
pub fn color_rgb_to_hex(rgb: ColorRgb) -> String {
    format!("#{:02x}{:02x}{:02x}", rgb.r, rgb.g, rgb.b)
}

/// The hex field's text (Vue: `hexDisplay`, the `#` rides the prefix icon).
pub fn color_hex_display(rgb: ColorRgb) -> String {
    format!("{:02x}{:02x}{:02x}", rgb.r, rgb.g, rgb.b)
}

/// Vue's `onHexInput` guard: the field only publishes a color once it holds
/// exactly six hex digits. Both `"rrggbb"` (the field's own shape) and
/// `"#rrggbb"` (a paste) are accepted.
pub fn color_parse_hex(text: &str) -> Option<ColorRgb> {
    let digits = text.strip_prefix('#').unwrap_or(text);
    if digits.len() != 6 || !digits.chars().all(|ch| ch.is_ascii_hexdigit()) {
        return None;
    }
    let r = u8::from_str_radix(&digits[0..2], 16).ok()?;
    let g = u8::from_str_radix(&digits[2..4], 16).ok()?;
    let b = u8::from_str_radix(&digits[4..6], 16).ok()?;
    Some(ColorRgb { r, g, b })
}

/// Vue's `channelGradient`: the track previews the channel at its two extremes.
pub fn color_channel_gradient(rgb: ColorRgb, channel: ColorChannel) -> String {
    let from = match channel {
        ColorChannel::R => color_rgb_to_hex(ColorRgb { r: 0, ..rgb }),
        ColorChannel::G => color_rgb_to_hex(ColorRgb { g: 0, ..rgb }),
        ColorChannel::B => color_rgb_to_hex(ColorRgb { b: 0, ..rgb }),
    };
    let to = match channel {
        ColorChannel::R => color_rgb_to_hex(ColorRgb { r: 255, ..rgb }),
        ColorChannel::G => color_rgb_to_hex(ColorRgb { g: 255, ..rgb }),
        ColorChannel::B => color_rgb_to_hex(ColorRgb { b: 255, ..rgb }),
    };
    format!("linear-gradient(to right, {from}, {to})")
}

/// The thumb position as a percentage of the channel range (Vue: `pct`).
pub fn color_slider_pct(value: u8) -> f64 {
    f64::from(value) / 255.0 * 100.0
}

/// A pointer ratio across the track rendered back into a channel value (Vue:
/// `getValueFromX` minus the rect lookup).
pub fn color_value_from_ratio(ratio: f64) -> u8 {
    if ratio.is_nan() {
        return 0;
    }
    color_clamp_channel(ratio.clamp(0.0, 1.0) * 255.0)
}

/// Vue's `wrapHue`: fold any angle into `0..360`.
pub fn color_wrap_hue(hue: f64) -> f64 {
    ((hue % 360.0) + 360.0) % 360.0
}

/// Vue's `hueDelta`: the signed circular distance from `center`, `-180..=180`.
pub fn color_hue_delta(hue: f64, center: f64) -> f64 {
    ((color_wrap_hue(hue) - color_wrap_hue(center) + 540.0) % 360.0) - 180.0
}

/// Vue's `clampHue`: clamp a hue into the circular band `center ± range`.
pub fn color_clamp_hue(hue: f64, center: f64, range: f64) -> f64 {
    let delta = color_hue_delta(hue, center).clamp(-range, range);
    color_wrap_hue(color_wrap_hue(center) + delta)
}

/// Vue's `rgbToHsl` (hue in degrees, saturation/lightness in `0..=1`).
pub fn color_rgb_to_hsl(rgb: ColorRgb) -> (f64, f64, f64) {
    let rn = f64::from(rgb.r) / 255.0;
    let gn = f64::from(rgb.g) / 255.0;
    let bn = f64::from(rgb.b) / 255.0;
    let max = rn.max(gn).max(bn);
    let min = rn.min(gn).min(bn);
    let lightness = (max + min) / 2.0;
    let delta = max - min;
    if delta == 0.0 {
        return (0.0, 0.0, lightness);
    }
    let saturation = if lightness > 0.5 {
        delta / (2.0 - max - min)
    } else {
        delta / (max + min)
    };
    let hue = if max == rn {
        ((gn - bn) / delta + if gn < bn { 6.0 } else { 0.0 }) * 60.0
    } else if max == gn {
        ((bn - rn) / delta + 2.0) * 60.0
    } else {
        ((rn - gn) / delta + 4.0) * 60.0
    };
    (color_wrap_hue(hue), saturation, lightness)
}

/// Vue's `hslToRgb`, rounded back into integer channels.
pub fn color_hsl_to_rgb(hue: f64, saturation: f64, lightness: f64) -> ColorRgb {
    let hp = color_wrap_hue(hue) / 60.0;
    let c = (1.0 - (2.0 * lightness - 1.0).abs()) * saturation;
    let x = c * (1.0 - (hp % 2.0 - 1.0).abs());
    let (r, g, b) = if hp < 1.0 {
        (c, x, 0.0)
    } else if hp < 2.0 {
        (x, c, 0.0)
    } else if hp < 3.0 {
        (0.0, c, x)
    } else if hp < 4.0 {
        (0.0, x, c)
    } else if hp < 5.0 {
        (x, 0.0, c)
    } else {
        (c, 0.0, x)
    };
    let m = lightness - c / 2.0;
    ColorRgb {
        r: color_clamp_channel((r + m) * 255.0),
        g: color_clamp_channel((g + m) * 255.0),
        b: color_clamp_channel((b + m) * 255.0),
    }
}

/// Clamp into an optional `(low, high)` band (Vue: `clampRange01`; a
/// degenerate band whose bounds are swapped is normalized rather than
/// panicking the way `f64::clamp` would).
fn color_clamp_range01(value: f64, range: Option<(f64, f64)>) -> f64 {
    match range {
        Some((low, high)) => value.clamp(low.min(high), high.max(low)),
        None => value,
    }
}

/// Vue's `clampRgbToBands`: clamp an arbitrary color into the hue/saturation/
/// lightness bands. A color already inside every band round-trips unchanged
/// (integer RGB is reproduced up to float rounding).
pub fn color_clamp_to_bands(
    rgb: ColorRgb,
    hue_clamp: Option<ColorHueClamp>,
    s_range: Option<(f64, f64)>,
    l_range: Option<(f64, f64)>,
) -> ColorRgb {
    if hue_clamp.is_none() && s_range.is_none() && l_range.is_none() {
        return rgb;
    }
    let (mut hue, mut saturation, mut lightness) = color_rgb_to_hsl(rgb);
    if let Some(clamp) = hue_clamp {
        hue = color_clamp_hue(hue, clamp.center, clamp.range);
    }
    saturation = color_clamp_range01(saturation, s_range);
    lightness = color_clamp_range01(lightness, l_range);
    color_hsl_to_rgb(hue, saturation, lightness)
}

/// Vue's `hueBand` computed: `None` without a clamp (or with a zero range).
pub fn color_hue_band(hue_clamp: Option<ColorHueClamp>, rgb: ColorRgb) -> Option<ColorHueBand> {
    let clamp = hue_clamp?;
    if clamp.range <= 0.0 {
        return None;
    }
    let center = color_wrap_hue(clamp.center);
    let from = center - clamp.range;
    let to = center + clamp.range;
    let gradient = format!(
        "linear-gradient(to right, hsl({from}, 70%, 50%), hsl({center}, 70%, 50%), hsl({to}, 70%, 50%))"
    );
    let (hue, _, _) = color_rgb_to_hsl(rgb);
    let delta = color_hue_delta(hue, center).clamp(-clamp.range, clamp.range);
    let pct = ((delta + clamp.range) / (2.0 * clamp.range)) * 100.0;
    Some(ColorHueBand {
        gradient,
        pct: pct.clamp(0.0, 100.0),
    })
}

/// Vue's `bandCaption`: `"S 20–80% · L 30–90%"`, or `None` with no bands.
pub fn color_band_caption(
    s_range: Option<(f64, f64)>,
    l_range: Option<(f64, f64)>,
) -> Option<String> {
    let mut parts: Vec<String> = Vec::new();
    if let Some((low, high)) = s_range {
        parts.push(format!(
            "S {}–{}%",
            color_round(low * 100.0) as i64,
            color_round(high * 100.0) as i64
        ));
    }
    if let Some((low, high)) = l_range {
        parts.push(format!(
            "L {}–{}%",
            color_round(low * 100.0) as i64,
            color_round(high * 100.0) as i64
        ));
    }
    if parts.is_empty() {
        None
    } else {
        Some(parts.join(" · "))
    }
}

/// The pointer's `0..1` ratio across the measured slider, or `None` when the
/// host cannot measure the element (non-DOM builds report a zero-width rect).
fn color_pointer_ratio(client_x: i32, current_target: Option<u64>) -> Option<f64> {
    let handle = current_target?;
    let rect = get_bounding_client_rect(DomHandle::from_raw(handle));
    if rect.width <= 0.0 {
        return None;
    }
    Some(((f64::from(client_x) - rect.x) / rect.width).clamp(0.0, 1.0))
}

/// Inline geometry for the mirror's panel — Vue's popover owns this
/// (`placement="bottom-start"` + `offset={6}`); the sheet styles the rest.
const PANEL_STYLE: &str = "position:absolute;top:calc(100% + 6px);left:0;z-index:30";

#[define_props]
pub struct ColorPickerProps {
    /// Red channel (Vue marks it required; a Rust prop needs a `Default`).
    #[default(0)]
    pub r: u8,

    /// Green channel.
    #[default(0)]
    pub g: u8,

    /// Blue channel.
    #[default(0)]
    pub b: u8,

    /// Trigger label (Vue: `label`, default `""`).
    #[default]
    pub label: String,

    #[default]
    pub layout: ColorPickerLayout,

    /// Optional physical-color clamp: hue locked to `center ± range` degrees.
    pub hue_clamp: Option<ColorHueClamp>,

    /// Optional saturation safe band, `0..=1`.
    pub s_range: Option<(f64, f64)>,

    /// Optional lightness safe band, `0..=1`.
    pub l_range: Option<(f64, f64)>,

    /// The panel's disclosure state (Vue owns this internally; the mirror is
    /// controlled — see the header delta).
    #[default]
    pub open: bool,

    /// Fired with the requested disclosure state when the trigger is pressed.
    pub on_open_change: Option<EventHandler<bool>>,

    /// Vue's `change`: every value the panel produces, already band-clamped.
    pub on_change: Option<EventHandler<ColorRgb>>,

    /// Host classes, appended to the root.
    #[default]
    pub class: String,

    /// Host style, applied to the root.
    #[default]
    pub style: String,
}

#[component]
pub fn ColorPicker(props: ColorPickerProps) -> Element {
    let rgb = ColorRgb {
        r: props.r,
        g: props.g,
        b: props.b,
    };
    let hex = color_rgb_to_hex(rgb);
    let hue_clamp = props.hue_clamp;
    let s_range = props.s_range;
    let l_range = props.l_range;
    let open = props.open;

    // Every path below pushes its result through the same band clamp, so the
    // panel can never hand the host a color it would have to correct.
    let on_change = props.on_change.clone();
    let emit = move |next: ColorRgb| {
        if let Some(handler) = on_change.as_ref() {
            handler.call(color_clamp_to_bands(next, hue_clamp, s_range, l_range));
        }
    };

    let on_open_change = props.on_open_change.clone();
    let trigger_click = move |_event: MouseEvent| {
        if let Some(handler) = on_open_change.as_ref() {
            handler.call(!open);
        }
    };

    let mut trigger = VElement::new("button")
        .attr("type", "button")
        .class("hk-color-picker-swatch-btn")
        .attr("aria-haspopup", "dialog")
        .attr("aria-expanded", if open { "true" } else { "false" })
        .attr(
            "aria-label",
            if props.label.is_empty() {
                hex.clone()
            } else {
                format!("{} {}", props.label, hex)
            },
        )
        .on_click(trigger_click)
        .child(VNode::Element(Box::new(
            VElement::new("div")
                .class("hk-color-picker-swatch")
                .style(format!("background:{hex}")),
        )));
    if !props.label.is_empty() {
        trigger = trigger.child(VNode::Element(Box::new(
            VElement::new("span")
                .class("hk-color-picker-label")
                .child(VNode::Text(VText::new(&props.label))),
        )));
    }
    let trigger = VNode::Element(Box::new(trigger));

    let panel = if open {
        // ── the three channel rows ────────────────────────────────────────
        let mut rows: Vec<VNode> = Vec::with_capacity(ColorChannel::ALL.len());
        for channel in ColorChannel::ALL {
            let value = color_channel_value(rgb, channel);
            let gradient = color_channel_gradient(rgb, channel);
            let pct = color_slider_pct(value);

            let down_emit = emit.clone();
            let on_pointer_down = move |event: PointerEvent| {
                set_color_dragging(Some(channel));
                if let Some(ratio) = color_pointer_ratio(event.client_x, event.current_target) {
                    down_emit(color_with_channel(
                        rgb,
                        channel,
                        color_value_from_ratio(ratio),
                    ));
                }
            };
            let move_emit = emit.clone();
            let on_pointer_move = move |event: PointerEvent| {
                if color_dragging() != Some(channel) {
                    return;
                }
                // Vue drags on window listeners; here the flag alone would
                // stay set after a release outside the slider (the pointerup
                // never reaches this element), so a later HOVER would write
                // values. `buttons == 0` means "no button held" — the release
                // edge Vue would have seen.
                if event.buttons == 0 {
                    set_color_dragging(None);
                    return;
                }
                if let Some(ratio) = color_pointer_ratio(event.client_x, event.current_target) {
                    move_emit(color_with_channel(
                        rgb,
                        channel,
                        color_value_from_ratio(ratio),
                    ));
                }
            };
            let on_pointer_up = move |_event: PointerEvent| set_color_dragging(None);
            // `pointercancel` has no typed builder in tairitsu 0.5.22; the
            // boxed register is what the element offers (the payload is
            // unused, only the edge matters).
            let on_pointer_cancel = move |_event: Box<dyn EventData>| set_color_dragging(None);

            let track = VElement::new("div")
                .class("hk-color-picker-slider-track")
                .style(format!("background:{gradient}"));
            let thumb = VElement::new("div")
                .class("hk-color-picker-slider-thumb")
                .style(format!("left:{pct}%"));
            let slider = VElement::new("div")
                .class("hk-color-picker-channel-slider")
                .on_pointerdown(on_pointer_down)
                .on_pointermove(on_pointer_move)
                .on_pointerup(on_pointer_up)
                .on_event("pointercancel", on_pointer_cancel)
                .child(VNode::Element(Box::new(track)))
                .child(VNode::Element(Box::new(thumb)));

            let row = VElement::new("div")
                .class("hk-color-picker-slider-row")
                .child(VNode::Element(Box::new(
                    VElement::new("span")
                        .class("hk-color-picker-slider-label")
                        .child(VNode::Text(VText::new(channel.label()))),
                )))
                .child(VNode::Element(Box::new(slider)))
                .child(VNode::Element(Box::new(
                    VElement::new("span")
                        .class("hk-color-picker-slider-value")
                        .child(VNode::Text(VText::new(&value.to_string()))),
                )));
            rows.push(VNode::Element(Box::new(row)));
        }

        // ── the hex field (the nested HkInput mirror) ─────────────────────
        let hex_emit = emit.clone();
        let hex_input = Input(InputProps {
            model_value: color_hex_display(rgb),
            prefix_icon: Some(rsx! {
                span { class: "hk-color-picker-hex-hash",
                    "#"
                }
            }),
            oninput: Some(EventHandler::new(move |value: String| {
                if let Some(parsed) = color_parse_hex(&value) {
                    hex_emit(parsed);
                }
            })),
            ..Default::default()
        });

        // ── the band affordance ───────────────────────────────────────────
        let band = color_hue_band(hue_clamp, rgb);
        let caption = color_band_caption(s_range, l_range);
        let band_node = match band {
            Some(band) => {
                let hue_band = VElement::new("div")
                    .class("hk-color-picker-hue-band")
                    .style(format!("background:{}", band.gradient))
                    .child(VNode::Element(Box::new(
                        VElement::new("div")
                            .class("hk-color-picker-hue-band-thumb")
                            .style(format!("left:{}%;background:{}", band.pct, hex)),
                    )));
                let mut node = VElement::new("div")
                    .class("hk-color-picker-band")
                    .child(VNode::Element(Box::new(hue_band)));
                if let Some(caption) = caption.clone() {
                    node = node.child(VNode::Element(Box::new(
                        VElement::new("div")
                            .class("hk-color-picker-band-caption")
                            .child(VNode::Text(VText::new(&caption))),
                    )));
                }
                VNode::Element(Box::new(node))
            }
            // Without a hue clamp Vue still shows a bare caption.
            None => match caption {
                Some(caption) => rsx! {
                    div {
                        class: "hk-color-picker-band-caption",
                        "{caption}"
                    }
                },
                None => empty_vnode(),
            },
        };

        rsx! {
            div {
                class: "hk-color-picker-panel",
                style: PANEL_STYLE,
                div {
                    class: "hk-color-picker-body",
                    div {
                        class: "hk-color-picker-controls",
                        div {
                            class: "hk-color-picker-sliders",
                            {VNode::Fragment(rows)}
                        }
                        div {
                            class: "hk-color-picker-hex-row",
                            {hex_input}
                        }
                        {band_node}
                    }
                }
            }
        }
    } else {
        empty_vnode()
    };

    let mut root_classes = String::from("hk-color-picker");
    if !props.class.is_empty() {
        root_classes.push(' ');
        root_classes.push_str(&props.class);
    }
    // The panel is absolutely positioned inside the root, so the root becomes
    // its containing block only while the panel is showing.
    let mut root_style = String::new();
    if open {
        root_style.push_str("position:relative;");
    }
    if !props.style.is_empty() {
        root_style.push_str(&props.style);
    }

    rsx! {
        div {
            class: root_classes,
            style: root_style,
            "data-layout": props.layout.data_value(),
            {trigger}
            {panel}
        }
    }
}

impl StyledComponent for ColorPickerComponent {
    fn styles() -> &'static str {
        // The canonical Vue sheet, compiled verbatim (no_hash keeps the
        // `.hk-color-picker*` names literal so this CSS matches the Vue build).
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkColorPicker.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "color-picker"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn color_hex_round_trips_through_the_triple() {
        assert_eq!(color_rgb_to_hex(ColorRgb { r: 0, g: 0, b: 0 }), "#000000");
        assert_eq!(
            color_rgb_to_hex(ColorRgb {
                r: 255,
                g: 255,
                b: 255
            }),
            "#ffffff"
        );
        assert_eq!(
            color_rgb_to_hex(ColorRgb {
                r: 18,
                g: 52,
                b: 86
            }),
            "#123456"
        );
        // The field's text is the same triple without the `#` prefix.
        assert_eq!(
            color_hex_display(ColorRgb {
                r: 18,
                g: 52,
                b: 86
            }),
            "123456"
        );
        for rgb in [
            ColorRgb { r: 0, g: 0, b: 0 },
            ColorRgb {
                r: 255,
                g: 0,
                b: 128,
            },
            ColorRgb {
                r: 7,
                g: 200,
                b: 33,
            },
        ] {
            assert_eq!(color_parse_hex(&color_hex_display(rgb)), Some(rgb));
            assert_eq!(color_parse_hex(&color_rgb_to_hex(rgb)), Some(rgb));
        }
    }

    #[test]
    fn color_hex_parse_rejects_everything_vue_rejects() {
        // Vue's `onHexInput` only publishes on exactly six hex digits.
        assert_eq!(color_parse_hex("12345"), None);
        assert_eq!(color_parse_hex("1234567"), None);
        assert_eq!(color_parse_hex("12345g"), None);
        assert_eq!(color_parse_hex(""), None);
        assert_eq!(color_parse_hex("#"), None);
        // Case never matters, the parsed triple is canonical.
        assert_eq!(
            color_parse_hex("ABCDEF"),
            Some(ColorRgb {
                r: 171,
                g: 205,
                b: 239
            })
        );
        assert_eq!(
            color_parse_hex("#00ff7f"),
            Some(ColorRgb {
                r: 0,
                g: 255,
                b: 127
            })
        );
    }

    #[test]
    fn color_channel_clamps_and_gradients() {
        // The channel write path: clamp into 0..=255, round the float.
        assert_eq!(color_clamp_channel(-30.0), 0);
        assert_eq!(color_clamp_channel(300.0), 255);
        assert_eq!(color_clamp_channel(127.4), 127);
        assert_eq!(color_clamp_channel(127.5), 128);
        assert_eq!(color_clamp_channel(f64::NAN), 0);
        let rgb = ColorRgb {
            r: 18,
            g: 52,
            b: 86,
        };
        assert_eq!(color_channel_value(rgb, ColorChannel::G), 52);
        assert_eq!(
            color_with_channel(rgb, ColorChannel::R, 200),
            ColorRgb {
                r: 200,
                g: 52,
                b: 86
            }
        );
        // The track previews the channel at its two extremes.
        assert_eq!(
            color_channel_gradient(rgb, ColorChannel::R),
            "linear-gradient(to right, #003456, #ff3456)"
        );
        assert_eq!(
            color_channel_gradient(rgb, ColorChannel::B),
            "linear-gradient(to right, #123400, #1234ff)"
        );
        assert_eq!(ColorChannel::R.key(), "r");
        assert_eq!(ColorChannel::B.label(), "B");
        assert_eq!(ColorChannel::ALL.len(), 3);
    }

    #[test]
    fn color_slider_values_match_the_pointer_math() {
        assert_eq!(color_slider_pct(0), 0.0);
        assert_eq!(color_slider_pct(255), 100.0);
        assert!((color_slider_pct(51) - 20.0).abs() < 1e-9);
        assert_eq!(color_value_from_ratio(0.0), 0);
        assert_eq!(color_value_from_ratio(1.0), 255);
        // Math.round(127.5) is 128 in JS and in `f64::round`.
        assert_eq!(color_value_from_ratio(0.5), 128);
        // The ratio itself clamps, so a pointer past either end saturates.
        assert_eq!(color_value_from_ratio(-2.0), 0);
        assert_eq!(color_value_from_ratio(9.0), 255);
        assert_eq!(color_value_from_ratio(f64::NAN), 0);
    }

    #[test]
    fn color_hue_math_wraps_and_clamps() {
        assert_eq!(color_wrap_hue(370.0), 10.0);
        assert_eq!(color_wrap_hue(-10.0), 350.0);
        assert_eq!(color_wrap_hue(0.0), 0.0);
        // Signed circular distance, `-180..=180`.
        assert_eq!(color_hue_delta(10.0, 350.0), 20.0);
        assert_eq!(color_hue_delta(350.0, 10.0), -20.0);
        // Half a turn away lands on -180 whichever side it approaches from
        // (`((h - center + 540) % 360) - 180` never returns +180).
        assert_eq!(color_hue_delta(180.0, 0.0), -180.0);
        assert_eq!(color_hue_delta(0.0, 180.0), -180.0);
        // Clamping into `center ± range` stays circular.
        assert_eq!(color_clamp_hue(350.0, 10.0, 30.0), 350.0);
        assert_eq!(color_clamp_hue(100.0, 10.0, 30.0), 40.0);
        assert_eq!(color_clamp_hue(280.0, 10.0, 30.0), 340.0);
    }

    #[test]
    fn color_hsl_round_trips_the_canonical_colors() {
        let cases = [
            ColorRgb { r: 0, g: 0, b: 0 },
            ColorRgb {
                r: 255,
                g: 255,
                b: 255,
            },
            ColorRgb { r: 255, g: 0, b: 0 },
            ColorRgb { r: 0, g: 128, b: 0 },
            ColorRgb {
                r: 18,
                g: 52,
                b: 86,
            },
        ];
        for rgb in cases {
            let (h, s, l) = color_rgb_to_hsl(rgb);
            assert!((0.0..360.0).contains(&h), "hue out of range: {rgb:?}");
            assert!((0.0..=1.0).contains(&s), "saturation out of range: {rgb:?}");
            assert!((0.0..=1.0).contains(&l), "lightness out of range: {rgb:?}");
            // Integer RGB is reproduced up to float rounding.
            let back = color_hsl_to_rgb(h, s, l);
            assert!(
                (i16::from(back.r) - i16::from(rgb.r)).abs() <= 1
                    && (i16::from(back.g) - i16::from(rgb.g)).abs() <= 1
                    && (i16::from(back.b) - i16::from(rgb.b)).abs() <= 1,
                "round trip drifted: {rgb:?} → {back:?}"
            );
        }
        // A pure red sits at hue 0 with full saturation and half lightness.
        let (h, s, l) = color_rgb_to_hsl(ColorRgb { r: 255, g: 0, b: 0 });
        assert_eq!((h, s, l), (0.0, 1.0, 0.5));
    }

    #[test]
    fn color_bands_clamp_only_outside_values() {
        let inside = ColorRgb {
            r: 200,
            g: 60,
            b: 60,
        };
        // No bands at all → the triple comes back untouched.
        assert_eq!(color_clamp_to_bands(inside, None, None, None), inside);
        // A hue band the color already sits inside leaves it alone.
        let band = ColorHueClamp {
            center: 0.0,
            range: 60.0,
        };
        assert_eq!(color_clamp_to_bands(inside, Some(band), None, None), inside);
        // A band it does NOT sit inside rewrites the hue but keeps the shape.
        let cyan = ColorRgb {
            r: 0,
            g: 255,
            b: 255,
        };
        let clamped = color_clamp_to_bands(cyan, Some(band), None, None);
        assert_ne!(clamped, cyan);
        let (hue, _, _) = color_rgb_to_hsl(clamped);
        assert!(
            color_hue_delta(hue, 0.0).abs() <= 60.0 + 1e-6,
            "{clamped:?}"
        );
        // The 0..1 saturation band floors every color at 1.0 (full red).
        let grey = ColorRgb {
            r: 128,
            g: 128,
            b: 128,
        };
        let saturated = color_clamp_to_bands(grey, None, Some((1.0, 1.0)), None);
        let (_, s, _) = color_rgb_to_hsl(saturated);
        assert!(
            s > 0.99,
            "a 1.0 saturation band must saturate: {saturated:?}"
        );
        // The lightness band pins the value.
        let pinned = color_clamp_to_bands(grey, None, None, Some((0.0, 0.0)));
        assert_eq!(pinned, ColorRgb { r: 0, g: 0, b: 0 });
    }

    #[test]
    fn color_hue_band_and_caption_follow_the_bands() {
        // No clamp (or a zero range) → no band row at all.
        assert!(color_hue_band(None, ColorRgb::default()).is_none());
        assert!(
            color_hue_band(
                Some(ColorHueClamp {
                    center: 0.0,
                    range: 0.0
                }),
                ColorRgb::default()
            )
            .is_none()
        );
        let band = color_hue_band(
            Some(ColorHueClamp {
                center: 30.0,
                range: 40.0,
            }),
            ColorRgb { r: 255, g: 0, b: 0 },
        )
        .expect("band");
        assert!(
            band.gradient
                .starts_with("linear-gradient(to right, hsl(-10, 70%, 50%)"),
            "{}",
            band.gradient
        );
        // Red (hue 0) sits 30 of the 40 degrees below the center → 12.5%.
        assert!((band.pct - 12.5).abs() < 1e-6, "{}", band.pct);
        // Captions come from the bands that exist, joined with a middot.
        assert_eq!(color_band_caption(None, None), None);
        assert_eq!(
            color_band_caption(Some((0.2, 0.8)), None).as_deref(),
            Some("S 20–80%")
        );
        assert_eq!(
            color_band_caption(Some((0.2, 0.8)), Some((0.3, 0.9))).as_deref(),
            Some("S 20–80% · L 30–90%")
        );
        assert_eq!(
            color_band_caption(None, Some((0.3, 0.9))).as_deref(),
            Some("L 30–90%")
        );
    }

    #[test]
    fn color_picker_props_default_matches_the_vue_props() {
        let props = ColorPickerProps::default();
        // Vue requires r/g/b; the mirror defaults to black.
        assert_eq!(props.r, 0);
        assert_eq!(props.g, 0);
        assert_eq!(props.b, 0);
        assert_eq!(props.label, "");
        assert_eq!(props.layout, ColorPickerLayout::Stack);
        assert_eq!(props.hue_clamp, None);
        assert_eq!(props.s_range, None);
        assert_eq!(props.l_range, None);
        assert!(!props.open);
        assert!(props.on_open_change.is_none());
        assert!(props.on_change.is_none());
        assert_eq!(props.class, "");
        assert_eq!(props.style, "");
    }

    #[test]
    fn color_picker_layout_tokens_match_vue() {
        assert_eq!(ColorPickerLayout::Stack.data_value(), "stack");
        assert_eq!(ColorPickerLayout::Row.data_value(), "row");
        assert_eq!(ColorPickerLayout::default(), ColorPickerLayout::Stack);
        assert_eq!(ColorChannel::default(), ColorChannel::R);
        assert_eq!(ColorHueBand::default().gradient, "");
    }

    #[test]
    fn color_picker_renders_the_closed_trigger() {
        let html = ColorPicker(ColorPickerProps {
            r: 18,
            g: 52,
            b: 86,
            label: "Accent".to_string(),
            layout: ColorPickerLayout::Row,
            ..Default::default()
        })
        .render_to_html();
        for needle in [
            "hk-color-picker",
            "data-layout=\"row\"",
            "hk-color-picker-swatch-btn",
            "hk-color-picker-swatch",
            "background:#123456",
            "hk-color-picker-label",
            "Accent",
            "aria-haspopup=\"dialog\"",
            "aria-expanded=\"false\"",
            "type=\"button\"",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        // The panel and its controls only exist while open.
        assert!(!html.contains("hk-color-picker-panel"), "{html}");
        assert!(!html.contains("hk-color-picker-slider-track"), "{html}");
        assert!(!html.contains("position:relative"), "{html}");
    }

    #[test]
    fn color_picker_renders_the_open_panel() {
        let html = ColorPicker(ColorPickerProps {
            r: 18,
            g: 52,
            b: 86,
            open: true,
            hue_clamp: Some(ColorHueClamp {
                center: 210.0,
                range: 40.0,
            }),
            s_range: Some((0.2, 0.8)),
            l_range: Some((0.3, 0.9)),
            ..Default::default()
        })
        .render_to_html();
        for needle in [
            "hk-color-picker-panel",
            "hk-color-picker-body",
            "hk-color-picker-controls",
            "hk-color-picker-sliders",
            "hk-color-picker-slider-row",
            "hk-color-picker-channel-slider",
            "hk-color-picker-slider-track",
            "hk-color-picker-slider-thumb",
            "hk-color-picker-slider-label",
            "hk-color-picker-slider-value",
            "hk-color-picker-hex-row",
            "hk-color-picker-hex-hash",
            "hk-input-element",
            "value=\"123456\"",
            "hk-color-picker-band",
            "hk-color-picker-hue-band",
            "hk-color-picker-hue-band-thumb",
            "hk-color-picker-band-caption",
            "S 20–80% · L 30–90%",
            "aria-expanded=\"true\"",
            "position:relative",
            "top:calc(100% + 6px)",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        // Three channel rows, one per channel, in R/G/B order.
        assert_eq!(
            html.matches("hk-color-picker-channel-slider").count(),
            3,
            "one slider per channel: {html}"
        );
        // The R track previews red at both extremes of this triple.
        assert!(html.contains("linear-gradient(to right, #003456"), "{html}");
        let r_at = html
            .find("hk-color-picker-slider-label\">R<")
            .expect("R row");
        let g_at = html
            .find("hk-color-picker-slider-label\">G<")
            .expect("G row");
        let b_at = html
            .find("hk-color-picker-slider-label\">B<")
            .expect("B row");
        assert!(r_at < g_at && g_at < b_at, "channels render in R/G/B order");
    }

    #[test]
    fn color_picker_renders_a_bare_caption_without_a_hue_band() {
        // Vue: a caption with no hue band renders standalone.
        let html = ColorPicker(ColorPickerProps {
            open: true,
            s_range: Some((0.2, 0.8)),
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains("hk-color-picker-band-caption"), "{html}");
        assert!(html.contains("S 20–80%"), "{html}");
        assert!(!html.contains("hk-color-picker-hue-band"), "{html}");
        // …and nothing at all without any band.
        let html = ColorPicker(ColorPickerProps {
            open: true,
            ..Default::default()
        })
        .render_to_html();
        assert!(!html.contains("hk-color-picker-band"), "{html}");
    }

    #[test]
    fn color_picker_styles_come_from_the_canonical_vue_sheet() {
        let css = ColorPickerComponent::styles();
        for needle in [
            ".hk-color-picker",
            ".hk-color-picker-swatch-btn",
            ".hk-color-picker-swatch",
            ".hk-color-picker-label",
            ".hk-color-picker-panel",
            ".hk-color-picker-channel-slider",
            ".hk-color-picker-slider-track",
            ".hk-color-picker-slider-thumb",
            ".hk-color-picker-hue-band",
            ".hk-color-picker-band-caption",
            // The row layout is an attribute selector; assert its prefix (a
            // compiler may re-quote the value).
            "[data-layout",
        ] {
            assert!(
                css.contains(needle),
                "color-picker css must carry the vue hook {needle}"
            );
        }
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored color-picker sheet"
        );
    }
}
