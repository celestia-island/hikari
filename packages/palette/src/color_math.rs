//! Color math module
//!
//! Provides advanced color calculations and transformations including:
//! - HSL/HSV color space conversions
//! - Saturation/lightness adjustments
//! - Color interpolation and blending
//! - Gradient color stops

use crate::colors::Color;

/// HSL color representation
///
/// HSL is often more intuitive for color manipulation than RGB.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Hsl {
    pub h: f64,
    pub s: f64,
    pub l: f64,
}

impl Hsl {
    #[must_use]
    pub const fn new(h: f64, s: f64, l: f64) -> Self {
        Self { h, s, l }
    }

    #[must_use]
    pub fn to_rgb(&self) -> (u8, u8, u8) {
        let h = ((self.h % 360.0) + 360.0) % 360.0;
        let s = self.s.clamp(0.0, 1.0);
        let l = self.l.clamp(0.0, 1.0);

        let c = (1.0 - 2.0f64.mul_add(l, -1.0).abs()) * s;
        let x = c * (1.0 - ((h / 60.0) % 2.0 - 1.0).abs());
        let m = l - c / 2.0;

        let (r, g, b) = if h < 60.0 {
            (c, x, 0.0)
        } else if h < 120.0 {
            (x, c, 0.0)
        } else if h < 180.0 {
            (0.0, c, x)
        } else if h < 240.0 {
            (0.0, x, c)
        } else if h < 300.0 {
            (x, 0.0, c)
        } else {
            (c, 0.0, x)
        };

        (
            ((r + m) * 255.0).round() as u8,
            ((g + m) * 255.0).round() as u8,
            ((b + m) * 255.0).round() as u8,
        )
    }
}

impl Color {
    #[must_use]
    pub fn to_hsl(&self) -> Hsl {
        let r = f64::from(self.rgb.0) / 255.0;
        let g = f64::from(self.rgb.1) / 255.0;
        let b = f64::from(self.rgb.2) / 255.0;

        let max = r.max(g).max(b);
        let min = r.min(g).min(b);
        let delta = max - min;

        let l = (max + min) / 2.0;

        let h = if delta == 0.0 {
            0.0
        } else if max == r {
            let mut h = 60.0 * (((g - b) / delta) % 6.0);
            if h < 0.0 {
                h += 360.0;
            }
            h
        } else if max == g {
            let mut h = 60.0 * ((b - r) / delta + 2.0);
            if h < 0.0 {
                h += 360.0;
            }
            h
        } else {
            let mut h = 60.0 * ((r - g) / delta + 4.0);
            if h < 0.0 {
                h += 360.0;
            }
            h
        };

        let s = if delta == 0.0 {
            0.0
        } else {
            delta / (1.0 - 2.0f64.mul_add(l, -1.0).abs())
        };

        Hsl { h, s, l }
    }

    #[must_use]
    pub fn adjust_saturation(&self, factor: f64) -> Self {
        let hsl = self.to_hsl();
        let new_s = (hsl.s * factor).clamp(0.0, 1.0);
        let (r, g, b) = Hsl::new(hsl.h, new_s, hsl.l).to_rgb();
        Self::from_rgb(r, g, b)
    }

    #[must_use]
    pub fn adjust_lightness(&self, factor: f64) -> Self {
        let hsl = self.to_hsl();
        let new_l = (hsl.l * factor).clamp(0.0, 1.0);
        let (r, g, b) = Hsl::new(hsl.h, hsl.s, new_l).to_rgb();
        Self::from_rgb(r, g, b)
    }
}

/// Gradient stop with position and color
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct GradientStop {
    pub position: f64,
    pub color: Color,
}

impl GradientStop {
    #[must_use]
    pub const fn new(position: f64, color: Color) -> Self {
        Self { position, color }
    }
}

/// Gradient color bar
///
/// Supports sampling at any position from -1.0 to 2.0:
/// - Position 0.0 to 1.0: Interpolates between defined stops
/// - Position < 0.0: Extrapolates to pure black (if min color saturation < 1.0) or pure white
/// - Position > 1.0: Extrapolates to pure white (if max color saturation > 0.0) or pure black
#[derive(Debug, Clone, PartialEq)]
pub struct Gradient {
    pub stops: Vec<GradientStop>,
}

