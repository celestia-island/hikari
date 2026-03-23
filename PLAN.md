# Hikari 组件修复计划

## 已完成 ✅

- **Web-Sys 清理**：组件层已全面迁移到 Platform API，不再直接依赖 web-sys。新增 query_selector / get_element_rect_by_id / on_scroll / draw_qrcode_on_canvas_by_id / request_animation_frame 等 Platform API。WIT 文件语法问题已修复。
- **CSS/SCSS 编译管线**：tairitsu-packager 的 SCSS 编译器已从 193 行玩具解析器替换为 Grass（Dart Sass Rust 实现），支持 @import / $variable / @mixin / @keyframes / @media。load_paths 已正确传递。CssExtractor 已移除。index.scss 已补全 12 个缺失导入。bundle.css 从 12,945 bytes 增长到 259,020 bytes，包含全部 59 个组件样式。

---

## 组件样式 & 国际化全面审计

### 问题概述

CSS 编译管线修复后，`bundle.css` 已包含 59 个组件的所有 SCSS 规则（259KB）。但浏览器中大量样式仍未生效。

**根因**：在从 Dioxus 迁移到 Tairitsu 的过程中，组件丧失了大量的样式类分配能力：

| 问题类别 | 严重度 | 影响范围 |
|---------|--------|---------|
| A. CSS 类名不匹配（SCSS ↔ Palette） | 🔴 严重 | Tabs 等至少 5 个组件 |
| B. Palette 枚举覆盖不足 | 🟡 中等 | Menu、Breadcrumb、Card 等 15+ 组件 |
| C. 有 SCSS 但无 Palette 枚举的组件 | 🟡 中等 | Avatar、Image、Background 等 7 个组件 |
| D. 缺失状态/尺寸类 | 🟡 中等 | Input、Button、Menu 等大量组件 |
| E. 国际化（i18n）迁移到 Tairitsu | 🟠 规划 | 新建 tairitsu-i18n 包，72 个组件逐步集成 |
| F. build.rs 组件级编译缺 load_paths | 🟡 中等 | 37 个使用 include_str! 的组件 |
| G. 无 StyledComponent 的组件 | 🟢 低 | 12 个子组件/辅助组件 |

---

### A. CSS 类名不匹配（🔴 严重）

SCSS 选择器与 Palette 枚举的 `as_suffix()` 生成的类名不一致，导致样式完全无法匹配。

#### Tabs — 关键不匹配

| 元素 | SCSS 选择器 | Palette `as_class()` 输出 | 匹配? |
|------|------------|--------------------------|-------|
| 标签项 | `.hi-tab` | `hi-tabs-tab` | ❌ |
| 激活态 | `.hi-tab-active` | `hi-tabs-tab-active` | ❌ |
| 禁用态 | `.hi-tab-disabled` | `hi-tabs-tab-disabled` | ❌ |
| 面板 | `.hi-tab-panel` | `hi-tabs-tabpane` | ❌ |
| 面板激活 | `.hi-tab-panel-active` | `hi-tabs-tabpane-active` | ❌ |
| 标签图标 | `.hi-tabs-tab-icon` | 硬编码 `"hi-tabs-tab-icon"` | ✅ |
| 标签文字 | `.hi-tabs-tab-label` | 硬编码 `"hi-tabs-tab-label"` | ✅ |

**修复方案**：修改 `TabsClass::as_suffix()` 以匹配 SCSS 命名，或反向修改 SCSS。推荐修改 Palette 枚举因为 SCSS 是设计稿的权威来源。

**需要修改的 Palette 映射**：
```
TabsTab:        "tabs-tab"        → "tab"
TabActive:      "tabs-tab-active" → "tab-active"
TabDisabled:    "tabs-tab-disabled" → "tab-disabled"
TabsTabpane:    "tabs-tabpane"    → "tab-panel"
TabpaneActive:  "tabs-tabpane-active" → "tab-panel-active"
TabpaneInactive: "tabs-tabpane-inactive" → "tab-panel-inactive" (SCSS 无此选择器，保留)
```

#### 其他可能存在类名不匹配的组件

需要逐一对比 SCSS 选择器与 Palette 枚举，以下为已知的需要核查清单：

| 组件 | 可疑问题 |
|------|---------|
| Breadcrumb | Palette 仅 2 个变体（Breadcrumb, BreadcrumbItem），SCSS 有 30+ 选择器 |
| Menu | Palette 11 变体，SCSS 35+ 选择器，缺 `-item-active`, `-item-disabled`, `-collapsed`, `-sm/md/lg` |
| Card | 缺 `-sm/md/lg`, `-flat`, `-cover`, `-footer`, `-grid`, `-animate-in`, `-loading` |
| Select | 缺 `-dropdown`, `-option`, `-option-selected`, `-placeholder`, `-arrow` |
| Sidebar | 缺 `-item-active`, `-item-icon`, `-submenu`, `-collapsed`, `-divider` |

---

### B. 硬编码类名组件清单

| 组件 | 硬编码类名示例 | Palette 是否有枚举 | 修复建议 |
|------|-------------|-------------------|---------|
| avatar | `"hi-avatar"`, `"hi-avatar-icon"`, `"hi-avatar-fallback"`, `"hi-avatar-img"` | ❌ 无 | 新建 AvatarClass 枚举 |
| background | `"hi-background"` | ❌ 无 | 新建 BackgroundClass 枚举 |
| canvas | `"hi-canvas"` | ❌ 无 | 新建（或不需要，仅 1 类） |
| image | `"hi-image"`, `"hi-image-container"`, `"hi-image-placeholder"` | ❌ 无 | 新建 ImageClass 枚举 |
| modal | `"hi-modal"` 等 | ✅ ModalClass 已存在 | 导入并使用 |
| collapse | 未使用 Palette | ✅ CollapseClass 已存在 | 导入并使用 |
| tree | 未使用 Palette | ✅ TreeClass 已存在 | 导入并使用 |

---

### C. 错误的 Palette 枚举使用

