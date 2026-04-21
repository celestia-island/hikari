//! # Hikari Palette
//!
//! Comprehensive color palette system featuring 500+ traditional Chinese colors with rich historical context and modern type-safe Rust constants.
//!
//! ## Overview
//!
//! `hikari-palette` provides:
//!
//! - **500+ Traditional Chinese Colors** - Authentic historical colors from Chinese art, culture, and nature
//! - **Rich Metadata** - Each color includes hex, RGB, CMYK values, and historical notes
//! - **Type-Safe Constants** - Use Chinese identifiers directly in your Rust code
//! - **Pre-defined Palettes** - Ready-to-use color schemes for different design systems
//! - **Utility Classes** - Type-safe Tailwind-like utility class system
//!
//! ## Design Philosophy
//!
//! This crate uses **"Scheme C-Plus"** - Chinese constant names with English API design:
//!
//! ```rust
//! // Chinese constant names (cultural authenticity)
//! let primary = 石青;
//! let secondary = 朱砂;
//!
//! // English API (interoperability)
//! println!("{}: {}", primary.name, primary.hex);
//! ```
//!
//! ## Modules
//!
//! - [`colors`] - Individual color definitions (500+ traditional colors)
//! - [`themes`] - Theme palettes (Hikari, Tairitsu, Arknights, Fresh)
//! - [`classes`] - Type-safe utility class system with hierarchical enums
//!
//! ## Quick Start
//!
//! ### Basic Color Usage
//!
//! ```rust,no_run
//! use hikari_palette::{石青, 朱砂, 藤黄, 月白};
//!
//! # fn main() {
//! #     let primary = 石青;
//! #     let secondary = 朱砂;
//! #
//! #     println!("Primary color: {}", primary.name);
//! #     println!("Hex: {}", primary.hex);
//! #     println!("RGB: {:?}", primary.rgb);
//! # }
//! ```
//!
//! ### Using Pre-defined Palettes
//!
//! ```rust,no_run
//! use hikari_palette::{primary_palette, fui_dark_palette, arknights_palette};
//!
//! // Primary theme (default)
//! let palette = primary_palette();
//! println!("Primary: {}", palette.primary.hex);
//!
//! // FUI Dark theme
//! let dark = fui_dark_palette();
//!
//! // Arknights theme
//! let arknights = arknights_palette();
//! ```
//!
//! ### Utility Classes
//!
//! ```rust,no_run
//! use hikari_palette::classes::*;
//!
//! let classes = ClassesBuilder::new()
//!     .add(Display::Flex)
//!     .add(FlexDirection::Row)
//!     .add(Gap::Gap4)
//!     .build();
//! // Output: "hi-flex hi-flex-row hi-gap-4"
//! ```
//!
//! ## Color Categories
//!
//! Colors are organized into categories:
//!
//! - **Red** (赤色系): 朱砂, 丹雘, 银红, ...
//! - **Orange** (橙色系): 藤黄, 鹅黄, 杏黄, ...
//! - **Green** (绿色系): 葱倩, 竹青, 豆碧, ...
//! - **Cyan/Blue** (青色系): 石青, 靛蓝, 群碧, ...
//! - **Purple** (紫色系): 紫檀, 丁香, 牡丹, ...
//! - **White** (白色系): 月白, 云白, ...
//! - **Black** (黑色系): 墨色, 玄色, ...
//! - **Gray** (灰色系): 缟色, 黛色, 铁灰, 烟灰, ...
//!
//! ## Available Themes
//!
//! | Theme | Description | Primary Color | Secondary Color |
//! |-------|-------------|---------------|-----------------|
//! | `primary_palette()` | Default Hikari theme | 石青 (#1759A8) | 朱砂 (#FF4C00) |
//! | `fui_dark_palette()` | FUI Dark sci-fi | 靛蓝 (#1A237E) | 朱砂 (#FF4C00) |
//! | `arknights_palette()` | Arknights-inspired | 石青 (#1759A8) | 朱砂 (#FF4C00) |
//! | `fresh_palette()` | Light, fresh | 月白 (#D6ECF0) | 葱倩 (#5CBF91) |
//!
//! ## Historical Context
//!
//! Many colors include historical notes:
//!
//! ```rust,no_run
//! use hikari_palette::{石青};
//!
//! if let Some(note) = 石青.historical_note {
//!     println!("{}", note);
//!     // Output: 中国画传统颜料，源于蓝铜矿石
//! }
//! ```
//!
//! ## Color Reference
//!
//! ### Primary Colors
//!
//! | Color Name | Chinese | Hex | Usage |
//! |------------|---------|-----|-------|
//! | Stone Cyan | 石青 | #1759A8 | Primary brand color |
//! | Cinnabar | 朱砂 | #FF4C00 | Secondary accent |
//! | Vine Yellow | 藤黄 | #FFB800 | Highlights |
//! | Indigo | 靛蓝 | #1A237E | Deep accents |
//!
//! ### Functional Colors
//!
//! | Color Name | Chinese | Hex | Usage |
//! |------------|---------|-----|-------|
//! | Scallion Green | 葱倩 | #5CBF91 | Success states |
//! | Goosling Yellow | 鹅黄 | #FBC02D | Warnings |
//! | Cinnabar | 朱砂 | #FF4C00 | Error, danger |
//!
//! ## Integration with Other Crates
//!
//! `hikari-palette` integrates seamlessly with:
//!
//! - **hikari-theme** - Theme provider uses color palettes
//! - **hikari-components** - Components inherit colors from theme
//!
//! ```rust,no_run
//! use hikari_palette::primary_palette;
//! use hikari_theme::ThemeProvider;
//!
//! // In your Dioxus app
//! rsx! {
//!     ThemeProvider { palette: "primary".to_string(),
//!         // Uses colors from primary_palette()
//!     }
//! }
//! ```
//!
//! For more details, see the [crate documentation](https://docs.rs/hikari-palette)

