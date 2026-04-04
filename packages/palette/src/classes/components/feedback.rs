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
            ToastClass::Toast => "hi-toast",
            ToastClass::ToastInfo => "hi-toast-info",
            ToastClass::ToastSuccess => "hi-toast-success",
            ToastClass::ToastWarning => "hi-toast-warning",
            ToastClass::ToastError => "hi-toast-error",
            ToastClass::ToastTopRight => "hi-toast-top-right",
            ToastClass::ToastTopCenter => "hi-toast-top-center",
            ToastClass::ToastTopLeft => "hi-toast-top-left",
            ToastClass::ToastBottomRight => "hi-toast-bottom-right",
            ToastClass::ToastBottomCenter => "hi-toast-bottom-center",
            ToastClass::ToastBottomLeft => "hi-toast-bottom-left",
            ToastClass::ToastIconWrapper => "hi-toast-icon-wrapper",
            ToastClass::ToastIcon => "hi-toast-icon",
            ToastClass::ToastContent => "hi-toast-content",
            ToastClass::ToastTitle => "hi-toast-title",
            ToastClass::ToastMessage => "hi-toast-message",
            ToastClass::ToastClose => "hi-toast-close",
            ToastClass::GlowWrapper => "hi-toast-glow-wrapper",
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
            TooltipClass::Tooltip => "hi-tooltip",
            TooltipClass::TooltipWrapper => "hi-tooltip-wrapper",
            TooltipClass::TooltipTrigger => "hi-tooltip-trigger",
            TooltipClass::TooltipVisible => "hi-tooltip-visible",
            TooltipClass::TooltipTop => "hi-tooltip-top",
            TooltipClass::TooltipBottom => "hi-tooltip-bottom",
            TooltipClass::TooltipLeft => "hi-tooltip-left",
            TooltipClass::TooltipRight => "hi-tooltip-right",
            TooltipClass::TooltipContent => "hi-tooltip-content",
            TooltipClass::TooltipArrow => "hi-tooltip-arrow",
            TooltipClass::TooltipArrowTop => "hi-tooltip-arrow-top",
            TooltipClass::TooltipArrowBottom => "hi-tooltip-arrow-bottom",
            TooltipClass::TooltipArrowLeft => "hi-tooltip-arrow-left",
            TooltipClass::TooltipArrowRight => "hi-tooltip-arrow-right",
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
            AlertClass::Alert => "hi-alert",
            AlertClass::AlertInfo => "hi-alert-info",
            AlertClass::AlertSuccess => "hi-alert-success",
            AlertClass::AlertWarning => "hi-alert-warning",
            AlertClass::AlertError => "hi-alert-error",
            AlertClass::AlertIconWrapper => "hi-alert-icon-wrapper",
            AlertClass::AlertIcon => "hi-alert-icon",
            AlertClass::AlertContent => "hi-alert-content",
            AlertClass::AlertTitle => "hi-alert-title",
            AlertClass::AlertDescription => "hi-alert-description",
            AlertClass::AlertClose => "hi-alert-close",
            AlertClass::Sm => "hi-alert-sm",
            AlertClass::Md => "hi-alert-md",
            AlertClass::Lg => "hi-alert-lg",
            AlertClass::GlowWrapper => "hi-alert-glow-wrapper",
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
            ModalClass::Overlay => "hi-modal-overlay",
            ModalClass::OverlayTransparent => "hi-modal-overlay-transparent",
            ModalClass::Modal => "hi-modal",
            ModalClass::Header => "hi-modal-header",
            ModalClass::Title => "hi-modal-title",
            ModalClass::Close => "hi-modal-close",
            ModalClass::Body => "hi-modal-body",
            ModalClass::Sm => "hi-modal-sm",
            ModalClass::Md => "hi-modal-md",
            ModalClass::Lg => "hi-modal-lg",
            ModalClass::Xl => "hi-modal-xl",
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
            DropdownClass::Overlay => "hi-dropdown-overlay",
            DropdownClass::OverlayDimmed => "hi-dropdown-overlay-dimmed",
            DropdownClass::Dropdown => "hi-dropdown",
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
            DrawerClass::Drawer => "hi-drawer",
            DrawerClass::Mask => "hi-drawer-mask",
            DrawerClass::Right => "hi-drawer-right",
            DrawerClass::Left => "hi-drawer-left",
            DrawerClass::Top => "hi-drawer-top",
            DrawerClass::Bottom => "hi-drawer-bottom",
            DrawerClass::Header => "hi-drawer-header",
            DrawerClass::Title => "hi-drawer-title",
            DrawerClass::Close => "hi-drawer-close",
            DrawerClass::Body => "hi-drawer-body",
            DrawerClass::Footer => "hi-drawer-footer",
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
            PopoverClass::Popover => "hi-popover",
            PopoverClass::Title => "hi-popover-title",
            PopoverClass::Content => "hi-popover-content",
            PopoverClass::Trigger => "hi-popover-trigger",
            PopoverClass::Backdrop => "hi-popover-backdrop",
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
            ProgressClass::Wrapper => "hi-progress-wrapper",
            ProgressClass::Progress => "hi-progress",
            ProgressClass::Linear => "hi-progress-linear",
            ProgressClass::Circular => "hi-progress-circular",
            ProgressClass::Normal => "hi-progress-normal",
            ProgressClass::Active => "hi-progress-active",
            ProgressClass::Exception => "hi-progress-exception",
            ProgressClass::Success => "hi-progress-success",
            ProgressClass::Info => "hi-progress-info",
            ProgressClass::Circle => "hi-progress-circle",
            ProgressClass::Outer => "hi-progress-outer",
            ProgressClass::Inner => "hi-progress-inner",
            ProgressClass::Bg => "hi-progress-bg",
            ProgressClass::Text => "hi-progress-text",
            ProgressClass::CircleWrapper => "hi-progress-circle-wrapper",
            ProgressClass::CircleTrail => "hi-progress-circle-trail",
            ProgressClass::CirclePath => "hi-progress-circle-path",
            ProgressClass::CircleText => "hi-progress-circle-text",
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
            SkeletonClass::Wrapper => "hi-skeleton-wrapper",
            SkeletonClass::Skeleton => "hi-skeleton",
            SkeletonClass::Active => "hi-skeleton-active",
            SkeletonClass::Text => "hi-skeleton-text",
            SkeletonClass::Avatar => "hi-skeleton-avatar",
            SkeletonClass::Image => "hi-skeleton-image",
            SkeletonClass::Button => "hi-skeleton-button",
            SkeletonClass::Input => "hi-skeleton-input",
            SkeletonClass::Rect => "hi-skeleton-rect",
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
            SpinClass::Spin => "hi-spin",
            SpinClass::Sm => "hi-spin-sm",
            SpinClass::Md => "hi-spin-md",
            SpinClass::Lg => "hi-spin-lg",
            SpinClass::Stopped => "hi-spin-stopped",
            SpinClass::Spinner => "hi-spin-spinner",
            SpinClass::Tip => "hi-spin-tip",
        }
    }
}
