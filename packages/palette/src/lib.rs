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
//! fn main() {
//!     let primary = 石青;
//!     let secondary = 朱砂;
//!
//!     println!("Primary color: {}", primary.name);
//!     println!("Hex: {}", primary.hex);
//!     println!("RGB: {:?}", primary.rgb);
//! }
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
pub mod colors;
pub mod themes;

pub use classes::*;
pub use colors::*;
pub use themes::*;
