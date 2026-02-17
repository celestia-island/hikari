# Hikari Website i18n Routing Plan

## Status: COMPLETE ✅

## Goal

为文档添加语言前缀 URL（/en, /zh-chs, /zh-cht）以优化搜索引擎索引：
- 第一级路径是语言前缀
- 第二级开始是正常的文档路由
- SSR 阶段推送完整语言内容
- 语言切换时保持在同一页面但切换语言

## Architecture

```
URL Structure:
/                           → 重定向到 /zh-chs (默认语言)
/en                         → 英文首页
/en/components              → 英文组件概览
/en/components/layer1/button → 英文 Button 组件文档
/zh-chs/system/overview     → 简体中文系统概览
/zh-cht/...                 → 繁体中文页面

旧路由（向后兼容）:
/components/button          → 301 重定向到 /zh-chs/components/button
/system/overview            → 301 重定向到 /zh-chs/system/overview
```

## Tasks

### Phase 1: 核心架构 ✅
- [x] 修改 Language 枚举，添加 url_prefix() 方法
- [x] 修改路由结构，所有路由添加 /:lang 前缀
- [x] 修改 hooks.rs 支持从 URL 读取语言设置
- [x] 修改 doc_page.rs 支持新的文档路径

### Phase 2: 组件更新 ✅
- [x] 修改 aside_footer.rs 语言切换逻辑（切换时跳转到同页面不同语言版本）
- [x] 修改 sidebar.rs 路由数据结构
- [x] 修改 layout.rs 面包屑导航
- [x] 修改 top_nav.rs 路由引用

### Phase 3: 页面更新 ✅
- [x] 修改 home.rs
- [x] 修改 components/overview.rs
- [x] 修改 components/layer2/overview.rs
- [x] 修改 components/layer3/overview.rs
- [x] 修改 demos/showcase.rs
- [x] 修改 demos/layer1/form_demo.rs
- [x] 修改 demos/layer2/dashboard_demo.rs
- [x] 修改 demos/layer3/video_demo.rs

### Phase 4: 服务器端 ✅
- [x] 修改 render-service/router.rs 添加旧路由重定向
- [x] 修改 build.rs 创建语言目录 (en, zh-chs, zh-cht)
- [x] 修复编译错误（route handlers 使用 #[component], clone closures）

### Phase 5: 测试与清理 ✅
- [x] 编译通过
- [x] E2E 测试（无测试配置）
- [x] 提交到 dev 分支

## Resolutions

1. sidebar.rs 数据结构使用了函数指针 → 改用 route_key 字符串 + route_key_to_route() 函数
2. hooks.rs 有可变借用问题 → Signal mut 绑定
3. aside_footer.rs 有生命周期问题 → clone current_route 和 navigator
4. doc_page.rs 的 tokio 在 wasm32 下不可用 → 条件编译 #[cfg(all(not(target_arch = "wasm32"), feature = "server"))]
5. Route handlers 需要 #[component] 属性才能正确实现 Props trait

## File Changes

### Modified Files
- packages/i18n/src/context.rs
- examples/website/src/app.rs
- examples/website/src/hooks.rs
- examples/website/src/components/doc_page.rs
- examples/website/src/components/aside_footer.rs
- examples/website/src/components/sidebar.rs
- examples/website/src/components/layout.rs
- examples/website/src/components/top_nav.rs
- examples/website/src/pages/*.rs
- examples/website/build.rs
- packages/render-service/src/router.rs
