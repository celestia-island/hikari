# ThemeProvider 三层分级设计

## 问题分析

### 当前问题
1. **单选框/复选框暗黑模式图标颜色错误**：图标使用 `color: white` 硬编码，但背景是 `primary` 色渐变，在暗黑模式下 `primary` 色较深，导致图标不可见
2. **ThemeProvider 职责过重**：所有颜色变量（基础色 + 组件色 + 动画相关）都混在一个层级
3. **缺乏组件级颜色定制**：每个组件需要自己计算适合的颜色

### 根本原因
当前 `ThemePalette` 将所有颜色平铺在一起，没有分层抽象，导致：
- 组件无法获得"智能"的颜色（如根据主题自动选择合适的图标色）
- 颜色之间的关系不明确
- 难以维护和扩展

---

## 设计方案

### 架构概览

```
┌─────────────────────────────────────────────────────────────────┐
│                         Layer 3: 高级功能                        │
│  AnimationProvider, StyleProvider (全局 Context, 可嵌套)         │
├─────────────────────────────────────────────────────────────────┤
│                         Layer 2: 组件颜色                        │
│  ComponentPalette (由 Layer1 自动派生)                           │
│  - Radio/Checkbox 图标色、背景色                                  │
│  - Input 边框、焦点色                                             │
│  - 各组件的定制颜色                                                │
├─────────────────────────────────────────────────────────────────┤
│                         Layer 1: 基础配色                        │
│  Palette (primary, secondary, semantic, surface, text)           │
│  - 由用户选择或自定义                                              │
│  - 提供原始色彩值                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Layer 1: 基础配色层

### 职责
提供最基础的颜色定义，是整个主题系统的根基。

### 结构
```rust
// packages/palette/src/themes.rs
pub struct Palette {
    pub mode: ThemeMode,        // Light | Dark
    
    // 品牌色
    pub primary: Color,
    pub secondary: Color,
    pub accent: Color,
    
    // 语义色（功能性）
    pub success: Color,
    pub warning: Color,
    pub danger: Color,
    
    // 表面色
    pub background: Color,      // 页面背景
    pub surface: Color,         // 卡片/输入框背景
    pub border: Color,          // 边框色
    
    // 文本色
    pub text_primary: Color,    // 主文本
    pub text_secondary: Color,  // 次要文本
}
```

### 输出 CSS 变量
```css
/* Layer 1 变量 (保持现有命名) */
--hi-primary: #EEA2A4;
--hi-secondary: #519A73;
--hi-success: #5CBF91;
--hi-warning: #FBC02D;
--hi-danger: #E85A4F;
--hi-background: #D6ECF0;
--hi-surface: #ECF1F5;
--hi-border: #ECF1F5;
--hi-text-primary: rgba(0, 0, 0, 0.9);
--hi-text-secondary: rgba(0, 0, 0, 0.6);
```

### 变更
- **保持现有 `Palette` 结构不变**
- 移除 `ThemePalette` 中的组件级颜色计算

---

## Layer 2: 组件颜色层

### 职责
基于 Layer 1 自动计算出适合各组件的颜色，支持部分覆盖，解决当前单选框/复选框暗黑模式问题。

### 新增结构
```rust
// packages/components/src/theme_provider.rs (新增)

/// 组件颜色覆盖配置（可选）
/// 用户可以只覆盖需要的字段，其他保持自动计算
#[derive(Clone, Default)]
pub struct ComponentOverrides {
    // Radio/Checkbox 覆盖
    pub selection_icon_color: Option<String>,
    pub selection_background: Option<String>,
    pub selection_border: Option<String>,
    pub selection_surface: Option<String>,
    pub selection_glow: Option<String>,
    
    // Input 覆盖
    pub input_border: Option<String>,
    pub input_focus_border: Option<String>,
    pub input_background: Option<String>,
    
    // 其他组件... 按需添加
}

/// 组件级颜色派生
/// 所有颜色由 Palette 自动计算，用户可通过 ComponentOverrides 部分覆盖
#[derive(Clone)]
pub struct ComponentPalette {
    // ============================================
    // Radio / Checkbox 组件颜色
    // ============================================
    
    /// 单选框/复选框选中时的图标颜色
    /// - 白天模式: 白色 (在 primary 背景上)
    /// - 暗黑模式: 白色 (在 primary 背景上)
    pub selection_icon_color: String,
    
    /// 单选框/复选框选中时的背景渐变
    pub selection_background: String,
    
    /// 单选框/复选框未选中时的边框色
    pub selection_border: String,
    