pub mod classes;
pub mod color_math;
pub mod colors;
pub mod themes;

pub use classes::*;
pub use color_math::*;
pub use colors::*;
pub use themes::*;

pub use tairitsu_style::ClassesBuilder;
pub use tairitsu_style::TypedClass;

#[cfg(target_family = "wasm")]
mod wasm_export {
    wit_bindgen::generate!({
        path: "wit",
        world: "palette",
    });

    pub struct PaletteExports;

    fn color_to_wit(c: &crate::colors::Color) -> exports::hikari::palette::color::Color {
        exports::hikari::palette::color::Color {
            r: c.r(),
            g: c.g(),
            b: c.b(),
            category: match c.category {
                crate::colors::ColorCategory::Red => exports::hikari::palette::color::ColorCategory::Red,
                crate::colors::ColorCategory::Yellow => exports::hikari::palette::color::ColorCategory::Yellow,
                crate::colors::ColorCategory::Green => exports::hikari::palette::color::ColorCategory::Green,
                crate::colors::ColorCategory::Blue => exports::hikari::palette::color::ColorCategory::Blue,
                crate::colors::ColorCategory::Cyan => exports::hikari::palette::color::ColorCategory::Cyan,
                crate::colors::ColorCategory::White => exports::hikari::palette::color::ColorCategory::White,
                crate::colors::ColorCategory::Black => exports::hikari::palette::color::ColorCategory::Black,
                crate::colors::ColorCategory::Gray => exports::hikari::palette::color::ColorCategory::Gray,
                crate::colors::ColorCategory::Purple => exports::hikari::palette::color::ColorCategory::Purple,
                crate::colors::ColorCategory::Orange => exports::hikari::palette::color::ColorCategory::Orange,
            },
        }
    }

    fn wit_to_color(c: &exports::hikari::palette::color::Color) -> crate::colors::Color {
        crate::colors::Color::from_rgb(c.r, c.g, c.b)
    }

    fn palette_to_wit(p: &crate::themes::Palette) -> exports::hikari::palette::theme::Palette {
        exports::hikari::palette::theme::Palette {
            mode: match p.mode {
                crate::themes::ThemeMode::Light => exports::hikari::palette::theme::ThemeMode::Light,
                crate::themes::ThemeMode::Dark => exports::hikari::palette::theme::ThemeMode::Dark,
            },
            primary: color_to_wit(&p.primary),
            secondary: color_to_wit(&p.secondary),
            accent: color_to_wit(&p.accent),
            success: color_to_wit(&p.success),
            warning: color_to_wit(&p.warning),
            danger: color_to_wit(&p.danger),
            background: color_to_wit(&p.background),
            surface: color_to_wit(&p.surface),
            border: color_to_wit(&p.border),
            text_primary: color_to_wit(&p.text_primary),
            text_secondary: color_to_wit(&p.text_secondary),
        }
    }

    impl exports::hikari::palette::version::Guest for PaletteExports {
        fn get_version() -> String {
            env!("CARGO_PKG_VERSION").to_string()
        }
    }

    impl exports::hikari::palette::color::Guest for PaletteExports {
        fn color_from_rgb(r: u8, g: u8, b: u8) -> exports::hikari::palette::color::Color {
            let c = crate::colors::Color::from_rgb(r, g, b);
            color_to_wit(&c)
        }

        fn color_hex(c: exports::hikari::palette::color::Color) -> String {
            wit_to_color(&c).hex()
        }

        fn color_rgba(c: exports::hikari::palette::color::Color, alpha: f64) -> String {
            wit_to_color(&c).rgba(alpha)
        }

        fn color_brightness(c: exports::hikari::palette::color::Color) -> f64 {
            wit_to_color(&c).brightness()
        }

        fn color_is_dark(c: exports::hikari::palette::color::Color) -> bool {
            wit_to_color(&c).is_dark()
        }

        fn color_is_light(c: exports::hikari::palette::color::Color) -> bool {
            wit_to_color(&c).is_light()
        }

        fn color_to_hsl(c: exports::hikari::palette::color::Color) -> exports::hikari::palette::color::Hsl {
            let hsl = wit_to_color(&c).to_hsl();
            exports::hikari::palette::color::Hsl { h: hsl.h, s: hsl.s, l: hsl.l }
        }

