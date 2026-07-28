# Collapsible 可折叠面板

可折叠的面板组件。

## 基础用法

```hikari
rsx! {
    div { style: "padding:1rem;border:1px solid #e2e2ea;border-radius:8px;max-width:300px;",
        div { style: "padding:12px;font-weight:600;cursor:pointer;background:#f7f7fa;", "Click to expand ▼" }
        div { style: "padding:12px;color:#666;font-size:14px;", "Collapsible content" }
    }
}
```

## API

| 属性 | 说明 | 类型 | 默认值 |
|------|------|------|--------|
| title | 标题 | String | - |
| expanded | 是否展开 | bool | false |