impl Gradient {
    #[must_use]
    pub fn new(mut stops: Vec<GradientStop>) -> Self {
        stops.sort_by(|a, b| {
            a.position
                .partial_cmp(&b.position)
                .unwrap_or(std::cmp::Ordering::Equal)
        });
        Self { stops }
    }

    #[must_use]
    pub fn from_colors(colors: Vec<Color>) -> Self {
        let mut stops: Vec<GradientStop> = colors
            .iter()
            .enumerate()
            .map(|(i, &c)| {
                let pos = if colors.len() == 1 {
                    0.5
                } else {
                    i as f64 / (colors.len() - 1) as f64
                };
                GradientStop::new(pos, c)
            })
            .collect();
        stops.sort_by(|a, b| {
            a.position
                .partial_cmp(&b.position)
                .unwrap_or(std::cmp::Ordering::Equal)
        });
        Self { stops }
    }

    #[must_use]
    pub fn sample(&self, position: f64) -> Color {
        if self.stops.is_empty() {
            return Color::from_rgb(0, 0, 0);
        }

        if self.stops.len() == 1 {
            let color = self.stops[0].color;
            return self.apply_extrapolation(color, position, 0.5);
        }

        let min_stop = self.stops.iter().min_by(|a, b| {
            a.position
                .partial_cmp(&b.position)
                .unwrap_or(std::cmp::Ordering::Equal)
        });
        let max_stop = self.stops.iter().max_by(|a, b| {
            a.position
                .partial_cmp(&b.position)
                .unwrap_or(std::cmp::Ordering::Equal)
        });
        let (min_stop, max_stop) = match (min_stop, max_stop) {
            (Some(min), Some(max)) => (*min, *max),
            _ => return Color::from_rgb(0, 0, 0),
        };

        if position <= min_stop.position {
            let color = min_stop.color;
            return self.apply_extrapolation(color, position, min_stop.position);
        }

        if position >= max_stop.position {
            let color = max_stop.color;
            return self.apply_extrapolation(color, position, max_stop.position);
        }

        for i in 0..self.stops.len() - 1 {
            if self.stops[i].position <= position && position <= self.stops[i + 1].position {
                let range = self.stops[i + 1].position - self.stops[i].position;
                if range <= f64::EPSILON {
                    return self.stops[i].color;
                }
                let t = (position - self.stops[i].position) / range;
                return self.interpolate(self.stops[i].color, self.stops[i + 1].color, t);
            }
        }

        self.stops[0].color
    }

    fn apply_extrapolation(&self, color: Color, position: f64, stop_pos: f64) -> Color {
        let hsl = color.to_hsl();

        if position < stop_pos {
            let distance = stop_pos - position;
            let factor = 1.0 - distance;
            if hsl.s > 0.5 {
                color.adjust_lightness(factor * 0.5)
            } else {
                Color::from_rgb(0, 0, 0)
            }
        } else {
            let distance = position - stop_pos;
            let factor = 1.0 + distance;
            if hsl.s > 0.5 {
                let new_l = (hsl.l * factor).clamp(0.0, 1.0);
                let (r, g, b) = Hsl::new(hsl.h, hsl.s, new_l).to_rgb();
                Color::from_rgb(r, g, b)
            } else {
                Color::from_rgb(255, 255, 255)
            }
        }
    }

    fn interpolate(&self, color1: Color, color2: Color, t: f64) -> Color {
        let r = f64::from(color2.rgb.0)
            .mul_add(t, f64::from(color1.rgb.0) * (1.0 - t))
            .round()
            .clamp(0.0, 255.0) as u8;
        let g = f64::from(color2.rgb.1)
            .mul_add(t, f64::from(color1.rgb.1) * (1.0 - t))
            .round()
            .clamp(0.0, 255.0) as u8;
        let b = f64::from(color2.rgb.2)
            .mul_add(t, f64::from(color1.rgb.2) * (1.0 - t))
            .round()
            .clamp(0.0, 255.0) as u8;
        Color::from_rgb(r, g, b)
    }
}

