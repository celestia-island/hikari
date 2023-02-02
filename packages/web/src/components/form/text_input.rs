use stylist::yew::styled_component;
use yew::prelude::*;

#[derive(Properties, Debug, PartialEq)]
pub struct TextInputProps {
    #[prop_or_default]
    pub placeholder: String,
    #[prop_or_default]
    pub value: String,

    #[prop_or_default]
    pub oninput: Callback<InputEvent>,
}

#[styled_component]
pub fn TextInput(props: &TextInputProps) -> Html {
    html! {
        <input
            class={css!(r#"
                width: max-content;
                height: 48px;
                margin: 4px;
                padding: 8px;
                border: none;
                outline: 1px solid var(--color-primary);

                border-radius: 4px;
                box-shadow: 1px 1px 4px 0 var(--color-shadow-black);

                display: flex;
                align-items: center;
                justify-content: center;

                text-align: left;
                font-size: 14px;
                line-height: 48px;
                color: var(--color-primary-text-color);
                user-select: none;
                cursor: text;

                &:hover {
                    box-shadow: 1px 1px 8px 0 var(--color-shadow-black);
                }
            "#)}
            placeholder={props.placeholder.clone()}
            value={props.value.clone()}
            oninput={&props.oninput}
        />
    }
}
