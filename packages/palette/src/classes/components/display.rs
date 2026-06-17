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
            Self::Card => "hi-card",
            Self::CardHoverable => "hi-card-hoverable",
            Self::CardBordered => "hi-card-bordered",
            Self::CardFlat => "hi-card-flat",
            Self::CardHeader => "hi-card-header",
            Self::CardHeaderLeft => "hi-card-header-left",
            Self::CardHeaderAvatar => "hi-card-header-avatar",
            Self::CardHeaderAction => "hi-card-header-action",
            Self::CardTitle => "hi-card-title",
            Self::CardSubtitle => "hi-card-subtitle",
            Self::CardExtra => "hi-card-extra",
            Self::CardBody => "hi-card-body",
            Self::CardFooter => "hi-card-footer",
            Self::CardMedia => "hi-card-media",
            Self::CardCover => "hi-card-cover",
            Self::CardActions => "hi-card-actions",
            Self::CardActionsNoSpacing => "hi-card-actions-no-spacing",
            Self::CardSpotlightWrapper => "hi-card-spotlight-wrapper",
            Self::CardSm => "hi-card-sm",
            Self::CardMd => "hi-card-md",
            Self::CardLg => "hi-card-lg",
            Self::CardGrid => "hi-card-grid",
            Self::CardGrid2 => "hi-card-grid-2",
            Self::CardGrid3 => "hi-card-grid-3",
            Self::CardGrid4 => "hi-card-grid-4",
            Self::CardLoading => "hi-card-loading",
            Self::CardGlow => "hi-card-glow",
            Self::CardAnimateIn => "hi-card-animate-in",
            Self::CardStagger => "hi-card-stagger",
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
            Self::Spotlight => "hi-spotlight",
            Self::SpotlightWrapper => "hi-spotlight-wrapper",
            Self::SpotlightAuto => "hi-spotlight-auto",
            Self::SpotlightTheme => "hi-spotlight-theme",
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
            Self::Glow => "hi-glow",
            Self::GlowWrapper => "hi-glow-wrapper",
            Self::GlowWrapperBlock => "hi-glow-wrapper-block",
            Self::GlowBlurNone => "hi-glow-blur-none",
            Self::GlowBlurLight => "hi-glow-blur-light",
            Self::GlowBlurMedium => "hi-glow-blur-medium",
            Self::GlowBlurHeavy => "hi-glow-blur-heavy",
            Self::GlowGhost => "hi-glow-ghost",
            Self::GlowPrimary => "hi-glow-primary",
            Self::GlowSecondary => "hi-glow-secondary",
            Self::GlowDanger => "hi-glow-danger",
            Self::GlowSuccess => "hi-glow-success",
            Self::GlowDim => "hi-glow-dim",
            Self::GlowSoft => "hi-glow-soft",
            Self::GlowBright => "hi-glow-bright",
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
            Self::Badge => "hi-badge",
            Self::Dot => "hi-badge-dot",
            Self::Primary => "hi-badge-primary",
            Self::Secondary => "hi-badge-secondary",
            Self::Success => "hi-badge-success",
            Self::Warning => "hi-badge-warning",
            Self::Danger => "hi-badge-danger",
            Self::Info => "hi-badge-info",
            Self::Wrapper => "hi-badge-wrapper",
            Self::DotInner => "hi-badge-dot-inner",
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
            Self::Tag => "hi-tag",
            Self::Default => "hi-tag-default",
            Self::Primary => "hi-tag-primary",
            Self::Success => "hi-tag-success",
            Self::Warning => "hi-tag-warning",
            Self::Danger => "hi-tag-danger",
            Self::Info => "hi-tag-info",
            Self::Close => "hi-tag-close",
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
            Self::List => "hi-description-list",
            Self::Term => "hi-description-list-term",
            Self::Detail => "hi-description-list-detail",
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
            Self::Container => "hi-empty-container",
            Self::Image => "hi-empty-image",
            Self::Img => "hi-empty-img",
            Self::Title => "hi-empty-title",
            Self::Description => "hi-empty-description",
            Self::Action => "hi-empty-action",
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
            Self::Container => "hi-qrcode-container",
            Self::Title => "hi-qrcode-title",
            Self::Wrapper => "hi-qrcode-wrapper",
            Self::Image => "hi-qrcode-image",
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
            Self::ImageContainer => "hi-image-container",
            Self::Image => "hi-image",
            Self::Logo => "hi-logo",
            Self::ImagePlaceholder => "hi-image-placeholder",
            Self::ImageSkeleton => "hi-image-skeleton",
            Self::ImageIconPlaceholder => "hi-image-icon-placeholder",
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
