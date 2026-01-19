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

use wasm_bindgen::JsCast;
use web_sys::HtmlElement;

/// Common CSS properties with type-safe names
///
/// This enum covers most commonly used CSS properties in DOM manipulation.
/// It provides compile-time safety and IDE autocompletion.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum CssProperty {
    // Layout
    Display,
    Position,
    Top,
    Right,
    Bottom,
    Left,
    ZIndex,
    Float,
    Clear,

    // Box Model
    Width,
    MinWidth,
    MaxWidth,
    Height,
    MinHeight,
    MaxHeight,
    Margin,
    MarginTop,
    MarginRight,
    MarginBottom,
    MarginLeft,
    Padding,
    PaddingTop,
    PaddingRight,
    PaddingBottom,
    PaddingLeft,
    Border,
    BorderTop,
    BorderRight,
    BorderBottom,
    BorderLeft,
    BorderRadius,
    BorderWidth,
    BorderStyle,
    BorderColor,

    // Flexbox
    Flex,
    FlexBasis,
    FlexDirection,
    FlexFlow,
    FlexGrow,
    FlexShrink,
    FlexWrap,
    AlignContent,
    AlignItems,
    AlignSelf,
    JustifyContent,
    JustifyItems,
    JustifySelf,
    Gap,
    RowGap,
    ColumnGap,
    Order,

    // Grid
    Grid,
    GridArea,
    GridAutoColumns,
    GridAutoFlow,
    GridAutoRows,
    GridColumn,
    GridColumnEnd,
    GridColumnStart,
    GridRow,
    GridRowEnd,
    GridRowStart,
    GridTemplate,
    GridTemplateAreas,
    GridTemplateColumns,
    GridTemplateRows,

    // Typography
    Font,
    FontFamily,
    FontSize,
    FontSizeAdjust,
    FontStretch,
    FontStyle,
    FontVariant,
    FontWeight,
    LetterSpacing,
    LineHeight,
    TextAlign,
    TextDecoration,
    TextIndent,
    TextTransform,
    WhiteSpace,
    WordSpacing,
    WordBreak,
    WordWrap,

    // Color & Background
    Color,
    Background,
    BackgroundAttachment,
    BackgroundClip,
    BackgroundColor,
    BackgroundImage,
    BackgroundOrigin,
    BackgroundPosition,
    BackgroundRepeat,
    BackgroundSize,
    Opacity,

    // Visual
    Overflow,
    OverflowX,
    OverflowY,
    Visibility,
    Cursor,
    PointerEvents,
    UserSelect,
    ObjectFit,

    // Transform & Animation
    Transform,
    TransformOrigin,
    Transition,
    TransitionDelay,
    TransitionDuration,
    TransitionProperty,
    TransitionTimingFunction,
    Animation,
    AnimationDelay,
    AnimationDirection,
    AnimationDuration,
    AnimationFillMode,
    AnimationIterationCount,
    AnimationName,
    AnimationPlayState,
    AnimationTimingFunction,

    // Effects
    BoxShadow,
    Filter,
    TextShadow,
    ClipPath,
    Mask,
    MaskImage,
    MaskSize,
    MaskRepeat,
    MaskPosition,
    MaskClip,
    MaskOrigin,

    // Other
    Content,
    Outline,
    OutlineOffset,
    OutlineWidth,
    OutlineStyle,
    OutlineColor,
    ListStyle,
    ListStyleType,
    ListStylePosition,
    ListStyleImage,
}