| 组件 | 当前导入 | 应改为 |
|------|---------|--------|
| `data/drag.rs` | `TreeClass` | 新建 `DragClass` 或使用 `DragDropTreeClass` |
| `data/virtual_scroll.rs` | `TreeClass` | `VirtualScrollClass`（已在 Palette 中定义） |
| `display/skeleton.rs` | 通用 `Display, FlexDirection, Gap, Padding` | 补充 `SkeletonClass` 导入 |
| `basic/textarea.rs` | `InputClass` | 可接受（共享输入样式），但需验证 |
| `basic/icon_button.rs` | `ButtonClass` | 可接受（共享按钮样式），但缺 icon 特有类 |

---

### D. Palette 中存在但无组件使用的枚举

| 枚举名 | 所在文件 | 状态 |
|--------|---------|------|
| `SpotlightClass` | display.rs | ❌ 无对应组件 |
| `DescriptionListClass` | display.rs | ❌ 无对应组件 |
| `DropdownClass` | feedback.rs | ❌ 无对应组件（Popover/Select 可用） |
| `RowClass` | layout.rs | ❌ 无对应组件 |
| `TableHeaderClass` | data.rs | ⚠️ Table 子组件可用 |
| `TreeClassNew` / `TreeLabelClass` | data.rs | ⚠️ 未被引用 |
| `DragDropTreeClass` | data.rs | ⚠️ drag.rs 未使用 |
| `PortalClass` | misc.rs | ⚠️ portal/ 可用 |

---

### E. 国际化（i18n）— 迁移到 Tairitsu

**决策：废弃 `hikari_i18n`，迁移到 Tairitsu 提供的 i18n 设施。**

#### 现状

- `hikari_i18n`（`packages/i18n/`）：有 Language 枚举（9 种语言）、I18nKeys 结构体、TOML 翻译文件（9 语言），但 `i18n!` 宏是空壳（仅返回键名），且 **0 个组件** 使用
- Tairitsu 已有 `provide_context` / `use_context` / `consume_context` hooks，可作为 i18n 的 Provider 基础

#### 迁移方案：在 Tairitsu 中新建 `tairitsu-i18n` 包

```
tairitsu/packages/i18n/
├── Cargo.toml          # deps: serde, toml, tairitsu-hooks
├── src/
│   ├── lib.rs          # pub mod + re-exports
│   ├── language.rs     # Language 枚举（从 hikari_i18n 迁移）
│   ├── keys.rs         # I18nKeys 结构体（从 hikari_i18n 迁移）
│   ├── loader.rs       # load_toml()（从 hikari_i18n 迁移）
│   ├── context.rs      # I18nContext + provide_i18n() + use_i18n() hook
│   └── macros.rs       # t!() 宏 — 真正实现翻译查找
```

#### 关键 API 设计

```rust
// context.rs — 基于 tairitsu hooks 的 Context Provider
pub struct I18nContext {
    pub language: Language,
    pub keys: I18nKeys,
}

pub fn provide_i18n(lang: Language, keys: I18nKeys) {
    provide_context(I18nContext { language: lang, keys });
}

pub fn use_i18n() -> I18nContext {
    consume_context::<I18nContext>()
}

// macros.rs — 实际翻译查找
macro_rules! t {
    ($key_path:expr) => {{
        let ctx = use_i18n();
        ctx.keys.get($key_path)
    }};
}
```

#### 迁移步骤

1. **在 tairitsu 创建 `packages/i18n/`**：将 Language / I18nKeys / loader 从 hikari 移入，新增 Context Provider + `use_i18n()` hook + `t!()` 宏
2. **hikari_i18n 变为薄包装**：`hikari_i18n` 仅 re-export `tairitsu_i18n`，保持向后兼容
3. **翻译文件保留在 hikari**：`packages/i18n/locales/` 是 hikari 项目特有内容，不迁移到 tairitsu
4. **组件逐步集成**：优先集成需要文案的组件（date_picker / file_upload / pagination / search / empty / transfer）

#### 需要 i18n 的组件

| 优先级 | 组件 | 需翻译的文案 |
|--------|------|-------------|
| 高 | date_picker | 月份名、星期名、确认/取消按钮 |
| 高 | pagination | "第 X 页 / 共 Y 页"、"跳至" |
| 高 | search | "搜索..." 占位符 |
| 高 | empty | "暂无数据" |
| 中 | file_upload | "点击或拖拽上传" |
| 中 | transfer | "全选"、"取消" |
| 中 | table (sort/filter) | "排序"、"筛选" |
| 低 | 所有组件 aria-label | 无障碍文案 |

---

### F. build.rs 组件级编译问题

`packages/components/build.rs` 使用 `ScssCompiler::new()`（无 load_paths），导致需要 `@import` 主题变量/混入的组件 SCSS 无法正确编译。

**当前**：37 个组件通过 `include_str!(concat!(env!("OUT_DIR"), "/styles/*.css"))` 注入组件级样式。

**修复**：在 `build.rs` 中传入 `load_paths`：
```rust
let compiler = ScssCompiler::with_options(CompilerOptions {
    load_paths: vec![
        PathBuf::from("../theme/styles"),
        PathBuf::from("src/styles"),
    ],
    ..Default::default()
});
```

---

### 修复优先级与执行计划

#### P0 — 立即修复（阻塞正常渲染）

| 任务 | 影响 | 工作量 |
|------|------|--------|
| 修复 Tabs 类名不匹配（修改 `TabsClass::as_suffix()`） | Tabs 组件完全无样式 | 小 |
| Modal 导入 ModalClass | Modal 丢失结构类 | 小 |
| Collapse 导入 CollapseClass | Collapse 丢失结构类 | 小 |
| Tree 导入 TreeClass | Tree 丢失结构类 | 小 |
| virtual_scroll 改用 VirtualScrollClass | VirtualScroll 类名错误 | 小 |
| drag.rs 修正 Palette 引用 | drag 类名错误 | 小 |

#### P1 — 重要修复（覆盖度提升）

