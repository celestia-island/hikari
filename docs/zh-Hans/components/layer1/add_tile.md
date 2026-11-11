# Add Tile 虚线动作块

HkAddTile 是「虚线邀请动作」的标准件：列表空态、列表末尾的「再加一项」行、
以及选文件 / 拖放文件区。一套解剖，三种法定形态。

## 基础用法

```hikari:tsx
<HkAddTile onClick={openAdd}>还没有来源，添加一个开始</HkAddTile>
```

Vue 运行时先落地；Rust 镜像等出现 Rust 宿主消费时再补。

## 形态

- 默认：居中纵向块（图标在上、文字在下）——列表 / 面板的空态。
- `compact`：瘦横行（「＋ 再加一项」）——挂在行列表的末尾，
  取代悬在列表下方的零散按钮。
- `droppable`：任意形态都可额外接受文件拖拽。拖拽态复用既有拖拽
  覆盖层的视觉语言（虚线主色 + 主色淡底）。只有拖入至少一个文件才发
  `drop-files`——文本 / URL 拖放被忽略，宿主可以放心依赖载荷。

## API

| Property | Description | Type | Default |
|----------|-------------|------|---------|
| disabled | 停用点击并拒绝拖放 | boolean | false |
| droppable | 接受文件拖拽（仅非空 drop） | boolean | false |
| compact | 列表末尾瘦行形态 | boolean | false |
| icon | 图标组件（lucide 风格） | Component | Plus |

| Slot | Description |
|------|-------------|
| default | 标签文字 |
| icon | 覆盖默认图标 |

| Event | Description |
|-------|-------------|
| click | 激活（原生 MouseEvent） |
| drop-files | 携带 ≥1 个文件的拖放——`(files: File[], event: DragEvent)` |
