# Search 搜索

Search 组件用于搜索输入。

## 基础用法

```_hikari_component
pages/components/layer1/search#basic
```

## 语音输入

支持语音输入功能，点击麦克风图标开始录音。

```_hikari_component
pages/components/layer1/search#voice
```

## API

| 属性 | 说明 | 类型 | 默认值 |
|------|------|------|--------|
| placeholder | 占位文字 | String | "搜索..." |
| on_search | 搜索回调 | Option\<EventHandler\<String\>\> | None |
| voice_input | 启用语音输入 | bool | false |
