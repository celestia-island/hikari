//! Helper functions for CSS property manipulation

use web_sys::HtmlElement;

use super::CssProperty;

/// Set a single CSS property on an element
///
/// # Arguments
///
/// * `element` - The HTML element to modify
/// * `property` - The CSS property to set
/// * `value` - The value to set the property to
///
/// # Example
///
/// ```ignore
/// set_style(&element, CssProperty::Width, "100px");
/// set_style(&element, CssProperty::Display, "flex");
/// ```
pub fn set_style(element: &HtmlElement, property: CssProperty, value: &str) {
    let _ = element.style().set_property(property.as_str(), value);
}

/// Set multiple CSS properties on an element at once
///
/// This is more efficient than calling `set_style` multiple times
/// as it minimizes DOM access overhead.
///
/// # Arguments
///
/// * `element` - The HTML element to modify
/// * `properties` - Slice of (property, value) tuples
///
/// # Example
///
/// ```ignore
/// set_styles(&element, &[
///     (CssProperty::Display, "flex"),
///     (CssProperty::FlexDirection, "column"),
///     (CssProperty::Gap, "1rem"),
/// ]);
/// ```
pub fn set_styles(element: &HtmlElement, properties: &[(CssProperty, &str)]) {
    let style = element.style();
    for (property, value) in properties {
        let _ = style.set_property(property.as_str(), value);
    }
}

/// Remove a CSS property from an element
///
/// # Arguments
///
/// * `element` - The HTML element to modify
/// * `property` - The CSS property to remove
///
/// # Example
///
/// ```ignore
/// remove_style(&element, CssProperty::Width);
/// ```
pub fn remove_style(element: &HtmlElement, property: CssProperty) {
    let _ = element.style().remove_property(property.as_str());
}

/// Get the computed value of a CSS property
///
/// # Arguments
///
/// * `element` - The HTML element to query
/// * `property` - The CSS property to get
///
/// # Returns
///
/// The computed value of property, or an empty string if it fails
///
/// # Example
///
/// ```ignore
/// let width = get_style(&element, CssProperty::Width);
/// ```
pub fn get_style(element: &HtmlElement, property: CssProperty) -> String {
    element
        .style()
        .get_property_value(property.as_str())
        .unwrap_or_default()
}
