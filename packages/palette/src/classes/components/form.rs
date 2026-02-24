//! Form component classes (Input, Checkbox, Radio, Select, etc.)

use serde::{Deserialize, Serialize};

use crate::classes::UtilityClass;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Input {
    Input,
    Wrapper,
}

impl UtilityClass for Input {
    fn as_suffix(&self) -> &'static str {
        match self {
            Input::Input => "input",
            Input::Wrapper => "input-wrapper",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum InputClass {
    Input,
    InputWrapper,
    InputSm,
    InputMd,
    InputLg,
    InputDisabled,
    InputPrefix,
    InputSuffix,
}

impl UtilityClass for InputClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            InputClass::Input => "input",
            InputClass::InputWrapper => "input-wrapper",
            InputClass::InputSm => "input-sm",
            InputClass::InputMd => "input-md",
            InputClass::InputLg => "input-lg",
            InputClass::InputDisabled => "input-disabled",
            InputClass::InputPrefix => "input-prefix",
            InputClass::InputSuffix => "input-suffix",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
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

impl UtilityClass for CheckboxClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            CheckboxClass::Checkbox => "checkbox",
            CheckboxClass::Sm => "checkbox-sm",
            CheckboxClass::Md => "checkbox-md",
            CheckboxClass::Lg => "checkbox-lg",
            CheckboxClass::Checked => "checkbox-checked",
            CheckboxClass::Disabled => "checkbox-disabled",
            CheckboxClass::Label => "checkbox-label",
            CheckboxClass::Input => "checkbox-input",
            CheckboxClass::Icon => "checkbox-icon",
            CheckboxClass::Text => "checkbox-text",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum RadioClass {
    RadioGroup,
    RadioGroupVertical,
    RadioGroupHorizontal,
    Label,
    Indicator,
    Dot,
    Text,
}

impl UtilityClass for RadioClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            RadioClass::RadioGroup => "radio-group",
            RadioClass::RadioGroupVertical => "radio-group-vertical",
            RadioClass::RadioGroupHorizontal => "radio-group-horizontal",
            RadioClass::Label => "radio-label",
            RadioClass::Indicator => "radio-indicator",
            RadioClass::Dot => "radio-dot",
            RadioClass::Text => "radio-text",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SwitchClass {
    Switch,
    Sm,
    Md,
    Lg,
    Checked,
    Disabled,
}

impl UtilityClass for SwitchClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            SwitchClass::Switch => "switch",
            SwitchClass::Sm => "switch-sm",
            SwitchClass::Md => "switch-md",
            SwitchClass::Lg => "switch-lg",
            SwitchClass::Checked => "switch-checked",
            SwitchClass::Disabled => "switch-disabled",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SliderClass {
    Slider,
    Sm,
    Md,
    Lg,
    Disabled,
}

impl UtilityClass for SliderClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            SliderClass::Slider => "slider",
            SliderClass::Sm => "slider-sm",
            SliderClass::Md => "slider-md",
            SliderClass::Lg => "slider-lg",
            SliderClass::Disabled => "slider-disabled",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SelectClass {
    SelectTrigger,
    Sm,
    Md,
    Lg,
    Disabled,
    Open,
}

impl UtilityClass for SelectClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            SelectClass::SelectTrigger => "select-trigger",
            SelectClass::Sm => "select-sm",
            SelectClass::Md => "select-md",
            SelectClass::Lg => "select-lg",
            SelectClass::Disabled => "select-disabled",
            SelectClass::Open => "select-open",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum DatePickerClass {
    DatePickerWrapper,
    DatePicker,
}

impl UtilityClass for DatePickerClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            DatePickerClass::DatePickerWrapper => "date-picker-wrapper",
            DatePickerClass::DatePicker => "date-picker",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum FileUploadClass {
    FileUploadWrapper,
    FileUpload,
    Idle,
    Dragging,
    Uploading,
    Success,
    Error,
}

impl UtilityClass for FileUploadClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            FileUploadClass::FileUploadWrapper => "file-upload-wrapper",
            FileUploadClass::FileUpload => "file-upload",
            FileUploadClass::Idle => "file-upload-idle",
            FileUploadClass::Dragging => "file-upload-dragging",
            FileUploadClass::Uploading => "file-upload-uploading",
            FileUploadClass::Success => "file-upload-success",
            FileUploadClass::Error => "file-upload-error",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum FormFieldClass {
    FormField,
}

impl UtilityClass for FormFieldClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            FormFieldClass::FormField => "form-field",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum AutoCompleteClass {
    Wrapper,
    Input,
    Clear,
    Dropdown,
    Show,
    Option,
    OptionFocused,
}

impl UtilityClass for AutoCompleteClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            AutoCompleteClass::Wrapper => "autocomplete-wrapper",
            AutoCompleteClass::Input => "autocomplete-input",
            AutoCompleteClass::Clear => "autocomplete-clear",
            AutoCompleteClass::Dropdown => "autocomplete-dropdown",
            AutoCompleteClass::Show => "autocomplete-show",
            AutoCompleteClass::Option => "autocomplete-option",
            AutoCompleteClass::OptionFocused => "autocomplete-option-focused",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
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

impl UtilityClass for CascaderClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            CascaderClass::Wrapper => "cascader-wrapper",
            CascaderClass::Cascader => "cascader",
            CascaderClass::Sm => "cascader-sm",
            CascaderClass::Md => "cascader-md",
            CascaderClass::Lg => "cascader-lg",
            CascaderClass::Disabled => "cascader-disabled",
            CascaderClass::Open => "cascader-open",
            CascaderClass::Display => "cascader-display",
            CascaderClass::Text => "cascader-text",
            CascaderClass::Clear => "cascader-clear",
            CascaderClass::Arrow => "cascader-arrow",
            CascaderClass::Dropdown => "cascader-dropdown",
            CascaderClass::Menu => "cascader-menu",
            CascaderClass::MenuList => "cascader-menu-list",
            CascaderClass::MenuItem => "cascader-menu-item",
            CascaderClass::MenuItemSelected => "cascader-menu-item-selected",
            CascaderClass::MenuItemDisabled => "cascader-menu-item-disabled",
            CascaderClass::MenuItemArrow => "cascader-menu-item-arrow",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum NumberInputClass {
    Wrapper,
    Button,
    Input,
}

impl UtilityClass for NumberInputClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            NumberInputClass::Wrapper => "number-input-wrapper",
            NumberInputClass::Button => "number-input-button",
            NumberInputClass::Input => "number-input-input",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SearchClass {
    Wrapper,
    Input,
    Clear,
    Loading,
}

impl UtilityClass for SearchClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            SearchClass::Wrapper => "search-wrapper",
            SearchClass::Input => "search-input",
            SearchClass::Clear => "search-clear",
            SearchClass::Loading => "search-loading",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
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

impl UtilityClass for InputWrapperClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            InputWrapperClass::Wrapper => "input-wrapper",
            InputWrapperClass::SizeSm => "input-wrapper-sm",
            InputWrapperClass::SizeMd => "input-wrapper-md",
            InputWrapperClass::SizeLg => "input-wrapper-lg",
            InputWrapperClass::Disabled => "input-wrapper-disabled",
            InputWrapperClass::LeftSection => "input-wrapper-left",
            InputWrapperClass::RightSection => "input-wrapper-right",
            InputWrapperClass::InputSection => "input-wrapper-input",
            InputWrapperClass::SideItem => "input-wrapper-item",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
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

impl UtilityClass for TransferClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            TransferClass::Transfer => "transfer",
            TransferClass::Operations => "transfer-operations",
            TransferClass::Operation => "transfer-operation",
            TransferClass::Panel => "transfer-panel",
            TransferClass::PanelHeader => "transfer-panel-header",
            TransferClass::PanelCheckbox => "transfer-panel-checkbox",
            TransferClass::PanelTitle => "transfer-panel-title",
            TransferClass::PanelCount => "transfer-panel-count",
            TransferClass::PanelSearch => "transfer-panel-search",
            TransferClass::PanelInput => "transfer-panel-input",
            TransferClass::PanelList => "transfer-panel-list",
            TransferClass::PanelItem => "transfer-panel-item",
            TransferClass::PanelItemSelected => "transfer-panel-item-selected",
            TransferClass::PanelItemDisabled => "transfer-panel-item-disabled",
            TransferClass::PanelEmpty => "transfer-panel-empty",
            TransferClass::ItemCheckbox => "transfer-item-checkbox",
            TransferClass::ItemLabel => "transfer-item-label",
        }
    }
}
