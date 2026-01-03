# Hikari 项目文档 (Claude 指南)

> Hikari - 基于 Dioxus + Grass + Axum 的 Rust UI 框架
>
> **设计风格**: Arknights 平面设计 + FUI 科幻感 + 中国传统色
>
> **名称来源**: "Hikari" (光) 来自音乐游戏 Arcaea

---

## 项目概述

Hikari 是一个现代化的 Rust UI 框架，采用模块化设计，结合了中国传统色彩美学和科幻界面设计。项目名称"Hikari"（光）取自音乐游戏 Arcaea。

### 技术栈

```
Frontend (WASM):  Dioxus 0.7
Styling:         Grass (SCSS 编译器)
Build System:    Justfile
Palette:         中国传统色 (500+ 色)
Server (SSR):    Axum (可选)
Tooling:         Python 3.11+ 用于预构建脚本
```

---

## 项目结构

```
hikari/
 ├── packages/
 │   ├── hikari-palette/          ✅ 中国传统色调色板工具库
 │   ├── hikari-theme/            ✅ 主题系统（Arknights FUI 风格）
 │   ├── hikari-core/             🚧 核心基础设施（types, utils, hooks）
 │   ├── hikari-icons/             📋 图标系统
 │   ├── hikari-components/        🚧 基础组件库（类似 Element-UI）
 │   ├── hikari-extra-components/  📋 高级组件库（节点图、画板等）
 │   ├── hikari-ssr/               📋 SSR 支持（Axum 插件）
 │   └── hikari-dev-tools/         📋 开发工具（内部包）
 │
 └── examples/                       # 样板房（相互独立）
     ├── demo-app/
     ├── table-demo/
     ├── tree-demo/
     ├── node-graph-demo/
     └── ssr-demo/
```

---

## 命名规范

### 子包命名
- 所有子包使用 `hikari-*` 前缀
- 避免使用 `hikari`（已被占用）
- 内部包使用 `_hikari-*` 下划线前缀

### 代码风格
- **常量名**: 中文（如 `朱砂`、`石青`）用于调色板
- **其他**: 英文命名，遵循 Rust 约定
- **组件名**: PascalCase（如 `Button`, `DataTable`）
- **函数名**: snake_case（如 `get_color`, `render_cell`）

---

## Git 提交规范

**重要**：每次迭代完成后必须进行一次 git 提交，严格遵守以下规范：

- **格式**: `emoji 一句话英语描述`
- **示例**:
  - `🏗️ Initialize workspace structure`
  - `🎨 Add hikari-palette with Chinese colors`
  - `📦 Add justfile build system`
  - `🔧 Configure Python tooling scripts`
- **注意**:
  - 使用单个 emoji
  - 只有一句话的英语描述（不使用中文）
  - **不要 push 到云端**（除非明确要求）

---

## 开发指南

### 添加新组件

1. 在对应的包中创建模块文件
2. 在 `src/lib.rs` 中导出公共 API
3. 编写单元测试
4. 更新文档

### 组件模块化策略

#### 表格组件（8 个模块）
```
table/
 ├── table.rs         # 核心逻辑
 ├── column.rs        # 列定义
 ├── cell.rs          # 单元格渲染
 ├── header.rs        # 表头
 ├── pagination.rs    # 分页
 ├── sort.rs          # 排序
 ├── filter.rs        # 筛选
 └── selection.rs     # 选择
```

#### 树形控件（5 个模块）
```
tree/
 ├── tree.rs          # 核心逻辑
 ├── node.rs          # 节点定义
 ├── virtual.rs       # 虚拟滚动
 ├── collapse.rs      # 折叠/展开
 └── drag.rs          # 拖拽
```

### 样式系统

使用 Grass 编译 SCSS，所有样式文件位于 `packages/hikari-theme/styles/`：

- `variables.scss` - CSS 变量
- `mixins.scss` - Mixins
- `base.scss` - 基础样式
- `themes.scss` - 主题定义

### 调色板使用

```rust
use hikari_palette::{ChineseColor, opacity};

let color = ChineseColor::朱砂;
let transparent = opacity(color, 0.5);
```

---

## 设计风格

### Arknights 平面设计
- 干净的线条、清晰的信息层级
- 高对比度，避免模糊
- 简约而不失精致

### FUI 科幻感
- 微妙的发光效果（`box-shadow`, `text-shadow`）
- 动态指示（呼吸灯、脉冲动画）
- 精细的边框（1px 半透明）
- 几何图案（六边形、网格）

### 中国传统色应用
- **主色**: 石青（蓝）、朱砂（红）、藤黄（黄）、靛蓝（深蓝）
- **中性色**: 月白（淡白）、墨色（深黑）、缟色（浅灰）
- **功能色**: 葱倩（成功）、鹅黄（警告）、朱砂（危险）

---

## 构建和测试

### 使用 Justfile

```bash
just build           # 构建所有包
just test            # 运行所有测试
just fmt             # 格式化代码
just clippy          # 运行 Clippy
just generate-all    # 生成所有静态资源（Tailwind CSS + Lucide Icons）
just build-generated # 生成静态资源后构建
```

### Python 预构建脚本

项目使用 Python 脚本在预构建阶段从 CDN 或 GitHub API 下载外部资源：

```bash
python scripts/generate_palette.py     # 生成中国传统色调色板
python scripts/fetch_tailwindcss.py     # 下载并生成 Tailwind CSS
python scripts/fetch_lucide_icons.py   # 下载并生成 Lucide Icons
```

生成的文件位于：
- `packages/theme/src/generated/` - Tailwind CSS 和主题资源
- `packages/icons/src/generated/` - Lucide Icons 枚举和 SVG 内容
- `packages/palette/src/colors.rs` - 中国传统色定义

---

## 当前状态

- ✅ Phase 1-3: hikari-palette, hikari-theme (已完成)
- 🚧 Phase 4: hikari-components (进行中)
  - 基础组件: Button, Input, Card, Badge
  - 反馈组件: Alert, Toast, Tooltip
  - 导航组件: Menu, Tabs, Breadcrumb
  - 表格组件（模块化）
  - 树形控件（模块化）

---

## 参考项目

- **tairitsu**: 架构模式、justfile、Python 工具脚本
- **akasha**: 节点图系统、贝塞尔曲线连接、小地图
- **hydro.sinap.ac.cn**: Dioxus + Grass + SCSS 编译
- **quotation-sheet-generator**: Dioxus + Axum 架构

---

## 核心理念

**简约、科技、文化自信**

- 简约: 清晰的代码结构，直观的 API
- 科技: 现代化的技术栈，优秀的性能
- 文化自信: 中国传统色彩与现代设计的完美融合
