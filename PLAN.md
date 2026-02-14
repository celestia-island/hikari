# Website Demo 组件重构计划

## 问题分析

### 1. 目录结构问题
当前存在多个平级的组件目录，不符合 layer1/2/3 三层架构：
- `entry/` - 入口组件 (Cascader, Transfer, NumberInput, Search)
- `extra/` - 扩展组件 (Collapsible, Timeline, UserGuide, ZoomControls)
- `data/` - 数据组件 (Table, Tree, Pagination) - **已有完整 demo**
- `display/` - 展示组件 (Avatar, Comment, Image, QRCode, Tag, Empty, DescriptionList) - **已有完整 demo**

### 2. 页面内容问题
- `layer1/form.rs`、`layer1/switch.rs` 等页面**只是图标展示**，没有实际组件 demo
- `entry/` 和 `extra/` 下的页面有**完整的交互 demo**
- `data/` 和 `display/` 下也有**完整的 demo**，但没有被使用

### 3. 侧边栏问题
- 存在单独的 "Entry" 和 "Extra" 类别
- 应该只保留 "Layer 1/2/3" 三个类别

---

## Layer 定义

| Layer | 名称 | 特点 | 示例 |
|-------|------|------|------|
| Layer 1 | 基础组件 | 最基础的 UI 原子组件 | Button, Input, Switch, Badge |
| Layer 2 | 复合组件 | 由基础组件组合的复杂组件 | Table, Tree, Form, Modal, Menu |
| Layer 3 | 生产级组件 | 完整的生产级功能模块 | VideoPlayer, RichTextEditor, Charts |

---

## 组件归类方案

### Entry 组件归类

| 组件 | 当前位置 | 归类到 | 理由 |
|------|----------|--------|------|
| NumberInput | entry | **Layer 1 Form** | 基础表单输入组件 |
| Search | entry | **Layer 1 Form** | 基础搜索输入组件 |
| Cascader | entry | **Layer 2 Form** | 复杂的级联选择器 |
| Transfer | entry | **Layer 2 Form** | 复杂的穿梭框组件 |

### Extra 组件归类

| 组件 | 当前位置 | 归类到 | 理由 |
|------|----------|--------|------|
| Collapsible | extra | **Layer 2 Navigation** | 折叠导航面板 |
| Timeline | extra | **Layer 2 Data** | 数据时间线展示 |
| UserGuide | extra | **Layer 3** | 完整的用户引导功能模块 |
| ZoomControls | extra | **Layer 3** | 辅助功能组件 |

### Data 组件归类 (已有 demo)

| 组件 | 当前位置 | 归类到 | 说明 |
|------|----------|--------|------|
| Table | data | **Layer 2 Data** | 已有完整 demo |
| Tree | data | **Layer 2 Data** | 已有完整 demo |
| Pagination | data | **Layer 2 Data** | 已有完整 demo |

### Display 组件归类 (已有 demo)

| 组件 | 当前位置 | 归类到 | 说明 |
|------|----------|--------|------|
| Avatar | display | **Layer 1 Display** | 已有完整 demo |
| Image | display | **Layer 1 Display** | 已有完整 demo |
| Tag | display | **Layer 1 Display** | 已有完整 demo |
| Empty | display | **Layer 1 Display** | 已有完整 demo |
| QRCode | display | **Layer 1 Display** | 已有完整 demo |
| Comment | display | **Layer 1 Display** | 已有完整 demo |
| DescriptionList | display | **Layer 1 Display** | 已有完整 demo |

---

## 重构后目录结构

```
src/pages/components/
├── layer1/
│   ├── mod.rs
│   ├── basic.rs          # Button, Input, Select, Checkbox, Radio, Divider
│   ├── form.rs           # Field, Label, Validation + NumberInput, Search
│   ├── switch.rs         # Switch, Progress, Slider
│   ├── feedback.rs       # Alert, Message, Toast
│   └── display.rs        # Avatar, Image, Tag, Empty, QRCode, Comment, DescriptionList
│
├── layer2/
│   ├── mod.rs
│   ├── overview.rs
│   ├── navigation.rs     # Menu, Tabs, Breadcrumb + Collapsible
│   ├── data.rs           # Table, Tree, Pagination + Timeline
│   ├── form.rs           # Form, Dropdown, Modal, Collapse + Cascader, Transfer
│   └── feedback.rs       # Modal, Drawer, Popconfirm
│
├── layer3/
│   ├── mod.rs
│   ├── overview.rs
│   ├── media.rs          # VideoPlayer, AudioPlayer
│   ├── editor.rs         # RichTextEditor, CodeEditor
│   ├── visualization.rs  # Charts, Graphs
│   ├── user_guide.rs     # UserGuide (从 extra 移入)
│   └── zoom_controls.rs  # ZoomControls (从 extra 移入)
│
└── mod.rs
```

---

## 执行步骤

### Phase 1: 文件移动和重命名

1. **移动 entry 组件**
   - `entry/number_input_doc.rs` → `layer1/number_input.rs`
   - `entry/search_doc.rs` → `layer1/search.rs`
   - `entry/cascader_doc.rs` → `layer2/cascader.rs`
   - `entry/transfer_doc.rs` → `layer2/transfer.rs`

