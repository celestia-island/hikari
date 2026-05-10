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
            Input::Input => "hi-input",
            Input::Wrapper => "hi-input-wrapper",
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
            InputClass::Input => "hi-input",
            InputClass::InputWrapper => "hi-input-wrapper",
            InputClass::InputSm => "hi-input-sm",
            InputClass::InputMd => "hi-input-md",
            InputClass::InputLg => "hi-input-lg",
            InputClass::InputDisabled => "hi-input-disabled",
            InputClass::InputPrefix => "hi-input-prefix",
            InputClass::InputSuffix => "hi-input-suffix",
            InputClass::InputError => "hi-input-error",
            InputClass::InputSuccess => "hi-input-success",
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
            CheckboxClass::Checkbox => "hi-checkbox",
            CheckboxClass::Sm => "hi-checkbox-sm",
            CheckboxClass::Md => "hi-checkbox-md",
            CheckboxClass::Lg => "hi-checkbox-lg",
            CheckboxClass::Checked => "hi-checkbox-checked",
            CheckboxClass::Disabled => "hi-checkbox-disabled",
            CheckboxClass::Label => "hi-checkbox-label",
            CheckboxClass::Input => "hi-checkbox-input",
            CheckboxClass::Icon => "hi-checkbox-icon",
            CheckboxClass::Text => "hi-checkbox-text",
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
            RadioClass::RadioGroup => "hi-radio-group",
            RadioClass::RadioGroupVertical => "hi-radio-group-vertical",
            RadioClass::RadioGroupHorizontal => "hi-radio-group-horizontal",
            RadioClass::Label => "hi-radio-label",
            RadioClass::Indicator => "hi-radio-indicator",
            RadioClass::Dot => "hi-radio-dot",
            RadioClass::Text => "hi-radio-text",
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
            SwitchClass::Switch => "hi-switch",
            SwitchClass::Sm => "hi-switch-sm",
            SwitchClass::Md => "hi-switch-md",
            SwitchClass::Lg => "hi-switch-lg",
            SwitchClass::Checked => "hi-switch-checked",
            SwitchClass::Disabled => "hi-switch-disabled",
            SwitchClass::TextVariant => "hi-switch-text-variant",
            SwitchClass::IconVariant => "hi-switch-icon-variant",
            SwitchClass::CustomVariant => "hi-switch-custom-variant",
            SwitchClass::ColorPrimary => "hi-switch-color-primary",
            SwitchClass::ColorSecondary => "hi-switch-color-secondary",
            SwitchClass::Glow => "hi-switch-glow",
            SwitchClass::ThumbText => "hi-switch-thumb-text",
            SwitchClass::ThumbIcon => "hi-switch-thumb-icon",
            SwitchClass::ThumbImage => "hi-switch-thumb-image",
            SwitchClass::ThumbDot => "hi-switch-thumb-dot",
            SwitchClass::Label => "hi-switch-label",
            SwitchClass::Track => "hi-switch-track",
            SwitchClass::Thumb => "hi-switch-thumb",
            SwitchClass::SwitchText => "hi-switch-text",
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
            SliderClass::Slider => "hi-slider",
            SliderClass::Sm => "hi-slider-sm",
            SliderClass::Md => "hi-slider-md",
            SliderClass::Lg => "hi-slider-lg",
            SliderClass::Disabled => "hi-slider-disabled",
            SliderClass::Rail => "hi-slider-rail",
            SliderClass::Track => "hi-slider-track",
            SliderClass::Handle => "hi-slider-handle",
            SliderClass::Input => "hi-slider-input",
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
            SelectClass::SelectTrigger => "hi-select-trigger",
            SelectClass::Sm => "hi-select-sm",
            SelectClass::Md => "hi-select-md",
            SelectClass::Lg => "hi-select-lg",
            SelectClass::Disabled => "hi-select-disabled",
            SelectClass::Open => "hi-select-open",
            SelectClass::Select => "hi-select",
            SelectClass::Dropdown => "hi-select-dropdown",
            SelectClass::Option => "hi-select-option",
            SelectClass::OptionSelected => "hi-select-option-selected",
            SelectClass::Value => "hi-select-value",
            SelectClass::Placeholder => "hi-select-placeholder",
            SelectClass::Arrow => "hi-select-arrow",
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
            DatePickerClass::DatePickerWrapper => "hi-date-picker-wrapper",
            DatePickerClass::DatePicker => "hi-date-picker",
            DatePickerClass::Disabled => "hi-date-picker-disabled",
            DatePickerClass::Icon => "hi-date-picker-icon",
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
            FileUploadClass::FileUploadWrapper => "hi-file-upload-wrapper",
            FileUploadClass::FileUpload => "hi-file-upload",
            FileUploadClass::Idle => "hi-file-upload-idle",
            FileUploadClass::Dragging => "hi-file-upload-dragging",
            FileUploadClass::Uploading => "hi-file-upload-uploading",
            FileUploadClass::Success => "hi-file-upload-success",
            FileUploadClass::Error => "hi-file-upload-error",
            FileUploadClass::Area => "hi-file-upload-area",
            FileUploadClass::Icon => "hi-file-upload-icon",
            FileUploadClass::Text => "hi-file-upload-text",
            FileUploadClass::Preview => "hi-file-upload-preview",
            FileUploadClass::File => "hi-file-upload-file",
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
            FormFieldClass::FormField => "hi-form-field",
            FormFieldClass::Error => "hi-form-field-error",
            FormFieldClass::Warning => "hi-form-field-warning",
            FormFieldClass::Success => "hi-form-field-success",
            FormFieldClass::Required => "hi-form-field-required",
            FormFieldClass::Label => "hi-form-field-label",
            FormFieldClass::Help => "hi-form-field-help",
            FormFieldClass::ErrorMsg => "hi-form-field-error-msg",
            FormFieldClass::SuccessMsg => "hi-form-field-success-msg",
            FormFieldClass::WarningMsg => "hi-form-field-warning-msg",
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
            AutoCompleteClass::Wrapper => "hi-autocomplete-wrapper",
            AutoCompleteClass::Input => "hi-autocomplete-input",
            AutoCompleteClass::Clear => "hi-autocomplete-clear",
            AutoCompleteClass::Dropdown => "hi-autocomplete-dropdown",
            AutoCompleteClass::Show => "hi-autocomplete-show",
            AutoCompleteClass::Option => "hi-autocomplete-option",
            AutoCompleteClass::OptionFocused => "hi-autocomplete-option-focused",
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
            CascaderClass::Wrapper => "hi-cascader-wrapper",
            CascaderClass::Cascader => "hi-cascader",
            CascaderClass::Sm => "hi-cascader-sm",
            CascaderClass::Md => "hi-cascader-md",
            CascaderClass::Lg => "hi-cascader-lg",
            CascaderClass::Disabled => "hi-cascader-disabled",
            CascaderClass::Open => "hi-cascader-open",
            CascaderClass::Display => "hi-cascader-display",
            CascaderClass::Text => "hi-cascader-text",
            CascaderClass::Clear => "hi-cascader-clear",
            CascaderClass::Arrow => "hi-cascader-arrow",
            CascaderClass::Dropdown => "hi-cascader-dropdown",
            CascaderClass::Menu => "hi-cascader-menu",
            CascaderClass::MenuList => "hi-cascader-menu-list",
            CascaderClass::MenuItem => "hi-cascader-menu-item",
            CascaderClass::MenuItemSelected => "hi-cascader-menu-item-selected",
            CascaderClass::MenuItemDisabled => "hi-cascader-menu-item-disabled",
            CascaderClass::MenuItemArrow => "hi-cascader-menu-item-arrow",
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
            NumberInputClass::Wrapper => "hi-number-input-wrapper",
            NumberInputClass::Button => "hi-number-input-button",
            NumberInputClass::Input => "hi-number-input-input",
            NumberInputClass::Sm => "hi-number-input-sm",
            NumberInputClass::Md => "hi-number-input-md",
            NumberInputClass::Lg => "hi-number-input-lg",
            NumberInputClass::Btn => "hi-number-input-btn",
            NumberInputClass::BtnDecrement => "hi-number-input-btn-decrement",
            NumberInputClass::BtnIncrement => "hi-number-input-btn-increment",
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
            SearchClass::Wrapper => "hi-search-wrapper",
            SearchClass::Input => "hi-search-input",
            SearchClass::Clear => "hi-search-clear",
            SearchClass::Loading => "hi-search-loading",
            SearchClass::InputContainer => "hi-search-input-container",
            SearchClass::SuggestionsDropdown => "hi-search-suggestions-dropdown",
            SearchClass::SuggestionItem => "hi-search-suggestion-item",
            SearchClass::SuggestionIcon => "hi-search-suggestion-icon",
            SearchClass::InputWrapper => "hi-search-input-wrapper",
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
            InputWrapperClass::Wrapper => "hi-input-wrapper",
            InputWrapperClass::SizeSm => "hi-input-wrapper-sm",
            InputWrapperClass::SizeMd => "hi-input-wrapper-md",
            InputWrapperClass::SizeLg => "hi-input-wrapper-lg",
            InputWrapperClass::Disabled => "hi-input-wrapper-disabled",
            InputWrapperClass::LeftSection => "hi-input-wrapper-left",
            InputWrapperClass::RightSection => "hi-input-wrapper-right",
            InputWrapperClass::InputSection => "hi-input-wrapper-input",
            InputWrapperClass::SideItem => "hi-input-wrapper-item",
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
            TransferClass::Transfer => "hi-transfer",
            TransferClass::Operations => "hi-transfer-operations",
            TransferClass::Operation => "hi-transfer-operation",
            TransferClass::Panel => "hi-transfer-panel",
            TransferClass::PanelHeader => "hi-transfer-panel-header",
            TransferClass::PanelCheckbox => "hi-transfer-panel-checkbox",
            TransferClass::PanelTitle => "hi-transfer-panel-title",
            TransferClass::PanelCount => "hi-transfer-panel-count",
            TransferClass::PanelSearch => "hi-transfer-panel-search",
            TransferClass::PanelInput => "hi-transfer-panel-input",
            TransferClass::PanelList => "hi-transfer-panel-list",
            TransferClass::PanelItem => "hi-transfer-panel-item",
            TransferClass::PanelItemSelected => "hi-transfer-panel-item-selected",
            TransferClass::PanelItemDisabled => "hi-transfer-panel-item-disabled",
            TransferClass::PanelEmpty => "hi-transfer-panel-empty",
            TransferClass::ItemCheckbox => "hi-transfer-item-checkbox",
            TransferClass::ItemLabel => "hi-transfer-item-label",
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
            AvatarClass::Avatar => "hi-avatar",
            AvatarClass::AvatarXs => "hi-avatar-xs",
            AvatarClass::AvatarSm => "hi-avatar-sm",
            AvatarClass::AvatarMd => "hi-avatar-md",
            AvatarClass::AvatarLg => "hi-avatar-lg",
            AvatarClass::AvatarXl => "hi-avatar-xl",
            AvatarClass::AvatarCircular => "hi-avatar-circular",
            AvatarClass::AvatarRounded => "hi-avatar-rounded",
            AvatarClass::AvatarSquare => "hi-avatar-square",
            AvatarClass::AvatarFallback => "hi-avatar-fallback",
            AvatarClass::AvatarIcon => "hi-avatar-icon",
            AvatarClass::AvatarImg => "hi-avatar-img",
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
