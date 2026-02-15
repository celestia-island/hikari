# Hikari Website Refactoring Plan

## Goal

Refactor website pages to:
1. Fix layout/styling issues (missing CSS classes, no scrollbars, misaligned content)
2. Add i18n (internationalization) support to all pages
3. Unify page layouts using Markdown-driven architecture
4. Registry directly renders components (no wrapper components needed)

## Status: COMPLETED

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
2. `44f63af` fix(website): 导入 pages.scss 到 index.scss，更新 button.rs
3. `8c1b918` feat(website): 更新更多页面使用 PageContainer 和 i18n
4. `4094973` feat(website): 更新 demos/showcase.rs
5. `e37a6ae` feat(website): 更新剩余10个页面使用 PageContainer 和 i18n
6. `bdc27c5` fix(website): PageContainer 和 DemoSection 改用内联样式
7. `8912118` feat(website): 重构页面架构为 Markdown 驱动
8. `e32cc58` fix(website): 修正 Markdown 驱动架构
9. `468cdfc` feat(website): 迁移组件文档到 Markdown，更新路由和 Registry

## File Structure

### Documentation (Markdown)

```
docs/
├── en-US/
│   ├── components/
│   │   ├── layer1/
│   │   │   ├── avatar.md
│   │   │   ├── button.md
│   │   │   ├── comment.md
│   │   │   ├── description_list.md
│   │   │   ├── display.md
│   │   │   ├── empty.md
│   │   │   ├── feedback.md
│   │   │   ├── form.md
│   │   │   ├── image.md
│   │   │   ├── number_input.md
│   │   │   ├── search.md
│   │   │   ├── switch.md
│   │   │   └── tag.md
│   │   ├── layer2/
│   │   │   ├── data.md
│   │   │   ├── feedback.md
│   │   │   ├── form.md
│   │   │   └── navigation.md
│   │   └── layer3/
│   │       ├── editor.md
│   │       ├── media.md
│   │       └── visualization.md
│   └── system/
├── zh-CHS/
│   └── (same structure as en-US)
└── zh-CHT/
    └── (same structure as en-US)
```

### Components

```
examples/website/src/components/
├── doc_page.rs          # DynamicDocPage - 统一页面模板
├── registry.rs          # 组件渲染注册表
├── markdown_renderer.rs # Markdown 解析器
└── ...
```

### Styles

```
packages/components/src/layout/container.rs  # Container 样式 (10% 边距)
```

## How to Add New Component

1. Create Markdown docs:
   - `docs/zh-CHS/components/{layer}/{component}.md`
   - `docs/en-US/components/{layer}/{component}.md`

2. Add route in `app.rs`:
   ```rust
   #[route("/components/layer1/mycomponent")]
   MyComponent {},
   
   fn MyComponent() -> Element {
       rsx! {
           crate::components::DynamicDocPage {
               current_route: Route::MyComponent {},
               doc_path: "components/layer1/mycomponent",
           }
       }
   }
   ```

3. Add rendering in `registry.rs`:
   ```rust
   ("layer1", "mycomponent", Some("demo1")) => rsx! {
       // Your component demo
   },
   ```

## Remaining Tasks

- [ ] Delete old page .rs files (low priority, can be done later)
- [ ] Add more component demos in Registry
- [ ] Add zh-CHT (Traditional Chinese) documentation
