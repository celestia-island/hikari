use stylist::yew::styled_component;
use yew::prelude::*;

#[derive(Properties, Debug, PartialEq)]
pub struct FooterLayoutProps {
    #[prop_or_default]
    pub children: Children,
}

#[styled_component]
pub fn FooterLayout(props: &FooterLayoutProps) -> Html {
    html! {
        <header
            class={css!(r#"
                width: 100%;
                height: 64px;

                padding: 16px;
                flex-shrink: 0;

                display: flex;
                align-items: center;
                justify-content: center;
                text-align: center;
                z-index: 1;
            "#)}
        >
            {props.children.clone()}
        </header>
    }
}
