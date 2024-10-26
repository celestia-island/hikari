use std::collections::HashMap;

use yew::prelude::*;

pub trait Theme: Clone + PartialEq + Default + 'static {
    fn get_color(&self, t: crate::types::ColorType) -> crate::types::Color;
}

#[derive(Debug, PartialEq, Eq, Clone)]
pub struct ThemeContext<T: Theme> {
    pub theme: T,
    pub state: HashMap<String, String>,
}

#[derive(Properties, Debug, PartialEq)]
pub struct ThemeContextProviderProps {
    #[prop_or_default]
    pub children: Children,
}

pub type ThemeContextProviderType<T> = UseStateHandle<ThemeContext<T>>;

#[function_component]
fn Injector<T: Theme>() -> Html {
    use crate::types::ColorType;

    let app_states = use_context::<ThemeContextProviderType<T>>().unwrap();
    let theme_raw = format!(
        r#"
            :root {{
                --color-primary: {};
                --color-secondary: {};

                --color-success: {};
                --color-warning: {};
                --color-error: {};
                --color-info: {};
            }}

            
            * {{
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }}

            body {{
                font-family: 'PingFang SC', 'Helvetica Neue', 'Microsoft YaHei', sans-serif;
                background-color: rgb(var(--color-background));
                color: rgb(var(--color-primary-text));
            }}
        "#,
        app_states.theme.get_color(ColorType::Primary).to_rgb_str(),
        app_states
            .theme
            .get_color(ColorType::Secondary)
            .to_rgb_str(),
        app_states.theme.get_color(ColorType::Success).to_rgb_str(),
        app_states.theme.get_color(ColorType::Warning).to_rgb_str(),
        app_states.theme.get_color(ColorType::Error).to_rgb_str(),
        app_states.theme.get_color(ColorType::Info).to_rgb_str(),
    );

    html! {
        <>
            <style>
                {theme_raw}
            </style>
        </>
    }
}

#[function_component]
pub fn ThemeContextShell<T: Theme>(props: &ThemeContextProviderProps) -> Html {
    let ctx = use_state(|| ThemeContext {
        theme: T::default(),
        state: HashMap::new(),
    });

    html! {
        <ContextProvider<ThemeContextProviderType<T>> context={ctx.clone()}>
            <Injector<T> />
            {props.children.clone()  }
        </ContextProvider<ThemeContextProviderType<T>>>
    }
}
