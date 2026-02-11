// hi-components/src/layout/container.rs
// Container component for responsive content wrapping

use dioxus::prelude::*;
use palette::classes::{ClassesBuilder, ContainerClass};

#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum ContainerSize {
    #[default]
    Medium,
    Small,
    Large,
    Xl,
}

#[derive(Clone, PartialEq, Props)]
pub struct ContainerProps {
    /// Container content
    #[props(default)]
    pub children: Element,

    /// Container size preset
    #[props(default)]
    pub size: ContainerSize,

    /// Custom max-width
    #[props(default)]
    pub max_width: Option<String>,

    /// Center content
    #[props(default = false)]
    pub center: bool,

    /// Additional CSS classes
    #[props(default)]
    pub class: String,
}

impl ContainerSize {
    pub fn max_width(&self) -> &'static str {
        match self {
            ContainerSize::Small => "640px",
            ContainerSize::Medium => "960px",
            ContainerSize::Large => "1200px",
            ContainerSize::Xl => "1400px",
        }
    }
}

/// Container component for responsive content wrapping
///
/// # Examples
///
/// ```rust
/// use dioxus::prelude::*;
/// use hikari_components::{Container, ContainerSize};
///
/// fn app() -> Element {
///     rsx! {
///         Container {
///             size: ContainerSize::Medium,
///             h1 { "Hello Hikari!" }
///         }
///     }
/// }
/// ```
#[component]
pub fn Container(props: ContainerProps) -> Element {
    let size_class = match props.size {
        ContainerSize::Small => ContainerClass::Sm,
        ContainerSize::Medium => ContainerClass::Md,
        ContainerSize::Large => ContainerClass::Lg,
        ContainerSize::Xl => ContainerClass::Xl,
    };

    let container_classes = ClassesBuilder::new()
        .add(ContainerClass::Container)
        .add(size_class)
        .add_if(ContainerClass::Centered, || props.center)
        .add_raw(&props.class)
        .build();

    let max_width = props
        .max_width
        .unwrap_or_else(|| props.size.max_width().to_string());

    let center_style = if props.center {
        "margin-left: auto; margin-right: auto;"
    } else {
        ""
    };

    rsx! {
        div {
            class: "{container_classes}",
            style: "max-width: {max_width}; {center_style}",
            { props.children }
        }
    }
}

/// Container component's type wrapper for StyledComponent
pub struct ContainerComponent;

impl crate::styled::StyledComponent for ContainerComponent {
    fn styles() -> &'static str {
        r#"
.hi-container {
  width: 100%;
  padding-left: 16px;
  padding-right: 16px;
  box-sizing: border-box;
}

.hi-container-centered {
  margin-left: auto;
  margin-right: auto;
}

.hi-container-sm {
  max-width: 640px;
}

.hi-container-md {
  max-width: 960px;
}

.hi-container-lg {
  max-width: 1200px;
}

.hi-container-xl {
  max-width: 1400px;
}

[data-theme="dark"] .hi-container {
  background: var(--hi-surface);
}
"#
    }

    fn name() -> &'static str {
        "container"
    }
}
