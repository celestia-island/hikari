# Hikari Website 一比一复刻计划

> 目标：完全复刻 legacy 版本的功能和结构
>
> Legacy 版本位置: `/mnt/sdb1/hikari-legacy` (master 分支)
> 当前版本位置: `/mnt/sdb1/hikari` (dev 分支)

---

## 架构对比

### Legacy 版本 (Dioxus)
- 框架: Dioxus
- 路由: Dioxus Router (Rust 端)
- 渲染: 条件渲染单个页面
- 国际化: I18nProvider + ReactiveI18nContext (9种语言)
- Markdown: pulldown-cmark + `_hikari_component`

### 当前版本 (Tairitsu)
- 框架: Tairitsu VDOM
- 路由: JavaScript History API (在 Cargo.toml 中定义)
- 渲染: 一次性渲染所有页面，CSS 控制显示
- 国际化: JavaScript 语言切换 (2种语言)
- Markdown: 待实现

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

### Phase 3: 主题系统
- [x] Glow 颜色系统修复
- [x] 主题 CSS 变量生成
- [x] Hikari/Tairitsu 主题定义
- [x] 主题切换按钮
- [x] localStorage 持久化

### Phase 4: 国际化
- [x] 语言切换按钮
- [x] 英语/中文简体切换
- [x] localStorage 持久化
- [x] 浏览器语言自动检测

---

## 待实现

### Phase 5: Markdown 解析
- [ ] 集成 Markdown 解析库
- [ ] 实现 `_hikari_component` 代码块处理
- [ ] 创建组件注册表

### Phase 6: 翻译文件
- [ ] 迁移 9种语言翻译文件
- [ ] 实现动态内容翻译

### Phase 7: 组件文档
- [ ] 迁移组件文档内容
- [ ] 添加代码示例
- [ ] 实现 API 文档
