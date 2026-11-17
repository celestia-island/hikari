use super::{Color, ColorCategory};

impl Color {
    /// Constructor with explicit category. `const`-friendly.
    ///
    /// Prefer [`Color::from_rgb_hex`] when you only have RGB values — it infers
    /// the category automatically. Use this when you want to override the
    /// inferred category (e.g. marking a near-white color as `White` rather than
    /// the inferred `Gray`).
    #[must_use]
    pub const fn new(r: u8, g: u8, b: u8, category: ColorCategory) -> Self {
        Self {
            name: None,
            rgb: (r, g, b),
            category,
        }
    }

    /// Construct from RGB with an inferred category. `const`-friendly.
    ///
    /// This is the workhorse constructor used by the generated collection
    /// modules. The inferred category is a best-effort hue classification; it is
    /// a UX hint (e.g. for grouping in docs/pickers), not a source of truth.
    #[must_use]
    pub const fn from_rgb_hex(r: u8, g: u8, b: u8) -> Self {
        Self::new(r, g, b, ColorCategory::infer(r, g, b))
    }

    /// Backwards-compatible alias for [`Color::from_rgb_hex`].
    #[must_use]
    pub const fn from_rgb(r: u8, g: u8, b: u8) -> Self {
        Self::from_rgb_hex(r, g, b)
    }

    /// Attach a human-readable name. Returns a new `Color`.
    ///
    /// The generated collection constants set this at build time so each color
    /// carries its source name (e.g. `"粉红"`). Manually-constructed colors
    /// start with `name: None`.
    #[must_use]
    pub const fn with_name(mut self, name: &'static str) -> Self {
        self.name = Some(name);
        self
    }