    /// 单选框/复选框未选中时的背景色
    pub selection_surface: String,
    
    /// 单选框/复选框的 glow 效果色
    pub selection_glow: String,
    
    // ============================================
    // Input 组件颜色
    // ============================================
    
    /// 输入框边框色
    pub input_border: String,
    
    /// 输入框焦点边框色
    pub input_focus_border: String,
    
    /// 输入框背景色
    pub input_background: String,
    
    // ============================================
    // 其他组件... 按需添加
    // ============================================
}

impl ComponentPalette {
    /// 从 Layer 1 Palette 自动派生（无覆盖）
    pub fn from_palette(palette: &Palette) -> Self {
        Self::from_palette_with_overrides(palette, ComponentOverrides::default())
    }
    
    /// 从 Layer 1 Palette 派生，支持部分覆盖
    pub fn from_palette_with_overrides(palette: &Palette, overrides: ComponentOverrides) -> Self {
        // 自动计算的默认值
        let auto = Self::compute_defaults(palette);
        
        // 应用覆盖（只覆盖用户指定的字段）
        Self {
            selection_icon_color: overrides.selection_icon_color.unwrap_or(auto.selection_icon_color),
            selection_background: overrides.selection_background.unwrap_or(auto.selection_background),
            selection_border: overrides.selection_border.unwrap_or(auto.selection_border),
            selection_surface: overrides.selection_surface.unwrap_or(auto.selection_surface),
            selection_glow: overrides.selection_glow.unwrap_or(auto.selection_glow),
            
            input_border: overrides.input_border.unwrap_or(auto.input_border),
            input_focus_border: overrides.input_focus_border.unwrap_or(auto.input_focus_border),
            input_background: overrides.input_background.unwrap_or(auto.input_background),
        }
    }
    
    /// 计算默认值（内部方法）
    fn compute_defaults(palette: &Palette) -> Self {
        Self {
            // Radio/Checkbox: 图标始终使用白色（在 primary 渐变背景上）
            selection_icon_color: "#ffffff".to_string(),
            
            // 选中背景: primary 渐变
            selection_background: format!(
                "linear-gradient(135deg, {}, {})",
                palette.primary.rgba(0.9),
                palette.primary.rgba(0.75)
            ),
            
            // 未选中边框: 根据主题模式
            selection_border: match palette.mode {
                ThemeMode::Light => "rgba(0, 0, 0, 0.2)".to_string(),
                ThemeMode::Dark => "rgba(255, 255, 255, 0.15)".to_string(),
            },
            
            // 未选中背景: 根据主题模式
            selection_surface: match palette.mode {
                ThemeMode::Light => palette.surface.rgba(0.7),
                ThemeMode::Dark => "rgba(30, 30, 40, 0.6)".to_string(),
            },
            
            // Glow 效果
            selection_glow: palette.button_glow_color(&palette.primary),
            
            // Input 颜色...
            input_border: match palette.mode {
                ThemeMode::Light => "rgba(0, 0, 0, 0.15)".to_string(),
                ThemeMode::Dark => "rgba(255, 255, 255, 0.1)".to_string(),
            },
            input_focus_border: palette.primary.hex(),
            input_background: palette.surface.rgba(0.7),
        }
    }
}
```

### ThemeProvider Props 扩展
```rust
// packages/components/src/theme_provider.rs

#[derive(Clone, Props, PartialEq)]
pub struct ThemeProviderProps {
    // ... 现有 props ...
    
    /// Layer 2: 组件颜色覆盖（可选）
    /// 只需要指定要覆盖的字段，其他保持自动计算
    #[props(default)]
    pub component_overrides: ComponentOverrides,
}
```

### 使用示例
```rust
// 只覆盖单选框图标色，其他保持自动
rsx! {
    ThemeProvider {
        palette: "tairitsu",
        component_overrides: ComponentOverrides {
            selection_icon_color: Some("#FFD700".to_string()), // 金色图标
            ..Default::default()
        },
        
        // 其他组件颜色保持自动计算
        App { }
    }
}
```

### 输出 CSS 变量
```css
/* Layer 2 变量 (新增，命名空间 --hi-component) */

/* Radio/Checkbox */
--hi-component-selection-icon: #ffffff;
--hi-component-selection-bg: linear-gradient(135deg, rgba(20, 74, 116, 0.9), rgba(20, 74, 116, 0.75));
--hi-component-selection-border: rgba(255, 255, 255, 0.15);
--hi-component-selection-surface: rgba(30, 30, 40, 0.6);
--hi-component-selection-glow: rgba(255, 255, 255, 0.7);

