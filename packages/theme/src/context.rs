use serde::{Deserialize, Serialize};
use yuuka::derive_struct;

use yew::prelude::*;

use crate::{
    prelude::element::palette::COLOR_MAP,
    types::{ColorLevel, Palette},
};

derive_struct!(
    #[derive(PartialEq, Serialize, Deserialize)]
    pub Theme {
        palette: Palette = COLOR_MAP.clone(),
        // FIXME: Maybe we should use `dyn Trait` instead...
        // skin: Vec<(ComponentType, ComponentSkin)> = Vec::new(),
    }
);

#[derive(Properties, Debug, PartialEq)]
pub struct ThemeContextProviderProps {
    pub context: Theme,

    #[prop_or_default]
    pub children: Children,
}

#[function_component]
pub fn ThemeContextShell(props: &ThemeContextProviderProps) -> Html {
    html! {
        <ContextProvider<Theme> context={props.context.clone()}>
            <style>
                {format!(r#"
                    :root {{
                        --color-primary: {};
                        --color-secondary: {};
                        --color-success: {};
                        --color-warning: {};
                        --color-error: {};
                        --color-info: {};

                        --color-primary-most: {};
                        --color-secondary-most: {};
                        --color-success-most: {};
                        --color-warning-most: {};
                        --color-error-most: {};
                        --color-info-most: {};

                        --color-primary-half: {};
                        --color-secondary-half: {};
                        --color-success-half: {};
                        --color-warning-half: {};
                        --color-error-half: {};
                        --color-info-half: {};

                        --color-primary-less: {};
                        --color-secondary-less: {};
                        --color-success-less: {};
                        --color-warning-less: {};
                        --color-error-less: {};
                        --color-info-less: {};

                        --color-light: rgb(255, 255, 255);
                        --color-dark: rgb(0, 0, 0);

                        --color-light-most: rgba(255, 255, 255, 0.8);
                        --color-dark-most: rgba(0, 0, 0, 0.8);

                        --color-light-half: rgba(255, 255, 255, 0.5);
                        --color-dark-half: rgba(0, 0, 0, 0.5);

                        --color-light-less: rgba(255, 255, 255, 0.2);
                        --color-dark-less: rgba(0, 0, 0, 0.2);

                        --color-button-text: var(--color-light-most);
                        --color-text: var(--color-dark-most);
                        --color-shadow: var(--color-dark-less);
                    }}

                    * {{
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                    }}

                    body {{
                        font-family: 'PingFang SC', 'Helvetica Neue', 'Microsoft YaHei', sans-serif;
                    }}"#,
                    props.context.palette.primary.to_rgb_str(),
                    props.context.palette.secondary.to_rgb_str(),
                    props.context.palette.success.to_rgb_str(),
                    props.context.palette.warning.to_rgb_str(),
                    props.context.palette.error.to_rgb_str(),
                    props.context.palette.info.to_rgb_str(),
                    props.context.palette.primary.to_rgba_str(ColorLevel::Most),
                    props.context.palette.secondary.to_rgba_str(ColorLevel::Most),
                    props.context.palette.success.to_rgba_str(ColorLevel::Most),
                    props.context.palette.warning.to_rgba_str(ColorLevel::Most),
                    props.context.palette.error.to_rgba_str(ColorLevel::Most),
                    props.context.palette.info.to_rgba_str(ColorLevel::Most),
                    props.context.palette.primary.to_rgba_str(ColorLevel::Half),
                    props.context.palette.secondary.to_rgba_str(ColorLevel::Half),
                    props.context.palette.success.to_rgba_str(ColorLevel::Half),
                    props.context.palette.warning.to_rgba_str(ColorLevel::Half),
                    props.context.palette.error.to_rgba_str(ColorLevel::Half),
                    props.context.palette.info.to_rgba_str(ColorLevel::Half),
                    props.context.palette.primary.to_rgba_str(ColorLevel::Less),
                    props.context.palette.secondary.to_rgba_str(ColorLevel::Less),
                    props.context.palette.success.to_rgba_str(ColorLevel::Less),
                    props.context.palette.warning.to_rgba_str(ColorLevel::Less),
                    props.context.palette.error.to_rgba_str(ColorLevel::Less),
                    props.context.palette.info.to_rgba_str(ColorLevel::Less)
                )}
            </style>

            {props.children.clone()  }
        </ContextProvider<Theme>>
    }
}
