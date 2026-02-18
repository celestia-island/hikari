//! CSS variable generation for themes

use palette::*;

/// Palette override configuration
#[derive(Clone, Default)]
pub struct PaletteOverrides {
    pub primary: Option<String>,
    pub secondary: Option<String>,
    pub accent: Option<String>,
    pub success: Option<String>,
    pub warning: Option<String>,
    pub danger: Option<String>,
    pub background: Option<String>,
    pub surface: Option<String>,
    pub border: Option<String>,
    pub text_primary: Option<String>,
    pub text_secondary: Option<String>,
}

/// Component color override configuration (Layer 2)
/// Users can override only the fields they need, others remain auto-calculated
#[derive(Clone, Default, PartialEq)]
pub struct ComponentOverrides {
    pub selection_icon_color: Option<String>,
    pub selection_background: Option<String>,
    pub selection_border: Option<String>,
    pub selection_surface: Option<String>,
    pub selection_glow: Option<String>,
    pub input_border: Option<String>,
    pub input_focus_border: Option<String>,
    pub input_background: Option<String>,
}

/// Component-level color palette (Layer 2)
/// All colors are auto-calculated from Palette, user can override via ComponentOverrides
#[derive(Clone, PartialEq)]
pub struct ComponentPalette {
    pub selection_icon_color: String,
    pub selection_background: String,
    pub selection_border: String,
    pub selection_surface: String,
    pub selection_glow: String,
    pub input_border: String,
    pub input_focus_border: String,
    pub input_background: String,
}

impl ComponentPalette {
    pub fn from_palette(palette: &Palette) -> Self {
        Self::from_palette_with_overrides(palette, ComponentOverrides::default())
    }

    pub fn from_palette_with_overrides(palette: &Palette, overrides: ComponentOverrides) -> Self {
        let auto = Self::compute_defaults(palette);
        Self {
            selection_icon_color: overrides
                .selection_icon_color
                .unwrap_or(auto.selection_icon_color),
            selection_background: overrides
                .selection_background
                .unwrap_or(auto.selection_background),
            selection_border: overrides.selection_border.unwrap_or(auto.selection_border),
            selection_surface: overrides
                .selection_surface
                .unwrap_or(auto.selection_surface),
            selection_glow: overrides.selection_glow.unwrap_or(auto.selection_glow),
            input_border: overrides.input_border.unwrap_or(auto.input_border),
            input_focus_border: overrides
                .input_focus_border
                .unwrap_or(auto.input_focus_border),
            input_background: overrides.input_background.unwrap_or(auto.input_background),
        }
    }

    fn compute_defaults(palette: &Palette) -> Self {
        let selection_background = match palette.mode {
            ThemeMode::Light => format!(
                "linear-gradient(135deg, {}, {})",
                palette.primary.rgba(0.9),
                palette.primary.rgba(0.75)
            ),
            ThemeMode::Dark => format!(
                "linear-gradient(135deg, {}, {})",
                palette.text_primary.rgba(0.95),
                palette.text_primary.rgba(0.8)
            ),
        };
        Self {
            selection_icon_color: match palette.mode {
                ThemeMode::Light => palette.background.hex(),
                ThemeMode::Dark => palette.primary.hex(),
            },
            selection_background,
            selection_border: match palette.mode {
                ThemeMode::Light => "rgba(0, 0, 0, 0.2)".to_string(),
                ThemeMode::Dark => "rgba(255, 255, 255, 0.15)".to_string(),
            },
            selection_surface: match palette.mode {
                ThemeMode::Light => palette.surface.rgba(0.7),
                ThemeMode::Dark => "rgba(30, 30, 40, 0.6)".to_string(),
            },
            selection_glow: palette.button_glow_color(&palette.primary),
            input_border: match palette.mode {
                ThemeMode::Light => "rgba(0, 0, 0, 0.15)".to_string(),
                ThemeMode::Dark => "rgba(255, 255, 255, 0.1)".to_string(),
            },
            input_focus_border: palette.primary.hex(),
            input_background: palette.surface.rgba(0.7),
        }
    }

