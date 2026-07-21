// hi-components/src/basic/textarea.rs
// Textarea component with Arknights + FUI styling

use hikari_palette::classes::{ClassesBuilder, InputClass};

use crate::{prelude::*, styled::StyledComponent};

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum TextareaSize {
    #[default]
    Medium,
    Small,
    Large,
}

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum TextareaStatus {
    #[default]
    Default,
    Error,
    Success,
}

#[define_props]
pub struct TextareaProps {
    #[default]
    pub value: String,

    #[default]
    pub oninput: Option<EventHandler<String>>,

    #[default]
    pub placeholder: Option<String>,

    #[default]
    pub disabled: bool,

    #[default]
    pub readonly: bool,

    #[default(3)]
    pub rows: u32,

    #[default]
    pub size: TextareaSize,

    #[default]
    pub maxlength: Option<u32>,

    #[default]
    pub class: String,

    pub status: TextareaStatus,
}

///
///
///
///
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
        .add_if(InputClass::InputError, || {
            matches!(props.status, TextareaStatus::Error)
        })
        .add_if(InputClass::InputSuccess, || {
            matches!(props.status, TextareaStatus::Success)
        })
        .add_raw(&props.class)
        .build();

    rsx! {
        textarea {
            class: textarea_classes,
            disabled: props.disabled,
            readonly: props.readonly,
            placeholder: props.placeholder.unwrap_or_default(),
            value: "{props.value}",
            rows: props.rows,
            maxlength: props.maxlength.unwrap_or(0),
            oninput: move |e: InputEvent| {
                if let Some(handler) = props.oninput.as_ref() {
                    handler.call(e.data.clone());
                }
            },
        }
    }
}

pub struct TextareaComponent;

impl StyledComponent for TextareaComponent {
    fn styles() -> &'static str {
        r#"
.hk-input {
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

.hk-input:focus {
  outline: none;
  border-color: var(--hi-color-primary);
  box-shadow: 0 0 0 3px rgba(0, 160, 233, 0.1);
}

.hk-input::placeholder {
  color: var(--hi-text-secondary);
}

.hk-input-sm {
  padding: 8px 12px;
  font-size: 13px;
}

.hk-input-md {
  padding: 10px 16px;
  font-size: 14px;
}

.hk-input-lg {
  padding: 12px 20px;
  font-size: 15px;
}

.hk-input-disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: var(--hi-surface-light);
}

[data-theme="dark"] .hk-input {
  background: var(--hi-background);
  border-color: var(--hi-border);
  color: var(--hi-text-primary);
}

[data-theme="dark"] .hk-input:focus {
  background: var(--hi-background);
  border-color: var(--hi-color-primary);
  box-shadow: 0 0 0 3px rgba(0, 160, 233, 0.1);
}

[data-theme="dark"] .hk-input::placeholder {
  color: var(--hi-text-secondary);
}

[data-theme="dark"] .hk-input-disabled {
  background: var(--hi-surface);
}
"#
    }

    fn name() -> &'static str {
        "textarea"
    }
}
