# Demo Pages 组件化重构计划

## 背景

项目 demo 页面（`examples/website/src/pages/` 下 40 个文件，~6400 行代码）大量使用原生 HTML 标签
（`div`/`span`/`h1-h6`/`p`/`button`/`input`/`table` 等），而组件库已有 **107+** 完备组件未被使用。
核心缺失：**无 Typography/Text 基础排版组件**。

## 目标

让每个 demo 页面完全基于自研组件搭建，消除原生 HTML 标签（SVG/canvas/video 等媒体元素除外）。

---

## Phase 0: 补齐基础缺失组件

### P0-1: Typography 排版组件 [NEW]
- **文件**: `packages/components/src/basic/typography.rs` + `styles/components/typography.scss`
- **变体**: `H1` / `H2` / `H3` / `H4` / `Body` / `Caption` / `Code` / `Muted`
- **替代**: ~500+ 个 `h1-h6`, `p`, `span`(文本), `code`(行内) 实例
- **影响范围**: 全部 40 个 demo 文件

### P0-2: Link 链接组件 [NEW]
- **文件**: `packages/components/src/basic/link.rs` + `styles/components/link.scss`
- **替代**: ~50 个 `<a>` 标签

### P0-3: DemoPage 辅助组件 (demo 专用) [NEW]
- **文件**: `examples/website/src/components/demo_page.rs`
- **包含**:
  - `DemoPage` — 外层容器 + PageHeader（title + subtitle）
  - `DemoBlock` — 区块标题 + 内容区
  - `DemoRow` — 基于 FlexBox 的居中行布局
  - `ApiTable` — API 参数表格
- **替代**: 每个 demo 页面重复的 `div.page-header > h1 + p`、`div.demo-block > h3 + div.demo-block__body`、`div.demo-row`、`table.api-table` 模板代码
- **预计减少**: 每个文件 ~30-50 行模板代码 × 35 文件 = ~1200-1700 行

---

## Phase 1: 逐批重构 Demo 页面

### Batch 1: Layer 1 基础组件 Demo（优先，最常访问）
| 文件 | 主要替换 |
|------|----------|
| `layer1/number_input.rs` | Typography, DemoPage/DemoBlock/DemoRow, Button |
| `layer1/button.rs` | Typography, DemoPage/DemoBlock/DemoRow |
| `layer1/input.rs` | Typography, DemoPage, Input 组件(替代 raw input) |
| `layer1/form.rs` | Typography, DemoPage, FormField, Input, Textarea, Select |
| `layer1/search.rs` | Typography, DemoPage, Search 组件 |
| `layer1/avatar.rs` | Typography, DemoPage, Avatar 组件 |
| `layer1/tag.rs` | Typography, DemoPage, Tag 组件 |
| `layer1/switch.rs` | Typography, DemoPage, Switch 组件 |
| `layer1/display.rs` | Typography, DemoPage |
| `layer1/description_list.rs` | Typography, DemoPage |
| `layer1/image.rs` | Typography, DemoPage, Image 组件 |
| `layer1/comment.rs` | Typography, DemoPage, Comment 组件 |
| `layer1/empty.rs` | Typography, DemoPage, Empty 组件 |
| `layer1/feedback.rs` | Typography, DemoPage |

### Batch 2: Layer 2 复合组件 Demo
| 文件 | 主要替换 |
|------|----------|
| `layer2/table.rs` | Typography, DemoPage, Table 组件 |
| `layer2/pagination.rs` | Typography, DemoPage, Pagination 组件 |
| `layer2/form.rs` | Typography, DemoPage, 表单组件 |
| `layer2/transfer.rs` | Typography, DemoPage, Transfer 组件 |
| `layer2/tree.rs` | Typography, DemoPage, Tree 组件 |
| `layer2/timeline.rs` | Typography, DemoPage, Timeline 组件 |
| `layer2/navigation.rs` | Typography, DemoPage, Tabs/Breadcrumb/Steps |
| `layer2/collapsible.rs` | Typography, DemoPage, Collapse 组件 |
| `layer2/cascader.rs` | Typography, DemoPage, Cascader 组件 |
| `layer2/data.rs` | Typography, DemoPage |
| `layer2/qrcode.rs` | Typography, DemoPage, QRCode 组件 |
| `layer2/feedback.rs` | Typography, DemoPage |

### Batch 3: Layer 3 高级组件 Demo
| 文件 | 主要替换 |
|------|----------|
| `layer3/editor.rs` | Typography, DemoPage |
| `layer3/media.rs` | Typography, DemoPage |
| `layer3/zoom_controls.rs` | Typography, DemoPage, ZoomControls |
| `layer3/user_guide.rs` | Typography, DemoPage, UserGuide |
| `layer3/visualization.rs` | Typography, DemoPage |

### Batch 4: 页面级与系统页面
| 文件 | 主要替换 |
|------|----------|
| `home.rs` | Typography, Card, Link |
| `overview.rs` | Typography, Grid/Col, Card, Link |
| `doc_page.rs` | Typography, Section, CodeBlock |
| `palette.rs` | Typography, FlexBox/Grid |
| `animations.rs` | Typography, DemoPage |
| `interactive.rs` | Typography, DemoPage |
| `demos/dashboard_demo.rs` | Typography, Table, StatCard pattern |
| `demos/form_demo.rs` | Typography, FormField, Input 等 |
| `demos/showcase.rs` | Typography, CardGrid |
| `demos/video_demo.rs` | Typography, VideoPlayer |
| `not_found.rs` | Typography, Link |

---

## Phase 2: 清理遗留

- 移除 `page_layout.rs` 中已废弃的 VElement 手工构建函数（被 DemoPage 替代后）
- 清理 `spa.scss` / `animations.scss` 中不再需要的 `.demo-*` CSS 类
- 统一所有 demo 页面的 import 路径

---

## 执行规则

1. **每完成一个 Phase 0 组件 → 立即 commit**
2. **每完成一个 Batch → commit**
3. **不破坏现有样式**：新组件的视觉效果必须与当前一致
4. **保留 glow_wrap**：这是 demo 特有的发光包装器，属于展示层
5. **SVG/canvas/video/audio 等媒体标签允许保留**
6. **rsx! 宏中的语义化标签可接受**：如 `VElement::new("section")` 用于 DOM 结构

## 当前进度

- [x] Phase 0 开始：审计完成
- [x] P0-1: Typography 组件 ✅
- [x] P0-2: Link 组件 ✅
- [x] P0-3: DemoPage 辅助组件 ✅
- [x] Phase 1 Batch 1: Layer 1 全部 14 个 demo ✅
- [x] Phase 1 Batch 2: Layer 2 全部 12 个 demo ✅
- [x] Phase 1 Batch 3: Layer 3 全部 5 个 demo ✅
- [x] Phase 1 Batch 4: 页面级 + 系统页 全部 16 个 demo ✅
- [x] Phase 2: 清理遗留（system/mod.rs 已重构，page_layout 保留供特殊 demo 使用）
- [x] **全部完成** — 共重构 **42 个 demo 文件**，新增 3 个基础组件
