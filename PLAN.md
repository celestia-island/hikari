# Hikari SSR 集成规划

> **目标**：配合 tairitsu SSR 宿主，使 hikari 设计系统文档站（`examples/website`）支持服务端渲染，实现首屏 HTML 直出。

---

## 当前状态

- 网站编译目标：`wasm32-wasip2`（由 tairitsu-packager 构建）
- 入口函数：`tairitsu_component_bootstrap()` → `WitPlatform::mount_vnode_to_app()`
- 渲染模型：**纯同步 VNode 构建**，无 hooks、无 `use_effect`、无异步数据加载
- 路由：客户端 History API + JavaScript 路由控制 `.is-active` class
- CSS：hikari-palette 的 `hi-*` 系列 class + SPA 自定义样式

✅ 当前网站代码已经是 SSR-ready 的——所有页面的 VNode 树在 `app::render()` 中一次性同步构建。

用户补充：tairitsu 那儿刚完工，需要你开始联调

---

## 与 Tairitsu SSR 的关系

Tairitsu 侧将新建 `packages/ssr` crate（详见 `/mnt/sdb1/tairitsu/PLAN.md`），提供：

```rust
// tairitsu-ssr 的公开 API
pub fn render_to_html(wasm_bytes: &[u8], config: SsrConfig) -> Result<String>;
pub fn render_full_page(wasm_bytes: &[u8], config: SsrConfig, template: &str) -> Result<String>;
```

hikari 网站作为消费者，**不需要依赖 `tairitsu-ssr`**——它仅编译为 `.wasm`，由外部宿主加载执行。

---

## 阶段划分

### Phase 1 — 零改动验证

当 tairitsu SSR 宿主实现后，hikari 网站的 `.wasm` 应当 **无需任何代码改动** 即可在服务端渲染。

验证步骤：

1. `tairitsu build` 构建 `website.wasm`
2. 在 tairitsu SSR 测试中加载该 wasm
3. 调用 `render_to_html()` 获取 HTML
4. 验证 HTML 中包含正确的 `hi-layout` / `hi-header` / `hi-aside` 结构
5. 验证所有页面内容 (`.hikari-page`) 均已渲染

**预期**：由于网站完全是同步 VNode 构建且无浏览器专有 API 调用，SSR 应当直接通过。

### Phase 2 — SSR 开发服务器集成

在 tairitsu-packager 支持 `tairitsu dev --ssr` 后：

1. 修改 `examples/website/` 的开发流程，支持 SSR 模式启动
2. 验证 `http://localhost:PORT/` 返回服务端渲染的完整 HTML
3. 验证客户端 JS + WASM 正常加载并接管页面交互（drawer toggle、路由切换）

### Phase 3 — Hydration 适配

当 tairitsu 实现客户端 hydration 后，hikari 网站需要：

#### 3.1 JavaScript 路由器兼容

当前 JS 路由在 `DOMContentLoaded` 时根据 `location.pathname` 切换 `.is-active` 类。SSR 场景下：

- **服务端**：所有 `.hikari-page` 都渲染到 HTML 中（与当前行为一致）
- **客户端**：JS 路由照常工作——根据当前 URL 隐藏/显示对应页面

无需改动，因为 SSR HTML 中所有页面已经存在，JS 只是切换可见性。

#### 3.2 事件监听器挂载

当前网站的事件处理全部在 JS 中（drawer toggle 按钮、链接拦截）。这些 JS 代码由 `Cargo.toml` 的 `[package.metadata.tairitsu.html.head]` 注入，在 SSR HTML 中同样存在，客户端加载后直接生效。

**如果未来组件使用 tairitsu 事件系统（Rust 侧 `add_event_listener`）**：

- SSR 时事件注册为 no-op（由 tairitsu-ssr 处理）
- Hydration 时 tairitsu-web 需要复用已有 DOM 节点并重新挂载事件
- hikari 组件代码 **无需** 区分 SSR / CSR，框架层透明处理

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

## E2E 测试扩展

`packages/e2e` 中已有基于 Selenium 的视觉回归测试。增加 SSR 场景测试：

1. **HTML 结构测试**：验证 SSR 输出的 HTML 与 CSR 的 DOM 结构一致
2. **无 JS 测试**：禁用 JavaScript 后访问页面，验证内容可见（SSR 的核心价值）
3. **Hydration 测试**：SSR 页面加载后，验证交互功能（drawer toggle、路由切换）正常工作

---

## 任务优先级

| 优先级 | 任务 | 状态 |
|--------|-----|------|
| P0（被动） | 等待 tairitsu-ssr Phase 3 完成 | 阻塞中 |
| P0 | 零改动 SSR 验证 | 待 tairitsu-ssr 就绪后执行 |
| P1 | SSR 开发服务器集成测试 | 待 tairitsu-packager SSR 模式就绪 |
| P2 | Hydration 兼容验证 | 待 tairitsu hydration 实现 |
| P2 | E2E SSR 测试用例 | 可提前编写骨架 |
| P3 | 路由级 SSR | 长期 |

---

## 验收标准

1. 网站 `.wasm` 无代码改动即可通过 `tairitsu-ssr::render_to_html()` 获得 HTML
2. 输出 HTML 包含完整的页面结构（header / sidebar / 所有页面内容）
3. 输出 HTML 可在禁用 JS 的浏览器中正确显示页面内容（样式完整）
4. 开启 JS 后，客户端 WASM 加载并正常工作（路由切换、drawer toggle），无闪烁
