# UserGuide 用户引导

用户引导组件，用于新功能介绍。

## 基础用法

```_hikari_component
pages/components/layer3/user_guide#basic
```

## API

| 属性 | 说明 | 类型 | 默认值 |
|------|------|------|--------|
| steps | 引导步骤 | Vec\<GuideStep\> | - |
| active | 当前步骤 | usize | 0 |