| 任务 | 影响 | 工作量 |
|------|------|--------|
| 全面对比每个组件的 SCSS 选择器 vs Palette 枚举 vs rsx! 输出 | 发现更多类名不匹配 | 大 |
| 为 Avatar、Image、Background 新建 Palette 枚举 | 硬编码组件获得类型安全 | 中 |
| 补充 Menu/Breadcrumb/Card/Select 等的缺失 Palette 变体 | 增加样式覆盖 | 中 |
| 修复 build.rs 添加 load_paths | 组件级 CSS 编译正确 | 小 |
| Layout 组件族添加 StyledComponent 实现 | 布局组件可注入样式 | 中 |

#### P2 — 功能增强

| 任务 | 影响 | 工作量 |
|------|------|--------|
| 添加尺寸类支持（sm/md/lg）到核心组件 | 响应式设计 | 大 |
| 添加状态类（error/success/focused/disabled）到表单组件 | 表单验证反馈 | 大 |
| 在 tairitsu 新建 `tairitsu-i18n` 包（迁移 Language/Keys/loader + 新增 Provider/hook/宏） | i18n 基础设施 | 中 |
| hikari 组件集成 `tairitsu-i18n`（date_picker/pagination/search/empty 优先） | 多语言支持 | 大 |
| 清理未使用的 Palette 枚举 | 代码整洁 | 小 |

#### P3 — 技术债务

| 任务 | 影响 | 工作量 |
|------|------|--------|
| 统一所有组件使用 `#[define_props]` | Props 系统一致性 | 中 |
| 为缺少 SCSS 的组件补充样式文件 | 样式完整性 | 大 |
| Skeleton 导入 SkeletonClass | 类型安全 | 小 |

---

### 审计统计摘要

| 指标 | 数值 |
|------|------|
| 组件总文件数 | 72 |
| 有 StyledComponent 实现 | 65（90%） |
| 使用 Palette 专用枚举 | 55（76%） |
| 有对应 SCSS 文件 | 59 个 SCSS 对应约 45 个组件 |
| 使用 `#[define_props]` | 约 48（67%） |
| 使用 i18n | 0（0%） |
| 类名完全匹配（确认） | ~15 个（Table, Alert, Toast 等） |
| 类名不匹配或未审计 | ~30 个 |
| 无 Palette 且硬编码 | 7 个 |

---

## 全组件审计表 (Per-Component Audit)

> 审计范围：`packages/components/src/` 下所有组件源文件
> 审计日期：2026-03-24

### 图例

| 符号 | 含义 |
|------|------|
| ✅ | 存在/已实现 |
| ❌ | 缺失/未实现 |
| 🆕 | 使用新版 `#[define_props]` (Tairitsu) |
| 🏚️ | 使用旧版 `#[derive(Props)]` (Dioxus) |
| 🔀 | 混合使用（同一文件中两种都有） |

---

### basic/ — 基础组件

| 组件文件 | SCSS 文件 | StyledComponent | Palette Class Enum | i18n | Props 风格 |
|----------|-----------|:---------------:|-------------------:|:----:|:----------:|
| `basic/arrow.rs` | `styles/components/arrow.scss` ✅ | ✅ `ArrowComponent` | `components::ArrowClass` | ❌ | 裸 `#[component]` |
| `basic/avatar.rs` | `styles/components/avatar.scss` ✅ | ❌ | ❌ | ❌ | 裸 `#[component]` |
| `basic/background.rs` | `styles/components/background.scss` ✅ + `basic/styles/background.scss` | ✅ `BackgroundComponent` | ❌ (仅 `hikari_palette` 颜色常量) | ❌ | 🏚️ `#[derive(Props)]` |
| `basic/badge.rs` | `styles/components/badge.scss` ✅ | ✅ `BadgeComponent` | `BadgeClass` | ❌ | 🆕 `#[define_props]` |
| `basic/button.rs` | `styles/components/button.scss` ✅ | ✅ `ButtonComponent` | `ButtonClass` | ❌ | 🆕 `#[define_props]` |
| `basic/canvas.rs` | ❌ | ✅ `CanvasComponent` | ❌ | ❌ | 裸 `#[component]` |
| `basic/card.rs` | `styles/components/card.scss` ✅ | ✅ `CardComponent` | `CardClass` | ❌ | 🆕 `#[define_props]` |
| `basic/checkbox.rs` | `styles/components/checkbox.scss` ✅ | ✅ `CheckboxComponent` | `CheckboxClass` | ❌ | 🆕 `#[define_props]` |
| `basic/date_picker.rs` | ❌ | ✅ `DatePickerComponent` | `DatePickerClass` | ❌ | 🏚️ `#[derive(Props)]` |
| `basic/file_upload.rs` | ❌ | ✅ `FileUploadComponent` | `FileUploadClass` | ❌ | 🏚️ `#[derive(Props)]` |
| `basic/form_field.rs` | ❌ | ✅ `FormFieldComponent` | `FormFieldClass` | ❌ | 🏚️ `#[derive(Props)]` |
| `basic/icon_button.rs` | `styles/components/icon_button.scss` ✅ | ✅ `IconButtonComponent` | `components::ButtonClass` | ❌ | 🆕 `#[define_props]` |
| `basic/image.rs` | `styles/components/image.scss` ✅ | ❌ | ❌ | ❌ | 裸 `#[component]` |
| `basic/input.rs` | `styles/components/input.scss` ✅ | ✅ `InputComponent` | `InputClass` | ❌ | 🆕 `#[define_props]` |
| `basic/input_wrapper.rs` | `styles/components/input_wrapper.scss` ✅ | ✅ `InputWrapperComponent` | `InputWrapperClass` | ❌ | 🏚️ `#[derive(Props)]` |
| `basic/radio_group.rs` | `styles/components/radio.scss` ✅ | ✅ `RadioGroupComponent` | `RadioClass` | ❌ | 🆕 `#[define_props]` |
| `basic/select.rs` | `styles/components/select.scss` ✅ | ✅ `SelectComponent` | `SelectClass` | ❌ | 🏚️ `#[derive(Props)]` |
| `basic/slider.rs` | `styles/components/slider.scss` ✅ | ✅ `SliderComponent` | `SliderClass` | ❌ | 🆕 `#[define_props]` |
| `basic/switch.rs` | `styles/components/switch.scss` ✅ | ✅ `SwitchComponent` | `SwitchClass` | ❌ | 🆕 `#[define_props]` |
| `basic/textarea.rs` | ❌ (共用 input.scss) | ✅ `TextareaComponent` | `InputClass` | ❌ | 🆕 `#[define_props]` |

