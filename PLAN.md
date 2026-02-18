# Hikari 项目健康检查计划

## 一、超过500行的文件解耦 (25个文件)

### 高优先级 (>1000行)

| 文件 | 行数 | 建议拆分方案 |
|------|------|-------------|
| `packages/icons/src/generated/mdi.rs` | 22406 | 自动生成文件，不建议切割 |
| `packages/palette/src/colors.rs` | 7450 | → `colors/rgb.rs`, `colors/hsv.rs`, `colors/chinese.rs`, `colors/utils.rs` |
| `packages/palette/src/classes/components.rs` | 2935 | → `classes/header.rs`, `classes/layout.rs`, `classes/button.rs`, `classes/form.rs`, `classes/feedback.rs` |
| `packages/components/src/portal/mod.rs` | 1879 | → `portal/provider.rs`, `portal/types.rs`, `portal/positioning.rs`, `portal/render.rs` |
| `packages/components/src/theme_provider.rs` | 1303 | → `theme/registry.rs`, `theme/provider.rs`, `theme/css.rs`, `theme/traits.rs` |
| `examples/website/src/components/registry.rs` | 1178 | → `registry/layer1.rs`, `registry/layer2.rs`, `registry/layer3.rs`, `registry/demos.rs` |
| `packages/components/src/scripts/scrollbar_container.rs` | 1009 | → `scrollbar/animator.rs`, `scrollbar/events.rs`, `scrollbar/observers.rs`, `scrollbar/init.rs` |
| `packages/animation/src/core.rs` | 1008 | → `core/types.rs`, `core/easing.rs`, `core/options.rs`, `core/tween.rs`, `core/engine.rs` |

### 中优先级 (500-1000行)

| 文件 | 行数 | 建议拆分方案 |
|------|------|-------------|
| `packages/animation/src/style.rs` | 939 | → `style/properties.rs`, `style/builder.rs`, `style/helpers.rs` |
| `packages/icons/src/generated/mdi_selected.rs` | 931 | 自动生成文件 |
| `packages/icons/src/lib.rs` | 776 | → `icon.rs`, `resource.rs`, `shortcuts.rs` |
| `packages/builder/src/icons.rs` | 771 | → `icons/config.rs`, `icons/selection.rs`, `icons/generator.rs` |
| `examples/website/src/components/sidebar.rs` | 743 | → `sidebar/i18n.rs`, `sidebar/routes.rs`, `sidebar/component.rs` |
| `packages/animation/src/presets.rs` | 717 | → `presets/colors.rs`, `presets/glow.rs`, `presets/fui.rs`, `presets/transition.rs` |
| `packages/animation/src/builder.rs` | 659 | → `builder/value.rs`, `builder/action.rs`, `builder/animation.rs` |
| `examples/website/src/app.rs` | 656 | → `app/routes.rs`, `app/handlers.rs`, `app/wrappers.rs` |
| `packages/components/src/utils/form.rs` | 646 | → `form/error.rs`, `form/validators.rs`, `form/state.rs`, `form/hooks.rs` |
| `packages/components/src/data/pagination.rs` | 640 | → `pagination/types.rs`, `pagination/logic.rs`, `pagination/modal.rs` |
| `packages/extra-components/src/node_graph/canvas.rs` | 613 | → `canvas/state.rs`, `canvas/transform.rs`, `canvas/connections.rs` |
| `packages/render-service/src/router.rs` | 557 | → `router/state.rs`, `router/build.rs`, `router/handlers.rs` |
| `packages/animation/src/hooks.rs` | 549 | → `hooks/tween.rs`, `hooks/animated_value.rs`, `hooks/animation_frame.rs` |
| `packages/components/src/production/markdown_editor.rs` | 539 | → `markdown_editor/types.rs`, `markdown_editor/toolbar.rs` |
| `packages/extra-components/src/extra/code_highlighter.rs` | 531 | → `code_highlighter/language.rs`, `code_highlighter/component.rs` |
| `packages/builder/src/lib.rs` | 518 | → `config.rs`, `builder.rs`, `workspace.rs` |
| `packages/palette/src/themes.rs` | 506 | → `themes/mode.rs`, `themes/palette.rs`, `themes/hikari.rs`, `themes/tairitsu.rs` |

---

## 二、文件数量过多的文件夹二次分级 (8个文件夹)

