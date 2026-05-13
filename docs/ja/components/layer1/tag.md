# タグ

タグコンポーネントは、ラベルやマークを表示するために使用されます。

## 基本的な使い方

```_hikari_component
pages/components/layer1/tag#basic
```

## 閉じ可能なタグ

```_hikari_component
pages/components/layer1/tag#closable
```

## API

| プロパティ | 説明 | 型 | デフォルト値 |
|----------|-------------|------|---------|
| children | タグ内容 | Element | - |
| closable | 閉じ可能 | bool | false |
| on_close | 閉じるコールバック | Option\<EventHandler\> | None |
