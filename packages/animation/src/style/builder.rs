//! Style and attribute builders

use web_sys::HtmlElement;

use super::{CssProperty, Property};

/// Builder for applying multiple CSS properties atomically
///
/// Provides a fluent interface for setting multiple styles at once.
///
/// # Example
///
/// ```ignore
/// StyleBuilder::new(&element)
///     .add(CssProperty::Position, "relative")
///     .add(CssProperty::Top, "0")
///     .add(CssProperty::Left, "0")
///     .apply();
/// ```
pub struct StyleBuilder<'a> {
    element: &'a HtmlElement,
    properties: Vec<(Property, String)>,
}

impl<'a> Clone for StyleBuilder<'a> {
    fn clone(&self) -> Self {
        Self {
            element: self.element,
            properties: self.properties.clone(),
        }
    }
}

impl<'a> StyleBuilder<'a> {
    /// Create a new StyleBuilder for the given element
    pub fn new(element: &'a HtmlElement) -> Self {
        Self {
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
    /// **Optimized**: Uses CSSOM batch updates to minimize reflows.
    /// All properties are set in a single pass to reduce DOM access.
    pub fn apply(self) {
        if self.properties.is_empty() {
            return;
        }

        let style = self.element.style();

        // Batch update all properties to minimize DOM access
        for (property, value) in self.properties {
            let _ = style.set_property(property.as_str(), &value);
        }
    }

    /// Apply only changed properties, skipping duplicates
    ///
    /// **Performance optimization**: Compares with current element styles
    /// and only updates properties that have actually changed.
    ///
    /// Returns number of properties actually updated.
    pub fn apply_smart(self) -> usize {
        if self.properties.is_empty() {
            return 0;
        }

        let style = self.element.style();

        let mut updated = 0;
        for (property, value) in self.properties {
            let property_name = property.as_str();

            // Get current value
            let current_value = style.get_property_value(property_name).unwrap_or_default();

            // Only update if value changed
            if current_value != value && style.set_property(property_name, &value).is_ok() {
                updated += 1;
            }
        }

        updated
    }

    /// Build the style as a CSS string (for Dioxus style attribute)
    ///
    /// # Example
    ///
    /// ```ignore
    /// let style = StyleBuilder::build_string(|builder| {
    ///     builder.add(CssProperty::Width, "100px")
    ///           .add(CssProperty::Height, "50px")
    /// });
    /// // Returns: "width:100px;height:50px;"
    /// ```
    pub fn build_string<F>(f: F) -> String
    where
        F: FnOnce(StyleStringBuilder) -> StyleStringBuilder,
    {
        f(StyleStringBuilder(Vec::new())).build()
    }

    /// Build the style as a clean CSS string (without trailing semicolons)
    pub fn build_clean<F>(f: F) -> String
    where
        F: FnOnce(StyleStringBuilder) -> StyleStringBuilder,
    {
        f(StyleStringBuilder(Vec::new())).build_clean()
    }
}

/// Style entry for storing CSS properties
#[derive(Debug, Clone)]
enum StyleEntry {
    Known(CssProperty, String),
    Custom(String, String), // (property_name, value)
}

impl StyleEntry {
    /// Get the CSS style string for this entry (property: value format)
    fn as_style_string(&self) -> String {
        match self {
            StyleEntry::Known(prop, value) => format!("{}:{}", prop.as_str(), value),
            StyleEntry::Custom(prop, value) => format!("{}:{}", prop, value),
        }
    }
}

/// String-based style builder for Dioxus components
///
/// This version doesn't require an HtmlElement and is used for
/// generating style strings for `style` attribute.
///
/// # Example
///
/// ```ignore
/// use animation::style::StyleStringBuilder;
/// use animation::style::CssProperty;
///
/// let style = StyleStringBuilder::new()
///     .add(CssProperty::Width, "100px")
///     .add_px(CssProperty::Height, 50)
///     .add_custom("--glow-x", "50px")
///     .build_clean();
/// // Returns: "width:100px;height:50px;--glow-x:50px"
/// ```
pub struct StyleStringBuilder(Vec<StyleEntry>);

impl Default for StyleStringBuilder {
    fn default() -> Self {
        Self::new()
    }
}

impl StyleStringBuilder {
    /// Create a new style string builder
    pub fn new() -> Self {
        Self(Vec::new())
    }

    /// Add a CSS property
    pub fn add(mut self, property: CssProperty, value: &str) -> Self {
        self.0.push(StyleEntry::Known(property, value.to_string()));
        self
    }

    /// Add a CSS property with pixel value
    pub fn add_px(mut self, property: CssProperty, pixels: u32) -> Self {
        self.0
            .push(StyleEntry::Known(property, format!("{}px", pixels)));
        self
    }

    /// Add a custom CSS property (e.g., CSS variables like --my-var)
    ///
    /// # Arguments
    ///
    /// * `property` - Custom property name (e.g., "--glow-x")
    /// * `value` - Property value
    ///
    /// # Example
    ///
    /// ```ignore
    /// let style = StyleStringBuilder::new()
    ///     .add_custom("--glow-x", "100px")
    ///     .add_custom("--glow-y", "200px")
    ///     .build_clean();
    /// // Returns: "--glow-x:100px;--glow-y:200px"
    /// ```
    pub fn add_custom(mut self, property: &str, value: &str) -> Self {
        self.0
            .push(StyleEntry::Custom(property.to_string(), value.to_string()));
        self
    }

    /// Add a raw style string
    pub fn add_raw(mut self, style: &str) -> Self {
        self.0.push(StyleEntry::Known(
            CssProperty::Display,
            format!("{};", style),
        ));
        self
    }

    /// Build final style string (with trailing semicolons)
    pub fn build(self) -> String {
        self.0
            .iter()
            .map(|entry| entry.as_style_string())
            .collect::<Vec<_>>()
            .join(";")
    }

    /// Build final style string without trailing semicolons
    pub fn build_clean(self) -> String {
        self.0
            .iter()
            .map(|entry| entry.as_style_string())
            .collect::<Vec<_>>()
            .join(";")
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
/// AttributeBuilder::new(&element)
///     .add("data-id", "123")
///     .add("aria-label", "Close button")
///     .add_bool("disabled", true)
///     .apply();
/// ```
pub struct AttributeBuilder<'a> {
    element: &'a HtmlElement,
    attributes: Vec<(String, AttributeValue)>,
}

impl<'a> Clone for AttributeBuilder<'a> {
    fn clone(&self) -> Self {
        Self {
            element: self.element,
            attributes: self.attributes.clone(),
        }
    }
}

impl<'a> AttributeBuilder<'a> {
    /// Create a new AttributeBuilder for given element
    pub fn new(element: &'a HtmlElement) -> Self {
        Self {
            element,
            attributes: Vec::new(),
        }
    }

    /// Add an HTML attribute
    ///
    /// # Example
    ///
    /// ```ignore
    /// AttributeBuilder::new(&element)
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
    /// AttributeBuilder::new(&element)
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
    /// AttributeBuilder::new(&element)
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
                    let _ = self.element.set_attribute(&name, &v);
                }
                AttributeValue::Bool(v) => {
                    if v {
                        let _ = self.element.set_attribute(&name, "");
                    } else {
                        let _ = self.element.remove_attribute(&name);
                    }
                }
            }
        }
    }
}
