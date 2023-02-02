use yew::prelude::*;

#[derive(Debug, PartialEq, Eq, Clone)]
pub struct ThemeContext {
    pub primary_color: String,
    pub secondary_color: String,

    pub error_color: String,
    pub warning_color: String,
    pub success_color: String,
    pub info_color: String,

    pub primary_text_color: String,
    pub secondary_text_color: String,
    pub disabled_text_color: String,
    pub placeholder_text_color: String,

    pub shadow_color_black: String,
}

#[derive(Properties, Debug, PartialEq)]
pub struct ThemeContextProviderProps {
    #[prop_or_default]
    pub children: Children,
}

pub type ThemeContextProviderType = UseStateHandle<ThemeContext>;

#[function_component]
pub fn ThemeContextShell(props: &ThemeContextProviderProps) -> Html {
    let ctx = use_state(|| ThemeContext {
        primary_color: "#409EFF".to_string(),
        secondary_color: "#79bbff".to_string(),

        error_color: "#F56C6C".to_string(),
        warning_color: "#E6A23C".to_string(),
        success_color: "#67C23A".to_string(),
        info_color: "#909399".to_string(),

        primary_text_color: "#303133".to_string(),
        secondary_text_color: "#606266".to_string(),
        disabled_text_color: "#C0C4CC".to_string(),
        placeholder_text_color: "#A8ABB2".to_string(),

        shadow_color_black: "rgba(0, 0, 0, 0.6)".to_string(),
    });

    html! {
        <ContextProvider<ThemeContextProviderType> context={ctx.clone()}>
            {props.children.clone()}
        </ContextProvider<ThemeContextProviderType>>
    }
}
