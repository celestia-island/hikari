# Number Input 数字入力

Number Input コンポーネントは、ステッパー機能を備えた数字入力用です。

## 基本の使い方

```_hikari_component
pages/components/layer1/number_input#basic
```

## サイズ

3つのサイズをサポート：小、中（デフォルト）、大。

```_hikari_component
pages/components/layer1/number_input#sizes
```

## 無効状態

```_hikari_component
pages/components/layer1/number_input#disabled
```

## ステッパーと範囲制限

最小値、最大値、ステップサイズを設定できます。

```_hikari_component
pages/components/layer1/number_input#stepper
```

## API

| プロパティ | 説明 | 型 | デフォルト |
|----------|------|-----|-----------|
| value | 現在の値 | i64 | 0 |
| on_change | 値変更コールバック | EventHandler<i64> | - |
| min | 最小値 | Option<i64> | None |
| max | 最大値 | Option<i64> | None |
| step | ステップサイズ | i64 | 1 |
| disabled | 無効かどうか | bool | false |
| size | サイズ | NumberInputSize | Medium |
| class | カスタムクラス名 | String | "" |
| style | カスタムスタイル | String | "" |

### NumberInputSize

- `Small` - 小サイズ (24px)
- `Medium` - 中サイズ (32px、デフォルト)
- `Large` - 大サイズ (40px)
