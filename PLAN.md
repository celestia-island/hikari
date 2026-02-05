# Hikari 项目计划

> 基于 Dioxus + Grass + Axum 的 Rust UI 框架
>
> 设计风格: Arknights 平面设计 + FUI 科幻感 + 中国传统色
>
> 名称来源: "Hikari" (光) 来自音乐游戏 Arcaea

---

## 当前状态

**最后更新**: 2026-02-05

**编译状态**: ✅ 通过
- 0 个编译错误
- 所有包编译成功

**测试状态**: ✅ 通过
- 所有单元测试通过

---

## 发现的问题

### 1. 临时搪塞实现（高优先级）

**问题**: `packages/render-service/src/plugin.rs:312`

```rust
let json_value = serde_json::to_value(value)
    .map_err(|e| anyhow::anyhow!("Failed to serialize state value: {}", e))
    .unwrap_or_else(|_| serde_json::json!({})); // 临时搪塞
```

**问题**: 当序列化失败时，返回一个空的 JSON 对象 `{}`
**影响**: 临时搪塞，不健康的实现方式
**修复建议**: 应该返回错误而不是返回假值

---

### 2. "Under Construction" 占位页面（中等优先级）

**位置**: `examples/website/src/pages/system/`

**有 "Under Construction" 占位的页面**:

1. **icons.rs**: 
   - 消息: "This page is under construction. Check back soon for detailed documentation and examples!"
   - 状态: 仅显示标题和说明，无实际内容

2. **animations.rs**: 
   - 状态: 页面有内容（Core Features, Easing Functions, Presets, Timeline, Spotlight）
   - 说明: 完整实现，无需修改

3. **palette.rs**: 
   - 状态: 页面有内容（Color Systems: Red, Yellow, Green, Usage example）
   - 说明: 完整实现，无需修改

4. **css.rs**: 
   - 状态: 页面有内容（Display, Layout utilities）
   - 说明: 完整实现，无需修改

**需要修复**: 
- ✅ animations.rs - 无需修复
- ✅ palette.rs - 无需修复
- ✅ css.rs - 无需修复
- ⚠️ icons.rs - 需要实现实际内容

**建议**: 在 icons.rs 中添加实际的图标类别和示例展示

---

### 3. 导航修复前生成的截图（需要重新生成）

**问题**: Entry 和 Extra 组件的 8 个截图在导航修复前（commit 332fa3d）生成

**需要重新生成的截图**:

**Entry Components (4)**:
- components_entry_cascader.png
- components_entry_transfer.png
- components_entry_number_input.png
- components_entry_search.png

**Extra Components (4)**:
- components_extra_collapsible.png
- components_extra_timeline.png
- components_extra_user_guide.png
- components_extra_zoom_controls.png

**原因**: 
- 导航修复添加了 Entry 和 Extra 组件
- 这些截图在修复前生成，无法验证导航功能

**解决方案**: 
- 重新运行 `./scripts/run_parallel_screenshots.sh`
- 或重新生成这 8 个特定的截图

---

### 4. System 首页连接错误（需要重新生成）

**问题**: `system.png` 显示 "localhost refused to connect"

**原因**: 浏览器连接问题，非代码问题

**解决方案**: 
- 确保开发服务器正在运行
- 重新生成 system.png 截图

---

## 修复计划

### 优先级 1: 修复临时搪塞实现

**目标**: 修复 `serde_json::json!({})` 临时搪塞

**步骤**:

1. 修改 `packages/render-service/src/plugin.rs:312`
   - 移除 `.unwrap_or_else(|_| serde_json::json!({}))`
   - 改为返回错误或使用更合理的默认值

2. 考虑选项:
   - **选项 A**: 返回错误（推荐）
     ```rust
     let json_value = serde_json::to_value(value)
         .map_err(|e| anyhow::anyhow!("Failed to serialize state value: {}", e))?;
     ```

   - **选项 B**: 使用更合理的默认值
     ```rust
     let json_value = serde_json::to_value(value)
         .unwrap_or(serde_json::Value::Null);
     ```

3. 编译测试
4. 运行单元测试

---

### 优先级 2: 实现 System Icons 页面内容

**目标**: 在 icons.rs 中添加实际的图标类别和示例展示

**步骤**:

1. 参考 palette.rs 的实现方式
2. 添加以下内容:
   - 图标类别（Navigation, Status, Data, File 等）
   - 每个类别的图标示例
   - 使用 `_icons::Icon` 组件展示

3. 实现示例:
   ```rust
   rsx! {
       div { class: ClassesBuilder::new().add(Display::Grid).add(Gap::Gap4).build(),
           // 图标示例
       }
   }
   ```

---

### 优先级 3: 重新生成 Entry 和 Extra 组件截图

**目标**: 验证导航修复后的 Entry 和 Extra 组件

**步骤**:

1. 确保开发服务器运行
2. 重新运行截图生成:
   ```bash
   ./scripts/run_parallel_screenshots.sh
   ```

3. 或者手动生成特定截图:
   ```bash
   cargo run --bin hikari-screenshot --package hikari-e2e -- --start 16 --end 24
   ```

4. 验证截图内容:
   - Entry 导航应该可见
   - Extra 导航应该可见
   - 组件应该正确显示

---

### 优先级 4: 重新生成 System 首页截图

**目标**: 验证系统首页正确显示

**步骤**:

1. 确保开发服务器运行:
   ```bash
   cd examples/website
   cargo run --bin website_server --all-features
   ```

2. 重新生成 system.png:
   ```bash
   cargo run --bin hikari-screenshot --package hikari-e2e -- --start 0 --end 1
   ```

3. 验证截图内容:
   - 系统首页应该正确显示
   - 无连接错误

---

## 技术债务

### 已扫描的代码问题

**扫描范围**:
- 所有 `*.rs` 文件
- 搜索关键词: `todo!()`, `unimplemented!()`, `TODO`, `FIXME`, `XXX`

**扫描结果**:
- ✅ 0 个 `todo!()` 或 `unimplemented!()`（实际功能代码）
- ✅ 0 个 `TODO` 或 `FIXME` 注释（实际功能代码）
- ✅ 所有组件都有完整实现
- ⚠️ 1 个临时搪塞（`serde_json::json!({})`）

### 代码质量

**Clippy 警告**: 5 个（非关键）
- hikari-components: 5 个（代码风格，非关键）

** unwrap() 使用**: 32 处（测试文件中）
- 组件代码中已正确使用错误处理

---

## 架构检查

### 包依赖关系

```
hikari-ssr (independent)
    │
    │
hikari-palette (foundation)
    │
    ├─────────────┐
    │             │
hikari-theme   hikari-components
    │             │
    └──────┬──────┘
           │
    hikari-extra-components
```

### 设计文档

**设计原则**:
1. **Modularity** - 每个包有单一、明确的职责
2. **Composability** - 包可以独立使用或组合
3. **Type Safety** - 利用 Rust 的类型系统

---

## 问题

### 需要决策

**无架构上的疑问**

所有发现的问题都有明确的修复方案。

---

