# Hikari 升级规划

## Part A — Glow 动画效果恢复（dioxus → tairitsu 迁移）

> **目标**：恢复 master 分支中 Glow Wrapper 的鼠标跟随渐变效果，完成从 dioxus 到 tairitsu 的动画系统迁移。

---

### 背景

master 分支的 Glow 组件通过 CSS `:hover` + `onmousemove` 实现了鼠标跟随的径向渐变效果：

- 鼠标进入 `.hi-glow-wrapper` 区域 → `::before` 伪元素 `opacity` 从 0 过渡到 `--glow-opacity`
- `onmousemove` → 实时更新 `--glow-x` / `--glow-y` CSS 变量 → 径向渐变跟随鼠标移动
- 离开区域 → opacity 过渡回 0

dev 分支将 `:hover` CSS 规则替换为 AnimationBuilder 命令式驱动（通过 `--glow-intensity-scale`），但 **event handler 尚为空壳**——`onmouseenter`/`onmouseleave`/`onmousedown`/`onmouseup` 仅有 `log()` 调用，未实际更新 CSS 变量。因此 **dev 分支的 glow 效果完全不可见**（`--glow-intensity-scale` 始终为 0）。

### 当前差距分析

#### hikari 侧（`packages/components/src/feedback/glow.rs`）

| 项目 | master | dev | 差距 |
|------|--------|-----|------|
| 框架依赖 | `dioxus::prelude` + `web_sys` + `wasm_bindgen` | `tairitsu_vdom` + `crate::platform::*` | ✅ 已迁移 |
| Props 宏 | `#[derive(Props)]` | `#[define_props]` | ✅ 已迁移 |
| `onmousemove` | 遍历 DOM → `StyleBuilder` 更新 `--glow-x/y` | `element_from_point` → `set_style_property` 更新 `--glow-x/y` | ✅ 已迁移 |
| hover 触发 | CSS `:hover::before { opacity }` | 需 JS 设置 `--glow-intensity-scale` | ❌ handler 为空壳 |
| `onmouseenter` | 无（CSS `:hover` 处理） | 仅 `log("mouseenter")` | ❌ 未实现 |
| `onmouseleave` | 无（CSS `:hover` 处理） | 仅 `log("mouseleave")` | ❌ 未实现 |
| `onmousedown` | 无 | 仅 `log("mousedown")` | ❌ 未实现 |
| `onmouseup` | 无 | 仅 `log("mouseup")` | ❌ 未实现 |
| 向后兼容别名 | `Glow as Acrylic` 等 | 已删除 | ⚠️ 需确认是否还需要 |

#### tairitsu 侧缺失

| 缺失项 | 影响 | 优先级 |
|--------|------|--------|
| `MouseEvent` 缺少 `offset_x/y`、`page_x/y`、`movement_x/y` | Glow 靠 `client_x/y` + `getBoundingClientRect` 变通，暂不阻塞 | P2 |
| `UseAnimation` 未连接 `request_animation_frame` | 动画 hook 只是状态容器，无法驱动帧循环 | P1 |
| `EasingFunction` 无 `evaluate(t)` 实现 | 缓动函数只是枚举，没有数学计算 | P1 |
| 无 `use_element_ref` / DOM ref 绑定 | 无法从 hook 层获取元素句柄做命令式操作 | P1 |
| Signal → 重渲染调度不存在 | `use_signal`/`use_state` 变化不触发重渲染 | P0（长期） |
| `apply_patch` 未实现 | diff 计算后无法增量更新 DOM | P0（长期） |
| 缺少 `WheelEvent`/`TouchEvent`/`PointerEvent`/`TransitionEvent`/`AnimationEvent` | 完整交互支持 | P3 |

### 实施方案

#### 方案 A — 最小化恢复（推荐先行）

**不依赖 AnimationBuilder**，在 glow.rs 的 event handler 中直接通过 `set_style_property` 操作 `--glow-intensity-scale`。这与 master 分支的 CSS `:hover` 方案等价，只是把触发点从 CSS 移到了 JS：

```
onmouseenter → set_style_property(&wrapper, "--glow-intensity-scale", "1")
onmouseleave → set_style_property(&wrapper, "--glow-intensity-scale", "0")
onmousedown  → set_style_property(&wrapper, "--glow-intensity-scale", "1") + 可选 scale 效果
onmouseup    → set_style_property(&wrapper, "--glow-intensity-scale", "0.5")（如仍 hover）
```

**前置条件**：tairitsu 的事件系统能正确派发 `mouseenter`/`mouseleave` 到 Rust handler。
**待验证**：当前 `onmouseenter` handler 中 `element_from_point(0, 0)` 逻辑有误——应使用事件的 `client_x/y` 或直接从事件获取 target 元素。

#### 方案 B — AnimationBuilder 集成（完整方案）

