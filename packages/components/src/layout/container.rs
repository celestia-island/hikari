// hi-components/src/layout/container.rs
// Container component for responsive content wrapping

use hikari_palette::classes::{ClassesBuilder, ContainerClass};

use crate::{prelude::*, theme::use_layout_direction};

#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum ContainerSize {
    #[default]
    Medium,
    Small,
    Large,
    Xl,
}

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

///
///
///
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
        .add(ContainerClass::Container)
        .add(size_class)
        .add_if(ContainerClass::Centered, || props.center);

    if is_rtl {
        builder = builder.add_raw("hk-container-rtl");
    }

    let container_classes = builder.add_raw(&props.class).build();

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
.hk-container {
  width: 80%;
  margin-left: 10%;
  margin-right: 10%;
  box-sizing: border-box;
}

.hk-container-centered {
  margin-left: auto;
  margin-right: auto;
}

.hk-container-sm {
  max-width: 640px;
}

.hk-container-md {
  max-width: 960px;
}

.hk-container-lg {
  max-width: 1200px;
}

.hk-container-xl {
  max-width: 1400px;
}

[data-theme="dark"] .hk-container {
  background: var(--hi-surface);
}
"#
    }

    fn name() -> &'static str {
        "container"
    }
}
