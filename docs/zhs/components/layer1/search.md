# Search 搜索

搜索输入组件。

## 基础用法

```_hikari_component
pages/components/layer1/search#basic
```

## 带建议

带建议下拉的搜索。

```_hikari_component
pages/components/layer1/search#suggestions
```

## API

| 属性 | 说明 | 类型 | 默认值 |
|------|------|------|--------|
| placeholder | 占位文本 | String | "搜索..." |
| on_search | 搜索回调 | Option\<EventHandler\<String\>\> | None |
| suggestions | 建议列表 | Vec\<String> | [] |
| allow_clear | 显示清除按钮 | bool | true |
| loading | 显示加载状态 | bool | false |
