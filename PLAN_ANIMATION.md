# AnimationBuilder 动画系统架构改造计划

## 概述

为 Hikari 组件库实现一个完整的动画控制系统，支持：
1. 按钮按下时动态加深 Glow wrapper 的发光等级（100ms 过渡）
2. 完整的弹性状态机架构
3. 动画回收机制（正常结束和异常中断）

## 状态：已完成 ✅

---

## 已完成的任务

### Phase 1: 动画回收机制增强 ✅

- [x] 扩展 AnimationRegistry 添加回收机制
- [x] 添加 LifecycleCallback 生命周期回调 (OnComplete, OnInterrupt, OnError)
- [x] 添加 AnimationEntry 结构管理动画完整信息
- [x] 添加 WeakRef 支持监测目标元素是否存在
- [x] 添加清理无效动画的方法 (cleanup_invalid)
- [x] 添加超时清理机制 (cleanup_timed_out)
- [x] 改进 AnimationManager 支持 cleanup_fn 和 target_element

### Phase 2: 状态机核心 ✅

- [x] 定义状态机接口 (state_machine 模块)
- [x] 定义 ButtonState (Idle, Hover, Active, Focused, Disabled)
- [x] 定义 ButtonEvent (MouseEnter, MouseLeave, MouseDown, MouseUp, etc.)
- [x] 实现完整的状态转换逻辑
- [x] 提供动画配置 (ButtonAnimationConfig)

### Phase 3: Glow 动画集成 ✅

- [x] Glow 组件添加 active_intensity 和 transition_duration 属性
- [x] 添加 --glow-intensity-scale 和 --glow-spread-scale CSS 变量
- [x] 支持通过 CSS 变量动态控制发光强度
- [x] 添加 100ms 默认过渡动画

### Phase 4: 开发者 API (Hooks) ✅

- [x] 添加 hooks 模块框架
- [x] 重新导出 state_machine 类型
- [x] 重新导出 AnimationManager

---

## 架构设计

### 状态机架构

```
┌─────────────────────────────────────────────────────────────┐
│                    AnimationStateMachine                     │
├─────────────────────────────────────────────────────────────┤
│  States:                                                    │
│  ┌───────┐    mousedown     ┌────────┐    mouseup     ┌───┐ │
│  │  Idle │ ───────────────► │ Active │ ─────────────► │   │ │
│  └──┬────┘                  └───┬────┘                │   │ │
│     │◄─────────────────────────┘                      │   │ │
│     │          mouseenter       │                      │   │ │
│     │◄──────────────────────────┘                      │   │ │
│     │                                                   │   │ │
│  ┌──▼─────┐    mouseleave    ┌──────┐               │   │ │
│  │  Hover │ ◄──────────────── │      │               │   │ │
│  └────────┘                  └──────┘               │   │ │
└─────────────────────────────────────────────────────────────┘
```

### 动画控制流程

```
用户操作 (mousedown/mouseup)
         │
         ▼
┌─────────────────┐
│ 事件监听器      │  ← onmousedown, onmouseup, onfocus, onblur
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 状态机转换      │  ← 检查当前状态，计算目标状态
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ CSS 变量更新    │  ← 修改 --glow-intensity-scale
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 100ms 过渡      │  ← CSS transition 自动处理
└─────────────────┘
```

---

## 实现细节

### 1. 动画回收机制 (lifecycle.rs)

```rust
pub enum LifecycleCallback {
    OnComplete(Box<dyn FnOnce()>),
    OnInterrupt(Box<dyn FnOnce()>),
    OnError(Box<dyn FnOnce()>),
}

struct AnimationEntry {
    stop_fn: Box<dyn FnOnce()>,
    cleanup_fn: Option<Box<dyn FnOnce()>>,
    callbacks: Vec<LifecycleCallback>,
    target_element: Option<Weak<HtmlElement>>,
    created_at: std::time::Instant,
}
```

### 2. 状态机 (state_machine/button.rs)

```rust
pub enum ButtonState {
    Idle,
    Hover,
    Active,
    Focused,
    Disabled,
}

pub enum ButtonEvent {
    MouseEnter,
    MouseLeave,
    MouseDown,
    MouseUp,
    Focus,
    Blur,
    Enable,
    Disable,
}
```

### 3. Glow 动态强度 (glow.rs + glow.scss)

```rust
// Rust
pub struct GlowProps {
    pub active_intensity: Option<GlowIntensity>,
    pub transition_duration: String,
}

// CSS
.hi-glow-wrapper {
  --glow-intensity-scale: 1.0;
  --glow-spread-scale: 1.0;
  transition: --glow-intensity-scale 100ms ease-out;
}

&::before {
  opacity: calc(0.15 * var(--glow-intensity-scale, 1.0));
}
```

---

## 使用方式

开发者现在可以：

1. **使用状态机**：导入 `ButtonStateMachine` 管理按钮状态
2. **动态控制 Glow**：通过 CSS 变量控制发光强度
3. **回收机制**：AnimationManager 自动处理动画清理

---

## 提交记录

- `34db187`: fix: 修复图标按钮颜色问题
- `3f05ba0`: feat: 状态机和Glow动画集成
- `7484cdc`: feat: 添加 Hooks 模块框架