/* Input */
--hi-component-input-border: rgba(255, 255, 255, 0.1);
--hi-component-input-focus-border: #144A74;
--hi-component-input-bg: rgba(74, 66, 102, 0.7);
```

### 组件样式更新
```scss
// packages/components/src/styles/components/radio.scss

.hi-radio-dot {
    // 使用 Layer 2 变量
    background: var(--hi-component-selection-bg);
}

.hi-radio-dot::after {
    // 图标色
    color: var(--hi-component-selection-icon);
}

.hi-radio-indicator {
    background: var(--hi-component-selection-surface);
    border-color: var(--hi-component-selection-border);
}

// 移除现有的 [data-theme="tairitsu"] 硬编码覆盖
```

---

## Layer 3: 样式/动画管理层

### 职责
提供额外的样式类和动画控制，支持客制化组件样式。

### 新增 Context

#### AnimationProvider
```rust
// packages/theme/src/animation.rs (新文件)

/// 动画配置
#[derive(Clone, PartialEq)]
pub struct AnimationConfig {
    /// 是否启用动画
    pub enabled: bool,
    
    /// 全局动画时长缩放因子 (1.0 = 正常, 0.5 = 快两倍)
    pub duration_scale: f32,
    
    /// 减少动画模式 (prefers-reduced-motion)
    pub reduced_motion: bool,
    
    /// 自定义缓动函数
    pub custom_easing: Option<String>,
}

/// 动画 Context
#[derive(Clone)]
pub struct AnimationContext {
    pub config: AnimationConfig,
    pub set_config: Callback<AnimationConfig>,
}

/// AnimationProvider 组件
#[component]
pub fn AnimationProvider(
    /// 是否启用动画 (默认: true)
    enabled: Option<bool>,
    
    /// 时长缩放因子 (默认: 1.0)
    duration_scale: Option<f32>,
    
    /// 遵循系统 prefers-reduced-motion (默认: true)
    respect_reduced_motion: Option<bool>,
    
    children: Element,
) -> Element {
    // 1. 读取系统 prefers-reduced-motion
    // 2. 合并用户配置
    // 3. 提供 AnimationContext
    // 4. 注入 CSS 变量: --hi-animation-duration-scale, --hi-animation-enabled
}

/// Hook: 获取动画配置
pub fn use_animation() -> AnimationContext {
    use_context()
}
```

#### StyleProvider
```rust
// packages/theme/src/style_provider.rs (新文件)

/// 样式配置
#[derive(Clone, PartialEq)]
pub struct StyleConfig {
    /// 自定义 CSS 类前缀
    pub class_prefix: String,
    
    /// 额外的全局 CSS 类
    pub extra_classes: Vec<String>,
    
    /// 组件样式覆盖 (组件名 -> CSS 类)
    pub component_overrides: HashMap<String, String>,
}

/// 样式 Context
#[derive(Clone)]
pub struct StyleContext {
    pub config: StyleConfig,
    pub set_config: Callback<StyleConfig>,
}

/// StyleProvider 组件
#[component]
pub fn StyleProvider(
    class_prefix: Option<String>,
    extra_classes: Option<Vec<String>>,
    component_overrides: Option<HashMap<String, String>>,
    children: Element,
) -> Element {
    // 提供 StyleContext
}

/// Hook: 获取样式配置
pub fn use_style() -> StyleContext {
    use_context()
}

