// hi-components/src/layout/container.rs
// Container component for responsive content wrapping

use hikari_palette::classes::{ClassesBuilder, ContainerClass};

use crate::prelude::*;
use crate::theme::use_layout_direction;

#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum ContainerSize {
    #[default]
    Medium,
    Small,
    Large,
    Xl,
}

/// Props for the [`Container`] component.
#[define_props]
pub struct ContainerProps {
    #[default]
    pub children: Element,

    #[default]
    pub size: ContainerSize,

    #[default]
    pub max_width: Option<String>,

    #[default(false)]
    pub center: bool,

    #[default]
    pub rtl: Option<bool>,

    #[default]
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

/// A responsive container that wraps content with a configurable max-width and optional centering.
#[component]
pub fn Container(props: ContainerProps) -> Element {
    let layout_direction = use_layout_direction();
    let is_rtl = props.rtl.unwrap_or_else(|| layout_direction.is_rtl());

    let size_class = match props.size {
        ContainerSize::Small => ContainerClass::Sm,
        ContainerSize::Medium => ContainerClass::Md,
        ContainerSize::Large => ContainerClass::Lg,
        ContainerSize::Xl => ContainerClass::Xl,
    };

    let mut builder = ClassesBuilder::new()
        .add_typed(ContainerClass::Container)
        .add_typed(size_class)
        .add_typed_if(ContainerClass::Centered, props.center);

    if is_rtl {
        builder = builder.add_typed(ContainerClass::Rtl);
    }

    let container_classes = builder.add(&props.class).build();

    let max_width = props
        .max_width
        .unwrap_or_else(|| props.size.max_width().to_string());

    let center_style = if props.center {
        "margin-inline-start: auto; margin-inline-end: auto;"
    } else {
        { "" }
    };

    rsx! {
        div {
            class: container_classes,
            style: "max-width: {max_width}; {center_style}",
            {props.children}
        }
    }
}

pub struct ContainerComponent;

impl crate::styled::StyledComponent for ContainerComponent {
    fn styles() -> &'static str {
        r#"
.hi-container {
  width: 80%;
  margin-left: 10%;
  margin-right: 10%;
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
