# Hikari 迁移到 Tairitsu 设施 - 完成

## 概述

Hikari 已完成从 wasm-bindgen 到 Tairitsu WIT component model 的迁移。

## 完成状态

| Phase | 任务 | 状态 |
|-------|------|------|
| 0 | 删除 render-service 包 | ✅ 完成 |
| 1.1 | 更新 components Cargo.toml | ✅ 完成 |
| 1.2 | 更新 icons Cargo.toml | ✅ 完成 |
| 2 | 迁移条件编译 | ✅ 完成 |
| 3 | 验证与测试 | ✅ 完成 |
| 4 | 清理与优化 | ✅ 完成 |

## 完成内容

### Phase 0: 删除 render-service
- 彻底删除 render-service 包
- 服务端渲染由 Tairitsu 服务端中间件负责

### Phase 1: Cargo.toml 清理
- components: 移除大部分 wasm-bindgen 依赖，保留 Canvas 相关
- icons: 移除未使用的依赖

### Phase 2: 条件编译迁移
- 创建 `platform` 抽象模块
- 迁移 Portal、Style Builder、Theme Provider 等组件到 WitPlatform
- 移除大部分 `#[cfg(target_arch = "wasm32")]` 条件编译

### Phase 3: 测试修复
- 修复 E2E 测试路由问题
- 验证 wasm32-wasip2 编译通过

### Phase 4: 清理
- 移除废弃代码
- 清理未使用的条件分支

## 保留 wasm-bindgen 的复杂 API

以下 API 因复杂性暂时保留 wasm-bindgen：

| API | 原因 |
|-----|------|
| Canvas (glow, qrcode) | Canvas 2D Context 操作复杂 |
| Observers (ResizeObserver, IntersectionObserver) | 回调机制复杂 |

## 已确认的决定

- [x] **icons 包** - 保留，是 Hikari 附着于 Tairitsu 的 SVG 基础设施
- [x] **render-service** - 彻底删除
- [x] **wasm-bindgen fallback** - 不保留，彻底迁移到 WIT component model