/// Hook: 获取组件的完整类名 (基础类 + 覆盖类)
pub fn use_component_class(component_name: &str, base_class: &str) -> String {
    let style = use_style();
    let mut classes = vec![base_class.to_string()];
    
    if let Some(override_class) = style.config.component_overrides.get(component_name) {
        classes.push(override_class.clone());
    }
    
    classes.join(" ")
}
```

### 输出 CSS 变量
```css
/* Layer 3 变量 */
--hi-animation-enabled: 1;
--hi-animation-duration-scale: 1;
--hi-style-class-prefix: hi;
```

---

## 文件变更清单

### 新增文件
| 文件路径 | 说明 |
|---------|------|
| `packages/animation/src/provider.rs` | AnimationProvider 组件 |
| `packages/animation/src/prefers_reduced_motion.rs` | prefers-reduced-motion 检测 |
| `packages/theme/src/style_provider.rs` | StyleProvider 实现 |

### 修改文件
| 文件路径 | 变更内容 |
|---------|----------|
| `packages/components/src/theme_provider.rs` | 添加 `ComponentPalette`、`ComponentOverrides`，修改 `ThemePalette.css_variables()` |
| `packages/palette/src/themes.rs` | 添加辅助方法（可选） |
| `packages/components/src/styles/components/radio.scss` | 使用 Layer 2 变量，移除硬编码暗黑模式样式 |
| `packages/components/src/styles/components/checkbox.scss` | 使用 Layer 2 变量，移除硬编码暗黑模式样式 |
| `packages/theme/src/lib.rs` | 导出 StyleProvider |
| `packages/animation/src/lib.rs` | 导出 AnimationProvider, use_animation_config |
| `packages/animation/src/hooks.rs` | 修改 hooks 以支持全局配置（如自动应用 duration_scale） |

---

## 实施步骤

### Phase 1: 修复当前问题 (优先)
1. 在 `ThemePalette` 中添加 `selection_icon_color` 字段
2. 修改 `radio.scss` / `checkbox.scss` 使用新变量
3. 确保暗黑模式下图标为白色

### Phase 2: Layer 2 完整实现
1. 创建 `ComponentPalette` 结构
2. 实现所有组件颜色的自动派生逻辑
3. 更新 CSS 变量生成
4. 更新所有组件样式

### Phase 3: Layer 3 实现
1. 实现 `AnimationProvider`
2. 实现 `StyleProvider`
3. 提供相关 hooks
4. 文档和示例

---

## 使用示例

### 完整三层层级使用
```rust
use hikari_components::{ThemeProvider, StyleProvider};
use hikari_animation::AnimationProvider;

rsx! {
    // Layer 1: 基础主题
    ThemeProvider { 
        palette: "tairitsu",
        component_overrides: ComponentOverrides {
            // 可选：只覆盖特定组件颜色
            selection_icon_color: Some("#FFD700".to_string()),
            ..Default::default()
        },
        
        // Layer 3: 动画配置 (在 hikari-animation 中)
        AnimationProvider {
            duration_scale: 0.8,  // 动画快 20%
            respect_reduced_motion: true,  // 尊重系统设置
            
            // Layer 3: 样式配置
            StyleProvider {
                extra_classes: vec!["custom-theme".to_string()],
                
                // 应用内容
                App { }
            }
        }
    }
}
```

### 组件中使用
```rust
use hikari_components::{use_theme, use_component_class};
use hikari_animation::{use_animation_config, use_tween};

fn MyRadio() -> Element {
    // Layer 2 颜色自动可用（CSS 变量）
    
    // Layer 3: 获取动画配置
    let animation = use_animation_config();
    let enabled = animation.config.read().enabled;
    let duration_scale = animation.config.read().duration_scale;
    
    // Layer 3: 使用动画（自动应用 duration_scale）
    let mut tween = use_tween();
    
    // Layer 3: 获取样式类
    let class = use_component_class("radio", "hi-radio-label");
    
    rsx! {
        label {
            class: "{class}",
            // ...
        }
    }
}
```

### 仅使用动画配置（无 ThemeProvider）
```rust
use hikari_animation::{AnimationProvider, use_animation_config, presets::*};

rsx! {
    // AnimationProvider 可以独立使用
    AnimationProvider {
        duration_scale: 0.5,  // 所有动画快 2 倍
        
        MyAnimatedApp { }
    }
}

fn MyAnimatedApp() -> Element {
    let config = use_animation_config();
    
    // 使用预设动画
    let fade = fade_in(300);
    
    rsx! {
        div {
            // 根据配置决定是否播放动画
            opacity: if config.enabled { 0.0 } else { 1.0 },
            // ...
        }
    }
}
```

---

## 向后兼容

1. **Layer 1**: 完全向后兼容，`Palette` 结构不变
2. **Layer 2**: 自动生成，无需用户配置
3. **Layer 3**: 可选使用，不使用时使用默认配置
4. **CSS 变量**: 现有变量保持不变，新增 `--hi-component-*` 命名空间

---

## 决策记录

| 问题 | 决策 | 说明 |
|-----|------|------|
| Layer2 颜色生成方式 | 自动计算 | 由 Palette 派生，用户可部分覆盖 |
| Layer3 组织方式 | 全局 Context | AnimationProvider + StyleProvider |
| ComponentPalette 覆盖 | 支持 | 通过 ComponentOverrides 部分覆盖 |
| AnimationProvider 位置 | hikari-animation | 复用现有动画能力，职责清晰 |
| GSAP 集成 | 不需要 | hikari-animation 已有完整能力 |

---

## AnimationProvider 方案对比

### 背景

**已有 `hikari-animation` 包提供的能力**：
- AnimationBuilder（流式 API）
- Timeline 控制
- 30+ 缓动函数
- Presets（fade, slide, zoom, rotate, bounce, shake）
- Glow 组件（鼠标跟随发光）
- hooks：use_tween, use_transition, use_animation_frame, use_timeout, use_interval
- AnimationState（状态机）
- GlobalAnimationManager（简化版）

**缺少的部分**：
- 全局配置（reduced_motion, duration_scale, enabled）
- prefers-reduced-motion 自动检测
- 与 ThemeProvider 的集成点

---

### 方案 A: 在 hikari-animation 中添加 AnimationProvider

#### 架构
```rust
// packages/animation/src/provider.rs (新增)

