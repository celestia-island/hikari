// website/src/pages/components/layer1/basic.rs
// Layer 1: Basic components index

use dioxus::prelude::*;

use crate::components::{Layout, MarkdownRenderer};
use _icons::{Icon, MdiIcon};
use _palette::classes::{ClassesBuilder, Display, FontSize, MarginBottom, Padding, TextColor};

/// Layer 1 Basic Components Index
#[allow(non_snake_case)]
pub fn Layer1Basic() -> Element {
    let components = vec![
        ("Button", "按钮", "按钮组件", MdiIcon::Cursor),
        ("Input", "输入框", "输入框组件", MdiIcon::TextBox),
        ("Card", "卡片", "卡片组件", MdiIcon::ViewDashboard),
        ("Badge", "徽章", "徽章组件", MdiIcon::Star),
        ("Select", "选择器", "选择器组件", MdiIcon::ChevronDown),
        ("Checkbox", "复选框", "复选框组件", MdiIcon::CheckboxMarked),
        ("Radio", "单选框", "单选框组件", MdiIcon::Circle),
    ];

    let markdown_doc = r##"
# 基础组件

## Button 按钮

Button 组件是最基础的用户交互组件，支持多种样式和状态。

### 基础用法

```_hikari_component
pages/components/layer1/basic#button
```

### Props

- `children`: 按钮内容
- `variant`: 按钮样式变体
- `size`: 按钮尺寸

## Input 输入框

Input 组件用于接收用户输入。

### 基础用法

```_hikari_component
pages/components/layer1/basic#input
```

## Card 卡片

Card 组件用于内容分组和展示。

### 基础用法

```_hikari_component
pages/components/layer1/basic#card
```

## Badge 徽章

Badge 组件用于显示状态信息。

### 基础用法

```_hikari_component
pages/components/layer1/basic#badge
```

## Select 选择器

Select 组件用于从多个选项中选择一个。

### 基础用法

```_hikari_component
pages/components/layer1/basic#select
```

## Checkbox 复选框

Checkbox 组件用于多选场景。

### 基础用法

```_hikari_component
pages/components/layer1/basic#checkbox
```

## Radio 单选框

Radio 组件用于单选场景。

### 基础用法

```_hikari_component
pages/components/layer1/basic#radio
```
"##;

    rsx! {
    Layout {
        current_route: crate::app::Route::Layer1Basic {},
        div {
            class: ClassesBuilder::new()
                .add_raw("page-container")
                .build(),

            div {
                class: ClassesBuilder::new()
                    .add_raw("page-header")
                    .build(),

                h1 {
                    class: ClassesBuilder::new()
                        .add_raw("page-title")
                        .add(FontSize::X4xl)
                        .build(),
                    "Layer 1: 基础组件"
                }

                p {
                    class: ClassesBuilder::new()
                        .add_raw("page-description")
                        .add(TextColor::Muted)
                        .add(FontSize::Xl)
                        .build(),
                    "最基础的 UI 组件，可以直接使用或组合使用。"
                }
            }

            div {
                class: ClassesBuilder::new()
                    .add_raw("section")
                    .add(MarginBottom::Mb8)
                    .build(),

                h2 {
                    class: ClassesBuilder::new()
                        .add(FontSize::X2xl)
                        .add(MarginBottom::Mb4)
                        .build(),
                    "组件文档"
                }

                MarkdownRenderer {
                    content: markdown_doc.to_string(),
                }
            }

            div {
                class: ClassesBuilder::new()
                    .add(Display::Grid)
                    .add_raw("grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6")
                    .build(),

                    for (name, cn_name, description, icon) in components {
                        div {
                            class: ClassesBuilder::new()
                                .add_raw("component-card")
                                .add(Padding::P6)
                                .build(),

                            Icon {
                                icon,
                                size: 32,
                                class: "component-icon"
                            }

                            h3 {
                                class: ClassesBuilder::new()
                                    .add(FontSize::Lg)
                                    .add(MarginBottom::Mb1)
                                    .build(),
                                "{name}"
                            }

                            p {
                                class: ClassesBuilder::new()
                                    .add(TextColor::Muted)
                                    .add(FontSize::Sm)
                                    .build(),
                                "{cn_name}"
                            }

                            p {
                                class: ClassesBuilder::new()
                                    .add(TextColor::Muted)
                                    .add(FontSize::Xs)
                                    .build(),
                                "{description}"
                            }
                        }
                    }
                }
            }
        }
    }
}
