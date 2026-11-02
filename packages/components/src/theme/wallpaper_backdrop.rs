// packages/components/src/theme/wallpaper_backdrop.rs
// WallpaperBackdrop — mirror of the canonical Vue `HkWallpaperBackdrop`
// (the wallpaper stack's page-covering SURFACE).
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkWallpaperBackdrop.scss`, vendored under
// `src/styles/vue-mirror/`), compiled with `no_hash` so the
// `.hk-wallpaper-backdrop*` class names are literal and identical in both
// forms. The root is the ONE fixed, viewport-sized, z-index:-1 layer and
// every art layer fills it (the sheet hoists what the ported renderer
// repeated per layer).
//
// DOM contract (mirrors Vue's render output one-to-one):
//
//   div.hk-wallpaper-backdrop.hk-wallpaper-backdrop-{mode}
//        [data-hk-wallpaper-mode={mode}] [data-hk-wallpaper-art=true|false]
//        [aria-hidden="true"]                 (the solid floor paints the
//                                             root: rgb(var(--color-background)))
//     img.hk-wallpaper-backdrop-layer.hk-wallpaper-backdrop-img
//        [src alt=""] [style: fit/position/filter]        (image)
//     video.hk-wallpaper-backdrop-layer.hk-wallpaper-backdrop-video
//        [src autoplay loop muted playsinline
//         disablepictureinpicture] [style: fit/position/filter]  (video)
//     canvas.hk-wallpaper-backdrop-layer.hk-wallpaper-backdrop-canvas
//        [style: filter/transform]                        (pipeline)
//
// The wallpaper RUNTIME is host-owned (the wave ruling): `useWallpaper()`
// (the singleton state), the reduced-motion media query, the luminance
// sampler, the WebGL2 probe and the host pipeline driver all live
// outside. The mirror is CONTROLLED — the host feeds the wallpaper state
// as props and the mode ladder below is PURE, so the degradation rules
// (reduced motion, failed attach) are testable without a DOM.
//
// Deltas vs Vue (documented, not accidental):
//   * No `createSurface` driver handshake: hikari ships the surface, not
//     the shaders, and the attach needs a live canvas ref + WebGL2
//     context tairitsu does not expose. The pipeline branch therefore
//     renders the INERT canvas; the host attaches its driver out of band
//     and reports the outcome through `pipeline_stood_down`, which drops
//     the branch to the solid floor exactly like a failed
//     `syncSurface()`. `power_preference` rides along for the host's
//     context creation (the WebGL attribute Vue passed through).
//   * The reduced-motion gate is a PROP (`reduce_motion`), not a
//     `useMediaQuery` subscription — and per the upstream contract the
//     gate means the ANIMATED layer is never created, which here is
//     simply [`wallpaper_effective_mode`] resolving to `solid`.
//   * The video element's explicit `video.muted = true; play()` catch-up
//     is JS runtime: the `muted`/`autoplay` ATTRIBUTES carry the
//     first-frame paint, and the browser's own autoplay policy decides
//     the rest (Vue's `.play()` exists to swallow the rejection — there
//     is no promise to swallow without a DOM).
//   * No page-global writes at all (the upstream component's own rule):
//     `body` background / scrim / `html[data-wallpaper-art]` stay with
//     the host; the `data-hk-wallpaper-art` attribute on THIS root is
//     the gate hosts read instead.
//   * The one-way canvas transform and the media fit/position/filter
//     styles are the pure ports of `canvasTransform` /
//     `buildWallpaperFilter` / `mediaStyle` — including JS `toFixed`
//     formatting, so the emitted strings are byte-identical.

use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct WallpaperBackdropComponent;

/// The layer being painted (or stood down to) right now (Vue:
/// `HkWallpaperBackdropMode`).
#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum WallpaperBackdropMode {
    #[default]
    Solid,
    Image,
    Video,
    Pipeline,
}

impl WallpaperBackdropMode {
    /// The attribute value exactly as Vue spells it (both the modifier
    /// class and `data-hk-wallpaper-mode`).
    pub fn attr(self) -> &'static str {
        match self {
            WallpaperBackdropMode::Solid => "solid",
            WallpaperBackdropMode::Image => "image",
            WallpaperBackdropMode::Video => "video",
            WallpaperBackdropMode::Pipeline => "pipeline",
        }
    }
}

/// What the wallpaper state's SOURCE is (Vue: the `isSolid` / `isPipeline`
/// / `isVideo` flags `useWallpaper()` derives from the active source).
#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum WallpaperSourceKind {
    #[default]
    Solid,
    Image,
    Video,
    Pipeline,
}

/// `object-position` values (Vue: `WallpaperPosition`).
#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum WallpaperPosition {
    Left,
    #[default]
    Center,
    Right,
}

/// Fit strategy (Vue: `WallpaperScale`).
#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum WallpaperScale {
    #[default]
    Cover,
    Stretch,
    Contain,
}

/// Post effect (Vue: `WallpaperEffect`; `Off` is Vue's `"none"`).
#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum WallpaperEffect {
    #[default]
    Off,
    Frosted,
    Acrylic,
}

/// WebGL context attribute for the pipeline canvas (Vue:
/// `powerPreference`, default `"high-performance"`).
#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum WallpaperPowerPreference {
    #[default]
    HighPerformance,
    LowPower,
}

impl WallpaperPowerPreference {
    /// The context attribute string exactly as WebGL spells it.
    pub fn attr(self) -> &'static str {
        match self {
            WallpaperPowerPreference::HighPerformance => "high-performance",
            WallpaperPowerPreference::LowPower => "low-power",
        }
    }
}

/// The per-wallpaper display settings (Vue: `WallpaperDisplaySettings`;
/// the derived `Default` IS `DEFAULT_DISPLAY_SETTINGS`).
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub struct WallpaperDisplaySettings {
    pub position: WallpaperPosition,
    pub scale: WallpaperScale,
    pub effect: WallpaperEffect,
    /// Integer in the closed range [-50, 50].
    pub brightness: i32,
}

/// The brightness range guard (Vue: `clampBrightness`).
pub fn clamp_wallpaper_brightness(value: i32) -> i32 {
    value.clamp(-50, 50)
}

/// Vue's truthiness gate on `mediaUrl`: an empty string is no media.
pub fn wallpaper_media_present(media_url: Option<&str>) -> bool {
    media_url.is_some_and(|url| !url.is_empty())
}

/// What the wallpaper state asks for, before any stand-down (Vue:
/// `requestedMode`): pipeline needs its preset, video/image need the
/// media url, everything else falls through to the solid floor.
pub fn wallpaper_requested_mode(
    kind: WallpaperSourceKind,
    media_url: Option<&str>,
    pipeline_preset: Option<&str>,
) -> WallpaperBackdropMode {
    let has_media = wallpaper_media_present(media_url);
    match kind {
        WallpaperSourceKind::Solid => WallpaperBackdropMode::Solid,
        WallpaperSourceKind::Pipeline
            if pipeline_preset.is_some_and(|preset| !preset.is_empty()) =>
        {
            WallpaperBackdropMode::Pipeline
        }
        WallpaperSourceKind::Video if has_media => WallpaperBackdropMode::Video,
        _ if has_media => WallpaperBackdropMode::Image,
        _ => WallpaperBackdropMode::Solid,
    }
}

/// What is actually painted (Vue: `effectiveMode`) — the pipeline branch
/// degrades to the solid floor under reduced motion or after a failed
/// attach, never to an invisible canvas.
pub fn wallpaper_effective_mode(
    requested: WallpaperBackdropMode,
    reduce_motion: bool,
    pipeline_stood_down: bool,
) -> WallpaperBackdropMode {
    match requested {
        WallpaperBackdropMode::Pipeline if reduce_motion || pipeline_stood_down => {
            WallpaperBackdropMode::Solid
        }
        mode => mode,
    }
}

/// True when the surface paints art (Vue: `paintsArt` — the host gates
/// its page scrim on this).
pub fn wallpaper_paints_art(mode: WallpaperBackdropMode) -> bool {
    mode != WallpaperBackdropMode::Solid
}

/// The root class list (Vue: `["hk-wallpaper-backdrop",
/// \`hk-wallpaper-backdrop-${mode}\`]`).
pub fn wallpaper_root_classes(mode: WallpaperBackdropMode) -> String {
    format!(
        "hk-wallpaper-backdrop hk-wallpaper-backdrop-{}",
        mode.attr()
    )
}

/// The CSS `filter` for a layer (Vue: `buildWallpaperFilter`) — parts
/// joined with spaces, `"none"` when nothing applies. The brightness
/// part keeps JS `toFixed(2)` formatting.
pub fn build_wallpaper_filter(settings: WallpaperDisplaySettings) -> String {
    let mut parts: Vec<String> = Vec::new();
    match settings.effect {
        WallpaperEffect::Frosted => parts.push("blur(12px)".to_string()),
        WallpaperEffect::Acrylic => {
            parts.push("blur(8px) saturate(1.5) brightness(1.06)".to_string())
        }
        WallpaperEffect::Off => {}
    }
    if settings.brightness != 0 {
        let factor = 1.0 + f64::from(settings.brightness) / 100.0;
        parts.push(format!("brightness({factor:.2})"));
    }
    if parts.is_empty() {
        "none".to_string()
    } else {
        parts.join(" ")
    }
}

/// `object-fit` for the media layers (Vue's `mediaStyle.fit`).
pub fn wallpaper_object_fit(scale: WallpaperScale) -> &'static str {
    match scale {
        WallpaperScale::Stretch => "fill",
        WallpaperScale::Contain => "contain",
        WallpaperScale::Cover => "cover",
    }
}

