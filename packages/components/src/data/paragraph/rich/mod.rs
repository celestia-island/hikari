#[cfg(feature = "form-input-rich-html")]
mod html;
#[cfg(feature = "form-input-rich-markdown")]
mod markdown;
#[cfg(feature = "form-input-rich-mediawiki")]
mod mediawiki;

use stylist::yew::styled_component;
use yew::prelude::*;

#[derive(Properties, Debug, PartialEq)]
pub struct Props {
    #[prop_or_default]
    pub children: Children,
}

#[styled_component]
pub fn Rich(props: &Props) -> Html {
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
