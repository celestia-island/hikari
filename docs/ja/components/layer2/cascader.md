# カスケード

カスケードは、多段階データ選択に使用されます。

## 基本的な使い方

```hikari
rsx! {
    div { style: "padding:1rem;",
        select { style: "padding:6px 12px;border:1px solid #ccc;border-radius:4px;font-size:14px;",
            option { "Province / City / District" }
        }
    }
}
```

## API

| プロパティ | 説明 | 型 | デフォルト値 |
|----------|-------------|------|---------|
| options | オプションデータ | Vec\<CascaderOption\> | - |
| value | 現在の値 | Option\<String\> | None |
| on_change | 変更コールバック | EventHandler\<String\> | - |
