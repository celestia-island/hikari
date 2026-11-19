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

    /// Parse `#RRGGBB` / `RRGGBB` (the shape every emitted CSS var carries).
    /// Non-hex or non-ASCII input is `None`, never a panic.
    #[must_use]
    pub fn from_hex(value: &str) -> Option<Self> {
        let s = value.trim().strip_prefix('#').unwrap_or(value.trim());
        let bytes = s.as_bytes();
        if bytes.len() != 6 || !bytes.iter().all(u8::is_ascii_hexdigit) {
            return None;
        }
        let r = u8::from_str_radix(std::str::from_utf8(&bytes[0..2]).ok()?, 16).ok()?;
        let g = u8::from_str_radix(std::str::from_utf8(&bytes[2..4]).ok()?, 16).ok()?;
        let b = u8::from_str_radix(std::str::from_utf8(&bytes[4..6]).ok()?, 16).ok()?;
        Some(Self::from_rgb_hex(r, g, b))
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

    /// Raw (non-encoded) sRGB for an OKLCH triple — may be out of gamut.
    fn oklch_raw(l: f64, chroma: f64, hue_deg: f64) -> (f64, f64, f64) {
        let a = chroma * hue_deg.to_radians().cos();
        let b = chroma * hue_deg.to_radians().sin();
        let l_ = (l + 0.396_337_777_4 * a + 0.215_803_757_3 * b).powi(3);
        let m_ = (l - 0.105_561_345_8 * a - 0.063_854_172_8 * b).powi(3);
        let s_ = (l - 0.089_484_177_5 * a - 1.291_485_548_0 * b).powi(3);
        (
            4.076_741_662_1 * l_ - 3.307_711_591_3 * m_ + 0.230_969_929_2 * s_,
            -1.268_438_004_6 * l_ + 2.609_757_401_1 * m_ - 0.341_319_396_5 * s_,
            -0.004_196_086_3 * l_ - 0.703_418_614_7 * m_ + 1.707_614_701_0 * s_,
        )
    }

    fn in_gamut_raw(l: f64, chroma: f64, hue_deg: f64) -> bool {
        let (r, g, b) = Self::oklch_raw(l, chroma, hue_deg);
        (-1e-4..=1.0 + 1e-4).contains(&r)
            && (-1e-4..=1.0 + 1e-4).contains(&g)
            && (-1e-4..=1.0 + 1e-4).contains(&b)
    }

    /// The largest chroma the sRGB gamut allows at `(l, hue)`. The ceiling a
    /// gamut-mapped colour can carry — hue is preserved, chroma is clipped.
    #[must_use]
    pub fn gamut_chroma(l: f64, hue_deg: f64) -> f64 {
        if !Self::in_gamut_raw(l, 0.0, hue_deg) {
            return 0.0;
        }
        let mut lo = 0.0_f64;
        let mut hi = 0.4_f64;
        if Self::in_gamut_raw(l, hi, hue_deg) {
            return hi;
        }
        for _ in 0..48 {
            let mid = (lo + hi) / 2.0;
            if Self::in_gamut_raw(l, mid, hue_deg) {
                lo = mid;
            } else {
                hi = mid;
            }
        }
        lo
    }

    /// OKLCH -> sRGB, chroma-reducing into gamut (the same trade the TS
    /// derivation makes: keep the HUE, give up chroma).
    #[must_use]
    pub fn from_oklch(l: f64, chroma: f64, hue_deg: f64) -> Self {
        let l = l.clamp(0.0, 1.0);
        let chroma = chroma.min(Self::gamut_chroma(l, hue_deg));
        let (r, g, b) = Self::oklch_raw(l, chroma, hue_deg);
        let enc = |v: f64| {
            let v = v.clamp(0.0, 1.0);
            let s = if v <= 0.003_130_8 {
                12.92 * v
            } else {
                1.055 * v.powf(1.0 / 2.4) - 0.055
            };
            (s * 255.0).round() as u8
        };
        Self::from_rgb_hex(enc(r), enc(g), enc(b))
    }

    /// This colour as TEXT on every `bgs`: itself when it already clears
    /// `target` on all of them, otherwise the nearest OKLCH-lightness step
    /// that does. Hue is preserved and chroma is only given up where the
    /// sRGB gamut forces it — the same trade the fill derivation makes.
    /// A neutral fill stays neutral (no chroma floor).
    ///
    /// A semantic slot is a FILL (mode-independent per the user's direction);
    /// painting it as text needs this variant, not the fill.
    #[must_use]
    pub fn readable_on(&self, bgs: &[&Self], target: f64) -> Self {
        if bgs.iter().all(|bg| self.contrast_ratio(bg) >= target) {
            return *self;
        }
        let (l0, c0, h0) = self.oklch();
        let mut best: Option<(f64, Self)> = None;
        for step in 0..=400 {
            let l = f64::from(step) / 400.0;
            let candidate = Self::from_oklch(l, c0, h0);
            if bgs.iter().any(|bg| candidate.contrast_ratio(bg) < target) {
                continue;
            }
            let dist = (l - l0).abs();
            if best.as_ref().is_none_or(|(d, _)| dist < *d) {
                best = Some((dist, candidate));
            }
        }
        match best {
            Some((_, colour)) => colour,
            None => {
                let white = Self::from_rgb_hex(0xff, 0xff, 0xff);
                let black = Self::from_rgb_hex(0x00, 0x00, 0x00);
                let probe = bgs.first().copied().unwrap_or(&white);
                if white.contrast_ratio(probe) >= black.contrast_ratio(probe) {
                    white
                } else {
                    black
                }
            }
        }
    }

    /// The HOUSE ink for this fill (user direction 2026-11-12): WHITE by
    /// default, BLACK only when the fill is light enough to need it. This is
    /// deliberately NOT the WCAG ratio winner — see the contract in the Vue
    /// package's `solidInk`. Ported here so the Rust side can state the same
    /// rule instead of borrowing the rejected one.
    #[must_use]
    pub fn solid_ink(&self) -> Self {
        // Rec.709 coefficients — the exact metric the TS rule uses.
        let r = f64::from(self.rgb.0) / 255.0;
        let g = f64::from(self.rgb.1) / 255.0;
        let b = f64::from(self.rgb.2) / 255.0;
        let luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        if luminance > 0.65 {
            Self::from_rgb_hex(0x00, 0x00, 0x00)
        } else {
            Self::from_rgb_hex(0xff, 0xff, 0xff)
        }
    }

    /// The ink that wins the WCAG ratio — a UTILITY, not the house rule. Kept
    /// for callers that genuinely want the maximum-contrast side (the house
    /// rule is [`Color::solid_ink`]).
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