1. tairitsu 实现 `use_element_ref` hook → Glow 获取 wrapper 元素句柄
2. tairitsu 实现 `UseAnimation` + rAF 驱动循环
3. tairitsu 实现 `EasingFunction::evaluate(t: f64) -> f64`
4. hikari 在 Glow 中集成 `ButtonStateMachine`：
   - `mouseenter` → `StateMachine::transition(MouseEnter)` → `Hover` → `--glow-intensity-scale: 0.5`
   - `mouseleave` → `StateMachine::transition(MouseLeave)` → `Idle` → `--glow-intensity-scale: 0`
   - `mousedown` → `Active` → `--glow-intensity-scale: 1.0`
   - `mouseup` → 回到 `Hover` 或 `Idle`
5. 过渡动画通过 `EasingFunction` 在 rAF 中插值 `--glow-intensity-scale`

### 任务清单

| 优先级 | 任务 | 依赖 | 状态 |
|--------|-----|------|------|
| **P0** | 验证 tairitsu `mouseenter`/`mouseleave` 事件派发 | 无 | 待验证 |
| **P0** | 修复 `onmouseenter` handler 中 `element_from_point(0,0)` 问题 | 无 | 待修复 |
| **P0** | 方案 A：在 handler 中直接 `set_style_property` 设置 `--glow-intensity-scale` | 事件派发正常 | 待实现 |
| **P1** | 等待 tairitsu `use_element_ref` | tairitsu 侧实现 | 阻塞中 |
| **P1** | 等待 tairitsu `UseAnimation` rAF 集成 | tairitsu 侧实现 | 阻塞中 |
| **P1** | 方案 B：Glow + ButtonStateMachine + AnimationBuilder 集成 | P1 依赖 | 待实现 |
| **P2** | `MouseEvent` 补充 `offset_x/y` 字段 | tairitsu 侧实现 | 待实现 |
| **P2** | `GlowAnimation` 预设（pulse/breathe/shimmer）联调 | P1 完成 | 待实现 |
| **P3** | 向后兼容别名 `Acrylic` 系列恢复（如需要） | 无 | 待确认 |

### 验收标准

1. 鼠标进入 Glow Wrapper 区域，`::before` 伪元素 opacity 从 0 平滑过渡到可见
2. 鼠标在区域内移动，径向渐变中心跟随鼠标实时更新
3. 鼠标离开区域，glow 效果平滑淡出
4. Button/Card/Input 等使用 Glow 的组件均表现正常
5. SSR 场景不报错（`#[cfg(not(wasm32))]` 分支正常渲染无 glow 的 div）

---

---

## Part B — SSR 集成规划

> **目标**：配合 tairitsu SSR 宿主，使 hikari 设计系统文档站（`examples/website`）支持服务端渲染，实现首屏 HTML 直出。

---

## 当前状态

- 网站编译目标：`wasm32-wasip2`（由 tairitsu-packager 构建）
- 入口函数：`tairitsu_component_bootstrap()` → `WitPlatform::mount_vnode_to_app()`
- 渲染模型：**纯同步 VNode 构建**，无 hooks、无 `use_effect`、无异步数据加载
- 路由：客户端 History API + JavaScript 路由控制 `.is-active` class
- CSS：hikari-palette 的 `hi-*` 系列 class + SPA 自定义样式

✅ 当前网站代码已经是 SSR-ready 的——所有页面的 VNode 树在 `app::render()` 中一次性同步构建。

✅ E2E 测试框架已建立：

- `packages/e2e/src/tests/ssr_tests.rs`：fixture 单元测试 + WebDriver E2E 骨架
- `packages/e2e/src/ssr_helpers.rs`：`SsrTestHelper`、`SsrValidationResult` 真实实现
- `packages/e2e/src/html_assertions.rs`：`HtmlAssertions` 真实实现（基于 scraper）
- No-JS 测试使用 `reqwest` 直接 HTTP fetch，不依赖浏览器 JS 引擎

---

## 与 Tairitsu SSR 的关系

Tairitsu 侧将提供：

```rust
// tairitsu-ssr 的公开 API
pub fn render_to_html(wasm_bytes: &[u8], config: SsrConfig) -> Result<String>;
pub fn render_full_page(wasm_bytes: &[u8], config: SsrConfig, template: &str) -> Result<String>;
```

hikari 网站作为消费者，**不需要依赖 `tairitsu-ssr`**——它仅编译为 `.wasm`，由外部宿主加载执行。

---

## 阶段划分

### Phase 1 — 零改动验证（待 tairitsu-ssr 就绪）

当 tairitsu SSR 宿主实现后，hikari 网站的 `.wasm` 应当 **无需任何代码改动** 即可在服务端渲染。

验证步骤：

1. `tairitsu build` 构建 `website.wasm`
2. 在 tairitsu SSR 测试中加载该 wasm
3. 调用 `render_to_html()` 获取 HTML
4. 验证 HTML 中包含正确的 `hi-layout` / `hi-header` / `hi-aside` 结构
5. 验证所有页面内容 (`.hikari-page`) 均已渲染

