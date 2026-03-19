# Hikari -> Tairitsu 构建链迁移计划

     2→
     3→---
     4→
     5→## Phase 2: CSS 基础设施迁移到 tairitsu-style
     6→
     7→### 状态: ✅ 完成
     8→
     9>### 已完成的工作
    10→
    11#### StyleStringBuilder 和 CssProperty 迁移
    12→
    13- [x] 添加 `tairitsu-style` 依赖到 `hikari-animation`
    14- [x] 更新 `hikari-animation/src/style/mod.rs` re-export `StyleStringBuilder`, `CssProperty`, `Property`
    15- [x] 保留 `StyleBuilder`（HtmlElement 版本）在 `hikari-animation`
    16- [x] 删除旧的 `properties.rs` 文件
    17- [x] 所有 hikari 包编译通过
    18- [x] `CssProperty` 现在包含 403 个 W3C 标准属性
    19- [x] 代码减少 635 行（删除旧的 properties.rs）
    20
    21### 架构决策
    22
    23**ClassesBuilder 和 UtilityClass** 保留在 `hikari-palette`，原因：
    24
    25- tairitsu-style: Tailwind 风格 utility classes（用于 CSS 生成）
    26- hikari-palette: hikari 组件特定的 `hi-` 前缀类枚举
    27- 两者 API 不兼容，    28
    29- hikari-palette 有 18 个组件类枚举文件
    30- 这些枚举与 `hi-` 前缀样式系统紧密耦合
    31
    32```
    33┌─────────────────────────────────────────────────────────────┐
    34│                     hikari-animation                        │
    35│  ┌─────────────────────────────────────────────────────┐   │
    36│  │ re-export from tairitsu_style:                      │   │
    37│  │ - StyleStringBuilder                                 │   │
    38│  │ - CssProperty (403 W3C standard properties)          │   │
    39│  │ - Property                                           │   │
    40│  └─────────────────────────────────────────────────────┘   │
    41│  ┌─────────────────────────────────────────────────────┐   │
    42│  │ hikari-specific (web-sys integration):              │   │
    43│  │ - StyleBuilder (HtmlElement-based)                   │   │
    44│  │ - AttributeBuilder                                   │   │
    45│  │ - set_style, get_style, etc.                        │   │
    46│  └─────────────────────────────────────────────────────┘   │
    47│└─────────────────────────────────────────────────────────────┘
    48│
    49│                     hikari-palette                          │
    50│  ┌─────────────────────────────────────────────────────┐   │
    51│  │ hikari component class system:                       │   │
    52│  │ - ClassesBuilder (accepts impl UtilityClass)         │   │
    53│  │ - UtilityClass trait (hi- prefix)                    │   │
    54│  │ - 18 component class enums (Button, Table, etc.)     │   │
    55│  └─────────────────────────────────────────────────────┘   │
    56│└─────────────────────────────────────────────────────────────┘
    57→```
    58
    59---
    60→
    61## Phase 3: Props 宏迁移
    62
    63### 状态: 🔄 进行中
    64
    65将更多组件 Props 迁移到 `#[define_props]` 宏。
    66
    67| 组件 | Props | 状态 |
    68| |---|---|---|
    69| | icons | IconProps | ✅ 已完成 |
    70| | data/table | TableProps | ✅ 已完成 |
    71> | basic/button | ButtonProps | ✅ 已完成 |
    72> | basic/input | InputProps | ✅ 已完成 |
    73> | basic/textarea | TextareaProps | ✅ 已完成 |
    74> | basic/badge | BadgeProps | ✅ 已完成 |
    75> | basic/card | CardProps | ✅ 已完成 |
    76> | basic/slider | SliderProps | ✅ 已完成 |
    77> | basic/switch | SwitchProps | ✅ 已完成 |
    78> | basic/checkbox | CheckboxProps | ✅ 已完成 |
    79> | basic/radio_group | RadioProps, RadioGroupProps | ✅ 已完成 |
    80> | basic/icon_button | IconButtonProps | ✅ 已完成 |
    81> | basic/card (sub) | CardHeaderProps, CardContentProps, CardActionsProps, CardMediaProps | ✅ 已完成 |
    82> | layout/flex | FlexBoxProps | ✅ 已完成 |
    83> | feedback/alert | AlertProps | ✅ 已完成 |
    84> | feedback/toast | ToastProps | ✅ 已完成 |
    85> | feedback/tooltip | TooltipProps | ✅ 已完成 |
    86> | feedback/drawer | DrawerProps | ✅ 已完成 |
    87> | feedback/progress | ProgressProps | ✅ 已完成 |
    88> | feedback/spin | SpinProps | ✅ 已完成 |
    89> | feedback/popover | PopoverProps | ✅ 已完成 |
    90> | feedback/glow | GlowProps | ✅ 已完成 |
    91> | navigation/stepper | StepperProps | ✅ 已完成 |
    92> | navigation/breadcrumb | BreadcrumbProps, BreadcrumbItemProps | 待处理 |
    93> | navigation/tabs | TabProps, TabPanelProps | 待处理 |
    94> | navigation/menu | MenuItemProps, etc. | 待处理 |
    95> | navigation/sidebar | SidebarProps, etc. | 待处理 |
    96> | display/tag | TagProps | 待处理 |
    97> | display/calendar | CalendarProps | 待处理 |
    98> | display/timeline | TimelineProps, TimelineItemProps | 待处理 |
    99> | display/qrcode | QRCodeProps | 待处理 |
    100> | entry/number_input | NumberInputProps | 待处理 |
    101> | entry/search | SearchProps | 待处理 |
    102> | entry/transfer | TransferProps | 待处理 |
    103> | entry/auto_complete | AutoCompleteProps | 待处理 |
    104> | entry/cascader | CascaderProps | 待处理 |
    105> | data/pagination | PaginationProps | 待处理 |
    106> | data/virtual_scroll | VirtualScrollProps | 待处理 |
    107> | data/drag | DragProps, etc. | 待处理 |
    108> | production/* | *Props | 待处理 |
    109
    110>---
    111
    112## Phase 4: 文档更新
    113
    114- [ ] 更新 `docs/en-US/guides/02-classesbuilder-system.md`
    115- [ ] 更新 `docs/en-US/guides/03-stylestringbuilder-system.md`
    116- - [ ] 添加迁移指南
