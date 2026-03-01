# 设计系统三层级配置方案改造计划

## 概述

将 Hikari 组件库的设计系统改造为三层级配置架构，实现从主题配置到运行时动画的全链路控制。

## 三层级架构

### Layer1 - 基础层级（Foundation）
- 定义全局 CSS 变量
- 提供所有组件的默认值
- 支持主题切换（亮色/暗色/自定义）

### Layer2 - 组件层级（Component）
- 组件级 CSS 变量覆盖
- 组件特有属性配置
- 状态变体配置（hover/active/disabled）

### Custom - 自定义层级（Runtime）
- AnimationBuilder 动态控制
- 内联样式覆盖
- 运行时属性修改

## 完成状态

**✅ 全部完成！**

### Phase 1: 基础设施（P0）✅

- [x] 创建 `packages/theme/styles/foundation.scss`
- [x] 创建 `packages/components/src/styles/components/button-vars.scss`
- [x] 扩展 `packages/animation/src/builder.rs` 支持 CSS 变量动画

### Phase 2: 核心组件改造（P0）✅

- [x] Button 组件改造（button-vars.scss, button.scss, button.rs）
- [x] IconButton 组件改造（icon-button-vars.scss, icon_button.scss, icon_button.rs）
- [x] Input 组件改造（input-vars.scss, input.scss, input.rs）

### Phase 3: 复杂组件改造（P1）✅

- [x] Card 组件改造（card-vars.scss, card.scss）
- [x] Modal 组件改造（modal-vars.scss, modal.scss）

### Phase 4: 动画系统增强（P2）✅

- [x] 颜色过渡（通过 CSS transition）
- [x] 圆角过渡
- [x] 背景过渡

### Phase 5: 文档和示例（P2）✅

- [x] 创建设计系统文档（overview.md, layer1.md, layer2.md, custom.md）
- [x] 更新组件 API 文档（button.md, input.md）
- [x] 添加颜色配置示例
- [x] 添加动画控制示例

## 技术规范

### CSS 变量命名规范

```scss
// Layer1 全局变量
--hi-{category}-{property}: value;

// Layer2 组件变量
--hi-{component}-{property}: value;

// Layer2 状态变量
--hi-{component}-{state}-{property}: value;
```

### 组件属性规范

```rust
#[derive(Props)]
pub struct ComponentProps {
    // Custom 层属性
    #[props(default)]
    pub icon_color: Option<String>,
    #[props(default)]
    pub text_color: Option<String>,
    #[props(default)]
    pub animation_id: Option<String>,
    #[props(default)]
    pub css_vars: Option<Vec<(&'static str, String)>>,
}
```

## 验收结果

| 检查项 | 状态 |
|--------|------|
| 编译通过 | ✅ |
| 单元测试通过 | ✅ |
| CSS 变量命名规范 | ✅ |
| 三层级架构完整 | ✅ |
| 文档完整 | ✅ |

## 提交记录

1. `feat(components): implement three-layer CSS variable system for Button, IconButton, Input`
2. `feat(components): implement three-layer CSS variable system for Card and Modal`
3. `docs: update PLAN.md with completed tasks and status`
4. `fix(components): resolve clippy warnings`
5. `docs: add design system documentation (Phase 5.1)`
6. `docs: update component API documentation (Phase 5.2)`