**预期**：由于网站完全是同步 VNode 构建且无浏览器专有 API 调用，SSR 应当直接通过。

### Phase 2 — SSR 开发服务器集成（待 tairitsu-packager SSR 模式就绪）

1. 修改 `examples/website/` 的开发流程，支持 SSR 模式启动
2. 验证 `http://localhost:PORT/` 返回服务端渲染的完整 HTML
3. 验证客户端 JS + WASM 正常加载并接管页面交互（drawer toggle、路由切换）

### Phase 3 — Hydration 适配（待 tairitsu hydration 实现）

hikari 网站需要的工作：

#### 3.1 JavaScript 路由器兼容

当前 JS 路由在 `DOMContentLoaded` 时根据 `location.pathname` 切换 `.is-active` 类。SSR 场景下：

- **服务端**：所有 `.hikari-page` 都渲染到 HTML 中（与当前行为一致）
- **客户端**：JS 路由照常工作——根据当前 URL 隐藏/显示对应页面

无需改动，因为 SSR HTML 中所有页面已经存在，JS 只是切换可见性。

#### 3.2 事件监听器挂载

当前网站的事件处理全部在 JS 中（drawer toggle 按钮、链接拦截）。这些 JS 代码由 `Cargo.toml` 的 `[package.metadata.tairitsu.html.head]` 注入，在 SSR HTML 中同样存在，客户端加载后直接生效。

### Phase 4 — 路由级 SSR（长期）

进阶方案：服务端根据请求路径 **仅渲染对应路由的内容**，减少 HTML 体积。

**需要的改动**：

1. `app::render()` 接受 `route: Option<&str>` 参数
2. 服务端传入当前路由，仅渲染匹配的页面
3. 客户端首次加载时渲染所有页面（或按需懒加载）

这需要 tairitsu 侧提供向组件传递初始上下文的机制（如通过 WASI env 或 WIT import）。

---

## 需要关注的兼容性问题

### 1. Markdown 渲染

网站使用 `pulldown-cmark` 将文档 Markdown 转换为 HTML。这是纯 Rust 库，在 `wasm32-wasip2` 上正常工作，SSR 无特殊问题。

### 2. 图标 SVG

hikari-icons 包在编译时通过 `build.rs` 将 SVG 内联为 `inner_html`。`VNode::render_to_html()` 已支持 `inner_html` 直出，SSR 兼容。

### 3. 主题/调色板

hikari-palette 的 CSS 变量和 utility class 在 SSR HTML 中通过 `class` 和 `style` 属性输出。只要相应的 CSS 文件在 HTML `<head>` 中正确链接，视觉呈现即正确。

### 4. 国际化 (i18n)

hikari-i18n 在编译时嵌入翻译字符串，运行时通过过程宏返回。SSR 场景下：

- 默认语言的翻译直接输出到 HTML
- 如需服务端根据请求头选择语言，需 tairitsu-ssr 提供给组件初始 locale 配置

---

## E2E 测试

`packages/e2e` 中已建立完整的 SSR E2E 测试框架：

### 已完成（可运行）

1. **Fixture 单元测试**（无需 browser）：验证 `HtmlAssertions` 工具和预期 SSR 输出结构

   ```bash
   cargo test -p hikari-e2e --lib
   ```

2. **No-JS HTTP 测试**：通过 `reqwest` 直接 fetch 服务端原始 HTML 做内容验证（不经过浏览器 JS 引擎）

3. **E2E WebDriver 骨架**：HTML 结构验证、Hydration 测试、SEO 元数据测试
   - 需要运行中的 dev server + ChromeDriver

### 待联调（依赖 tairitsu-ssr 联调）

1. **HTML 结构 vs CSR 对比测试**：验证 SSR 输出与 CSR DOM 结构一致
2. **Hydration 交互测试**：SSR 页面加载后，验证 drawer toggle、路由切换正常工作

---

## 任务优先级

| 优先级 | 任务 | 状态 |
|--------|-----|------|
| P0（被动） | 等待 tairitsu-ssr 完成 | 阻塞中 |
| P0 | 零改动 SSR 验证 | 待 tairitsu-ssr 就绪后执行 |
| P1 | SSR 开发服务器集成测试 | 待 tairitsu-packager SSR 模式就绪 |
| P2 | Hydration 兼容验证 | 待 tairitsu hydration 实现 |
| P3 | 路由级 SSR | 长期 |

---

## 验收标准

1. 网站 `.wasm` 无代码改动即可通过 `tairitsu-ssr::render_to_html()` 获得 HTML
2. 输出 HTML 包含完整的页面结构（header / sidebar / 所有页面内容）
3. 输出 HTML 可在禁用 JS 的浏览器中正确显示页面内容（样式完整）
4. 开启 JS 后，客户端 WASM 加载并正常工作（路由切换、drawer toggle），无闪烁