/// Average multiple colors with optional weights
#[must_use]
pub fn average_colors(colors: &[(Color, f64)]) -> Color {
    if colors.is_empty() {
        return Color::from_rgb(0, 0, 0);
    }

    let total_weight: f64 = colors.iter().map(|(_, w)| w).sum();
    if total_weight == 0.0 {
        return Color::from_rgb(0, 0, 0);
    }

    let r = colors.iter().map(|(c, w)| f64::from(c.rgb.0) * w).sum::<f64>() / total_weight;
    let g = colors.iter().map(|(c, w)| f64::from(c.rgb.1) * w).sum::<f64>() / total_weight;
    let b = colors.iter().map(|(c, w)| f64::from(c.rgb.2) * w).sum::<f64>() / total_weight;

    Color::from_rgb(r.round() as u8, g.round() as u8, b.round() as u8)
}

/// Blend two colors with given ratio (0.0 = color1, 1.0 = color2)
#[must_use]
pub fn blend_colors(color1: Color, color2: Color, ratio: f64) -> Color {
    let t = ratio.clamp(0.0, 1.0);
    let r = f64::from(color2.rgb.0)
        .mul_add(t, f64::from(color1.rgb.0) * (1.0 - t))
        .round()
        .clamp(0.0, 255.0) as u8;
    let g = f64::from(color2.rgb.1)
        .mul_add(t, f64::from(color1.rgb.1) * (1.0 - t))
        .round()
        .clamp(0.0, 255.0) as u8;
    let b = f64::from(color2.rgb.2)
        .mul_add(t, f64::from(color1.rgb.2) * (1.0 - t))
        .round()
        .clamp(0.0, 255.0) as u8;
    Color::from_rgb(r, g, b)
}

/// Parse a hex string to RGB values
fn parse_hex(hex: &str) -> Option<(u8, u8, u8)> {
    let hex = hex.trim_start_matches('#');

    if hex.len() != 6 {
        return None;
    }

    let r = u8::from_str_radix(&hex[0..2], 16).ok()?;
    let g = u8::from_str_radix(&hex[2..4], 16).ok()?;
    let b = u8::from_str_radix(&hex[4..6], 16).ok()?;

    Some((r, g, b))
}

/// Adjust saturation of a hex color string
///
/// # Arguments
///
/// * `hex` - Hex color string (with or without #)
/// * `factor` - Saturation factor (1.0 = no change, >1.0 = more saturated, <1.0 = less saturated)
///
/// # Returns
///
/// Adjusted hex color string
#[must_use]
pub fn adjust_saturation_hex(hex: &str, factor: f64) -> String {
    let (r, g, b) = parse_hex(hex).unwrap_or((0, 0, 0));
    let color = Color::from_rgb(r, g, b);
    color.adjust_saturation(factor).hex()
}

/// Adjust lightness of a hex color string
///
/// # Arguments
///
/// * `hex` - Hex color string (with or without #)
/// * `factor` - Lightness factor (1.0 = no change, >1.0 = lighter, <1.0 = darker)
///
/// # Returns
///
/// Adjusted hex color string
#[must_use]
pub fn adjust_lightness_hex(hex: &str, factor: f64) -> String {
    let (r, g, b) = parse_hex(hex).unwrap_or((0, 0, 0));
    let color = Color::from_rgb(r, g, b);
    color.adjust_lightness(factor).hex()
}

#[cfg(test)]
mod tests {
    use super::*;

    const TOLERANCE: f64 = 2.0;

    fn assert_rgb_close(result: (u8, u8, u8), expected: (u8, u8, u8)) {
        let dr = (i16::from(result.0) - i16::from(expected.0)).unsigned_abs();
        let dg = (i16::from(result.1) - i16::from(expected.1)).unsigned_abs();
        let db = (i16::from(result.2) - i16::from(expected.2)).unsigned_abs();
        assert!(
            dr <= TOLERANCE as u16 && dg <= TOLERANCE as u16 && db <= TOLERANCE as u16,
            "RGB {result:?} too far from expected {expected:?} (tolerance {TOLERANCE})"
        );
    }

    #[test]
    fn test_hsl_to_rgb_pure_red() {
        let (r, g, b) = Hsl::new(0.0, 1.0, 0.5).to_rgb();
        assert_eq!((r, g, b), (255, 0, 0));
    }

    #[test]
    fn test_hsl_to_rgb_pure_green() {
        let (r, g, b) = Hsl::new(120.0, 1.0, 0.5).to_rgb();
        assert_eq!((r, g, b), (0, 255, 0));
    }

