# Search 搜索

搜索输入组件。

## 基础用法

```hikari
rsx! {
    div { style: "padding:1rem;",
        input { type: "search", placeholder: "Search...", style: "padding:8px 12px 8px 36px;border:1px solid #d9d9d9;border-radius:6px;font-size:14px;width:240px;" }
    }
}
```

## 带建议

带建议下拉的搜索。

```hikari
rsx! {
    div { style: "padding:1rem;position:relative;width:240px;",
        input { type: "search", placeholder: "Search...", value: "ru", style: "padding:8px 12px;border:1px solid #3a6ea5;border-radius:6px;font-size:14px;width:100%;" }
        div { style: "margin-top:4px;border:1px solid #e2e2ea;border-radius:6px;box-shadow:0 4px 12px rgba(0,0,0,0.08);",
            div { style: "padding:8px 12px;font-size:14px;background:#f0f7ff;cursor:pointer;", "Rust" }
            div { style: "padding:8px 12px;font-size:14px;cursor:pointer;", "Ruby" }
        }
    }
}
```

## API

| 属性 | 说明 | 类型 | 默认值 |
|------|------|------|--------|
| placeholder | 占位文本 | String | "搜索..." |
| on_search | 搜索回调 | Option\<EventHandler\<String\>\> | None |
| suggestions | 建议列表 | Vec\<String> | [] |
| allow_clear | 显示清除按钮 | bool | true |
| loading | 显示加载状态 | bool | false |
