# Hikari 项目维护计划

## 项目状态总览

| 类别 | 状态 | 说明 |
|------|------|------|
| 编译状态 | ✅ 通过 | 所有包编译通过，0 个错误 |
| 单元测试 | ✅ 通过 | 21 个测试全部通过 |
| 核心系统 | ✅ 完整 | Palette、Theme、Icons、Animation、Components、RenderService |
| Node Graph | 🟡 部分完成 | 基础功能完成，history/serialization 待集成 |
| E2E 测试 | 🟡 框架完整 | 需要实际运行验证 |
| 文档 | 🟡 部分完成 | Layer 3 组件文档因 Dioxus 宏问题暂时禁用 |

---

## 当前技术债务清单

### 🔴 高优先级 - 功能完整性问题

#### 1. Node Graph 系统 - History/Serialization 集成
**位置**: `packages/extra-components/src/node_graph/`

**问题**:
- history.rs 和 serialization.rs 已实现但未集成到 NodeGraphCanvas
- 用户无法使用撤销/重做和状态保存功能

**修复方案**:
1. 集成 HistoryState 到 NodeGraphCanvas
2. 在所有修改操作中调用 history.push()
3. 添加 undo/redo 按钮和快捷键（Ctrl+Z / Ctrl+Y）
4. 集成 Serialization 到 NodeGraphCanvas
5. 添加 save/load 按钮和 API

**相关文件**:
- [canvas.rs](packages/extra-components/src/node_graph/canvas.rs)
- [history.rs](packages/extra-components/src/node_graph/history.rs)
- [serialization.rs](packages/extra-components/src/node_graph/serialization.rs)

---

#### 2. Node Graph - 强类型替代 serde_json::Value
**位置**: [history.rs:19,35,74](packages/extra-components/src/node_graph/history.rs)

**问题**:
```rust
pub enum HistoryAction {
    NodeDelete {
        id: String,
        state: serde_json::Value,  // ❌ 动态类型
    },
    ConnectionDelete {
        id: String,
        state: serde_json::Value,  // ❌ 动态类型
    },
}
```

**修复方案**:
定义具体的序列化结构体替代 Value:
```rust
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SerializedNode {
    pub id: String,
    pub node_type: String,
    pub position: (f64, f64),
    pub data: NodeData,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SerializedConnection {
    pub id: String,
    pub from_node: String,
    pub from_port: String,
    pub to_node: String,
    pub to_port: String,
}
```

---

#### 3. 主题动态切换功能
**位置**: [aside_footer.rs:74-77](examples/website/src/components/aside_footer.rs)

**问题**:
- ThemeProvider 当前是静态的（palette 作为 prop 传入）
- 无法在运行时切换主题
- TODO 注释说明这是占位实现

**修复方案**:
1. 修改 ThemeProvider 使用内部 signal 管理当前主题
2. 添加 set_theme() 方法到 ThemeContext
3. 在 AsideFooter 的 onclick 中调用主题切换

**相关文件**:
- [provider.rs](packages/theme/src/provider.rs)
- [context.rs](packages/theme/src/context.rs)
- [aside_footer.rs](examples/website/src/components/aside_footer.rs)

---

#### 4. Layer 3 组件文档 - Dioxus 宏解析问题
**位置**: [app.rs:92-100](examples/website/src/app.rs)

**问题**:
- VideoPlayerDoc、AudioWaveformDoc、RichTextEditorDoc、DragLayerDoc 被注释禁用
- 原因：Dioxus 宏解析问题（可能是因为 rsx! 中的复杂表达式）

**修复方案**:
1. 将复杂表达式提取为常量或函数
2. 使用 format! 字符串拼接代替内联表达式
3. 重新启用路由

---

### 🟡 中优先级 - 代码质量问题

#### 5. 错误处理一致性
**位置**: 全项目（174 个 unwrap/expect 调用）

