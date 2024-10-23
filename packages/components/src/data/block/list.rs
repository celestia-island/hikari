use stylist::yew::styled_component;
use yew::prelude::*;

#[derive(Properties, Debug, PartialEq)]
pub struct ListProps {
    #[prop_or_default]
    pub children: Children,
}

#[derive(Properties, Debug, PartialEq)]
pub struct ListItemProps {
    #[prop_or_default]
    pub children: Children,
}

#[styled_component]
pub fn List(props: &ListProps) -> Html {
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

#[styled_component]
pub fn ListItem(props: &ListItemProps) -> Html {
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
