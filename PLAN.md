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

## 改造范围

### 1. 颜色系统
- [ ] 文字颜色（主色、次色、禁用色）
- [ ] 图标颜色（填充色、描边色）
- [ ] 背景颜色（主背景、次背景、悬停背景）
- [ ] 边框颜色（主边框、焦点边框、禁用边框）
- [ ] 阴影颜色（主阴影、发光阴影）

### 2. 圆角系统
- [ ] 组件圆角（按钮、输入框、卡片）
- [ ] 内部元素圆角（图标、徽章）
- [ ] 特殊圆角（全圆、椭圆）

### 3. 动画系统
- [ ] 过渡时长（快速、正常、慢速）
- [ ] 缓动函数（默认、弹性、线性）
- [ ] 动画延迟（同步、异步）
- [ ] 关键帧（进入、退出、循环）

### 4. 背景系统
- [ ] 纯色背景
- [ ] 渐变背景
- [ ] 模糊背景
- [ ] 图片背景

### 5. SVG 系统
- [ ] 填充属性（颜色、透明度）
- [ ] 描边属性（颜色、宽度）
- [ ] 尺寸属性（宽度、高度）

## 实施阶段

### Phase 1: 基础设施（P0）
**目标**: 建立三层级配置的基础架构

#### 1.1 CSS 变量系统重构
- [ ] 创建 `packages/theme/styles/foundation.scss`
  - 定义 Layer1 全局变量
  - 按类别组织变量（颜色、圆角、动画、背景、SVG）
  - 支持主题切换

#### 1.2 组件变量规范
- [ ] 创建 `packages/theme/styles/component-vars.scss`
  - 定义 Layer2 组件变量命名规范
  - 创建变量生成工具函数

#### 1.3 AnimationBuilder 扩展
- [ ] 扩展 `packages/animation/src/builder.rs`
  - 支持 CSS 变量动画
  - 支持颜色过渡
  - 支持圆角过渡
  - 支持背景过渡

### Phase 2: 核心组件改造（P0）
**目标**: 改造最常用的基础组件

#### 2.1 Button 组件
- [ ] 创建 `button-vars.scss`
  - 图标颜色变量
  - 文字颜色变量
  - 背景颜色变量
  - 边框颜色变量
  - 圆角变量
  - 动画变量

- [ ] 更新 `button.scss`
  - 使用 CSS 变量
  - 支持 Layer2 覆盖
  - 支持 Custom 动画

- [ ] 更新 `button.rs`
  - 添加 `icon_color` 属性
  - 添加 `text_color` 属性
  - 添加 `animation_id` 属性

#### 2.2 IconButton 组件
- [ ] 创建 `icon-button-vars.scss`
  - 图标颜色变量
  - 背景颜色变量
  - 圆角变量
  - 动画变量

- [ ] 更新 `icon-button.scss`
  - 使用 CSS 变量
  - 支持 hover 状态变量
  - 支持 active 状态变量

- [ ] 更新 `icon_button.rs`
  - 添加 `icon_color` 属性
  - 添加 `animation_id` 属性

#### 2.3 Input 组件
- [ ] 创建 `input-vars.scss`
  - 文字颜色变量
  - 占位符颜色变量
  - 边框颜色变量
  - 背景颜色变量
  - 圆角变量

- [ ] 更新 `input.scss`
  - 使用 CSS 变量
  - 支持 focus 状态变量
  - 支持 disabled 状态变量

- [ ] 更新 `input.rs`
  - 添加 `text_color` 属性
  - 添加 `border_color` 属性
  - 添加 `animation_id` 属性

### Phase 3: 复杂组件改造（P1）
**目标**: 改造复杂的交互组件

#### 3.1 Card 组件
- [ ] 创建 `card-vars.scss`
  - 标题颜色变量
  - 内容颜色变量
  - 边框颜色变量
  - 背景颜色变量
  - 圆角变量
  - 阴影变量

#### 3.2 Modal 组件
- [ ] 创建 `modal-vars.scss`
  - 背景颜色变量
  - 边框颜色变量
  - 阴影变量
  - 圆角变量
  - 动画变量

