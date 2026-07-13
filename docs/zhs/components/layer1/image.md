# Image 图片

Image 组件用于展示图片，支持加载状态和错误处理。

## 基础用法

```hikari
rsx! {
    div { style: "padding:1rem;",
        img { src: "https://via.placeholder.com/200x120", alt: "Sample", style: "border-radius:8px;max-width:100%;" }
    }
}
```

## 加载占位

```hikari
rsx! {
    div { style: "padding:1rem;",
        div { style: "width:200px;height:120px;background:#f0f0f0;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#999;", "No Image" }
    }
}
```

## API

| 属性 | 说明 | 类型 | 默认值 |
|------|------|------|--------|
| src | 图片地址 | String | - |
| alt | 替代文字 | String | - |
| width | 宽度 | Option\<String\> | None |
| height | 高度 | Option\<String\> | None |
