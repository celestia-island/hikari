//! # Hikari Build System
//!
//! Build-time code generation and icon management for Hikari UI applications.
//!
//! ## Modules
//!
//! - **[`icons`]** - Icon selection and Rust code generation
//! - **[`atomic_write`]** - Race-safe artifact replacement shared with the build script

pub mod atomic_write;
pub mod icons;

pub use icons::{
    IconConfig, IconConfigBuilder, IconSelection, MdiStyle, build_icons, build_selected_icons,
    scan_available_icons,
};
