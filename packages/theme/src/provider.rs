// hikari-theme/src/provider.rs
// Theme Provider Component

use dioxus::prelude::*;
use hikari_palette::*;

impl PartialEq for ThemeProviderProps {
    fn eq(&self, other: &Self) -> bool {
        self.palette == other.palette
    }
}

#[derive(Clone, Props)]
pub struct ThemeProviderProps {
    #[props(default = "primary".to_string())]
    pub palette: String,

    children: Element,
}

/// Theme Provider 组件
#[component]
pub fn ThemeProvider(props: ThemeProviderProps) -> Element {
    let _colors = match props.palette.as_str() {
        "primary" => primary_palette(),
        "fui-dark" => fui_dark_palette(),
        "arknights" => arknights_palette(),
        "fresh" => fresh_palette(),
        _ => primary_palette(),
    };

    rsx! {
        div {
            class: "hikari-theme-provider",
            "data-theme": "{props.palette}",
            {props.children}
        }
    }
}
