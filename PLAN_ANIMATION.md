# AnimationBuilder 动画系统架构改造计划

## 概述

为 Hikari 组件库实现一个完整的动画控制系统，支持：
1. 按钮按下时动态加深 Glow wrapper 的发光等级（100ms 过渡）
2. 完整的弹性状态机架构
3. 动画回收机制（正常结束和异常中断）

## 核心目标

### 1. 按钮 + Glow 动画集成
- 按钮按下（active）时，Glow wrapper 的 `--glow-opacity` 动态加深
- 100ms CSS transition 过渡
- 按钮释放后恢复

### 2. 完整状态机架构
- 暴露状态机 API 给开发者使用
- 支持复杂状态转换（Idle → Hover → Active → Idle）
- 状态变化时自动触发动画

### 3. 动画回收机制
- 动画正常结束后自动回收
- 异常中断时（如父组件销毁）强制回收
- 防止内存泄漏

---

## 架构设计

### 1. 状态机架构

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
│                                                          │   │ │
│  Transitions:                                            │   │ │
│  - Idle → Hover: 鼠标进入                               │   │ │
│  - Hover → Active: 鼠标按下                             │   │ │
│  - Active → Hover: 鼠标释放                             │   │ │
│  - Hover → Idle: 鼠标离开                               │   │ │
│  - Any → Idle: blur/focuslost                          │   │ │
└─────────────────────────────────────────────────────────────┘
```

### 2. 动画控制流程

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
│ 动画生成器      │  ← 创建 AnimationBuilder 实例
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌───────┐ ┌───────────┐
│ 动画A │ │  动画B    │  ← 可能同时运行多个动画
└───┬───┘ └─────┬─────┘
    │           │
    ▼           ▼
┌─────────────────┐
│ 动画执行器      │  ← 应用 CSS 变量/类变化
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 状态更新        │  ← 更新组件状态
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 回收注册        │  ← 注册回调用于清理
└─────────────────┘
```

### 3. 回收机制架构

```
┌─────────────────────────────────────────────────────────────┐
│                    AnimationRegistry                         │
├─────────────────────────────────────────────────────────────┤
│  正常回收:                                                      │
│  1. 动画完成回调 (onComplete)                                  │
│  2. 状态转换完成                                               │
│  3. 显式调用 stop()                                           │
│                                                               │
│  异常回收:                                                      │
│  1. 组件卸载 (use_effect cleanup)                             │
│  2. 父组件销毁                                                 │
│  3. 元素从 DOM 移除                                            │
│                                                               │
│  实现方式:                                                      │
│  - AnimationManager 实现 Drop trait                          │
│  - 组件卸载时自动调用 cleanup()                                │
│  - WeakRef 监测目标元素是否存在                                │
└─────────────────────────────────────────────────────────────┘
```

---

## 实现计划

### Phase 1: 动画回收机制增强 (P0)

#### 1.1 扩展 AnimationRegistry

**文件**: `packages/animation/src/lifecycle.rs`

- [ ] 添加 `WeakRef` 支持，监测目标元素是否存在
- [ ] 添加超时回收机制
- [ ] 添加动画状态回调（onComplete, onError, onCancel）
- [ ] 实现 `Drop` trait 自动清理

#### 1.2 添加状态监听器

**文件**: `packages/animation/src/builder/animation.rs`

- [ ] 添加 `add_state_listener()` 方法
- [ ] 支持监听元素事件（mousedown, mouseup, focus, blur）
- [ ] 自动触发状态转换

#### 1.3 异常中断处理

- [ ] 添加 `on_animation_interrupted` 回调
- [ ] 实现 WeakRef 模式的元素监测
- [ ] 添加调试日志选项

### Phase 2: 状态机核心 (P0)

#### 2.1 定义状态机接口

**新文件**: `packages/animation/src/state_machine/mod.rs`

```rust
pub trait StateMachine {
    type State: Clone + PartialEq;
    type Event;

    fn transition(&self, event: Self::Event) -> Option<Self::State>;
    fn on_enter(&self, state: &Self::State);
    fn on_exit(&self, state: &Self::State);
}
```

#### 2.2 按钮状态机实现

**新文件**: `packages/animation/src/state_machine/button.rs`