/// `object-position` for the media layers (Vue's `mediaStyle.pos`).
pub fn wallpaper_object_position(position: WallpaperPosition) -> &'static str {
    match position {
        WallpaperPosition::Left => "left center",
        WallpaperPosition::Center => "center center",
        WallpaperPosition::Right => "right center",
    }
}

/// The media layer's inline style (Vue: `mediaStyle`).
pub fn wallpaper_media_style(settings: WallpaperDisplaySettings) -> String {
    format!(
        "object-fit:{};object-position:{};filter:{}",
        wallpaper_object_fit(settings.scale),
        wallpaper_object_position(settings.position),
        build_wallpaper_filter(settings),
    )
}

/// The frame-stable canvas fit/zoom (Vue: `canvasTransform`). Pipeline
/// canvases are authored fullscreen, so contain and cover coincide at the
/// exact 1:1 framing; "stretch" zooms in; a left/right position shifts
/// with overscan. Keeps JS `toFixed(4)` formatting.
pub fn wallpaper_canvas_transform(position: WallpaperPosition, scale: WallpaperScale) -> String {
    let tx: i32 = match position {
        WallpaperPosition::Left => -14,
        WallpaperPosition::Right => 14,
        WallpaperPosition::Center => 0,
    };
    let base = if tx != 0 { 1.15 } else { 1.0 };
    let zoom = if scale == WallpaperScale::Stretch {
        base * 1.12
    } else {
        base
    };
    if tx == 0 && zoom == 1.0 {
        return "none".to_string();
    }
    format!("scale({zoom:.4}) translateX({tx}%)")
}

