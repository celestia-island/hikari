# Hikari Website 一比一复刻计划

> 目标：完全复刻 legacy 版本的功能和结构
>
> Legacy 版本位置: `/mnt/sdb1/hikari-legacy` (master 分支)
> 当前版本位置: `/mnt/sdb1/hikari` (dev 分支)

---

## Legacy 版本架构分析（已完成）

### 核心系统
1. **路由系统**: Dioxus Router，所有路由在 `app.rs` 中定义
2. **国际化**: 9种语言，TOML 格式，编译时嵌入
3. **主题系统**: ThemeProvider 组件，CSS 变量驱动
4. **Markdown 解析**: pulldown-cmark，`_hikari_component` 标记转组件示例
5. **Portal 系统**: PortalProvider 组件
6. **动画系统**: AnimationBuilder 状态机

### 页面结构
```
App
├── I18nProviderWrapper
│   ├── ThemeProvider
│   │   └── PortalProvider
│   │       └── Router
│   │           └── Layout
│   │               ├── Header
│   │               ├── Sidebar
│   │               ├── BreadcrumbNav
│   │               └── DynamicDocPage / 页面组件
```

---

## 一比一复刻任务清单

### Phase 1: 核心框架迁移
- [ ] 路由系统（Dioxus Router → Tairitsu）
- [ ] 国际化上下文（I18nProvider + ReactiveI18nContext）
- [ ] 主题上下文（ThemeProvider）
- [ ] Portal 系统（PortalProvider）

### Phase 2: 页面组件迁移
- [ ] Layout 组件
- [ ] Header 组件（包含主题切换、语言切换）
- [ ] Sidebar 组件
- [ ] BreadcrumbNav 组件
- [ ] DynamicDocPage 组件
- [ ] Container 组件

### Phase 3: Markdown 解析系统
- [ ] pulldown-cmark 解析器集成
- [ ] `_hikari_component` 代码块处理
- [ ] 组件注册表（registry.rs）
- [ ] 动态组件渲染

### Phase 4: 翻译文件迁移
- [ ] TOML 翻译文件转换
- [ ] 9种语言支持
- [ ] 编译时嵌入

### Phase 5: 组件示例迁移
- [ ] Layer 1 组件示例
- [ ] Layer 2 组件示例
- [ ] Layer 3 组件示例
- [ ] Demo 页面

---

## 当前状态

### 已完成
- [x] Glow 颜色系统修复
- [x] 主题 CSS 变量生成
- [x] Legacy 版本架构分析

### 进行中
- [ ] 核心框架迁移

### 待开始
- [ ] Markdown 解析系统
- [ ] 组件示例迁移
