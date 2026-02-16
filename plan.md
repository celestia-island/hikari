# Hikari Website Refactoring Plan

## Status: COMPLETED ✅

## Architecture

```
路由 → DynamicDocPage(lang) → Layout + Container(10%边距) + MarkdownRenderer
                                                          ↓
                                              读取 /docs/{lang}/{path}.md
                                                          ↓
                                              解析 _hikari_component
                                                          ↓
                                              Registry → 直接渲染组件
```

## Commits Made

1. `5e826da` fix(layout): 恢复主内容区域滚动条可见性
2. `44f63af` fix(website): 导入 pages.scss 到 index.scss
3. `8c1b918` feat(website): 更新更多页面使用 PageContainer 和 i18n
4. `4094973` feat(website): 更新 demos/showcase.rs
5. `e37a6ae` feat(website): 更新剩余10个页面使用 PageContainer 和 i18n
6. `bdc27c5` fix(website): PageContainer 和 DemoSection 改用内联样式
7. `8912118` feat(website): 重构页面架构为 Markdown 驱动
8. `e32cc58` fix(website): 修正 Markdown 驱动架构
9. `468cdfc` feat(website): 迁移组件文档到 Markdown
10. `bb48a88` docs: 更新 plan.md
11. `31c76ba` refactor(website): 删除已迁移的旧页面文件 (第一轮)
12. `550bc40` feat(website): 完成剩余组件迁移 (第二轮)

## Summary

| Metric | Value |
|--------|-------|
| Markdown 文档 | 60 个 (中英文) |
| 删除的 .rs 文件 | 30 个 |
| 删除的代码行数 | ~8,200 行 |

## File Structure

```
docs/
├── en-US/components/
│   ├── layer1/ (13 files)
│   ├── layer2/ (12 files)
│   └── layer3/ (5 files)
└── zh-CHS/components/
    ├── layer1/ (13 files)
    ├── layer2/ (12 files)
    └── layer3/ (5 files)

examples/website/src/pages/components/
├── mod.rs
├── overview.rs
├── layer1/mod.rs (empty)
├── layer2/mod.rs + overview.rs
└── layer3/mod.rs + overview.rs
```

## Remaining .rs Files (Overview pages only)

- `pages/components/overview.rs` - Components overview
- `pages/components/layer2/overview.rs` - Layer 2 overview
- `pages/components/layer3/overview.rs` - Layer 3 overview

## Key Benefits

1. **8,200+ lines of code removed** - Less code to maintain
2. **i18n Ready** - Documentation in multiple languages
3. **Easy Maintenance** - Content in Markdown, not Rust
4. **Separation of Concerns** - Registry handles demos, Markdown handles docs
5. **Consistent Layout** - All pages use same Container (10% margin)
