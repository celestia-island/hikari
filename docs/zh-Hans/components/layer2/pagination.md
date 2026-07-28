# Pagination 分页

分页组件用于数据分页展示。

## 基础用法

```hikari
rsx! {
    div { style: "padding:1rem;display:flex;gap:4px;align-items:center;font-size:14px;",
        button { style: "padding:4px 10px;border:1px solid #ccc;border-radius:4px;cursor:pointer;", "‹" }
        span { style: "padding:4px 10px;background:#3a6ea5;color:#fff;border-radius:4px;", "1" }
        button { style: "padding:4px 10px;border:1px solid #ccc;border-radius:4px;cursor:pointer;", "2" }
        button { style: "padding:4px 10px;border:1px solid #ccc;border-radius:4px;cursor:pointer;", "›" }
    }
}
```

## API

| 属性 | 说明 | 类型 | 默认值 |
|------|------|------|--------|
| total | 总条数 | usize | 0 |
| page_size | 每页条数 | usize | 10 |
| current | 当前页 | usize | 1 |