    pub fn css_variables(&self) -> String {
        [
            format!(
                "--hi-component-selection-icon: {};",
                self.selection_icon_color
            ),
            format!(
                "--hi-component-selection-bg: {};",
                self.selection_background
            ),
            format!(
                "--hi-component-selection-border: {};",
                self.selection_border
            ),
            format!(
                "--hi-component-selection-surface: {};",
                self.selection_surface
            ),
            format!("--hi-component-selection-glow: {};", self.selection_glow),
            format!("--hi-component-input-border: {};", self.input_border),
            format!(
                "--hi-component-input-focus-border: {};",
                self.input_focus_border
            ),
            format!("--hi-component-input-bg: {};", self.input_background),
        ]
        .join(" ")
    }
}

/// Theme palette with CSS variable values
#[derive(Clone, PartialEq)]
pub struct ThemePalette {
    pub primary: String,
    pub secondary: String,
    pub accent: String,
    pub success: String,
    pub warning: String,
    pub danger: String,
    pub background: String,
    pub surface: String,
    pub border: String,

    pub text_primary: String,
    pub text_secondary: String,

    pub aside_bg: String,
    pub header_bg: String,

    pub menu_hover_glow: String,

    pub button_primary: String,
    pub button_primary_dark: String,
    pub button_primary_light: String,
    pub button_secondary: String,
    pub button_secondary_dark: String,
    pub button_secondary_light: String,
    pub button_danger: String,
    pub button_danger_dark: String,
    pub button_danger_light: String,
    pub button_success: String,
    pub button_success_dark: String,
    pub button_success_light: String,

    pub button_primary_hover_start: String,
    pub button_primary_hover_end: String,
    pub button_secondary_hover_start: String,
    pub button_secondary_hover_end: String,
    pub button_danger_hover_start: String,
    pub button_danger_hover_end: String,
    pub button_success_hover_start: String,
    pub button_success_hover_end: String,

    pub button_icon_on_dark: String,
    pub button_icon_on_light: String,

    pub text_color_on_primary: String,
    pub text_color_on_secondary: String,
    pub text_color_on_danger: String,
    pub text_color_on_success: String,
    pub text_color_on_ghost: String,

    pub border_light: String,
    pub border_ghost: String,

    pub glow_button_primary: String,
    pub glow_button_secondary: String,
    pub glow_button_success: String,
    pub glow_button_danger: String,
    pub glow_button_warning: String,
    pub glow_button_info: String,

    pub ghost_text: String,
    pub ghost_border: String,
    pub ghost_glow: String,

    pub focus_brightness_primary: String,
    pub focus_brightness_secondary: String,
    pub focus_brightness_success: String,
    pub focus_brightness_danger: String,
    pub focus_brightness_warning: String,
    pub focus_brightness_info: String,
}

