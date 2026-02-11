// hi-components/src/feedback/spin.rs
// Spin component with Arknights + FUI styling

use dioxus::prelude::*;
use palette::classes::{ClassesBuilder, SpinClass, UtilityClass};

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
    #[cfg(target_arch = "wasm32")]
    Loading,
    #[cfg(target_arch = "wasm32")]
    Success,
}

#[derive(Clone, PartialEq, Props)]
pub struct SpinProps {
    /// Spin size
    #[props(default)]
    pub size: SpinSize,

    /// Whether to show tip text
    #[props(default)]
    pub tip: SpinTip,

    /// Custom tip text (overrides tip enum)
    #[props(default)]
    pub custom_tip: Option<String>,

    /// Whether to delay loading
    #[props(default)]
    pub delay: Option<u64>,

    /// Whether to spin (can be controlled externally)
    #[props(default)]
    pub spinning: bool,

    /// Additional CSS class
    #[props(default)]
    pub class: String,
}

/// Spin component with loading animation
///
/// A loading spinner with optional tip text.
///
/// # Examples
///
/// ## Basic Usage
/// ```rust
/// use dioxus::prelude::*;
/// use hikari_components::Spin;
///
/// fn app() -> Element {
///     rsx! {
///         Spin {}
///     }
/// }
/// ```
///
/// ## With Size
/// ```rust
/// use dioxus::prelude::*;
/// use hikari_components::{Spin, SpinSize};
///
/// fn app() -> Element {
///     rsx! {
///         Spin { size: SpinSize::Large }
///     }
/// }
/// ```
#[component]
pub fn Spin(props: SpinProps) -> Element {
    let size_class = match props.size {
        SpinSize::Small => SpinClass::Sm,
        SpinSize::Medium => SpinClass::Md,
        SpinSize::Large => SpinClass::Lg,
    };

    let spin_classes = ClassesBuilder::new()
        .add(SpinClass::Spin)
        .add(size_class)
        .add_if(SpinClass::Stopped, || !props.spinning)
        .add_raw(&props.class)
        .build();

    let tip_text = if let Some(custom) = props.custom_tip {
        custom
    } else {
        match props.tip {
            SpinTip::None => String::new(),
            #[cfg(target_arch = "wasm32")]
            SpinTip::Loading => "加载中...".to_string(),
            #[cfg(target_arch = "wasm32")]
            SpinTip::Success => "加载成功".to_string(),
        }
    };

    rsx! {
        div { class: "{spin_classes}",
            div { class: "{SpinClass::Spinner.as_class()}" }
            if !tip_text.is_empty() {
                div { class: "{SpinClass::Tip.as_class()}",
                    "{tip_text}"
                }
            }
        }
    }
}

/// Spin component's type wrapper for StyledComponent
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
  animation: hi-spin-rotate 0.9s linear infinite;
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
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
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
