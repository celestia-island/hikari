//! Type-safe CSS property manipulation utilities
//!
//! Provides a type-safe way to set CSS properties on DOM elements,
//! reducing boilerplate and catching property name typos at compile time.
//!
//! # Example
//!
//! ```ignore
//! use animation::style::*;
//! use wasm_bindgen::JsCast;
//!
//! let element = web_sys::window()
//!     .unwrap()
//!     .document()
//!     .unwrap()
//!     .get_element_by_id("my-element")
//!     .unwrap()
//!     .dyn_into::<web_sys::HtmlElement>()
//!     .unwrap();
//!
//! // Set a single property
//! set_style(&element, CssProperty::Width, "100px");
//!
//! // Set multiple properties at once
//! set_styles(&element, &[
//!     (CssProperty::Display, "flex"),
//!     (CssProperty::FlexDirection, "column"),
//!     (CssProperty::Gap, "1rem"),
//! ]);
//!
//! // Using the builder pattern for more complex scenarios
//! StyleBuilder::new(&element)
//!     .add(CssProperty::Position, "relative")
//!     .add(CssProperty::Top, "0")
//!     .add(CssProperty::Left, "0")
//!     .add(CssProperty::Width, "100%")
//!     .apply();
//! ```

mod builder;
mod helpers;
mod properties;

pub use builder::{AttributeBuilder, StyleBuilder, StyleStringBuilder};
pub use helpers::{get_style, remove_style, set_style, set_styles};
pub use properties::{CssProperty, Property};

#[cfg(test)]
mod tests {

    use super::*;

    #[test]
    fn test_css_property_names() {
        assert_eq!(CssProperty::Display.as_str(), "display");
        assert_eq!(CssProperty::FlexDirection.as_str(), "flex-direction");
        assert_eq!(CssProperty::ZIndex.as_str(), "z-index");
        assert_eq!(CssProperty::BackgroundColor.as_str(), "background-color");
    }

    #[test]
    fn test_css_property_comprehensive() {
        // Test a representative sample of properties
        let props = vec![
            CssProperty::Position,
            CssProperty::Display,
            CssProperty::Width,
            CssProperty::Height,
            CssProperty::Margin,
            CssProperty::Padding,
            CssProperty::FlexDirection,
            CssProperty::AlignItems,
            CssProperty::GridTemplateColumns,
            CssProperty::FontSize,
            CssProperty::Color,
            CssProperty::BackgroundColor,
            CssProperty::Opacity,
            CssProperty::Transform,
            CssProperty::BoxShadow,
            CssProperty::Overflow,
        ];

        for prop in props {
            let name = prop.as_str();
            // All property names should contain only lowercase letters, numbers, and hyphens
            assert!(name
                .chars()
                .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-'));
            // Property names should not be empty
            assert!(!name.is_empty());
        }
    }

    #[test]
    fn test_style_string_builder_basic() {
        let style = StyleStringBuilder::new()
            .add(CssProperty::Width, "100px")
            .add_px(CssProperty::Height, 50)
            .build_clean();

        assert!(style.contains("width:100px"));
        assert!(style.contains("height:50px"));
    }

    #[test]
    fn test_style_string_builder_add_custom() {
        let style = StyleStringBuilder::new()
            .add_custom("--glow-x", "100px")
            .add_custom("--glow-y", "200px")
            .build_clean();

        assert!(style.contains("--glow-x:100px"));
        assert!(style.contains("--glow-y:200px"));
    }

    #[test]
    fn test_style_string_builder_mixed() {
        let style = StyleStringBuilder::new()
            .add(CssProperty::Position, "relative")
            .add_custom("--glow-x", "50px")
            .add_px(CssProperty::Height, 100)
            .build_clean();

        assert!(style.contains("position:relative"));
        assert!(style.contains("--glow-x:50px"));
        assert!(style.contains("height:100px"));
    }
}
