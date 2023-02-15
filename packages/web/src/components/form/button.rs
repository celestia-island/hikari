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
    let button_ref = use_node_ref();

    let is_hover = use_state(|| false);
    let is_active = use_state(|| false);
    let mouse_pos_left = use_state(|| 0);
    let mouse_pos_top = use_state(|| 0);

    let on_mouseenter = {
        let is_hover = is_hover.clone();
        let mouse_pos_left = mouse_pos_left.clone();
        let mouse_pos_top = mouse_pos_top.clone();
        Callback::from(move |event: MouseEvent| {
            is_hover.set(true);
            mouse_pos_left.set(event.offset_x());
            mouse_pos_top.set(event.offset_y());
        })
    };
    let on_mousemove = {
        let mouse_pos_left = mouse_pos_left.clone();
        let mouse_pos_top = mouse_pos_top.clone();
        Callback::from(move |event: MouseEvent| {
            mouse_pos_left.set(event.offset_x());
            mouse_pos_top.set(event.offset_y());
        })
    };
    let on_mouseleave = {
        let is_hover = is_hover.clone();
        Callback::from(move |_| {
            is_hover.set(false);
        })
    };

    let on_mousedown = {
        let is_active = is_active.clone();
        let mouse_pos_left = mouse_pos_left.clone();
        let mouse_pos_top = mouse_pos_top.clone();
        Callback::from(move |event: MouseEvent| {
            if !*is_active {
                is_active.set(true);
                mouse_pos_left.set(event.offset_x());
                mouse_pos_top.set(event.offset_y());

                let is_active = is_active.clone();
                wasm_bindgen_futures::spawn_local(async move {
                    gloo::timers::future::TimeoutFuture::new(600).await;
                    is_active.set(false);
                });
            }
        })
    };

    html! {
        <button
            ref={button_ref}
            class={css!(r#"
                position: relative;
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
                transition: opacity 0.3s;
            "#)}
            onmouseenter={on_mouseenter}
            onmouseleave={on_mouseleave}
            onmousemove={on_mousemove}
            onmousedown={on_mousedown}
            onclick={&props.onclick}
        >
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

            // Ripple
            <div
                class={css!(r#"
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;

                    border-radius: 4px;
                    opacity: 1;
                    transition: opacity 0.3s 0.3s;

                    z-index: -1;
                    overflow: hidden;

                    &[data-state="active"] {
                        opacity: 0;
                    }
                "#)}
                data-state={match *is_active {
                    true => "active",
                    false => "none",
                }}
            >
                <div
                    class={css!(r#"
                        position: absolute;
                        top: var(--mouse-pos-top);
                        left: var(--mouse-pos-left);
                        width: 1px;
                        height: 1px;

                        border-radius: 50%;
                        background-color: var(--color-shadow-rgba);

                        opacity: 0;
                        transform: scale(0);
                        transition: opacity 0.3s, transform 0.3s;

                        &[data-state="active"] {
                            transform: scale(128);
                            opacity: 1;
                        }
                    "#)}
                    data-state={match *is_active {
                        true => "active",
                        false => "none",
                    }}
                    style={format!(r#"
                        --mouse-pos-top: {}px;
                        --mouse-pos-left: {}px;
                    "#, *mouse_pos_top, *mouse_pos_left)}
                />
            </div>

            {props.children.clone()}
        </button>
    }
}
