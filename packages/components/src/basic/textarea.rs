// hi-components/src/basic/textarea.rs
// Textarea component with Arknights + FUI styling

use dioxus::prelude::*;
use palette::classes::{ClassesBuilder, InputClass};

use crate::styled::StyledComponent;

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum TextareaSize {
    #[default]
    Medium,
    Small,
    Large,
}

#[derive(Clone, PartialEq, Props)]
pub struct TextareaProps {
    /// Current value
    #[props(default)]
    pub value: String,

    /// Callback when value changes
    #[props(default)]
    pub oninput: Option<EventHandler<String>>,

    /// Placeholder text
    #[props(default)]
    pub placeholder: Option<String>,

    /// Whether textarea is disabled
    #[props(default)]
    pub disabled: bool,

    /// Whether textarea is readonly
    #[props(default)]
    pub readonly: bool,

    /// Number of rows
    #[props(default = 3)]
    pub rows: u32,

    /// Textarea size
    #[props(default)]
    pub size: TextareaSize,

    /// Maximum character count
    #[props(default)]
    pub maxlength: Option<u32>,

    /// Additional CSS class
    #[props(default)]
    pub class: String,
}

impl Default for TextareaProps {
    fn default() -> Self {
        Self {
            value: String::default(),
            oninput: None,
            placeholder: None,
            disabled: false,
            readonly: false,
            rows: 3,
            size: Default::default(),
            maxlength: None,
            class: String::default(),
        }
    }
}

/// Textarea component with resize support
///
/// A multi-line text input with configurable size.
///
/// # Examples
///
/// ## Basic Usage
/// ```rust
/// use dioxus::prelude::*;
/// use hikari_components::Textarea;
///
/// fn app() -> Element {
///     rsx! {
///         Textarea {
///             placeholder: "Enter your message",
///             rows: 4,
///         }
///     }
/// }
/// ```
#[component]
pub fn Textarea(props: TextareaProps) -> Element {
    let size_class = match props.size {
        TextareaSize::Small => InputClass::InputSm,
        TextareaSize::Medium => InputClass::InputMd,
        TextareaSize::Large => InputClass::InputLg,
    };

    let textarea_classes = ClassesBuilder::new()
        .add(InputClass::Input)
        .add(size_class)
        .add_if(InputClass::InputDisabled, || props.disabled)
        .add_raw(&props.class)
        .build();

    rsx! {
        textarea {
            class: "{textarea_classes}",
            disabled: props.disabled,
            readonly: props.readonly,
            placeholder: props.placeholder.unwrap_or_default(),
            value: "{props.value}",
            rows: props.rows,
            maxlength: props.maxlength.unwrap_or(0),
            oninput: move |e| {
                if let Some(handler) = props.oninput.as_ref() {
                    handler.call(e.value());
                }
            }
        }
    }
}

/// Textarea component's type wrapper for StyledComponent
pub struct TextareaComponent;

impl StyledComponent for TextareaComponent {
    fn styles() -> &'static str {
        r#"
.hi-input {
  width: 100%;
  padding: 10px 16px;
  font-size: 14px;
  line-height: 1.5;
  color: var(--hi-text-primary);
  background: var(--hi-surface);
  border: 1px solid var(--hi-border);
  border-radius: 6px;
  transition: all 0.2s;
  font-family: inherit;
  resize: vertical;
}

.hi-input:focus {
  outline: none;
  border-color: var(--hi-color-primary);
  box-shadow: 0 0 0 3px rgba(0, 160, 233, 0.1);
}

.hi-input::placeholder {
  color: var(--hi-text-secondary);
}

.hi-input-sm {
  padding: 8px 12px;
  font-size: 13px;
}

.hi-input-md {
  padding: 10px 16px;
  font-size: 14px;
}

.hi-input-lg {
  padding: 12px 20px;
  font-size: 15px;
}

.hi-input-disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: var(--hi-surface-light);
}

[data-theme="dark"] .hi-input {
  background: var(--hi-background);
  border-color: var(--hi-border);
  color: var(--hi-text-primary);
}

[data-theme="dark"] .hi-input:focus {
  background: var(--hi-background);
  border-color: var(--hi-color-primary);
  box-shadow: 0 0 0 3px rgba(0, 160, 233, 0.1);
}

[data-theme="dark"] .hi-input::placeholder {
  color: var(--hi-text-secondary);
}

[data-theme="dark"] .hi-input-disabled {
  background: var(--hi-surface);
}
"#
    }

    fn name() -> &'static str {
        "textarea"
    }
}
