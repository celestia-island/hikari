use stylist::yew::styled_component;
use yew::prelude::*;

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Size {
    H1,
    H2,
    H3,
    H4,
    H5,
    H6,
    Px(f64),
    Em(f64),
    Rem(f64),
    Custom(&'static str),
}

#[derive(Properties, Debug, PartialEq)]
pub struct Props {
    #[prop_or_default]
    pub children: Children,
    #[prop_or(Size::H1)]
    pub size: Size,
}

/// `<Sizing>` component can be used to set the font size.
#[styled_component]
pub fn Sizing(props: &Props) -> Html {
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