```rust
pub struct ButtonStateMachine {
    // 状态定义
    states: HashSet<ButtonState>,
    transitions: Vec<Transition<ButtonState, ButtonEvent>>,
}

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
}
```

#### 2.3 状态机宏定义

- [ ] 实现 `#[derive(StateMachine)]` 宏简化定义
- [ ] 自动生成状态转换图
- [ ] 支持自定义转换条件

### Phase 3: Glow 动画集成 (P0)

#### 3.1 扩展 Glow 组件

**文件**: `packages/components/src/feedback/glow.rs`

- [ ] 添加 `active_intensity` 属性（按下时的发光强度）
- [ ] 添加事件回调 props（on_mouse_down, on_mouse_up）
- [ ] 暴露内部元素给父组件控制

#### 3.2 Button 状态机集成

**文件**: `packages/components/src/basic/button.rs`

- [ ] 集成 ButtonStateMachine
- [ ] 实现 onmousedown/onmouseup 事件处理
- [ ] 动态修改 Glow 变量

#### 3.3 动画过渡配置

- [ ] 添加 `transition_duration` 属性
- [ ] 支持自定义 easing
- [ ] 100ms 默认过渡

### Phase 4: 开发者 API (P1)

#### 4.1 Animation Hook

**新文件**: `packages/animation/src/hooks/use_animation.rs`

```rust
pub fn use_animation<F>(callback: F) -> AnimationHandle
where
    F: FnOnce(&mut AnimationBuilder) + 'static,
{
    // 创建 AnimationManager
    // 注册动画
    // 返回 handle 用于控制
}
```

#### 4.2 use_button_state Hook

**新文件**: `packages/animation/src/hooks/use_button_state.rs`

```rust
pub fn use_button_state(props: ButtonProps) -> ButtonStateHandle {
    // 管理按钮状态
    // 监听事件
    // 触发动画
}
```

#### 4.3 预设动画

- [ ] `use_hover_glow()` - hover 发光效果
- [ ] `use_press_sink()` - 按下下沉效果
- [ ] `use_ripple()` - 涟漪效果

### Phase 5: 测试和文档 (P2)

#### 5.1 单元测试

- [ ] 状态机转换测试
- [ ] 动画完成回调测试
- [ ] 异常回收测试

#### 5.2 集成测试

- [ ] 按钮 + Glow 集成测试
- [ ] 动画中断测试
- [ ] 性能测试

#### 5.3 文档

- [ ] API 文档
- [ ] 使用示例
- [ ] 迁移指南

---

## 文件清单

### 新增文件

| 文件路径 | 描述 |
|----------|------|
| `packages/animation/src/state_machine/mod.rs` | 状态机模块入口 |
| `packages/animation/src/state_machine/button.rs` | 按钮状态机实现 |
| `packages/animation/src/state_machine/macros.rs` | 状态机宏定义 |
| `packages/animation/src/hooks/mod.rs` | Hooks 模块入口 |
| `packages/animation/src/hooks/use_animation.rs` | 动画 Hook |
| `packages/animation/src/hooks/use_button_state.rs` | 按钮状态 Hook |
| `packages/animation/src/interrupts.rs` | 中断处理模块 |

### 修改文件

| 文件路径 | 修改内容 |
|----------|----------|
| `packages/animation/src/lifecycle.rs` | 扩展回收机制 |
| `packages/animation/src/builder/animation.rs` | 添加状态监听 |
| `packages/animation/src/lib.rs` | 导出新模块 |
| `packages/components/src/feedback/glow.rs` | 添加事件回调 |
| `packages/components/src/basic/button.rs` | 集成状态机 |
| `packages/components/src/basic/icon_button.rs` | 集成状态机 |
| `packages/components/src/styles/components/glow.scss` | 添加过渡 |

---

## 成功标准

1. **功能完整**: 按钮按下时 Glow 加深，100ms 过渡，释放后恢复
2. **状态机**: 开发者可以使用状态机 API 自定义状态转换
3. **回收机制**: 正常和异常情况都能正确回收，无内存泄漏
4. **性能**: 动画流畅，60fps，无卡顿

---

## 时间线估算

- Phase 1: 2-3 天（回收机制）
- Phase 2: 2-3 天（状态机）
- Phase 3: 2-3 天（Glow 集成）
- Phase 4: 2 天（API）
- Phase 5: 1-2 天（测试）

**总计: 约 9-13 天**
