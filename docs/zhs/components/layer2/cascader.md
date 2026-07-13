# Cascader 级联选择

级联选择器用于多级数据选择。

## 基础用法

```hikari
rsx! {
    div { style: "padding:1rem;",
        select { style: "padding:6px 12px;border:1px solid #ccc;border-radius:4px;font-size:14px;",
            option { "Province / City / District" }
        }
    }
}
```

## API

| 属性 | 说明 | 类型 | 默认值 |
|------|------|------|--------|
| options | 选项数据 | Vec\<CascaderOption\> | - |
| value | 当前值 | Option\<String\> | None |
| on_change | 变化回调 | EventHandler\<String\> | - |