    #[test]
    fn test_hsl_to_rgb_pure_blue() {
        let (r, g, b) = Hsl::new(240.0, 1.0, 0.5).to_rgb();
        assert_eq!((r, g, b), (0, 0, 255));
    }

    #[test]
    fn test_hsl_to_rgb_white() {
        let (r, g, b) = Hsl::new(0.0, 0.0, 1.0).to_rgb();
        assert_eq!((r, g, b), (255, 255, 255));
    }

    #[test]
    fn test_hsl_to_rgb_black() {
        let (r, g, b) = Hsl::new(0.0, 0.0, 0.0).to_rgb();
        assert_eq!((r, g, b), (0, 0, 0));
    }

    #[test]
    fn test_hsl_to_rgb_gray() {
        let (r, g, b) = Hsl::new(0.0, 0.0, 0.5).to_rgb();
        assert_eq!((r, g, b), (128, 128, 128));
    }

    #[test]
    fn test_hsl_to_rgb_yellow() {
        let (r, g, b) = Hsl::new(60.0, 1.0, 0.5).to_rgb();
        assert_eq!((r, g, b), (255, 255, 0));
    }

    #[test]
    fn test_hsl_to_rgb_cyan() {
        let (r, g, b) = Hsl::new(180.0, 1.0, 0.5).to_rgb();
        assert_eq!((r, g, b), (0, 255, 255));
    }

    #[test]
    fn test_hsl_to_rgb_magenta() {
        let (r, g, b) = Hsl::new(300.0, 1.0, 0.5).to_rgb();
        assert_eq!((r, g, b), (255, 0, 255));
    }

    #[test]
    fn test_rgb_to_hsl_roundtrip_red() {
        let color = Color::from_rgb(255, 0, 0);
        let hsl = color.to_hsl();
        let (r, g, b) = hsl.to_rgb();
        assert_eq!((r, g, b), (255, 0, 0));
    }

    #[test]
    fn test_rgb_to_hsl_roundtrip_green() {
        let color = Color::from_rgb(0, 255, 0);
        let hsl = color.to_hsl();
        let (r, g, b) = hsl.to_rgb();
        assert_eq!((r, g, b), (0, 255, 0));
    }

    #[test]
    fn test_rgb_to_hsl_roundtrip_blue() {
        let color = Color::from_rgb(0, 0, 255);
        let hsl = color.to_hsl();
        let (r, g, b) = hsl.to_rgb();
        assert_eq!((r, g, b), (0, 0, 255));
    }

    #[test]
    fn test_rgb_to_hsl_roundtrip_black() {
        let color = Color::from_rgb(0, 0, 0);
        let hsl = color.to_hsl();
        assert_eq!(hsl.l, 0.0);
        let (r, g, b) = hsl.to_rgb();
        assert_eq!((r, g, b), (0, 0, 0));
    }

    #[test]
    fn test_rgb_to_hsl_roundtrip_white() {
        let color = Color::from_rgb(255, 255, 255);
        let hsl = color.to_hsl();
        assert_eq!(hsl.l, 1.0);
        let (r, g, b) = hsl.to_rgb();
        assert_eq!((r, g, b), (255, 255, 255));
    }

    #[test]
    fn test_rgb_to_hsl_roundtrip_gray() {
        let color = Color::from_rgb(128, 128, 128);
        let hsl = color.to_hsl();
        let (r, g, b) = hsl.to_rgb();
        assert_rgb_close((r, g, b), (128, 128, 128));
    }

    #[test]
    fn test_rgb_to_hsl_roundtrip_arbitrary() {
        let color = Color::from_rgb(64, 128, 200);
        let hsl = color.to_hsl();
        let (r, g, b) = hsl.to_rgb();
        assert_rgb_close((r, g, b), (64, 128, 200));
    }

    #[test]
    fn test_rgb_to_hsl_roundtrip_pink() {
        let color = Color::from_rgb(255, 179, 167);
        let hsl = color.to_hsl();
        let (r, g, b) = hsl.to_rgb();
        assert_rgb_close((r, g, b), (255, 179, 167));
    }

    #[test]
    fn test_adjust_lightness_darken() {
        let color = Color::from_rgb(200, 100, 50);
        let darkened = color.adjust_lightness(0.5);
        let (r, g, b) = darkened.rgb;
        assert!(r < 200, "Darkened red should be less than original");
        assert!(g < 100, "Darkened green should be less than original");
        assert!(b < 50, "Darkened blue should be less than original");
    }

