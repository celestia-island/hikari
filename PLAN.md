# Website Demo 组件重构计划

## 执行状态：✅ 全部完成

---

## 完成总结

### 1. 目录重构 ✅
- 删除 `entry/`、`extra/`、`data/`、`display/` 目录
- 所有组件整合到 `layer1/`、`layer2/`、`layer3/`

### 2. 组件归类 ✅

| Layer | 组件 |
|-------|------|
| Layer 1 | Avatar, Image, Tag, Empty, Comment, DescriptionList, NumberInput, Search |
| Layer 2 | Cascader, Transfer, Collapsible, Timeline, Table, Tree, Pagination, QRCode |
| Layer 3 | UserGuide, ZoomControls |

### 3. QRCode 改进 ✅
- 使用 Canvas 绘制替代外部 API
- 添加 `qrcode` crate 依赖
- 移动到 Layer 2

### 4. Canvas 组件 ✅
- 新增 Layer 1 基础 Canvas 组件
- 支持 requestAnimationFrame 集成

### 5. 侧边栏滚动位置保持 ✅
- 使用 `GlobalSignal` 存储滚动位置
- 导航前保存，路由切换后恢复

### 6. Layer 1 Basic 页面拆分 ✅
- 删除 `basic.rs` 和 `basic_components.rs`
- 创建独立 `button.rs` 页面
- `form.rs` 整合 Input, Select, Checkbox, Radio 演示
- `display.rs` 整合 Card, Badge, Divider 演示

---

## 最终目录结构

```
src/pages/components/
├── layer1/
│   ├── mod.rs
│   ├── basic.rs
│   ├── form.rs
│   ├── switch.rs
│   ├── feedback.rs
│   ├── display.rs
│   ├── avatar.rs
│   ├── image.rs
│   ├── tag.rs
│   ├── empty.rs
│   ├── comment.rs
│   ├── description_list.rs
│   ├── number_input.rs
│   └── search.rs
│
├── layer2/
│   ├── mod.rs
│   ├── overview.rs
│   ├── navigation.rs
│   ├── data.rs
│   ├── form.rs
│   ├── feedback.rs
│   ├── cascader.rs
│   ├── transfer.rs
│   ├── collapsible.rs
│   ├── timeline.rs
│   ├── table.rs
│   ├── tree.rs
│   ├── pagination.rs
│   └── qrcode.rs
│
├── layer3/
│   ├── mod.rs
│   ├── overview.rs
│   ├── media.rs
│   ├── editor.rs
│   ├── visualization.rs
│   ├── user_guide.rs
│   └── zoom_controls.rs
│
└── mod.rs
```

---

## 提交记录

| 提交 | 描述 |
|------|------|
| `61f1b10` | feat(website): preserve sidebar scroll position across route navigations |
| `65592f7` | docs: update PLAN.md with completed status summary |
| `6258332` | feat(components): add Canvas component and rewrite QRCode with canvas rendering |
| `c2e98e8` | refactor(website): consolidate demo components into layer1/2/3 structure |

---

---

## Sidebar 国际化重构计划

### 执行状态：✅ 全部完成

---

### 完成总结

1. **扩展 i18n keys 结构** ✅
   - `packages/i18n/src/keys.rs` 添加 `SidebarKeys`、`SidebarCategoryKeys`、`SidebarItemKeys`

2. **更新翻译文件** ✅
   - 三个语言版本均添加了完整的 sidebar 翻译
   - 包含所有分类标题和 **31 个组件名称** 的翻译

3. **重构 sidebar.rs** ✅
   - 移除 `title_en`/`title_zh`/`label_en`/`label_zh` 字段
   - 改用 `label_key` + `use_i18n()` 动态获取翻译
   - 添加 `get_category_title()`、`get_subcategory_label()`、`get_item_label()` 函数

4. **添加全局 I18nProvider** ✅
   - 创建 `src/hooks.rs` 提供 `use_i18n()` 和 `I18nProviderWrapper`
   - `src/app.rs` 包裹 `I18nProviderWrapper`

### 翻译覆盖

| 分类 | 英文 | 简体中文 | 繁體中文 |
|------|------|----------|----------|
| Overview | Overview/Home | 概览/首页 | 概覽/首頁 |
| Components | Components/Layer 1-3 | 组件/基础组件/复合组件/生产级组件 | 元件/基礎元件/複合元件/生產級元件 |
| System | System/Overview/CSS Utilities/Icons/Palette/Animations | 系统/概览/CSS 工具/图标/调色板/动画 | 系統/概覽/CSS 工具/圖標/調色盤/動畫 |
| Demos | Demos/All Demos | 演示/全部演示 | 演示/全部演示 |
| Items (31个) | Button, Form, Table, ... | 按钮, 表单, 表格, ... | 按鈕, 表單, 表格, ... |

---

## 旧计划归档

<details>
<summary>ThemeProvider 三层分级设计 - 已完成 ✅</summary>

实现三层分级主题系统：
- Layer 1: 基础配色 (Palette)
- Layer 2: 组件颜色 (ComponentPalette)
- Layer 3: 高级功能 (AnimationProvider, StyleProvider)

</details>
