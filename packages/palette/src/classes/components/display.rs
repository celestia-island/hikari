//! Display component classes (Card, Badge, Tag, etc.)

use serde::{Deserialize, Serialize};

use crate::classes::UtilityClass;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
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

impl UtilityClass for CardClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            CardClass::Card => "card",
            CardClass::CardHoverable => "card-hoverable",
            CardClass::CardBordered => "card-bordered",
            CardClass::CardFlat => "card-flat",
            CardClass::CardHeader => "card-header",
            CardClass::CardHeaderLeft => "card-header-left",
            CardClass::CardHeaderAvatar => "card-header-avatar",
            CardClass::CardHeaderAction => "card-header-action",
            CardClass::CardTitle => "card-title",
            CardClass::CardSubtitle => "card-subtitle",
            CardClass::CardExtra => "card-extra",
            CardClass::CardBody => "card-body",
            CardClass::CardFooter => "card-footer",
            CardClass::CardMedia => "card-media",
            CardClass::CardCover => "card-cover",
            CardClass::CardActions => "card-actions",
            CardClass::CardActionsNoSpacing => "card-actions-no-spacing",
            CardClass::CardSpotlightWrapper => "card-spotlight-wrapper",
            CardClass::CardSm => "card-sm",
            CardClass::CardMd => "card-md",
            CardClass::CardLg => "card-lg",
            CardClass::CardGrid => "card-grid",
            CardClass::CardGrid2 => "card-grid-2",
            CardClass::CardGrid3 => "card-grid-3",
            CardClass::CardGrid4 => "card-grid-4",
            CardClass::CardLoading => "card-loading",
            CardClass::CardGlow => "card-glow",
            CardClass::CardAnimateIn => "card-animate-in",
            CardClass::CardStagger => "card-stagger",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[allow(dead_code)]
pub enum SpotlightClass {
    Spotlight,
    SpotlightWrapper,
    SpotlightAuto,
    SpotlightTheme,
}

impl UtilityClass for SpotlightClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            SpotlightClass::Spotlight => "spotlight",
            SpotlightClass::SpotlightWrapper => "spotlight-wrapper",
            SpotlightClass::SpotlightAuto => "spotlight-auto",
            SpotlightClass::SpotlightTheme => "spotlight-theme",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
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

impl UtilityClass for GlowClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            GlowClass::Glow => "glow",
            GlowClass::GlowWrapper => "glow-wrapper",
            GlowClass::GlowWrapperBlock => "glow-wrapper-block",
            GlowClass::GlowBlurNone => "glow-blur-none",
            GlowClass::GlowBlurLight => "glow-blur-light",
            GlowClass::GlowBlurMedium => "glow-blur-medium",
            GlowClass::GlowBlurHeavy => "glow-blur-heavy",
            GlowClass::GlowGhost => "glow-ghost",
            GlowClass::GlowPrimary => "glow-primary",
            GlowClass::GlowSecondary => "glow-secondary",
            GlowClass::GlowDanger => "glow-danger",
            GlowClass::GlowSuccess => "glow-success",
            GlowClass::GlowDim => "glow-dim",
            GlowClass::GlowSoft => "glow-soft",
            GlowClass::GlowBright => "glow-bright",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum BadgeClass {
    Badge,
    Dot,
    Primary,
    Secondary,
    Success,
    Warning,
    Danger,
    Info,
}

impl UtilityClass for BadgeClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            BadgeClass::Badge => "badge",
            BadgeClass::Dot => "badge-dot",
            BadgeClass::Primary => "badge-primary",
            BadgeClass::Secondary => "badge-secondary",
            BadgeClass::Success => "badge-success",
            BadgeClass::Warning => "badge-warning",
            BadgeClass::Danger => "badge-danger",
            BadgeClass::Info => "badge-info",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
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

impl UtilityClass for TagClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            TagClass::Tag => "tag",
            TagClass::Default => "tag-default",
            TagClass::Primary => "tag-primary",
            TagClass::Success => "tag-success",
            TagClass::Warning => "tag-warning",
            TagClass::Danger => "tag-danger",
            TagClass::Info => "tag-info",
            TagClass::Close => "tag-close",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[allow(dead_code)]
pub enum DescriptionListClass {
    List,
    Term,
    Detail,
}

impl UtilityClass for DescriptionListClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            DescriptionListClass::List => "description-list",
            DescriptionListClass::Term => "description-list-term",
            DescriptionListClass::Detail => "description-list-detail",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum EmptyClass {
    Container,
    Image,
    Img,
    Title,
    Description,
    Action,
}

impl UtilityClass for EmptyClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            EmptyClass::Container => "empty-container",
            EmptyClass::Image => "empty-image",
            EmptyClass::Img => "empty-img",
            EmptyClass::Title => "empty-title",
            EmptyClass::Description => "empty-description",
            EmptyClass::Action => "empty-action",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum QRCodeClass {
    Container,
    Title,
    Wrapper,
    Image,
}

impl UtilityClass for QRCodeClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            QRCodeClass::Container => "qrcode-container",
            QRCodeClass::Title => "qrcode-title",
            QRCodeClass::Wrapper => "qrcode-wrapper",
            QRCodeClass::Image => "qrcode-image",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ImageClass {
    ImageContainer,
    Image,
    Logo,
    ImagePlaceholder,
    ImageSkeleton,
    ImageIconPlaceholder,
}

impl UtilityClass for ImageClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            ImageClass::ImageContainer => "image-container",
            ImageClass::Image => "image",
            ImageClass::Logo => "logo",
            ImageClass::ImagePlaceholder => "image-placeholder",
            ImageClass::ImageSkeleton => "image-skeleton",
            ImageClass::ImageIconPlaceholder => "image-icon-placeholder",
        }
    }
}
