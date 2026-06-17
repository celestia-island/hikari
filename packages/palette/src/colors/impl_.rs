use super::{Color, ColorCategory};

impl Color {
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

    #[must_use]
    pub const fn from_rgb(r: u8, g: u8, b: u8) -> Self {
        Self {
            #[cfg(feature = "chinese-names")]
            name: "Custom",
            #[cfg(not(feature = "chinese-names"))]
            name: (),
            rgb: (r, g, b),
            category: ColorCategory::Custom,
        }
    }

    #[must_use]
    pub fn from_rgb_float(r: f64, g: f64, b: f64) -> Self {
        let r = (r.clamp(0.0, 1.0) * 255.0).round() as u8;
        let g = (g.clamp(0.0, 1.0) * 255.0).round() as u8;
        let b = (b.clamp(0.0, 1.0) * 255.0).round() as u8;
        Self::from_rgb(r, g, b)
    }

    #[must_use]
    pub fn rgba_u8(&self, alpha: u8) -> String {
        let alpha_f = f64::from(alpha) / 255.0;
        format!(
            "rgba({}, {}, {}, {:.3})",
            self.rgb.0, self.rgb.1, self.rgb.2, alpha_f
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
        let r = f64::from(self.rgb.0) / 255.0;
        let g = f64::from(self.rgb.1) / 255.0;
        let b = f64::from(self.rgb.2) / 255.0;

        0.114f64.mul_add(b, 0.587f64.mul_add(g, 0.299 * r))
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
        format!("rgba({r}, {g}, {b}, {a})")
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
        format!("rgba({r}, {g}, {b}, {a})")
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
        format!("rgba({r}, {g}, {b}, {a})")
    }
}
