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

### Phase 6: #[allow] 属性清理 ✅ 完成
- [x] 移除 `popover.rs` 的 `#[allow(unused_mut)]`，使用条件编译
- [x] 移除 `utils/mod.rs` 的 `#[allow(unused_imports)]`，删除未使用的导入
- [x] 移除 `chinese.rs` 的 `#[allow(non_upper_case_globals)]`，重命名常量为 `PURE_WHITE`/`PURE_BLACK`
- [x] 移除 `anchor.rs` 的 `#[allow(unused_variables)]`，使用条件编译
- [x] 移除 `file_upload.rs`, `positioning.rs` 的 `#[allow(unused_variables)]`
- [x] 移除 `lib.rs` 的 `#[allow(unused_imports)]`，删除重复导入
- [x] 修复 `qrcode.rs` 的弃用 API: `set_fill_style` → `set_fill_style_str`
- [x] 移除 `provider.rs` 未使用的 `default_theme_context` 函数
- [x] 移除 `icons/lib.rs` 未使用的 `log_dynamic_fetch_success` 函数
- [x] 移除 `value.rs` 的 `#[allow(dead_code)]`
- [x] 移除 `processor.rs` 的 `#[allow(dead_code)]`，将 `compute` 改为 `pub`
- [x] 移除 `colors/mod.rs` 的 `#[allow(dead_code)]`
- [x] 删除 `radio_group.rs` 中的弃用 API (`RadioButtonProps`, `RadioButton`)

---

## 剩余 #[allow] 属性（有意保留）

| 属性 | 位置 | 原因 |
|------|------|------|
| `clippy::should_implement_trait` | `classes/mod.rs`, `tween.rs`, `validators.rs` | Builder 模式设计，方法名 `add` 不需要实现 `Add` trait |
| `non_snake_case` | `form/hooks.rs`, `icons/lib.rs` | React 风格命名约定 (`useForm`, `mdi::Moon`) |
| `async_fn_in_trait` | `e2e/tests/mod.rs` | Rust trait 限制，需要 async fn |

---

## 最终状态

- ✅ 编译成功，无错误，无警告
- ✅ 所有测试通过
- ✅ 7 个 commits 已提交到 dev 分支
