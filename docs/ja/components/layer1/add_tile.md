# 追加タイル

HkAddTile は「点線でアクションを招く」標準コンポーネントです：リストの
空状態、リスト末尾の「もう一件追加」行、ファイル選択 / ドロップ領域。
一つの解剖学に、三つの正式なフォーム。

## 基本的な使い方

```hikari:tsx
<HkAddTile onClick={openAdd}>ソースが未登録です。追加して開始</HkAddTile>
```

Vue ランタイムが先行実装。Rust ミラーは Rust ホストの需要が出た時点で
追従します。

## フォーム

- デフォルト：中央寄せの縦ブロック（アイコンはラベルの上）——リストや
  パネルの空状態。
- `compact`：細い横一行（「＋ 追加」）——行リストの末尾に置き、リストの
  下に浮く遊離ボタンを置き換えます。
- `droppable`：どのフォームでもファイルのドラッグを追加で受け付けます。
  ドラッグ状態は既存のドラッグオーバーレイと同じ視覚言語（主色の点線 +
  主色の淡い床）。ファイルが 1 つ以上あるドロップだけが `drop-files` を
  発火します——テキスト / URL のドロップは無視されるため、ホストは
  ペイロードを信頼できます。

## API

| Property | Description | Type | Default |
|----------|-------------|------|---------|
| disabled | クリックを無効化し、ドラッグも拒否 | boolean | false |
| droppable | ファイルドラッグを受け付け（非空 drop のみ） | boolean | false |
| compact | リスト末尾の細行フォーム | boolean | false |
| icon | アイコンコンポーネント（lucide スタイル） | Component | Plus |

| Slot | Description |
|------|-------------|
| default | ラベルテキスト |
| icon | デフォルトグリフの上書き |

| Event | Description |
|-------|-------------|
| click | タイル起動（ネイティブ MouseEvent） |
| drop-files | ファイル 1 件以上のドロップ——`(files: File[], event: DragEvent)` |
