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
| D7 | CSS 动画回退 | **不使用 CSS 回退，保留 platform API 调用** |

---

## 实施进度

### Phase 1: CSS 颜色回退 ✅

- `base.scss`: 9 个颜色变量回退
- `icon.scss`: `color: inherit` → `var(--hi-color-text-primary)`
- `icon_button.scss`: 默认尺寸回退
- `number_input.scss`: 恢复自包含版
- `palette/themes.rs`: `button_glow_color()` 恢复

### Phase 2: 组件核心修复 ✅

- **QRCode**: Canvas+platform stub → inline SVG 渲染
- **Tabs**: 恢复 TabsContext + on_change 回调
- **NumberInput**: 恢复自包含渲染
- **Modal**: requestAnimationFrame + set_timeout via platform API
- **Select**: platform rect 调用，无 CSS 回退
- **Popover**: platform rect 调用，无 CSS 回退
- **Tooltip**: platform rect 调用，无 CSS 回退
- **Portal**: inline opacity/scale style，通过 platform API 驱动

### Phase 3: Extra Components 渲染层 ✅

17 个 extra 组件全部补渲染函数 + 修复 SCSS 前缀 + 创建 4 个缺失 SCSS 文件

### Phase 4: Animation Package 恢复 ✅

- AnimationProvider + Tween hook + 10 个 transition presets
- 恢复 3 个 animation hooks: use_animated_value/use_transition, use_animation_frame, use_timeout/use_interval
- glow.rs 由 feedback/glow.rs 完全替代（407 行，含状态机）

### Phase 5: Website 1:1 复刻 ✅

- 5 个 SCSS 文件 + 3 层导航 + 24 组件卡片 + Video demo + Animation demo

### Phase 6: Scrollbar + Platform + 清理 ✅

- ScrollbarContainer: 479 行实现 (feature gate)
- ThemeProvider/StyleProvider: provide_context 实际激活
- Divider 组件: 完整实现 + 测试
- ProcessorNode/OutputNode: 真实 handle_input/get_output (Mutex)
- modal.rs: 消除 unreachable!()，使用穷举 match
- render_markdown_simple: 修复损坏的 bold/italic/code 解析
- 移除所有 CSS 动画回退 (portal keyframes, popover fade-in, center-viewport fallback)
- 移除 element_from_point always-close 回退

---

## 已知外部依赖

| 依赖 | 影响组件 | 状态 |
|------|---------|------|
| tairitsu WIT: matchMedia | prefers_reduced_motion | 等待 tairitsu |
| tairitsu WIT: ResizeObserver | ScrollbarContainer | 等待 tairitsu |
| tairitsu WIT: MutationObserver | ScrollbarContainer | 等待 tairitsu |
| tairitsu WIT: set_timeout | Modal/Portal 动画 | platform API 已就绪，stub 返回 0 |
| tairitsu WIT: get_bounding_client_rect | Select/Popover/Tooltip | platform API 已就绪，stub 返回 None |
| tairitsu WIT: request_animation_frame | Portal 动画 | platform API 已就绪，stub 为 no-op |
| tairitsu WIT: element_from_point | Dropdown/Popover 点击检测 | platform API 已就绪，stub 返回 None |
| tairitsu WIT: video/audio API | VideoPlayer/AudioWaveform | 等待 tairitsu |
| tairitsu WIT: exec_command | RichTextEditor | 等待 tairitsu |
| tairitsu-css-values crate | CSS 值类型安全 | 等待发布 |

---

## 统计

| 指标 | 值 |
|------|-----|
| 总测试数 | 359 (全部通过) |
| 总提交数 | 10 |
| 新增渲染函数 | 17 (extra-components) + 1 (Divider) |
| 恢复 animation hooks | 3 (animated_value, animation_frame, continuous) |
| 修复 SCSS 文件 | 3 (前缀) + 4 (新建) + 5 (website) |
| 剩余合法 TODO | 4 (2x tairitsu_css_values, 2x WIT matchMedia) |
