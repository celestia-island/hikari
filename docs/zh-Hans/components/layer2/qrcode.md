# QRCode 二维码

二维码生成组件。

## 基础用法

```hikari
rsx! {
    div { style: "padding:1rem;",
        div { style: "width:100px;height:100px;background:#000;display:grid;grid-template-columns:repeat(10,1fr);",
            div { style: "background:#fff;aspect-ratio:1;", "" }
        }
    }
}
```

## API

| 属性 | 说明 | 类型 | 默认值 |
|------|------|------|--------|
| value | 二维码内容 | String | - |
| size | 尺寸 | u32 | 128 |
