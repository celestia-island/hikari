use stylist::yew::styled_component;
use yew::prelude::*;

use hikari_theme::{
    components::form::button::*,
    types::{ColorType, SizeType},
};

#[derive(Properties, Debug, PartialEq)]
pub struct Props {
    #[prop_or_default]
    pub size: SizeType,
    #[prop_or_default]
    pub color: ColorType,
    #[prop_or(false)]
    pub outlined: bool,

    #[prop_or_default]
    pub on_click: Callback<MouseEvent>,

    #[prop_or_default]
    pub children: Children,
}

#[styled_component]
pub fn Button(props: &Props) -> Html {
    let radius_type = use_context::<ComponentContextProviderType>();
    let radius_type = match &radius_type {
        Some(ctx) => ctx.border_radius_type,
        None => BorderRadiusType::Default,
    };

    let is_hover = use_state(|| false);
    let is_active = use_state(|| false);

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
                SizeType::Small => "small",
                SizeType::Medium => "medium",
                SizeType::Large => "large",
            }}
            data-border-radius-type={match radius_type {
                BorderRadiusType::Default => "default",
                BorderRadiusType::None => "none",
                BorderRadiusType::OnlyLeft => "only-left",
                BorderRadiusType::OnlyRight => "only-right",
            }}

            onmouseenter={on_mouseenter}
            onmouseleave={on_mouseleave}
            onmousedown={on_mousedown}
            onmouseup={on_mouseup}
            onclick={&props.on_click}
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
                    box-shadow: 1px 1px 4px 0 var(--color-shadow);

                    transition: all 0.3s;

                    &[data-color="primary"] {
                        background-color: var(--color-primary-most);
                        border-color: var(--color-primary-most);
                    }
                    &[data-color="secondary"] {
                        background-color: var(--color-secondary-most);
                        border-color: var(--color-secondary-most);
                    }
                    &[data-color="success"] {
                        background-color: var(--color-success-most);
                        border-color: var(--color-success-most);
                    }
                    &[data-color="error"] {
                        background-color: var(--color-error-most);
                        border-color: var(--color-error-most);
                    }
                    &[data-color="info"] {
                        background-color: var(--color-info-most);
                        border-color: var(--color-info-most);
                    }
                    &[data-color="warning"] {
                        background-color: var(--color-warning-most);
                        border-color: var(--color-warning-most);
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
                    &[data-style="outlined"] &[data-state="none"],
                    &[data-style="outlined"] &[data-state="hover"] {
                        background-color: transparent;
                    }
                    &[data-style="basic"] {
                        border-color: transparent;
                    }

                    &[data-state="active"] {
                        filter: brightness(0.8);
                    }
                "#)}

                data-color={match props.color {
                    ColorType::Primary => "primary",
                    ColorType::Secondary => "secondary",
                    ColorType::Success => "success",
                    ColorType::Error => "error",
                    ColorType::Info => "info",
                    ColorType::Warning => "warning",
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
                data-border-radius-type={match radius_type {
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
                    box-shadow: 1px 1px 4px 0 var(--color-shadow);
                    opacity: 0;

                    z-index: -1;
                    transition: opacity 0.3s;

                    &[data-state="hover"] {
                        opacity: 1;
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
                "#)}

                data-state={match *is_hover {
                    true => "hover",
                    false => "none",
                }}
                data-border-radius-type={match radius_type {
                    BorderRadiusType::Default => "default",
                    BorderRadiusType::None => "none",
                    BorderRadiusType::OnlyLeft => "only-left",
                    BorderRadiusType::OnlyRight => "only-right",
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

                    &[data-color="primary"]&[data-style="outlined"] {
                        color: var(--color-primary);
                    }
                    &[data-color="secondary"]&[data-style="outlined"] {
                        color: var(--color-secondary);
                    }
                    &[data-color="success"]&[data-style="outlined"] {
                        color: var(--color-success);
                    }
                    &[data-color="error"]&[data-style="outlined"] {
                        color: var(--color-error);
                    }
                    &[data-color="info"]&[data-style="outlined"] {
                        color: var(--color-info);
                    }
                    &[data-color="warning"]&[data-style="outlined"] {
                        color: var(--color-warning);
                    }

                    &[data-size="small"] {
                        font-size: var(--size-small-text);
                    }
                    &[data-size="medium"] {
                        font-size: var(--size-medium-text);
                    }
                    &[data-size="large"] {
                        font-size: var(--size-large-text);
                    }

                    &[data-style="outlined"] {
                        color: var(--color-primary);
                    }
                    &[data-style="outlined"]&[data-state="active"] {
                        color: var(--color-button-text);
                    }
                    &[data-style="basic"] {
                        color: var(--color-button-text);
                    }
                "#)}

                data-color={match props.color {
                    ColorType::Primary => "primary",
                    ColorType::Secondary => "secondary",
                    ColorType::Success => "success",
                    ColorType::Error => "error",
                    ColorType::Info => "info",
                    ColorType::Warning => "warning",
                }}
                data-size={match props.size {
                    SizeType::Small => "small",
                    SizeType::Medium => "medium",
                    SizeType::Large => "large",
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
