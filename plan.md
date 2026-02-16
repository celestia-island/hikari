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
13. `09b8147` docs: 更新 plan.md - 全部迁移完成
14. `7a7bf01` feat(website): 迁移 system 页面到 Markdown

## Summary

| Metric | Value |
|--------|-------|
| Markdown 文档 | 85 个 (中英文) |
| 删除的 .rs 文件 | 36 个 |
| 删除的代码行数 | ~10,000 行 |

## Migrated Pages (Markdown-driven)

**Layer 1 (13):** avatar, button, comment, description_list, display, empty, feedback, form, image, number_input, search, switch, tag

**Layer 2 (12):** cascader, collapsible, data, feedback, form, navigation, pagination, qrcode, table, timeline, transfer, tree

**Layer 3 (5):** editor, media, user_guide, visualization, zoom_controls

**System (6):** overview, css, icons, palette, animation, i18n

## Retained Pages (Complex Interactions)

| Page | Reason |
|------|--------|
| `home.rs` | 首页，特殊布局 |
| `animation_demo.rs` | 动画演示，复杂交互 |
| `demos/showcase.rs` | Demo 概览页 |
| `demos/layer1/form_demo.rs` | 表单演示，交互表单 |
| `demos/layer2/dashboard_demo.rs` | 仪表盘演示，图表 |
| `demos/layer3/video_demo.rs` | 视频演示，播放器 |
| `components/overview.rs` | 组件概览 |
| `components/layer2/overview.rs` | Layer 2 概览 |
| `components/layer3/overview.rs` | Layer 3 概览 |

## File Structure

```
docs/
├── en-US/
│   ├── components/
│   │   ├── layer1/ (13 files)
│   │   ├── layer2/ (12 files)
│   │   └── layer3/ (5 files)
│   └── system/ (6 files)
└── zh-CHS/
    ├── components/
    │   ├── layer1/ (13 files)
    │   ├── layer2/ (12 files)
    │   └── layer3/ (5 files)
    └── system/ (6 files)

examples/website/src/pages/
├── home.rs
├── animation_demo.rs
├── mod.rs
├── components/
│   ├── mod.rs
│   ├── overview.rs
│   └── layer{2,3}/mod.rs + overview.rs
├── demos/
│   ├── mod.rs
│   ├── showcase.rs
│   └── layer{1,2,3}/mod.rs + *_demo.rs
└── system/
    └── mod.rs
```

## Key Benefits

1. **10,000+ lines of code removed** - Less code to maintain
2. **i18n Ready** - Documentation in multiple languages
3. **Easy Maintenance** - Content in Markdown, not Rust
4. **Separation of Concerns** - Registry handles demos, Markdown handles docs
5. **Consistent Layout** - All pages use same Container (10% margin)
