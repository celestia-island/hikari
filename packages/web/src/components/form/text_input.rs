use stylist::yew::styled_component;
use yew::prelude::*;

#[derive(Properties, Debug, PartialEq)]
pub struct TextInputProps {
    #[prop_or_default]
    pub placeholder: AttrValue,
    #[prop_or_default]
    pub value: AttrValue,

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

                &:hover {
                    box-shadow: 1px 1px 8px 0 var(--color-shadow-rgba);
                }

                &:focus {
                    outline: 1px solid rgba(var(--color-primary), 0.8);
                }
            "#)}
            placeholder={&props.placeholder}
            value={&props.value}
            oninput={&props.oninput}
        />
    }
}
