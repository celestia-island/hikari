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
2. `44f63af` fix(website): 导入 pages.scss 到 index.scss，更新 button.rs
3. `8c1b918` feat(website): 更新更多页面使用 PageContainer 和 i18n
4. `4094973` feat(website): 更新 demos/showcase.rs
5. `e37a6ae` feat(website): 更新剩余10个页面使用 PageContainer 和 i18n
6. `bdc27c5` fix(website): PageContainer 和 DemoSection 改用内联样式
7. `8912118` feat(website): 重构页面架构为 Markdown 驱动
8. `e32cc58` fix(website): 修正 Markdown 驱动架构
9. `468cdfc` feat(website): 迁移组件文档到 Markdown，更新路由和 Registry
10. `bb48a88` docs: 更新 plan.md 记录完成的架构重构
11. `31c76ba` refactor(website): 删除已迁移到 Markdown 的旧页面文件 (删除 4328 行代码)

## File Structure

### Documentation (Markdown)

```
docs/
├── en-US/components/
│   ├── layer1/ (13 files)
│   ├── layer2/ (4 files)
│   └── layer3/ (3 files)
├── zh-CHS/components/
│   ├── layer1/ (13 files)
│   ├── layer2/ (4 files)
│   └── layer3/ (3 files)
└── zh-CHT/ (待添加)
```

### Components

```
examples/website/src/components/
├── doc_page.rs          # DynamicDocPage - 统一页面模板
├── registry.rs          # 组件渲染注册表
└── markdown_renderer.rs # Markdown 解析器
```

### Deleted Files (20 files, 4328 lines)

**Layer 1 (13 files):**
- avatar.rs, button.rs, comment.rs, description_list.rs
- display.rs, empty.rs, feedback.rs, form.rs
- image.rs, number_input.rs, search.rs, switch.rs, tag.rs

**Layer 2 (4 files):**
- data.rs, feedback.rs, form.rs, navigation.rs

**Layer 3 (3 files):**
- editor.rs, media.rs, visualization.rs

### Retained Files (still using .rs)

**Layer 2:**
- cascader.rs, collapsible.rs, pagination.rs, qrcode.rs
- table.rs, timeline.rs, transfer.rs, tree.rs, overview.rs

**Layer 3:**
- overview.rs, user_guide.rs, zoom_controls.rs

## How to Add New Component

1. Create Markdown docs:
   ```bash
   # Chinese
   echo "# Component Name 组件名\n\n```_hikari_component\npages/components/layer1/mycomponent#demo\n```" \
     > docs/zh-CHS/components/layer1/mycomponent.md
   
   # English
   echo "# Component Name\n\n\`\`\`_hikari_component\npages/components/layer1/mycomponent#demo\n\`\`\`" \
     > docs/en-US/components/layer1/mycomponent.md
   ```

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
   ("layer1", "mycomponent", Some("demo")) => rsx! {
       // Your component demo
   },
   ```

## Key Benefits

1. **Less Code**: Deleted 4328 lines of duplicate page code
2. **i18n Ready**: Documentation supports multiple languages
3. **Easy Maintenance**: Content in Markdown, not Rust code
4. **Separation of Concerns**: Registry handles demos, Markdown handles docs
5. **Consistent Layout**: All pages use same Container (10% margin)
