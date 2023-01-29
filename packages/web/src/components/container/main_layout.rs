use stylist::yew::styled_component;
use yew::prelude::*;

#[derive(Properties, Debug, PartialEq)]
pub(crate) struct MainLayoutProps {
    #[prop_or_default]
    pub(crate) children: Children,
}

#[styled_component]
pub(crate) fn MainLayout(props: &MainLayoutProps) -> Html {
    html! {
        <main
            class={css!(r#"
                width: 100%;
                height: max-content;

                display: fixed;
                flex-direction: column;
                align-items: center;
            "#)}
        >
            {props.children.clone()}
        </main>
    }
}
