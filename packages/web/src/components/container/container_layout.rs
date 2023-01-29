use stylist::yew::styled_component;
use yew::prelude::*;

#[derive(Properties, Debug, PartialEq)]
pub(crate) struct ContainerLayoutProps {
    #[prop_or_default]
    pub(crate) children: Children,
}

#[styled_component]
pub(crate) fn ContainerLayout(props: &ContainerLayoutProps) -> Html {
    html! {
        <div
            class={css!(r#"
                display: fixed;
                align-items: center;
                justify-content: center;
            "#)}
        >
            {props.children.clone()}
        </div>
    }
}
