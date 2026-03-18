# Hikari -> Tairitsu 构建链迁移计划

## 已完成

- **应用层迁移完成** (commit `e226e43`):
  - `examples/website/src` 全部改写为 Tairitsu vdom/rsx 模型。
  - 移除 `#[wasm_bindgen]` 启动入口，改用 `tairitsu_component_bootstrap`。
  - 去除 Dioxus/wasm-bindgen 依赖，编译目标 `wasm32-wasip2` 通过。
  - 添加 `public/styles/hikari-spa.css` SPA 路由样式。
  - 清理全部旧 Dioxus 源文件（51 文件，删减 7149 行）。

- **构建链迁移完成** (commit `bdcb3ca`, `2d2489b`):
  - 默认开发入口迁移到 `tairitsu-packager`: `just dev`, `just watch`, `just watch-dev`, `just dev-by-agent`
  - 删除 `scripts/build/ensure_wasm_bindgen.py` 和 `scripts/fix_index_html.py`
  - 简化 `build.rs`，移除 wasm-bindgen 相关逻辑

- **核心包依赖迁移完成** (commit `0be0d2d`):
  - `packages/animation`: Dioxus/wasm-bindgen 改为可选 feature
  - `packages/components`: 添加 dioxus feature，条件化 UI 组件模块
  - `packages/extra-components`: 移除 Dioxus 依赖，组件重构为数据模型
  - `packages/i18n`: 移除 Dioxus 依赖，保留核心 i18n 功能
  - `packages/icons`: 添加 dioxus feature，条件化 Icon 组件
  - `packages/theme`: 添加 dioxus feature，保持向后兼容

- **CI 迁移完成** (commit `4564b54`):
  - 为 lint 和 test jobs 添加 wasm32-wasip2 target 支持
  - 排除服务器端包 (hikari-render-service, hikari-e2e) 从 wasm 检查

- **Tairitsu 事件类型补充** (commit `f1c04f7`):
  - 添加 `FormData`, `FormEvent`, `DragEvent`, `DataTransfer`, `MouseData` 类型
  - 修复 `#[component]` 宏的模式匹配代码生成问题
  - 在 hikari prelude 中导出所有新事件类型

- **样式系统迁移** (commit `f1c04f7`):
  - 创建本地 `style_builder.rs` 模块替代 `hikari_animation::style`
  - 实现 `StyleStringBuilder` 和 `CssProperty` 枚举
  - 所有使用 `animation::style` 的组件改用本地模块

- **Tairitsu rsx! 宏增强** (commit `6350ae3`):
  - 修复 if/match 条件解析问题 (使用 `parse_without_eager_brace`)
  - 区分 HTML 元素和自定义组件的事件处理
  - HTML 元素的 `on_*` 属性作为 DOM 事件处理器
  - 自定义组件的 `on_*` 属性作为普通 props 传递

- **Tairitsu hooks 增强** (commit `69e6222`):
  - 添加 `From<Memo<String>>` 实现 for `Style` 和 `Classes`
  - 允许 `Memo<String>` 直接用作 style/class 属性

- **样式系统整合完成** (commit `ba69e39`):
  - 创建 `examples/website/src/styles/spa.scss` 包含 SPA 路由样式
  - tairitsu-packager 支持多 SCSS 入口配置
  - 配置 `Cargo.toml` 的 `[[package.metadata.tairitsu.scss.entries]]`
  - 移除对 Python SCSS 编译脚本的依赖（bundle.css 和 spa.css 由 tairitsu-packager 生成）

