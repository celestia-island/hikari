# Hikari 组件库迁移计划

> Legacy (Dioxus) → Current (Tairitsu) 实际效果差距分析与修复方案
>
> 创建时间: 2026-03-26
> 更新时间: 2026-03-26 (v4 - 完整组件清单)
>
> Legacy 版本位置: `/mnt/sdb1/hikari-legacy` (master 分支)
> 当前版本位置: `/mnt/sdb1/hikari` (dev 分支)

---

## 核心问题

虽然当前版本的底层设施（Glow 状态机、动画预设、三层 CSS 变量）比 Legacy 更强大，但**业务组件没有正确使用这些设施**，导致实际视觉效果反而不如 Legacy 版本。

---

## 一、详细问题分析

### 1.1 Glow 组件 - 架构差异

| 方面 | Legacy (Dioxus) | Current (Tairitsu) | 问题 |
|------|-----------------|-------------------|------|
| 显示控制 | CSS hover 伪类 | JS 状态机 | **完全依赖 JS** |
| 初始强度 | 无设置（默认可见） | `--glow-intensity-scale: 0` | **初始隐藏** |
| 事件类型 | `Event<MouseData>` | `MouseEvent` | **类型不匹配** |
| 降级方案 | CSS hover | 无 | **无 fallback** |

### 1.2 根本原因

1. **过度依赖状态机**: Glow 组件初始设置为隐藏 (`--glow-intensity-scale: 0`)，完全依赖 JS 状态机触发
2. **移除 CSS fallback**: Legacy 版本的 CSS hover 被移除
3. **事件类型变更**: Tairitsu 的 `MouseEvent` 与 Dioxus 的 `Event<MouseData>` 不兼容

---

## 二、完整组件清单

### 2.1 使用 Glow 包装器的组件 (7个)

这些组件**完全依赖** Glow 组件的状态机，如果状态机不工作，hover 效果完全不显示：

| 组件 | 文件 | 优先级 | 预计时间 |
|------|------|--------|----------|
| Button | `basic/button.rs` | P0 | 0.5天 |
| IconButton | `basic/icon_button.rs` | P0 | 0.5天 |
| Input | `basic/input.rs` | P0 | 0.5天 |
| InputWrapper | `basic/input_wrapper.rs` | P0 | 0.5天 |
| Select | `basic/select.rs` | P1 | 0.5天 |
| Alert | `feedback/alert.rs` | P1 | 0.5天 |
| Toast | `feedback/toast.rs` | P1 | 0.5天 |

### 2.2 使用内联 Glow 的组件 (1个)

这些组件有自己的 glow overlay，需要内联鼠标跟踪：

| 组件 | 文件 | 问题 | 优先级 | 预计时间 |
|------|------|------|--------|----------|
| Card | `basic/card.rs` | **完全缺少鼠标跟踪** | P0 | 1天 |

### 2.3 需要验证 hover/focus 的组件 (15个)

这些组件可能有交互效果，需要验证是否正常工作：

| 组件 | 文件 | 验证项 | 优先级 | 预计时间 |
|------|------|--------|--------|----------|
| Switch | `basic/switch.rs` | `.hi-switch-glow` 效果 | P1 | 0.5天 |
| Checkbox | `basic/checkbox.rs` | hover/focus | P1 | 0.5天 |
| RadioGroup | `basic/radio_group.rs` | hover/focus | P1 | 0.5天 |
| Slider | `basic/slider.rs` | hover/focus | P2 | 0.5天 |
| Badge | `basic/badge.rs` | hover | P2 | 0.25天 |
| Avatar | `basic/avatar.rs` | hover | P2 | 0.25天 |
| Menu | `navigation/menu.rs` | hover/focus | P1 | 0.5天 |
| Sidebar | `navigation/sidebar.rs` | hover/focus | P1 | 0.5天 |
| Tabs | `navigation/tabs.rs` | hover/active | P1 | 0.5天 |
| Table | `data/table.rs` | row hover | P2 | 0.5天 |
| Tree | `data/tree.rs` | node hover | P2 | 0.5天 |
| Tag | `display/tag.rs` | hover | P2 | 0.25天 |
| Timeline | `display/timeline.rs` | box-shadow glow | P2 | 0.25天 |
| Calendar | `display/calendar.rs` | box-shadow glow | P2 | 0.25天 |
| Modal | `feedback/modal.rs` | 需要检查 | P2 | 0.5天 |

