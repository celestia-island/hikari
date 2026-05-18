use hikari_palette::classes::{ClassesBuilder, SpinClass, TypedClass};

use crate::prelude::*;
use crate::styled::StyledComponent;

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum SpinSize {
    #[default]
    Medium,
    Small,
    Large,
}

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum SpinTip {
    #[default]
    None,
    Loading,
    Success,
}

#[define_props]
pub struct SpinProps {
    pub size: SpinSize,
    pub tip: SpinTip,
    pub custom_tip: Option<String>,
    pub delay: Option<u64>,
    pub spinning: bool,
    pub class: String,
}

#[component]
pub fn Spin(props: SpinProps) -> Element {
    let size_class = match props.size {
        SpinSize::Small => SpinClass::Sm,
        SpinSize::Medium => SpinClass::Md,
        SpinSize::Large => SpinClass::Lg,
    };

    let spin_classes = ClassesBuilder::new()
        .add_typed(SpinClass::Spin)
        .add_typed(size_class)
        .add_typed_if(SpinClass::Stopped, !props.spinning)
        .add(&props.class)
        .build();

    let tip_text = if let Some(custom) = props.custom_tip {
        custom
    } else {
        match props.tip {
            SpinTip::None => String::new(),
            SpinTip::Loading => "加载中...".to_string(),
            SpinTip::Success => "加载成功".to_string(),
        }
    };

    rsx! {
        div { class: spin_classes,
            div {
                class: SpinClass::Spinner.class_name(),
            }
            if !tip_text.is_empty() {
                div { class: SpinClass::Tip.class_name(), "{tip_text}" }
            }
        }
    }
}

pub struct SpinComponent;

impl StyledComponent for SpinComponent {
    fn styles() -> &'static str {
        r#"
.hi-spin {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.hi-spin-spinner {
  border-radius: 50%;
  border: 3px solid var(--hi-border);
  border-top-color: var(--hi-color-primary);
  animation: hi-spin-rotate 0.6s linear infinite;
}

.hi-spin-sm .hi-spin-spinner {
  width: 16px;
  height: 16px;
  border-width: 2px;
}

.hi-spin-md .hi-spin-spinner {
  width: 24px;
  height: 24px;
  border-width: 3px;
}

.hi-spin-lg .hi-spin-spinner {
  width: 32px;
  height: 32px;
  border-width: 4px;
}

.hi-spin-stopped .hi-spin-spinner {
  animation: none;
  opacity: 0.3;
}

@keyframes hi-spin-rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.hi-spin-tip {
  font-size: 14px;
  color: var(--hi-text-secondary);
  line-height: 1.5;
}

[data-theme="dark"] .hi-spin-spinner {
  border-color: var(--hi-border);
  border-top-color: var(--hi-color-primary);
}

[data-theme="dark"] .hi-spin-tip {
  color: var(--hi-text-secondary);
}
"#
    }

    fn name() -> &'static str {
        "spin"
    }
}
