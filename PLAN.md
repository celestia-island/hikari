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
- 国际化: I18nProvider + ReactiveI18nContext
- Markdown: pulldown-cmark + `_hikari_component`

### 当前版本 (Tairitsu)
- 框架: Tairitsu VDOM
- 路由: JavaScript History API (在 Cargo.toml 中定义)
- 渲染: 一次性渲染所有页面，CSS 控制显示
- 国际化: 待实现
- Markdown: 待实现

---

## 已完成

### Phase 1: 路由系统 ✅
- [x] JavaScript 路由逻辑（在 Cargo.toml head 中定义）
- [x] 页面切换通过 `.is-active` 类控制
- [x] 链接拦截和 pushState
- [x] 侧边栏 `.sidebar-link` 类和高亮
- [x] 抽屉切换功能

### Phase 2: 主题系统 ✅
- [x] Glow 颜色系统修复
- [x] 主题 CSS 变量生成
- [x] Hikari/Tairitsu 主题定义

### Phase 3: 页面结构 ✅
- [x] 首页 (page-home)
- [x] 组件概览 (page-components-overview)
- [x] Layer 1/2/3 页面
- [x] 系统页面 (system-overview, palette, css, icons, animations, i18n)
- [x] Demo 页面 (demos-overview, form, dashboard)
- [x] 404 页面

---

## 待实现

### Phase 4: 主题切换功能
- [ ] 添加主题切换按钮到 Header
- [ ] 实现亮色/暗色主题切换
- [ ] 保存主题偏好到 localStorage

### Phase 5: 国际化系统
- [ ] 创建翻译文件加载器
- [ ] 实现语言切换功能
- [ ] 迁移 9 种语言翻译文件

### Phase 6: Markdown 解析
- [ ] 集成 Markdown 解析库
- [ ] 实现 `_hikari_component` 代码块处理
- [ ] 创建组件注册表

### Phase 7: 组件文档迁移
- [ ] 迁移组件文档内容
- [ ] 添加代码示例
- [ ] 实现 API 文档