/// The canvas layer's inline style (Vue: `canvasStyle`).
pub fn wallpaper_canvas_style(settings: WallpaperDisplaySettings) -> String {
    format!(
        "filter:{};transform:{}",
        build_wallpaper_filter(settings),
        wallpaper_canvas_transform(settings.position, settings.scale),
    )
}

#[define_props]
pub struct WallpaperBackdropProps {
    /// What the wallpaper state's source is (Vue: `isSolid` / `isPipeline`
    /// / `isVideo` from `useWallpaper()`).
    #[default]
    pub kind: WallpaperSourceKind,

    /// The active media url (Vue: `mediaUrl`); empty = no media.
    pub media_url: Option<String>,

    /// The resolved pipeline preset id (Vue: `pipelinePreset`).
    pub pipeline_preset: Option<String>,

    /// The reduced-motion verdict (Vue: its own `useMediaQuery`
    /// subscription — see the header delta).
    #[default]
    pub reduce_motion: bool,

    /// The pipeline branch could not start (no WebGL2 / no driver /
    /// driver declined — the host reports the failed attach).
    #[default]
    pub pipeline_stood_down: bool,

    /// The active wallpaper's display settings (Vue:
    /// `displaySettings`).
    #[default]
    pub display: WallpaperDisplaySettings,

