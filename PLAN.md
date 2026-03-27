# Hikari Website 一比一复刻计划

> 目标：完全复刻 legacy 版本的功能和结构
>
> Legacy 版本位置: `/mnt/sdb1/hikari-legacy` (Dioxus 框架)
> 当前版本位置: `/mnt/sdb1/hikari` (Tairitsu 框架)

---

## 核心差异分析

### 框架层
| 特性 | Legacy (Dioxus) | 当前 (Tairitsu) | 状态 |
|------|-----------------|-----------------|------|
| VDOM | Dioxus VirtualDom | Tairitsu VNode | ✅ 已适配 |
| 组件 | `rsx! {}` | `rsx! {}` | ✅ 已适配 |
| 路由 | Dioxus Router | JavaScript History API | ✅ 已实现 |
| 上下文 | `use_context_provider` | `use_context_provider` | ✅ 已适配 |

### 上下文系统
| 上下文 | Legacy 实现 | 当前实现 | 状态 |
|--------|-------------|----------|------|
| I18nProvider | ReactiveI18nContext + Signal | JavaScript 动态加载 | ✅ 已实现 |
| ThemeProvider | 完整的 Palette 覆盖 | 主题切换 + CSS 变量 | ✅ 已实现 |
| PortalProvider | Portal 入口管理 | Portal 组件系统 | ✅ 已实现 |
| AnimationBuilder | 状态机 + 预设 | 动画集成系统 | ✅ 已实现 |

---

## 已完成 ✅

### Phase 1: 核心框架
- [x] 路由系统（JavaScript History API）
- [x] 页面切换（.is-active 类）
- [x] 链接拦截和 pushState
- [x] 抽屉切换功能

### Phase 2: 页面结构
- [x] 首页 (page-home)
- [x] 组件概览 (page-components-overview)
- [x] Layer 1/2/3 页面
- [x] 系统页面 (system-overview, palette, css, icons, animations, i18n)
- [x] Demo 页面 (demos-overview, form, dashboard)
- [x] 404 页面
- [x] 动画示例页面
- [x] 交互示例页面

### Phase 3: 主题系统
- [x] Glow 颜色系统修复
- [x] 主题 CSS 变量生成
- [x] Hikari/Tairitsu 主题定义
- [x] 主题切换按钮
- [x] localStorage 持久化

### Phase 4: 国际化
- [x] 语言切换按钮
- [x] 9种语言支持 (en-US, zh-CHS, zh-CHT, ja-JP, ko-KR, fr-FR, es-ES, ru-RU, ar-SA)
- [x] localStorage 持久化
- [x] 浏览器语言自动检测
- [x] RTL 支持 (ar-SA)

### Phase 5: Markdown 解析
- [x] 集成 pulldown-cmark 解析库
- [x] 实现 `_hikari_component` 代码块处理
- [x] 创建组件注册表
- [x] 支持 Markdown 元素渲染（标题、段落、列表、表格等）

### Phase 6: 翻译文件
- [x] 迁移 9种语言翻译文件
- [x] 实现动态内容翻译系统
- [x] JavaScript 翻译 API

### Phase 7: 组件文档
- [x] 迁移所有组件文档内容
- [x] 所有 9 种语言的完整文档
- [x] input.md 翻译到所有语言

### Phase 8: PortalProvider 系统
- [x] PortalProvider 组件实现
- [x] Portal 入口管理
- [x] Modal/Drawer/Dropdown/Toast/Tooltip 示例
- [x] JavaScript Bridge 集成

### Phase 9: 动画集成
- [x] AnimationBuilder 与组件集成
- [x] Hover/Focus/Press 动画预设
- [x] 动画示例页面
- [x] CSS 变量动画支持

### Phase 10: 响应式状态管理
- [x] 交互式组件状态管理
- [x] Switch/Button/Input 示例
- [x] localStorage 状态持久化
- [x] _interactive Markdown 语法

### Phase 11: 动态文档加载
- [x] 客户端路由系统
- [x] 动态 Markdown 加载
- [x] 语言感知文档路径
- [x] 加载/错误状态处理

---

## 验证状态

- ✅ 编译成功（无错误）
- ✅ E2E 测试通过（12/12）
- ✅ 所有核心功能实现
- ✅ 与 legacy 版本功能对等

---

## 计划中 📋

### Phase 12: CSS 值类型系统集成

> **背景**: tairitsu 框架已实现类型安全的 CSS 值系统（`tairitsu-css-values`），需要集成到 hikari-components。

#### tairitsu-css-values 功能概览