### navigation/ — 导航组件

| 组件文件 | SCSS 文件 | StyledComponent | Palette Class Enum | i18n | Props 风格 |
|----------|-----------|:---------------:|-------------------:|:----:|:----------:|
| `navigation/anchor.rs` | `styles/components/anchor.scss` ✅ | ❌ | `AnchorClass` (via `hikari_palette::classes`) | ❌ | 🏚️ `#[derive(Props)]` |
| `navigation/breadcrumb.rs` | `styles/components/breadcrumb.scss` ✅ | ✅ `BreadcrumbComponent` | `components::BreadcrumbClass` | ❌ | 🆕 `#[define_props]` |
| `navigation/menu.rs` | `styles/components/menu.scss` ✅ | ✅ `MenuComponent` | `MenuClass` | ❌ | 🔀 `#[define_props]` + `#[derive(Props)]` |
| `navigation/sidebar.rs` | `styles/components/sidebar.scss` ✅ | ✅ `SidebarComponent` | `SidebarClass` | ❌ | 🆕 `#[define_props]` |
| `navigation/stepper.rs` | `styles/components/stepper.scss` ✅ | ✅ `StepperComponent` | `StepperClass` | ❌ | 🏚️ `#[derive(Props)]` |
| `navigation/steps.rs` | ❌ (共用 stepper.scss) | ✅ `StepsComponent` | `StepsClass` | ❌ | 🏚️ `#[derive(Props)]` |
| `navigation/tabs.rs` | `styles/components/tabs.scss` ✅ | ✅ `TabsComponent` | `components::TabsClass` | ❌ | 🆕 `#[define_props]` |

### feedback/ — 反馈组件

| 组件文件 | SCSS 文件 | StyledComponent | Palette Class Enum | i18n | Props 风格 |
|----------|-----------|:---------------:|-------------------:|:----:|:----------:|
| `feedback/alert.rs` | `styles/components/alert.scss` ✅ | ✅ `AlertComponent` | `AlertClass` | ❌ | 🆕 `#[define_props]` |
| `feedback/drawer.rs` | ❌ | ✅ `DrawerComponent` | `DrawerClass` | ❌ | 🆕 `#[define_props]` |
| `feedback/glow.rs` | `styles/components/glow.scss` ✅ | ✅ `GlowComponent` | `GlowClass` | ❌ | 🆕 `#[define_props]` |
| `feedback/modal.rs` | `styles/components/modal.scss` ✅ | ✅ `ModalComponent` | ❌ (未导入 ModalClass) | ❌ | 裸 `#[component]` |
| `feedback/popover.rs` | ❌ | ✅ `PopoverComponent` | 仅 `Display`, `Position` (无专用 PopoverClass) | ❌ | 🆕 `#[define_props]` |
| `feedback/progress.rs` | `styles/components/progress.scss` ✅ | ✅ `ProgressComponent` | `ProgressClass` | ❌ | 🆕 `#[define_props]` |
| `feedback/spin.rs` | ❌ | ✅ `SpinComponent` | `SpinClass` | ❌ | 🆕 `#[define_props]` |
| `feedback/toast.rs` | `styles/components/toast.scss` ✅ | ✅ `ToastComponent` | `ToastClass` | ❌ | 🆕 `#[define_props]` |
| `feedback/tooltip.rs` | `styles/components/tooltip.scss` ✅ | ✅ `TooltipComponent` | `TooltipClass` | ❌ | 🆕 `#[define_props]` |

### display/ — 展示组件

| 组件文件 | SCSS 文件 | StyledComponent | Palette Class Enum | i18n | Props 风格 |
|----------|-----------|:---------------:|-------------------:|:----:|:----------:|
| `display/calendar.rs` | ❌ | ✅ `CalendarComponent` | `CalendarClass` | ❌ | 🆕 `#[define_props]` |
| `display/carousel.rs` | `styles/components/carousel.scss` ✅ | ✅ `CarouselComponent` | `CarouselClass` | ❌ | 🏚️ `#[derive(Props)]` |
| `display/comment.rs` | ❌ | ✅ `CommentComponent` | `CommentClass` | ❌ | 🏚️ `#[derive(Props)]` |
| `display/drag_layer.rs` | `styles/components/drag.scss` ✅ | ✅ `DragLayerComponent` | `DragLayerClass` | ❌ | 🏚️ `#[derive(Props)]` |
| `display/empty.rs` | ❌ | ✅ `EmptyComponent` | `EmptyClass` | ❌ | 🏚️ `#[derive(Props)]` |
| `display/qrcode.rs` | ❌ | ✅ `QRCodeComponent` | `QRCodeClass` | ❌ | 🆕 `#[define_props]` |
| `display/skeleton.rs` | ❌ | ✅ `SkeletonComponent` | 仅 `Display`, `FlexDirection`, `Gap`, `Padding` (无 SkeletonClass) | ❌ | 🏚️ `#[derive(Props)]` |
| `display/tag.rs` | ❌ | ✅ `TagComponent` | `TagClass` | ❌ | 🆕 `#[define_props]` |
| `display/timeline.rs` | ❌ | ✅ `TimelineComponent` | `TimelineClass` | ❌ | 🆕 `#[define_props]` |
| `display/user_guide.rs` | ❌ | ✅ `UserGuideComponent` | `UserGuideClass` | ❌ | 🏚️ `#[derive(Props)]` |
| `display/zoom_controls.rs` | ❌ | ✅ `ZoomControlsComponent` | `ZoomControlsClass` | ❌ | 🏚️ `#[derive(Props)]` |

### data/ — 数据组件

