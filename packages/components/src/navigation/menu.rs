// hi-components/src/navigation/menu.rs
// Menu component with Arknights + FUI styling

#![expect(clippy::needless_update)]

use hikari_palette::classes::{ClassesBuilder, MenuClass};

use crate::{
    GlowBlur, GlowColor, GlowIntensity,
    basic::{Arrow, ArrowDirection},
    feedback::Glow,
    prelude::*,
    style_builder::{CssProperty, StyleStringBuilder},
    styled::StyledComponent,
};

#[derive(Clone, Default)]
pub struct MenuContext {
    pub in_popover: bool,
    pub glow_enabled: bool,
    pub request_close: Option<Callback<()>>,
}

impl MenuContext {
    pub fn in_popover(&self) -> bool {
        self.in_popover
    }

    pub fn glow_enabled(&self) -> bool {
        self.glow_enabled
    }
}

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum MenuMode {
    #[default]
    Vertical,
    Horizontal,
}

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum MenuItemHeight {
    #[default]
    Default,
    Compact,
    ExtraCompact,
}

impl MenuItemHeight {
    pub fn as_str(&self) -> &'static str {
        match self {
            MenuItemHeight::Default => "hi-menu-height-default",
            MenuItemHeight::Compact => "hi-menu-height-compact",
            MenuItemHeight::ExtraCompact => "hi-menu-height-extra-compact",
        }
    }
}

#[define_props]
pub struct MenuItemProps {
    #[default("".to_string())]
    pub item_key: String,

    #[default(false)]
    pub disabled: bool,

    pub icon: Option<Element>,

    #[default(VNode::empty())]
    pub children: Element,

    #[default("".to_string())]
    pub class: String,

    #[default(0)]
    pub level: u32,

    pub height: MenuItemHeight,

    pub onclick: Option<EventHandler<MouseEvent>>,

    #[default(false)]
    pub glow: bool,
}

#[define_props]
pub struct SubMenuProps {
    #[default]
    pub item_key: String,

    #[default]
    pub title: String,

    #[default]
    pub icon: Option<Element>,

    #[default]
    pub disabled: bool,

    #[default]
    pub default_expanded: bool,

    #[default]
    pub level: u32,

    #[default]
    pub height: MenuItemHeight,

    #[default]
    pub children: Element,

    #[default]
    pub class: String,
}

#[define_props]
pub struct MenuProps {
    #[default]
    pub default_active: String,

    #[default]
    pub inline: bool,

    #[default]
    pub mode: MenuMode,

    #[default]
    pub compact: bool,

    #[default]
    pub class: String,

    #[default]
    pub children: Element,

    pub on_select: Option<EventHandler<String>>,

    #[default]
    pub in_popover: bool,

    #[default]
    pub glow: bool,

    #[default]
    pub request_close: Option<Callback<()>>,
}

///
///
///
///
///
///
///
///
///
#[component]
pub fn Menu(props: MenuProps) -> Element {
    let _active_key = use_signal(|| props.default_active.clone());
    let mut _open_submenus = use_signal(Vec::<String>::new);

    let mode_class = match props.mode {
        MenuMode::Vertical => MenuClass::Vertical,
        MenuMode::Horizontal => MenuClass::Horizontal,
    };

    let glow_enabled = props.in_popover || props.glow;

    let menu_classes = {
        let builder = ClassesBuilder::new()
            .add(MenuClass::Menu)
            .add_if(MenuClass::Inline, || props.inline)
            .add(mode_class)
            .add_if(MenuClass::Compact, || props.compact)
            .add_if(MenuClass::PopoverMenu, || props.in_popover)
            .add_raw(&props.class);

        builder.build()
    };

    use_context_provider(move || MenuContext {
        in_popover: props.in_popover,
        glow_enabled,
        request_close: props.request_close.clone(),
    });

    rsx! {
        ul { class: menu_classes, role: "menu", {props.children} }
    }
}

pub struct MenuComponent;

impl StyledComponent for MenuComponent {
    fn styles() -> &'static str {
        include_str!(concat!(env!("OUT_DIR"), "/styles/menu.css"))
    }

    fn name() -> &'static str {
        "menu"
    }
}

