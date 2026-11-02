// packages/components/src/display/media_visualizer.rs
// MediaVisualizer — mirror of the canonical Vue `HkMediaVisualizer` (the
// pluggable audio spectrum bar chart drawn under the player).
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkMediaVisualizer.scss`, vendored under
// `src/styles/vue-mirror/`), compiled with `no_hash` so the single
// `.hk-media-visualizer` class is literal and identical in both forms.
//
// DOM contract:
//
//   div.hk-media-visualizer [+host class]
//          style="position:relative;overflow:hidden"   (see the deltas)
//     div[data-el="bar"] × n
//          style="position:absolute;bottom:0;left:{i/n*100}%;
//                 width:calc({100/n}% - 1px);height:{level/255*85}%;
//                 background:hsl({200+i/n*80}, 70%, 55%)"
//
// Vue hands `<canvas class="hk-media-visualizer">` to an `AnalyserNode` and
// paints the bins with `fillRect`; the numbers above are that same draw loop,
// helper by helper (`fftSize = 128` → 64 bins, `v = level/255`,
// `bh = v * h * 0.85`, `hue = 200 + (i/n) * 80`). The pure functions below
// carry the math so it is testable without a canvas.
//
// State contract / deltas vs Vue (documented, not accidental):
//   * There is no `AudioContext`, `createMediaElementSource`, `AnalyserNode`
//     or 2D canvas context in the tairitsu host stack, and a component here
//     cannot own an animation-bus subscription. The analyser and the frame
//     loop therefore stay HOST-side: the host samples its spectrum and passes
//     the byte levels as the controlled `levels` prop (`fft_size / 2` of them,
//     exactly what `analyser.frequencyBinCount` yields). `levels.is_empty()`
//     is Vue's stopped state — the box renders with no bars.
//   * Because a canvas cannot be reproduced, each bin becomes an absolutely
//     positioned `div[data-el="bar"]` carrying the SAME geometry the
//     `fillRect` call used. The bars are painted inline (the sheet only
//     styles the canvas box) and the box gains `position:relative;
//     overflow:hidden` inline so the sheet's border radius still clips them,
//     the way the canvas bitmap was clipped.
//   * The 1 device-pixel gutter between bars (`bw - 1` at DPR 2) becomes a
//     1 CSS-pixel `calc(...)` subtraction — sub-pixel difference at the same
//     bin count, and it keeps the bars from merging at any host width.
//   * Vue sizes its canvas backing store to `clientWidth * 2`; a DOM box needs
//     no backing store, so `fft_size` only survives as the public constants +
//     [`media_visualizer_bin_count`].

use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct MediaVisualizerComponent;

/// Vue's analyser resolution (`analyser.fftSize = 128`).
pub const MEDIA_VISUALIZER_FFT_SIZE: u32 = 128;

/// Vue: `bh = v * h * 0.85` — bars never reach the full box height.
pub const MEDIA_VISUALIZER_BAR_MAX_RATIO: f64 = 0.85;

/// `AnalyserNode.frequencyBinCount` — half the FFT size.
pub fn media_visualizer_bin_count(fft_size: u32) -> usize {
    (fft_size / 2) as usize
}

/// Vue: `v = data[i] / 255` then `bh = v * h * 0.85`, expressed as a
/// percentage of the box height.
pub fn media_visualizer_bar_height_pct(level: u8) -> f64 {
    (f64::from(level) / 255.0) * 100.0 * MEDIA_VISUALIZER_BAR_MAX_RATIO
}

/// Vue: `hue = 200 + (i / n) * 80` — the spectrum sweeps from deep blue to
/// violet across the bins.
pub fn media_visualizer_bar_hue(index: usize, count: usize) -> f64 {
    if count == 0 {
        return 200.0;
    }
    200.0 + (index as f64 / count as f64) * 80.0
}

/// Vue: `fillStyle = \`hsl(${hue}, 70%, 55%)\``.
pub fn media_visualizer_bar_color(index: usize, count: usize) -> String {
    format!("hsl({}, 70%, 55%)", media_visualizer_bar_hue(index, count))
}