| 组件文件 | SCSS 文件 | StyledComponent | Palette Class Enum | i18n | Props 风格 |
|----------|-----------|:---------------:|-------------------:|:----:|:----------:|
| `data/cell.rs` | ❌ | ❌ | `CellClass` | ❌ | 🏚️ `#[derive(Props)]` |
| `data/collapse.rs` | `styles/components/collapse.scss` ✅ | ✅ `CollapseComponent` | ❌ (未导入 CollapseClass) | ❌ | 🏚️ `#[derive(Props)]` |
| `data/column.rs` | ❌ | ❌ | ❌ | ❌ | 🏚️ `#[derive(Props)]` |
| `data/drag.rs` | `styles/components/drag.scss` ✅ | ✅ `DragComponent` | `TreeClass` | ❌ | 🆕 `#[define_props]` |
| `data/filter.rs` | `styles/components/filter.scss` ✅ | ✅ `FilterComponent` | `FilterClass` | ❌ | 🏚️ `#[derive(Props)]` |
| `data/node.rs` | ❌ | ❌ | `TreeNodeClass` | ❌ | 🏚️ `#[derive(Props)]` |
| `data/node_arrow.rs` | ❌ | ❌ | ❌ | ❌ | 🏚️ `#[derive(Props)]` |
| `data/node_content.rs` | ❌ | ❌ | ❌ | ❌ | 🏚️ `#[derive(Props)]` |
| `data/node_label.rs` | ❌ | ❌ | ❌ | ❌ | 🏚️ `#[derive(Props)]` |
| `data/pagination.rs` | `styles/components/pagination.scss` ✅ | ✅ `PaginationComponent` | `PaginationClass` | ❌ | 🆕 `#[define_props]` |
| `data/pagination_button.rs` | `styles/components/pagination.scss` (共用) | ✅ `PaginationButtonComponent` | `PaginationClass` | ❌ | 🏚️ `#[derive(Props)]` |
| `data/selection.rs` | `styles/components/selection.scss` ✅ | ✅ `SelectionComponent` | `SelectionClassNew` | ❌ | 🏚️ `#[derive(Props)]` |
| `data/sort.rs` | `styles/components/sort.scss` ✅ | ✅ `SortComponent` | `SortClass` | ❌ | 🏚️ `#[derive(Props)]` |
| `data/table.rs` | `styles/components/table.scss` ✅ | ✅ `TableComponent` | `TableClass` | ❌ | 🆕 `#[define_props]` |
| `data/tree.rs` | `styles/components/tree.scss` ✅ | ✅ `TreeComponent` | `TreeClass` | ❌ | 🏚️ `#[derive(Props)]` |
| `data/virtual_scroll.rs` | `styles/components/virtual-scroll.scss` ✅ | ✅ `VirtualScrollComponent` | `TreeClass` | ❌ | 🆕 `#[define_props]` |

### layout/ — 布局组件

| 组件文件 | SCSS 文件 | StyledComponent | Palette Class Enum | i18n | Props 风格 |
|----------|-----------|:---------------:|-------------------:|:----:|:----------:|
| `layout/app_layout.rs` | `styles/components/layout.scss` ✅ | ❌ | `AppLayoutClass`, `Layout` | ❌ | 裸 `#[component]` |
| `layout/aside.rs` | `styles/components/aside.scss` ✅ | ❌ | `AsideClass` (via `components::*`) | ❌ | 裸 `#[component]` |
| `layout/container.rs` | `styles/components/container.scss` ✅ | ✅ `ContainerComponent` | `ContainerClass` | ❌ | 🏚️ `#[derive(Props)]` |
| `layout/content.rs` | ❌ | ❌ | ❌ | ❌ | 裸 `#[component]` |
| `layout/divider.rs` | `styles/components/divider.scss` ✅ | ✅ `DividerComponent` | `DividerClass` | ❌ | 🏚️ `#[derive(Props)]` |
| `layout/flex.rs` | `styles/components/flex.scss` ✅ | ✅ `FlexBoxComponent` | 多个 utility (via `classes::*`) | ❌ | 🆕 `#[define_props]` |
| `layout/footer.rs` | ❌ | ✅ `FooterComponent` | `components::Footer` | ❌ | 🏚️ `#[derive(Props)]` |
| `layout/grid.rs` | `styles/components/grid.scss` ✅ | ❌ | `GridClass` (via `components::*`) | ❌ | 裸 `#[component]` |
| `layout/header.rs` | `styles/components/header.scss` ✅ | ❌ | `Header` (via `classes::*`) | ❌ | 裸 `#[component]` |
| `layout/scrollbar.rs` | `styles/components/scrollbar_container.scss` ✅ | ❌ | ❌ | ❌ | 裸 `#[component]` |
| `layout/section.rs` | `styles/components/section.scss` ✅ | ❌ | `SectionClass` | ❌ | 裸 `#[component]` |
| `layout/space.rs` | ❌ | ✅ `SpaceComponent` | `SpaceClass` | ❌ | 🏚️ `#[derive(Props)]` |

### entry/ — 输入型组件

| 组件文件 | SCSS 文件 | StyledComponent | Palette Class Enum | i18n | Props 风格 |
|----------|-----------|:---------------:|-------------------:|:----:|:----------:|
| `entry/auto_complete.rs` | ❌ | ✅ `AutoCompleteComponent` | `AutoCompleteClass` | ❌ | 🆕 `#[define_props]` |
| `entry/cascader.rs` | `styles/components/cascader.scss` ✅ | ✅ `CascaderComponent` | `CascaderClass` | ❌ | 🆕 `#[define_props]` |
| `entry/number_input.rs` | `styles/components/number_input.scss` ✅ | ✅ `NumberInputComponent` | `NumberInputClass` | ❌ | 🆕 `#[define_props]` |
| `entry/search.rs` | `styles/components/search.scss` ✅ | ✅ `SearchComponent` | `SearchClass` | ❌ | 🆕 `#[define_props]` |
| `entry/transfer.rs` | `styles/components/transfer.scss` ✅ | ✅ `TransferComponent` | `TransferClass` | ❌ | 🆕 `#[define_props]` |

### production/ — 生产级组件

