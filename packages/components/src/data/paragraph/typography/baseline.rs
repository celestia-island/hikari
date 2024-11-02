use stylist::yew::styled_component;
use yew::prelude::*;

#[derive(Properties, Debug, PartialEq)]
pub struct Props {
    #[prop_or_default]
    pub children: Children,
}

/// `<Sub>` component is like a `<sub>` element in HTML.
#[styled_component]
pub fn Sub(props: &Props) -> Html {
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

/// `<Sup>` component is like a `<sup>` element in HTML.
#[styled_component]
pub fn Sup(props: &Props) -> Html {
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