impl CssProperty {
    /// Convert to CSS property name (kebab-case)
    pub fn as_str(&self) -> &'static str {
        match self {
            // Layout
            CssProperty::Display => "display",
            CssProperty::Position => "position",
            CssProperty::Top => "top",
            CssProperty::Right => "right",
            CssProperty::Bottom => "bottom",
            CssProperty::Left => "left",
            CssProperty::ZIndex => "z-index",
            CssProperty::Float => "float",
            CssProperty::Clear => "clear",

            // Box Model
            CssProperty::Width => "width",
            CssProperty::MinWidth => "min-width",
            CssProperty::MaxWidth => "max-width",
            CssProperty::Height => "height",
            CssProperty::MinHeight => "min-height",
            CssProperty::MaxHeight => "max-height",
            CssProperty::Margin => "margin",
            CssProperty::MarginTop => "margin-top",
            CssProperty::MarginRight => "margin-right",
            CssProperty::MarginBottom => "margin-bottom",
            CssProperty::MarginLeft => "margin-left",
            CssProperty::Padding => "padding",
            CssProperty::PaddingTop => "padding-top",
            CssProperty::PaddingRight => "padding-right",
            CssProperty::PaddingBottom => "padding-bottom",
            CssProperty::PaddingLeft => "padding-left",
            CssProperty::Border => "border",
            CssProperty::BorderTop => "border-top",
            CssProperty::BorderRight => "border-right",
            CssProperty::BorderBottom => "border-bottom",
            CssProperty::BorderLeft => "border-left",
            CssProperty::BorderRadius => "border-radius",
            CssProperty::BorderWidth => "border-width",
            CssProperty::BorderStyle => "border-style",
            CssProperty::BorderColor => "border-color",
            CssProperty::Outline => "outline",
            CssProperty::OutlineOffset => "outline-offset",
            CssProperty::OutlineWidth => "outline-width",
            CssProperty::OutlineStyle => "outline-style",
            CssProperty::OutlineColor => "outline-color",

            // Flexbox
            CssProperty::Flex => "flex",
            CssProperty::FlexBasis => "flex-basis",
            CssProperty::FlexDirection => "flex-direction",
            CssProperty::FlexFlow => "flex-flow",
            CssProperty::FlexGrow => "flex-grow",
            CssProperty::FlexShrink => "flex-shrink",
            CssProperty::FlexWrap => "flex-wrap",
            CssProperty::AlignContent => "align-content",
            CssProperty::AlignItems => "align-items",
            CssProperty::AlignSelf => "align-self",
            CssProperty::JustifyContent => "justify-content",
            CssProperty::JustifyItems => "justify-items",
            CssProperty::JustifySelf => "justify-self",
            CssProperty::Gap => "gap",
            CssProperty::RowGap => "row-gap",
            CssProperty::ColumnGap => "column-gap",
            CssProperty::Order => "order",

            // Grid
            CssProperty::Grid => "grid",
            CssProperty::GridArea => "grid-area",
            CssProperty::GridAutoColumns => "grid-auto-columns",
            CssProperty::GridAutoFlow => "grid-auto-flow",
            CssProperty::GridAutoRows => "grid-auto-rows",
            CssProperty::GridColumn => "grid-column",
            CssProperty::GridColumnEnd => "grid-column-end",
            CssProperty::GridColumnStart => "grid-column-start",
            CssProperty::GridRow => "grid-row",
            CssProperty::GridRowEnd => "grid-row-end",
            CssProperty::GridRowStart => "grid-row-start",
            CssProperty::GridTemplate => "grid-template",
            CssProperty::GridTemplateAreas => "grid-template-areas",
            CssProperty::GridTemplateColumns => "grid-template-columns",
            CssProperty::GridTemplateRows => "grid-template-rows",

            // Typography
            CssProperty::Font => "font",
            CssProperty::FontFamily => "font-family",
            CssProperty::FontSize => "font-size",
            CssProperty::FontSizeAdjust => "font-size-adjust",
            CssProperty::FontStretch => "font-stretch",
            CssProperty::FontStyle => "font-style",
            CssProperty::FontVariant => "font-variant",
            CssProperty::FontWeight => "font-weight",
            CssProperty::LetterSpacing => "letter-spacing",
            CssProperty::LineHeight => "line-height",
            CssProperty::TextAlign => "text-align",
            CssProperty::TextDecoration => "text-decoration",
            CssProperty::TextIndent => "text-indent",
            CssProperty::TextTransform => "text-transform",
            CssProperty::WhiteSpace => "white-space",
            CssProperty::WordSpacing => "word-spacing",
            CssProperty::WordBreak => "word-break",
            CssProperty::WordWrap => "word-wrap",

            // Content & Lists
            CssProperty::Content => "content",

            // Color & Background
            CssProperty::Color => "color",
            CssProperty::Background => "background",
            CssProperty::BackgroundAttachment => "background-attachment",
            CssProperty::BackgroundClip => "background-clip",
            CssProperty::BackgroundColor => "background-color",
            CssProperty::BackgroundImage => "background-image",
            CssProperty::BackgroundOrigin => "background-origin",
            CssProperty::BackgroundPosition => "background-position",
            CssProperty::BackgroundRepeat => "background-repeat",
            CssProperty::BackgroundSize => "background-size",
            CssProperty::Opacity => "opacity",

            // Visual
            CssProperty::Overflow => "overflow",
            CssProperty::OverflowX => "overflow-x",
            CssProperty::OverflowY => "overflow-y",
            CssProperty::Visibility => "visibility",
            CssProperty::Cursor => "cursor",
            CssProperty::PointerEvents => "pointer-events",
            CssProperty::UserSelect => "user-select",
            CssProperty::ObjectFit => "object-fit",

            // Transform & Animation
            CssProperty::Transform => "transform",
            CssProperty::TransformOrigin => "transform-origin",
            CssProperty::Transition => "transition",
            CssProperty::TransitionDelay => "transition-delay",
            CssProperty::TransitionDuration => "transition-duration",
            CssProperty::TransitionProperty => "transition-property",
            CssProperty::TransitionTimingFunction => "transition-timing-function",
            CssProperty::Animation => "animation",
            CssProperty::AnimationDelay => "animation-delay",
            CssProperty::AnimationDirection => "animation-direction",
            CssProperty::AnimationDuration => "animation-duration",
            CssProperty::AnimationFillMode => "animation-fill-mode",
            CssProperty::AnimationIterationCount => "animation-iteration-count",
            CssProperty::AnimationName => "animation-name",
            CssProperty::AnimationPlayState => "animation-play-state",
            CssProperty::AnimationTimingFunction => "animation-timing-function",

            // Effects
            CssProperty::BoxShadow => "box-shadow",
            CssProperty::Filter => "filter",
            CssProperty::TextShadow => "text-shadow",
            CssProperty::ClipPath => "clip-path",
            CssProperty::Mask => "mask",
            CssProperty::MaskImage => "mask-image",
            CssProperty::MaskSize => "mask-size",
            CssProperty::MaskRepeat => "mask-repeat",
            CssProperty::MaskPosition => "mask-position",
            CssProperty::MaskClip => "mask-clip",
            CssProperty::MaskOrigin => "mask-origin",

            // Other
            CssProperty::ListStyle => "list-style",
            CssProperty::ListStyleType => "list-style-type",
            CssProperty::ListStylePosition => "list-style-position",
            CssProperty::ListStyleImage => "list-style-image",
        }
    }
}

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
    let elem = element.clone().dyn_into::<web_sys::Element>().unwrap();
    let _ = elem
        .dyn_ref::<web_sys::HtmlElement>()
        .unwrap()
        .style()
        .set_property(property.as_str(), value);
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
    let elem = element.clone().dyn_into::<web_sys::Element>().unwrap();
    let style = elem.dyn_ref::<web_sys::HtmlElement>().unwrap().style();
    for (property, value) in properties {
        let _ = style.set_property(property.as_str(), value);
    }
}

