# Hikari AI Agent 调试方案

## 概述

Hikari 本体不再自带浏览器/截图工具链（Rust `hikari-e2e` crate 已退役）。视觉验证统一走
`scripts/e2e`（Python）：它通过 HTTP 与一个 **tairitsu-debug** 服务通信，默认端口 3001，
不需要 Selenium/Chrome 驱动。

## 工作流程

### 1. 启动调试服务

先在有 tairitsu-debug 的宿主上起服务（默认 `http://localhost:3001`），再确认可达：

```bash
just e2e-health
```

### 2. 截图与检查

页面来源默认是 `http://localhost:3000`（例如 `just dev` 起的 lagrange 文档站）。

```bash
# 单页截图 → target/e2e_screenshots/
just e2e-test route="/components"

# 单页布局/控制台 JSON 报告
just e2e-inspect route="/components"

# 批量截图（全部已知路由）
just e2e-batch url="http://localhost:3000"

# 回放 JSON 命令序列
just e2e-interactive input=path/to/commands.json
```

### 3. 视觉分析 (通过 MCP)

截图保存在 `target/e2e_screenshots/`（构建产物目录，不入库）：

```
zai-mcp-server_ui_to_artifact(
    image_source="target/e2e_screenshots/route.png",
    output_type="description",
    prompt="分析这个 UI 组件页面的布局和样式是否正确"
)
```

与基线（`tests/visual/baseline/`）比较：

```bash
python3 scripts/e2e/cli.py compare --baseline-dir tests/visual/baseline/default \
    --candidate-dir target/e2e_screenshots
```

## 命令参考

| 命令 | 说明 |
|------|------|
| `just e2e-health` | 检查 tairitsu-debug 服务 |
| `just e2e-test route=` | 截取单个路由 |
| `just e2e-inspect route=` | 单页布局/控制台 JSON 报告 |
| `just e2e-batch url=` | 批量截图 |
| `just e2e-interactive input=` | 回放 JSON 命令序列 |

## 文件结构

```
scripts/e2e/                  # Python 视觉验证框架 (capture/compare/baseline/run)
tests/visual/baseline/        # 基线截图
target/e2e_screenshots/       # 截图输出（构建产物，不入库）
```
