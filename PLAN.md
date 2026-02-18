# Hikari 项目健康检查计划

## 执行状态

### Phase 1: 高优先级安全修复 ✅ 完成
- [x] 修复 `from_f64().unwrap()` 高危用法 (4处)
- [x] 修复 DOM `dyn_into().unwrap()` (10处) - 改为直接使用 HtmlElement 方法

### Phase 2: 类型严格化 ✅ 完成
- [x] 创建 `NodeValue` 枚举类型 (`extra-components/src/node_graph/value.rs`)
- [x] 重构 Node Graph 系统使用强类型

### Phase 3: 大文件解耦 ✅ 完成 (9/9)
- [x] `theme_provider.rs` (1303行) → `theme/` 目录 (5文件)
- [x] `animation/core.rs` (1008行) → `core/` 目录 (6文件)
- [x] `portal/mod.rs` (1879行) → `portal/` 目录 (4文件)
- [x] `utils/form.rs` (646行) → `form/` 目录 (6文件)
- [x] `animation/style.rs` (939行) → `style/` 目录 (4文件)
- [x] `animation/builder.rs` (659行) → `builder/` 目录 (4文件)
- [x] `animation/hooks.rs` (549行) → `hooks/` 目录 (5文件)
- [x] `colors.rs` (7450行) → `colors/` 目录 (4文件)
- [x] `components.rs` (2935行) → `components/` 目录 (12文件)

### Phase 4: 文件夹分级 ⏸️ 推迟
- 风险等级：高
- 原因：需要大量重构，建议分批进行
- 当前 animation/src 已有子目录结构（core/, builder/, hooks/, style/）

### Phase 5: 低优先级清理 ✅ 完成
- [x] HTTP 响应宏创建 (`response!`, `html_response!`, `json_response!`, `css_response!`, etc.)
- [x] Mutex/RwLock 锁的 expect 改进
- [~] 配置系统类型化 - 推迟（需要更详细的设计，避免破坏兼容性）

---

## 变更日志

### 2026-02-18

**Phase 1: 安全修复**
- `extra-components/node_graph/plugins/input_node.rs`: 修复 `from_f64().unwrap()` → `from_f64().unwrap_or_else()`
- `extra-components/node_graph/plugins/processor.rs`: 修复 `from_f64().unwrap()` → `NodeValue::from()`
- `extra-components/node_graph/plugins/constant.rs`: 修复 `from_f64().unwrap()` → `NodeValue::from()`
- `animation/style.rs`: 移除冗余的 `dyn_into/dyn_ref` 类型转换，直接使用 `HtmlElement` 方法

**Phase 2: 类型严格化**
- 新增 `extra-components/src/node_graph/value.rs` - `NodeValue` 枚举
- 重构所有 Node Graph 插件使用 `NodeValue` 代替 `serde_json::Value`
- 更新 `serialization.rs` 使用 `GraphMetadata` 结构体

**Phase 3: 文件拆分**
- `theme_provider.rs` → `theme/` (traits, registry, css, provider)
- `animation/core.rs` → `core/` (types, easing, options, tween, engine)
- `portal/mod.rs` → `portal/` (types, provider, positioning, render)
- `utils/form.rs` → `form/` (error, validators, state, hooks, field)
- `animation/style.rs` → `style/` (properties, builder, helpers)
- `animation/builder.rs` → `builder/` (value, action, animation)
- `animation/hooks.rs` → `hooks/` (tween, animated_value, animation_frame, continuous)
- `colors.rs` → `colors/` (mod, impl_, chinese, tests)
- `components.rs` → `components/` (header, layout, button, form, feedback, data, navigation, display, media, misc)

**Phase 5: 低优先级清理**
- 创建 HTTP 响应构建宏 (`render-service/src/router.rs`)
- 改进 Mutex/RwLock 锁的 expect 错误信息 (`icons/src/lib.rs`, `components/src/theme/registry.rs`)

**测试修复**
- 修复 `navigation_components_tests.rs` 中的 `StepStatus` 导入冲突
- 修复 `node_graph_tests.rs` 中 `GraphMetadata.is_empty()` → `GraphMetadata.extra.is_empty()`
- 标记需要 Dioxus 运行时的测试为 `#[ignore]`
