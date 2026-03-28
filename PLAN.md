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

## 验证状态

- ✅ 编译成功（无错误）
- ✅ E2E 测试通过（12/12）
- ✅ 代码风格检查通过（fmt + clippy）
- ✅ 所有核心功能实现
- ✅ 与 legacy 版本功能对等
