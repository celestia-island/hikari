use stylist::yew::styled_component;
use yew::prelude::*;

#[derive(Properties, Debug, PartialEq)]
pub(crate) struct FooterLayoutProps {
    #[prop_or_default]
    pub(crate) children: Children,
}

#[styled_component]
pub(crate) fn FooterLayout(props: &FooterLayoutProps) -> Html {
    html! {
        <header
            class={css!(r#"
                position: sticky;
                left: 0;
                bottom: 0;
                width: 100%;
                height: 64px;

                border-radius: 4px;
                padding: 16px;
                box-shadow: 0 0 4px 1px rgba(0, 0, 0, 0.8);

                display: fixed;
                align-items: center;
            "#)}
        >
            {props.children.clone()}
        </header>
    }
}
