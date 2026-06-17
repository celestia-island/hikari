//! Feedback component classes (Modal, Toast, Alert, etc.)

use tairitsu_style::TypedClass;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ToastClass {
    Toast,
    ToastInfo,
    ToastSuccess,
    ToastWarning,
    ToastError,
    ToastTopRight,
    ToastTopCenter,
    ToastTopLeft,
    ToastBottomRight,
    ToastBottomCenter,
    ToastBottomLeft,
    ToastIconWrapper,
    ToastIcon,
    ToastContent,
    ToastTitle,
    ToastMessage,
    ToastClose,
    GlowWrapper,
}

impl TypedClass for ToastClass {
    fn class_name(&self) -> &'static str {
        match self {
            Self::Toast => "hi-toast",
            Self::ToastInfo => "hi-toast-info",
            Self::ToastSuccess => "hi-toast-success",
            Self::ToastWarning => "hi-toast-warning",
            Self::ToastError => "hi-toast-error",
            Self::ToastTopRight => "hi-toast-top-right",
            Self::ToastTopCenter => "hi-toast-top-center",
            Self::ToastTopLeft => "hi-toast-top-left",
            Self::ToastBottomRight => "hi-toast-bottom-right",
            Self::ToastBottomCenter => "hi-toast-bottom-center",
            Self::ToastBottomLeft => "hi-toast-bottom-left",
            Self::ToastIconWrapper => "hi-toast-icon-wrapper",
            Self::ToastIcon => "hi-toast-icon",
            Self::ToastContent => "hi-toast-content",
            Self::ToastTitle => "hi-toast-title",
            Self::ToastMessage => "hi-toast-message",
            Self::ToastClose => "hi-toast-close",
            Self::GlowWrapper => "hi-toast-glow-wrapper",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TooltipClass {
    Tooltip,
    TooltipWrapper,
    TooltipTrigger,
    TooltipVisible,
    TooltipTop,
    TooltipBottom,
    TooltipLeft,
    TooltipRight,
    TooltipContent,
    TooltipArrow,
    TooltipArrowTop,
    TooltipArrowBottom,
    TooltipArrowLeft,
    TooltipArrowRight,
}

impl TypedClass for TooltipClass {
    fn class_name(&self) -> &'static str {
        match self {
            Self::Tooltip => "hi-tooltip",
            Self::TooltipWrapper => "hi-tooltip-wrapper",
            Self::TooltipTrigger => "hi-tooltip-trigger",
            Self::TooltipVisible => "hi-tooltip-visible",
            Self::TooltipTop => "hi-tooltip-top",
            Self::TooltipBottom => "hi-tooltip-bottom",
            Self::TooltipLeft => "hi-tooltip-left",
            Self::TooltipRight => "hi-tooltip-right",
            Self::TooltipContent => "hi-tooltip-content",
            Self::TooltipArrow => "hi-tooltip-arrow",
            Self::TooltipArrowTop => "hi-tooltip-arrow-top",
            Self::TooltipArrowBottom => "hi-tooltip-arrow-bottom",
            Self::TooltipArrowLeft => "hi-tooltip-arrow-left",
            Self::TooltipArrowRight => "hi-tooltip-arrow-right",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AlertClass {
    Alert,
    AlertInfo,
    AlertSuccess,
    AlertWarning,
    AlertError,
    AlertIconWrapper,
    AlertIcon,
    AlertContent,
    AlertTitle,
    AlertDescription,
    AlertClose,
    Sm,
    Md,
    Lg,
    GlowWrapper,
}

impl TypedClass for AlertClass {
    fn class_name(&self) -> &'static str {
        match self {
            Self::Alert => "hi-alert",
            Self::AlertInfo => "hi-alert-info",
            Self::AlertSuccess => "hi-alert-success",
            Self::AlertWarning => "hi-alert-warning",
            Self::AlertError => "hi-alert-error",
            Self::AlertIconWrapper => "hi-alert-icon-wrapper",
            Self::AlertIcon => "hi-alert-icon",
            Self::AlertContent => "hi-alert-content",
            Self::AlertTitle => "hi-alert-title",
            Self::AlertDescription => "hi-alert-description",
            Self::AlertClose => "hi-alert-close",
            Self::Sm => "hi-alert-sm",
            Self::Md => "hi-alert-md",
            Self::Lg => "hi-alert-lg",
            Self::GlowWrapper => "hi-alert-glow-wrapper",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ModalClass {
    Overlay,
    OverlayTransparent,
    Modal,
    Header,
    Title,
    Close,
    Body,
    Sm,
    Md,
    Lg,
    Xl,
}

impl TypedClass for ModalClass {
    fn class_name(&self) -> &'static str {
        match self {
            Self::Overlay => "hi-modal-overlay",
            Self::OverlayTransparent => "hi-modal-overlay-transparent",
            Self::Modal => "hi-modal",
            Self::Header => "hi-modal-header",
            Self::Title => "hi-modal-title",
            Self::Close => "hi-modal-close",
            Self::Body => "hi-modal-body",
            Self::Sm => "hi-modal-sm",
            Self::Md => "hi-modal-md",
            Self::Lg => "hi-modal-lg",
            Self::Xl => "hi-modal-xl",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DropdownClass {
    Overlay,
    OverlayDimmed,
    Dropdown,
}

impl TypedClass for DropdownClass {
    fn class_name(&self) -> &'static str {
        match self {
            Self::Overlay => "hi-dropdown-overlay",
            Self::OverlayDimmed => "hi-dropdown-overlay-dimmed",
            Self::Dropdown => "hi-dropdown",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DrawerClass {
    Drawer,
    Mask,
    Right,
    Left,
    Top,
    Bottom,
    Header,
    Title,
    Close,
    Body,
    Footer,
}

impl TypedClass for DrawerClass {
    fn class_name(&self) -> &'static str {
        match self {
            Self::Drawer => "hi-drawer",
            Self::Mask => "hi-drawer-mask",
            Self::Right => "hi-drawer-right",
            Self::Left => "hi-drawer-left",
            Self::Top => "hi-drawer-top",
            Self::Bottom => "hi-drawer-bottom",
            Self::Header => "hi-drawer-header",
            Self::Title => "hi-drawer-title",
            Self::Close => "hi-drawer-close",
            Self::Body => "hi-drawer-body",
            Self::Footer => "hi-drawer-footer",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PopoverClass {
    Popover,
    Title,
    Content,
    Trigger,
    Backdrop,
}

impl TypedClass for PopoverClass {
    fn class_name(&self) -> &'static str {
        match self {
            Self::Popover => "hi-popover",
            Self::Title => "hi-popover-title",
            Self::Content => "hi-popover-content",
            Self::Trigger => "hi-popover-trigger",
            Self::Backdrop => "hi-popover-backdrop",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ProgressClass {
    Wrapper,
    Progress,
    Linear,
    Circular,
    Normal,
    Active,
    Exception,
    Success,
    Info,
    Circle,
    Outer,
    Inner,
    Bg,
    Text,
    CircleWrapper,
    CircleTrail,
    CirclePath,
    CircleText,
}

impl TypedClass for ProgressClass {
    fn class_name(&self) -> &'static str {
        match self {
            Self::Wrapper => "hi-progress-wrapper",
            Self::Progress => "hi-progress",
            Self::Linear => "hi-progress-linear",
            Self::Circular => "hi-progress-circular",
            Self::Normal => "hi-progress-normal",
            Self::Active => "hi-progress-active",
            Self::Exception => "hi-progress-exception",
            Self::Success => "hi-progress-success",
            Self::Info => "hi-progress-info",
            Self::Circle => "hi-progress-circle",
            Self::Outer => "hi-progress-outer",
            Self::Inner => "hi-progress-inner",
            Self::Bg => "hi-progress-bg",
            Self::Text => "hi-progress-text",
            Self::CircleWrapper => "hi-progress-circle-wrapper",
            Self::CircleTrail => "hi-progress-circle-trail",
            Self::CirclePath => "hi-progress-circle-path",
            Self::CircleText => "hi-progress-circle-text",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SkeletonClass {
    Wrapper,
    Skeleton,
    Active,
    Text,
    Avatar,
    Image,
    Button,
    Input,
    Rect,
}

impl TypedClass for SkeletonClass {
    fn class_name(&self) -> &'static str {
        match self {
            Self::Wrapper => "hi-skeleton-wrapper",
            Self::Skeleton => "hi-skeleton",
            Self::Active => "hi-skeleton-active",
            Self::Text => "hi-skeleton-text",
            Self::Avatar => "hi-skeleton-avatar",
            Self::Image => "hi-skeleton-image",
            Self::Button => "hi-skeleton-button",
            Self::Input => "hi-skeleton-input",
            Self::Rect => "hi-skeleton-rect",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SpinClass {
    Spin,
    Sm,
    Md,
    Lg,
    Stopped,
    Spinner,
    Tip,
}

impl TypedClass for SpinClass {
    fn class_name(&self) -> &'static str {
        match self {
            Self::Spin => "hi-spin",
            Self::Sm => "hi-spin-sm",
            Self::Md => "hi-spin-md",
            Self::Lg => "hi-spin-lg",
            Self::Stopped => "hi-spin-stopped",
            Self::Spinner => "hi-spin-spinner",
            Self::Tip => "hi-spin-tip",
        }
    }
}