**问题**:
- 部分代码使用 `unwrap()`/`expect()` 可能导致 panic
- 混合使用 anyhow::Result 和直接 panic

**修复方案**:
1. 审计所有 unwrap/expect 使用
2. 在用户输入路径使用 `?` 传递错误
3. 在内部不变量使用 expect() 并添加清晰错误信息
4. 统一使用 anyhow::Result 作为返回类型

**重点文件**:
- [hooks.rs](packages/components/src/hooks.rs) - 4 个 unwrap
- [builder.rs](packages/animation/src/builder.rs) - 5 个 unwrap
- [plugin.rs](packages/render-service/src/plugin.rs) - 3 个 unwrap

---

#### 6. 语法高亮功能
**位置**: [code_block.rs:8](examples/website/src/components/code_block.rs)

**问题**:
- CodeBlock 组件只有基础样式
- TODO 注释说明没有实际的语法高亮

**修复方案**:
1. 集成 syntect 库（Rust 实现）
2. 或使用 prism.js 通过 JS 注入
3. 支持 Rust、Python、JavaScript 等常用语言

---

#### 7. AudioWaveform 非-WASM 平台实现
**位置**: [audio_waveform.rs:??](packages/extra-components/src/extra/audio_waveform.rs)

**问题**:
- 非 WASM 平台使用假数据生成波形
- 文档注释说明了这是妥协方案

**修复方案**:
1. 添加清晰的文档说明限制
2. 或实现基于 rodio 的音频处理（非 WASM）
3. 或在非 WASM 环境禁用组件并显示提示

---

### 🟢 低优先级 - 优化和改进

#### 8. Clippy 警告清理
**状态**: 基础问题已修复，剩余代码风格建议

**剩余警告类型**:
- 代码风格（redundant closure、map_or 可简化）
- 性能优化建议（不必要的引用）
- 命名建议

**处理方式**: 可选择性修复，不阻塞发布

---

#### 9. E2E 测试实际运行验证
**位置**: [packages/e2e/](packages/e2e/)

**状态**: 框架完整，已编译通过，但未实际运行

**需要**:
1. 启动 Chrome 浏览器（本地或 Docker）
2. 运行 dev server（端口 3000）
3. 执行测试并修复发现的问题

---

#### 10. 示例应用完善
**位置**: [examples/](examples/)

**待完善**:
1. 每个组件的独立示例
2. 完整的 SSR 示例
3. 性能基准测试

---

## 实施计划

### Phase 1: 核心功能完整性（高优先级）

#### 1.1 Node Graph 集成（2-3 天）
- [ ] 集成 HistoryState 到 NodeGraphCanvas
- [ ] 替换 serde_json::Value 为强类型
- [ ] 添加 undo/redo 按钮和快捷键
- [ ] 集成 Serialization
- [ ] 添加 save/load API
- [ ] 编写集成测试

**验收标准**:
- ✅ 撤销/重做功能完整可用
- ✅ 保存/加载功能完整可用
- ✅ 无 serde_json::Value 动态类型
- ✅ 编译通过，测试通过

---

#### 1.2 主题动态切换（1 天）
- [ ] 重构 ThemeProvider 使用 signal
- [ ] 添加 ThemeContext::set_theme()
- [ ] 实现 AsideFooter 主题切换
- [ ] 添加切换动画
- [ ] 编写测试

**验收标准**:
- ✅ 点击按钮可切换主题
- ✅ 所有组件响应主题变化
- ✅ 切换状态持久化（localStorage）

---

#### 1.3 Layer 3 组件文档修复（1 天）
- [ ] 识别 Dioxus 宏解析问题根源
- [ ] 重构复杂表达式为常量
- [ ] 重新启用 4 个组件文档路由
- [ ] 验证所有文档页面可访问

**验收标准**:
- ✅ 所有 Layer 3 组件文档可访问
- ✅ 代码示例可运行
- ✅ 无编译错误

---