#### 3.3 Dropdown 组件
- [ ] 创建 `dropdown-vars.scss`
  - 选项颜色变量
  - 高亮颜色变量
  - 边框颜色变量
  - 圆角变量

### Phase 4: 动画系统增强（P2）
**目标**: 完善动画控制能力

#### 4.1 颜色过渡
- [ ] 实现颜色插值算法
- [ ] 支持 RGB 过渡
- [ ] 支持 HSL 过渡
- [ ] 支持透明度过渡

#### 4.2 圆角过渡
- [ ] 支持圆角动画
- [ ] 支持圆角变化曲线

#### 4.3 背景过渡
- [ ] 支持渐变过渡
- [ ] 支持模糊过渡

### Phase 5: 文档和示例（P2）
**目标**: 完善文档和示例

#### 5.1 设计系统文档
- [ ] 创建 `docs/design-system/overview.md`
- [ ] 创建 `docs/design-system/layer1.md`
- [ ] 创建 `docs/design-system/layer2.md`
- [ ] 创建 `docs/design-system/custom.md`

#### 5.2 组件文档更新
- [ ] 更新所有组件的 API 文档
- [ ] 添加颜色配置示例
- [ ] 添加动画控制示例

#### 5.3 示例代码
- [ ] 创建主题定制示例
- [ ] 创建动画控制示例
- [ ] 创建动态样式示例

## 技术规范

### CSS 变量命名规范

```scss
// Layer1 全局变量
--hi-{category}-{property}: value;
// 示例
--hi-color-primary: #ff4f00;
--hi-radius-md: 8px;
--hi-duration-normal: 300ms;

// Layer2 组件变量
--hi-{component}-{property}: value;
// 示例
--hi-button-icon-color: var(--hi-color-text-primary);
--hi-button-radius: var(--hi-radius-md);

// Layer2 状态变量
--hi-{component}-{state}-{property}: value;
// 示例
--hi-button-hover-bg: rgba(255, 255, 255, 0.1);
--hi-button-active-transform: scale(0.98);
```

### 组件属性规范

```rust
#[derive(Props)]
pub struct ComponentProps {
    // Layer2 属性
    #[props(default)]
    pub icon_color: Option<String>,
    
    #[props(default)]
    pub text_color: Option<String>,
    
    // Custom 属性
    #[props(default)]
    pub animation_id: Option<String>,
    
    #[props(default)]
    pub custom_styles: Option<Vec<(&'static str, String)>>,
}
```

### AnimationBuilder API 规范

```rust
AnimationBuilder::new()
    // Layer2 变量
    .style("--hi-button-icon-color", "rgb(255, 0, 0)")
    .style("--hi-button-radius", "16px")
    
    // Custom 样式
    .style("transform", "scale(1.1)")
    .style("opacity", "0.8")
    
    // 动画配置
    .duration(300)
    .easing(Easing::EaseInOut)
    .apply_to(element);
```

## 验收标准

### 功能验收
- [ ] 所有组件支持三层级配置
- [ ] CSS 变量命名符合规范
- [ ] AnimationBuilder 支持所有属性
- [ ] 主题切换正常工作

### 性能验收
- [ ] CSS 变量数量合理（< 500 个）
- [ ] 动画性能达标（60fps）
- [ ] 编译时间增加 < 10%

### 文档验收
- [ ] 所有组件有完整的 API 文档
- [ ] 有详细的设计系统文档
- [ ] 有丰富的示例代码

## 风险和缓解

### 风险 1: CSS 变量过多
**缓解**: 
- 按需生成变量
- 使用 CSS 变量继承
- 定期清理未使用的变量

### 风险 2: 动画性能问题
**缓解**: 
- 使用 GPU 加速
- 避免频繁的样式计算
- 提供性能监控工具

### 风险 3: 向后兼容性
**缓解**: 
- 保留旧 API
- 提供迁移指南
- 渐进式改造

## 时间估算

- Phase 1: 2 周
- Phase 2: 3 周
- Phase 3: 2 周
- Phase 4: 2 周
- Phase 5: 1 周

**总计**: 10 周

## 下一步行动

1. 创建 `foundation.scss` 文件
2. 定义 Layer1 全局变量
3. 改造 Button 组件作为示例
4. 验证三层级配置方案
5. 推广到其他组件