        fn color_adjust_saturation(c: exports::hikari::palette::color::Color, factor: f64) -> exports::hikari::palette::color::Color {
            let adjusted = wit_to_color(&c).adjust_saturation(factor);
            color_to_wit(&adjusted)
        }

        fn color_adjust_lightness(c: exports::hikari::palette::color::Color, factor: f64) -> exports::hikari::palette::color::Color {
            let adjusted = wit_to_color(&c).adjust_lightness(factor);
            color_to_wit(&adjusted)
        }

        fn color_contrast_rgba(c: exports::hikari::palette::color::Color, alpha: f64) -> String {
            wit_to_color(&c).contrast_rgba(alpha)
        }
    }

    impl exports::hikari::palette::color_math::Guest for PaletteExports {
        fn blend_colors(
            c1: exports::hikari::palette::color::Color,
            c2: exports::hikari::palette::color::Color,
            ratio: f64,
        ) -> exports::hikari::palette::color::Color {
            let result = crate::color_math::blend_colors(wit_to_color(&c1), wit_to_color(&c2), ratio);
            color_to_wit(&result)
        }

        fn average_colors(
            colors: Vec<(exports::hikari::palette::color::Color, f64)>,
        ) -> exports::hikari::palette::color::Color {
            let native: Vec<_> = colors.iter().map(|(c, w)| (wit_to_color(c), *w)).collect();
            let result = crate::color_math::average_colors(&native);
            color_to_wit(&result)
        }

        fn adjust_saturation_hex(hex: String, factor: f64) -> String {
            crate::color_math::adjust_saturation_hex(&hex, factor)
        }

        fn adjust_lightness_hex(hex: String, factor: f64) -> String {
            crate::color_math::adjust_lightness_hex(&hex, factor)
        }

        fn hsl_to_rgb(hsl: exports::hikari::palette::color::Hsl) -> (u8, u8, u8) {
            crate::color_math::Hsl::new(hsl.h, hsl.s, hsl.l).to_rgb()
        }
    }

    impl exports::hikari::palette::gradient::Guest for PaletteExports {
        fn gradient_sample(
            stops: Vec<exports::hikari::palette::gradient::GradientStop>,
            position: f64,
        ) -> exports::hikari::palette::color::Color {
            let native_stops: Vec<_> = stops.iter().map(|s| {
                crate::color_math::GradientStop::new(s.position, wit_to_color(&s.color))
            }).collect();
            let gradient = crate::color_math::Gradient::new(native_stops);
            let result = gradient.sample(position);
            color_to_wit(&result)
        }
    }

    impl exports::hikari::palette::theme::Guest for PaletteExports {
        fn light_theme() -> exports::hikari::palette::theme::Palette {
            palette_to_wit(&crate::themes::light_theme())
        }

        fn dark_theme() -> exports::hikari::palette::theme::Palette {
            palette_to_wit(&crate::themes::dark_theme())
        }

        fn default_theme() -> exports::hikari::palette::theme::Palette {
            palette_to_wit(&crate::themes::default_theme())
        }

        fn palette_button_glow_color(
            p: exports::hikari::palette::theme::Palette,
            c: exports::hikari::palette::color::Color,
        ) -> String {
            let native_palette = crate::themes::Palette {
                mode: match p.mode {
                    exports::hikari::palette::theme::ThemeMode::Light => crate::themes::ThemeMode::Light,
                    exports::hikari::palette::theme::ThemeMode::Dark => crate::themes::ThemeMode::Dark,
                },
                primary: wit_to_color(&p.primary),
                secondary: wit_to_color(&p.secondary),
                accent: wit_to_color(&p.accent),
                success: wit_to_color(&p.success),
                warning: wit_to_color(&p.warning),
                danger: wit_to_color(&p.danger),
                background: wit_to_color(&p.background),
                surface: wit_to_color(&p.surface),
                border: wit_to_color(&p.border),
                text_primary: wit_to_color(&p.text_primary),
                text_secondary: wit_to_color(&p.text_secondary),
            };
            native_palette.button_glow_color(&wit_to_color(&c))
        }

        fn palette_ghost_text_color(
            p: exports::hikari::palette::theme::Palette,
            alpha: f64,
        ) -> String {
            let mode = match p.mode {
                exports::hikari::palette::theme::ThemeMode::Light => crate::themes::ThemeMode::Light,
                exports::hikari::palette::theme::ThemeMode::Dark => crate::themes::ThemeMode::Dark,
            };
            let tmp = crate::themes::Palette {
                mode,
                primary: wit_to_color(&p.primary),
                secondary: wit_to_color(&p.secondary),
                accent: wit_to_color(&p.accent),
                success: wit_to_color(&p.success),
                warning: wit_to_color(&p.warning),
                danger: wit_to_color(&p.danger),
                background: wit_to_color(&p.background),
                surface: wit_to_color(&p.surface),
                border: wit_to_color(&p.border),
                text_primary: wit_to_color(&p.text_primary),
                text_secondary: wit_to_color(&p.text_secondary),
            };
            tmp.ghost_text_color(alpha)
        }
    }

    export!(PaletteExports);
}