    #[test]
    fn test_adjust_lightness_brighten() {
        let color = Color::from_rgb(100, 50, 25);
        let brightened = color.adjust_lightness(2.0);
        let (r, g, b) = brightened.rgb;
        assert!(r > 100, "Brightened red should be greater than original");
        assert!(g > 50, "Brightened green should be greater than original");
        assert!(b > 25, "Brightened blue should be greater than original");
    }

    #[test]
    fn test_adjust_lightness_identity() {
        let color = Color::from_rgb(128, 64, 200);
        let same = color.adjust_lightness(1.0);
        assert_rgb_close(same.rgb, (128, 64, 200));
    }

    #[test]
    fn test_adjust_lightness_clamps_to_black() {
        let color = Color::from_rgb(100, 100, 100);
        let dark = color.adjust_lightness(0.0);
        assert_eq!(dark.rgb, (0, 0, 0));
    }

    #[test]
    fn test_adjust_saturation_increase() {
        let color = Color::from_rgb(128, 128, 128);
        let saturated = color.adjust_saturation(2.0);
        let hsl = saturated.to_hsl();
        assert!(hsl.s >= 0.0, "Saturation should be clamped >= 0");
    }

    #[test]
    fn test_adjust_saturation_desaturate() {
        let color = Color::from_rgb(200, 50, 50);
        let desaturated = color.adjust_saturation(0.0);
        let hsl = desaturated.to_hsl();
        assert_eq!(hsl.s, 0.0, "Zero factor should produce zero saturation");
    }

    #[test]
    fn test_adjust_saturation_identity() {
        let color = Color::from_rgb(128, 64, 200);
        let same = color.adjust_saturation(1.0);
        assert_rgb_close(same.rgb, (128, 64, 200));
    }

    #[test]
    fn test_hsl_hue_wrapping() {
        let (r1, g1, b1) = Hsl::new(360.0, 1.0, 0.5).to_rgb();
        let (r2, g2, b2) = Hsl::new(0.0, 1.0, 0.5).to_rgb();
        assert_eq!((r1, g1, b1), (r2, g2, b2), "360° should wrap to 0°");
    }

    #[test]
    fn test_hsl_negative_hue_maps_to_red() {
        // -0° to -360° should map to positive equivalents
        // -0° ≡ 0° (red)
        let (r, g, b) = Hsl::new(-0.0, 1.0, 0.5).to_rgb();
        assert_eq!((r, g, b), (255, 0, 0), "-0° should map to red");
    }

    #[test]
    fn test_hsl_negative_hue_negative_60_is_cyan() {
        // -60° ≡ 300° (magenta)
        let (r1, g1, b1) = Hsl::new(-60.0, 1.0, 0.5).to_rgb();
        let (r2, g2, b2) = Hsl::new(300.0, 1.0, 0.5).to_rgb();
        assert_eq!(
            (r1, g1, b1),
            (r2, g2, b2),
            "-60° should wrap to 300° (magenta)"
        );
    }

    #[test]
    fn test_hsl_negative_hue_negative_90_is_blue() {
        // -90° ≡ 270° (blue)
        let (r1, g1, b1) = Hsl::new(-90.0, 1.0, 0.5).to_rgb();
        let (r2, g2, b2) = Hsl::new(270.0, 1.0, 0.5).to_rgb();
        assert_eq!(
            (r1, g1, b1),
            (r2, g2, b2),
            "-90° should wrap to 270° (blue)"
        );
    }

    #[test]
    fn test_hsl_negative_hue_negative_120_is_cyan() {
        // -120° ≡ 240° (blue)
        let (r1, g1, b1) = Hsl::new(-120.0, 1.0, 0.5).to_rgb();
        let (r2, g2, b2) = Hsl::new(240.0, 1.0, 0.5).to_rgb();
        assert_eq!(
            (r1, g1, b1),
            (r2, g2, b2),
            "-120° should wrap to 240° (blue)"
        );
    }

    #[test]
    fn test_to_hsl_yellow_green_returns_correct_hue() {
        // rgb(128, 255, 0) should produce a hue near 90°
        let color = Color::from_rgb(128, 255, 0);
        let hsl = color.to_hsl();
        assert!(
            hsl.h >= 80.0 && hsl.h <= 100.0,
            "Yellow-green hue should be around 90°, got {}",
            hsl.h
        );
    }

