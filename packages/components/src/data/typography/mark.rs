use serde::{Deserialize, Serialize};

use stylist::yew::styled_component;
use yew::prelude::*;

use hikari_theme::types::Color;

#[derive(Properties, Debug, PartialEq, Serialize, Deserialize)]
pub struct Props {
    #[prop_or_default]
    #[serde(skip)]
    pub children: Children,
    #[prop_or_default]
    pub color: Option<Color>,
}

/// `<Mark>` component is like a `<mark>` element in HTML.
#[styled_component]
pub fn Mark(props: &Props) -> Html {
    html! {
        <div
            class={css!(r#"
                display: flex;
                align-items: center;
                justify-content: center;
            "#)}
        >
            {props.children.clone()}
        </div>
    }
}
