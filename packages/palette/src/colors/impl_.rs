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
