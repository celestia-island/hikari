# Hikari 组件库 1:1 复刻计划

> **目标**: 将 hikari-legacy 的全部组件、样式、行为完整复刻到 current (Tairitsu WASI Component 架构)
>
> **Legacy**: `/mnt/sdb1/hikari-legacy` (Dioxus + wasm-bindgen/web-sys)
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

---

## 实施进度

### Phase 1: CSS 颜色回退 ✅

- `base.scss`: 9 个颜色变量回退 (surface, border, accent, warning, info, overlay, dark mode)
- `icon.scss`: `color: inherit` → `var(--hi-color-text-primary)`
- `icon_button.scss`: 默认尺寸 40px → 28px, ghost 文字色回退
- `number_input.scss`: 恢复 174 行自包含版 (was 39 行 InputWrapper 委托)
- `palette/themes.rs`: `button_glow_color()` 恢复 `glow_contrast_dynamic_rgba()`

### Phase 2: 组件核心修复 ✅

- **QRCode**: Canvas+platform stub → inline SVG 渲染 (零平台依赖)
- **Tabs**: 恢复完整文档注释 + TabsContext + on_change 回调传播
- **NumberInput**: 恢复自包含渲染 (inline SVG +/- 按钮, 匹配 SCSS)
- **Modal**: set_timeout stub → CSS animation + animationend 事件
- **Select**: platform rect 返回 None 时 CSS `min-width: 100%` 回退
- **Popover**: platform rect 返回 None 时 viewport 居中回退
- **Tooltip**: 传递 None trigger_rect 到渲染层
- **Portal**: CSS keyframes + animationend 替代 JS timeouts

### Phase 3: Extra Components 渲染层 ✅

17 个 extra 组件全部补渲染函数:
- Collapsible, CollapsibleCard, DragLayer, DraggableCard
- Timeline, UserGuide, ZoomControls
- CodeHighlighter, RichTextEditor, VideoPlayer, AudioWaveform
- NodeGraph Canvas, Node, Connection, Port, Minimap, Viewport

- 修复 3 个 SCSS 前缀不匹配 (`.hikari-` → `.hi-`)
- 创建 4 个缺失 SCSS 文件 (user_guide, audio_waveform, video_player, rich_text_editor)

### Phase 4: Animation Package 恢复 ✅

- AnimationProvider: `provide_context`/`consume_context` 模式
- Tween hook: `UseTween` 无 Dioxus 依赖
- 10 个 transition presets 已无 `#[cfg]` 限制 (纯字符串生成)
- `hooks/animation_frame` 已被 `tairitsu_hooks::use_animation` 替代
- `hooks/animated_value` 已被 `tairitsu_hooks::use_animation` 替代
- `glow.rs` 延迟 (需 Platform trait 扩展)

### Phase 5: Website 1:1 复刻 ✅

- 恢复 5 个 SCSS 文件 (home, pages, aside_footer, showcase, code_block)
- Sidebar 升级为 3 层导航 (details/summary 折叠, 图标, 活跃状态)
- 组件概览页: 24 个组件卡片 (Layer 1/2/3)
- Video demo 页面 (VideoPlayer + AudioWaveform)
- Animation demo: 9 个交互式预设 (Glow/Neon/Tech/Transition)

### Phase 6: Scrollbar + Platform + 清理 ✅

- ScrollbarContainer: 479 行实现 (状态机, feature gate, 平台 API 集成)
- ThemeProvider: `provide_context` 实际激活
- StyleProvider: `provide_context`/`consume_context` 实际激活
- 350 个测试全部通过, 0 失败
- 剩余 4 个 TODO 均为合法外部依赖 (tairitsu_css_values, WIT matchMedia)

---

## 已知外部依赖

| 依赖 | 影响组件 | 状态 |
|------|---------|------|
| tairitsu WIT: matchMedia | prefers_reduced_motion | 等待 tairitsu |
| tairitsu WIT: ResizeObserver | ScrollbarContainer | 等待 tairitsu |
| tairitsu WIT: MutationObserver | ScrollbarContainer | 等待 tairitsu |
| tairitsu WIT: set_timeout | Modal 动画 (已用 CSS 替代) | 已解决 |
| tairitsu WIT: get_bounding_client_rect | Select/Popover/Tooltip (已用 CSS 回退) | 已解决 |
| tairitsu WIT: video/audio API | VideoPlayer/AudioWaveform | 等待 tairitsu |
| tairitsu WIT: exec_command | RichTextEditor | 等待 tairitsu |
| tairitsu-css-values crate | CSS 值类型安全 | 等待发布 |

---

## 统计

| 指标 | 值 |
|------|-----|
| 总提交数 | 7 |
| 总测试数 | 350 (全部通过) |
| 新增渲染函数 | 17 (extra-components) |
| 修复 SCSS 文件 | 3 (前缀) + 4 (新建) + 5 (website) |
| 恢复组件功能 | QRCode, Tabs, NumberInput, Modal, Select, Popover, Tooltip, ScrollbarContainer |
| 恢复 Animation 模块 | provider, hooks/tween |
| 剩余合法 TODO | 4 (外部依赖) |