/// 全局动画配置
#[derive(Clone, PartialEq)]
pub struct AnimationConfig {
    /// 是否启用动画
    pub enabled: bool,
    
    /// 全局动画时长缩放因子 (1.0 = 正常, 0.5 = 快两倍)
    pub duration_scale: f32,
    
    /// 是否处于减少动画模式
    pub reduced_motion: bool,
}

/// 动画 Context
#[derive(Clone)]
pub struct AnimationContext {
    pub config: Signal<AnimationConfig>,
    pub set_config: Callback<AnimationConfig>,
}

/// AnimationProvider 组件
#[component]
pub fn AnimationProvider(
    /// 是否启用动画 (默认: true)
    enabled: Option<bool>,
    
    /// 时长缩放因子 (默认: 1.0)
    duration_scale: Option<f32>,
    
    /// 遵循系统 prefers-reduced-motion (默认: true)
    respect_reduced_motion: Option<bool>,
    
    children: Element,
) -> Element {
    // 1. 自动检测 prefers-reduced-motion
    // 2. 合并用户配置
    // 3. 提供 AnimationContext
    // 4. 注入 CSS 变量
}

/// Hook: 获取动画配置
pub fn use_animation_config() -> AnimationContext {
    use_context()
}
```

#### 优点
| 优点 | 说明 |
|-----|------|
| **职责清晰** | 动画配置与动画能力同包管理 |
| **现有能力复用** | 直接使用现有的 hooks 和 engine |
| **独立使用** | 可以不依赖 ThemeProvider 单独使用 |
| **CSS 变量** | 注入 `--hi-animation-*` 供 CSS 使用 |

#### 缺点
| 缺点 | 说明 |
|-----|------|
| **包耦合** | hikari-animation 需要依赖 dioxus |
| **多层 Provider** | 需要同时使用 ThemeProvider + AnimationProvider |

#### 使用示例
```rust
use hikari_animation::AnimationProvider;
use hikari_components::ThemeProvider;

rsx! {
    ThemeProvider { palette: "tairitsu",
        AnimationProvider {
            duration_scale: 0.8,
            respect_reduced_motion: true,
            
            App { }
        }
    }
}

// 组件中使用
fn MyButton() -> Element {
    let animation = use_animation_config();
    
    // 读取配置
    let duration = 200.0 * animation.config.read().duration_scale;
    let enabled = animation.config.read().enabled;
    
    // 使用现有的 hikari-animation hooks
    let mut tween = use_tween();
    
    rsx! { ... }
}
```

---

### 方案 B: 集成到 ThemeProvider

#### 架构
```rust
// packages/components/src/theme_provider.rs (扩展)

#[derive(Clone, Props, PartialEq)]
pub struct ThemeProviderProps {
    // ... 现有 props ...
    
    /// 动画配置（可选）
    #[props(default)]
    pub animation_enabled: bool,
    
    #[props(default = 1.0)]
    pub animation_duration_scale: f32,
    
    #[props(default = true)]
    pub animation_respect_reduced_motion: bool,
}

// ThemeContext 扩展
pub struct ThemeContext {
    // ... 现有字段 ...
    
    /// 动画配置
    pub animation: AnimationConfig,
}
```

#### 优点
| 优点 | 说明 |
|-----|------|
| **单一 Provider** | 只需要 ThemeProvider，减少嵌套 |
| **配置集中** | 主题和动画配置在同一处 |
| **更少导入** | 不需要额外导入 AnimationProvider |

#### 缺点
| 缺点 | 说明 |
|-----|------|
| **职责混合** | ThemeProvider 承担了动画配置职责 |
| **包依赖** | hikari-components 需要依赖 hikari-animation |
| **不够灵活** | 无法独立使用动画配置 |

#### 使用示例
```rust
use hikari_components::ThemeProvider;

