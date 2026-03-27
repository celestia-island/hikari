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