| 组件文件 | SCSS 文件 | StyledComponent | Palette Class Enum | i18n | Props 风格 |
|----------|-----------|:---------------:|-------------------:|:----:|:----------:|
| `production/audio_player.rs` | ❌ | ✅ `AudioPlayerComponent` | `AudioPlayerClass` | ❌ | 🆕 `#[define_props]` |
| `production/code_highlight.rs` | `styles/components/code_block.scss` ✅ | ✅ `CodeHighlightComponent` | `CodeHighlightClass` | ❌ | 🆕 `#[define_props]` |
| `production/markdown_editor.rs` | `styles/components/markdown_renderer.scss` ✅ | ✅ `MarkdownEditorComponent` | `MarkdownEditorClass` | ❌ | 🆕 `#[define_props]` |
| `production/rich_text_editor.rs` | ❌ | ✅ `RichTextEditorComponent` | `RichTextEditorClass` | ❌ | 🆕 `#[define_props]` |
| `production/video_player.rs` | ❌ | ✅ `VideoPlayerComponent` | `VideoPlayerClass` | ❌ | 🆕 `#[define_props]` |

---

### Palette 枚举完整清单 (`packages/palette/src/classes/components/`)

#### button.rs

| 枚举名 | 变体数 | 变体 |
|--------|:------:|------|
| `ButtonClass` | 34 | Button, Primary, Secondary, Ghost, Borderless, Danger, Success, Sm, Md, Lg, Loading, Block, Spinner, Icon, SpaceBetween, WidthAuto, Width120, Width140, Width160, IconButton, IconButtonSize16/24/32/36/40, IconButtonGhost/Primary/Secondary/Danger/Success, Disabled, IconButtonIcon, IconButtonDisabled |

#### form.rs

| 枚举名 | 变体数 | 变体 |
|--------|:------:|------|
| `Input` | 2 | Input, Wrapper |
| `InputClass` | 8 | Input, InputWrapper, InputSm/Md/Lg, InputDisabled, InputPrefix, InputSuffix |
| `CheckboxClass` | 10 | Checkbox, Sm/Md/Lg, Checked, Disabled, Label, Input, Icon, Text |
| `RadioClass` | 7 | RadioGroup, RadioGroupVertical/Horizontal, Label, Indicator, Dot, Text |
| `SwitchClass` | 6 | Switch, Sm/Md/Lg, Checked, Disabled |
| `SliderClass` | 5 | Slider, Sm/Md/Lg, Disabled |
| `SelectClass` | 6 | SelectTrigger, Sm/Md/Lg, Disabled, Open |
| `DatePickerClass` | 2 | DatePickerWrapper, DatePicker |
| `FileUploadClass` | 7 | FileUploadWrapper, FileUpload, Idle, Dragging, Uploading, Success, Error |
| `FormFieldClass` | 1 | FormField |
| `AutoCompleteClass` | 7 | Wrapper, Input, Clear, Dropdown, Show, Option, OptionFocused |
| `CascaderClass` | 18 | Wrapper, Cascader, Sm/Md/Lg, Disabled, Open, Display, Text, Clear, Arrow, Dropdown, Menu, MenuList, MenuItem, MenuItemSelected/Disabled/Arrow |
| `NumberInputClass` | 3 | Wrapper, Button, Input |
| `SearchClass` | 4 | Wrapper, Input, Clear, Loading |
| `InputWrapperClass` | 9 | Wrapper, SizeSm/Md/Lg, Disabled, LeftSection, RightSection, InputSection, SideItem |
| `TransferClass` | 17 | Transfer, Operations, Operation, Panel, PanelHeader/Checkbox/Title/Count/Search/Input/List/Item/ItemSelected/ItemDisabled/Empty, ItemCheckbox, ItemLabel |

#### display.rs

| 枚举名 | 变体数 | 变体 |
|--------|:------:|------|
| `CardClass` | 12 | Card, CardHoverable, CardBordered, CardHeader/Title/Subtitle/Extra/Body/Media/Actions/ActionsNoSpacing, CardSpotlightWrapper |
| `SpotlightClass` | 4 | Spotlight, SpotlightWrapper, SpotlightAuto, SpotlightTheme |
| `GlowClass` | 15 | Glow, GlowWrapper, GlowWrapperBlock, GlowBlurNone/Light/Medium/Heavy, GlowGhost/Primary/Secondary/Danger/Success, GlowDim/Soft/Bright |
| `BadgeClass` | 8 | Badge, Dot, Primary/Secondary/Success/Warning/Danger/Info |
| `TagClass` | 8 | Tag, Default, Primary/Success/Warning/Danger/Info, Close |
| `DescriptionListClass` | 3 | List, Term, Detail |
| `EmptyClass` | 6 | Container, Image, Img, Title, Description, Action |
| `QRCodeClass` | 4 | Container, Title, Wrapper, Image |

#### feedback.rs

| 枚举名 | 变体数 | 变体 |
|--------|:------:|------|
| `ToastClass` | 17 | Toast, ToastInfo/Success/Warning/Error, ToastTopRight/Center/Left, ToastBottomRight/Center/Left, ToastIconWrapper/Icon, ToastContent/Title/Message/Close |
| `TooltipClass` | 14 | Tooltip, TooltipWrapper/Trigger/Visible, TooltipTop/Bottom/Left/Right, TooltipContent/Arrow, TooltipArrowTop/Bottom/Left/Right |
| `AlertClass` | 11 | Alert, AlertInfo/Success/Warning/Error, AlertIconWrapper/Icon, AlertContent/Title/Description/Close |
| `ModalClass` | 7 | Overlay, OverlayTransparent, Modal, Header, Title, Close, Body |
| `DropdownClass` | 3 | Overlay, OverlayDimmed, Dropdown |
| `DrawerClass` | 11 | Drawer, Mask, Right/Left/Top/Bottom, Header/Title/Close/Body/Footer |
| `PopoverClass` | 3 | Popover, Title, Content |
| `ProgressClass` | 10 | Wrapper, Progress, Linear/Circular, Normal/Active/Exception/Success/Info, Circle |
| `SkeletonClass` | 9 | Wrapper, Skeleton, Active, Text/Avatar/Image/Button/Input/Rect |
| `SpinClass` | 7 | Spin, Sm/Md/Lg, Stopped, Spinner, Tip |

#### data.rs

