# Hikari -> Tairitsu 构建链迁移计划

---

## Phase 2: CSS 基础设施迁移到 tairitsu-style

### 状态: ✅ 完成

#### StyleStringBuilder 和 CssProperty 迁移

- [x] 添加 `tairitsu-style` 依赖到 `hikari-animation`
- [x] 更新 `hikari-animation/src/style/mod.rs` re-export `StyleStringBuilder`, `CssProperty`, `Property`
- [x] 保留 `StyleBuilder`（HtmlElement 版本）在 `hikari-animation`
- [x] 删除旧的 `properties.rs` 文件
- [x] 所有 hikari 包编译通过
- [x] `CssProperty` 现在包含 403 个 W3C 标准属性
- [x] 代码减少 635 行（删除旧的 properties.rs）

### 架构决策

**ClassesBuilder 和 UtilityClass** 保留在 `hikari-palette`，原因：

- tairitsu-style: Tailwind 风格 utility classes（用于 CSS 生成）
- hikari-palette: hikari 组件特定的 `hi-` 前缀类枚举
- 两者 API 不兼容
- hikari-palette 有 18 个组件类枚举文件
- 这些枚举与 `hi-` 前缀样式系统紧密耦合

```
┌─────────────────────────────────────────────────────────────┐
│                     hikari-animation                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ re-export from tairitsu_style:                      │   │
│  │ - StyleStringBuilder                                 │   │
│  │ - CssProperty (403 W3C standard properties)          │   │
│  │ - Property                                           │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ hikari-specific (web-sys integration):              │   │
│  │ - StyleBuilder (HtmlElement-based)                   │   │
│  │ - AttributeBuilder                                   │   │
│  │ - set_style, get_style, etc.                        │   │
│  └─────────────────────────────────────────────────────┘   │
│└─────────────────────────────────────────────────────────────┘
│
│                     hikari-palette                          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ hikari component class system:                       │   │
│  │ - ClassesBuilder (accepts impl UtilityClass)         │   │
│  │ - UtilityClass trait (hi- prefix)                    │   │
│  │ - 18 component class enums (Button, Table, etc.)     │   │
│  └─────────────────────────────────────────────────────┘   │
│└─────────────────────────────────────────────────────────────┘
```

---

## Phase 3: Props 宏迁移

### 状态: ✅ 完成

所有组件 Props 已成功迁移到 `#[define_props]` 宏。

| 组件 | Props | 状态 |
| |---|---|---|
| | icons | IconProps | ✅ 已完成 |
| | data/table | TableProps | ✅ 已完成 |
| | basic/button | ButtonProps | ✅ 已完成 |
| | basic/input | InputProps | ✅ 已完成 |
| | basic/textarea | TextareaProps | ✅ 已完成 |
| | basic/badge | BadgeProps | ✅ 已完成 |
| | basic/card | CardProps | ✅ 已完成 |
| | basic/slider | SliderProps | ✅ 已完成 |
| | basic/switch | SwitchProps | ✅ 已完成 |
| | basic/checkbox | CheckboxProps | ✅ 已完成 |
| | basic/radio_group | RadioProps, RadioGroupProps | ✅ 已完成 |
| | basic/icon_button | IconButtonProps | ✅ 已完成 |
| | basic/card (sub) | CardHeaderProps, CardContentProps, CardActionsProps, CardMediaProps | ✅ 已完成 |
| | layout/flex | FlexBoxProps | ✅ 已完成 |
| | feedback/alert | AlertProps | ✅ 已完成 |
| | feedback/toast | ToastProps | ✅ 已完成 |
| | feedback/tooltip | TooltipProps | ✅ 已完成 |
| | feedback/drawer | DrawerProps | ✅ 已完成 |
| | feedback/progress | ProgressProps | ✅ 已完成 |
| | feedback/spin | SpinProps | ✅ 已完成 |
| | feedback/popover | PopoverProps | ✅ 已完成 |
| | feedback/glow | GlowProps | ✅ 已完成 |
| | navigation/stepper | StepperProps | ✅ 已完成 |
| | navigation/breadcrumb | BreadcrumbProps, BreadcrumbItemProps | ✅ 已完成 |
| | navigation/tabs | TabProps, TabPanelProps | ✅ 已完成 |
| | navigation/menu | MenuItemProps, etc. | ✅ 已完成 |
| | navigation/sidebar | SidebarProps, etc. | ✅ 已完成 |
| | display/tag | TagProps | ✅ 已完成 |
| | display/calendar | CalendarProps | ✅ 已完成 |
| | display/timeline | TimelineProps, TimelineItemProps | ✅ 已完成 |
| | display/qrcode | QRCodeProps | ✅ 已完成 |
| | entry/number_input | NumberInputProps | ✅ 已完成 |
| | entry/search | SearchProps | ✅ 已完成 |
| | entry/transfer | TransferProps | ✅ 已完成 |
| | entry/auto_complete | AutoCompleteProps | ✅ 已完成 |
| | entry/cascader | CascaderProps | ✅ 已完成 |
| | data/pagination | PaginationProps | ✅ 已完成 |
| | data/virtual_scroll | VirtualScrollProps | ✅ 已完成 |
| | data/drag | DragProps, etc. | ✅ 已完成 |
| | production/code_highlight | CodeHighlightProps | ✅ 已完成 |
| | production/markdown_editor | MarkdownEditorProps | ✅ 已完成 |
| | production/rich_text_editor | RichTextEditorProps | ✅ 已完成 |
| | production/video_player | VideoPlayerProps | ✅ 已完成 |
| | production/audio_player | AudioPlayerProps | ✅ 已完成 |

---

## Phase 4: 文档更新

- [ ] 更新 `docs/en-US/guides/02-classesbuilder-system.md`
- [ ] 更新 `docs/en-US/guides/03-stylestringbuilder-system.md`
- [ ] 添加迁移指南