| 文件夹 | 文件数 | 建议分级方案 |
|--------|--------|-------------|
| `packages/animation/src` | 23 | `core/` `context/` `presets/` `utils/` `style/` |
| `packages/components/src/basic` | 22 | `form/` `buttons/` `display/` `decorative/` `special/` |
| `packages/components/src/data` | 17 | `table/` `pagination/` `tree/` `utilities/` |
| `packages/components/src/layout` | 13 | `page/` `containers/` `flex/` `decorative/` |
| `examples/website/src/components` | 13 | `documentation/` `navigation/` `core/` |
| `packages/extra-components/src/extra` | 12 | `media/` `editors/` `interactive/` `display/` |
| `packages/components/src/display` | 12 | `media/` `content/` `state/` `overlay/` |
| `packages/components/src/feedback` | 11 | `overlay/` `progress/` `notification/` `effects/` |

---

## 三、serde_json::Value 动态类型替换 (10处)

### Node Graph 系统 (6处) - 高优先级

| 文件 | 行号 | 用途 | 建议 |
|------|------|------|------|
| `extra-components/src/node_graph/plugins/input_node.rs` | 15 | 输入节点默认值 | 使用 `NodeInputValue` 枚举 |
| `extra-components/src/node_graph/plugins/processor.rs` | 98 | 处理器计算 | 使用 `f64` + `ProcessorError` |
| `extra-components/src/node_graph/plugins/output_node.rs` | 82 | 输出节点输入 | 使用 `OutputData` 枚举 |
| `extra-components/src/node_graph/plugins/constant.rs` | 13 | 常量节点值 | 使用 `ConstantValue` 枚举 |
| `extra-components/src/node_graph/node.rs` | 70 | NodePlugin trait | 使用关联类型或泛型 |
| `extra-components/src/node_graph/serialization.rs` | 27 | 节点序列化数据 | 使用 `NodeData` 枚举 |

### 配置系统 (2处) - 中优先级

| 文件 | 行号 | 用途 | 建议 |
|------|------|------|------|
| `render-service/src/router.rs` | 29 | AppState 配置 | 定义 `AppConfig` 结构体 |
| `render-service/src/plugin.rs` | 101 | 插件状态存储 | 定义 `PluginState` 结构体 |

### 元数据系统 (2处) - 低优先级

| 文件 | 行号 | 用途 | 建议 |
|------|------|------|------|
| `extra-components/src/node_graph/serialization.rs` | 15 | 图元数据 | 定义 `GraphMetadata` 结构体 |

### 建议的类型定义

```rust
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum NodeValue {
    Number(f64),
    Text(String),
    Boolean(bool),
    Null,
}

impl NodeValue {
    pub fn as_f64(&self) -> Option<f64> {
        match self {
            NodeValue::Number(n) => Some(*n),
            _ => None,
        }
    }
}
```

---

## 四、.unwrap() 清理 (97处)

### 高优先级修复 (4处) - 会 panic 的危险用法

| 文件 | 行号 | 问题 | 修复方案 |
|------|------|------|----------|
| `extra-components/src/node_graph/plugins/input_node.rs` | 60 | `from_f64().unwrap()` NaN会panic | `from_f64(val).unwrap_or_else(|| Number::from(0))` |
| `extra-components/src/node_graph/plugins/input_node.rs` | 151 | 用户输入可能无效 | `if let Some(n) = from_f64(num)` |
| `extra-components/src/node_graph/plugins/processor.rs` | 118 | 计算结果可能是NaN | 添加 NaN 检查 |
| `extra-components/src/node_graph/plugins/constant.rs` | 32 | 构造器数值转换 | 参数验证 + unwrap_or |

### 中优先级修复 (10处) - DOM 类型转换

| 文件 | 行号 | 问题 | 修复方案 |
|------|------|------|----------|
| `animation/src/style.rs` | 394,422,522,542,713,738,841 | `dyn_into().unwrap()` | `if let Some() = dyn_ref()` |

### 低优先级修复 (16处) - HTTP Response 构建

建议创建响应构建宏：
```rust
macro_rules! response {
    ($status:expr, $body:expr) => {
        Response::builder()
            .status($status)
            .body(Body::from($body))
            .expect("Failed to build response")
    };
}
```

### 可保留的用法

| 类别 | 数量 | 原因 |
|------|------|------|
| 测试代码 | 32 | 测试中 panic 是预期行为 |
| WASM 浏览器 API | 25 | `web_sys::window()` 在 WASM 环境必定存在 |
| Mutex/RwLock 锁 | 6 | 可改为 `expect()` 提供上下文 |

---

## 五、执行计划

### Phase 1: 高优先级安全修复
1. 修复 `serde_json::Number::from_f64().unwrap()` (4处)
2. 修复 DOM 类型转换的 `dyn_into().unwrap()` (10处)

### Phase 2: 类型严格化
1. 创建 `NodeValue` 枚举类型
2. 重构 Node Graph 系统使用强类型

