//! Hikari Utility Classes System
//!
//! Type-safe, hierarchical utility class system inspired by Tailwind CSS.
//!
//! # Features
//!
//! - Type-safe class names via enums
//! - Hierarchical organization for better discoverability
//! - IDE auto-completion support
//! - Compile-time checking for typos
//! - `hi-` prefix for all classes to avoid conflicts
//!
//! # Example
//!
//! ```ignore
//! use palette::classes::*;
//! use palette::ClassesBuilder;
//!
//! let classes = ClassesBuilder::new()
//!     .add(Display::Flex)
//!     .add(FlexDirection::Row)
//!     .add(Gap::Gap4)
//!     .add(components::Header::HeaderMain)
//!     .build();
//!
//! // Output: "hi-flex hi-flex-row hi-gap-4 hi-header-main"
//! ```

pub mod colors;
pub mod components;
pub mod display;
pub mod effects;
pub mod layout;
pub mod sizing;
pub mod spacing;
pub mod transitions;
pub mod typography;

pub use colors::*;
pub use components::*;
pub use display::*;
pub use effects::*;
pub use layout::*;
pub use sizing::*;
pub use spacing::*;
pub use transitions::*;
pub use typography::*;

/// Base trait for all utility classes
///
/// This trait is automatically implemented for enums that derive
/// the necessary attributes. All classes get the `hi-` prefix automatically.
pub trait UtilityClass {
    /// Get the CSS class name suffix (without `hi-` prefix)
    ///
    /// The prefix will be automatically added by the ClassesBuilder.
    fn as_suffix(&self) -> &'static str;

    /// Get the full CSS class name (with `hi-` prefix)
    fn as_class(&self) -> String {
        format!("hi-{}", self.as_suffix())
    }

    /// Get multiple class names (for compound utilities)
    fn as_classes(&self) -> Vec<String> {
        vec![self.as_class()]
    }
}

/// Builder for constructing class strings
///
/// # Example
///
/// ```ignore
/// use palette::ClassesBuilder;
/// use palette::classes::{Display, FlexDirection};
///
/// let classes = ClassesBuilder::new()
///     .add(Display::Flex)
///     .add(FlexDirection::Row)
///     .build();
/// ```
#[derive(Debug, Clone, Default)]
pub struct ClassesBuilder {
    classes: Vec<String>,
}

impl ClassesBuilder {
    /// Create a new builder
    pub fn new() -> Self {
        Self::default()
    }

    /// Add a single utility class
    #[allow(clippy::should_implement_trait)]
    pub fn add(mut self, class: impl UtilityClass) -> Self {
        for class_str in class.as_classes() {
            self.classes.push(class_str);
        }
        self
    }

    /// Add multiple utility classes
    #[allow(clippy::should_implement_trait)]
    pub fn add_all(mut self, classes: &[impl UtilityClass]) -> Self {
        for class in classes {
            for class_str in class.as_classes() {
                self.classes.push(class_str);
            }
        }
        self
    }

    /// Add a raw class string (for external classes without hi- prefix)
    pub fn add_raw(mut self, class: &str) -> Self {
        self.classes.push(class.to_string());
        self
    }

    /// Conditionally add a utility class based on a boolean condition
    ///
    /// # Arguments
    ///
    /// * `class` - The class to add (must implement UtilityClass)
    /// * `condition` - A closure that returns true if the class should be added
    ///
    /// # Example
    ///
    /// ```ignore
    /// let is_active = true;
    /// let classes = ClassesBuilder::new()
    ///     .add(Display::Flex)
    ///     .add_if(FlexDirection::Row, || is_active)
    ///     .build();
    /// // Output: "hi-flex hi-flex-row" (only if is_active is true)
    /// ```
    pub fn add_if<T: UtilityClass>(mut self, class: T, condition: impl Fn() -> bool) -> Self {
        if condition() {
            for class_str in class.as_classes() {
                self.classes.push(class_str);
            }
        }
        self
    }

    /// Conditionally add a raw class string based on a boolean condition
    ///
    /// # Arguments
    ///
    /// * `class` - The class to add (raw string without hi- prefix)
    /// * `condition` - A closure that returns true if the class should be added
    pub fn add_if_raw(mut self, class: &str, condition: impl Fn() -> bool) -> Self {
        if condition() {
            self.classes.push(class.to_string());
        }
        self
    }

    /// Build the final class string
    pub fn build(self) -> String {
        self.classes.join(" ")
    }

    /// Get the classes as a slice
    pub fn as_slice(&self) -> &[String] {
        &self.classes
    }
}

/// Convenience function to build classes from a slice
///
/// # Example
///
/// ```ignore
/// use palette::build_classes;
/// use palette::classes::{Display, FlexDirection};
///
/// let classes = build_classes(&[Display::Flex, FlexDirection::Row]);
/// // Returns: "hi-flex hi-flex-row"
/// ```
pub fn build_classes(classes: &[impl UtilityClass]) -> String {
    ClassesBuilder::new().add_all(classes).build()
}

/// Helper: Create flex center classes (flex + justify-center + items-center)
///
/// Common pattern for centering content
pub fn flex_center() -> String {
    use crate::classes::{Display, JustifyContent, AlignItems};
    ClassesBuilder::new()
        .add(Display::Flex)
        .add(JustifyContent::Center)
        .add(AlignItems::Center)
        .build()
}

/// Helper: Create flex column center classes
///
/// Common pattern for vertical centering
pub fn flex_col_center() -> String {
    use crate::classes::{Display, FlexDirection, JustifyContent, AlignItems};
    ClassesBuilder::new()
        .add(Display::Flex)
        .add(FlexDirection::Column)
        .add(JustifyContent::Center)
        .add(AlignItems::Center)
        .build()
}

/// Helper: Create card base classes
///
/// Common pattern for card styling
pub fn card_base() -> String {
    use crate::classes::{BgColor, BorderRadius, Padding};
    ClassesBuilder::new()
        .add(BgColor::Surface)
        .add(BorderRadius::Rounded)
        .add(Padding::P4)
        .build()
}

/// Helper: Create button base classes
///
/// Common pattern for button styling
pub fn button_base() -> String {
    use crate::classes::{BorderRadius, PaddingX, Cursor};
    ClassesBuilder::new()
        .add(BorderRadius::Sm)
        .add(PaddingX::Px2)
        .add(Cursor::Pointer)
        .build()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_builder_single() {
        let classes = ClassesBuilder::new().add(Display::Flex).build();

        assert_eq!(classes, "hi-flex");
    }

    #[test]
    fn test_builder_multiple() {
        let classes = ClassesBuilder::new()
            .add(Display::Flex)
            .add(FlexDirection::Row)
            .build();

        assert_eq!(classes, "hi-flex hi-flex-row");
    }

    #[test]
    fn test_builder_raw() {
        let classes = ClassesBuilder::new()
            .add(Display::Flex)
            .add_raw("my-custom-class")
            .build();

        assert_eq!(classes, "hi-flex my-custom-class");
    }
}
