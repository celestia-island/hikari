// hi-components/src/layout/footer.rs
// Footer component for application footer

use hikari_palette::classes::ClassesBuilder;
use hikari_palette::classes::components::Footer as FooterClass;

use crate::prelude::*;

/// Props for the [`Footer`] component.
#[define_props]
pub struct FooterProps {
    #[default]
    pub children: Element,

    #[default]
    pub class: String,
}

/// Application footer rendered as an HTML `<footer>` element with themed styling.
#[component]
pub fn Footer(props: FooterProps) -> Element {
    let footer_classes = ClassesBuilder::new()
        .add_typed(FooterClass::Footer)
        .add(&props.class)
        .build();

    rsx! {
        footer { class: footer_classes, {props.children} }
    }
}

pub struct FooterComponent;

impl crate::styled::StyledComponent for FooterComponent {
    fn styles() -> &'static str {
        r#"
.hi-footer {
  width: 100%;
  padding: 24px 16px;
  background: var(--hi-surface);
  border-top: 1px solid var(--hi-border);
  text-align: center;
  color: var(--hi-text-secondary);
  font-size: 14px;
}

[data-theme="dark"] .hi-footer {
  background: var(--hi-background);
  border-top-color: var(--hi-border);
  color: var(--hi-text-secondary);
}
"#
    }

    fn name() -> &'static str {
        "footer"
    }
}
