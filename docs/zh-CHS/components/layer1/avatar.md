# Avatar 头像

Avatar 组件用于展示用户或实体的头像图像。

## 尺寸

支持五种尺寸：Xs、Sm、Md、Lg、Xl。

```_hikari_component
pages/components/layer1/avatar#sizes
```

## 形状变体

支持三种形状：Circular（圆形）、Rounded（圆角）、Square（方形）。

```_hikari_component
pages/components/layer1/avatar#variants
```

## 文字回退

当没有图片时，显示首字母或自定义文字。

```_hikari_component
pages/components/layer1/avatar#fallback
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
