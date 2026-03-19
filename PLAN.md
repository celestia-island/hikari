# Hikari -> Tairitsu 构建链迁移计划

---

## Phase 2: CSS 基础设施迁移到 tairitsu-style

### 状态: ✅ 部分完成

### 已完成的工作

#### StyleStringBuilder 和 CssProperty 迁移

- [x] 添加 `tairitsu-style` 依赖到 `hikari-animation`
- [x] 更新 `hikari-animation/src/style/mod.rs` re-export `StyleStringBuilder`, `CssProperty`, `Property`
- [x] 保留 `StyleBuilder`（HtmlElement 版本）在 `hikari-animation`
- [x] 删除旧的 `properties.rs` 文件
- [x] 所有 hikari 包编译通过
- [x] `CssProperty` 现在包含 403 个 W3C 标准属性

### 保留在 hikari-palette 的内容

**ClassesBuilder 和 UtilityClass** 保留在 `hikari-palette`，原因：

1. **设计目标不同**：
   - tairitsu-style 的 `UtilityClass`: Tailwind 风格的 utility classes（用于 CSS 生成）
   - hikari-palette 的 `UtilityClass`: hikari 组件特定的 `hi-` 前缀类枚举

2. **API 不兼容**：
   - tairitsu: `ClassesBuilder::add(&str)` - 接受字符串
   - hikari: `ClassesBuilder::add(impl UtilityClass)` - 接受 trait 对象

3. **组件耦合**：
   - hikari-palette 有 18 个组件类枚举文件
   - 这些枚举与 `hi-` 前缀样式系统紧密耦合

### 架构决策

```
┌─────────────────────────────────────────────────────────────┐
│                     hikari-animation                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ re-export from tairitsu_style:                      │   │
│  │ - StyleStringBuilder                                 │   │
│  │ - CssProperty (403 W3C standard properties)          │   │
│  │ - Property                                           │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ hikari-specific (web-sys integration):              │   │
│  │ - StyleBuilder (HtmlElement-based)                   │   │
│  │ - AttributeBuilder                                   │   │
│  │ - set_style, get_style, etc.                        │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                     hikari-palette                          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ hikari component class system:                       │   │
│  │ - ClassesBuilder (accepts impl UtilityClass)         │   │
│  │ - UtilityClass trait (hi- prefix)                    │   │
│  │ - 18 component class enums (Button, Table, etc.)     │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Phase 3: Props 宏迁移

将更多组件 Props 迁移到 `#[define_props]` 宏：

| 组件 | Props | 状态 |
|---|---|---|
| icons | IconProps | ✅ 已完成 |
| data/table | TableProps | ✅ 已完成 |
| basic/avatar | AvatarProps | 待处理 |
| basic/button | ButtonProps | 待处理 |
| basic/input | InputProps | 待处理 |
| ... | ... | ... |

---

## Phase 4: 文档更新

- [ ] 更新 `docs/en-US/guides/02-classesbuilder-system.md`
- [ ] 更新 `docs/en-US/guides/03-stylestringbuilder-system.md`
- [ ] 添加迁移指南
