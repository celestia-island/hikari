use stylist::yew::styled_component;
use yew::prelude::*;

#[derive(Properties, Debug, PartialEq)]
pub struct Props {
    #[prop_or_default]
    pub children: Children,
}

/// `<Underline>` component is like a `<u>` element in HTML.
#[styled_component]
pub fn Underline(props: &Props) -> Html {
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