rsx! {
    ThemeProvider {
        palette: "tairitsu",
        animation_duration_scale: 0.8,
        animation_respect_reduced_motion: true,
        
        App { }
    }
}

// 组件中使用
fn MyButton() -> Element {
    let theme = use_theme();
    let animation = &theme.animation;
    
    let duration = 200.0 * animation.duration_scale;
    
    rsx! { ... }
}
```

---

### 方案 C: 独立全局配置（无 Provider）

#### 架构
```rust
// packages/animation/src/config.rs (新增)

use std::sync::RwLock;

/// 全局动画配置（静态存储）
static ANIMATION_CONFIG: RwLock<AnimationConfig> = RwLock::new(AnimationConfig::default());

/// 获取全局动画配置
pub fn get_animation_config() -> AnimationConfig {
    ANIMATION_CONFIG.read().unwrap().clone()
}

/// 设置全局动画配置
pub fn set_animation_config(config: AnimationConfig) {
    *ANIMATION_CONFIG.write().unwrap() = config;
}

/// 初始化（检测 prefers-reduced-motion）
pub fn init_animation_config() {
    let reduced = detect_prefers_reduced_motion();
    let mut config = ANIMATION_CONFIG.write().unwrap();
    config.reduced_motion = reduced;
}

/// Hook: 获取配置响应式
pub fn use_animation_config() -> AnimationConfig {
    // 使用 use_signal 实现响应式
}
```

#### 优点
| 优点 | 说明 |
|-----|------|
| **最简单** | 无需 Provider，直接使用 |
| **零嵌套** | 不增加组件树层级 |
| **全局生效** | 一次设置，全局生效 |

#### 缺点
| 缺点 | 说明 |
|-----|------|
| **不够响应式** | 全局静态配置，难以动态切换 |
| **无法嵌套覆盖** | 不支持局部覆盖配置 |
| **测试困难** | 全局状态难以隔离测试 |

#### 使用示例
```rust
// 初始化（应用启动时）
use hikari_animation::{init_animation_config, set_animation_config, AnimationConfig};

fn main() {
    init_animation_config();
    
    // 可选：自定义配置
    set_animation_config(AnimationConfig {
        duration_scale: 0.8,
        ..Default::default()
    });
}

// 组件中使用
fn MyButton() -> Element {
    let config = use_animation_config();
    let duration = 200.0 * config.duration_scale;
    
    rsx! { ... }
}
```

---

### 对比总结

| 维度 | 方案 A (独立 Provider) | 方案 B (集成到 ThemeProvider) | 方案 C (全局配置) |
|-----|----------------------|------------------------------|------------------|
| **复杂度** | 中 | 低 | 最低 |
| **嵌套层级** | +1 | 0 | 0 |
| **响应式** | 完整 | 完整 | 部分 |
| **局部覆盖** | 支持 | 支持 | 不支持 |
| **独立性** | 高 | 低 | 最高 |
| **测试友好** | 高 | 高 | 低 |
| **包依赖** | animation → dioxus | components → animation | 无额外依赖 |

---

### 推荐方案：方案 A（已确认）

> **决策**: 在 `hikari-animation` 中添加 AnimationProvider

#### 理由
1. **职责分离**：动画配置与动画能力在同一包，符合模块化原则
2. **复用现有能力**：直接利用现有的 hooks（use_tween, use_transition 等）
3. **灵活性**：可以独立使用，也可以与 ThemeProvider 配合
4. **响应式完整**：支持动态切换和局部覆盖
5. **向后兼容**：不修改现有 ThemeProvider，只新增 AnimationProvider

---

#### 详细设计

##### 1. AnimationConfig 配置结构

```rust
// packages/animation/src/config.rs

/// 全局动画配置
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct AnimationConfig {
    /// 是否启用动画（默认: true）
    pub enabled: bool,
    
    /// 全局动画时长缩放因子
    /// - 1.0 = 正常速度
    /// - 0.5 = 快两倍
    /// - 2.0 = 慢两倍
    /// - 0.0 = 禁用所有动画（等同于 enabled = false）
    pub duration_scale: f32,
    
    /// 是否处于减少动画模式
    /// 当为 true 时，应该减少或禁用非必要动画
    pub reduced_motion: bool,
}

impl Default for AnimationConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            duration_scale: 1.0,
            reduced_motion: false,
        }
    }
}

impl AnimationConfig {
    /// 应用时长缩放
    pub fn scale_duration(&self, duration_ms: u64) -> u64 {
        if !self.enabled || self.reduced_motion {
            return 0;
        }
        (duration_ms as f32 * self.duration_scale) as u64
    }
    