impl ThemePalette {
    pub(crate) fn from_palette(palette: &Palette) -> Self {
        ThemePalette {
            primary: palette.primary.hex(),
            secondary: palette.secondary.hex(),
            accent: palette.accent.hex(),
            success: palette.success.hex(),
            warning: palette.warning.hex(),
            danger: palette.danger.hex(),
            background: palette.background.hex(),
            surface: palette.surface.rgba(0.7),
            border: palette.border.hex(),
            text_primary: palette.text_primary.hex(),
            text_secondary: palette.text_secondary.hex(),

            button_primary: palette.primary.rgba(0.9),
            button_primary_dark: palette.primary.rgba(0.75),
            button_primary_light: palette.primary.rgba(0.95),
            button_secondary: palette.secondary.rgba(0.9),
            button_secondary_dark: palette.secondary.rgba(0.75),
            button_secondary_light: palette.secondary.rgba(0.95),
            button_danger: palette.danger.rgba(0.9),
            button_danger_dark: palette.danger.rgba(0.75),
            button_danger_light: palette.danger.rgba(0.95),
            button_success: palette.success.rgba(0.9),
            button_success_dark: palette.success.rgba(0.75),
            button_success_light: palette.success.rgba(0.95),

            button_primary_hover_start: if palette.primary.brightness() < 0.4 {
                palette.primary.rgba(0.9)
            } else {
                palette.primary.rgba(0.95)
            },
            button_primary_hover_end: if palette.primary.brightness() < 0.4 {
                palette.primary.rgba(0.75)
            } else {
                palette.primary.rgba(0.9)
            },
            button_secondary_hover_start: if palette.secondary.brightness() < 0.4 {
                palette.secondary.rgba(0.9)
            } else {
                palette.secondary.rgba(0.95)
            },
            button_secondary_hover_end: if palette.secondary.brightness() < 0.4 {
                palette.secondary.rgba(0.75)
            } else {
                palette.secondary.rgba(0.9)
            },
            button_danger_hover_start: if palette.danger.brightness() < 0.4 {
                palette.danger.rgba(0.9)
            } else {
                palette.danger.rgba(0.95)
            },
            button_danger_hover_end: if palette.danger.brightness() < 0.4 {
                palette.danger.rgba(0.75)
            } else {
                palette.danger.rgba(0.9)
            },
            button_success_hover_start: if palette.success.brightness() < 0.4 {
                palette.success.rgba(0.9)
            } else {
                palette.success.rgba(0.95)
            },
            button_success_hover_end: if palette.success.brightness() < 0.4 {
                palette.success.rgba(0.75)
            } else {
                palette.success.rgba(0.9)
            },

            button_icon_on_dark: "#ffffff".to_string(),
            button_icon_on_light: palette.primary.hex(),

            text_color_on_primary: "#ffffff".to_string(),
            text_color_on_secondary: "#ffffff".to_string(),
            text_color_on_danger: "#ffffff".to_string(),
            text_color_on_success: "#ffffff".to_string(),
            text_color_on_ghost: palette.primary.hex(),

            border_light: "rgba(255,255,255, 0.2)".to_string(),
            border_ghost: palette.primary.hex(),

            glow_button_primary: palette.button_glow_color(&palette.primary),
            glow_button_secondary: palette.button_glow_color(&palette.secondary),
            glow_button_danger: palette.button_glow_color(&palette.danger),
            glow_button_success: palette.button_glow_color(&palette.success),
            glow_button_warning: palette.button_glow_color(&palette.warning),
            glow_button_info: palette.button_glow_color(&palette.accent),

            ghost_text: palette.text_primary.hex(),
            ghost_border: palette.text_secondary.rgba(0.4),
            ghost_glow: palette.ghost_glow_color(0.5),

            aside_bg: if palette.mode == ThemeMode::Light {
                "rgba(255, 255, 255, 0.9)".to_string()
            } else {
                "rgba(25, 25, 51, 0.9)".to_string()
            },
            header_bg: if palette.mode == ThemeMode::Light {
                "rgba(255, 255, 255, 0.9)".to_string()
            } else {
                "rgba(25, 25, 51, 0.9)".to_string()
            },

            menu_hover_glow: if palette.mode == ThemeMode::Light {
                "rgba(255, 255, 255, 0.6)".to_string()
            } else {
                "rgba(0, 0, 0, 0.6)".to_string()
            },

            focus_brightness_primary: palette.focus_brightness_filter(&palette.primary),
            focus_brightness_secondary: palette.focus_brightness_filter(&palette.secondary),
            focus_brightness_danger: palette.focus_brightness_filter(&palette.danger),
            focus_brightness_success: palette.focus_brightness_filter(&palette.success),
            focus_brightness_warning: palette.focus_brightness_filter(&palette.warning),
            focus_brightness_info: palette.focus_brightness_filter(&palette.accent),
        }
    }

    pub(crate) fn with_overrides(mut self, overrides: PaletteOverrides) -> Self {
        if let Some(color) = overrides.primary {
            self.primary = color;
        }
        if let Some(color) = overrides.secondary {
            self.secondary = color;
        }
        if let Some(color) = overrides.accent {
            self.accent = color;
        }
        if let Some(color) = overrides.success {
            self.success = color;
        }
        if let Some(color) = overrides.warning {
            self.warning = color;
        }
        if let Some(color) = overrides.danger {
            self.danger = color;
        }
        if let Some(color) = overrides.background {
            self.background = color;
        }
        if let Some(color) = overrides.surface {
            self.surface = color;
        }
        if let Some(color) = overrides.border {
            self.border = color;
        }
        if let Some(color) = overrides.text_primary {
            self.text_primary = color;
        }
        if let Some(color) = overrides.text_secondary {
            self.text_secondary = color;
        }

        self
    }

