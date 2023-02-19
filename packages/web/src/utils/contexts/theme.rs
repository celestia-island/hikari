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
pub struct ThemeContext {
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

#[derive(Properties, Debug, PartialEq)]
pub struct ThemeContextProviderProps {
    #[prop_or_default]
    pub children: Children,
}

pub type ThemeContextProviderType = UseStateHandle<ThemeContext>;

#[function_component]
fn Injector() -> Html {
    let theme = use_context::<ThemeContextProviderType>().unwrap();
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
        theme.primary_color.to_owned(),
        theme.secondary_color.to_owned(),
        theme.error_color.to_owned(),
        theme.warning_color.to_owned(),
        theme.success_color.to_owned(),
        theme.info_color.to_owned(),
        theme.primary_text_color.to_owned(),
        theme.secondary_text_color.to_owned(),
        theme.button_text_color.to_owned(),
        theme.disabled_text_color.to_owned(),
        theme.placeholder_text_color.to_owned(),
        theme.shadow_color_rgba.to_owned(),
        theme.background_color.to_owned(),
        theme.large_text_size.to_owned(),
        theme.medium_text_size.to_owned(),
        theme.small_text_size.to_owned(),
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
pub fn ThemeContextShell(props: &ThemeContextProviderProps) -> Html {
    let ctx = use_state(|| ThemeContext {
        primary_color: rgb_to_dec(0x4c8dae),   // 群青 Qún Qīng
        secondary_color: rgb_to_dec(0x065279), // 靛蓝 Diàn Lán

        error_color: rgb_to_dec(0xc3272b),   // 赤 Chì
        warning_color: rgb_to_dec(0xf0c239), // 缃 Xiāng
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
    });

    html! {
        <ContextProvider<ThemeContextProviderType> context={ctx.clone()}>
            <Injector />
            {props.children.clone()  }
        </ContextProvider<ThemeContextProviderType>>
    }
}