### 2.4 滚动容器组件 (1个)

| 组件 | 文件 | 验证项 | 优先级 | 预计时间 |
|------|------|--------|--------|----------|
| Scrollbar | `layout/scrollbar.rs` | 滚动体验 | P2 | 0.5天 |

---

## 三、分阶段修复计划

### Phase 1: Glow 组件核心修复 (2天)

**目标**: 修复 Glow 组件本身，让所有使用 Glow 包装器的组件正常工作

| 任务 | 优先级 | 时间 |
|------|--------|------|
| 添加 CSS hover fallback | P0 | 0.5天 |
| 修复初始状态 (移除 `--glow-intensity-scale: 0`) | P0 | 0.5天 |
| 验证事件类型绑定 | P0 | 0.5天 |
| 添加调试日志 | P1 | 0.5天 |

**修改文件**:
- `packages/components/src/feedback/glow.rs`
- `packages/components/src/styles/components/glow.scss`

### Phase 2: Glow 包装器组件验证 (2天)

**目标**: 验证所有使用 Glow 包装器的组件

| 组件 | 验证内容 | 时间 |
|------|----------|------|
| Button | hover/active/focused 状态 | 0.5天 |
| IconButton | hover/active/focused 状态 | 0.5天 |
| Input | hover/focused 状态 | 0.5天 |
| InputWrapper | hover/focused 状态 | 0.5天 |
| Select | hover/focused 状态 | 0.5天 |
| Alert | 显示效果 | 0.25天 |
| Toast | 显示效果 | 0.25天 |

### Phase 3: 内联 Glow 组件修复 (1天)

**目标**: 为 Card 添加鼠标跟踪效果

| 任务 | 时间 |
|------|------|
| 添加 onmousemove 处理 | 0.5天 |
| 使用 platform 辅助函数 | 0.25天 |
| 测试和验证 | 0.25天 |

**修改文件**:
- `packages/components/src/basic/card.rs`

### Phase 4: 交互组件验证 (3天)

**目标**: 验证所有有交互效果的组件

| 组件 | 验证内容 | 时间 |
|------|----------|------|
| Switch | `.hi-switch-glow` 效果 | 0.5天 |
| Checkbox/Radio | hover/focus 状态 | 0.5天 |
| Slider | hover/focus 状态 | 0.5天 |
| Menu/Sidebar | hover/focus 状态 | 0.5天 |
| Tabs | hover/active 状态 | 0.5天 |
| Badge/Avatar | hover 效果 | 0.5天 |

### Phase 5: 数据展示组件验证 (1天)

**目标**: 验证数据展示组件的 hover 效果

| 组件 | 验证内容 | 时间 |
|------|----------|------|
| Table | row hover | 0.25天 |
| Tree | node hover | 0.25天 |
| Timeline/Calendar | box-shadow glow | 0.25天 |
| Tag | hover 效果 | 0.25天 |

### Phase 6: 滚动容器验证 (0.5天)

**目标**: 验证滚动容器组件

| 组件 | 验证内容 | 时间 |
|------|----------|------|
| Scrollbar | 滚动体验 | 0.5天 |

### Phase 7: 全面测试 (1天)

| 任务 | 时间 |
|------|------|
| 视觉回归测试 | 0.5天 |
| 交互行为测试 | 0.25天 |
| 性能测试 | 0.25天 |

---

## 四、关键代码修改

### 4.1 Glow 组件 - 添加 fallback

```scss
// glow.scss
.hi-glow-wrapper::before {
  // 默认隐藏，通过 CSS hover 或 JS 控制
  opacity: 0;
  transition: opacity 100ms ease-out;
}

// CSS hover fallback
.hi-glow-wrapper:hover::before {
  opacity: var(--glow-base-opacity, 0.3);
}

// JS 增强模式（当支持时覆盖 CSS hover）
@supports (selector(:has(*))) {
  .hi-glow-wrapper::before {
    opacity: calc(var(--glow-base-opacity, 1) * var(--glow-intensity-scale, var(--glow-hover-opacity, 0)));
  }
}
```

