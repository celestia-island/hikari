//! Style and attribute builders for DOM manipulation
//!
//! Note: These builders are maintained for backward compatibility.
//! New code should use the Platform trait directly or the
//! AnimationBuilder for complex animations.

use std::cell::RefCell;
use std::rc::Rc;
use tairitsu_vdom::Platform;

use super::{CssProperty, Property, StyleStringBuilder};

/// Builder for applying multiple CSS properties atomically
///
/// Provides a fluent interface for setting multiple styles at once
/// using the Platform trait.
///
/// # Example
///
/// ```ignore
/// StyleBuilder::new(&platform, &element)
///     .add(CssProperty::Position, "relative")
///     .add(CssProperty::Top, "0")
///     .add(CssProperty::Left, "0")
///     .apply();
/// ```
pub struct StyleBuilder<'a, P: Platform> {
    platform: &'a Rc<RefCell<P>>,
    element: &'a P::Element,
    properties: Vec<(Property, String)>,
}

impl<'a, P: Platform> Clone for StyleBuilder<'a, P> {
    fn clone(&self) -> Self {
        Self {
            platform: self.platform,
            element: self.element,
            properties: self.properties.clone(),
        }
    }
}

impl<'a, P: Platform> StyleBuilder<'a, P> {
    /// Create a new StyleBuilder for the given element
    pub fn new(platform: &'a Rc<RefCell<P>>, element: &'a P::Element) -> Self {
        Self {
            platform,
            element,
            properties: Vec::new(),
        }
    }

    /// Add a CSS property to be set
    pub fn add(mut self, property: CssProperty, value: &str) -> Self {
        self.properties
            .push((Property::Known(property), value.to_string()));
        self
    }

    /// Add a custom CSS property (e.g., CSS variables like --my-var)
    pub fn add_custom(mut self, property: &str, value: &str) -> Self {
        self.properties
            .push((Property::Custom(property.to_string()), value.to_string()));
        self
    }

    /// Add a CSS property with pixel value
    pub fn add_px(mut self, property: CssProperty, pixels: u32) -> Self {
        self.properties
            .push((Property::Known(property), format!("{}px", pixels)));
        self
    }

    /// Add multiple CSS properties at once
    pub fn add_all(mut self, properties: &[(CssProperty, &str)]) -> Self {
        for &(property, value) in properties {
            self.properties
                .push((Property::Known(property), value.to_string()));
        }
        self
    }

    /// Apply all accumulated properties to the element
    ///
    /// **Optimized**: Uses batch updates to minimize DOM access.
    /// All properties are set in a single pass.
    pub fn apply(self) {
        if self.properties.is_empty() {
            return;
        }

        // Batch update all properties to minimize DOM access
        for (property, value) in self.properties {
            self.platform
                .borrow_mut()
                .set_style(self.element, property.as_str(), &value);
        }
    }

    /// Build the style as a CSS string (for Dioxus style attribute)
    ///
    /// Uses the tairitsu_style::StyleStringBuilder internally.
    ///
    /// # Example
    ///
    /// ```ignore
    /// let style = StyleBuilder::build_string(|builder| {
    ///     builder.add(CssProperty::Width, "100px")
    ///            .add(CssProperty::Height, "50px")
    /// });
    /// // Returns: "width:100px;height:50px"
    /// ```
    pub fn build_string<F>(f: F) -> String
    where
        F: FnOnce(StyleStringBuilder) -> StyleStringBuilder,
    {
        f(StyleStringBuilder::new()).build()
    }

    /// Build the style as a clean CSS string (without trailing semicolons)
    pub fn build_clean<F>(f: F) -> String
    where
        F: FnOnce(StyleStringBuilder) -> StyleStringBuilder,
    {
        f(StyleStringBuilder::new()).build_clean()
    }
}

/// Attribute value types
#[derive(Debug, Clone)]
enum AttributeValue {
    String(String),
    Bool(bool),
}

/// Builder for applying multiple HTML attributes atomically
///
/// Provides a fluent interface for setting multiple attributes at once.
/// This is a type-safe alternative to direct DOM manipulation.
///
/// # Example
///
/// ```ignore
/// AttributeBuilder::new(&platform, &element)
///     .add("data-id", "123")
///     .add("aria-label", "Close button")
///     .add_bool("disabled", true)
///     .apply();
/// ```
pub struct AttributeBuilder<'a, P: Platform> {
    platform: &'a Rc<RefCell<P>>,
    element: &'a P::Element,
    attributes: Vec<(String, AttributeValue)>,
}

impl<'a, P: Platform> Clone for AttributeBuilder<'a, P> {
    fn clone(&self) -> Self {
        Self {
            platform: self.platform,
            element: self.element,
            attributes: self.attributes.clone(),
        }
    }
}

impl<'a, P: Platform> AttributeBuilder<'a, P> {
    /// Create a new AttributeBuilder for given element
    pub fn new(platform: &'a Rc<RefCell<P>>, element: &'a P::Element) -> Self {
        Self {
            platform,
            element,
            attributes: Vec::new(),
        }
    }

    /// Add an HTML attribute
    ///
    /// # Example
    ///
    /// ```ignore
    /// AttributeBuilder::new(&platform, &element)
    ///     .add("data-id", "123")
    ///     .add("aria-label", "Close");
    /// ```
    pub fn add(mut self, name: &str, value: &str) -> Self {
        self.attributes
            .push((name.to_string(), AttributeValue::String(value.to_string())));
        self
    }

    /// Add a boolean attribute (true adds it, false removes it)
    ///
    /// # Example
    ///
    /// ```ignore
    /// AttributeBuilder::new(&platform, &element)
    ///     .add_bool("disabled", true)
    ///     .add_bool("checked", false);
    /// ```
    pub fn add_bool(mut self, name: &str, value: bool) -> Self {
        self.attributes
            .push((name.to_string(), AttributeValue::Bool(value)));
        self
    }

    /// Add a data-* attribute (e.g., data-custom-scrollbar)
    ///
    /// # Example
    ///
    /// ```ignore
    /// AttributeBuilder::new(&platform, &element)
    ///     .add_data("custom-scrollbar", "wrapper")
    ///     .add_data("id", "123");
    /// ```
    pub fn add_data(self, name: &str, value: &str) -> Self {
        self.add(&format!("data-{}", name), value)
    }

    /// Apply all accumulated attributes to element
    ///
    /// **Optimized**: Batches all attribute updates in a single pass.
    pub fn apply(self) {
        if self.attributes.is_empty() {
            return;
        }

        for (name, value) in self.attributes {
            match value {
                AttributeValue::String(v) => {
                    self.platform
                        .borrow_mut()
                        .set_attribute(self.element, &name, &v);
                }
                AttributeValue::Bool(v) => {
                    if v {
                        self.platform
                            .borrow_mut()
                            .set_attribute(self.element, &name, "");
                    } else {
                        self.platform
                            .borrow_mut()
                            .remove_attribute(self.element, &name);
                    }
                }
            }
        }
    }
}
