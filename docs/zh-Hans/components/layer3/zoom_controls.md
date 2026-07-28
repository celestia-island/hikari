# ZoomControls 缩放控制

缩放控制组件，用于界面缩放。

## 基础用法

```hikari
rsx! {
    div { style: "padding:1rem;display:inline-flex;gap:4px;align-items:center;border:1px solid #e2e2ea;border-radius:6px;padding:4px;",
        button { style: "width:28px;height:28px;border:none;background:none;cursor:pointer;font-size:16px;", "−" }
        span { style: "font-size:14px;min-width:40px;text-align:center;", "100%" }
        button { style: "width:28px;height:28px;border:none;background:none;cursor:pointer;font-size:16px;", "+" }
    }
}
```

## API

| 属性 | 说明 | 类型 | 默认值 |
|------|------|------|--------|
| zoom | 缩放比例 | f64 | 1.0 |
| min | 最小值 | f64 | 0.5 |
| max | 最大值 | f64 | 2.0 |
