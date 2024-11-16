use serde::{Deserialize, Serialize};

use stylist::yew::styled_component;
use yew::prelude::*;

use hikari_theme::types::{ColorType, SizeType};

#[derive(Properties, Debug, PartialEq, Serialize, Deserialize)]
pub struct Props {
    #[prop_or_default]
    pub size: SizeType,
    #[prop_or_default]
    pub color: ColorType,
    #[prop_or(false)]
    pub outlined: bool,

    #[prop_or_default]
    #[serde(skip)]
    pub on_toggle: Callback<MouseEvent>,

    #[prop_or_default]
    #[serde(skip)]
    pub children: Children,
}

#[styled_component]
pub fn CheckBox(props: &Props) -> Html {
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