- **wasm32-wasip2 条件编译修复** (commit `7eb8f32`):
  - 修复 `#[cfg(target_arch = "wasm32")]` 为 `#[cfg(all(target_arch = "wasm32", target_os = "unknown"))]`
  - 浏览器 WASM (wasm32-unknown-unknown) vs WASI (wasm32-wasip2) 正确区分
  - 修复文件: animation/*.rs, components/*.rs, theme/provider.rs, style_builder.rs
  - 添加 `StyleStringBuilder::add_custom()` 方法

- **测试兼容性修复** (commit `87e45e8`):
  - 修复 animation preset tests 的条件编译
  - 为 CarouselProps 添加 Default 实现
  - 修复 style_builder test 的参数类型
  - 为 TimelineState/UserGuideState 添加 with_class 方法
  - 修复 zoom_controls 和 minimap 测试的可变性
  - 组件集成测试标记为非 WASI 环境（需要 DOM 支持）

## 验收标准

- [x] 默认命令仅依赖 Tairitsu 链路，且 `just dev`、`just build` 在 clean 环境可运行
- [x] 删除 `scripts/build/ensure_wasm_bindgen.py` 和 `scripts/fix_index_html.py`
- [x] 核心包在 wasm32-wasip2 下编译通过
- [x] CI 支持 wasm32-wasip2 检查
- [x] **激进清理**: hikari-components 编译通过 (wasm32-wasip2)

## 架构说明

迁移完成后的架构：

1. **Tairitsu 应用层**: `examples/website` - 完全使用 Tairitsu 框架
2. **核心基础设施** (无框架依赖): `packages/palette`, `packages/builder`, `packages/i18n`
3. **UI 组件层** (条件编译): `packages/components` - 支持 Tairitsu 和独立使用
4. **服务器端专用** (不支持 wasm): `packages/render-service`, `packages/e2e`

---

## Phase 2: CSS 基础设施迁移到 tairitsu-style

### 背景

当前 hikari 中的 CSS 相关代码分散在多个包中：

| 包 | 内容 | 目标位置 |
|---|---|---|
| `hikari-animation/src/style/` | StyleStringBuilder, CssProperty | `tairitsu-style/builders/style.rs`, `tairitsu-style/properties/` |
| `hikari-palette/src/classes/` | ClassesBuilder, UtilityClass | `tairitsu-style/builders/classes.rs`, `tairitsu-style/traits/` |

### 前置条件

- [ ] tairitsu-style 包创建完成（见 tairitsu/PLAN.md）
- [ ] tairitsu-style 发布到 crates.io 或 git 依赖可用

### 迁移步骤

#### Step 1: 添加依赖

- [ ] 添加 `tairitsu-style` 依赖到：
  - `hikari-animation/Cargo.toml`
  - `hikari-palette/Cargo.toml`
  - `hikari-icons/Cargo.toml`
  - `hikari-components/Cargo.toml`

#### Step 2: 更新 imports

- [ ] 更新所有 import 语句（约 50+ 文件）：

  ```rust
  // 之前
  use hikari_animation::style::{StyleStringBuilder, CssProperty};
  use hikari_palette::{ClassesBuilder, UtilityClass};

  // 之后
  use tairitsu_style::{StyleStringBuilder, CssProperty, ClassesBuilder, UtilityClass};
  ```

#### Step 3: 删除旧代码

- [ ] 删除以下代码（迁移到 tairitsu）：
  - `packages/animation/src/style/builder.rs`
  - `packages/animation/src/style/properties.rs`
  - `packages/palette/src/classes/mod.rs` 中的 ClassesBuilder

- [ ] 或者保留 re-export 以保持向后兼容：

  ```rust
  // packages/animation/src/lib.rs
  #[deprecated(note = "Use tairitsu_style instead")]
  pub use tairitsu_style::{StyleBuilder, StyleStringBuilder, CssProperty};
  ```

#### Step 4: 清理 hikari-palette

- [ ] 保留组件特定的 class 枚举（如 `ButtonClass`, `TableClass`）
- [ ] 更新 re-exports

### 受影响的文件

需要更新 import 的文件（详见 `grep -r "StyleStringBuilder\|ClassesBuilder" packages/`）：

- `packages/components/src/data/table.rs`
- `packages/components/src/basic/button.rs`
- `packages/components/src/basic/input.rs`
- `packages/components/src/layout/flex.rs`
- ... (约 50+ 文件)

### 验收标准

- [ ] 所有 hikari 包编译通过
- [ ] 无新增编译警告
- [ ] `StyleStringBuilder` 来自 `tairitsu_style`
- [ ] `ClassesBuilder` 来自 `tairitsu_style`
- [ ] `CssProperty` 包含全部 W3C 标准属性

---

## Phase 3: Props 宏迁移（后续）

将更多组件 Props 迁移到 `#[define_props]` 宏：

| 组件 | Props | 状态 |
|---|---|---|
| icons | IconProps | ✅ 已完成 |
| data/table | TableProps | ✅ 已完成 |
| basic/avatar | AvatarProps | 待处理 |
| basic/button | ButtonProps | 待处理 |
| basic/input | InputProps | 待处理 |
| ... | ... | ... |

---

## Phase 4: 文档更新

- [ ] 更新 `docs/en-US/guides/02-classesbuilder-system.md`
- [ ] 更新 `docs/en-US/guides/03-stylestringbuilder-system.md`
- [ ] 添加迁移指南