    #[test]
    fn test_to_hsl_purple_blue_returns_correct_hue() {
        // rgb(128, 0, 255) should produce a hue near 270°
        let color = Color::from_rgb(128, 0, 255);
        let hsl = color.to_hsl();
        assert!(
            hsl.h >= 260.0 && hsl.h <= 280.0,
            "Purple-blue hue should be around 270°, got {}",
            hsl.h
        );
    }

    #[test]
    fn test_to_hsl_returns_non_negative_hue() {
        // All conversions should produce hue in [0, 360)
        let test_colors = [
            (255, 0, 0),
            (0, 255, 0),
            (0, 0, 255),
            (255, 255, 0),
            (0, 255, 255),
            (255, 0, 255),
            (128, 64, 32),
            (200, 50, 180),
            (30, 200, 100),
        ];
        for (r, g, b) in test_colors {
            let color = Color::from_rgb(r, g, b);
            let hsl = color.to_hsl();
            assert!(
                hsl.h >= 0.0 && hsl.h < 360.0,
                "Hue should be in [0, 360) for rgb({},{},{}), got {}",
                r,
                g,
                b,
                hsl.h
            );
        }
    }

    #[test]
    fn test_hsl_saturation_clamping() {
        let (r, g, b) = Hsl::new(0.0, 2.0, 0.5).to_rgb();
        assert_eq!((r, g, b), (255, 0, 0), "Saturation > 1 should clamp");
    }

    #[test]
    fn test_hsl_lightness_clamping() {
        let (r, g, b) = Hsl::new(0.0, 1.0, 2.0).to_rgb();
        assert_eq!(
            (r, g, b),
            (255, 255, 255),
            "Lightness > 1 should clamp to white"
        );
    }

    #[test]
    fn test_blend_colors_midpoint() {
        let c1 = Color::from_rgb(0, 0, 0);
        let c2 = Color::from_rgb(255, 255, 255);
        let mid = blend_colors(c1, c2, 0.5);
        assert_rgb_close(mid.rgb, (128, 128, 128));
    }

    #[test]
    fn test_blend_colors_at_zero() {
        let c1 = Color::from_rgb(100, 50, 200);
        let c2 = Color::from_rgb(255, 0, 0);
        let result = blend_colors(c1, c2, 0.0);
        assert_eq!(result.rgb, (100, 50, 200), "Ratio 0 should return color1");
    }

    #[test]
    fn test_blend_colors_at_one() {
        let c1 = Color::from_rgb(100, 50, 200);
        let c2 = Color::from_rgb(255, 0, 0);
        let result = blend_colors(c1, c2, 1.0);
        assert_eq!(result.rgb, (255, 0, 0), "Ratio 1 should return color2");
    }

    #[test]
    fn test_blend_colors_clamps_ratio() {
        let c1 = Color::from_rgb(0, 0, 0);
        let c2 = Color::from_rgb(255, 255, 255);
        let below = blend_colors(c1, c2, -1.0);
        let above = blend_colors(c1, c2, 2.0);
        assert_eq!(below.rgb, (0, 0, 0), "Negative ratio should clamp to 0");
        assert_eq!(above.rgb, (255, 255, 255), "Ratio > 1 should clamp to 1");
    }

    #[test]
    fn test_average_colors_empty() {
        let result = average_colors(&[]);
        assert_eq!(result.rgb, (0, 0, 0));
    }

    #[test]
    fn test_average_colors_single() {
        let result = average_colors(&[(Color::from_rgb(100, 200, 50), 1.0)]);
        assert_eq!(result.rgb, (100, 200, 50));
    }

    #[test]
    fn test_average_colors_equal_weights() {
        let result = average_colors(&[
            (Color::from_rgb(0, 0, 0), 1.0),
            (Color::from_rgb(255, 255, 255), 1.0),
        ]);
        assert_rgb_close(result.rgb, (128, 128, 128));
    }

    #[test]
    fn test_average_colors_weighted() {
        let result = average_colors(&[
            (Color::from_rgb(0, 0, 0), 1.0),
            (Color::from_rgb(100, 100, 100), 3.0),
        ]);
        assert_eq!(result.rgb, (75, 75, 75));
    }

