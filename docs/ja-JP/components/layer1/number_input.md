# 数値入力

数値入力コンポーネントは、ステッパー対応の数値入力を提供します。

## 基本的な使い方

```_hikari_component
pages/components/layer1/number_input#basic
```

## ステッパー付き

```_hikari_component
pages/components/layer1/number_input#stepper
```

## API

| プロパティ | 説明 | 型 | デフォルト値 |
|----------|-------------|------|---------|
| value | 現在の値 | i64 | 0 |
| min | 最小値 | Option\<i64\> | None |
| max | 最大値 | Option\<i64\> | None |
| step | ステップサイズ | i64 | 1 |
