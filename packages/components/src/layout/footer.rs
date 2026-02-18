// hi-components/src/layout/footer.rs
// Footer component for application footer

use dioxus::prelude::*;
use palette::classes::{components::Footer as FooterClass, ClassesBuilder};

#[derive(Clone, PartialEq, Props)]
pub struct FooterProps {
    /// Footer content
    #[props(default)]
    pub children: Element,

    /// Additional CSS classes
    #[props(default)]
    pub class: String,
}

/// Footer component for application footer
///
/// # Examples
///
/// ```rust
/// use dioxus::prelude::*;
/// use hikari_components::Footer;
///
/// fn app() -> Element {
///     rsx! {
///         Footer {
///             "© 2026 Hikari. All rights reserved."
///         }
///     }
/// }
/// ```
#[component]
pub fn Footer(props: FooterProps) -> Element {
    let footer_classes = ClassesBuilder::new()
        .add(FooterClass::Footer)
        .add_raw(&props.class)
        .build();

    rsx! {
        footer {
            class: "{footer_classes}",
            { props.children }
        }
    }
}

/// Footer component's type wrapper for StyledComponent
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
