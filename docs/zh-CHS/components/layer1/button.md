# Button 按钮

Button 组件是最基础的用户交互组件，支持多种样式和状态。

按钮用于触发操作或事件，如提交表单、打开对话框、取消操作或执行删除操作。

## 按钮变体

支持 Primary、Secondary、Ghost、Danger 四种变体。

```_hikari_component
pages/components/layer1/button#variants
```

## 禁用状态

按钮可以被禁用，禁用状态下不可点击。

```_hikari_component
pages/components/layer1/button#disabled
```

## 图标按钮尺寸

图标按钮支持小(24px)、中(32px)、大(40px)三种尺寸。

```_hikari_component
pages/components/layer1/button#icon
```

## 图标按钮变体

图标按钮支持 Ghost、Primary、Secondary、Danger、Success 五种颜色变体。

```_hikari_component
pages/components/layer1/button#icon-variants
```

## 图标按钮尺寸对比

展示 Primary 变体在不同尺寸下的效果。

```_hikari_component
pages/components/layer1/button#icon-sizes
```

## API

### Button Props

| 属性 | 说明 | 类型 | 默认值 |
|------|------|------|--------|
| variant | 按钮样式变体 | ButtonVariant | Primary |
| size | 按钮尺寸 | ButtonSize | Medium |
| disabled | 是否禁用 | bool | false |
| children | 按钮内容 | Element | - |

### IconButton Props

| 属性 | 说明 | 类型 | 默认值 |
|------|------|------|--------|
| icon | 图标 | MdiIcon | - |
| size | 按钮尺寸 | IconButtonSize | Large |
| variant | 颜色变体 | IconButtonVariant | Ghost |
| glow | 是否启用发光效果 | bool | true |
| disabled | 是否禁用 | bool | false |
| onclick | 点击回调 | EventHandler\<MouseEvent\> | - |
