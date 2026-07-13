# Avatar 头像

Avatar 组件用于展示用户或实体的头像图像。

## 尺寸

支持五种尺寸：Xs、Sm、Md、Lg、Xl。

```hikari
rsx! {
    div { style: "display:flex;gap:8px;padding:1rem;align-items:center;",
        div { style: "width:16px;height:16px;border-radius:50%;background:#3a6ea5;display:flex;align-items:center;justify-content:center;color:#fff;font-size:8px;", "XS" }
        div { style: "width:24px;height:24px;border-radius:50%;background:#3a6ea5;display:flex;align-items:center;justify-content:center;color:#fff;font-size:10px;", "S" }
        div { style: "width:32px;height:32px;border-radius:50%;background:#3a6ea5;display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;", "M" }
        div { style: "width:40px;height:40px;border-radius:50%;background:#3a6ea5;display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;", "L" }
        div { style: "width:48px;height:48px;border-radius:50%;background:#3a6ea5;display:flex;align-items:center;justify-content:center;color:#fff;font-size:16px;", "XL" }
    }
}
```

## 形状变体

支持三种形状：Circular（圆形）、Rounded（圆角）、Square（方形）。

```hikari
rsx! {
    div { style: "display:flex;gap:12px;padding:1rem;align-items:center;",
        div { style: "width:40px;height:40px;border-radius:50%;background:#3a6ea5;display:flex;align-items:center;justify-content:center;color:#fff;", "A" }
        div { style: "width:40px;height:40px;border-radius:8px;background:#3a6ea5;display:flex;align-items:center;justify-content:center;color:#fff;", "B" }
        div { style: "width:40px;height:40px;border-radius:0;background:#3a6ea5;display:flex;align-items:center;justify-content:center;color:#fff;", "C" }
    }
}
```

## 文字回退

当没有图片时，显示首字母或自定义文字。

```hikari
rsx! {
    div { style: "display:flex;gap:8px;padding:1rem;",
        div { style: "width:40px;height:40px;border-radius:50%;background:#3a6ea5;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:600;", "JD" }
    }
}
```

## API

### Props

| 属性 | 说明 | 类型 | 默认值 |
|------|------|------|--------|
| src | 图片地址 | Option\<String\> | None |
| alt | 替代文字 | String | - |
| size | 尺寸 | AvatarSize | Md |
| variant | 形状变体 | AvatarVariant | Circular |
| fallback | 回退文字 | Option\<String\> | None |
