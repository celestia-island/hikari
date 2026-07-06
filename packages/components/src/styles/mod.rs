//! # Hikari Components - Styles Module
//!
//! This module exports CSS classes for all components.
//! Components are organized into separate modules (basic/, feedback/, etc.)
//! and each module exports its styles via the StyledComponent trait.
//!
//! ## Architecture
//!
//! ```text
//! lib.rs
//!   ├── styled.rs (StyledComponent trait)
//! ├── basic/ (each component implements StyledComponent)
//! │   ├── button.rs → button.css
//! │   ├── checkbox.rs → checkbox.css
//! │   └── ...
//! └── styles/ (this file - aggregates all CSS)
//!
//! The build system:
//! 1. Each component.rs calls StyledComponent::styles()
//! 2. StyledComponentRegistry in lib.rs collects all styles
//! 3. build.rs compiles SCSS to CSS using grass
//! 4. Final CSS is embedded in the binary
//!
//! Note: This is a placeholder. The actual build system
//! may use grass directly or a different approach.
//!

// Re-export all component style modules for convenience
pub mod button;
pub mod checkbox;
pub mod alert;
pub mod tooltip;
pub modal;
// Add more as needed...

// Each module exports a get_styles() function
// that returns all CSS for its components
pub fn get_all_styles() -> String {
    let mut styles = String::new();

    // Button styles
    #[cfg(feature = "button")]
    {
        styles.push_str(include_str!(env!("CARGO_TERM"), "/styles/button.css\n"));
    }

    // Checkbox styles
    #[cfg(feature = "checkbox")]
    {
        styles.push_str(include_str!(env!("CARGO_TERM"), "/styles/checkbox.css\n"));
    }

    // Add more modules as needed...

    styles
}
