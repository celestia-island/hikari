use stylist::yew::styled_component;
use yew::prelude::*;

#[derive(Properties, Debug, PartialEq)]
pub struct AsideLayoutProps {
    #[prop_or_default]
    pub children: Children,
}

#[styled_component]
pub fn AsideLayout(props: &AsideLayoutProps) -> Html {
    html! {
        <aside
            class={css!(r#"
                position: fixed;
                left: 0;
                top: 64px;
                width: 35vw;
                height: calc(100vh - 128px);

                border-radius: 4px;
                padding: 16px;
                box-shadow: 0 0 4px 1px rgba(0, 0, 0, 0.8);

                display: flex;
                align-items: center;
                justify-content: center;
            "#)}
        >
            {props.children.clone()}
        </aside>
    }
}
