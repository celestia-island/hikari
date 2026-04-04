//! Display component classes (Card, Badge, Tag, etc.)

use tairitsu_style::TypedClass;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CardClass {
    Card,
    CardHoverable,
    CardBordered,
    CardFlat,
    CardHeader,
    CardHeaderLeft,
    CardHeaderAvatar,
    CardHeaderAction,
    CardTitle,
    CardSubtitle,
    CardExtra,
    CardBody,
    CardFooter,
    CardMedia,
    CardCover,
    CardActions,
    CardActionsNoSpacing,
    CardSpotlightWrapper,
    // Size variants
    CardSm,
    CardMd,
    CardLg,
    // Grid variants
    CardGrid,
    CardGrid2,
    CardGrid3,
    CardGrid4,
    // States
    CardLoading,
    CardGlow,
    // Animations
    CardAnimateIn,
    CardStagger,
}

impl TypedClass for CardClass {
    fn class_name(&self) -> &'static str {
        match self {
            CardClass::Card => "hi-card",
            CardClass::CardHoverable => "hi-card-hoverable",
            CardClass::CardBordered => "hi-card-bordered",
            CardClass::CardFlat => "hi-card-flat",
            CardClass::CardHeader => "hi-card-header",
            CardClass::CardHeaderLeft => "hi-card-header-left",
            CardClass::CardHeaderAvatar => "hi-card-header-avatar",
            CardClass::CardHeaderAction => "hi-card-header-action",
            CardClass::CardTitle => "hi-card-title",
            CardClass::CardSubtitle => "hi-card-subtitle",
            CardClass::CardExtra => "hi-card-extra",
            CardClass::CardBody => "hi-card-body",
            CardClass::CardFooter => "hi-card-footer",
            CardClass::CardMedia => "hi-card-media",
            CardClass::CardCover => "hi-card-cover",
            CardClass::CardActions => "hi-card-actions",
            CardClass::CardActionsNoSpacing => "hi-card-actions-no-spacing",
            CardClass::CardSpotlightWrapper => "hi-card-spotlight-wrapper",
            CardClass::CardSm => "hi-card-sm",
            CardClass::CardMd => "hi-card-md",
            CardClass::CardLg => "hi-card-lg",
            CardClass::CardGrid => "hi-card-grid",
            CardClass::CardGrid2 => "hi-card-grid-2",
            CardClass::CardGrid3 => "hi-card-grid-3",
            CardClass::CardGrid4 => "hi-card-grid-4",
            CardClass::CardLoading => "hi-card-loading",
            CardClass::CardGlow => "hi-card-glow",
            CardClass::CardAnimateIn => "hi-card-animate-in",
            CardClass::CardStagger => "hi-card-stagger",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SpotlightClass {
    Spotlight,
    SpotlightWrapper,
    SpotlightAuto,
    SpotlightTheme,
}

impl TypedClass for SpotlightClass {
    fn class_name(&self) -> &'static str {
        match self {
            SpotlightClass::Spotlight => "hi-spotlight",
            SpotlightClass::SpotlightWrapper => "hi-spotlight-wrapper",
            SpotlightClass::SpotlightAuto => "hi-spotlight-auto",
            SpotlightClass::SpotlightTheme => "hi-spotlight-theme",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum GlowClass {
    Glow,
    GlowWrapper,
    GlowWrapperBlock,
    GlowBlurNone,
    GlowBlurLight,
    GlowBlurMedium,
    GlowBlurHeavy,
    GlowGhost,
    GlowPrimary,
    GlowSecondary,
    GlowDanger,
    GlowSuccess,
    GlowDim,
    GlowSoft,
    GlowBright,
}

impl TypedClass for GlowClass {
    fn class_name(&self) -> &'static str {
        match self {
            GlowClass::Glow => "hi-glow",
            GlowClass::GlowWrapper => "hi-glow-wrapper",
            GlowClass::GlowWrapperBlock => "hi-glow-wrapper-block",
            GlowClass::GlowBlurNone => "hi-glow-blur-none",
            GlowClass::GlowBlurLight => "hi-glow-blur-light",
            GlowClass::GlowBlurMedium => "hi-glow-blur-medium",
            GlowClass::GlowBlurHeavy => "hi-glow-blur-heavy",
            GlowClass::GlowGhost => "hi-glow-ghost",
            GlowClass::GlowPrimary => "hi-glow-primary",
            GlowClass::GlowSecondary => "hi-glow-secondary",
            GlowClass::GlowDanger => "hi-glow-danger",
            GlowClass::GlowSuccess => "hi-glow-success",
            GlowClass::GlowDim => "hi-glow-dim",
            GlowClass::GlowSoft => "hi-glow-soft",
            GlowClass::GlowBright => "hi-glow-bright",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BadgeClass {
    Badge,
    Dot,
    Primary,
    Secondary,
    Success,
    Warning,
    Danger,
    Info,
    Wrapper,
    DotInner,
}

impl TypedClass for BadgeClass {
    fn class_name(&self) -> &'static str {
        match self {
            BadgeClass::Badge => "hi-badge",
            BadgeClass::Dot => "hi-badge-dot",
            BadgeClass::Primary => "hi-badge-primary",
            BadgeClass::Secondary => "hi-badge-secondary",
            BadgeClass::Success => "hi-badge-success",
            BadgeClass::Warning => "hi-badge-warning",
            BadgeClass::Danger => "hi-badge-danger",
            BadgeClass::Info => "hi-badge-info",
            BadgeClass::Wrapper => "hi-badge-wrapper",
            BadgeClass::DotInner => "hi-badge-dot-inner",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TagClass {
    Tag,
    Default,
    Primary,
    Success,
    Warning,
    Danger,
    Info,
    Close,
}

impl TypedClass for TagClass {
    fn class_name(&self) -> &'static str {
        match self {
            TagClass::Tag => "hi-tag",
            TagClass::Default => "hi-tag-default",
            TagClass::Primary => "hi-tag-primary",
            TagClass::Success => "hi-tag-success",
            TagClass::Warning => "hi-tag-warning",
            TagClass::Danger => "hi-tag-danger",
            TagClass::Info => "hi-tag-info",
            TagClass::Close => "hi-tag-close",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DescriptionListClass {
    List,
    Term,
    Detail,
}

impl TypedClass for DescriptionListClass {
    fn class_name(&self) -> &'static str {
        match self {
            DescriptionListClass::List => "hi-description-list",
            DescriptionListClass::Term => "hi-description-list-term",
            DescriptionListClass::Detail => "hi-description-list-detail",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EmptyClass {
    Container,
    Image,
    Img,
    Title,
    Description,
    Action,
}

impl TypedClass for EmptyClass {
    fn class_name(&self) -> &'static str {
        match self {
            EmptyClass::Container => "hi-empty-container",
            EmptyClass::Image => "hi-empty-image",
            EmptyClass::Img => "hi-empty-img",
            EmptyClass::Title => "hi-empty-title",
            EmptyClass::Description => "hi-empty-description",
            EmptyClass::Action => "hi-empty-action",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum QRCodeClass {
    Container,
    Title,
    Wrapper,
    Image,
}

impl TypedClass for QRCodeClass {
    fn class_name(&self) -> &'static str {
        match self {
            QRCodeClass::Container => "hi-qrcode-container",
            QRCodeClass::Title => "hi-qrcode-title",
            QRCodeClass::Wrapper => "hi-qrcode-wrapper",
            QRCodeClass::Image => "hi-qrcode-image",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ImageClass {
    ImageContainer,
    Image,
    Logo,
    ImagePlaceholder,
    ImageSkeleton,
    ImageIconPlaceholder,
}

impl TypedClass for ImageClass {
    fn class_name(&self) -> &'static str {
        match self {
            ImageClass::ImageContainer => "hi-image-container",
            ImageClass::Image => "hi-image",
            ImageClass::Logo => "hi-logo",
            ImageClass::ImagePlaceholder => "hi-image-placeholder",
            ImageClass::ImageSkeleton => "hi-image-skeleton",
            ImageClass::ImageIconPlaceholder => "hi-image-icon-placeholder",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SkeletonDisplayClass {
    Circular,
    Rounded,
    Sm,
    Md,
    Lg,
    Group,
    Card,
    CardHeader,
    CardContent,
    TableRow,
    Table,
    TableHeader,
}

impl TypedClass for SkeletonDisplayClass {
    fn class_name(&self) -> &'static str {
        match self {
            Self::Circular => "hi-skeleton-circular",
            Self::Rounded => "hi-skeleton-rounded",
            Self::Sm => "hi-skeleton-sm",
            Self::Md => "hi-skeleton-md",
            Self::Lg => "hi-skeleton-lg",
            Self::Group => "hi-skeleton-group",
            Self::Card => "hi-skeleton-card",
            Self::CardHeader => "hi-skeleton-card-header",
            Self::CardContent => "hi-skeleton-card-content",
            Self::TableRow => "hi-skeleton-table-row",
            Self::Table => "hi-skeleton-table",
            Self::TableHeader => "hi-skeleton-table-header",
        }
    }
}