#[component]
pub fn MenuItem(props: MenuItemProps) -> Element {
    let menu_context = try_consume_context::<MenuContext>();
    let should_glow = match &menu_context {
        Some(ctx) => {
            let ctx_val = ctx.get();
            props.glow || (ctx_val.in_popover && ctx_val.glow_enabled)
        }
        None => props.glow,
    };

    let item_classes = ClassesBuilder::new()
        .add(MenuClass::MenuItem)
        .add_raw(props.height.as_str())
        .add_raw(&props.class)
        .build();

    let menu_context_for_click = menu_context.clone();
    let item_content = rsx! {
        li {
            class: item_classes,
            role: "menuitem",
            "data-key": props.item_key,
            aria_disabled: props.disabled.to_string(),
            onclick: move |e| {
                if !props.disabled {
                    if let Some(handler) = props.onclick.as_ref() {
                        handler.call(e);
                    }
                    // Request close if in popover mode
                    if let Some(ctx) = &menu_context_for_click {
                        let ctx_val = ctx.get();
                        if let Some(close_cb) = &ctx_val.request_close {
                            close_cb.call(());
                        }
                    }
                }
            },

            div { class: "hi-menu-item-inner",
                if let Some(icon) = props.icon {
                    span { class: "hi-menu-item-icon", {icon} }
                }

                span { class: "hi-menu-item-content", {props.children} }
            }
        }
    };

    if should_glow {
        let wrapper_class = format!("hi-menu-item-wrapper {}", props.height.as_str());
        rsx! {
            div {
                class: wrapper_class,
                style: "width: 100%; position: relative;",
                Glow {
                    block: true,
                    blur: GlowBlur::Light,
                    color: GlowColor::Ghost,
                    intensity: GlowIntensity::Soft,
                    children: item_content,
                }
            }
        }
    } else {
        item_content
    }
}

#[component]
pub fn SubMenu(props: SubMenuProps) -> Element {
    let is_open = use_signal(|| props.default_expanded);

    let submenu_classes = ClassesBuilder::new()
        .add(MenuClass::Submenu)
        .add_if(MenuClass::SubmenuListOpen, || is_open.read())
        .add_raw(&props.class)
        .build();

    let list_classes = ClassesBuilder::new().add(MenuClass::SubmenuList).build();

    let is_open_for_memo = is_open.clone();
    let list_style = use_memo(move || {
        let (display, opacity, transform) = if is_open_for_memo.get() {
            ("block", "1", "translateX(0)")
        } else {
            ("none", "0", "translateX(-8px)")
        };

        StyleStringBuilder::new()
            .add(CssProperty::Display, display)
            .add(CssProperty::Opacity, opacity)
            .add(CssProperty::Transform, transform)
            .add(CssProperty::PaddingLeft, "1em")
            .build()
    });

    let is_open_for_click = is_open.clone();
    let title_content = rsx! {
        div {
            class: "{props.height.as_str()} hi-menu-submenu-title",
            aria_disabled: props.disabled.to_string(),
            onclick: move |_e| {
                if !props.disabled {
                    is_open_for_click.set(!is_open_for_click.get());
                }
            },

            div { class: "hi-menu-submenu-title-inner",
                if let Some(icon) = props.icon {
                    span { class: "hi-menu-item-icon", {icon} }
                }

                span { class: "hi-menu-item-content", "{props.title}" }

                Arrow {
                    direction: if is_open.read() { ArrowDirection::Down } else { ArrowDirection::Right },
                    size: 14,
                    class: if is_open.read() { "hi-menu-item-arrow hi-menu-submenu-arrow-open".to_string() } else { "hi-menu-item-arrow".to_string() },
                }
            }
        }
    };

    let wrapper_class = format!("hi-menu-item-wrapper {}", props.height.as_str());
    let title_with_glow = rsx! {
        div { class: wrapper_class, style: "width: 100%; position: relative;",
            Glow {
                blur: GlowBlur::Medium,
                color: GlowColor::Ghost,
                intensity: GlowIntensity::Dim,
                children: title_content,
            }
        }
    };

    rsx! {
        li {
            class: submenu_classes,
            role: "none",
            "data-key": props.item_key,

            {title_with_glow}

            ul {
                class: list_classes,
                style: list_style,
                role: "menu",
                "aria-hidden": "{!is_open.get()}",

                {props.children}
            }
        }
    }
}