| 枚举名 | 变体数 | 变体 |
|--------|:------:|------|
| `TableClass` | 21 | Table, TableSm/Md/Lg, TableBordered/Striped/Hover, TableWrapper, TableHeaderCell/Cell/HeaderRow/Body/Row/Empty/EmptyContent, TableSortable/SortIcon/SortActive, TextLeft/Center/Right |
| `TableHeaderClass` | 8 | TableHeader, HeaderRow/Cell/CellActive/CellContent, SortIndicator, FilterIcon, ResizeHandle |
| `CellClass` | 6 | Cell, CellHover, CellEditable, AlignLeft/Center/Right |
| `SortClass` | 8 | Sort, SortButton/Active/Clear/Title/Indicator, SortClearText/Icon |
| `PaginationClass` | 11 | Pagination, PaginationTotal/Sizer/Pages/Prev/Next/Ellipsis/Item/Active/Jump/JumpLabel |
| `FilterClass` | 17 | Filter, FilterContainer/Trigger/Active/Icon/Badge/DropdownIcon/Dropdown/Header/Title/ClearBtn/Options/Option/Checkbox/Label/Footer/Hint |
| `SelectionClass` | 2 | Selection, RowSelection |
| `SelectionClassNew` | 13 | SelectionColumn/Fixed/Header/All/Checkbox/Row/Item, RowSelection/Label/Input/Custom/Checked/RadioDot |
| `TreeClass` | 5 | DragNode, VirtualTree, NodeDisabled, Dragging, DragOver |
| `TreeClassNew` | 2 | TreeContainer, Tree |
| `TreeLabelClass` | 1 | TreeNodeLabel |
| `DragDropTreeClass` | 1 | DragDropTree |
| `VirtualScrollClass` | 1 | VirtualTree |
| `TreeNodeClass` | 4 | TreeNode, TreeNodeSelected/Disabled/Parent |
| `CollapseClass` | 6 | CollapseContent, Expanded/Collapsed, TreeNodeChildren, TreeExpanded/Collapsed |

#### layout.rs

| 枚举名 | 变体数 | 变体 |
|--------|:------:|------|
| `Layout` | 5 | Layout, Light/Dark, HasSidebar, OverlayOpen |
| `AsideClass` | 9 | Aside, Drawer, Sm/Md/Lg, Light/Dark, Content, DrawerOpen |
| `GridClass` | 5 | Grid, GapSm/Md/Lg, Col |
| `RowClass` | 4 | Row, GapSm/Md/Lg |
| `ContainerClass` | 7 | Container, Sm/Md/Lg/Xl/Xxl, Centered |
| `Footer` | 1 | Footer |
| `AppLayoutClass` | 3 | Body, Main, Content |
| `SectionClass` | 9 | Section, SectionSm/Md/Lg, SectionHeader/Title/Description/Body, Spacer |
| `SpaceClass` | 4 | Space, Horizontal/Vertical, Wrap |
| `DividerClass` | 7 | Divider, Horizontal/Vertical, Solid/Dashed/Dotted, WithText |

#### navigation.rs

| 枚举名 | 变体数 | 变体 |
|--------|:------:|------|
| `TabsClass` | 6 | TabsTab, TabActive/Disabled, TabsTabpane, TabpaneActive/Inactive |
| `MenuClass` | 11 | Menu, Inline, Submenu, SubmenuArrowOpen/ListOpen, Vertical/Horizontal, Compact, MenuItem, SubmenuList, PopoverMenu |
| `BreadcrumbClass` | 2 | Breadcrumb, BreadcrumbItem |
| `SidebarClass` | 18 | Sidebar, Section/SectionHeader/SectionTitleGroup/SectionTitlePrimary/Secondary/SectionArrow/SectionArrowRotated/SectionChildren, Item/ItemHeader/ItemContent/ItemArrow/ItemArrowRotated/ItemChildren/ItemSecondary, Leaf/LeafContent |
| `StepperClass` | 10 | Stepper, Horizontal/Vertical, Step, StepPending/Active/Finished, StepNumber, StepConnector/ConnectorVertical |
| `AnchorClass` | 5 | Wrapper, Link, Active, Left, Right |
| `StepsClass` | 13 | Wrapper, Horizontal/Vertical, Item, Wait/Process/Finish/Error, Icon, Number, Content, Title, Description |

#### header.rs

| 枚举名 | 变体数 | 变体 |
|--------|:------:|------|
| `Header` | 7 | Header, Sticky, Md, Transparent, Left/Right, Toggle |

#### misc.rs

| 枚举名 | 变体数 | 变体 |
|--------|:------:|------|
| `ArrowClass` | 8 | Arrow, ArrowRight/Left/Up/Down, Size14/16/20 |
| `PortalClass` | 1 | PortalRoot |

#### media.rs

| 枚举名 | 变体数 | 变体 |
|--------|:------:|------|
| `CalendarClass` | 14 | Calendar, CalendarHeader/Nav/NavButton/Title/MonthTitle/Weekdays/Weekday/Grid/DayCell/Day/DaySelected/DayToday/DayDisabled |
| `TimelineClass` | 11 | Timeline, Alternate/Left/Right/NoLine, Item/Dot/Content/Time/Title/Last |
| `CodeHighlightClass` | 8 | Container, Header, Language, CopyButton, Content, LineNumbers/Number, Code |
| `VideoPlayerClass` | 2 | Container, Video |
| `AudioPlayerClass` | 19 | Container, Sm/Md/Lg, Header/Cover/CoverImage/Info/Title/Artist/Audio/Controls/PlayButton, ProgressSection/Bar/Fill, Time, VolumeSection/Button |
| `RichTextEditorClass` | 4 | Container, Toolbar, ToolbarButton, Editor |
| `UserGuideClass` | 20 | Overlay, Container, Arrow, Content, Header/Title/Counter/Description, Footer, SkipButton, Navigation/NavButton/PrimaryButton, Progress/ProgressDot/ProgressDotActive, PlacementTop/Bottom/Left/Right |
| `MarkdownEditorClass` | 13 | Container, Sm/Md/Lg, Toolbar/ToolbarButton/ToolbarButtonActive/ToolbarDivider, Content, Textarea, Preview, SplitContainer/SplitPane |
| `DragLayerClass` | 7 | Container, DropZoneOverlay/DropZone, DragPreview/DragPreviewContent/DragPreviewLabel/DragPreviewType |
| `CarouselClass` | 12 | Container, Track, Arrow, ArrowPrev/Next, Indicators, IndicatorsDots/Line/Hidden, Dot/DotActive, Pause |
| `CommentClass` | 9 | Container, Header, Avatar, Meta, Author/Datetime, Content, Actions, Nested |
| `ZoomControlsClass` | 5 | Container, Button, ButtonDisabled, Percentage, Slider |

