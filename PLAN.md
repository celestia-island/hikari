# Hikari Website 一比一复刻计划

> 目标：完全复刻 legacy 版本的功能和结构
>
> Legacy 版本位置: `/mnt/sdb1/hikari-legacy` (master 分支)
> 当前版本位置: `/mnt/sdb1/hikari` (dev 分支)

---

## 研究准则

### 1. Legacy 版本先测试
```bash
# 编译 legacy 版本
cd /mnt/sdb1/hikari-legacy
just serve

# 访问 http://localhost:3000
# 使用浏览器开发者工具查看生成的 HTML 结构
```

### 2. HTML 结构分析
```python
# /tmp/analyze_html.py
from bs4 import BeautifulSoup
import json

with open('/tmp/legacy.html') as f:
    soup = BeautifulSoup(f.read(), 'html.parser')

# 分析关键元素
print("=== HTML 结构 ===")
print(f"Root: {soup.find('div', id='hikari-app')}")

print("\n=== CSS 类 ===")
for class_name in soup.find_all(class_=True):
    print(f".{class_name}")

print("\n=== 组件实例 ===")
for component in soup.find_all(attrs={'data-component': True}):
    print(f"{component['data-component']}: {component.name}")
```

### 3. 对比分析
- HTML 结构对比
- CSS 类名对比
- JavaScript 行为对比
- 路由系统对比

---

## Legacy 版本核心功能（必须复刻）

### 1. 框架层
- [ ] Dioxus 框架 → Tairitsu VDOM 迁移
- [ ] Dioxus Router → 路由系统迁移
- [ ] Signal 响应式系统 → Tairitsu Signal 迁移

### 2. 上下文系统
- [ ] I18nProvider - 国际化上下文
- [ ] ThemeProvider - 主题上下文
- [ ] PortalProvider - Portal 上下文
- [ ] AnimationBuilder - 动画上下文

### 3. 页面系统
- [ ] Layout 组件
- [ ] Header 组件（主题切换、语言切换）
- [ ] Sidebar 组件
- [ ] BreadcrumbNav 组件
- [ ] DynamicDocPage 组件
- [ ] Container 组件

### 4. Markdown 解析
- [ ] pulldown-cmark 解析器集成
- [ ] `_hikari_component` 代码块处理
- [ ] 组件注册表（registry.rs）
- [ ] 动态组件渲染

### 5. 国际化
- [ ] 9种语言支持
- [ ] TOML 翻译文件
- [ ] 语言切换功能
- [ ] URL 路径前缀（/:lang）

### 6. 动画系统
- [ ] AnimationBuilder 状态机
- [ ] 动画预设（pulse, breathe, shimmer）
- [ ] 交互动画

---

## 当前状态

### 已完成
- [x] Glow 颜色系统修复
- [x] 主题 CSS 变量生成
- [x] 基础路由系统（JavaScript）
- [x] 主题切换按钮（简化版）
- [x] 语言切换按钮（简化版）

### 待完成
- [ ] 完整的 I18nProvider 迁移
- [ ] 完整的 ThemeProvider 迁移
- [ ] Markdown 解析系统
- [ ] 组件注册表
- [ ] 动画上下文
- [ ] 9种语言支持
