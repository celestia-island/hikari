//! # Hikari Theme System
//!
//! Theme system for Hikari UI applications with Arknights-inspired aesthetics
//! and FUI (Future User Interface) design principles.
//!
//! ## Architecture
//!
//! The theme system consists of several core components:
//!
//! - **[`provider`]** - [`ThemeProvider`] component for theme context management
//! - **[`context`]** - Theme context hooks and state management
//! - **[`generated`]** - Auto-generated theme assets (Tailwind CSS, variables)
//!
//! ## Supported Themes
//!
//! The theme system includes two built-in theme palettes:
//!
//! - **Hikari (光)** - Light theme inspired by traditional Chinese colors
//!   - Primary: 石青 (Cyan/Blue)
//!   - Secondary: 朱砂 (Vermilion/Red)
//!   - Accent: 藤黄 (Gamboge/Yellow)
//!   - Background: 月白 (Light White)
//!
//! - **Tairitsu** - Dark theme with high contrast
//!   - Primary: 靛蓝 (Indigo/Dark Blue)
//!   - Secondary: 朱砂 (Vermilion/Red)
//!   - Accent: 鹅黄 (Goose Yellow)
//!   - Background: 墨色 (Ink Black)
//!
//! ## Quick Start
//!
//! ### Basic Usage
//!
//! ```rust,no_run
//! use theme::ThemeProvider;
//!
//! rsx! {
//!     ThemeProvider { palette: "hikari" } {
//!         // Your application content
//!         div { "Hello, Hikari!" }
//!     }
//! }
//! ```
//!
//! ### Dark Theme
//!
//! ```rust,no_run
//! use theme::ThemeProvider;
//!
//! rsx! {
//!     ThemeProvider { palette: "tairitsu" } {
//!         // Application with dark theme
//!     }
//! }
//! ```
//!
//! ### Accessing Theme Context
//!
//! ```rust,no_run
//! use theme::{use_theme, ThemeContext};
//! use dioxus::prelude::*;
//!
//! fn Component() -> Element {
//!     let theme = use_theme()?;
//!
//!     rsx! {
//!         div {
//!             style: "color: {theme.palette.primary}",
//!             "Themed text"
//!         }
//!     }
//! }
//! ```
//!
//! ### Nested Themes (Local Override)
//!
//! Theme providers can be nested for local theme overrides:
//!
//! ```rust,no_run
//! use theme::ThemeProvider;
//!
//! rsx! {
//!     ThemeProvider { palette: "hikari" } {
//!         // Main app uses light theme
//!         Sidebar {}
//!
//!         div {
//!             ThemeProvider { palette: "tairitsu" } {
//!                 // This section uses dark theme
//!                 DarkPanel {}
//!             }
//!         }
//!     }
//! }
//! ```
//!
//! ## Theme Switching
//!
//! Implement theme switching with state management:
//!
//! ```rust,no_run
//! use theme::ThemeProvider;
//! use dioxus::prelude::*;
//!
//! fn App() -> Element {
//!     let mut theme = use_signal(|| "hikari".to_string());
//!
//!     rsx! {
//!         ThemeProvider { palette: "{theme}" } {
//!             button {
//!                 onclick: move |_| {
//!                     theme.set(if *theme() == "hikari" {
//!                         "tairitsu".to_string()
//!                     } else {
//!                         "hikari".to_string()
//!                     });
//!                 },
//!                 "Toggle Theme"
//!             }
//!         }
//!     }
//! }
//! ```
//!
//! ## Theme Customization
//!
//! Custom themes can be defined by extending the palette system:
//!
//! ```rust,no_run
//! use palette::ThemePalette;
//!
//! struct CustomTheme;
//!
//! impl CustomTheme {
//!     pub fn palette() -> ThemePalette {
//!         ThemePalette {
//!             primary: "#FF0000",
//!             secondary: "#00FF00",
//!             // ... other color definitions
//!         }
//!     }
//! }
//! ```
//!
//! ## Design Principles
//!
//! The Hikari theme system follows these design principles:
//!
//! 1. **Arknights Aesthetics**
//!    - Clean lines and clear information hierarchy
//!    - High contrast for readability
//!    - Minimalist yet refined design
//!
//! 2. **FUI (Future User Interface)**
//!    - Subtle glow effects (box-shadow, text-shadow)
//!    - Dynamic indicators (breathing lights, pulse animations)
//!    - Fine borders (1px semi-transparent)
//!    - Geometric patterns (hexagons, grids)
//!
//! 3. **Traditional Chinese Colors**
//!    - Authentic color names and values
//!    - Culturally significant color combinations
//!    - Harmony between traditional and modern design
//!
//! ## Integration with Components
//!
//! All Hikari components automatically inherit the theme from the nearest
//! [`ThemeProvider`] ancestor:
//!
//! ```rust,no_run
//! use theme::ThemeProvider;
//! use components::Button;
//!
//! rsx! {
//!     ThemeProvider { palette: "hikari" } {
//!         // Button automatically uses Hikari theme colors
//!         Button { label: "Themed Button" }
//!     }
//! }
//! ```
//!
//! ## CSS Variables
//!
//! The theme system generates CSS variables for easy access in styles:
//!
//! ```css
//! .hi-theme-provider[data-theme="hikari"] {
//!     --hi-primary: #00A0E9;
//!     --hi-secondary: #E94B35;
//!     --hi-accent: #F8B62D;
//!     /* ... more variables */
//! }
//! ```
//!
//! These can be used in custom CSS:
//!
//! ```css
//! .my-component {
//!     color: var(--hi-primary);
//!     background: var(--hi-background);
//! }
//! ```

pub mod context;
pub mod generated;
pub mod provider;

pub use context::*;
pub use provider::*;
