# Number Input 數字輸入框

Number Input 組件用於數字輸入，支持步進器。

## 基礎用法

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

## 尺寸規格

支持三種尺寸：小、中（預設）、大。

```hikari
rsx! {
    div { style: "display:flex;gap:12px;padding:1rem;align-items:center;",
        input { type: "text", value: "1", style: "padding:4px 8px;width:50px;border:1px solid #ccc;border-radius:4px;font-size:12px;text-align:center;" }
        input { type: "text", value: "10", style: "padding:8px 12px;width:60px;border:1px solid #ccc;border-radius:6px;font-size:14px;text-align:center;" }
        input { type: "text", value: "100", style: "padding:12px 16px;width:80px;border:1px solid #ccc;border-radius:8px;font-size:16px;text-align:center;" }
    }
}
```

## 禁用狀態

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

## 步進器與範圍限制

可以設定最小值、最大值和步長。

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

| 屬性 | 說明 | 類型 | 預設值 |
|------|------|------|--------|
| value | 當前值 | i64 | 0 |
| on_change | 值變化回調 | EventHandler<i64> | - |
| min | 最小值 | Option<i64> | None |
| max | 最大值 | Option<i64> | None |
| step | 步長 | i64 | 1 |
| disabled | 是否禁用 | bool | false |
| size | 尺寸大小 | NumberInputSize | Medium |
| class | 自定義類名 | String | "" |
| style | 自定義樣式 | String | "" |

### NumberInputSize

- `Small` - 小尺寸 (24px)
- `Medium` - 中尺寸 (32px，預設)
- `Large` - 大尺寸 (40px)
