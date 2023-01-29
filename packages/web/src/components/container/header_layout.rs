use stylist::yew::styled_component;
use yew::prelude::*;

#[derive(Properties, Debug, PartialEq)]
pub(crate) struct HeaderLayoutProps {
    #[prop_or_default]
    pub(crate) children: Children,
}

#[styled_component]
pub(crate) fn HeaderLayout(props: &HeaderLayoutProps) -> Html {
    html! {
        <header
            class={css!(r#"
                position: sticky;
                left: 0;
                top: 0;
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
