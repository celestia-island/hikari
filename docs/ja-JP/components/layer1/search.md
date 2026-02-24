# 検索

検索コンポーネントは、検索入力用のコンポーネントです。

## 基本的な使い方

```_hikari_component
pages/components/layer1/search#basic
```

## 音声入力

音声入力機能をサポートしています。マイクアイコンをクリックして録音を開始します。

```_hikari_component
pages/components/layer1/search#voice
```

## API

| プロパティ | 説明 | 型 | デフォルト値 |
|----------|-------------|------|---------|
| placeholder | プレースホルダーテキスト | String | "検索..." |
| on_search | 検索コールバック | Option\<EventHandler\<String\>\> | None |
| voice_input | 音声入力を有効にする | bool | false |
