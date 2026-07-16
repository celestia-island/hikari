// hi-components/src/basic/link.rs
// Link component — styled anchor with hover underline

use crate::prelude::*;
use crate::styled::StyledComponent;

#[define_props]
pub struct LinkProps {
    #[default = "#"]
    pub href: String,

    #[default]
    pub target: String,

    #[default]
    pub class: String,

    #[default]
    pub style: String,

    pub children: Element,
}

#[component]
pub fn Link(props: LinkProps) -> Element {
    let classes = if props.class.is_empty() {
        "hi-link".to_string()
    } else {
        format!("hi-link {}", props.class)
    };

    rsx! {
        a {
            class: classes,
            href: props.href,
            target: if props.target.is_empty() { None } else { Some(props.target.as_str()) },
            style: props.style,
            {props.children}
        }
    }
}

pub struct LinkComponent;

impl StyledComponent for LinkComponent {
    fn styles() -> &'static str {
        tairitsu_macros::scss! { file: "src/styles/components/link.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "link"
    }
}
