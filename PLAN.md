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
| 路由 | Dioxus Router | JavaScript History API | ⚠️ 需迁移 |
| 上下文 | `use_context_provider` | `use_context_provider` | ✅ 已适配 |

### 上下文系统
| 上下文 | Legacy 实现 | 当前实现 | 状态 |
|--------|-------------|----------|------|
| I18nProvider | ReactiveI18nContext + Signal | 简化版 JavaScript | ❌ 需完整迁移 |
| ThemeProvider | 完整的 Palette 覆盖 | 基础切换 | ❌ 需完整迁移 |
| PortalProvider | Portal 入口管理 | 未实现 | ❌ 需实现 |
| AnimationBuilder | 状态机 + 预设 | 未实现 | ❌ 需实现 |

---

## 一比一复刻任务清单

### Phase A: 上下文系统迁移

#### A1. I18nProvider 完整迁移
- [ ] 从 legacy 版本复制 `I18nProviderWrapper`
- [ ] 迁移 `ReactiveI18nContext` 结构
- [ ] 迁移 `LanguageContext` 和 `use_language` hook
- [ ] 支持 9 种语言（en-US, zh-CHS, zh-CHT, ja-JP, ko-KR, fr-FR, es-ES, ru-RU, ar-SA）
- [ ] 迁移 TOML 翻译文件加载器
- [ ] 实现语言切换时的内容动态更新

#### A2. ThemeProvider 完整迁移
- [ ] 从 legacy 版本复制 `ThemeProvider` 组件
- [ ] 迁移完整的 Palette 覆盖系统
- [ ] 支持嵌套 ThemeProvider
- [ ] 实现主题切换时的 CSS 变量动态更新
- [ ] 支持 RTL/LTR 布局方向

#### A3. PortalProvider 迁移
- [ ] 从 legacy 版本复制 `PortalProvider`
- [ ] 迁移 `PortalEntry` 组件
- [ ] 实现 Modal/Popover/Drawer 的 Portal 渲染
- [ ] 迁移定位策略系统

#### A4. AnimationBuilder 迁移
- [ ] 从 legacy 版本复制 `AnimationBuilder`
- [ ] 迁移状态机实现
- [ ] 迁移预设动画（pulse, breathe, shimmer）
- [ ] 实现动画控制 API

### Phase B: 页面系统迁移

#### B1. Layout 组件迁移
- [ ] 从 legacy 版本复制 `Layout` 组件
- [ ] 迁移 `HikariLayout` 结构
- [ ] 确保响应式断点一致

#### B2. Header 组件迁移
- [ ] 从 legacy 版本复制完整 Header
- [ ] 确保主题切换按钮位置一致
- [ ] 确保语言切换按钮位置一致
- [ ] 迁移所有交互逻辑

#### B3. Sidebar 组件迁移
- [ ] 从 legacy 版本复制 Sidebar 组件
- [ ] 确保菜单结构一致
- [ ] 确保高亮逻辑一致

#### B4. BreadcrumbNav 迁移
- [ ] 从 legacy 版本复制 BreadcrumbNav
- [ ] 确保路径显示一致

### Phase C: Markdown 解析系统

#### C1. MarkdownRenderer 迁移
- [ ] 从 legacy 版本复制 `markdown_renderer.rs`
- [ ] 确保 pulldown-cmark 集成
- [ ] 确保所有 Markdown 元素正确渲染

#### C2. DynamicDocPage 迁移
- [ ] 从 legacy 版本复制 `DynamicDocPage`
- [ ] 实现异步 Markdown 加载
- [ ] 支持多语言文档路径

#### C3. 组件注册表迁移
- [ ] 从 legacy 版本复制 `registry.rs`
- [ ] 确保所有组件示例正确渲染
- [ ] 支持响应式状态（如 Switch 示例）

### Phase D: 文档内容迁移

#### D1. 迁移组件文档
- [ ] 迁移所有 Layer 1 组件文档
- [ ] 迁移所有 Layer 2 组件文档
- [ ] 迁移所有 Layer 3 组件文档

#### D2. 迁移系统文档
- [ ] 迁移 CSS 文档
- [ ] 迁移 Icons 文档
- [ ] 迁移 Animations 文档
- [ ] 迁移 i18n 文档

#### D3. 迁移翻译文件
- [ ] 从 legacy 版本复制所有 TOML 文件
- [ ] 确保所有 9 种语言的翻译完整

---

## 当前状态

### 已完成 ✅
- Glow 颜色系统修复
- 主题 CSS 变量生成
- 基础路由系统
- 简化版主题切换
- 简化版语言切换

### 进行中 ⚠️
- Legacy 版本结构分析

### 待开始 ⏳
- Phase A: 上下文系统迁移
- Phase B: 页面系统迁移
- Phase C: Markdown 解析迁移
- Phase D: 文档内容迁移
