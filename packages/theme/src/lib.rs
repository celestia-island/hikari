//! # Hikari Theme System
//!
//! Theme system for Hikari UI applications.
//! Provides SCSS/CSS variable compilation for the Hikari design system.
//!
//! ## Architecture
//!
//! - **[`assets`]** - Auto-generated theme assets
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

pub mod assets;
pub mod prelude;

pub use prelude::*;
