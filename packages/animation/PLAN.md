# hikari-animation 迁移到 tairitsu WIT 接口

## 状态：✅ 已完成

hikari-animation 包已完全迁移到 tairitsu-vdom Platform trait，移除了对 web-sys/wasm-bindgen 的硬依赖。

## 迁移完成内容

### 核心文件

| 文件 | 状态 |
|------|------|
| timer.rs | ✅ 使用 Platform trait 的 RAF |
| context.rs | ✅ 泛型化 AnimationContext<P: Platform> |
| builder/animation.rs | ✅ 移除 Closure，使用 Platform trait |
| builder/action.rs | ✅ 泛型化 AnimationAction<P> |
| builder/value.rs | ✅ 泛型化 DynamicValue<P> |
| events.rs | ✅ 使用 Platform trait 的事件监听 |
| prefers_reduced_motion.rs | ✅ 泛型化，文档说明 WIT 限制 |
| lifecycle.rs | ✅ 使用 ElementHandle (u64) |
| scrollbar.rs | ✅ 泛型化 ScrollbarRegistry<P> |
| style/*.rs | ✅ 保持兼容（非 WIT 环境） |

### 依赖变更

```toml
[features]
default = []
legacy = ["dep:wasm-bindgen", "dep:web-sys", "dep:js-sys"]

[dependencies]
wasm-bindgen = { version = "0.2", optional = true }
web-sys = { version = "0.3", optional = true }
js-sys = { version = "0.3", optional = true }
tairitsu-vdom = { path = "../../../tairitsu/packages/vdom" }
```

### tairitsu-vdom 增强

DomRect 添加 Clone/Copy derive：
```rust
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct DomRect {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}
```

## 已知限制

以下功能需要 tairitsu WIT 接口未来添加支持：

1. **prefers-reduced-motion 检测**：需要 `window.matchMedia()` API
2. **MediaQueryList 事件监听**：需要 `MediaQueryList.addEventListener()` 支持

这些功能当前提供默认实现，在 WIT 接口添加后可以更新。

## 编译验证

```bash
$ cargo check -p hikari-animation
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 36.16s

$ cargo check
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 52.39s
```
