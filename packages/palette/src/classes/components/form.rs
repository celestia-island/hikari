//! Form component classes (Input, Checkbox, Radio, Select, etc.)

use tairitsu_style::TypedClass;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Input {
    Input,
    Wrapper,
}

impl TypedClass for Input {
    fn class_name(&self) -> &'static str {
        match self {
            Self::Input => "hi-input",
            Self::Wrapper => "hi-input-wrapper",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum InputClass {
    Input,
    InputWrapper,
    InputSm,
    InputMd,
    InputLg,
    InputDisabled,
    InputPrefix,
    InputSuffix,
    InputError,
    InputSuccess,
}

impl TypedClass for InputClass {
    fn class_name(&self) -> &'static str {
        match self {
            Self::Input => "hi-input",
            Self::InputWrapper => "hi-input-wrapper",
            Self::InputSm => "hi-input-sm",
            Self::InputMd => "hi-input-md",
            Self::InputLg => "hi-input-lg",
            Self::InputDisabled => "hi-input-disabled",
            Self::InputPrefix => "hi-input-prefix",
            Self::InputSuffix => "hi-input-suffix",
            Self::InputError => "hi-input-error",
            Self::InputSuccess => "hi-input-success",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CheckboxClass {
    Checkbox,
    Sm,
    Md,
    Lg,
    Checked,
    Disabled,
    Label,
    Input,
    Icon,
    Text,
}

impl TypedClass for CheckboxClass {
    fn class_name(&self) -> &'static str {
        match self {
            Self::Checkbox => "hi-checkbox",
            Self::Sm => "hi-checkbox-sm",
            Self::Md => "hi-checkbox-md",
            Self::Lg => "hi-checkbox-lg",
            Self::Checked => "hi-checkbox-checked",
            Self::Disabled => "hi-checkbox-disabled",
            Self::Label => "hi-checkbox-label",
            Self::Input => "hi-checkbox-input",
            Self::Icon => "hi-checkbox-icon",
            Self::Text => "hi-checkbox-text",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RadioClass {
    RadioGroup,
    RadioGroupVertical,
    RadioGroupHorizontal,
    Label,
    Indicator,
    Dot,
    Text,
}

impl TypedClass for RadioClass {
    fn class_name(&self) -> &'static str {
        match self {
            Self::RadioGroup => "hi-radio-group",
            Self::RadioGroupVertical => "hi-radio-group-vertical",
            Self::RadioGroupHorizontal => "hi-radio-group-horizontal",
            Self::Label => "hi-radio-label",
            Self::Indicator => "hi-radio-indicator",
            Self::Dot => "hi-radio-dot",
            Self::Text => "hi-radio-text",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SwitchClass {
    Switch,
    Sm,
    Md,
    Lg,
    Checked,
    Disabled,
    TextVariant,
    IconVariant,
    CustomVariant,
    ColorPrimary,
    ColorSecondary,
    Glow,
    ThumbText,
    ThumbIcon,
    ThumbImage,
    ThumbDot,
    Label,
    Track,
    Thumb,
    SwitchText,
}

impl TypedClass for SwitchClass {
    fn class_name(&self) -> &'static str {
        match self {
            Self::Switch => "hi-switch",
            Self::Sm => "hi-switch-sm",
            Self::Md => "hi-switch-md",
            Self::Lg => "hi-switch-lg",
            Self::Checked => "hi-switch-checked",
            Self::Disabled => "hi-switch-disabled",
            Self::TextVariant => "hi-switch-text-variant",
            Self::IconVariant => "hi-switch-icon-variant",
            Self::CustomVariant => "hi-switch-custom-variant",
            Self::ColorPrimary => "hi-switch-color-primary",
            Self::ColorSecondary => "hi-switch-color-secondary",
            Self::Glow => "hi-switch-glow",
            Self::ThumbText => "hi-switch-thumb-text",
            Self::ThumbIcon => "hi-switch-thumb-icon",
            Self::ThumbImage => "hi-switch-thumb-image",
            Self::ThumbDot => "hi-switch-thumb-dot",
            Self::Label => "hi-switch-label",
            Self::Track => "hi-switch-track",
            Self::Thumb => "hi-switch-thumb",
            Self::SwitchText => "hi-switch-text",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SliderClass {
    Slider,
    Sm,
    Md,
    Lg,
    Disabled,
    Rail,
    Track,
    Handle,
    Input,
}

impl TypedClass for SliderClass {
    fn class_name(&self) -> &'static str {
        match self {
            Self::Slider => "hi-slider",
            Self::Sm => "hi-slider-sm",
            Self::Md => "hi-slider-md",
            Self::Lg => "hi-slider-lg",
            Self::Disabled => "hi-slider-disabled",
            Self::Rail => "hi-slider-rail",
            Self::Track => "hi-slider-track",
            Self::Handle => "hi-slider-handle",
            Self::Input => "hi-slider-input",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SelectClass {
    SelectTrigger,
    Sm,
    Md,
    Lg,
    Disabled,
    Open,
    Select,
    Dropdown,
    Option,
    OptionSelected,
    Value,
    Placeholder,
    Arrow,
}

impl TypedClass for SelectClass {
    fn class_name(&self) -> &'static str {
        match self {
            Self::SelectTrigger => "hi-select-trigger",
            Self::Sm => "hi-select-sm",
            Self::Md => "hi-select-md",
            Self::Lg => "hi-select-lg",
            Self::Disabled => "hi-select-disabled",
            Self::Open => "hi-select-open",
            Self::Select => "hi-select",
            Self::Dropdown => "hi-select-dropdown",
            Self::Option => "hi-select-option",
            Self::OptionSelected => "hi-select-option-selected",
            Self::Value => "hi-select-value",
            Self::Placeholder => "hi-select-placeholder",
            Self::Arrow => "hi-select-arrow",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DatePickerClass {
    DatePickerWrapper,
    DatePicker,
    Disabled,
    Icon,
}

impl TypedClass for DatePickerClass {
    fn class_name(&self) -> &'static str {
        match self {
            Self::DatePickerWrapper => "hi-date-picker-wrapper",
            Self::DatePicker => "hi-date-picker",
            Self::Disabled => "hi-date-picker-disabled",
            Self::Icon => "hi-date-picker-icon",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FileUploadClass {
    FileUploadWrapper,
    FileUpload,
    Idle,
    Dragging,
    Uploading,
    Success,
    Error,
    Area,
    Icon,
    Text,
    Preview,
    File,
}

impl TypedClass for FileUploadClass {
    fn class_name(&self) -> &'static str {
        match self {
            Self::FileUploadWrapper => "hi-file-upload-wrapper",
            Self::FileUpload => "hi-file-upload",
            Self::Idle => "hi-file-upload-idle",
            Self::Dragging => "hi-file-upload-dragging",
            Self::Uploading => "hi-file-upload-uploading",
            Self::Success => "hi-file-upload-success",
            Self::Error => "hi-file-upload-error",
            Self::Area => "hi-file-upload-area",
            Self::Icon => "hi-file-upload-icon",
            Self::Text => "hi-file-upload-text",
            Self::Preview => "hi-file-upload-preview",
            Self::File => "hi-file-upload-file",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FormFieldClass {
    FormField,
    Error,
    Warning,
    Success,
    Required,
    Label,
    Help,
    ErrorMsg,
    SuccessMsg,
    WarningMsg,
}

impl TypedClass for FormFieldClass {
    fn class_name(&self) -> &'static str {
        match self {
            Self::FormField => "hi-form-field",
            Self::Error => "hi-form-field-error",
            Self::Warning => "hi-form-field-warning",
            Self::Success => "hi-form-field-success",
            Self::Required => "hi-form-field-required",
            Self::Label => "hi-form-field-label",
            Self::Help => "hi-form-field-help",
            Self::ErrorMsg => "hi-form-field-error-msg",
            Self::SuccessMsg => "hi-form-field-success-msg",
            Self::WarningMsg => "hi-form-field-warning-msg",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AutoCompleteClass {
    Wrapper,
    Input,
    Clear,
    Dropdown,
    Show,
    Option,
    OptionFocused,
}

impl TypedClass for AutoCompleteClass {
    fn class_name(&self) -> &'static str {
        match self {
            Self::Wrapper => "hi-autocomplete-wrapper",
            Self::Input => "hi-autocomplete-input",
            Self::Clear => "hi-autocomplete-clear",
            Self::Dropdown => "hi-autocomplete-dropdown",
            Self::Show => "hi-autocomplete-show",
            Self::Option => "hi-autocomplete-option",
            Self::OptionFocused => "hi-autocomplete-option-focused",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CascaderClass {
    Wrapper,
    Cascader,
    Sm,
    Md,
    Lg,
    Disabled,
    Open,
    Display,
    Text,
    Clear,
    Arrow,
    Dropdown,
    Menu,
    MenuList,
    MenuItem,
    MenuItemSelected,
    MenuItemDisabled,
    MenuItemArrow,
}

impl TypedClass for CascaderClass {
    fn class_name(&self) -> &'static str {
        match self {
            Self::Wrapper => "hi-cascader-wrapper",
            Self::Cascader => "hi-cascader",
            Self::Sm => "hi-cascader-sm",
            Self::Md => "hi-cascader-md",
            Self::Lg => "hi-cascader-lg",
            Self::Disabled => "hi-cascader-disabled",
            Self::Open => "hi-cascader-open",
            Self::Display => "hi-cascader-display",
            Self::Text => "hi-cascader-text",
            Self::Clear => "hi-cascader-clear",
            Self::Arrow => "hi-cascader-arrow",
            Self::Dropdown => "hi-cascader-dropdown",
            Self::Menu => "hi-cascader-menu",
            Self::MenuList => "hi-cascader-menu-list",
            Self::MenuItem => "hi-cascader-menu-item",
            Self::MenuItemSelected => "hi-cascader-menu-item-selected",
            Self::MenuItemDisabled => "hi-cascader-menu-item-disabled",
            Self::MenuItemArrow => "hi-cascader-menu-item-arrow",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum NumberInputClass {
    Wrapper,
    Button,
    Input,
    Sm,
    Md,
    Lg,
    Btn,
    BtnDecrement,
    BtnIncrement,
}

impl TypedClass for NumberInputClass {
    fn class_name(&self) -> &'static str {
        match self {
            Self::Wrapper => "hi-number-input-wrapper",
            Self::Button => "hi-number-input-button",
            Self::Input => "hi-number-input-input",
            Self::Sm => "hi-number-input-sm",
            Self::Md => "hi-number-input-md",
            Self::Lg => "hi-number-input-lg",
            Self::Btn => "hi-number-input-btn",
            Self::BtnDecrement => "hi-number-input-btn-decrement",
            Self::BtnIncrement => "hi-number-input-btn-increment",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SearchClass {
    Wrapper,
    Input,
    Clear,
    Loading,
    InputContainer,
    SuggestionsDropdown,
    SuggestionItem,
    SuggestionIcon,
    InputWrapper,
}

impl TypedClass for SearchClass {
    fn class_name(&self) -> &'static str {
        match self {
            Self::Wrapper => "hi-search-wrapper",
            Self::Input => "hi-search-input",
            Self::Clear => "hi-search-clear",
            Self::Loading => "hi-search-loading",
            Self::InputContainer => "hi-search-input-container",
            Self::SuggestionsDropdown => "hi-search-suggestions-dropdown",
            Self::SuggestionItem => "hi-search-suggestion-item",
            Self::SuggestionIcon => "hi-search-suggestion-icon",
            Self::InputWrapper => "hi-search-input-wrapper",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum InputWrapperClass {
    Wrapper,
    SizeSm,
    SizeMd,
    SizeLg,
    Disabled,
    LeftSection,
    RightSection,
    InputSection,
    SideItem,
}

impl TypedClass for InputWrapperClass {
    fn class_name(&self) -> &'static str {
        match self {
            Self::Wrapper => "hi-input-wrapper",
            Self::SizeSm => "hi-input-wrapper-sm",
            Self::SizeMd => "hi-input-wrapper-md",
            Self::SizeLg => "hi-input-wrapper-lg",
            Self::Disabled => "hi-input-wrapper-disabled",
            Self::LeftSection => "hi-input-wrapper-left",
            Self::RightSection => "hi-input-wrapper-right",
            Self::InputSection => "hi-input-wrapper-input",
            Self::SideItem => "hi-input-wrapper-item",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TransferClass {
    Transfer,
    Operations,
    Operation,
    Panel,
    PanelHeader,
    PanelCheckbox,
    PanelTitle,
    PanelCount,
    PanelSearch,
    PanelInput,
    PanelList,
    PanelItem,
    PanelItemSelected,
    PanelItemDisabled,
    PanelEmpty,
    ItemCheckbox,
    ItemLabel,
}

impl TypedClass for TransferClass {
    fn class_name(&self) -> &'static str {
        match self {
            Self::Transfer => "hi-transfer",
            Self::Operations => "hi-transfer-operations",
            Self::Operation => "hi-transfer-operation",
            Self::Panel => "hi-transfer-panel",
            Self::PanelHeader => "hi-transfer-panel-header",
            Self::PanelCheckbox => "hi-transfer-panel-checkbox",
            Self::PanelTitle => "hi-transfer-panel-title",
            Self::PanelCount => "hi-transfer-panel-count",
            Self::PanelSearch => "hi-transfer-panel-search",
            Self::PanelInput => "hi-transfer-panel-input",
            Self::PanelList => "hi-transfer-panel-list",
            Self::PanelItem => "hi-transfer-panel-item",
            Self::PanelItemSelected => "hi-transfer-panel-item-selected",
            Self::PanelItemDisabled => "hi-transfer-panel-item-disabled",
            Self::PanelEmpty => "hi-transfer-panel-empty",
            Self::ItemCheckbox => "hi-transfer-item-checkbox",
            Self::ItemLabel => "hi-transfer-item-label",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AvatarClass {
    Avatar,
    AvatarXs,
    AvatarSm,
    AvatarMd,
    AvatarLg,
    AvatarXl,
    AvatarCircular,
    AvatarRounded,
    AvatarSquare,
    AvatarFallback,
    AvatarIcon,
    AvatarImg,
}

impl TypedClass for AvatarClass {
    fn class_name(&self) -> &'static str {
        match self {
            Self::Avatar => "hi-avatar",
            Self::AvatarXs => "hi-avatar-xs",
            Self::AvatarSm => "hi-avatar-sm",
            Self::AvatarMd => "hi-avatar-md",
            Self::AvatarLg => "hi-avatar-lg",
            Self::AvatarXl => "hi-avatar-xl",
            Self::AvatarCircular => "hi-avatar-circular",
            Self::AvatarRounded => "hi-avatar-rounded",
            Self::AvatarSquare => "hi-avatar-square",
            Self::AvatarFallback => "hi-avatar-fallback",
            Self::AvatarIcon => "hi-avatar-icon",
            Self::AvatarImg => "hi-avatar-img",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CanvasClass {
    Canvas,
}

impl TypedClass for CanvasClass {
    fn class_name(&self) -> &'static str {
        match self {
            Self::Canvas => "hi-canvas",
        }
    }
}