    /// WebGL context attribute for the pipeline canvas (Vue default
    /// `"high-performance"`; consumed by the host's driver attach).
    #[default]
    pub power_preference: WallpaperPowerPreference,
}

#[component]
pub fn WallpaperBackdrop(props: WallpaperBackdropProps) -> Element {
    let requested = wallpaper_requested_mode(
        props.kind,
        props.media_url.as_deref(),
        props.pipeline_preset.as_deref(),
    );
    let mode = wallpaper_effective_mode(requested, props.reduce_motion, props.pipeline_stood_down);
    let paints_art = wallpaper_paints_art(mode);

    let mut root = VElement::new("div")
        .class(wallpaper_root_classes(mode))
        .attr("data-hk-wallpaper-mode", mode.attr())
        .attr(
            "data-hk-wallpaper-art",
            if paints_art { "true" } else { "false" },
        )
        .attr("aria-hidden", "true");

    let media_url = props.media_url.clone().unwrap_or_default();
    match mode {
        WallpaperBackdropMode::Image => {
            root = root.child(VNode::Element(Box::new(
                VElement::new("img")
                    .class("hk-wallpaper-backdrop-layer hk-wallpaper-backdrop-img")
                    .attr("src", media_url)
                    .attr("alt", "")
                    .style(wallpaper_media_style(props.display)),
            )));
        }
        WallpaperBackdropMode::Video => {
            // The muted/autoplay attributes carry the first-frame paint;
            // the explicit play() catch-up is JS runtime (header delta).
            root = root.child(VNode::Element(Box::new(
                VElement::new("video")
                    .class("hk-wallpaper-backdrop-layer hk-wallpaper-backdrop-video")
                    .attr("src", media_url)
                    .attr("autoplay", "")
                    .attr("loop", "")
                    .attr("muted", "")
                    .attr("playsinline", "")
                    .attr("disablepictureinpicture", "")
                    .style(wallpaper_media_style(props.display)),
            )));
        }
        WallpaperBackdropMode::Pipeline => {
            // Inert by itself: the host's driver attaches out of band and
            // reports failure through `pipeline_stood_down` (header delta).
            root = root.child(VNode::Element(Box::new(
                VElement::new("canvas")
                    .class("hk-wallpaper-backdrop-layer hk-wallpaper-backdrop-canvas")
                    .style(wallpaper_canvas_style(props.display)),
            )));
        }
        WallpaperBackdropMode::Solid => {}
    }

    VNode::Element(Box::new(root))
}

