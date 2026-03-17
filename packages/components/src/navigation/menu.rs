// hi-components/src/navigation/menu.rs
// Menu component with Arknights + FUI styling

use animation::style::{CssProperty, StyleStringBuilder};
use crate::prelude::*;
use hikari_palette::classes::{ClassesBuilder, MenuClass};

use crate::{
    GlowBlur, GlowColor, GlowIntensity,
    basic::{Arrow, ArrowDirection},
    feedback::Glow,
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

#[derive(Clone, PartialEq, Props)]
pub struct MenuItemProps {
    #[props(default)]
    pub item_key: String,

    #[props(default)]
    pub disabled: bool,

    #[props(default)]
    pub icon: Option<Element>,

    #[props(default)]
    pub children: Element,

    #[props(default)]
    pub class: String,

    #[props(default)]
    pub level: u32,

    #[props(default)]
    pub height: MenuItemHeight,

    pub onclick: Option<EventHandler<MouseEvent>>,

    #[props(default)]
    pub glow: bool,
}

impl Default for MenuItemProps {
    fn default() -> Self {
        Self {
            item_key: String::default(),
            disabled: false,
            icon: None,
            children: VNode::empty(),
            class: String::default(),
            level: 0,
            height: MenuItemHeight::Default,
            onclick: None,
            glow: false,
        }
    }
}

#[derive(Clone, PartialEq, Props)]
pub struct SubMenuProps {
    #[props(default)]
    pub item_key: String,

    #[props(default)]
    pub title: String,

    #[props(default)]
    pub icon: Option<Element>,

    #[props(default)]
    pub disabled: bool,

    #[props(default)]
    pub default_expanded: bool,

    #[props(default)]
    pub level: u32,

    #[props(default)]
    pub height: MenuItemHeight,

    #[props(default)]
    pub children: Element,

    #[props(default)]
    pub class: String,
}

impl Default for SubMenuProps {
    fn default() -> Self {
        Self {
            item_key: String::default(),
            title: String::default(),
            icon: None,
            disabled: false,
            default_expanded: false,
            level: 0,
            height: MenuItemHeight::Default,
            children: VNode::empty(),
            class: String::default(),
        }
    }
}

#[derive(Clone, PartialEq, Props)]
pub struct MenuProps {
    #[props(default)]
    pub default_active: String,

    #[props(default)]
    pub inline: bool,

    #[props(default)]
    pub mode: MenuMode,

    #[props(default)]
    pub compact: bool,

    #[props(default)]
    pub class: String,

    #[props(default)]
    pub children: Element,

    pub on_select: Option<EventHandler<String>>,

    #[props(default)]
    pub in_popover: bool,

    #[props(default)]
    pub glow: bool,

    #[props(default)]
    pub request_close: Option<Callback<()>>,
}

impl Default for MenuProps {
    fn default() -> Self {
        Self {
            default_active: String::default(),
            inline: false,
            mode: Default::default(),
            compact: false,
            class: String::default(),
            children: VNode::empty(),
            on_select: None,
            in_popover: false,
            glow: false,
            request_close: None,
        }
    }
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

    use_context_provider(|| MenuContext {
        in_popover: props.in_popover,
        glow_enabled,
        request_close: props.request_close,
    });

    rsx! {
        ul {
            class: "{menu_classes}",
            role: "menu",

            { props.children }
        }
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
        Some(ctx) => props.glow || (ctx.in_popover && ctx.glow_enabled),
        None => props.glow,
    };

    let item_classes = ClassesBuilder::new()
        .add(MenuClass::MenuItem)
        .add_raw(props.height.as_str())
        .add_raw(&props.class)
        .build();

    let item_content = rsx! {
        li {
            class: "{item_classes}",
            role: "menuitem",
            "data-key": "{props.item_key}",
            aria_disabled: props.disabled.to_string(),
            onclick: move |e| {
                if !props.disabled {
                    if let Some(handler) = props.onclick.as_ref() {
                        handler.call(e);
                    }
                    // Request close if in popover mode
                    if let Some(ctx) = &menu_context
                        && ctx.in_popover
                            && let Some(close_cb) = &ctx.request_close {
                                close_cb.call(());
                            }
                }
            },

            div { class: "hi-menu-item-inner",
                if let Some(icon) = props.icon {
                    span { class: "hi-menu-item-icon", { icon } }
                }

                span { class: "hi-menu-item-content", { props.children } }
            }
        }
    };

    if should_glow {
        let wrapper_class = format!("hi-menu-item-wrapper {}", props.height.as_str());
        rsx! {
            div {
                class: "{wrapper_class}",
                style: "width: 100%; position: relative;",
                Glow {
                    block: true,
                    blur: GlowBlur::Light,
                    color: GlowColor::Ghost,
                    intensity: GlowIntensity::Soft,
                    children: item_content
                }
            }
        }
    } else {
        item_content
    }
}

#[component]
pub fn SubMenu(props: SubMenuProps) -> Element {
    let mut is_open = use_signal(|| props.default_expanded);

    let submenu_classes = ClassesBuilder::new()
        .add(MenuClass::Submenu)
        .add_if(MenuClass::SubmenuListOpen, || *is_open.read())
        .add_raw(&props.class)
        .build();

    let list_classes = ClassesBuilder::new().add(MenuClass::SubmenuList).build();

    let list_style = use_memo(move || {
        let (display, opacity, transform) = if is_open() {
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

    let title_content = rsx! {
       div {
           class: "{props.height.as_str()} hi-menu-submenu-title",
           aria_disabled: props.disabled.to_string(),
           onclick: move |_e| {
               if !props.disabled {
                   is_open.set(!is_open());
               }
           },

           div { class: "hi-menu-submenu-title-inner",
               if let Some(icon) = props.icon {
                   span { class: "hi-menu-item-icon", { icon } }
               }

                 span { class: "hi-menu-item-content", "{props.title}" }

                  Arrow {
                     direction: if *is_open.read() { ArrowDirection::Down } else { ArrowDirection::Right },
                     size: 14,
                     class: if *is_open.read() { "hi-menu-item-arrow hi-menu-submenu-arrow-open" } else { "hi-menu-item-arrow" },
                  }
             }
         }
    };

    let wrapper_class = format!("hi-menu-item-wrapper {}", props.height.as_str());
    let title_with_glow = rsx! {
        div {
            class: "{wrapper_class}",
            style: "width: 100%; position: relative;",
            Glow {
                blur: GlowBlur::Medium,
                color: GlowColor::Ghost,
                intensity: GlowIntensity::Dim,
                children: title_content
            }
        }
    };

    rsx! {
        li {
            class: "{submenu_classes}",
            role: "none",
            "data-key": "{props.item_key}",

            { title_with_glow }

            ul {
                class: "{list_classes}",
                style: "{list_style}",
                role: "menu",
                "aria-hidden": "{!is_open()}",

                { props.children }
            }
        }
    }
}
