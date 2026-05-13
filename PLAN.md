# Hikari 改进计划

> 基于 celestia/PLAN.md 基础设施综述 + rivagan 实际开发反馈
> 最后更新: 2026-05-14

---

## 已完成

### ✅ S1: Secondary 色彩命名规范修复 (2026-05-14)

修正 SCSS 中 `--hi-color-secondary`（强调色）与 `--hi-color-surface-secondary`（面板背景色）的命名混淆：

| 文件 | 改动 |
|------|------|
| `components/styles/index.scss` | `.hi-bg-secondary` 改用 `--hi-color-secondary`；新增 `.hi-bg-surface-secondary` |
| `theme/styles/foundation.scss` | `--hi-bg-solid-secondary` 改指向 `--hi-color-secondary`（实色） |
| `components/styles/drawer.scss` | 滚动条 hover 背景从 `--hi-text-secondary` 改为 `--hi-color-border` |

色彩语义规范化：
```
Primary   → CTA 按钮、链接、活跃状态
Secondary → 徽章、次要操作按钮、hover 强调（不再用于面板背景）
Surface   → 面板背景、卡片、表格行 hover（通过 .hi-bg-surface-secondary）
Neutral   → 边框、分隔线、滚动条
```

编译 + 600+ 测试通过。

### ✅ H-1: Demo/Library 视觉输出统一 (2026-05-14)

**Library 侧**：
- `packages/components/src/feedback/glow.rs` — GlowProps 新增 `radius` prop（默认 `inherit`）
- `packages/components/src/styles/components/glow.scss` — wrapper/block 添加 `border-radius: var(--hi-glow-radius, inherit)`

**Website 侧**：
- `examples/website/src/components/glow.rs` — 重写为库组件的薄封装：
  - 移除本地 `GlowIntensity`/`GlowColor` 枚举，改为 `pub use hikari_components::feedback::glow::{GlowBlur, GlowColor, GlowIntensity}`
  - 新增 `blur: GlowBlur` 字段到 GlowConfig
  - 增加 `--hi-glow-opacity` 和 `--hi-glow-intensity-scale` CSS 变量（与库 Glow 组件一致）
  - 保留命令式事件处理（因为网站不用 rsx!，无法调用 `#[component]`）

---

## 待办（按优先级）

### P0 — 阻塞性

#### H-2: Light Theme 组件样式完整性审计

当前状态：`data-theme="hikari"` 为 light theme，CSS 变量覆盖体系完善。
但需要逐一验证所有 40+ 组件在 light 背景下的可见性和美观度。

审计清单：
- [ ] Button (Primary/Secondary/Ghost/Danger/Success)
- [ ] Input / Textarea / Select
- [ ] Table / Tree
- [ ] Menu / Tabs / Breadcrumb
- [ ] Modal / Drawer / Popover / Tooltip
- [ ] Alert / Toast / Progress / Spin
- [ ] Card / Badge / Tag
- [ ] Layout (Header/Aside/Content/Footer)

### P1 — 高优先级

#### H-4: 修正 README 示例代码
- `ThemeProvider { palette: "arknights" }` → 实际 `initial_palette: "tairitsu"`
- `<Button variant={Primary}>` → 实际 rsx! 语法不同
- 添加 light/dark 主题切换示例

#### H-5: 动画预设从 Demo CSS 迁入 Library
Demo 的 `styles/animations.scss` 有 20+ 动画预设（HoverGlow, NeonFlicker 等）困在 demo CSS 中。
应迁入 `hikari-animation` 或 `hikari-components::styles`。

### P2 — 中优先级

#### H-6: Builder Pattern API
Demo 的 `ui.rs` 使用 `.text().glow().build()` 风格，库仅提供 rsx! / 函数调用。
建议并行提供：
```rust
Button::builder()
    .variant(Primary)
    .label("Click")
    .glow(GlowConfig::soft(teal))
    .on_click(|_| { ... })
    .build();
```

#### H-7: 更多内置主题
README 提到 arknights/fresh 但未实现。至少提供 3-4 套预设。

### P3 — 低优先级

- 文档站点（用 hikari 自身构建）
- E2E 视觉回归测试覆盖所有组件
- a11y 辅助属性快捷方式
- Router 集成

---

## 架构决策记录

### AD-1: 色彩变量命名规范
- **决策**: `--hi-color-secondary` = 强调色（accent），`--hi-color-surface-secondary` = 面板背景
- **原则**: 强调色永远不用于大面积背景，surface 色永远不用于交互元素
- **新增工具类**: `.hi-bg-surface-secondary` 明确语义

### AD-2: 工具类命名映射
```
.hi-bg-primary   → --hi-color-primary (accent)
.hi-bg-secondary → --hi-color-secondary (accent)  ← 已修复
.hi-bg-surface-secondary → --hi-color-surface-secondary (surface)  ← 新增
.hi-bg-accent    → --hi-color-accent
.hi-bg-surface   → --hi-color-surface
.hi-bg-white     → --hi-color-surface
.hi-bg-black     → --hi-color-background
```