    #[test]
    fn test_average_colors_zero_weights() {
        let result = average_colors(&[
            (Color::from_rgb(100, 200, 50), 0.0),
            (Color::from_rgb(255, 0, 0), 0.0),
        ]);
        assert_eq!(
            result.rgb,
            (0, 0, 0),
            "All zero weights should return black"
        );
    }

    #[test]
    fn test_gradient_two_stops_midpoint() {
        let g = Gradient::from_colors(vec![
            Color::from_rgb(0, 0, 0),
            Color::from_rgb(255, 255, 255),
        ]);
        let mid = g.sample(0.5);
        assert_rgb_close(mid.rgb, (128, 128, 128));
    }

    #[test]
    fn test_gradient_empty() {
        let g = Gradient::new(vec![]);
        let result = g.sample(0.5);
        assert_eq!(result.rgb, (0, 0, 0));
    }

    #[test]
    fn test_gradient_single_stop() {
        let g = Gradient::from_colors(vec![Color::from_rgb(128, 64, 32)]);
        let result = g.sample(0.5);
        assert_eq!(result.rgb, (128, 64, 32));
    }

    #[test]
    fn test_gradient_at_start() {
        let g = Gradient::from_colors(vec![Color::from_rgb(255, 0, 0), Color::from_rgb(0, 255, 0)]);
        let result = g.sample(0.0);
        assert_eq!(result.rgb, (255, 0, 0));
    }

    #[test]
    fn test_gradient_at_end() {
        let g = Gradient::from_colors(vec![Color::from_rgb(255, 0, 0), Color::from_rgb(0, 255, 0)]);
        let result = g.sample(1.0);
        assert_eq!(result.rgb, (0, 255, 0));
    }

    #[test]
    fn test_gradient_three_stops() {
        let g = Gradient::from_colors(vec![
            Color::from_rgb(255, 0, 0),
            Color::from_rgb(0, 255, 0),
            Color::from_rgb(0, 0, 255),
        ]);
        let result = g.sample(0.5);
        assert_rgb_close(result.rgb, (0, 255, 0));
    }

    #[test]
    fn test_parse_hex_valid() {
        assert_eq!(parse_hex("#FF0000"), Some((255, 0, 0)));
        assert_eq!(parse_hex("00FF00"), Some((0, 255, 0)));
        assert_eq!(parse_hex("#0000FF"), Some((0, 0, 255)));
        assert_eq!(parse_hex("FFFFFF"), Some((255, 255, 255)));
        assert_eq!(parse_hex("000000"), Some((0, 0, 0)));
    }

    #[test]
    fn test_parse_hex_invalid() {
        assert_eq!(parse_hex(""), None);
        assert_eq!(parse_hex("FFF"), None);
        assert_eq!(parse_hex("FFFFFFF"), None);
        assert_eq!(parse_hex("GGGGGG"), None);
    }

    #[test]
    fn test_adjust_saturation_hex() {
        let result = adjust_saturation_hex("#FF0000", 1.0);
        assert_eq!(result, "#FF0000", "Factor 1.0 should be identity");
    }

    #[test]
    fn test_adjust_lightness_hex() {
        let result = adjust_lightness_hex("#FF0000", 1.0);
        assert_eq!(result, "#FF0000", "Factor 1.0 should be identity");
    }

    #[test]
    fn test_adjust_lightness_hex_darken() {
        let result = adjust_lightness_hex("#FFFFFF", 0.0);
        assert_eq!(result, "#000000", "Factor 0.0 should produce black");
    }

    #[test]
    fn test_adjust_lightness_hex_invalid() {
        let result = adjust_lightness_hex("invalid", 1.0);
        assert_eq!(result, "#000000", "Invalid hex should fall back to black");
    }

    #[test]
    fn test_gradient_stop_new() {
        let stop = GradientStop::new(0.5, Color::from_rgb(128, 128, 128));
        assert_eq!(stop.position, 0.5);
        assert_eq!(stop.color.rgb, (128, 128, 128));
    }

    #[test]
    fn test_hsl_new() {
        let hsl = Hsl::new(180.0, 0.5, 0.75);
        assert_eq!(hsl.h, 180.0);
        assert_eq!(hsl.s, 0.5);
        assert_eq!(hsl.l, 0.75);
    }
}
