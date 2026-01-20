//! Color math module
//!
//! Provides advanced color calculations and transformations including:
//! - HSL/HSV color space conversions
//! - Saturation/lightness adjustments
//! - Color interpolation and blending
//! - Gradient color stops

use crate::Color;

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
    pub fn new(h: f64, s: f64, l: f64) -> Self {
        Self { h, s, l }
    }

    pub fn to_rgb(&self) -> (u8, u8, u8) {
        let h = self.h % 360.0;
        let s = self.s.clamp(0.0, 1.0);
        let l = self.l.clamp(0.0, 1.0);

        let c = (1.0 - (2.0 * l - 1.0).abs()) * s;
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
    pub fn to_hsl(&self) -> Hsl {
        let r = self.rgb.0 as f64 / 255.0;
        let g = self.rgb.1 as f64 / 255.0;
        let b = self.rgb.2 as f64 / 255.0;

        let max = r.max(g).max(b);
        let min = r.min(g).min(b);
        let delta = max - min;

        let l = (max + min) / 2.0;

        let h = if delta == 0.0 {
            0.0
        } else if max == r {
            60.0 * (((g - b) / delta) % 6.0)
        } else if max == g {
            60.0 * ((b - r) / delta + 2.0)
        } else {
            60.0 * ((r - g) / delta + 4.0)
        };

        let s = if delta == 0.0 {
            0.0
        } else {
            delta / (1.0 - (2.0 * l - 1.0).abs())
        };

        Hsl {
            h: h.max(0.0),
            s,
            l,
        }
    }

    pub fn adjust_saturation(&self, factor: f64) -> Color {
        let hsl = self.to_hsl();
        let new_s = (hsl.s * factor).clamp(0.0, 1.0);
        let (r, g, b) = Hsl::new(hsl.h, new_s, hsl.l).to_rgb();
        Color::from_rgb(r, g, b)
    }

    pub fn adjust_lightness(&self, factor: f64) -> Color {
        let hsl = self.to_hsl();
        let new_l = (hsl.l * factor).clamp(0.0, 1.0);
        let (r, g, b) = Hsl::new(hsl.h, hsl.s, new_l).to_rgb();
        Color::from_rgb(r, g, b)
    }
}

/// Gradient stop with position and color
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct GradientStop {
    pub position: f64,
    pub color: Color,
}

impl GradientStop {
    pub fn new(position: f64, color: Color) -> Self {
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
    pub fn new(stops: Vec<GradientStop>) -> Self {
        Self { stops }
    }

    pub fn from_colors(colors: Vec<Color>) -> Self {
        let stops = colors
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
        Self::new(stops)
    }

    pub fn sample(&self, position: f64) -> Color {
        if self.stops.is_empty() {
            return Color::from_rgb(0, 0, 0);
        }

        if self.stops.len() == 1 {
            let color = self.stops[0].color;
            return self.apply_extrapolation(color, position, 0.5);
        }

        let min_stop = self
            .stops
            .iter()
            .min_by(|a, b| a.position.partial_cmp(&b.position).unwrap())
            .unwrap();
        let max_stop = self
            .stops
            .iter()
            .max_by(|a, b| a.position.partial_cmp(&b.position).unwrap())
            .unwrap();

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
                let t = (position - self.stops[i].position)
                    / (self.stops[i + 1].position - self.stops[i].position);
                return self.interpolate(self.stops[i].color, self.stops[i + 1].color, t);
            }
        }

        self.stops[0].color
    }

    fn apply_extrapolation(
        &self,
        color: Color,
        position: f64,
        stop_pos: f64,
    ) -> Color {
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
        let r = (color1.rgb.0 as f64 * (1.0 - t) + color2.rgb.0 as f64 * t).round() as u8;
        let g = (color1.rgb.1 as f64 * (1.0 - t) + color2.rgb.1 as f64 * t).round() as u8;
        let b = (color1.rgb.2 as f64 * (1.0 - t) + color2.rgb.2 as f64 * t).round() as u8;
        Color::from_rgb(r, g, b)
    }
}

/// Average multiple colors with optional weights
pub fn average_colors(colors: &[(Color, f64)]) -> Color {
    if colors.is_empty() {
        return Color::from_rgb(0, 0, 0);
    }

    let total_weight: f64 = colors.iter().map(|(_, w)| w).sum();
    if total_weight == 0.0 {
        return Color::from_rgb(0, 0, 0);
    }

    let r = colors.iter().map(|(c, w)| c.rgb.0 as f64 * w).sum::<f64>() / total_weight;
    let g = colors.iter().map(|(c, w)| c.rgb.1 as f64 * w).sum::<f64>() / total_weight;
    let b = colors.iter().map(|(c, w)| c.rgb.2 as f64 * w).sum::<f64>() / total_weight;

    Color::from_rgb(r.round() as u8, g.round() as u8, b.round() as u8)
}

/// Blend two colors with given ratio (0.0 = color1, 1.0 = color2)
pub fn blend_colors(color1: Color, color2: Color, ratio: f64) -> Color {
    let t = ratio.clamp(0.0, 1.0);
    let r = (color1.rgb.0 as f64 * (1.0 - t) + color2.rgb.0 as f64 * t).round() as u8;
    let g = (color1.rgb.1 as f64 * (1.0 - t) + color2.rgb.1 as f64 * t).round() as u8;
    let b = (color1.rgb.2 as f64 * (1.0 - t) + color2.rgb.2 as f64 * t).round() as u8;
    Color::from_rgb(r, g, b)
}
