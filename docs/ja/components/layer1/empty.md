# 空状態

空状態コンポーネントは、データが空の状態を表示するために使用されます。

## 基本的な使い方

```hikari
rsx! {
    div { style: "padding:2rem;text-align:center;color:#999;",
        p { style: "font-size:14px;margin:0;", "No data available" }
    }
}
```

## API

| プロパティ | 説明 | 型 | デフォルト値 |
|----------|-------------|------|---------|
| description | 説明テキスト | Option\<String\> | None |
