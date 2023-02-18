use log::info;
use stylist::yew::styled_component;
use yew::prelude::*;

use crate::components::{Color, Size};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BorderRadiusType {
    Default,
    None,
    OnlyLeft,
    OnlyRight,
}

#[derive(Debug, PartialEq, Eq, Clone)]
pub struct BorderRadiusTypeContext {
    pub border_radius_type: BorderRadiusType,
}

#[derive(Properties, Debug, PartialEq)]
pub struct BorderRadiusTypeContextProviderProps {
    #[prop_or(BorderRadiusType::Default)]
    pub border_radius_type: BorderRadiusType,

    #[prop_or_default]
    pub children: Children,
}

pub type BorderRadiusTypeContextProviderType = UseStateHandle<BorderRadiusTypeContext>;

#[function_component]
pub fn BorderRadiusTypeContextShell(props: &BorderRadiusTypeContextProviderProps) -> Html {
    let ctx = use_state(|| BorderRadiusTypeContext {
        border_radius_type: props.border_radius_type,
    });

    html! {
        <ContextProvider<BorderRadiusTypeContextProviderType> context={ctx.clone()}>
            {props.children.clone()  }
        </ContextProvider<BorderRadiusTypeContextProviderType>>
    }
}

#[derive(Properties, Debug, PartialEq)]
pub struct ButtonProps {
    #[prop_or(Size::Medium)]
    pub size: Size,
    #[prop_or(Color::Primary)]
    pub color: Color,
    #[prop_or(false)]
    pub outlined: bool,

    #[prop_or_default]
    pub onclick: Callback<MouseEvent>,

    #[prop_or_default]
    pub children: Children,
}

#[styled_component]
pub fn Button(props: &ButtonProps) -> Html {
    let is_hover = use_state(|| false);
    let is_active = use_state(|| false);
    let border_radius_type = match use_context::<BorderRadiusTypeContextProviderType>() {
        Some(ctx) => ctx.border_radius_type,
        None => BorderRadiusType::Default,
    };

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

    let on_mousedown = {
        let is_active = is_active.clone();
        Callback::from(move |_| {
            if !*is_active {
                is_active.set(true);
            }
        })
    };
    let on_mouseup = {
        let is_active = is_active.clone();
        Callback::from(move |_| {
            if *is_active {
                is_active.set(false);
            }
        })
    };

    html! {
        <button
            class={css!(r#"
                position: relative;
                width: max-content;
                margin: 4px;
                padding: 8px;
                border: none;
                outline: none;
                background: none;

                cursor: pointer;
                transition: opacity 0.3s;

                &[data-size="small"] {
                    height: 24px;
                }
                &[data-size="medium"] {
                    height: 32px;
                }
                &[data-size="large"] {
                    height: 48px;
                }

                &[data-border-radius-type="only-left"] {
                    margin-right: 0;
                }
                &[data-border-radius-type="none"] {
                    margin-left: 1px;
                    margin-right: 0;
                }
                &[data-border-radius-type="only-right"] {
                    margin-left: 1px;
                }
            "#)}

            data-size={match props.size {
                Size::Small => "small",
                Size::Medium => "medium",
                Size::Large => "large",
            }}
            data-border-radius-type={match border_radius_type {
                BorderRadiusType::Default => "default",
                BorderRadiusType::None => "none",
                BorderRadiusType::OnlyLeft => "only-left",
                BorderRadiusType::OnlyRight => "only-right",
            }}

            onmouseenter={on_mouseenter}
            onmouseleave={on_mouseleave}
            onmousedown={on_mousedown}
            onmouseup={on_mouseup}
            onclick={&props.onclick}
        >
            // Background
            <div
                class={css!(r#"
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;

                    border: 1px solid transparent;
                    box-shadow: 1px 1px 4px 0 var(--color-shadow-rgba);

                    transition: all 0.3s;

                    &[data-color="primary"] {
                        background-color: rgba(var(--color-primary), 0.8);
                        border-color: rgba(var(--color-primary), 0.8);
                    }
                    &[data-color="secondary"] {
                        background-color: rgba(var(--color-secondary), 0.8);
                        border-color: rgba(var(--color-secondary), 0.8);
                    }
                    &[data-color="success"] {
                        background-color: rgba(var(--color-success), 0.8);
                        border-color: rgba(var(--color-success), 0.8);
                    }
                    &[data-color="error"] {
                        background-color: rgba(var(--color-error), 0.8);
                        border-color: rgba(var(--color-error), 0.8);
                    }
                    &[data-color="info"] {
                        background-color: rgba(var(--color-info), 0.8);
                        border-color: rgba(var(--color-info), 0.8);
                    }
                    &[data-color="warning"] {
                        background-color: rgba(var(--color-warning), 0.8);
                        border-color: rgba(var(--color-warning), 0.8);
                    }

                    &[data-border-radius-type="default"] {
                        border-radius: 4px;
                    }
                    &[data-border-radius-type="none"] {
                        border-radius: 0;
                    }
                    &[data-border-radius-type="only-left"] {
                        border-radius: 4px 0 0 4px;
                    }
                    &[data-border-radius-type="only-right"] {
                        border-radius: 0 4px 4px 0;
                    }

                    &[data-style="outlined"] {
                        backdrop-filter: blur(4px);
                    }
                    &[data-style="outlined"]&[data-state="none"],
                    &[data-style="outlined"]&[data-state="hover"] {
                        background-color: transparent;
                    }
                    &[data-style="basic"] {
                        border-color: transparent;
                    }

                    &[data-state="active"] {
                        filter: brightness(0.9);
                    }
                "#)}

                data-color={match props.color {
                    Color::Primary => "primary",
                    Color::Secondary => "secondary",
                    Color::Success => "success",
                    Color::Error => "error",
                    Color::Info => "info",
                    Color::Warning => "warning",
                }}
                data-style={if props.outlined {
                    "outlined"
                } else {
                    "basic"
                }}
                data-state={match (*is_hover, *is_active) {
                    (true, true) => "active",
                    (true, false) => "hover",
                    _ => "none",
                }}
                data-border-radius-type={match border_radius_type {
                    BorderRadiusType::Default => "default",
                    BorderRadiusType::None => "none",
                    BorderRadiusType::OnlyLeft => "only-left",
                    BorderRadiusType::OnlyRight => "only-right",
                }}
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

            // Content
            <div
                class={css!(r#"
                    position: relative;
                    width: 100%;
                    height: 100%;

                    display: flex;
                    align-items: center;
                    justify-content: center;

                    text-align: center;
                    line-height: 48px;

                    user-select: none;
                    z-index: 1;
                    transition: color 0.3s;

                    &[data-size="small"] {
                        font-size: 14px;
                    }
                    &[data-size="medium"] {
                        font-size: 16px;
                    }
                    &[data-size="large"] {
                        font-size: 18px;
                    }

                    &[data-style="outlined"] {
                        color: rgb(var(--color-primary));
                    }
                    &[data-style="outlined"]&[data-state="active"] {
                        color: rgb(var(--color-button-text));
                    }
                    &[data-style="basic"] {
                        color: rgb(var(--color-button-text));
                    }
                "#)}

                data-size={match props.size {
                    Size::Small => "small",
                    Size::Medium => "medium",
                    Size::Large => "large",
                }}
                data-style={if props.outlined {
                    "outlined"
                } else {
                    "basic"
                }}
                data-state={match (*is_hover, *is_active) {
                    (true, true) => "active",
                    (true, false) => "hover",
                    _ => "none",
                }}
            >
                {props.children.clone()}
            </div>
        </button>
    }
}
