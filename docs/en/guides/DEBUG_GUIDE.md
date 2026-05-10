# Hikari AI Agent 调试方案

## 概述

这套方案提供了完整的浏览器调试设施，供 AI Agent 进行 UI 验证和视觉分析。

## 工作流程

### 1. 启动开发服务器 (通过仿真终端 MCP)

```bash
# 使用 persistent-terminal MCP
persistent-terminal_startService(
    name="hikari-dev",
    command="just dev",
    cwd="/mnt/sdb1/hikari",
    readyPatterns=["Server running", "listening on"]
)
```

服务器将在 `http://localhost:3000` 运行。

### 2. 截图与视觉分析

```bash
# 截取单个页面
just debug-screenshot url="http://localhost:3000/components" output="components.png"

# 检查页面状态
just debug-check url="http://localhost:3000"

# 执行 JavaScript
just debug-script url="http://localhost:3000" script="return document.title;"

# 批量截图 (使用 JSON 配置)
just debug-interactive

# 从路由列表生成命令文件
just debug-generate "/" "/components" "/components/layer1/basic"
```

### 3. 视觉分析 (通过 MCP)

截图保存在 `scripts/dev/screenshots/` 目录，可使用视觉分析 MCP 进行分析：

```
zai-mcp-server_ui_to_artifact(
    image_source="/mnt/sdb1/hikari/scripts/dev/screenshots/components.png",
    output_type="description",
    prompt="分析这个 UI 组件页面的布局和样式是否正确"
)

zai-mcp-server_diagnose_error_screenshot(
    image_source="/mnt/sdb1/hikari/scripts/dev/screenshots/error_page.png",
    prompt="分析这个错误截图，识别可能的问题"
)
```

## 命令参考

| 命令 | 说明 |
|------|------|
| `just build-debug` | 构建浏览器调试工具 |
| `just debug-screenshot url= output=` | 截取页面截图 |
| `just debug-check url=` | 检查页面状态 |
| `just debug-script url= script=` | 执行 JavaScript |
| `just debug-interactive` | 运行 JSON 命令文件 |
| `just debug-visual-check` | 快速视觉检查 |
| `just debug-generate routes...` | 从路由生成命令文件 |
| `just debug-session route=` | 完整调试会话 |

## 文件结构

```
scripts/dev/
├── browser_debug.py        # Python 调试脚本
├── .gitignore              # 忽略截图和生成文件
├── commands/               # JSON 命令文件
│   └── example_commands.json
└── screenshots/            # 截图输出 (gitignored)
```
