//! CSS property definitions

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
