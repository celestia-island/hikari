# カスケード

カスケードは、多段階データ選択に使用されます。

## 基本的な使い方

```_hikari_component
pages/components/layer2/cascader#basic
```

## API

| プロパティ | 説明 | 型 | デフォルト値 |
|----------|-------------|------|---------|
| options | オプションデータ | Vec\<CascaderOption\> | - |
| value | 現在の値 | Option\<String\> | None |
| on_change | 変更コールバック | EventHandler\<String\> | - |