2. **移动 extra 组件**
   - `extra/collapsible_doc.rs` → `layer2/collapsible.rs`
   - `extra/timeline_doc.rs` → `layer2/timeline.rs`
   - `extra/user_guide_doc.rs` → `layer3/user_guide.rs`
   - `extra/zoom_controls_doc.rs` → `layer3/zoom_controls.rs`

3. **移动 data 组件**
   - `data/table.rs` → `layer2/table.rs`
   - `data/tree.rs` → `layer2/tree.rs`
   - `data/pagination.rs` → `layer2/pagination.rs`

4. **移动 display 组件**
   - `display/avatar.rs` → `layer1/avatar.rs`
   - `display/image.rs` → `layer1/image.rs`
   - `display/tag.rs` → `layer1/tag.rs`
   - `display/empty.rs` → `layer1/empty.rs`
   - `display/qrcode.rs` → `layer1/qrcode.rs`
   - `display/comment.rs` → `layer1/comment.rs`
   - `display/description_list.rs` → `layer1/description_list.rs`

5. **删除空目录**
   - 删除 `entry/`
   - 删除 `extra/`
   - 删除 `data/`
   - 删除 `display/`

### Phase 2: 更新模块导出

更新以下文件的 mod.rs：
- `layer1/mod.rs` - 添加新组件导出
- `layer2/mod.rs` - 添加新组件导出
- `layer3/mod.rs` - 添加新组件导出
- `components/mod.rs` - 移除 entry, extra 导出

### Phase 3: 更新路由

更新 `app.rs`:
- 移除 `/components/entry/*` 路由
- 移除 `/components/extra/*` 路由
- 添加新的 `/components/layer1/*` 路由
- 添加新的 `/components/layer2/*` 路由
- 添加新的 `/components/layer3/*` 路由

### Phase 4: 更新侧边栏

更新 `sidebar.rs`:
- 移除 "Entry" 类别
- 移除 "Extra" 类别
- 在 Layer 1/2/3 下添加新的组件链接

### Phase 5: 整合页面内容 (可选)

将现有的 "图标展示" 页面替换为实际 demo 页面：
- `layer1/display.rs` 应包含 Avatar, Image, Tag 等 demo
- `layer1/form.rs` 应包含 NumberInput, Search 等 demo
- `layer2/data.rs` 应包含 Table, Tree, Pagination, Timeline demo
- `layer2/form.rs` 应包含 Cascader, Transfer demo
- `layer2/navigation.rs` 应包含 Collapsible demo

---

## 确认结果 ✅

- **Search 归类**: Layer 1 Form (基础输入组件)
- **UserGuide/ZoomControls**: 独立页面，作为 Layer 3 功能模块
- **命名风格**: 去掉 Doc 后缀 (如 `Cascader` 而不是 `CascaderDoc`)
- **执行范围**: 同时整合页面内容

---

## 执行状态：✅ 已完成

---

## 文件变更清单

### 移动文件 (19)
| 源路径 | 目标路径 |
|--------|----------|
| entry/number_input_doc.rs | layer1/number_input.rs |
| entry/search_doc.rs | layer1/search.rs |
| entry/cascader_doc.rs | layer2/cascader.rs |
| entry/transfer_doc.rs | layer2/transfer.rs |
| extra/collapsible_doc.rs | layer2/collapsible.rs |
| extra/timeline_doc.rs | layer2/timeline.rs |
| extra/user_guide_doc.rs | layer3/user_guide.rs |
| extra/zoom_controls_doc.rs | layer3/zoom_controls.rs |
| data/table.rs | layer2/table.rs |
| data/tree.rs | layer2/tree.rs |
| data/pagination.rs | layer2/pagination.rs |
| display/avatar.rs | layer1/avatar.rs |
| display/image.rs | layer1/image.rs |
| display/tag.rs | layer1/tag.rs |
| display/empty.rs | layer1/empty.rs |
| display/qrcode.rs | layer1/qrcode.rs |
| display/comment.rs | layer1/comment.rs |
| display/description_list.rs | layer1/description_list.rs |

### 修改文件 (6)
- `layer1/mod.rs`
- `layer2/mod.rs`
- `layer3/mod.rs`
- `components/mod.rs`
- `app.rs`
- `sidebar.rs`

### 删除目录 (4)
- `entry/`
- `extra/`
- `data/`
- `display/`

---

## 预计影响

- **路由变更**: 所有 entry/extra 页面 URL 会变化
- **侧边栏**: 减少两个顶级类别 (Entry, Extra)
- **代码组织**: 更加清晰的三层架构

---

## 旧计划归档

> 以下为之前已完成的 ThemeProvider 三层分级设计计划，保留供参考。

<details>
<summary>点击展开旧计划</summary>

### ThemeProvider 三层分级设计 - 已完成 ✅

#### 问题
1. 单选框/复选框暗黑模式图标颜色错误
2. ThemeProvider 职责过重
3. 缺乏组件级颜色定制

#### 解决方案
实现三层分级主题系统：
- Layer 1: 基础配色 (Palette)
- Layer 2: 组件颜色 (ComponentPalette)
- Layer 3: 高级功能 (AnimationProvider, StyleProvider)

#### 完成内容
- ComponentPalette 自动从 Palette 派生
- AnimationProvider 支持动画配置
- StyleProvider 支持样式定制
- Radio/Checkbox 样式使用 Layer 2 变量
- CSS 变量别名修复
- 图标颜色继承修复

</details>
