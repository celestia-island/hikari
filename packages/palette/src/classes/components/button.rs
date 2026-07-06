//! Button component classes

use serde::{Deserialize, Serialize};

use crate::classes::UtilityClass;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ButtonClass {
    Button,
    Primary,
    Secondary,
    Ghost,
    Borderless,
    Danger,
    Success,
    Sm,
    Md,
    Lg,
    Loading,
    Block,
    Spinner,
    Icon,
    SpaceBetween,
    WidthAuto,
    Width120,
    Width140,
    Width160,
    IconButton,
    IconButtonSize16,
    IconButtonSize24,
    IconButtonSize32,
    IconButtonSize36,
    IconButtonSize40,
    IconButtonGhost,
    IconButtonPrimary,
    IconButtonSecondary,
    IconButtonDanger,
    IconButtonSuccess,
    Disabled,
    IconButtonIcon,
    IconButtonDisabled,
}

impl UtilityClass for ButtonClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            ButtonClass::Button => "button",
            ButtonClass::Primary => "button-primary",
            ButtonClass::Secondary => "button-secondary",
            ButtonClass::Ghost => "button-ghost",
            ButtonClass::Borderless => "button-borderless",
            ButtonClass::Danger => "button-danger",
            ButtonClass::Success => "button-success",
            ButtonClass::Sm => "button-sm",
            ButtonClass::Md => "button-md",
            ButtonClass::Lg => "button-lg",
            ButtonClass::Loading => "button-loading",
            ButtonClass::Block => "button-block",
            ButtonClass::Spinner => "button-spinner",
            ButtonClass::Icon => "button-icon",
            ButtonClass::SpaceBetween => "button-space-between",
            ButtonClass::WidthAuto => "button-width-auto",
            ButtonClass::Width120 => "button-width-120",
            ButtonClass::Width140 => "button-width-140",
            ButtonClass::Width160 => "button-width-160",
            ButtonClass::IconButton => "icon-button",
            ButtonClass::IconButtonSize16 => "icon-button-16",
            ButtonClass::IconButtonSize24 => "icon-button-24",
            ButtonClass::IconButtonSize32 => "icon-button-32",
            ButtonClass::IconButtonSize36 => "icon-button-36",
            ButtonClass::IconButtonSize40 => "icon-button-40",
            ButtonClass::IconButtonGhost => "icon-button-ghost",
            ButtonClass::IconButtonPrimary => "icon-button-primary",
            ButtonClass::IconButtonSecondary => "icon-button-secondary",
            ButtonClass::IconButtonDanger => "icon-button-danger",
            ButtonClass::IconButtonSuccess => "icon-button-success",
            ButtonClass::Disabled => "button-disabled",
            ButtonClass::IconButtonIcon => "icon-button-icon",
            ButtonClass::IconButtonDisabled => "icon-button-disabled",
        }
    }
}
