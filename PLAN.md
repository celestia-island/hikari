# UI 组件完善计划

## 已完成任务 ✅

### Layer1 组件改进

1. **数字输入框 (NumberInput)** ✅
   - 添加自定义增减按钮样式
   - 使用 Glow wrapper 效果
   - 添加 SVG 图标（+/-）替代纯文本
   - 支持尺寸变体 (Small/Medium/Large)

2. **搜索框 (Search)** ✅
   - 添加候选输入 suggestion 弹出功能
   - 添加搜索图标
   - 使用 IconButton 作为关闭按钮
   - 添加 Glow wrapper 效果

3. **反馈组件 (Alert/Toast)** ✅
   - 添加 Glow wrapper 鼠标跟随光效
   - 使用 IconButton 替代原生关闭按钮
   - 简化动画效果

4. **Tooltip** ✅
   - 简化实现，修复样式问题

5. **Breadcrumb 面包屑** ✅
   - 修复为横向布局
   - 添加分隔符图标

6. **Skeleton 骨架屏** ✅
   - 创建新的 Skeleton 组件替代 Empty
   - 支持 Text/Circular/Rectangular/Rounded 变体
   - 添加 SkeletonCard 和 SkeletonTable 预设
   - 添加 shimmer 动画

7. **FlexBox 案例** ✅
   - 添加 row/col/align 展示案例
   - 展示 Direction/Align/Gap 配置

8. **删除 DescriptionList** ✅
   - 从 display 模块删除 description_list.rs

---

## 原有组件状态

### 已有自定义实现（无需修改）
- Switch - 已有自定义实现
- Progress - 已有自定义实现
- Slider - 已有自定义实现
- Badge - 已有自定义实现
- Tag - 已有自定义实现
- Tabs - 已有自定义实现

### 已完成改进
- **Avatar** ✅ - 添加 AvatarFallbackMode 枚举 (Initial/Icon/None)，使用本地 SVG 图标替代 CDN
- **Image** ✅ - 添加 ImagePlaceholder 枚举 (Skeleton/Icon/None)，支持 onload/onerror 处理器
- Menu - 每个 MenuItem 使用 Glow wrapper（已部分实现）

---

## 实现笔记

### Glow Wrapper 使用模式
```rust
Glow {
    blur: GlowBlur::Light,
    color: GlowColor::Ghost, // 或根据状态使用 Primary/Success/Warning/Danger
    intensity: GlowIntensity::Seventy,
    children: content
}
```

### 语言切换按钮参考
- 文件: `examples/website/src/components/aside_footer.rs`
- 使用 `Popover + Menu { in_popover: true }`
- MenuItem 自动获得 glow wrapper 效果
