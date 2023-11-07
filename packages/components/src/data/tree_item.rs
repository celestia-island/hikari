use stylist::yew::styled_component;
use yew::prelude::*;

#[derive(Properties, Debug, PartialEq)]
pub struct TreeItemProps {
    #[prop_or_default]
    pub children: Children,
}

#[styled_component]
pub fn TreeItem(props: &TreeItemProps) -> Html {
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
