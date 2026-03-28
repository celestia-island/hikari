# hikari-animation 迁移到 tairitsu WIT 接口计划

## 概述

将 hikari-animation 包从 `web-sys`/`wasm-bindgen` 迁移到 tairitsu 的 WIT 接口。

## 状态：✅ 已完成

所有迁移工作已完成，animation 包现在完全使用 tairitsu-vdom 的 Platform trait。

## 已完成的工作

### 1. 添加 tairitsu-vdom 依赖

```toml
[dependencies]
tairitsu-vdom = { path = "../../../tairitsu/packages/vdom" }
```

### 2. 核心文件迁移

| 文件 | 状态 | 变更说明 |
|------|------|----------|
| timer.rs | ✅ | 使用 Platform trait 的 RAF |
| context.rs | ✅ | 使用 P::Element 替代 HtmlElement |
| builder/animation.rs | ✅ | 移除 Closure，使用 Platform trait |
| builder/action.rs | ✅ | 泛型化 Platform |
| builder/value.rs | ✅ | 泛型化 DynamicValue |
| events.rs | ✅ | 使用 Platform trait 的事件监听 |
| prefers_reduced_motion.rs | ✅ | 简化实现，泛型化 Platform |
| lifecycle.rs | ✅ | 使用 ElementHandle (u64) |
| scrollbar.rs | ✅ | 使用 ScrollbarRegistry<P> |
| style/*.rs | ✅ | 保持兼容（非 WIT 环境） |

### 3. Cargo.toml 更新

将 web-sys/wasm-bindgen/js-sys 改为可选依赖：

```toml
[features]
default = []
legacy = ["wasm-bindgen", "web-sys", "js-sys"]

[dependencies]
# ... 其他依赖
wasm-bindgen = { version = "0.2", optional = true }
web-sys = { version = "0.3", optional = true, features = [...] }
js-sys = { version = "0.3", optional = true }
```

### 4. tairitsu-vdom 增强

为 DomRect 添加了 Clone/Copy 实现：

```rust
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct DomRect {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}
```

## 迁移模式示例

### 事件监听器

**之前** (web-sys):
```rust
let closure = Closure::wrap(Box::new(move |_event: web_sys::MouseEvent| {
    // 处理事件
}));
element.add_event_listener_with_callback("click", closure.as_ref().unchecked_ref()).unwrap();
closure.forget();
```

**之后** (tairitsu-vdom):
```rust
platform.add_event_listener(
    &element,
    "click",
    Box::new(move |event: Box<dyn EventData>| {
        if let Some(mouse_event) = event.as_any().downcast_ref::<MouseEvent>() {
            // 处理事件
        }
    })
);
```

### RAF 动画循环

**之前** (wasm-bindgen):
```rust
let f = Rc::new(RefCell::new(None::<js_sys::Function>));
let animation_closure = Closure::wrap(Box::new(move || {
    // 动画逻辑
}) as Box<dyn FnMut()>);
let callback: &js_sys::Function = animation_closure.as_ref().unchecked_ref();
*f.borrow_mut() = Some(callback.clone());
```

**之后** (tairitsu-vdom):
```rust
let platform = Rc::clone(&self.platform);
let callback = Box::new(move |timestamp: f64| {
    // 动画逻辑
});
let id = platform.borrow_mut().request_animation_frame(callback);
```

## 验证结果

```bash
$ cargo check -p hikari-animation
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 37.63s

$ cargo check
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 52.39s
```

✅ 所有包编译成功，无错误。
