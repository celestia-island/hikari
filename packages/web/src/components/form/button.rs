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

                background: var(--color-primary);
                border-radius: 4px;
                box-shadow: 1px 1px 4px 0 var(--color-shadow-black);

                display: flex;
                align-items: center;
                justify-content: center;

                text-align: center;
                font-size: 14px;
                line-height: 48px;
                color: var(--color-primary-text-color);
                user-select: none;
                cursor: pointer;
                transition: all 0.3s;

                &:hover {
                    filter: brightness(1.2);
                }
            "#)}
            onclick={&props.onclick}
        >
            {props.children.clone()}
        </button>
    }
}
