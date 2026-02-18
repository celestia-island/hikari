//! Display component classes (Card, Badge, Tag, etc.)

use serde::{Deserialize, Serialize};

use crate::classes::UtilityClass;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum CardClass {
    Card,
    CardHoverable,
    CardBordered,
    CardHeader,
    CardTitle,
    CardSubtitle,
    CardExtra,
    CardBody,
    CardMedia,
    CardActions,
    CardActionsNoSpacing,
    CardSpotlightWrapper,
}

impl UtilityClass for CardClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            CardClass::Card => "card",
            CardClass::CardHoverable => "card-hoverable",
            CardClass::CardBordered => "card-bordered",
            CardClass::CardHeader => "card-header",
            CardClass::CardTitle => "card-title",
            CardClass::CardSubtitle => "card-subtitle",
            CardClass::CardExtra => "card-extra",
            CardClass::CardBody => "card-body",
            CardClass::CardMedia => "card-media",
            CardClass::CardActions => "card-actions",
            CardClass::CardActionsNoSpacing => "card-actions-no-spacing",
            CardClass::CardSpotlightWrapper => "card-spotlight-wrapper",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
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
    GlowThirty,
    GlowSeventy,
    GlowHundred,
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
            GlowClass::GlowThirty => "glow-thirty",
            GlowClass::GlowSeventy => "glow-seventy",
            GlowClass::GlowHundred => "glow-hundred",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum BadgeClass {
    Badge,
    Dot,
    Primary,
    Success,
    Warning,
    Danger,
}

impl UtilityClass for BadgeClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            BadgeClass::Badge => "badge",
            BadgeClass::Dot => "badge-dot",
            BadgeClass::Primary => "badge-primary",
            BadgeClass::Success => "badge-success",
            BadgeClass::Warning => "badge-warning",
            BadgeClass::Danger => "badge-danger",
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