impl StyledComponent for WallpaperBackdropComponent {
    fn styles() -> &'static str {
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkWallpaperBackdrop.scss", no_hash }
            .0
    }

    fn name() -> &'static str {
        "wallpaper-backdrop"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn wallpaper_defaults_match_the_vue_props() {
        let props = WallpaperBackdropProps::default();
        assert_eq!(props.kind, WallpaperSourceKind::Solid);
        assert!(props.media_url.is_none());
        assert!(props.pipeline_preset.is_none());
        assert!(!props.reduce_motion);
        assert!(!props.pipeline_stood_down);
        assert_eq!(
            props.display,
            WallpaperDisplaySettings {
                position: WallpaperPosition::Center,
                scale: WallpaperScale::Cover,
                effect: WallpaperEffect::Off,
                brightness: 0,
            },
            "the derived Default IS DEFAULT_DISPLAY_SETTINGS"
        );
        assert_eq!(
            props.power_preference,
            WallpaperPowerPreference::HighPerformance
        );
    }

    #[test]
    fn wallpaper_mode_attrs_spell_like_vue() {
        for (mode, attr) in [
            (WallpaperBackdropMode::Solid, "solid"),
            (WallpaperBackdropMode::Image, "image"),
            (WallpaperBackdropMode::Video, "video"),
            (WallpaperBackdropMode::Pipeline, "pipeline"),
        ] {
            assert_eq!(mode.attr(), attr);
            assert_eq!(
                wallpaper_root_classes(mode),
                format!("hk-wallpaper-backdrop hk-wallpaper-backdrop-{attr}")
            );
        }
        assert_eq!(
            WallpaperPowerPreference::HighPerformance.attr(),
            "high-performance"
        );
        assert_eq!(WallpaperPowerPreference::LowPower.attr(), "low-power");
    }

    #[test]
    fn wallpaper_requested_mode_matches_the_vue_ladder() {
        use WallpaperBackdropMode as Mode;
        use WallpaperSourceKind as Kind;
        // Solid is solid.
        assert_eq!(
            wallpaper_requested_mode(Kind::Solid, Some("bg.png"), None),
            Mode::Solid
        );
        // Pipeline needs its preset — the media url plays no part.
        assert_eq!(
            wallpaper_requested_mode(Kind::Pipeline, None, Some("aurora")),
            Mode::Pipeline
        );
        assert_eq!(
            wallpaper_requested_mode(Kind::Pipeline, None, Some("")),
            Mode::Solid,
            "an empty preset id is no preset"
        );
        // Video and image need a truthy url.
        assert_eq!(
            wallpaper_requested_mode(Kind::Video, Some("clip.mp4"), None),
            Mode::Video
        );
        assert_eq!(
            wallpaper_requested_mode(Kind::Video, Some(""), None),
            Mode::Solid,
            "an empty url is falsy in Vue"
        );
        assert_eq!(
            wallpaper_requested_mode(Kind::Image, Some("bg.png"), None),
            Mode::Image
        );
        assert_eq!(
            wallpaper_requested_mode(Kind::Image, None, None),
            Mode::Solid
        );
        // A preset-less pipeline with media falls through to image.
        assert_eq!(
            wallpaper_requested_mode(Kind::Pipeline, Some("bg.png"), None),
            Mode::Image
        );
    }

    #[test]
    fn wallpaper_effective_mode_degrades_only_the_pipeline_branch() {
        use WallpaperBackdropMode as Mode;
        assert_eq!(
            wallpaper_effective_mode(Mode::Pipeline, true, false),
            Mode::Solid,
            "reduced motion never creates the animated layer"
        );
        assert_eq!(
            wallpaper_effective_mode(Mode::Pipeline, false, true),
            Mode::Solid,
            "a failed attach stands down to the floor"
        );
        assert_eq!(
            wallpaper_effective_mode(Mode::Pipeline, false, false),
            Mode::Pipeline
        );
        // The static branches are untouched by either gate.
        assert_eq!(
            wallpaper_effective_mode(Mode::Image, true, true),
            Mode::Image
        );
        assert_eq!(
            wallpaper_effective_mode(Mode::Video, true, true),
            Mode::Video
        );
        assert_eq!(
            wallpaper_effective_mode(Mode::Solid, true, true),
            Mode::Solid
        );
    }

    #[test]
    fn wallpaper_paints_art_gates_on_solid() {
        assert!(!wallpaper_paints_art(WallpaperBackdropMode::Solid));
        assert!(wallpaper_paints_art(WallpaperBackdropMode::Image));
        assert!(wallpaper_paints_art(WallpaperBackdropMode::Video));
        assert!(wallpaper_paints_art(WallpaperBackdropMode::Pipeline));
        // Brightness clamps into the closed range.
        assert_eq!(clamp_wallpaper_brightness(60), 50);
        assert_eq!(clamp_wallpaper_brightness(-60), -50);
        assert_eq!(clamp_wallpaper_brightness(37), 37);
        assert_eq!(clamp_wallpaper_brightness(0), 0);
    }

    #[test]
    fn wallpaper_filter_composes_like_the_vue_builder() {
        let settings = |effect: WallpaperEffect, brightness: i32| WallpaperDisplaySettings {
            effect,
            brightness,
            ..Default::default()
        };
        assert_eq!(
            build_wallpaper_filter(settings(WallpaperEffect::Off, 0)),
            "none"
        );
        assert_eq!(
            build_wallpaper_filter(settings(WallpaperEffect::Frosted, 0)),
            "blur(12px)"
        );
        assert_eq!(
            build_wallpaper_filter(settings(WallpaperEffect::Acrylic, 0)),
            "blur(8px) saturate(1.5) brightness(1.06)"
        );
        // toFixed(2) keeps two decimals on both sides of 1.
        assert_eq!(
            build_wallpaper_filter(settings(WallpaperEffect::Off, 37)),
            "brightness(1.37)"
        );
        assert_eq!(
            build_wallpaper_filter(settings(WallpaperEffect::Off, -10)),
            "brightness(0.90)"
        );
        // Parts join with spaces, effect first.
        assert_eq!(
            build_wallpaper_filter(settings(WallpaperEffect::Frosted, -10)),
            "blur(12px) brightness(0.90)"
        );
    }

    #[test]
    fn wallpaper_canvas_transform_matches_the_ported_geometry() {
        use {WallpaperPosition as P, WallpaperScale as S};
        // The default look is the exact 1:1 framing.
        assert_eq!(wallpaper_canvas_transform(P::Center, S::Cover), "none");
        assert_eq!(wallpaper_canvas_transform(P::Center, S::Contain), "none");
        // A position shift rides the 1.15 overscan base.
        assert_eq!(
            wallpaper_canvas_transform(P::Left, S::Cover),
            "scale(1.1500) translateX(-14%)"
        );
        assert_eq!(
            wallpaper_canvas_transform(P::Right, S::Cover),
            "scale(1.1500) translateX(14%)"
        );
        // Stretch multiplies the base (1.15 × 1.12 keeps toFixed(4)).
        assert_eq!(
            wallpaper_canvas_transform(P::Right, S::Stretch),
            "scale(1.2880) translateX(14%)"
        );
        assert_eq!(
            wallpaper_canvas_transform(P::Center, S::Stretch),
            "scale(1.1200) translateX(0%)"
        );
    }

    #[test]
    fn wallpaper_layer_styles_carry_the_vue_fields() {
        assert_eq!(
            wallpaper_media_style(WallpaperDisplaySettings::default()),
            "object-fit:cover;object-position:center center;filter:none"
        );
        assert_eq!(
            wallpaper_media_style(WallpaperDisplaySettings {
                position: WallpaperPosition::Left,
                scale: WallpaperScale::Stretch,
                effect: WallpaperEffect::Frosted,
                brightness: 20,
            }),
            "object-fit:fill;object-position:left center;filter:blur(12px) brightness(1.20)"
        );
        assert_eq!(
            wallpaper_object_position(WallpaperPosition::Right),
            "right center"
        );
        assert_eq!(
            wallpaper_canvas_style(WallpaperDisplaySettings::default()),
            "filter:none;transform:none"
        );
    }

    #[test]
    fn wallpaper_renders_the_vue_dom_contract() {
        // The image branch: one img layer with the fit/pos/filter style.
        let html = WallpaperBackdrop(WallpaperBackdropProps {
            kind: WallpaperSourceKind::Image,
            media_url: Some("/w/bg.png".to_string()),
            ..Default::default()
        })
        .render_to_html();
        assert!(
            html.contains(r#"class="hk-wallpaper-backdrop hk-wallpaper-backdrop-image""#),
            "{html}"
        );
        assert!(html.contains(r#"aria-hidden="true""#), "{html}");
        assert!(html.contains(r#"data-hk-wallpaper-mode="image""#), "{html}");
        assert!(html.contains(r#"data-hk-wallpaper-art="true""#), "{html}");
        assert!(
            html.contains(r#"class="hk-wallpaper-backdrop-layer hk-wallpaper-backdrop-img""#),
            "{html}"
        );
        assert!(html.contains(r#"src="/w/bg.png""#), "{html}");
        assert!(html.contains(r#"alt="""#), "{html}");
        assert!(
            html.contains("object-fit:cover;object-position:center center;filter:none"),
            "{html}"
        );

        // The video branch: the five playback attributes ride the layer.
        let html = WallpaperBackdrop(WallpaperBackdropProps {
            kind: WallpaperSourceKind::Video,
            media_url: Some("/w/clip.mp4".to_string()),
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains("hk-wallpaper-backdrop-video"), "{html}");
        for attr in [
            "autoplay",
            "loop",
            "muted",
            "playsinline",
            "disablepictureinpicture",
        ] {
            assert!(html.contains(&format!(r#"{attr}="""#)), "{attr}: {html}");
        }

        // The pipeline branch: the canvas with the transform style.
        let html = WallpaperBackdrop(WallpaperBackdropProps {
            kind: WallpaperSourceKind::Pipeline,
            pipeline_preset: Some("aurora".to_string()),
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains("hk-wallpaper-backdrop-canvas"), "{html}");
        assert!(html.contains("transform:none"), "{html}");
        assert!(html.contains(r#"data-hk-wallpaper-art="true""#), "{html}");

        // The solid floor: root only, no layer, art=false.
        let html = WallpaperBackdrop(WallpaperBackdropProps::default()).render_to_html();
        assert!(html.contains("hk-wallpaper-backdrop-solid"), "{html}");
        assert!(html.contains(r#"data-hk-wallpaper-art="false""#), "{html}");
        assert!(!html.contains("hk-wallpaper-backdrop-layer"), "{html}");
    }

    #[test]
    fn wallpaper_pipeline_degrades_under_the_runtime_gates() {
        // Reduced motion: the animated layer is never created.
        let html = WallpaperBackdrop(WallpaperBackdropProps {
            kind: WallpaperSourceKind::Pipeline,
            pipeline_preset: Some("aurora".to_string()),
            reduce_motion: true,
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains("hk-wallpaper-backdrop-solid"), "{html}");
        assert!(!html.contains("hk-wallpaper-backdrop-canvas"), "{html}");

        // A failed host attach stands down the same way.
        let html = WallpaperBackdrop(WallpaperBackdropProps {
            kind: WallpaperSourceKind::Pipeline,
            pipeline_preset: Some("aurora".to_string()),
            pipeline_stood_down: true,
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains(r#"data-hk-wallpaper-mode="solid""#), "{html}");
        assert!(!html.contains("canvas"), "{html}");
    }

    #[test]
    fn wallpaper_styles_come_from_the_canonical_vue_sheet() {
        let css = WallpaperBackdropComponent::styles();
        for needle in [
            ".hk-wallpaper-backdrop",
            ".hk-wallpaper-backdrop-layer",
            ".hk-wallpaper-backdrop-img",
            ".hk-wallpaper-backdrop-video",
            ".hk-wallpaper-backdrop-canvas",
            "will-change",
            "max-width: 767px",
        ] {
            assert!(
                css.contains(needle),
                "wallpaper-backdrop css must carry the vue hook {needle}"
            );
        }
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored wallpaper sheet"
        );
    }
}