```rust
use tairitsu_css_values::CssLength;

// 构造方法
let px = CssLength::px(100);           // 100px
let pct = CssLength::percent(50);      // 50%
let rem = CssLength::rem(1.5);         // 1.5rem
let vw = CssLength::vw(100);            // 100vw
let vh = CssLength::vh(100);            // 100vh

// calc 表达式
let calc = CssLength::calc(
    CssExpression::Binary {
        left: Box::new(CssExpression::Value(CssLength::percent(100))),
        op: CssBinOp::Sub,
        right: Box::new(CssExpression::Value(CssLength::px(40))),
    }
);  // calc(100% - 40px)

// min/max/clamp 函数
let min_val = CssLength::min(vec![
    CssLength::px(200),
    CssLength::percent(50)
]);  // min(200px, 50%)

// 转换为 CSS 字符串
assert_eq!(px.to_css_string(), "100px");
assert_eq!(calc.to_css_string(), "calc(100% - 40px)");
```

#### tairitsu-style 集成

```rust
use tairitsu_style::{CssProperty, StyleBuilder};
use tairitsu_css_values::CssLength;

// 使用 add_length 方法（需要 css-values feature）
let style = StyleBuilder::new()
    .add_length(CssProperty::Width, CssLength::px(100))
    .add_length(CssProperty::Height, CssLength::vh(100))
    .add_length(CssProperty::MaxWidth, CssLength::calc(...))
    .to_vdom_style();
```

#### 适配计划

##### Phase 12.1: 添加依赖

```toml
# packages/components/Cargo.toml
[dependencies]
tairitsu-style = { path = "../../../tairitsu/packages/style", features = ["css-values"] }
tairitsu-css-values = { path = "../../../tairitsu/packages/css-values" }
```

##### Phase 12.2: 更新 style_builder.rs

```rust
// packages/components/src/style_builder.rs
pub use tairitsu_style::{CssProperty, Property, StyleStringBuilder, StyleBuilder};
pub use tairitsu_css_values::{CssLength, CssExpression, CssBinOp};

// 保留现有别名
pub type StyleBuilder = StyleStringBuilder;
```

##### Phase 12.3: 更新 styled.rs 模块

```rust
// 添加 CSS 值类型的便捷导入
pub use tairitsu_css_values::{CssLength, CssExpression, CssBinOp};
```

##### Phase 12.4: 更新组件使用模式

**当前模式（字符串）:**
```rust
StyleStringBuilder::new()
    .add_var("glow-x", "50%")
    .add_var("glow-y", "50%")
    .build()
```

**改进后（类型安全）:**
```rust
use tairitsu_css_values::CssLength;
use tairitsu_style::CssProperty;

StyleStringBuilder::new()
    .add_length(CssProperty::Custom("--glow-x".to_string()), CssLength::percent(50))
    .add_length(CssProperty::Custom("--glow-y".to_string()), CssLength::percent(50))
    .build()
```

**向后兼容（保留字符串支持）:**
```rust
// 字符串参数继续有效
StyleStringBuilder::new()
    .add_var("glow-x", "50%")
    .build()

// 新增类型安全方法
StyleStringBuilder::new()
    .add_var_with_length("glow-x", CssLength::percent(50))
    .build()
```

##### Phase 12.5: 组件迁移优先级

**高优先级（频繁使用样式构建）:**
- [x] `feedback/glow.rs` - 大量 CSS 变量设置
- [ ] `basic/button.rs` - 动态样式
- [ ] `basic/input.rs` - 输入框样式
- [ ] `feedback/modal.rs` - 动画位置计算

**中优先级（使用 add_var 等）:**
- [ ] `portal/provider.rs` - Portal 位置
- [ ] `feedback/popover.rs` - 弹出位置
- [ ] `navigation/anchor.rs` - 锚点滚动

**低优先级（主要使用静态类）:**
- [ ] 其他组件（主要使用 ClassesBuilder + CSS 类）

##### Phase 12.6: 新增便捷方法

```rust
// 在 StyleStringBuilder 上添加便捷方法
impl StyleStringBuilder {
    /// 添加 CSS 变量，使用 CssLength 值
    pub fn add_var_with_length(mut self, name: &str, length: CssLength) -> Self {
        self.add_var(name, &length.to_css_string())
    }

    /// 添加 calc 表达式
    pub fn add_calc(mut self, property: CssProperty, expr: CssExpression) -> Self {
        self.add_length(property, CssLength::calc(expr))
    }
}
```

##### Phase 12.7: 文档更新

- [ ] 更新组件开发指南
- [ ] 添加 CSS 值类型使用示例
- [ ] 创建迁移指南

#### 预期收益

- **类型安全**: 编译期验证 CSS 值
- **重构友好**: IDE 支持重命名和查找引用
- **零成本抽象**: 无运行时开销
- **渐进式迁移**: 字符串参数继续工作
