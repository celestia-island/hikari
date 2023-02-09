use stylist::yew::styled_component;
use yew::prelude::*;

#[derive(Properties, Debug, PartialEq)]
pub struct MainLayoutProps {
    #[prop_or_default]
    pub children: Children,
}

#[styled_component]
pub fn MainLayout(props: &MainLayoutProps) -> Html {
    html! {
        <main
            class={css!(r#"
                width: 100%;

                flex-grow: 1;
                flex-shrink: 1;

                display: flex;
                flex-direction: column;
                align-items: center;
            "#)}
        >
            {props.children.clone()}
        </main>
    }
}