### Phase 2: 代码质量提升（中优先级）

#### 2.1 错误处理一致性（2-3 天）
- [ ] 审计所有 unwrap/expect 使用
- [ ] 替换用户输入路径的 unwrap
- [ ] 统一使用 anyhow::Result
- [ ] 添加清晰的错误消息

**验收标准**:
- ✅ 用户输入路径无 unwrap
- ✅ 错误处理风格一致
- ✅ Panic 有清晰的错误消息

---

#### 2.2 语法高亮实现（1 天）
- [ ] 选择实现方案（syntect 或 prism.js）
- [ ] 集成到 CodeBlock 组件
- [ ] 支持 5+ 常用语言
- [ ] 添加主题支持

**验收标准**:
- ✅ Rust 代码正确高亮
- ✅ 支持多个语言
- ✅ 与主题系统集成

---

#### 2.3 AudioWaveform 平台支持（1 天）
- [ ] 添加明确的限制文档
- [ ] 实现非 WASM 提示组件
- [ ] 或实现基于 rodio 的音频处理

**验收标准**:
- ✅ 非 WASM 环境有明确提示
- ✅ 文档说明平台限制
- ✅ 无混淆行为

---

### Phase 3: 测试和验证（中优先级）

#### 3.1 E2E 测试验证（1 天）
- [ ] 启动 Docker Chrome 环境
- [ ] 运行 dev server
- [ ] 执行所有 E2E 测试
- [ ] 修复发现的问题

**验收标准**:
- ✅ 所有 17 个组件 E2E 测试通过
- ✅ CI/CD 集成完成

---

#### 3.2 单元测试补充（持续）
- [ ] Node Graph 集成测试
- [ ] 主题切换测试
- [ ] 错误处理测试

**验收标准**:
- ✅ 核心功能有测试覆盖
- ✅ 测试覆盖率 > 60%

---

### Phase 4: 优化和改进（低优先级）

#### 4.1 Clippy 警告清理（持续）
- [ ] 修复关键警告
- [ ] 可选择性修复风格警告

**验收标准**:
- ✅ 关键警告全部修复
- ✅ 警告数量显著减少

---

#### 4.2 示例应用完善（持续）
- [ ] 添加组件独立示例
- [ ] 完善 SSR 示例
- [ ] 添加性能基准测试

**验收标准**:
- ✅ 每个组件有独立示例
- ✅ SSR 示例完整可运行
- ✅ 性能基准可执行

---

## 设计原则

### 核心原则

1. **类型安全** - 使用强类型代替动态类型（serde_json::Value）
2. **功能完整** - 所有实现的功能必须可用（history/serialization 集成）
3. **用户体验** - 核心功能必须流畅（主题切换）
4. **测试覆盖** - 核心功能必须有测试验证

### 代码规范

- ✅ 使用 `ClassesBuilder` 代替 class 字符串拼接
- ✅ 使用 `StyleStringBuilder` 代替 style 字符串拼接
- ✅ 使用 `AnimationBuilder` 代替直接 DOM 操作
- ✅ **使用强类型结构体代替 `serde_json::Value`**
- ✅ 使用 `anyhow::Result` 统一错误处理
- ❌ 不要在用户输入路径使用 `unwrap()`
- ❌ 不要创建新的颜色常量
- ❌ 不要创建全局样式

---

## 成功标准

- ✅ 所有包编译通过
- ✅ 所有测试通过
- ✅ Node Graph 功能完整（包括 history/serialization）
- ✅ 主题动态切换可用
- ✅ Layer 3 组件文档全部启用
- ✅ 无 serde_json::Value 动态类型（核心功能）
- ✅ 错误处理一致且健壮
- ✅ E2E 测试全部通过
- ⬜ Clippy 警告减少到可接受水平
- ⬜ 示例应用完善

---

**最后更新**: 2026-02-02
**维护者**: Hikari Contributors
**许可**: MIT OR Apache-2.0
