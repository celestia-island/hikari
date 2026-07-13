# Number Input 数字入力

Number Input コンポーネントは、ステッパー機能を備えた数字入力用です。

## 基本の使い方

```hikari
rsx! {
    div { style: "padding:1rem;",
        div { style: "display:inline-flex;border:1px solid #d9d9d9;border-radius:6px;overflow:hidden;",
            button { style: "padding:4px 12px;border:none;background:#f5f5f5;cursor:pointer;", "−" }
            input { type: "text", value: "0", style: "padding:8px;width:60px;border:none;text-align:center;font-size:14px;" }
            button { style: "padding:4px 12px;border:none;background:#f5f5f5;cursor:pointer;", "+" }
        }
    }
}
```

## サイズ

3つのサイズをサポート：小、中（デフォルト）、大。

```hikari
rsx! {
    div { style: "display:flex;gap:12px;padding:1rem;align-items:center;",
        input { type: "text", value: "1", style: "padding:4px 8px;width:50px;border:1px solid #ccc;border-radius:4px;font-size:12px;text-align:center;" }
        input { type: "text", value: "10", style: "padding:8px 12px;width:60px;border:1px solid #ccc;border-radius:6px;font-size:14px;text-align:center;" }
        input { type: "text", value: "100", style: "padding:12px 16px;width:80px;border:1px solid #ccc;border-radius:8px;font-size:16px;text-align:center;" }
    }
}
```

## 無効状態

```hikari
rsx! {
    div { style: "padding:1rem;",
        div { style: "display:inline-flex;border:1px solid #d9d9d9;border-radius:6px;overflow:hidden;opacity:0.5;",
            button { disabled: true, style: "padding:4px 12px;border:none;background:#f5f5f5;", "−" }
            input { type: "text", value: "0", disabled: true, style: "padding:8px;width:60px;border:none;text-align:center;" }
            button { disabled: true, style: "padding:4px 12px;border:none;background:#f5f5f5;", "+" }
        }
    }
}
```

## ステッパーと範囲制限

最小値、最大値、ステップサイズを設定できます。

```hikari
rsx! {
    div { style: "padding:1rem;",
        div { style: "display:inline-flex;border:1px solid #d9d9d9;border-radius:6px;",
            button { style: "padding:8px 16px;border:none;background:#3a6ea5;color:#fff;cursor:pointer;", "−" }
            span { style: "padding:8px 24px;font-size:16px;font-weight:600;", "5" }
            button { style: "padding:8px 16px;border:none;background:#3a6ea5;color:#fff;cursor:pointer;", "+" }
        }
    }
}
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
