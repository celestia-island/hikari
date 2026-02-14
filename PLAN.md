# ThemeProvider 三层分级设计

## 实施状态：✅ 已完成

---

## 问题分析

### 原始问题
1. **单选框/复选框暗黑模式图标颜色错误**：图标使用 `color: white` 硬编码，但背景是 `primary` 色渐变，在暗黑模式下 `primary` 色较深，导致图标不可见
2. **ThemeProvider 职责过重**：所有颜色变量（基础色 + 组件色 + 动画相关）都混在一个层级
3. **缺乏组件级颜色定制**：每个组件需要自己计算适合的颜色

### 解决方案
实现三层分级主题系统，将职责分离到不同层级。

---

## 架构概览

```
┌─────────────────────────────────────────────────────────────────┐
│                         Layer 3: 高级功能                        │
│  AnimationProvider, StyleProvider (全局 Context, 可嵌套)         │
├─────────────────────────────────────────────────────────────────┤
│                         Layer 2: 组件颜色                        │
│  ComponentPalette (由 Layer1 自动派生)                           │
│  - Radio/Checkbox 图标色、背景色                                  │
│  - Input 边框、焦点色                                             │
├─────────────────────────────────────────────────────────────────┤
│                         Layer 1: 基础配色                        │
│  Palette (primary, secondary, semantic, surface, text)           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 已完成的实施

### Layer 2: 组件颜色层 ✅

**文件**: `packages/components/src/theme_provider.rs`

```rust
// ComponentOverrides - 用户可部分覆盖
pub struct ComponentOverrides {
    pub selection_icon_color: Option<String>,
    pub selection_background: Option<String>,
    pub selection_border: Option<String>,
    pub selection_surface: Option<String>,
    pub selection_glow: Option<String>,
    pub input_border: Option<String>,
    pub input_focus_border: Option<String>,
    pub input_background: Option<String>,
}

// ComponentPalette - 自动从 Palette 派生
pub struct ComponentPalette { /* ... */ }
```

**CSS 变量输出**:
```css
--hi-component-selection-icon: #ffffff;
--hi-component-selection-bg: linear-gradient(135deg, rgba(...), rgba(...));
--hi-component-selection-border: rgba(...);
--hi-component-selection-surface: rgba(...);
--hi-component-selection-glow: rgba(...);
```

### Layer 3: AnimationProvider ✅

**文件**: `packages/animation/src/provider.rs`

```rust
pub struct AnimationConfig {
    pub enabled: bool,
    pub duration_scale: f32,
    pub reduced_motion: bool,
}

pub fn AnimationProvider(props: AnimationProviderProps) -> Element { /* ... */ }
pub fn use_animation_config() -> AnimationContext { /* ... */ }
```

**CSS 变量输出**:
```css
--hi-animation-enabled: 1;
--hi-animation-duration-scale: 0.8;
--hi-animation-reduced-motion: 0;
```

**prefers-reduced-motion 检测**: `packages/animation/src/prefers_reduced_motion.rs`

### Layer 3: StyleProvider ✅

**文件**: `packages/theme/src/style_provider.rs`

```rust
pub struct StyleConfig {
    pub class_prefix: String,
    pub extra_classes: Vec<String>,
    pub component_overrides: HashMap<String, String>,
}

pub fn StyleProvider(props: StyleProviderProps) -> Element { /* ... */ }
pub fn use_component_class(component_name: &str, base_class: &str) -> String { /* ... */ }
```

### Radio/Checkbox 样式更新 ✅

**文件**: 
- `packages/components/src/styles/components/radio.scss`
- `packages/components/src/styles/components/checkbox.scss`

现在使用 Layer 2 CSS 变量，移除了硬编码的暗黑模式样式。

### CSS 变量别名修复 ✅

**问题**: 组件使用 `--hi-color-text-primary`，但 ThemeProvider 只生成 `--hi-text-primary`

**修复**: ThemeProvider 现在同时生成：
```css
--hi-text-primary: #F2F2F2;
--hi-color-text-primary: #F2F2F2;  /* 别名 */
--hi-color-text-secondary: ...;
--hi-color-primary: ...;
--hi-color-secondary: ...;
--hi-color-background: ...;
--hi-color-surface: ...;
--hi-color-border: ...;
```

### 图标颜色继承修复 ✅

**问题**: 暗黑模式下图标显示为黑色而不是浅色，因为 SVG path 没有 `fill="currentColor"`

**根因**: `build_svg!` 宏生成的 SVG path 元素没有添加 `fill="currentColor"`，导致无法通过 CSS `color` 属性控制图标颜色

**修复**: 更新 `packages/icons/src/svg_macro.rs`，为所有 SVG path 添加 `fill="currentColor"`：
```rust
// 修复前
svg.push_str("\" />");

// 修复后
svg.push_str("\" fill=\"currentColor\" />");
```

现在图标会自动继承父元素的 CSS `color` 属性，在暗黑模式下正确显示浅色。

---

## 使用示例

### 完整三层使用

```rust
use hikari_components::{ThemeProvider, ComponentOverrides, StyleProvider};
use hikari_animation::AnimationProvider;

rsx! {
    ThemeProvider { 
        palette: "tairitsu",
        component_overrides: ComponentOverrides {
            selection_icon_color: Some("#FFD700".to_string()),
            ..Default::default()
        },
        
        AnimationProvider {
            duration_scale: 0.8,
            respect_reduced_motion: true,
            
            StyleProvider {
                extra_classes: vec!["custom-theme".to_string()],
                
                App { }
            }
        }
    }
}
```

### 组件中使用

```rust
use hikari_animation::{use_animation_config, use_transition_with_config};

fn MyComponent() -> Element {
    // 获取动画配置
    let animation = use_animation_config();
    
    // 使用带配置的 transition
    let mut transition = use_transition_with_config(300);
    
    rsx! { /* ... */ }
}
```

---

## 文件变更清单

### 新增文件
| 文件路径 | 说明 |
|---------|------|
| `packages/animation/src/config.rs` | AnimationConfig 结构 |
| `packages/animation/src/prefers_reduced_motion.rs` | prefers-reduced-motion 检测 |
| `packages/animation/src/provider.rs` | AnimationProvider 组件 |
| `packages/theme/src/style_provider.rs` | StyleProvider 组件 |

### 修改文件
| 文件路径 | 变更内容 |
|---------|----------|
| `packages/components/src/theme_provider.rs` | 添加 ComponentPalette、ComponentOverrides |
| `packages/components/src/styles/components/radio.scss` | 使用 Layer 2 变量 |
| `packages/components/src/styles/components/checkbox.scss` | 使用 Layer 2 变量 |
| `packages/animation/src/lib.rs` | 导出新模块 |
| `packages/animation/src/hooks.rs` | 添加 tween_with_config、use_transition_with_config |
| `packages/theme/src/lib.rs` | 导出 StyleProvider |
| `packages/components/src/lib.rs` | 导出 ComponentOverrides、ComponentPalette |
| `packages/icons/src/svg_macro.rs` | 添加 fill="currentColor" 修复图标颜色继承 |

---

## 决策记录

| 问题 | 决策 | 说明 |
|-----|------|------|
| Layer2 颜色生成方式 | 自动计算 | 由 Palette 派生，用户可部分覆盖 |
| Layer3 组织方式 | 全局 Context | AnimationProvider + StyleProvider |
| ComponentPalette 覆盖 | 支持 | 通过 ComponentOverrides 部分覆盖 |
| AnimationProvider 位置 | hikari-animation | 复用现有动画能力，职责清晰 |
