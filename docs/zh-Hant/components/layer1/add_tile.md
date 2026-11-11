# Add Tile 虛線動作塊

HkAddTile 是「虛線邀請動作」的標準件：列表空態、列表末尾的「再加一項」列、
以及選檔案 / 拖放檔案區。一套解剖，三種法定形態。

## 基礎用法

```hikari:tsx
<HkAddTile onClick={openAdd}>還沒有來源，新增一個開始</HkAddTile>
```

Vue 執行時先落地；Rust 鏡像等出現 Rust 宿主消費時再補。

## 形態

- 預設：置中縱向塊（圖示在上、文字在下）——列表 / 面板的空態。
- `compact`：瘦橫列（「＋ 再加一項」）——掛在列列表的末尾，
  取代懸在列表下方的零散按鈕。
- `droppable`：任意形態都可額外接受檔案拖拽。拖拽態復用既有拖拽
  覆蓋層的視覺語言（虛線主色 + 主色淡底）。只有拖入至少一個檔案才發
  `drop-files`——文字 / URL 拖放被忽略，宿主可以放心依賴載荷。

## API

| Property | Description | Type | Default |
|----------|-------------|------|---------|
| disabled | 停用點擊並拒絕拖放 | boolean | false |
| droppable | 接受檔案拖拽（僅非空 drop） | boolean | false |
| compact | 列表末尾瘦列形態 | boolean | false |
| icon | 圖示元件（lucide 風格） | Component | Plus |

| Slot | Description |
|------|-------------|
| default | 標籤文字 |
| icon | 覆蓋預設圖示 |

| Event | Description |
|-------|-------------|
| click | 啟用（原生 MouseEvent） |
| drop-files | 攜帶 ≥1 個檔案的拖放——`(files: File[], event: DragEvent)` |