/// One painted bin, in the coordinates Vue's `fillRect` used.
#[derive(Clone, PartialEq, Debug, Default)]
pub struct MediaVisualizerBar {
    /// `i * bw` as a share of the box width.
    pub left_pct: f64,
    /// `bw` as a share of the box width (the gutter rides the style).
    pub width_pct: f64,
    /// `v * 0.85` as a share of the box height.
    pub height_pct: f64,
    /// `hsl(hue, 70%, 55%)`.
    pub color: String,
}

/// The full bar set for one spectrum frame: one bar per level, equal widths,
/// hue swept across the bins.
pub fn media_visualizer_bars(levels: &[u8]) -> Vec<MediaVisualizerBar> {
    let count = levels.len();
    if count == 0 {
        return Vec::new();
    }
    let width_pct = 100.0 / count as f64;
    levels
        .iter()
        .enumerate()
        .map(|(index, level)| MediaVisualizerBar {
            left_pct: index as f64 * width_pct,
            width_pct,
            height_pct: media_visualizer_bar_height_pct(*level),
            color: media_visualizer_bar_color(index, count),
        })
        .collect()
}

/// The root class list: `.hk-media-visualizer` plus the host class appended
/// last (Vue's attribute fallthrough order).
pub fn media_visualizer_root_classes(class: &str) -> String {
    let mut classes = String::from("hk-media-visualizer");
    if !class.is_empty() {
        classes.push(' ');
        classes.push_str(class);
    }
    classes
}

#[define_props]
pub struct MediaVisualizerProps {
    /// One byte per frequency bin, `0..=255` (Vue: the analyser's
    /// `getByteFrequencyData` frame). Empty means "not playing" — the box
    /// renders bare, exactly like Vue's cleared canvas.
    pub levels: Vec<u8>,

    /// Vue attribute fallthrough onto the root box.
    #[default]
    pub class: String,
}

#[component]
pub fn MediaVisualizer(props: MediaVisualizerProps) -> Element {
    let mut root = VElement::new("div")
        .class(media_visualizer_root_classes(&props.class))
        // The sheet only styles the canvas box; the bar layer needs its own
        // containing block and must not spill past the rounded corners (see
        // the file header's deltas).
        .style("position:relative;overflow:hidden");

    for bar in media_visualizer_bars(&props.levels) {
        let style = format!(
            "position:absolute;bottom:0;left:{}%;width:calc({}% - 1px);height:{}%;background:{}",
            bar.left_pct, bar.width_pct, bar.height_pct, bar.color
        );
        root = root.child(VNode::Element(Box::new(
            VElement::new("div").attr("data-el", "bar").style(style),
        )));
    }

    VNode::Element(Box::new(root))
}

impl StyledComponent for MediaVisualizerComponent {
    fn styles() -> &'static str {
        // The canonical Vue sheet, compiled verbatim (no_hash keeps the
        // `.hk-media-visualizer` name literal).
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkMediaVisualizer.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "media-visualizer"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn count(haystack: &str, needle: &str) -> usize {
        haystack.matches(needle).count()
    }

    #[test]
    fn media_visualizer_defaults_match_the_vue_props() {
        let props = MediaVisualizerProps::default();
        assert!(props.levels.is_empty());
        assert_eq!(props.class, "");
    }

    #[test]
    fn media_visualizer_bin_count_follows_the_fft_size() {
        // Vue: `fftSize = 128` → `frequencyBinCount = 64`.
        assert_eq!(media_visualizer_bin_count(MEDIA_VISUALIZER_FFT_SIZE), 64);
        assert_eq!(media_visualizer_bin_count(256), 128);
        assert_eq!(media_visualizer_bin_count(0), 0);
    }

    #[test]
    fn media_visualizer_bar_heights_normalize_against_255() {
        // Vue: `v = level / 255`, `bh = v * h * 0.85`.
        assert_eq!(media_visualizer_bar_height_pct(0), 0.0);
        assert_eq!(media_visualizer_bar_height_pct(255), 85.0);
        assert!((media_visualizer_bar_height_pct(128) - 42.666_666_666_666_67).abs() < 1e-9);
        assert!((media_visualizer_bar_height_pct(51) - 17.0).abs() < 1e-9);
        // Monotonic: a louder bin never paints shorter.
        assert!(media_visualizer_bar_height_pct(100) < media_visualizer_bar_height_pct(200));
    }

