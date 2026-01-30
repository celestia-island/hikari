# Hikari 项目重构计划

## 目录

- [概述](#概述)
- [设计理念](#设计理念)
- [当前状态](#当前状态)
- [待修复的问题](#待修复的问题)
- [待实现的功能](#待实现的功能)
- [实施步骤](#实施步骤)
- [优先级说明](#优先级说明)

## 概述

本计划旨在重新梳理 Hikari 项目的发展路线，识别当前真实的技术债务，制定可执行的维护计划，避免盲目开发。

### 设计理念

1. **三层次组件体系** - Layer 1/2/3 清晰划分
2. **模块化组织** - 按功能和层次分离
3. **文档驱动开发** - 每个组件都有完整文档和示例
4. **渐进式实施** - 分阶段逐步完成，确保每个阶段都有可交付成果

### 核心原则

- **不要过度设计** - 专注于当前需要的核心功能
- **避免技术债务** - 每个功能实现都要完整，不要留 TODO 或假实现
- **类型安全** - 使用 ClassesBuilder、StyleStringBuilder 等类型安全工具
- **文档同步** - 代码和文档保持一致，中英文档同步更新

## 当前状态

### 构建状态

✅ **编译通过**: 所有包可正常编译，无错误
✅ **服务运行**: HTTP 服务器运行在 localhost:3000
✅ **WASM 加载**: website.js 和 website_bg.wasm 正常提供

### 已完成的核心系统

✅ **Palette 系统**: 500+ 中国传统颜色
✅ **Theme 系统**: Hikari (光) + Tairitsu (tairitsu) 主题
✅ **Icons 系统**: Material Design Icons (87 个图标)
✅ **Components 包**: Layer 1/2/3 基础组件
✅ **Animation 系统**: 动画和缓动函数
✅ **Render Service**: SSR 集成和静态资源服务

### Website 结构

```
examples/website/
├── src/
│   ├── app.rs              # 主应用和路由
│   ├── components/          # 通用组件（Layout, Sidebar 等）
│   ├── pages/
│   │   ├── home/
│   │   ├── components/     # 组件展示页（Layer 1/2/3）
│   │   │   ├── layer1/
│   │   │   │   ├── basic.rs
│   │   │   │   ├── display.rs
│   │   │   │   ├── form.rs
│   │   │   │   ├── feedback.rs
│   │   │   │   └── switch.rs
│   │   │   ├── layer2/
│   │   │   │   ├── data.rs
│   │   │   │   ├── form.rs
│   │   │   │   ├── feedback.rs
│   │   │   │   └── navigation.rs
│   │   │   ├── layer3/
│   │   │   │   ├── editor.rs
│   │   │   │   ├── media.rs
│   │   │   │   └── visualization.rs
│   │   ├── demos/
│   │   │   ├── layer1/
│   │   │   │   │   ├── form_demo.rs
│   │   │   │   ├── layer2/
│   │   │   │   │   ├── dashboard_demo.rs
│   │   │   │   │   └── layer3/
│   │   │   │   │       └── video_demo.rs
│   │   │   └── showcase.rs
│   │   └── system/
│   │       ├── animations.rs
│   │       ├── css.rs
│   │       ├── icons.rs
│   │       ├── overview.rs
│   │       ├── palette.rs
│   │       └── registry.rs  # 组件注册系统
```

## 待修复的问题

### 1. Theme 切换功能

**位置**: `examples/website/src/components/aside_footer.rs:81`

**问题描述**:
```rust
onclick: move |_| {
    // TODO: Implement theme switching
    // Currently, ThemeContext is read-only and doesn't support dynamic switching
    // For now, this is a placeholder
}
```

**技术限制**:
- `use_theme()` hook 从 DOM 读取主题，是只读的
- ThemeProvider 只在 DOM 设置 `data-theme` 属性，没有提供动态切换方法
- 需要状态管理来支持主题切换

**解决方案**:
1. 使用 Signal 存储当前主题状态
2. 实现 `use_theme_with_state()` hook
3. ThemeProvider 支持读取状态并覆盖
4. 或创建 `ThemeProvider` wrapper 支持主题切换

### 2. Demo 页面不完整

**位置**: `examples/website/src/pages/demos/`

**问题描述**:
- `auth_demo.rs` 和 `gallery_demo.rs` 只有占位符
- 在 `components/registry.rs` 中实现为 Coming Soon

**影响**:
- 用户无法看到真实的认证和图库演示
- 组件注册系统的完整性受到影响

**解决方案**:
- 实现 `AuthDemo` - 登录/注册表单示例
- 实现 `GalleryDemo` - 图片画廊示例

### 3. 系统页面缺失或不完整

**位置**: `examples/website/src/pages/system/`

**现状**:
- `animations.rs` - 文件不存在
- `css.rs` - 文件不存在（可能是空的）
- `icons.rs` - 可能只有展示
- `overview.rs` - 可能只有展示
- `palette.rs` - 可能只有展示

**解决方案**:
- 如果文件不存在，从其他包的 README 提取内容
- 创建展示页面，链接到对应的包文档
- 确保信息准确反映当前状态

### 4. 组件注册系统局限性

**位置**: `examples/website/src/pages/system/registry.rs`

**问题描述**:
- 使用简单的字符串解析 `parse_component_path()`
- 没有编译时检查
- 不支持动态参数（`ComponentDynamic` 路由已删除）
- 没有错误处理和验证

**解决方案**:
- 考虑使用宏系统进行编译时检查
- 改进错误处理，提供友好的错误消息
- 添加组件验证（如 `is_component_available()`）
- 或者移除动态路由，改为静态路由

### 5. 组件文档不完整

**位置**: `examples/website/src/pages/components/layer1/` 等

**问题描述**:
- 所有组件索引页只有简单的列表
- 没有组件 API 文档
- 没有 Props 说明
- 没有使用示例

**解决方案**:
- 为每个组件创建详细的文档页
- 添加 Props 参考
- 添加使用示例
- 添加最佳实践说明

## 待实现的功能

### Layer 1 组件

#### 已实现 ✅
- Button, Input, Card, Badge
- Alert, Toast, Tooltip
- Select, Checkbox, Radio, RadioGroup, Switch
- Avatar, Slider, Textarea, FileUpload, DatePicker, FormField
- Divider, Image, Tag, Spinner, ProgressBar, Code, Arrow

#### 待实现 📋

| 组件 | 优先级 | 依赖 | 描述 | 参考 |
|------|--------|------|------|--------|
| **Avatar** | 🔴 高 | - | 完整的头像组件（裁剪、上传） | Element Plus |
| **Skeleton** | 🟡 中 | - | 骨架屏加载状态 | Element Plus |
| **Result** | 🟡 中 | - | 操作结果反馈 | Element Plus |
| **Transfer** | 🟢 低 | - | 穿梭框 | Element Plus |

### Layer 2 组件

#### 已实现 ✅
- Menu, Tabs, Breadcrumb, Dropdown, Modal, Drawer, Steps, Tree
- Table, Pagination, Collapse, Upload, Calendar, Carousel, Stepper, Timeline

#### 待实现 📋

| 组件 | 优先级 | 依赖 | 描述 | 参考 |
|------|--------|------|------|--------|
| **Form** | 🔴 高 | Layer 1 表单组件 | 完整表单容器、验证 | Element Plus |
| **Cascader** | 🟢 低 | Dropdown + Select | 级联选择器 | Element Plus |
| **Rate** | 🟢 低 | - | 评分组件 | Element Plus |

### Layer 3 组件

#### 计划中 📋

| 组件 | 优先级 | 依赖 | 描述 | 参考 |
|------|--------|------|------|--------|
| **VideoPlayer** | 🔴 高 | Modal + Button + Form | 视频播放器 | Video.js |
| **AudioPlayer** | 🔴 高 | Card + Button + Slider | 音频播放器 | Howler.js |
| **RichTextEditor** | 🔴 高 | Modal + Dropdown + Toolbar | 富文本编辑 | Quill.js |
| **CodeEditor** | 🔴 高 | Card + Tabs + Form | 代码编辑器 | Monaco Editor |
| **SyntaxHighlighter** | 🟡 中 | Card + Button | 语法高亮 | Prism.js |
| **Timeline** | 🟡 中 | Card + Badge + Collapse | 时间线 | Element Plus |
| **DataVisualization** | 🟡 中 | Card + Tabs + Form | 数据可视化 | ECharts |
| **UserGuide** | 🟡 中 | Modal + Badge + Steps | 用户引导 | Driver.js |
| **IMChat** | 🟢 低 | Card + Form + List | 即时通讯 | - |

## 实施步骤

### 阶段 1：基础设施完善（当前）

**时间估计**: 1-2 天

#### 任务
1. **完善主题切换功能**
   - 在 `aside_footer.rs` 实现真正的主题切换
   - 创建状态管理（use_context 或全局 Signal）
   - ThemeProvider 支持主题状态覆盖
   - 或创建新的 `ThemeProviderWithState`

2. **完善组件注册系统**
   - 添加组件可用性检查
   - 改进错误处理
   - 考虑使用宏系统进行编译时检查

3. **实现 Demo 页面**
   - 实现 `AuthDemo` - 登录/注册表单
   - 实现 `GalleryDemo` - 图片画廊示例

4. **系统页面完善**
   - 创建 `animations.rs` - 如果不存在，创建展示页
   - 完善 `css.rs` - 如果不存在，创建展示页
   - 完善 `icons.rs` - 添加图标预览和搜索
   - 完善 `overview.rs` - 系统概览页

**预期成果**:
- ✅ 主题切换功能可用
- ✅ 所有系统页面完整
- ✅ Demo 页面真实可用

### 阶段 2：Layer 1 组件文档（1-2 周）

**时间估计**: 1-2 周

#### 任务
为核心 Layer 1 组件创建详细文档页：

| 组件 | 文档页 | 需求 |
|------|---------|------|
| Button | `/components/layer1/button` | Props、变体、状态、事件、示例 |
| Input | `/components/layer1/input` | Props、验证、事件、示例 |
| Card | `/components/layer1/card` | Props、插槽、嵌套、示例 |
| Badge | `/components/layer1/badge` | Props、变体、颜色、示例 |
| Alert | `/components/layer1/alert` | Props、类型、关闭、示例 |
| Toast | `/components/layer1/toast` | Props、位置、持续时长、示例 |
| Tooltip | `/components/layer1/tooltip` | Props、位置、触发方式、示例 |
| Select | `/components/layer1/select` | Props、选项、分组、示例 |
| Checkbox | `/components/layer1/checkbox` | Props、状态、事件、示例 |
| Radio | `/components/layer1/radio` | Props、状态、事件、示例 |
| Switch | `/components/layer1/switch` | Props、状态、动画、示例 |

**文档结构**:
```
/components/layer1/button/
├── overview.rs        # 组件概述
├── props.rs           # Props 文档
├── examples/
│   ├── basic.rs      # 基础示例
│   ├── variants.rs   # 变体示例
│   ├── states.rs    # 状态示例
│   └── advanced.rs  # 高级用法
```

**预期成果**:
- ✅ 所有 Layer 1 组件有完整文档
- ✅ 文档与代码保持同步
- ✅ 用户可以快速查阅组件用法

### 阶段 3：Layer 2 组件文档（2-3 周）

**时间估计**: 2-3 周

#### 任务
为核心 Layer 2 组件创建详细文档页：

| 组件 | 文档页 | 需求 |
|------|---------|------|
| Menu | `/components/layer2/menu` | Props、模式、事件、示例 |
| Tabs | `/components/layer2/tabs` | Props、位置、事件、示例 |
| Breadcrumb | `/components/layer2/breadcrumb` | Props、分隔符、示例 |
| Dropdown | `/components/layer2/dropdown` | Props、触发方式、位置、示例 |
| Modal | `/components/layer2/modal` | Props、尺寸、事件、遮罩、示例 |
| Drawer | `/components/layer2/drawer` | Props、方向、触发、示例 |
| Steps | `/components/layer2/steps` | Props、状态、事件、示例 |
| Tree | `/components/layer2/tree` | Props、节点、事件、虚拟滚动、示例 |
| Table | `/components/layer2/table` | Props、数据、列、排序、筛选、示例 |
| Pagination | `/components/layer2/pagination` | Props、页码、事件、示例 |

**预期成果**:
- ✅ 所有 Layer 2 组件有完整文档
- ✅ 文档与代码保持同步

### 阶段 4：Layer 3 组件开发（3-4 周）

**时间估计**: 3-4 周

#### 任务

**4.1 视频相关** (1-2 周)
- 实现 `VideoPlayer` 组件
- 集成 Video.js 或创建简单播放器
- 添加演示页

**4.2 编辑器相关** (1-2 周)
- 实现 `RichTextEditor` 组件
- 或集成 Quill.js
- 添加演示页

**4.3 数据可视化** (1 周)
- 实现 `DataVisualization` 组件
- 集成 ECharts 或使用简单的图表库

**预期成果**:
- ✅ Layer 3 有生产级组件
- ✅ 每个组件有演示和文档

### 阶段 5：完善和优化（1-2 周）

#### 任务
- 性能优化（虚拟滚动、懒加载）
- 无障碍性支持（ARIA 标签、键盘导航）
- 测试覆盖（单元测试、集成测试）
- 中英文档同步

**预期成果**:
- ✅ 生产级的组件库
- ✅ 完整的测试
- ✅ 多语言文档

## 优先级说明

### 红色 🔴 高优先级

- 核心功能组件
- 影响用户体验的关键功能
- 阻塞其他开发的依赖

### 黄色 🟡 中优先级

- 提升体验的功能
- 常用但非核心功能
- 可以分阶段实现

### 绿色 🟢 低优先级

- 锦上添花的功能
- 可以延后或使用第三方方案
- 不阻塞主要功能

## 技术债务

### 已解决 ✅
- ✅ 所有编译错误已修复
- ✅ MdiIcon 系统完整
- ✅ ThemeContext 读取问题已修复
- ✅ 所有 mut 警告已修复
- ✅ 动态参数路由问题已处理

### 当前技术债务 ⚠️

1. **Theme 切换** - 详见"待修复的问题"
2. **Demo 页面不完整** - auth_demo, gallery_demo 只有占位符
3. **系统页面不完整** - animations, css, icons, overview 可能缺失
4. **组件注册系统** - 字符串解析简单，无编译时检查
5. **组件文档缺失** - Layer 1/2 组件没有详细文档
6. **Layer 3 组件未实现** - 所有 Layer 3 组件都在计划中

## 总结

### 当前成果

- ✅ 完整的 Palette、Theme、Icons、Animation 系统
- ✅ 基础的 Layer 1/2 组件库
- ✅ 完整的网站结构和路由系统
- ✅ 组件注册系统的 MDX-like 实现
- ✅ 所有代码编译通过，无错误

### 下一步

**立即行动**（本周）:
1. 实现主题切换功能
2. 完善 Demo 页面（auth_demo, gallery_demo）
3. 完善系统页面

**中期目标**（1-2 个月）:
1. 完成 Layer 1 组件文档
2. 完成 Layer 2 组件文档
3. 实现 Layer 3 组件

**长期目标**（3-4 个月）:
1. 生产级组件库
2. 完整测试覆盖
3. 多语言文档

### 成功标准

- ✅ 功能完整实现，无 TODO 或占位符
- ✅ 有完整的文档和示例
- ✅ 通过所有测试
- ✅ 代码和文档保持同步
- ✅ 遵循设计原则和架构模式

---

**最后更新**: 2026-01-30 13:30
