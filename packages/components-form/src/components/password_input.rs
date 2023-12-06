use stylist::yew::styled_component;
use yew::prelude::*;

#[derive(Properties, Debug, PartialEq)]
pub struct PasswordInputProps {
    #[prop_or_default]
    pub children: Children,
}

#[styled_component]
pub fn PasswordInput(props: &PasswordInputProps) -> Html {
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
