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

## 图标按钮

支持小、中、大三种尺寸的图标按钮。

```_hikari_component
pages/components/layer1/button#icon
```

## API

### Props

| 属性 | 说明 | 类型 | 默认值 |
|------|------|------|--------|
| variant | 按钮样式变体 | ButtonVariant | Primary |
| size | 按钮尺寸 | ButtonSize | Medium |
| disabled | 是否禁用 | bool | false |
| children | 按钮内容 | Element | - |