    /// 应用时长缩放（f64 版本）
    pub fn scale_duration_f64(&self, duration_ms: f64) -> f64 {
        if !self.enabled || self.reduced_motion {
            return 0.0;
        }
        duration_ms * self.duration_scale as f64
    }
}
```

##### 2. prefers-reduced-motion 检测

```rust
// packages/animation/src/prefers_reduced_motion.rs

/// 检测系统 prefers-reduced-motion 设置
/// 
/// # Platform Support
/// - WASM: 使用 `window.matchMedia('(prefers-reduced-motion: reduce)')`
/// - Non-WASM: 始终返回 false
#[cfg(target_arch = "wasm32")]
pub fn prefers_reduced_motion() -> bool {
    use gloo::utils::window;
    
    window()
        .match_media("(prefers-reduced-motion: reduce)")
        .ok()
        .flatten()
        .map(|mql| mql.matches())
        .unwrap_or(false)
}

#[cfg(not(target_arch = "wasm32"))]
pub fn prefers_reduced_motion() -> bool {
    false
}

/// 监听 prefers-reduced-motion 变化（可选，用于动态响应）
#[cfg(target_arch = "wasm32")]
pub fn watch_prefers_reduced_motion(callback: impl Fn(bool) + 'static) {
    use gloo::utils::window;
    use wasm_bindgen::JsCast;
    
    let media_query = window()
        .match_media("(prefers-reduced-motion: reduce)")
        .ok()
        .flatten();
    
    if let Some(mql) = media_query {
        let closure = wasm_bindgen::closure::Closure::new(move |_event: web_sys::MediaQueryListEvent| {
            callback(prefers_reduced_motion());
        });
        
        mql.set_onchange(Some(closure.as_ref().unchecked_ref()));
        closure.forget();
    }
}

#[cfg(not(target_arch = "wasm32"))]
pub fn watch_prefers_reduced_motion(_callback: impl Fn(bool) + 'static) {
    // No-op on non-WASM
}
```

##### 3. AnimationProvider 组件

```rust
// packages/animation/src/provider.rs

use dioxus::prelude::*;
use crate::config::AnimationConfig;
use crate::prefers_reduced_motion::prefers_reduced_motion;

/// 动画 Context
#[derive(Clone)]
pub struct AnimationContext {
    /// 当前配置
    pub config: Signal<AnimationConfig>,
    
    /// 更新配置的回调
    pub set_config: Callback<AnimationConfig>,
}

/// AnimationProvider Props
#[derive(Clone, Props, PartialEq)]
pub struct AnimationProviderProps {
    /// 是否启用动画（默认: true）
    #[props(default = true)]
    pub enabled: bool,
    
    /// 时长缩放因子（默认: 1.0）
    #[props(default = 1.0)]
    pub duration_scale: f32,
    
    /// 是否遵循系统 prefers-reduced-motion（默认: true）
    /// 当为 true 且系统设置为减少动画时，会自动设置 reduced_motion = true
    #[props(default = true)]
    pub respect_reduced_motion: bool,
    
    /// 强制减少动画模式（覆盖系统检测）
    #[props(default)]
    pub force_reduced_motion: Option<bool>,
    
    children: Element,
}

/// AnimationProvider 组件
///
/// 提供全局动画配置，支持：
/// - 动画开关
/// - 时长缩放
/// - prefers-reduced-motion 自动检测
/// - CSS 变量注入
///
/// # Example
///
/// ```rust
/// use hikari_animation::AnimationProvider;
///
/// rsx! {
///     AnimationProvider {
///         duration_scale: 0.8,
///         respect_reduced_motion: true,
///         
///         App { }
///     }
/// }
/// ```
#[component]
pub fn AnimationProvider(props: AnimationProviderProps) -> Element {
    // 检测系统 prefers-reduced-motion
    let system_reduced = if props.respect_reduced_motion {
        prefers_reduced_motion()
    } else {
        false
    };
    
    // 计算最终的 reduced_motion 状态
    let reduced_motion = props.force_reduced_motion.unwrap_or(system_reduced);
    
    // 创建配置
    let initial_config = AnimationConfig {
        enabled: props.enabled && !reduced_motion,
        duration_scale: if reduced_motion { 0.0 } else { props.duration_scale },
        reduced_motion,
    };
    
    let config = use_signal(|| initial_config);
    
    // 提供更新回调
    let config_for_callback = config;
    let set_config = Callback::new(move |new_config: AnimationConfig| {
        config_for_callback.set(new_config);
    });
    
    // 提供 Context
    use_context_provider(move || AnimationContext {
        config,
        set_config,
    });
    
    // 生成 CSS 变量
    let css_vars = use_memo(move || {
        let cfg = config.read();
        format!(
            "--hi-animation-enabled: {}; --hi-animation-duration-scale: {}; --hi-animation-reduced-motion: {};",
            if cfg.enabled { 1 } else { 0 },
            cfg.duration_scale,
            if cfg.reduced_motion { 1 } else { 0 }
        )
    });
    
    rsx! {
        div {
            class: "hi-animation-provider",
            style: "{css_vars}",
            {props.children}
        }
    }
}

