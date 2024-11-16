use serde::{Deserialize, Serialize};

use stylist::yew::styled_component;
use yew::prelude::*;

#[derive(Properties, Debug, PartialEq, Serialize, Deserialize)]
pub struct Props {
    #[prop_or_default]
    pub placeholder: String,
    #[prop_or_default]
    pub value: String,

    #[prop_or_default]
    #[serde(skip)]
    pub oninput: Callback<InputEvent>,
}

#[styled_component]
pub fn TextInput(props: &Props) -> Html {
    let is_hover = use_state(|| false);

    let on_mouseenter = {
        let is_hover = is_hover.clone();
        Callback::from(move |_| {
            is_hover.set(true);
        })
    };
    let on_mouseleave = {
        let is_hover = is_hover.clone();
        Callback::from(move |_| {
            is_hover.set(false);
        })
    };

    html! {
        <div
            class={css!(r#"
                position: relative;
                width: max-content;
                height: 48px;
                margin: 4px;
            "#)}
            onmouseenter={on_mouseenter}
            onmouseleave={on_mouseleave}
        >
            <input
                class={css!(r#"
                    width: 100%;
                    height: 100%;
                    padding: 8px;
                    border: none;

                    border-radius: 4px;
                    box-shadow: 1px 1px 4px 0 var(--color-shadow-rgba);
                    background: rgba(var(--color-background), 0.8);

                    display: flex;
                    align-items: center;
                    justify-content: center;

                    text-align: left;
                    font-size: 16px;
                    color: rgb(var(--color-primary-text));
                    user-select: none;
                    cursor: text;

                    &:focus {
                        outline: 1px solid rgba(var(--color-primary), 0.8);
                    }
                "#)}
                placeholder={props.placeholder.clone()}
                value={props.value.clone()}
                oninput={&props.oninput}
            />


            // Shadow
            <div
                class={css!(r#"
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    border-radius: 4px;
                    box-shadow: 1px 1px 4px 0 var(--color-shadow-rgba);
                    opacity: 0;

                    z-index: -1;
                    transition: opacity 0.3s;

                    &[data-state="hover"] {
                        opacity: 1;
                    }
                "#)}
                data-state={match *is_hover {
                    true => "hover",
                    false => "none",
                }}
            />
        </div>
    }
}
