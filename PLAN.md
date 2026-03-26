# Hikari 组件库迁移计划

> Legacy (Dioxus) → Current (Tairitsu) 实际效果差距分析与修复方案
>
> Legacy 版本位置: `/mnt/sdb1/hikari-legacy` (master 分支)
> 当前版本位置: `/mnt/sdb1/hikari` (dev 分支)

---

## 执行摘要

本计划已全部完成。所有 Phase (1-7) 的任务均已实现并通过测试。

---

## 已完成的修复

### Phase 1: Glow 组件核心修复 ✅

- 添加 CSS hover fallback (`:hover` 和 `:active` 状态)
- 添加 Glow Blur Levels 样式 (light/medium/heavy)
- 确保 glow 效果即使 JS 事件失败也能显示

**修改文件**:
- `packages/components/src/styles/components/glow.scss`

### Phase 2: Glow 包装器组件验证 ✅

- Button, IconButton, Input, InputWrapper: 验证通过
- Select: 为触发器添加 Glow 包装器
- Alert, Toast: 添加 `block: true` 属性

### Phase 3: 内联 Glow 组件修复 ✅

- Card: 添加完整的鼠标跟踪功能
- 使用 platform 辅助函数进行元素查找

**修改文件**:
- `packages/components/src/basic/card.rs`

### Phase 4: 交互组件验证 ✅

- Switch: 添加 `hi-switch-glow` 类
- Checkbox, Radio: 验证通过
- Slider: 添加 focus-visible 和 active 效果
- Menu: 添加 hover 样式
- Sidebar: 简化 hover 处理
- Tabs: 修复点击事件和类名
- Badge, Avatar: 确认不需要 hover 效果（符合设计预期）

### Phase 5: 数据展示组件验证 ✅

- Table: 验证通过
- Tree: 验证通过
- Timeline, Calendar: 修复 CSS 变量 `--hi-color-primary-glow` → `--hi-glow-button-primary`
- Tag: 验证通过

### Phase 6: 滚动容器验证 ✅

- ScrollbarContainer: 修复容器类名
- Modal: 修复透明模式点击问题

### Phase 7: 全面测试 ✅

- E2E 测试: 12 passed
- 编译检查: 通过

---

## 涉及组件 (24个)

| 组件 | 状态 |
|------|------|
| Button | ✅ |
| IconButton | ✅ |
| Input | ✅ |
| InputWrapper | ✅ |
| Select | ✅ |
| Alert | ✅ |
| Toast | ✅ |
| Card | ✅ |
| Switch | ✅ |
| Checkbox | ✅ |
| RadioGroup | ✅ |
| Slider | ✅ |
| Badge | ✅ |
| Avatar | ✅ |
| Menu | ✅ |
| Sidebar | ✅ |
| Tabs | ✅ |
| Table | ✅ |
| Tree | ✅ |
| Tag | ✅ |
| Timeline | ✅ |
| Calendar | ✅ |
| Modal | ✅ |
| Scrollbar | ✅ |
