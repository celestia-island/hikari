# ズームコントロール

ズームコントロールコンポーネントは、インターフェースのスケーリングに使用されます。

## 基本的な使い方

```hikari
rsx! {
    div { style: "padding:1rem;display:inline-flex;gap:4px;align-items:center;border:1px solid #e2e2ea;border-radius:6px;padding:4px;",
        button { style: "width:28px;height:28px;border:none;background:none;cursor:pointer;font-size:16px;", "−" }
        span { style: "font-size:14px;min-width:40px;text-align:center;", "100%" }
        button { style: "width:28px;height:28px;border:none;background:none;cursor:pointer;font-size:16px;", "+" }
    }
}
```

## API

| プロパティ | 説明 | 型 | デフォルト値 |
|----------|-------------|------|---------|
| zoom | ズームレベル | f64 | 1.0 |
| min | 最小値 | f64 | 0.5 |
| max | 最大値 | f64 | 2.0 |