    /// The color's name, if it has one (collections name every color; ad-hoc
    /// colors from [`Color::from_rgb_hex`] do not).
    #[must_use]
    pub const fn name(&self) -> Option<&'static str> {
        self.name
    }

    /// sRGB channel -> linear light (IEC 61966-2-1 / WCAG 2.x toe).
    fn channel_linear(v: u8) -> f64 {
        let c = f64::from(v) / 255.0;
        if c <= 0.04045 {
            c / 12.92
        } else {
            ((c + 0.055) / 1.055).powf(2.4)
        }
    }

    /// WCAG 2.x relative luminance (D65). Range `0.0..=1.0`.
    #[must_use]
    pub fn relative_luminance(&self) -> f64 {
        let r = Self::channel_linear(self.rgb.0);
        let g = Self::channel_linear(self.rgb.1);
        let b = Self::channel_linear(self.rgb.2);
        0.2126 * r + 0.7152 * g + 0.0722 * b
    }

    /// WCAG 2.x contrast ratio against `other`. Range `1.0..=21.0`.
    #[must_use]
    pub fn contrast_ratio(&self, other: &Self) -> f64 {
        let a = self.relative_luminance();
        let b = other.relative_luminance();
        let (hi, lo) = if a >= b { (a, b) } else { (b, a) };
        (hi + 0.05) / (lo + 0.05)
    }

    /// OKLCH of this colour: `(L, C, H_degrees)` using Ottosson's OKLab
    /// matrices. Hue is `0.0..360.0`; a grey has `C == 0.0` and an arbitrary
    /// hue, so callers must treat near-zero chroma as hue-less.
    #[must_use]
    pub fn oklch(&self) -> (f64, f64, f64) {
        let r = Self::channel_linear(self.rgb.0);
        let g = Self::channel_linear(self.rgb.1);
        let b = Self::channel_linear(self.rgb.2);
        let l = 0.412_221_470_8 * r + 0.536_332_536_3 * g + 0.051_445_992_9 * b;
        let m = 0.211_903_498_2 * r + 0.680_699_545_1 * g + 0.107_396_956_6 * b;
        let s = 0.088_302_461_9 * r + 0.281_718_837_6 * g + 0.629_978_700_5 * b;
        let (l_, m_, s_) = (l.cbrt(), m.cbrt(), s.cbrt());
        let ok_l = 0.210_454_255_3 * l_ + 0.793_617_785_0 * m_ - 0.004_072_046_8 * s_;
        let ok_a = 1.977_998_495_1 * l_ - 2.428_592_205_0 * m_ + 0.450_593_709_9 * s_;
        let ok_b = 0.025_904_037_1 * l_ + 0.782_771_766_2 * m_ - 0.808_675_766_0 * s_;
        let chroma = ok_a.hypot(ok_b);
        let hue = ok_b.atan2(ok_a).to_degrees().rem_euclid(360.0);
        (ok_l, chroma, hue)
    }

    /// This colour as TEXT on `bg`: itself when it already clears `target`,
    /// otherwise the nearest lightness step that does, with hue and saturation
    /// preserved. A semantic slot is a FILL (mode-independent per the user's
    /// direction); painting it as text needs this variant, not the fill.
    #[must_use]
    pub fn readable_on(&self, bg: &Self, target: f64) -> Self {
        if self.contrast_ratio(bg) >= target {
            return self.clone();
        }
        let hsl = self.to_hsl();
        let mut best: Option<(f64, Self)> = None;
        // One pass over every lightness step; keep the hit nearest the original.
        for step in 0..=200 {
            let l = f64::from(step) / 200.0;
            let (r, g, b) = crate::color_math::Hsl::new(hsl.h, hsl.s, l).to_rgb();
            let candidate = Self::from_rgb_hex(r, g, b);
            if candidate.contrast_ratio(bg) < target {
                continue;
            }
            let dist = (l - hsl.l).abs();
            let closer = match best.as_ref() {
                Some((d, _)) => dist < *d,
                None => true,
            };
            if closer {
                best = Some((dist, candidate));
            }
        }
        match best {
            Some((_, colour)) => colour,
            None => {
                let white = Self::from_rgb_hex(0xff, 0xff, 0xff);
                let black = Self::from_rgb_hex(0x00, 0x00, 0x00);
                if white.contrast_ratio(bg) >= black.contrast_ratio(bg) {
                    white
                } else {
                    black
                }
            }
        }
    }

    /// The ink (black or white) that reads best on this fill — the perceptual
    /// max-contrast rule. Ties go to white (the house white-first default).
    #[must_use]
    pub fn readable_ink(&self) -> Self {
        let white = Self::from_rgb_hex(0xff, 0xff, 0xff);
        let black = Self::from_rgb_hex(0x00, 0x00, 0x00);
        if white.contrast_ratio(self) >= black.contrast_ratio(self) {
            white
        } else {
            black
        }
    }

    #[must_use]
    pub fn hex(&self) -> String {
        format!("#{:02X}{:02X}{:02X}", self.rgb.0, self.rgb.1, self.rgb.2)
    }

    #[must_use]
    pub fn rgba(&self, alpha: f64) -> String {
        format!(
            "rgba({}, {}, {}, {})",
            self.rgb.0, self.rgb.1, self.rgb.2, alpha
        )
    }

    /// Construct from float components in `[0.0, 1.0]`.
    #[must_use]
    pub fn from_rgb_float(r: f64, g: f64, b: f64) -> Self {
        let r = (r.clamp(0.0, 1.0) * 255.0).round() as u8;
        let g = (g.clamp(0.0, 1.0) * 255.0).round() as u8;
        let b = (b.clamp(0.0, 1.0) * 255.0).round() as u8;
        Self::from_rgb_hex(r, g, b)
    }

    #[must_use]
    pub fn rgba_u8(&self, alpha: u8) -> String {
        format!(
            "rgba({}, {}, {}, {:.3})",
            self.rgb.0,
            self.rgb.1,
            self.rgb.2,
            alpha as f64 / 255.0
        )
    }

    #[must_use]
    pub const fn r(&self) -> u8 {
        self.rgb.0
    }
    #[must_use]
    pub const fn g(&self) -> u8 {
        self.rgb.1
    }
    #[must_use]
    pub const fn b(&self) -> u8 {
        self.rgb.2
    }

    #[must_use]
    pub fn brightness(&self) -> f64 {
        let r = self.rgb.0 as f64 / 255.0;
        let g = self.rgb.1 as f64 / 255.0;
        let b = self.rgb.2 as f64 / 255.0;

        0.299 * r + 0.587 * g + 0.114 * b
    }

    #[must_use]
    pub fn is_dark(&self) -> bool {
        self.brightness() < 0.5
    }

    #[must_use]
    pub fn is_light(&self) -> bool {
        self.brightness() >= 0.5
    }

    #[must_use]
    pub fn is_dark_for_glow(&self) -> bool {
        self.brightness() < 0.4
    }

    #[must_use]
    pub fn contrast(&self, alpha: f64) -> (u8, u8, u8, f64) {
        if self.is_dark() {
            (255, 255, 255, alpha)
        } else {
            (0, 0, 0, alpha)
        }
    }

    #[must_use]
    pub fn contrast_rgba(&self, alpha: f64) -> String {
        let (r, g, b, a) = self.contrast(alpha);
        format!("rgba({}, {}, {}, {})", r, g, b, a)
    }

    #[must_use]
    pub fn glow_contrast(&self, alpha: f64) -> (u8, u8, u8, f64) {
        if self.is_dark_for_glow() {
            (255, 255, 255, alpha)
        } else {
            (0, 0, 0, alpha)
        }
    }

    #[must_use]
    pub fn glow_contrast_rgba(&self, alpha: f64) -> String {
        let (r, g, b, a) = self.glow_contrast(alpha);
        format!("rgba({}, {}, {}, {})", r, g, b, a)
    }

    #[must_use]
    pub fn glow_contrast_dynamic(&self) -> (u8, u8, u8, f64) {
        let brightness = self.brightness();

        let glow_brightness = if self.is_dark_for_glow() { 1.0 } else { 0.0 };

        let contrast = (brightness - glow_brightness).abs();

        let alpha = if contrast > 0.7 {
            0.7
        } else if contrast > 0.5 {
            0.6
        } else {
            0.5
        };

        let (r, g, b) = if glow_brightness == 1.0 {
            (255, 255, 255)
        } else {
            (0, 0, 0)
        };

        (r, g, b, alpha)
    }

    #[must_use]
    pub fn glow_contrast_dynamic_rgba(&self) -> String {
        let (r, g, b, a) = self.glow_contrast_dynamic();
        format!("rgba({}, {}, {}, {})", r, g, b, a)
    }
}
