# Hikari UI 改进计划

## 分析日期: 2026-02-21
## 状态: 截图工具路由已修复，所有 44 个页面截图完成

---

## 一、已完成工作

### 1. 修复截图工具路由配置
- **问题**: 截图工具 `screenshot_bin.rs` 的路由配置与应用实际路由不匹配
- **修复内容**:
  - 添加 `/en/` 语言前缀
  - 修正所有错误的路由路径 (entry → layer2, extra → layer3, basic → button)
  - 新增遗漏的路由 (avatar, image, tag, empty, comment, table, tree, pagination, qrcode, system_i18n)
- **结果**: 44 个页面全部截图成功

---

## 二、视觉分析结果

### 2.1 整体评价
UI 设计现代、简洁，遵循良好的设计系统原则。大部分页面渲染正确，无明显视觉故障。

### 2.2 各页面分析

#### 首页 (home.png)
- **正常**: 页面结构完整，导航正常
- **待改进**: 需进一步分析具体组件

#### 组件总览 (components.png)
- **正常**: 卡片布局清晰，面包屑导航有效
- **建议改进**:
  1. **颜色对比度**: "Layout Components" 面板内的浅灰色文字与薄荷绿背景对比度不足
  2. **侧边栏宽度**: 左侧导航栏稍宽，可考虑收窄以增加主内容区空间
  3. **图标一致性**: 侧边栏图标风格应统一

#### 按钮组件 (components_layer1_button.png)
- **正常**: 四种按钮变体 (Primary, Secondary, Ghost, Danger) 样式一致
- **正常**: 间距统一，颜色选择符合 UI 模式
- **正常**: 包含 Disabled 状态展示

#### 图标系统 (system_icons.png)
- **正常**: 文档页面结构清晰
- **注意**: 当前页面是概述页，未展示图标网格

#### Dashboard 演示 (demos_layer2_dashboard.png)
- **正常**: 完整渲染，无显示问题
- **正常**: 统计卡片布局合理，数据展示清晰
- **功能**: 包含主题切换功能

---

## 三、发现的问题

### 3.1 视觉问题

| 问题 | 严重程度 | 位置 | 建议修复 |
|------|---------|------|---------|
| 文字对比度不足 | 中 | Layout Components 面板 | 使用更深的灰色或 semi-bold 字重 |
| 侧边栏过宽 | 低 | 所有页面 | 减少 10-15% 宽度 |
| 图标风格不一致 | 低 | 侧边栏导航 | 统一图标集 |

### 3.2 待进一步验证

由于视觉分析 MCP 超时，以下页面需要手动验证：
- `/en/demos` - 演示总览
- `/en/components/layer1/form` - 表单组件
- `/en/components/layer2/table` - 表格组件
- `/en/system/palette` - 调色板页面

---

## 四、后续行动

### Phase 1: 验证剩余页面 (立即)
- [ ] 手动浏览 `/en/components/layer1/form` 检查表单样式
- [ ] 手动浏览 `/en/components/layer2/table` 检查表格样式
- [ ] 手动浏览 `/en/system/palette` 检查颜色展示

### Phase 2: 修复视觉问题
- [ ] 提高 Layout Components 面板的文字对比度
- [ ] 调整侧边栏宽度
- [ ] 统一侧边栏图标风格

### Phase 3: 组件状态完善
- [ ] 检查所有交互状态 (hover, focus, active, disabled)
- [ ] 验证响应式布局
- [ ] 检查暗色主题兼容性

---

## 五、调试工具使用指南

### 快捷命令
```bash
# 截取单个页面
just debug-screenshot url="http://localhost:3000/en/components/layer1/button" output="test.png"

# 检查页面状态
just debug-check url="http://localhost:3000/en/system/icons"

# 执行 JavaScript
just debug-script url="http://localhost:3000" script="return document.title;"

# 批量截图
just debug-interactive input="scripts/dev/commands/example_commands.json"
```

### Docker 方式 (推荐用于生产)
```bash
docker run --rm --network host \
    -v "$(pwd)/scripts/dev/screenshots:/tmp/e2e_screenshots" \
    -v "$(pwd)/target/release/hikari-screenshot:/usr/local/bin/hikari-screenshot:ro" \
    -e CHROME_BIN=/usr/bin/google-chrome \
    selenium/standalone-chrome:latest \
    /usr/local/bin/hikari-screenshot
```

---

## 六、文件结构

```
hikari/
├── PLAN.md                           # 本文件
├── scripts/dev/
│   ├── browser_debug.py              # Python 调试脚本
│   ├── .gitignore                    # 忽略截图和生成文件
│   ├── commands/
│   │   └── example_commands.json     # 示例命令
│   └── screenshots/                  # 44 张页面截图
├── packages/e2e/src/screenshot_bin.rs # 截图工具 (已修复)
└── examples/website/src/app.rs       # 应用路由定义
```

---

## 七、截图清单

| # | 路由 | 文件 | 状态 |
|---|------|------|------|
| 1 | `/en` | home.png | ✅ |
| 2 | `/en/components` | components.png | ✅ |
| 3 | `/en/demos` | demos.png | ✅ |
| 4 | `/en/demos/animation` | demos_animation.png | ✅ |
| 5 | `/en/demos/layer1/form` | demos_layer1_form.png | ✅ |
| 6 | `/en/demos/layer2/dashboard` | demos_layer2_dashboard.png | ✅ |
| 7 | `/en/demos/layer3/video` | demos_layer3_video.png | ✅ |
| 8-19 | Layer 1 组件 | components_layer1_*.png | ✅ (12个) |
| 20-32 | Layer 2 组件 | components_layer2_*.png | ✅ (13个) |
| 33-38 | Layer 3 组件 | components_layer3_*.png | ✅ (6个) |
| 39-44 | System 页面 | system*.png | ✅ (6个) |

**总计: 44/44 页面截图成功**

---

## 八、结论

1. **路由问题已修复**: 截图工具现在可以正确访问所有页面
2. **整体 UI 健康**: 大部分页面渲染正常，无严重视觉问题
3. **待改进项**: 少量视觉细节需要优化（对比度、间距、图标一致性）
4. **工具可用**: 调试工具链已就绪，可随时进行视觉分析