```rust
// glow.rs - 修改初始状态
let initial_style = format!(
    "--glow-x: 50%; --glow-y: 50%; --hi-glow-color: {};",
    glow_color
);
// 移除 --glow-intensity-scale: 0，让 CSS hover 控制
```

### 4.2 Card 组件 - 添加鼠标跟踪

```rust
// card.rs
#[cfg(all(target_arch = "wasm32", target_os = "unknown"))]
{
    let mousemove_handler = move |event: MouseEvent| {
        use crate::platform::*;

        let client_x = event.client_x;
        let client_y = event.client_y;

        if let Some(target_el) = element_from_point(client_x, client_y) {
            if let Some(card_el) = get_element_by_class_upward("hi-card", &target_el) {
                if let Some(glow_el) = card_el.query_selector(".hi-card-glow").ok().flatten() {
                    if let Some(rect) = get_bounding_client_rect(&card_el) {
                        let percent_x = ((client_x as f64 - rect.x) / rect.width * 100.0).clamp(0.0, 100.0);
                        let percent_y = ((client_y as f64 - rect.y) / rect.height * 100.0).clamp(0.0, 100.0);

                        if let Some(html_el) = glow_el.dyn_ref::<web_sys::HtmlElement>() {
                            set_style_property(html_el, "--glow-x", &format!("{:.1}%", percent_x));
                            set_style_property(html_el, "--glow-y", &format!("{:.1}%", percent_y));
                        }
                    }
                }
            }
        }
    };

    rsx! {
        div {
            class: card_classes,
            onmousemove: mousemove_handler,
            {content}
        }
    }
}
```

---

## 五、组件优先级说明

### P0 - 核心问题 (必须修复)
- Glow 组件本身
- Button, IconButton, Input, InputWrapper
- Card

### P1 - 重要交互 (应该修复)
- Select, Alert, Toast
- Switch, Checkbox, Radio
- Menu, Sidebar, Tabs

### P2 - 次要效果 (可以延后)
- Slider, Badge, Avatar
- Table, Tree
- Timeline, Calendar
- Modal, Scrollbar

---

## 六、风险评估

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|----------|
| CSS fallback 不生效 | 高 | 低 | 使用 @supports 检测 |
| 事件类型不兼容 | 高 | 中 | 添加类型转换层 |
| 状态机状态不一致 | 高 | 中 | 添加调试日志 |
| 性能退化 | 中 | 低 | 节流鼠标事件 |
| 组件数量多 | 中 | 高 | 分批修复，优先处理 P0 |

---

## 七、成功标准

1. **Button/IconButton/Input** 的 hover 效果与 Legacy 一致
2. **Card** 的鼠标跟随效果正常工作
3. **CSS hover** 作为 fallback 正常工作
4. **所有 P0 组件** 的交互状态正确显示
5. **性能不低于** Legacy 版本

---

## 八、附录

### A. 相关文件清单

**需要修改的核心文件**:
- `packages/components/src/feedback/glow.rs`
- `packages/components/src/styles/components/glow.scss`
- `packages/components/src/basic/card.rs`

**需要验证的组件文件**:
- `packages/components/src/basic/*.rs` (15个文件)
- `packages/components/src/feedback/*.rs` (除 glow.rs 外)
- `packages/components/src/navigation/*.rs` (需要验证的)
- `packages/components/src/data/*.rs` (需要验证的)
- `packages/components/src/display/*.rs` (需要验证的)

### B. 总预计时间

| 阶段 | 时间 |
|------|------|
| Phase 1: Glow 核心修复 | 2天 |
| Phase 2: Glow 包装器验证 | 2天 |
| Phase 3: 内联 Glow 修复 | 1天 |
| Phase 4: 交互组件验证 | 3天 |
| Phase 5: 数据展示验证 | 1天 |
| Phase 6: 滚动容器验证 | 0.5天 |
| Phase 7: 全面测试 | 1天 |
| **总计** | **10.5天** |

---

**文档版本**: 4.0 (完整组件清单版)
**最后更新**: 2026-03-26
**状态**: 待执行
**涉及组件**: 24个
**总预计时间**: 10.5天
