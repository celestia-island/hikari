# Avatar 頭像

Avatar 元件用於展示使用者或實體的頭像影像。

## 尺寸

支援五種尺寸：Xs、Sm、Md、Lg、Xl。

```_hikari_component
pages/components/layer1/avatar#sizes
```

## 形狀變體

支援三種形狀：Circular（圓形）、Rounded（圓角）、Square（方形）。

```_hikari_component
pages/components/layer1/avatar#variants
```

## 文字後備

當沒有圖片時，顯示首字母或自訂文字。

```_hikari_component
pages/components/layer1/avatar#fallback
```

## API

### Props

| 屬性 | 說明 | 類型 | 預設值 |
|------|------|------|--------|
| src | 圖片位址 | Option\<String\> | None |
| alt | 替代文字 | String | - |
| size | 尺寸 | AvatarSize | Md |
| variant | 形狀變體 | AvatarVariant | Circular |
| fallback | 後備文字 | Option\<String\> | None |
