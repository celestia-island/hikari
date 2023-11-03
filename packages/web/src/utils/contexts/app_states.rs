use std::collections::HashMap;

use yew::prelude::*;

#[inline]
fn rgb_to_dec(rgb: i32) -> AttrValue {
    AttrValue::from(format!(
        "{}, {}, {}",
        (rgb >> 16) & 0xff,
        (rgb >> 8) & 0xff,
        rgb & 0xff
    ))
}

#[derive(Debug, PartialEq, Eq, Clone)]
pub struct Theme {
    pub primary_color: AttrValue,
    pub secondary_color: AttrValue,

    pub error_color: AttrValue,
    pub warning_color: AttrValue,
    pub success_color: AttrValue,
    pub info_color: AttrValue,

    pub primary_text_color: AttrValue,
    pub secondary_text_color: AttrValue,
    pub button_text_color: AttrValue,
    pub disabled_text_color: AttrValue,
    pub placeholder_text_color: AttrValue,

    pub shadow_color_rgba: AttrValue,
    pub background_color: AttrValue,

    pub large_text_size: AttrValue,
    pub medium_text_size: AttrValue,
    pub small_text_size: AttrValue,
}

#[derive(Debug, PartialEq, Eq, Clone)]
pub struct AppStateContext {
    pub theme: Theme,
    pub state: HashMap<String, AttrValue>,
}

#[derive(Properties, Debug, PartialEq)]
pub struct AppStatesContextProviderProps {
    #[prop_or_default]
    pub children: Children,
}

pub type AppStatesContextProviderType = UseStateHandle<AppStateContext>;

#[function_component]
fn Injector() -> Html {
    let app_states = use_context::<AppStatesContextProviderType>().unwrap();
    let theme_raw = format!(
        r#"
            :root {{
                --color-primary: {};
                --color-secondary: {};

                --color-error: {};
                --color-warning: {};
                --color-success: {};
                --color-info: {};

                --color-primary-text: {};
                --color-secondary-text: {};
                --color-button-text: {};
                --color-disabled-text: {};
                --color-placeholder-text: {};

                --color-shadow-rgba: {};
                --color-background: {};

                --size-large-text: {};
                --size-medium-text: {};
                --size-small-text: {};
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
        app_states.theme.primary_color.to_owned(),
        app_states.theme.secondary_color.to_owned(),
        app_states.theme.error_color.to_owned(),
        app_states.theme.warning_color.to_owned(),
        app_states.theme.success_color.to_owned(),
        app_states.theme.info_color.to_owned(),
        app_states.theme.primary_text_color.to_owned(),
        app_states.theme.secondary_text_color.to_owned(),
        app_states.theme.button_text_color.to_owned(),
        app_states.theme.disabled_text_color.to_owned(),
        app_states.theme.placeholder_text_color.to_owned(),
        app_states.theme.shadow_color_rgba.to_owned(),
        app_states.theme.background_color.to_owned(),
        app_states.theme.large_text_size.to_owned(),
        app_states.theme.medium_text_size.to_owned(),
        app_states.theme.small_text_size.to_owned(),
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
pub fn AppStatesContextShell(props: &AppStatesContextProviderProps) -> Html {
    let ctx = use_state(|| AppStateContext {
        theme: Theme {
            primary_color: rgb_to_dec(0x4c8dae),   // 群青 Qún Qīng
            secondary_color: rgb_to_dec(0x065279), // 靛蓝 Diàn Lán

            error_color: rgb_to_dec(0xc3272b),   // 赤 Chì
            warning_color: rgb_to_dec(0xca6924), // 琥珀 Hú Pò
            success_color: rgb_to_dec(0x0aa344), // 青葱 Qīng Cōng
            info_color: rgb_to_dec(0xbacac6),    // 老银 Lǎo Yín

            primary_text_color: rgb_to_dec(0x161823), // 漆黑 Qī Hēi
            secondary_text_color: rgb_to_dec(0x50616d), // 墨 Mò
            button_text_color: rgb_to_dec(0xf0f0f4),  // 铅白 Qiān Bái
            disabled_text_color: rgb_to_dec(0xe0f0e9), // 素 Sù
            placeholder_text_color: rgb_to_dec(0xc2ccd0), // 花白 Huā Bái

            shadow_color_rgba: "rgba(0, 0, 0, 0.6)".into(),
            background_color: rgb_to_dec(0xf2fdff), // 雪白 Xuě Bái

            large_text_size: "18px".into(),
            medium_text_size: "16px".into(),
            small_text_size: "14px".into(),
        },
        state: HashMap::new(),
    });

    html! {
        <ContextProvider<AppStatesContextProviderType> context={ctx.clone()}>
            <Injector />
            {props.children.clone()  }
        </ContextProvider<AppStatesContextProviderType>>
    }
}