    pub fn css_variables(&self) -> String {
        [
            format!("--hi-primary: {};", self.primary),
            format!("--hi-secondary: {};", self.secondary),
            format!("--hi-accent: {};", self.accent),
            format!("--hi-success: {};", self.success),
            format!("--hi-warning: {};", self.warning),
            format!("--hi-danger: {};", self.danger),
            format!("--hi-background: {};", self.background),
            format!("--hi-surface: {};", self.surface),
            format!("--hi-border: {};", self.border),
            format!("--hi-text-primary: {};", self.text_primary),
            format!("--hi-text-secondary: {};", self.text_secondary),
            format!("--hi-color-text-primary: {};", self.text_primary),
            format!("--hi-color-text-secondary: {};", self.text_secondary),
            format!("--hi-color-primary: {};", self.primary),
            format!("--hi-color-secondary: {};", self.secondary),
            format!("--hi-color-background: {};", self.background),
            format!("--hi-color-surface: {};", self.surface),
            format!("--hi-color-border: {};", self.border),
            format!("--hi-button-primary: {};", self.button_primary),
            format!("--hi-button-primary-dark: {};", self.button_primary_dark),
            format!("--hi-button-primary-light: {};", self.button_primary_light),
            format!("--hi-button-secondary: {};", self.button_secondary),
            format!(
                "--hi-button-secondary-dark: {};",
                self.button_secondary_dark
            ),
            format!(
                "--hi-button-secondary-light: {};",
                self.button_secondary_light
            ),
            format!("--hi-button-danger: {};", self.button_danger),
            format!("--hi-button-danger-dark: {};", self.button_danger_dark),
            format!("--hi-button-danger-light: {};", self.button_danger_light),
            format!("--hi-button-success: {};", self.button_success),
            format!("--hi-button-success-dark: {};", self.button_success_dark),
            format!("--hi-button-success-light: {};", self.button_success_light),
            format!(
                "--hi-button-primary-hover-start: {};",
                self.button_primary_hover_start
            ),
            format!(
                "--hi-button-primary-hover-end: {};",
                self.button_primary_hover_end
            ),
            format!(
                "--hi-button-secondary-hover-start: {};",
                self.button_secondary_hover_start
            ),
            format!(
                "--hi-button-secondary-hover-end: {};",
                self.button_secondary_hover_end
            ),
            format!(
                "--hi-button-danger-hover-start: {};",
                self.button_danger_hover_start
            ),
            format!(
                "--hi-button-danger-hover-end: {};",
                self.button_danger_hover_end
            ),
            format!(
                "--hi-button-success-hover-start: {};",
                self.button_success_hover_start
            ),
            format!(
                "--hi-button-success-hover-end: {};",
                self.button_success_hover_end
            ),
            format!("--hi-button-icon-on-dark: {};", self.button_icon_on_dark),
            format!("--hi-button-icon-on-light: {};", self.button_icon_on_light),
            format!(
                "--hi-color-text-on-primary: {};",
                self.text_color_on_primary
            ),
            format!(
                "--hi-color-text-on-secondary: {};",
                self.text_color_on_secondary
            ),
            format!("--hi-color-text-on-danger: {};", self.text_color_on_danger),
            format!(
                "--hi-color-text-on-success: {};",
                self.text_color_on_success
            ),
            format!("--hi-color-text-on-ghost: {};", self.text_color_on_ghost),
            format!("--hi-color-border-ghost: {};", self.border_ghost),
            format!("--hi-border-light: {};", self.border_light),
            format!("--hi-glow-button-primary: {};", self.glow_button_primary),
            format!(
                "--hi-glow-button-secondary: {};",
                self.glow_button_secondary
            ),
            format!("--hi-glow-button-danger: {};", self.glow_button_danger),
            format!("--hi-glow-button-success: {};", self.glow_button_success),
            format!("--hi-glow-button-warning: {};", self.glow_button_warning),
            format!("--hi-glow-button-info: {};", self.glow_button_info),
            format!("--hi-ghost-text: {};", self.ghost_text),
            format!("--hi-ghost-border: {};", self.ghost_border),
            format!("--hi-ghost-glow: {};", self.ghost_glow),
            format!(
                "--hi-focus-brightness-primary: {};",
                self.focus_brightness_primary
            ),
            format!(
                "--hi-focus-brightness-secondary: {};",
                self.focus_brightness_secondary
            ),
            format!(
                "--hi-focus-brightness-danger: {};",
                self.focus_brightness_danger
            ),
            format!(
                "--hi-focus-brightness-success: {};",
                self.focus_brightness_success
            ),
            format!(
                "--hi-focus-brightness-warning: {};",
                self.focus_brightness_warning
            ),
            format!(
                "--hi-focus-brightness-info: {};",
                self.focus_brightness_info
            ),
            format!("--hi-aside-bg: {};", self.aside_bg),
            format!("--hi-header-bg: {};", self.header_bg),
            format!("--hi-menu-hover-glow: {};", self.menu_hover_glow),
        ]
        .join(" ")
    }
}