/// Hook: 获取动画配置
///
/// # Example
///
/// ```rust
/// fn MyComponent() -> Element {
///     let animation = use_animation_config();
///     
///     let duration = animation.scale_duration(300); // 应用缩放
///     
///     rsx! { ... }
/// }
/// ```
pub fn use_animation_config() -> AnimationContext {
    use_context()
}

/// Hook: 获取当前动画配置（便捷方法）
pub fn use_animation_enabled() -> bool {
    use_animation_config().config.read().enabled
}

/// Hook: 获取当前时长缩放因子
pub fn use_animation_duration_scale() -> f32 {
    use_animation_config().config.read().duration_scale
}
```

##### 4. 修改现有 hooks

```rust
// packages/animation/src/hooks.rs (修改)

impl UseTween {
    /// 创建带全局配置的 tween
    pub fn tween_with_config(&self, mut options: AnimationOptions) -> Tween {
        // 尝试获取全局配置
        let config = try_use_animation_config();
        
        if let Some(ctx) = config {
            let cfg = ctx.config.read();
            // 应用时长缩放
            if cfg.duration_scale != 1.0 {
                options.duration = std::time::Duration::from_millis(
                    cfg.scale_duration(options.duration.as_millis() as u64)
                );
            }
            // 如果禁用动画，设置 duration 为 0
            if !cfg.enabled || cfg.reduced_motion {
                options.duration = std::time::Duration::ZERO;
            }
        }
        
        self.tween(options)
    }
}

impl UseTransition {
    /// 创建带全局配置的 transition
    pub fn with_config(duration_ms: u64) -> Self {
        let config = try_use_animation_config();
        
        let scaled_duration = if let Some(ctx) = config {
            ctx.config.read().scale_duration(duration_ms)
        } else {
            duration_ms
        };
        
        Self::new(scaled_duration)
    }
}

/// 尝试获取动画配置（如果存在）
/// 如果不在 AnimationProvider 内部，返回 None
fn try_use_animation_config() -> Option<AnimationContext> {
    use_context::<AnimationContext>().ok()
}
```

##### 5. 导出更新

```rust
// packages/animation/src/lib.rs (修改)

pub mod config;
pub mod provider;
pub mod prefers_reduced_motion;

// ... 现有导出 ...

pub use config::AnimationConfig;
pub use provider::{AnimationProvider, AnimationContext, use_animation_config, use_animation_enabled, use_animation_duration_scale};
pub use prefers_reduced_motion::{prefers_reduced_motion, watch_prefers_reduced_motion};
```

---

#### 实施步骤

| 步骤 | 文件 | 说明 |
|-----|------|------|
| 1 | `animation/src/config.rs` | 新增 AnimationConfig 结构 |
| 2 | `animation/src/prefers_reduced_motion.rs` | 新增 prefers-reduced-motion 检测 |
| 3 | `animation/src/provider.rs` | 新增 AnimationProvider 组件 |
| 4 | `animation/src/hooks.rs` | 修改现有 hooks 支持全局配置 |
| 5 | `animation/src/lib.rs` | 更新导出 |

---

## 时间估算

| Phase | 工作量 | 优先级 | 说明 |
|-------|-------|--------|------|
| **Phase 1** | 2-3 小时 | P0 | 修复单选框/复选框暗黑模式问题 |
| **Phase 2** | 4-6 小时 | P1 | 完整 Layer 2 实现（含 ComponentOverrides 支持） |
| **Phase 3.1** | 2-3 小时 | P2 | AnimationProvider（在 hikari-animation 中） |
| **Phase 3.2** | 1-2 小时 | P2 | prefers-reduced-motion 自动检测 |
| **Phase 3.3** | 2-3 小时 | P2 | 修改现有 hooks 支持全局配置 |
| **Phase 3.4** | 3-4 小时 | P2 | StyleProvider |
| **Phase 3.5** | 1-2 小时 | P3 | 文档和示例 |

**总计**: 15-23 小时
