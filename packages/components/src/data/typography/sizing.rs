use serde::{Deserialize, Serialize};

use stylist::yew::styled_component;
use yew::prelude::*;

use hikari_theme::types::FontSize;

#[derive(Properties, Debug, PartialEq, Serialize, Deserialize)]
pub struct Props {
    #[prop_or(FontSize::H1)]
    pub size: FontSize,

    #[prop_or_default]
    #[serde(skip)]
    pub children: Children,
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

pub mod headers {
    use serde::{Deserialize, Serialize};

    use stylist::yew::styled_component;
    use yew::prelude::*;

    use super::Sizing;
    use hikari_theme::types::FontSize;

    #[derive(Properties, Debug, PartialEq, Serialize, Deserialize)]
    pub struct Props {
        #[prop_or_default]
        #[serde(skip)]
        pub children: Children,
    }

    /// `<H1>` component is like a `<h1>` element in HTML.
    #[styled_component]
    pub fn H1(props: &Props) -> Html {
        html! {
            <Sizing size={FontSize::H1}>
                {props.children.clone()}
            </Sizing>
        }
    }

    /// `<H2>` component is like a `<h2>` element in HTML.
    #[styled_component]
    pub fn H2(props: &Props) -> Html {
        html! {
            <Sizing size={FontSize::H2}>
                {props.children.clone()}
            </Sizing>
        }
    }

    /// `<H3>` component is like a `<h3>` element in HTML.
    #[styled_component]
    pub fn H3(props: &Props) -> Html {
        html! {
            <Sizing size={FontSize::H3}>
                {props.children.clone()}
            </Sizing>
        }
    }

    /// `<H4>` component is like a `<h4>` element in HTML.
    #[styled_component]
    pub fn H4(props: &Props) -> Html {
        html! {
            <Sizing size={FontSize::H4}>
                {props.children.clone()}
            </Sizing>
        }
    }

    /// `<H5>` component is like a `<h5>` element in HTML.
    #[styled_component]
    pub fn H5(props: &Props) -> Html {
        html! {
            <Sizing size={FontSize::H5}>
                {props.children.clone()}
            </Sizing>
        }
    }

    /// `<H6>` component is like a `<h6>` element in HTML.
    #[styled_component]
    pub fn H6(props: &Props) -> Html {
        html! {
            <Sizing size={FontSize::H6}>
                {props.children.clone()}
            </Sizing>
        }
    }
}
