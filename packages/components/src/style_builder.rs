//! Simple inline style builder that doesn't require WASM dependencies.
//!
//! This is a lightweight replacement for hikari_animation::style that can be used
//! in non-WASM builds.

/// CSS property names for type-safe style building
#[derive(Debug, Clone, Copy)]
pub enum CssProperty {
    Width,
    Height,
    MinWidth,
    MaxWidth,
    MinHeight,
    MaxHeight,
    BorderRadius,
    BorderTopLeftRadius,
    BorderTopRightRadius,
    BorderBottomLeftRadius,
    BorderBottomRightRadius,
    Display,
    AlignItems,
    JustifyContent,
    Overflow,
    Position,
    Top,
    Left,
    Right,
    Bottom,
    ZIndex,
    Padding,
    PaddingTop,
    PaddingRight,
    PaddingBottom,
    PaddingLeft,
    Margin,
    MarginTop,
    MarginRight,
    MarginBottom,
    MarginLeft,
    FontSize,
    FontWeight,
    Color,
    Background,
    BackgroundColor,
    BackgroundImage,
    BackgroundSize,
    BackgroundPosition,
    BackgroundRepeat,
    Opacity,
    Transform,
    Transition,
    BoxShadow,
    Border,
    BorderWidth,
    BorderStyle,
    BorderColor,
    Cursor,
    Visibility,
    FlexDirection,
    FlexWrap,
    Gap,
    RowGap,
    ColumnGap,
    Flex,
    FlexGrow,
    FlexShrink,
    FlexBasis,
    TextAlign,
    TextDecoration,
    LineHeight,
    LetterSpacing,
    WordBreak,
    WhiteSpace,
    PointerEvents,
    UserSelect,
    Outline,
    Stroke,
    StrokeWidth,
    StrokeDasharray,
    StrokeDashoffset,
    Fill,
    Animation,
    Filter,
    ClipPath,
}

impl CssProperty {
    /// Convert to CSS property name
    pub fn as_str(&self) -> &'static str {
        match self {
            CssProperty::Width => "width",
            CssProperty::Height => "height",
            CssProperty::MinWidth => "min-width",
            CssProperty::MaxWidth => "max-width",
            CssProperty::MinHeight => "min-height",
            CssProperty::MaxHeight => "max-height",
            CssProperty::BorderRadius => "border-radius",
            CssProperty::BorderTopLeftRadius => "border-top-left-radius",
            CssProperty::BorderTopRightRadius => "border-top-right-radius",
            CssProperty::BorderBottomLeftRadius => "border-bottom-left-radius",
            CssProperty::BorderBottomRightRadius => "border-bottom-right-radius",
            CssProperty::Display => "display",
            CssProperty::AlignItems => "align-items",
            CssProperty::JustifyContent => "justify-content",
            CssProperty::Overflow => "overflow",
            CssProperty::Position => "position",
            CssProperty::Top => "top",
            CssProperty::Left => "left",
            CssProperty::Right => "right",
            CssProperty::Bottom => "bottom",
            CssProperty::ZIndex => "z-index",
            CssProperty::Padding => "padding",
            CssProperty::PaddingTop => "padding-top",
            CssProperty::PaddingRight => "padding-right",
            CssProperty::PaddingBottom => "padding-bottom",
            CssProperty::PaddingLeft => "padding-left",
            CssProperty::Margin => "margin",
            CssProperty::MarginTop => "margin-top",
            CssProperty::MarginRight => "margin-right",
            CssProperty::MarginBottom => "margin-bottom",
            CssProperty::MarginLeft => "margin-left",
            CssProperty::FontSize => "font-size",
            CssProperty::FontWeight => "font-weight",
            CssProperty::Color => "color",
            CssProperty::Background => "background",
            CssProperty::BackgroundColor => "background-color",
            CssProperty::BackgroundImage => "background-image",
            CssProperty::BackgroundSize => "background-size",
            CssProperty::BackgroundPosition => "background-position",
            CssProperty::BackgroundRepeat => "background-repeat",
            CssProperty::Opacity => "opacity",
            CssProperty::Transform => "transform",
            CssProperty::Transition => "transition",
            CssProperty::BoxShadow => "box-shadow",
            CssProperty::Border => "border",
            CssProperty::BorderWidth => "border-width",
            CssProperty::BorderStyle => "border-style",
            CssProperty::BorderColor => "border-color",
            CssProperty::Cursor => "cursor",
            CssProperty::Visibility => "visibility",
            CssProperty::FlexDirection => "flex-direction",
            CssProperty::FlexWrap => "flex-wrap",
            CssProperty::Gap => "gap",
            CssProperty::RowGap => "row-gap",
            CssProperty::ColumnGap => "column-gap",
            CssProperty::Flex => "flex",
            CssProperty::FlexGrow => "flex-grow",
            CssProperty::FlexShrink => "flex-shrink",
            CssProperty::FlexBasis => "flex-basis",
            CssProperty::TextAlign => "text-align",
            CssProperty::TextDecoration => "text-decoration",
            CssProperty::LineHeight => "line-height",
            CssProperty::LetterSpacing => "letter-spacing",
            CssProperty::WordBreak => "word-break",
            CssProperty::WhiteSpace => "white-space",
            CssProperty::PointerEvents => "pointer-events",
            CssProperty::UserSelect => "user-select",
            CssProperty::Outline => "outline",
            CssProperty::Stroke => "stroke",
            CssProperty::StrokeWidth => "stroke-width",
            CssProperty::StrokeDasharray => "stroke-dasharray",
            CssProperty::StrokeDashoffset => "stroke-dashoffset",
            CssProperty::Fill => "fill",
            CssProperty::Animation => "animation",
            CssProperty::Filter => "filter",
            CssProperty::ClipPath => "clip-path",
        }
    }
}

