// Minimal Material Design Icons enum for Hikari
//
// This contains only the icons actually used by the application
// to avoid WASM size limitations.

#![allow(non_camel_case_types)]
#![allow(non_snake_case)]
#![allow(dead_code)]

/// Material Design Icons - minimal set for Hikari
#[derive(Clone, Copy, PartialEq, Eq, Debug, Hash)]
pub enum MdiIcon {
    // Navigation
    ChevronLeft,
    ChevronRight,
    ChevronUp,
    ChevronDown,
    ChevronDoubleRight,
    Menu,
    Close,

    // Actions
    Magnify,
    Cog,
    Check,
    GestureTap,

    // Status / Feedback
    Alert,
    Information,
    Bell,
    BellOutline,

    // Feature Icons
    Palette,
    AutoFix,
    LightningBolt,
    Package,

    // Layout
    Home,
    Image,
    ViewColumn,
    CubeOutline,

    // Content
    Account,
    Book,
    Star,
    Heart,
    Calendar,
    ClockOutline,
    TextBoxEdit,
    CreditCard,
    FormatListBulleted,
    Graph,

    // Other
    TrophyAward,

    // Theme
    MoonWaningCrescent,
    WhiteBalanceSunny,
}

impl std::fmt::Display for MdiIcon {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            MdiIcon::ChevronLeft => write!(f, "chevron-left"),
            MdiIcon::ChevronRight => write!(f, "chevron-right"),
            MdiIcon::ChevronUp => write!(f, "chevron-up"),
            MdiIcon::ChevronDown => write!(f, "chevron-down"),
            MdiIcon::ChevronDoubleRight => write!(f, "chevron-double-right"),
            MdiIcon::Menu => write!(f, "menu"),
            MdiIcon::Close => write!(f, "close"),
            MdiIcon::Magnify => write!(f, "magnify"),
            MdiIcon::Cog => write!(f, "cog"),
            MdiIcon::Check => write!(f, "check"),
            MdiIcon::GestureTap => write!(f, "gesture-tap"),
            MdiIcon::Alert => write!(f, "alert"),
            MdiIcon::Information => write!(f, "information"),
            MdiIcon::Bell => write!(f, "bell"),
            MdiIcon::BellOutline => write!(f, "bell-outline"),
            MdiIcon::Palette => write!(f, "palette"),
            MdiIcon::AutoFix => write!(f, "auto-fix"),
            MdiIcon::LightningBolt => write!(f, "lightning-bolt"),
            MdiIcon::Package => write!(f, "package"),
            MdiIcon::Home => write!(f, "home"),
            MdiIcon::Image => write!(f, "image"),
            MdiIcon::ViewColumn => write!(f, "view-column"),
            MdiIcon::CubeOutline => write!(f, "cube-outline"),
            MdiIcon::Account => write!(f, "account"),
            MdiIcon::Book => write!(f, "book"),
            MdiIcon::Star => write!(f, "star"),
            MdiIcon::Heart => write!(f, "heart"),
            MdiIcon::Calendar => write!(f, "calendar"),
            MdiIcon::ClockOutline => write!(f, "clock-outline"),
            MdiIcon::TextBoxEdit => write!(f, "text-box-edit"),
            MdiIcon::CreditCard => write!(f, "credit-card"),
            MdiIcon::FormatListBulleted => write!(f, "format-list-bulleted"),
            MdiIcon::Graph => write!(f, "graph"),
            MdiIcon::TrophyAward => write!(f, "trophy-award"),
            MdiIcon::MoonWaningCrescent => write!(f, "moon-waning-crescent"),
            MdiIcon::WhiteBalanceSunny => write!(f, "white-balance-sunny"),
        }
    }
}

impl std::convert::From<&str> for MdiIcon {
    fn from(s: &str) -> Self {
        match s {
            "chevron-left" => MdiIcon::ChevronLeft,
            "chevron-right" => MdiIcon::ChevronRight,
            "chevron-up" => MdiIcon::ChevronUp,
            "chevron-down" => MdiIcon::ChevronDown,
            "chevron-double-right" => MdiIcon::ChevronDoubleRight,
            "menu" => MdiIcon::Menu,
            "close" => MdiIcon::Close,
            "magnify" => MdiIcon::Magnify,
            "cog" => MdiIcon::Cog,
            "check" => MdiIcon::Check,
            "gesture-tap" => MdiIcon::GestureTap,
            "alert" => MdiIcon::Alert,
            "information" => MdiIcon::Information,
            "bell" => MdiIcon::Bell,
            "bell-outline" => MdiIcon::BellOutline,
            "palette" => MdiIcon::Palette,
            "auto-fix" => MdiIcon::AutoFix,
            "lightning-bolt" => MdiIcon::LightningBolt,
            "package" => MdiIcon::Package,
            "home" => MdiIcon::Home,
            "image" => MdiIcon::Image,
            "view-column" => MdiIcon::ViewColumn,
            "cube-outline" => MdiIcon::CubeOutline,
            "account" => MdiIcon::Account,
            "book" => MdiIcon::Book,
            "star" => MdiIcon::Star,
            "heart" => MdiIcon::Heart,
            "calendar" => MdiIcon::Calendar,
            "clock-outline" => MdiIcon::ClockOutline,
            "text-box-edit" => MdiIcon::TextBoxEdit,
            "credit-card" => MdiIcon::CreditCard,
            "format-list-bulleted" => MdiIcon::FormatListBulleted,
            "graph" => MdiIcon::Graph,
            "trophy-award" => MdiIcon::TrophyAward,
            "moon-waning-crescent" => MdiIcon::MoonWaningCrescent,
            "white-balance-sunny" => MdiIcon::WhiteBalanceSunny,
            _ => MdiIcon::Alert, // Default fallback
        }
    }
}
