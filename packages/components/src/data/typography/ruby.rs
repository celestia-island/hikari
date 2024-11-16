use serde::{Deserialize, Serialize};

use stylist::yew::styled_component;
use yew::prelude::*;

#[derive(Properties, Debug, PartialEq, Serialize, Deserialize)]
pub struct Props {
    #[prop_or_default]
    #[serde(skip)]
    pub children: Children,
}

/// `<Ruby>` component is like a `<ruby>` element in HTML.
#[styled_component]
pub fn Ruby(props: &Props) -> Html {
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
