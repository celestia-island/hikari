use serde::{Deserialize, Serialize};

use stylist::yew::styled_component;
use yew::prelude::*;

#[derive(Properties, Debug, PartialEq, Serialize, Deserialize)]
pub struct Props {
    #[prop_or_default]
    #[serde(skip)]
    pub children: Children,
}

/// `<IsolateDirection>` component is like a `<bdi>` element in HTML.
#[styled_component]
pub fn IsolateDirection(props: &Props) -> Html {
    // TODO: LTR and RTL

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

/// `<OverrideDirection>` component is like a `<bdo>` element in HTML.
#[styled_component]
pub fn OverrideDirection(props: &Props) -> Html {
    // TODO: LTR and RTL

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

/// `<WordBreak>` component is like a `<wbr>` element in HTML.
#[styled_component]
pub fn WordBreak(props: &Props) -> Html {
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
