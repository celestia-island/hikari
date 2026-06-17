//! Helper functions for CSS property manipulation
//!
//! Note: These functions are maintained for backward compatibility.
//! New code should use the Platform trait directly.

use std::cell::RefCell;
use std::rc::Rc;

use tairitsu_vdom::Platform;

use super::CssProperty;

/// Set a single CSS property on an element
///
/// # Arguments
///
/// * `platform` - Platform reference for DOM operations
/// * `element` - The element to modify
/// * `property` - The CSS property to set
/// * `value` - The value to set the property to
///
/// # Example
///
/// ```ignore
/// set_style(&platform, &element, CssProperty::Width, "100px");
/// set_style(&platform, &element, CssProperty::Display, "flex");
/// ```
pub fn set_style<P: Platform>(
    platform: &Rc<RefCell<P>>,
    element: &P::Element,
    property: CssProperty,
    value: &str,
) {
    platform
        .borrow_mut()
        .set_style(element, property.as_str(), value);
}

/// Set multiple CSS properties on an element at once
///
/// This is more efficient than calling `set_style` multiple times
/// as it minimizes DOM access overhead.
///
/// # Arguments
///
/// * `platform` - Platform reference for DOM operations
/// * `element` - The element to modify
/// * `properties` - Slice of (property, value) tuples
///
/// # Example
///
/// ```ignore
/// set_styles(&platform, &element, &[
///     (CssProperty::Display, "flex"),
///     (CssProperty::FlexDirection, "column"),
///     (CssProperty::Gap, "1rem"),
/// ]);
/// ```
pub fn set_styles<P: Platform>(
    platform: &Rc<RefCell<P>>,
    element: &P::Element,
    properties: &[(CssProperty, &str)],
) {
    for (property, value) in properties {
        platform
            .borrow_mut()
            .set_style(element, property.as_str(), value);
    }
}

/// Remove a CSS property from an element
///
/// Note: In WIT environments, removing a style property means
/// setting it to an empty string.
///
/// # Arguments
///
/// * `platform` - Platform reference for DOM operations
/// * `element` - The element to modify
/// * `property` - The CSS property to remove
///
/// # Example
///
/// ```ignore
/// remove_style(&platform, &element, CssProperty::Width);
/// ```
pub fn remove_style<P: Platform>(
    platform: &Rc<RefCell<P>>,
    element: &P::Element,
    property: CssProperty,
) {
    platform
        .borrow_mut()
        .set_style(element, property.as_str(), "");
}

/// Get the computed value of a CSS property
///
/// Note: In WIT environments, getting computed styles is not directly
/// supported. This function returns an empty string.
///
/// # Arguments
///
/// * `_platform` - Platform reference (unused in WIT)
/// * `_element` - The element to query
/// * `_property` - The CSS property to get
///
/// # Returns
///
/// An empty string (computed styles not available in WIT)
///
/// # Example
///
/// ```ignore
/// let width = get_style(&platform, &element, CssProperty::Width);
/// ```
pub const fn get_style<P: Platform>(
    _platform: &Rc<RefCell<P>>,
    _element: &P::Element,
    _property: CssProperty,
) -> String {
    // WIT interface doesn't provide getComputedStyle
    // This would need to be added to the WIT interface
    String::new()
}
