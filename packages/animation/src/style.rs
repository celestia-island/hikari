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
/// This enum covers the most commonly used CSS properties in DOM manipulation.
/// It provides compile-time safety and IDE autocompletion.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
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
    fn as_str(&self) -> &'static str {
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
            CssProperty::Content => "content",
            CssProperty::Outline => "outline",
            CssProperty::OutlineOffset => "outline-offset",
            CssProperty::OutlineWidth => "outline-width",
            CssProperty::OutlineStyle => "outline-style",
            CssProperty::OutlineColor => "outline-color",
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
    properties: Vec<(CssProperty, String)>,
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
        self.properties.push((property, value.to_string()));
        self
    }

    /// Add multiple CSS properties at once
    pub fn add_all(mut self, properties: &[(CssProperty, &str)]) -> Self {
        for &(property, value) in properties {
            self.properties.push((property, value.to_string()));
        }
        self
    }

    /// Apply all accumulated properties to the element
    pub fn apply(self) {
        let elem = self.element.clone().dyn_into::<web_sys::Element>().unwrap();
        let style = elem.dyn_ref::<web_sys::HtmlElement>().unwrap().style();
        for (property, value) in self.properties {
            let _ = style.set_property(property.as_str(), &value);
        }
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
/// The computed value of the property, or an empty string if it fails
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
}
