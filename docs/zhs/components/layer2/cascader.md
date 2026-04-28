# Cascader 级联选择

级联选择器用于多级数据选择。

## 基础用法

```_hikari_component
pages/components/layer2/cascader#basic
```

## API

| 属性 | 说明 | 类型 | 默认值 |
|------|------|------|--------|
| options | 选项数据 | Vec\<CascaderOption\> | - |
| value | 当前值 | Option\<String\> | None |
| on_change | 变化回调 | EventHandler\<String\> | - |
