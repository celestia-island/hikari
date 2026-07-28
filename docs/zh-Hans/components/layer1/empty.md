# Empty 空状态

Empty 组件用于展示空数据状态。

## 基础用法

```hikari
rsx! {
    div { style: "padding:2rem;text-align:center;color:#999;",
        p { style: "font-size:14px;margin:0;", "No data available" }
    }
}
```

## API

| 属性 | 说明 | 类型 | 默认值 |
|------|------|------|--------|
| description | 描述文字 | Option\<String\> | None |