### Phase 3: 大文件解耦
按行数从大到小依次拆分：
1. `colors.rs` → `colors/` 目录
2. `classes/components.rs` → `classes/` 目录
3. `portal/mod.rs` → `portal/` 目录
4. `theme_provider.rs` → `theme/` 目录

### Phase 4: 文件夹分级
1. `animation/src` → 按功能模块分级
2. `components/src/basic` → 按组件类型分级
3. `components/src/data` → 按数据类型分级

### Phase 5: 低优先级清理
1. HTTP 响应宏创建
2. Mutex 锁的 expect 改进
3. 配置系统类型化

---

## 六、风险评估

| 操作 | 风险等级 | 说明 |
|------|----------|------|
| unwrap 修复 | 低 | 改为 ? 操作符，行为一致 |
| 类型严格化 | 中 | 可能影响序列化兼容性，需要测试 |
| 文件拆分 | 中 | 需要更新 mod.rs 和 use 语句 |
| 文件夹分级 | 高 | 需要大量重构，建议分批进行 |

---

## 七、执行状态

- [x] 扫描超过500行的文件
- [x] 扫描文件夹文件数量
- [x] 扫描 serde_json::Value 用法
- [x] 扫描 .unwrap() 用法
- [x] Phase 1: 高优先级安全修复
  - [x] 修复 `from_f64().unwrap()` 高危用法 (4处)
  - [x] 修复 DOM `dyn_into().unwrap()` (10处) - 改为直接使用 HtmlElement 方法
- [x] Phase 2: 类型严格化
  - [x] 创建 `NodeValue` 枚举类型 (`extra-components/src/node_graph/value.rs`)
  - [x] 重构 Node Graph 系统使用强类型
- [x] Phase 3: 大文件解耦 (已完成 9/9)
  - [x] `theme_provider.rs` (1303行) → `theme/` 目录 (5文件)
  - [x] `animation/core.rs` (1008行) → `core/` 目录 (6文件)
  - [x] `portal/mod.rs` (1879行) → `portal/` 目录 (4文件)
  - [x] `utils/form.rs` (646行) → `form/` 目录 (6文件)
  - [x] `animation/style.rs` (939行) → `style/` 目录 (4文件)
  - [x] `animation/builder.rs` (659行) → `builder/` 目录 (4文件)
  - [x] `animation/hooks.rs` (549行) → `hooks/` 目录 (5文件)
  - [x] `colors.rs` (7450行) → `colors/` 目录 (4文件)
  - [x] `components.rs` (2935行) → `components/` 目录 (12文件)
- [ ] Phase 4: 文件夹分级 (待定)
- [ ] Phase 5: 低优先级清理 (待定)

---

## 八、变更日志

### 2026-02-18

**安全修复:**
- `extra-components/node_graph/plugins/input_node.rs`: 修复 `from_f64().unwrap()` → `from_f64().unwrap_or_else()`
- `extra-components/node_graph/plugins/processor.rs`: 修复 `from_f64().unwrap()` → `NodeValue::from()`
- `extra-components/node_graph/plugins/constant.rs`: 修复 `from_f64().unwrap()` → `NodeValue::from()`
- `animation/style.rs`: 移除冗余的 `dyn_into/dyn_ref` 类型转换，直接使用 `HtmlElement` 方法

**类型严格化:**
- 新增 `extra-components/src/node_graph/value.rs` - `NodeValue` 枚举
- 重构所有 Node Graph 插件使用 `NodeValue` 代替 `serde_json::Value`
- 更新 `serialization.rs` 使用 `GraphMetadata` 结构体

**文件拆分:**
- `theme_provider.rs` → `theme/` (traits, registry, css, provider)
- `animation/core.rs` → `core/` (types, easing, options, tween, engine)
- `portal/mod.rs` → `portal/` (types, provider, positioning, render)
- `utils/form.rs` → `form/` (error, validators, state, hooks, field)
- `animation/style.rs` → `style/` (properties, builder, helpers)
- `animation/builder.rs` → `builder/` (value, action, animation)
- `animation/hooks.rs` → `hooks/` (tween, animated_value, animation_frame, continuous)
- `colors.rs` → `colors/` (mod, impl_, chinese, tests)
- `components.rs` → `components/` (header, layout, button, form, feedback, data, navigation, display, media, misc)

**测试修复:**
- 修复 `navigation_components_tests.rs` 中的 `StepStatus` 导入冲突
- 修复 `node_graph_tests.rs` 中 `GraphMetadata.is_empty()` → `GraphMetadata.extra.is_empty()`
- 标记需要 Dioxus 运行时的测试为 `#[ignore]`
