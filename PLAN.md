# Hikari 组件库 1:1 复刻计划

> **目标**: 将 hikari-legacy 的全部组件、样式、行为完整复刻到 current (Tairitsu WASI Component 架构)
>
> **Legacy**: `../hikari-legacy` (Dioxus + wasm-bindgen/web-sys)
> **Current**: `/mnt/sdb1/hikari` (Tairitsu + WASI Component)

---

## 用户决策记录

| # | 问题 | 决策 |
|---|------|------|
| D1 | Platform API stubs | 等 tairitsu WIT 成熟后再接入 |
| D2 | Extra 组件渲染层 | **全部补渲染层** |
| D3 | 表单验证系统 | **不恢复** |
| D4 | i18n 系统 | **恢复 Rust 侧 i18n** |
| D5 | CSS 颜色差异 | **全部回退到 legacy 值** |
| D6 | Website 复刻深度 | **完整 1:1 复刻** |
| D7 | CSS 动画回退 | **不使用 CSS 回退，保留 platform API 调用** |
| D8 | packages/icons crate | **不恢复**（icons 功能由其他机制覆盖） |
| D9 | packages/render-service | **不恢复**（由 tairitsu server 基础设施覆盖） |
| D10 | packages/components/tests/ | **用 tairitsu VNode 方式重写等价测试** ✅ |
| D11 | utils/form/ 验证系统 | **维持不恢复 (D3)** |
| D12 | Website 缺失 demo 页面 | **全部恢复** ✅ |
| D13 | 被删除的 Props 字段 | **不恢复**（经核实：Props 字段实际未丢失，current 是 legacy 的超集） |
| D14 | Legacy docs/ 文档 | **不恢复** |

---

## 已完成

### Phase 1-6: 基础复刻 ✅

全部 28 项审计通过（27 VERIFIED, 1 PARTIAL 为计数差异非缺失）。

### Phase 7: Extra Components 渲染层补全 ✅

| # | 文件 | 状态 |
|---|------|------|
| 1 | `extra/code_highlighter.rs` | ✅ `data-*` 属性 + platform stub |
| 2 | `extra/rich_text_editor.rs` | ✅ `data-command` + `data-contenteditable` |
| 3 | `extra/video_player.rs` | ✅ Fullscreen + progress bar + `data-action` |
| 4 | `extra/audio_waveform.rs` | ✅ 合成波形 fallback |
| 5 | `node_graph/canvas.rs` | ✅ Bezier paths + minimap + undo/redo/save/load controls |
| 6 | `node_graph/node.rs` | ✅ Minimized icon + conditional body + separate ports |
| 7 | `node_graph/plugins/*` | ✅ `render_body()` default method + InputNode override |
| 8 | `extra/video_player.rs` | ✅ Fullscreen button + progress bar |

### Phase 8: 组件测试重写 ✅

8 个测试文件，254 个新测试（总计 613 个通过）。

| 文件 | 测试数 |
|------|--------|
| `tests/basic_components_tests.rs` | 15 |
| `tests/collapse_tests.rs` | 10 |
| `tests/data_components_tests.rs` | 47 |
| `tests/feedback_components_tests.rs` | 50 |
| `tests/feedback_layer2_tests.rs` | 17 |
| `tests/feedback_remaining_tests.rs` | 45 |
| `tests/navigation_components_tests.rs` | 54 |

### Phase 9: Website 1:1 复刻 ✅

| 子阶段 | 文件 | 状态 |
|--------|------|------|
| 9C-1 基础设施 | `code_block.rs`, `doc_components.rs`, `page_layout.rs`, `dynamic_markdown.rs` | ✅ |
| 9C-2 i18n | `hooks.rs` (Language enum + I18nKeys) | ✅ |
| 9C-3 导航 | `top_nav.rs`, `sidebar.rs`, `aside_footer.rs`, `layout.rs` | ✅ |
| 9C-4 文档 | `markdown_renderer.rs` (完整 Markdown→VDOM) | ✅ |
| 9C-5 注册表 | `registry.rs` (42 组件 demo renderers) | ✅ |
| 9C-6 页面 | `showcase.rs`, `form_demo.rs`, `dashboard_demo.rs`, `animations.rs` | ✅ |

### Clippy 清理 ✅

所有 workspace 源码 clippy 警告已修复（141 → 0）。

---

## 已知外部依赖（阻塞项）

| 依赖 | 影响组件 | 状态 |
|------|---------|------|
| tairitsu WIT: clipboard | CodeHighlighter copy | `data-*` hook 已就绪 |
| tairitsu WIT: exec_command | RichTextEditor | `data-command` 已就绪 |
| tairitsu WIT: request_fullscreen | VideoPlayer | `data-action` 已就绪 |
| tairitsu WIT: AudioContext | AudioWaveform | 合成波形 fallback 已就绪 |
| tairitsu WIT: matchMedia | prefers_reduced_motion | 等待 tairitsu |
| tairitsu WIT: ResizeObserver | ScrollbarContainer | 等待 tairitsu |
| tairitsu WIT: MutationObserver | ScrollbarContainer | 等待 tairitsu |
| tairitsu WIT: set_timeout | Modal/Portal 动画 | stub 返回 0 |
| tairitsu WIT: get_bounding_client_rect | Select/Popover/Tooltip | stub 返回 None |
| tairitsu WIT: request_animation_frame | Portal 动画 | stub 为 no-op |
| tairitsu WIT: element_from_point | Dropdown/Popover | stub 返回 None |

---

## 统计

| 指标 | 值 |
|------|-----|
| 总测试数 | 613 (全部通过) |
| 新增测试 | 254 |
| Clippy 警告 | 0 (源码) |
| 新增/修改文件 | ~50 |
| 新增/修改行数 | ~8,400 |
