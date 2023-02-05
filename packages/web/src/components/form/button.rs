use stylist::yew::styled_component;
use yew::prelude::*;

#[derive(Properties, Debug, PartialEq)]
pub struct ButtonProps {
    #[prop_or_default]
    pub onclick: Callback<MouseEvent>,

    #[prop_or_default]
    pub children: Children,
}

#[styled_component]
pub fn Button(props: &ButtonProps) -> Html {
    html! {
        <button
            class={css!(r#"
                width: max-content;
                height: 48px;
                margin: 4px;
                padding: 8px;
                border: none;
                outline: none;

                background-color: rgba(var(--color-primary), 0.8);
                border-radius: 4px;
                box-shadow: 1px 1px 4px 0 var(--color-shadow-rgba);

                display: flex;
                align-items: center;
                justify-content: center;

                text-align: center;
                font-size: 16px;
                line-height: 48px;
                color: rgb(var(--color-button-text));
                user-select: none;
                cursor: pointer;

                &:hover {
                    box-shadow: 1px 1px 8px 0 var(--color-shadow-rgba);
                }

                &:active {
                    filter: brightness(0.8);
                }
            "#)}
            onclick={&props.onclick}
        >
            {props.children.clone()}
        </button>
    }
}