/// A simple CSS style string builder
#[derive(Debug, Clone, Default)]
pub struct StyleStringBuilder {
    styles: Vec<(String, String)>,
}

impl StyleStringBuilder {
    /// Create a new empty style builder
    pub fn new() -> Self {
        Self::default()
    }

    /// Add a CSS property with a string value
    pub fn add(mut self, property: CssProperty, value: impl Into<String>) -> Self {
        self.styles.push((property.as_str().to_string(), value.into()));
        self
    }

    /// Add a CSS property with a pixel value
    pub fn add_px(self, property: CssProperty, value: impl Into<String>) -> Self {
        self.add(property, format!("{}px", value.into()))
    }

    /// Add a CSS property with a percentage value
    pub fn add_percent(self, property: CssProperty, value: impl Into<String>) -> Self {
        self.add(property, format!("{}%", value.into()))
    }

    /// Add a raw style string (property: value)
    pub fn add_raw(mut self, style: impl Into<String>) -> Self {
        let style = style.into();
        if let Some((prop, val)) = style.split_once(':') {
            self.styles.push((prop.trim().to_string(), val.trim().to_string()));
        }
        self
    }

    /// Build the final CSS string
    pub fn build(self) -> String {
        self.styles
            .iter()
            .map(|(prop, val)| format!("{}: {}", prop, val))
            .collect::<Vec<_>>()
            .join("; ")
    }

    /// Build and return a clean string (semicolon-terminated)
    pub fn build_clean(self) -> String {
        let result = self.build();
        if result.is_empty() {
            result
        } else {
            format!("{};", result)
        }
    }
}

/// Type alias for compatibility
pub type StyleBuilder = StyleStringBuilder;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_style_builder() {
        let style = StyleStringBuilder::new()
            .add_px(CssProperty::Width, 100)
            .add(CssProperty::Display, "flex")
            .build();
        assert_eq!(style, "width: 100px; display: flex");
    }
}
