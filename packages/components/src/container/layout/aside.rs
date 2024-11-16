use serde::{Deserialize, Serialize};

use stylist::yew::styled_component;
use yew::prelude::*;

#[derive(Properties, Debug, PartialEq, Serialize, Deserialize)]
pub struct Props {
    #[prop_or(256)]
    pub width: u32,

    #[prop_or_default]
    #[serde(skip)]
    pub children: Children,
}

#[styled_component]
pub fn AsideLayout(props: &Props) -> Html {
    html! {
        <aside
            class={css!(r#"
                left: 0;
                top: 64px;
                width: var(--hikari-aside-width, 256px);
                height: calc(100vh - 128px);

                border-radius: 4px;
                padding: 16px;
                flex-shrink: 0;

                display: flex;
                align-items: center;
                justify-content: center;
                text-align: center;
                z-index: 1;
            "#)}
            style={format!("--hikari-aside-width: {}px", props.width)}
        >
            {props.children.clone()}
        </aside>
    }
}
