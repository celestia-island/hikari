use stylist::yew::styled_component;
use yew::{html::ChildrenRenderer, prelude::*, virtual_dom::VChild};

use super::{AsideLayout, FooterLayout, HeaderLayout, MainLayout};

#[derive(Clone, derive_more::From, PartialEq)]
pub enum ContainerLayoutVariant {
    AsideLayout(VChild<AsideLayout>),
    FooterLayout(VChild<FooterLayout>),
    HeaderLayout(VChild<HeaderLayout>),
    MainLayout(VChild<MainLayout>),
    ContainerLayout(VChild<ContainerLayout>),
}

#[allow(clippy::from_over_into)]
impl Into<Html> for ContainerLayoutVariant {
    fn into(self) -> Html {
        match self {
            Self::AsideLayout(child) => child.into(),
            Self::FooterLayout(child) => child.into(),
            Self::HeaderLayout(child) => child.into(),
            Self::MainLayout(child) => child.into(),
            Self::ContainerLayout(child) => child.into(),
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
    let is_vertical = if props.children.iter().any(|child| match child {
        ContainerLayoutVariant::HeaderLayout(_) => true,
        ContainerLayoutVariant::FooterLayout(_) => true,
        _ => false,
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
