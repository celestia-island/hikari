//! Feedback component classes (Modal, Toast, Alert, etc.)

use serde::{Deserialize, Serialize};

use crate::classes::UtilityClass;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
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
}

impl UtilityClass for ToastClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            ToastClass::Toast => "toast",
            ToastClass::ToastInfo => "toast-info",
            ToastClass::ToastSuccess => "toast-success",
            ToastClass::ToastWarning => "toast-warning",
            ToastClass::ToastError => "toast-error",
            ToastClass::ToastTopRight => "toast-top-right",
            ToastClass::ToastTopCenter => "toast-top-center",
            ToastClass::ToastTopLeft => "toast-top-left",
            ToastClass::ToastBottomRight => "toast-bottom-right",
            ToastClass::ToastBottomCenter => "toast-bottom-center",
            ToastClass::ToastBottomLeft => "toast-bottom-left",
            ToastClass::ToastIconWrapper => "toast-icon-wrapper",
            ToastClass::ToastIcon => "toast-icon",
            ToastClass::ToastContent => "toast-content",
            ToastClass::ToastTitle => "toast-title",
            ToastClass::ToastMessage => "toast-message",
            ToastClass::ToastClose => "toast-close",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
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

impl UtilityClass for TooltipClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            TooltipClass::Tooltip => "tooltip",
            TooltipClass::TooltipWrapper => "tooltip-wrapper",
            TooltipClass::TooltipTrigger => "tooltip-trigger",
            TooltipClass::TooltipVisible => "tooltip-visible",
            TooltipClass::TooltipTop => "tooltip-top",
            TooltipClass::TooltipBottom => "tooltip-bottom",
            TooltipClass::TooltipLeft => "tooltip-left",
            TooltipClass::TooltipRight => "tooltip-right",
            TooltipClass::TooltipContent => "tooltip-content",
            TooltipClass::TooltipArrow => "tooltip-arrow",
            TooltipClass::TooltipArrowTop => "tooltip-arrow-top",
            TooltipClass::TooltipArrowBottom => "tooltip-arrow-bottom",
            TooltipClass::TooltipArrowLeft => "tooltip-arrow-left",
            TooltipClass::TooltipArrowRight => "tooltip-arrow-right",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
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
}

impl UtilityClass for AlertClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            AlertClass::Alert => "alert",
            AlertClass::AlertInfo => "alert-info",
            AlertClass::AlertSuccess => "alert-success",
            AlertClass::AlertWarning => "alert-warning",
            AlertClass::AlertError => "alert-error",
            AlertClass::AlertIconWrapper => "alert-icon-wrapper",
            AlertClass::AlertIcon => "alert-icon",
            AlertClass::AlertContent => "alert-content",
            AlertClass::AlertTitle => "alert-title",
            AlertClass::AlertDescription => "alert-description",
            AlertClass::AlertClose => "alert-close",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ModalClass {
    Overlay,
    OverlayTransparent,
    Modal,
    Header,
    Title,
    Close,
    Body,
}

impl UtilityClass for ModalClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            ModalClass::Overlay => "modal-overlay",
            ModalClass::OverlayTransparent => "modal-overlay-transparent",
            ModalClass::Modal => "modal",
            ModalClass::Header => "modal-header",
            ModalClass::Title => "modal-title",
            ModalClass::Close => "modal-close",
            ModalClass::Body => "modal-body",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum DropdownClass {
    Overlay,
    OverlayDimmed,
    Dropdown,
}

impl UtilityClass for DropdownClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            DropdownClass::Overlay => "dropdown-overlay",
            DropdownClass::OverlayDimmed => "dropdown-overlay-dimmed",
            DropdownClass::Dropdown => "dropdown",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
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

impl UtilityClass for DrawerClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            DrawerClass::Drawer => "drawer",
            DrawerClass::Mask => "drawer-mask",
            DrawerClass::Right => "drawer-right",
            DrawerClass::Left => "drawer-left",
            DrawerClass::Top => "drawer-top",
            DrawerClass::Bottom => "drawer-bottom",
            DrawerClass::Header => "drawer-header",
            DrawerClass::Title => "drawer-title",
            DrawerClass::Close => "drawer-close",
            DrawerClass::Body => "drawer-body",
            DrawerClass::Footer => "drawer-footer",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PopoverClass {
    Popover,
    Title,
    Content,
}

impl UtilityClass for PopoverClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            PopoverClass::Popover => "popover",
            PopoverClass::Title => "popover-title",
            PopoverClass::Content => "popover-content",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
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
}

impl UtilityClass for ProgressClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            ProgressClass::Wrapper => "progress-wrapper",
            ProgressClass::Progress => "progress",
            ProgressClass::Linear => "progress-linear",
            ProgressClass::Circular => "progress-circular",
            ProgressClass::Normal => "progress-normal",
            ProgressClass::Active => "progress-active",
            ProgressClass::Exception => "progress-exception",
            ProgressClass::Success => "progress-success",
            ProgressClass::Info => "progress-info",
            ProgressClass::Circle => "progress-circle",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
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

impl UtilityClass for SkeletonClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            SkeletonClass::Wrapper => "skeleton-wrapper",
            SkeletonClass::Skeleton => "skeleton",
            SkeletonClass::Active => "skeleton-active",
            SkeletonClass::Text => "skeleton-text",
            SkeletonClass::Avatar => "skeleton-avatar",
            SkeletonClass::Image => "skeleton-image",
            SkeletonClass::Button => "skeleton-button",
            SkeletonClass::Input => "skeleton-input",
            SkeletonClass::Rect => "skeleton-rect",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SpinClass {
    Spin,
    Sm,
    Md,
    Lg,
    Stopped,
    Spinner,
    Tip,
}

impl UtilityClass for SpinClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            SpinClass::Spin => "spin",
            SpinClass::Sm => "spin-sm",
            SpinClass::Md => "spin-md",
            SpinClass::Lg => "spin-lg",
            SpinClass::Stopped => "spin-stopped",
            SpinClass::Spinner => "spin-spinner",
            SpinClass::Tip => "spin-tip",
        }
    }
}