    #[test]
    fn media_visualizer_bar_hues_sweep_across_the_bins() {
        // Vue: `hue = 200 + (i / n) * 80` — 200 at the first bin, never 280
        // (the fraction stays below 1).
        assert_eq!(media_visualizer_bar_hue(0, 64), 200.0);
        assert!((media_visualizer_bar_hue(32, 64) - 240.0).abs() < 1e-9);
        assert!((media_visualizer_bar_hue(63, 64) - 278.75).abs() < 1e-9);
        assert_eq!(media_visualizer_bar_hue(0, 4), 200.0);
        assert_eq!(media_visualizer_bar_hue(3, 4), 260.0);
        // A degenerate count cannot divide by zero.
        assert_eq!(media_visualizer_bar_hue(5, 0), 200.0);
    }

    #[test]
    fn media_visualizer_bar_colors_match_the_vue_fill_style() {
        assert_eq!(
            media_visualizer_bar_color(0, 4),
            "hsl(200, 70%, 55%)".to_string()
        );
        assert_eq!(
            media_visualizer_bar_color(3, 4),
            "hsl(260, 70%, 55%)".to_string()
        );
    }

    #[test]
    fn media_visualizer_bars_lay_out_left_to_right() {
        let bars = media_visualizer_bars(&[0, 255]);
        assert_eq!(bars.len(), 2);
        assert_eq!(bars[0].left_pct, 0.0);
        assert_eq!(bars[1].left_pct, 50.0);
        assert_eq!(bars[0].width_pct, 50.0);
        assert_eq!(bars[1].width_pct, 50.0);
        assert_eq!(bars[0].height_pct, 0.0);
        assert_eq!(bars[1].height_pct, 85.0);
        assert_eq!(bars[0].color, "hsl(200, 70%, 55%)");
        assert_eq!(bars[1].color, "hsl(240, 70%, 55%)");

        // An empty frame paints nothing (Vue's stopped analyser).
        assert!(media_visualizer_bars(&[]).is_empty());

        // Every bin of a full frame keeps a uniform share of the width.
        let full = media_visualizer_bars(&[17; 64]);
        assert_eq!(full.len(), 64);
        assert_eq!(full[0].width_pct, 1.5625);
        assert_eq!(full[63].left_pct, 98.4375);
    }

    #[test]
    fn media_visualizer_renders_the_vue_box_and_one_bar_per_bin() {
        let html = MediaVisualizer(MediaVisualizerProps {
            levels: vec![0, 128, 255],
            class: "host".to_string(),
        })
        .render_to_html();

        assert!(html.contains("hk-media-visualizer host"), "{html}");
        assert!(html.contains("position:relative"), "{html}");
        assert_eq!(count(&html, r#"data-el="bar""#), 3, "{html}");
        // The middle bin paints half the ceiling height, the loud one 85%.
        assert!(html.contains("height:42.666"), "{html}");
        assert!(html.contains("height:85%"), "{html}");
        assert!(html.contains("left:33.333"), "{html}");
        assert!(html.contains("calc(33.333"), "{html}");
        assert!(html.contains("background:hsl(200, 70%, 55%)"), "{html}");
    }

    #[test]
    fn media_visualizer_renders_a_bare_box_without_a_spectrum() {
        let html = MediaVisualizer(MediaVisualizerProps::default()).render_to_html();
        assert!(html.contains("hk-media-visualizer"), "{html}");
        assert_eq!(count(&html, r#"data-el="bar""#), 0, "{html}");
    }

    #[test]
    fn media_visualizer_styles_come_from_the_canonical_vue_sheet() {
        let css = MediaVisualizerComponent::styles();
        // The sheet is a single rule; assert the box + its box model survive
        // the compiled mirror.
        assert!(css.contains(".hk-media-visualizer"), "{css}");
        // The sheet's fixed 8rem box IS the component's geometry.
        assert!(css.contains("8rem"), "{css}");
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored media-visualizer sheet"
        );
    }
}