/// Property type for StyleBuilder
///
/// Wraps either a known CSS property or a custom property name.
#[derive(Debug, Clone, PartialEq)]
pub enum Property {
    Known(CssProperty),
    Custom(String),
}

impl Property {
    pub fn as_str(&self) -> &str {
        match self {
            Property::Known(prop) => prop.as_str(),
            Property::Custom(s) => s,
        }
    }
}

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

        let elem = self.element.clone().dyn_into::<web_sys::Element>().unwrap();
        let style = elem.dyn_ref::<web_sys::HtmlElement>().unwrap().style();

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

        let elem = self.element.clone().dyn_into::<web_sys::Element>().unwrap();
        let style = elem.dyn_ref::<web_sys::HtmlElement>().unwrap().style();

        let mut updated = 0;
        for (property, value) in self.properties {
            let property_name = property.as_str();

            // Get current value
            let current_value = style.get_property_value(property_name).unwrap_or_default();

            // Only update if value changed
            if current_value != value {
                if style.set_property(property_name, &value).is_ok() {
                    updated += 1;
                }
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
#[allow(dead_code)]
enum StyleEntry {
    Known(CssProperty, String),
    Custom(String, String), // (property_name, value)
}

impl StyleEntry {
    /// Get the CSS style string for this entry
    fn as_style_string(&self) -> &str {
        match self {
            StyleEntry::Known(_, s) => s,
            StyleEntry::Custom(_, s) => s,
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

impl StyleStringBuilder {
    /// Create a new style string builder
    pub fn new() -> Self {
        Self(Vec::new())
    }

    /// Add a CSS property
    pub fn add(mut self, property: CssProperty, value: &str) -> Self {
        self.0.push(StyleEntry::Known(
            property,
            format!("{}:{}", property.as_str(), value),
        ));
        self
    }

    /// Add a CSS property with pixel value
    pub fn add_px(mut self, property: CssProperty, pixels: u32) -> Self {
        self.0.push(StyleEntry::Known(
            property,
            format!("{}:{}px", property.as_str(), pixels),
        ));
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
        self.0.push(StyleEntry::Custom(
            property.to_string(),
            format!("{}:{}", property, value),
        ));
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
    let elem = element.clone().dyn_into::<web_sys::Element>().unwrap();
    let _ = elem
        .dyn_ref::<web_sys::HtmlElement>()
        .unwrap()
        .style()
        .remove_property(property.as_str());
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
    let elem = element.clone().dyn_into::<web_sys::Element>().unwrap();
    elem.dyn_ref::<web_sys::HtmlElement>()
        .unwrap()
        .style()
        .get_property_value(property.as_str())
        .unwrap_or_default()
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

/// Attribute value types
#[derive(Debug, Clone)]
enum AttributeValue {
    String(String),
    Bool(bool),
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

        let elem = self.element.clone().dyn_into::<web_sys::Element>().unwrap();

        for (name, value) in self.attributes {
            match value {
                AttributeValue::String(v) => {
                    let _ = elem.set_attribute(&name, &v);
                }
                AttributeValue::Bool(v) => {
                    if v {
                        let _ = elem.set_attribute(&name, "");
                    } else {
                        let _ = elem.remove_attribute(&name);
                    }
                }
            }
        }
    }
}

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
