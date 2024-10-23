use stylist::yew::styled_component;
use yew::{html::ChildrenRenderer, prelude::*, virtual_dom::VChild};

use super::{AsideLayout, FooterLayout, HeaderLayout, MainLayout};

#[derive(Clone, PartialEq)]
pub enum ContainerLayoutVariant {
    Aside(VChild<AsideLayout>),
    Footer(VChild<FooterLayout>),
    Header(VChild<HeaderLayout>),
    Main(VChild<MainLayout>),
    Container(VChild<ContainerLayout>),
}

#[allow(clippy::from_over_into)]
impl Into<Html> for ContainerLayoutVariant {
    fn into(self) -> Html {
        match self {
            Self::Aside(child) => child.into(),
            Self::Footer(child) => child.into(),
            Self::Header(child) => child.into(),
            Self::Main(child) => child.into(),
            Self::Container(child) => child.into(),
        }
    }
}

#[derive(Properties, Debug, PartialEq)]
pub struct ContainerLayoutProps {
    #[prop_or_default]
    pub children: ChildrenRenderer<ContainerLayoutVariant>,
}

#[styled_component]
pub fn ContainerLayout(props: &ContainerLayoutProps) -> Html {
    let is_vertical = if props.children.iter().any(|child| {
        matches!(
            child,
            ContainerLayoutVariant::Header(_) | ContainerLayoutVariant::Footer(_)
        )
    }) {
        Some(css!("flex-direction: column;"))
    } else {
        None
    };
    let children = props
        .children
        .clone()
        .into_iter()
        .map(|child| child.into())
        .collect::<Vec<Html>>();

    html! {
        <section
            class={classes!(css!(r#"
                width: 100%;
                height: 100%;

                display: flex;
                min-width: 0;
            "#), is_vertical)}
        >
            {children}
        </section>
    }
}