---

### SCSS 文件完整清单 (`packages/components/src/styles/components/`)

共 **59** 个 SCSS 文件：

```
alert.scss        anchor.scss       arrow.scss        aside.scss
avatar.scss       background.scss   badge.scss        breadcrumb.scss
button-vars.scss  button.scss       card-vars.scss    card.scss
carousel.scss     cascader.scss     checkbox.scss     code_block.scss
collapse.scss     container.scss    divider.scss      drag.scss
filter.scss       flex.scss         glow.scss         grid.scss
header.scss       icon-button-vars.scss  icon.scss    icon_button.scss
image.scss        input-vars.scss   input.scss        input_wrapper.scss
layout.scss       markdown_renderer.scss  menu.scss   modal-vars.scss
modal.scss        number_input.scss pagination.scss   pagination_jump_modal.scss
progress.scss     radio.scss        scrollbar_container.scss  search.scss
section.scss      select.scss       selection.scss    sidebar.scss
slider.scss       sort.scss         stepper.scss      switch.scss
table.scss        tabs.scss         toast.scss        tooltip.scss
transfer.scss     tree.scss         virtual-scroll.scss
```

---

### 交叉引用分析

#### ❌ 有 SCSS 但组件中未导入 Palette 枚举

| SCSS 文件 | 组件 | 说明 |
|-----------|------|------|
| `avatar.scss` | `basic/avatar.rs` | 无 StyledComponent、无 Palette 导入 |
| `image.scss` | `basic/image.rs` | 无 StyledComponent、无 Palette 导入 |
| `icon.scss` | (无直接组件) | 仅 SCSS 全局图标样式 |
| `button-vars.scss` | — | 变量文件，被 `button.scss` 引用 |
| `card-vars.scss` | — | 变量文件，被 `card.scss` 引用 |
| `icon-button-vars.scss` | — | 变量文件，被 `icon_button.scss` 引用 |
| `input-vars.scss` | — | 变量文件，被 `input.scss` 引用 |
| `modal-vars.scss` | — | 变量文件，被 `modal.scss` 引用 |
| `pagination_jump_modal.scss` | — | 跳转弹窗子样式 |
| `scrollbar_container.scss` | `layout/scrollbar.rs` | 无 StyledComponent、无 Palette 导入 |

#### ❌ 有 Palette 枚举但无 SCSS 文件

| Palette 枚举 | 定义文件 | 对应组件 |
|-------------|---------|---------|
| `SkeletonClass` | `feedback.rs` | `display/skeleton.rs` — 组件仅用 utility class 未导入专用枚举 |
| `DropdownClass` | `feedback.rs` | 无对应组件 |
| `PopoverClass` | `feedback.rs` | `feedback/popover.rs` — 组件未导入此枚举 |
| `SpotlightClass` | `display.rs` | 无对应组件（Card spotlight 子功能） |
| `DescriptionListClass` | `display.rs` | 无对应组件 |
| `RowClass` | `layout.rs` | 无对应组件 |
| `TreeClassNew` | `data.rs` | 无对应组件使用 |
| `TreeLabelClass` | `data.rs` | 无对应组件使用 |
| `DragDropTreeClass` | `data.rs` | 无对应组件使用 |
| `VirtualScrollClass` | `data.rs` | `data/virtual_scroll.rs` 导入的是 `TreeClass` 非此枚举 |
| `SelectionClass` (旧) | `data.rs` | 已被 `SelectionClassNew` 替代 |
| `TableHeaderClass` | `data.rs` | 无直接导入组件 |

#### ❌ 既无 StyledComponent 也无 SCSS

| 组件 | 说明 |
|------|------|
| `data/cell.rs` | 子组件，依赖 Table 样式 |
| `data/column.rs` | 子组件，定义列配置 |
| `data/node.rs` | 子组件，TreeNode 渲染 |
| `data/node_arrow.rs` | 子组件，树节点箭头 |
| `data/node_content.rs` | 子组件，树节点内容 |
| `data/node_label.rs` | 子组件，树节点标签 |
| `layout/content.rs` | 简单布局容器，内联样式 |

#### 🔀 Palette 枚举命名与 SCSS 选择器不匹配

| 枚举 | 生成选择器前缀 | 实际 SCSS 文件/选择器 | 问题 |
|------|---------------|---------------------|------|
| `GlowClass` | `hi-glow-*` | `glow.scss` — 位于 `display.rs` palette 文件 | ⚠️ 组件在 `feedback/glow.rs` 但 palette 在 `display.rs` |
| `components::Footer` | `hi-footer` | 无专用 SCSS | ⚠️ Footer 枚举仅 1 个变体 |
| `TreeClass` | `hi-drag-node`, `hi-virtual-tree` 等 | `tree.scss` + `drag.scss` | ⚠️ `data/drag.rs` 和 `data/virtual_scroll.rs` 共用 `TreeClass` |
| `ModalClass` | `hi-modal-*` | `modal.scss` | ⚠️ `feedback/modal.rs` 未导入 `ModalClass`，硬编码类名 |

---

### Props 迁移统计

| Props 风格 | 组件数 | 占比 |
|-----------|:------:|:----:|
| 🆕 `#[define_props]` | 34 | 47% |
| 🏚️ `#[derive(Props)]` | 27 | 37% |
| 裸 `#[component]` | 10 | 14% |
| 🔀 混合 | 1 | 1% |
| **合计** | **72** | 100% |

### i18n 使用统计

| 状态 | 说明 |
|------|------|
| ❌ 零组件使用 i18n | `hikari_i18n`, `use_i18n`, `i18n_str` 均无匹配 |
