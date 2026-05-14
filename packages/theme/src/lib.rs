//! # Hikari Theme System
//!
//! Theme system for Hikari UI applications with flat design
//! and glow effect aesthetics.
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
//! - **Hikari (光)** - Light theme
//!   - Primary: 粉红 (Pink)
//!   - Secondary: 苍翠 (Green)
//!   - Accent: 姜黄 (Gold)
//!   - Background: White
//!
//! - **Tairitsu (対立)** - Dark theme with high contrast
//!   - Primary: 鷃蓝 (Navy Blue)
//!   - Secondary: 姜黄 (Gold)
//!   - Background: 漆黑 (Deep Black)
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
//! use crate::prelude::*;;
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
//! use crate::prelude::*;;
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
//! 1. **Flat Design Aesthetics**
//!    - Clean lines and clear information hierarchy
//!    - High contrast for readability
//!    - Minimalist yet refined design
//!
//! 2. **Glow Effects**
//!    - Subtle glow effects (box-shadow, text-shadow)
//!    - Dynamic indicators (breathing lights, pulse animations)
//!    - Fine borders (1px semi-transparent)
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
//!     --hi-primary: #FFB3A7;
//!     --hi-secondary: #519A73;
//!     --hi-accent: #FFC773;
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

pub mod assets;
pub mod context;
pub mod prelude;
pub mod provider;
pub mod style_provider;

pub use context::*;
pub use provider::*;
pub use style_provider::{
    StyleConfig, StyleContext, StyleProvider, StyleProviderProps, try_use_style,
    use_component_class, use_style,
};
