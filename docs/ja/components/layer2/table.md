# Table

構造化データを表示するためのテーブルコンポーネント。

## 基本的な使用方法

```hikari
rsx! {
    div { style: "padding:1rem;",
        table { style: "border-collapse:collapse;width:100%;font-size:14px;",
            thead { tr { th { style: "border:1px solid #e2e2ea;padding:8px;background:#f7f7fa;text-align:left;", "Name" }
                         th { style: "border:1px solid #e2e2ea;padding:8px;background:#f7f7fa;text-align:left;", "Status" } } }
            tbody { tr { td { style: "border:1px solid #e2e2ea;padding:8px;", "Task A" }
                         td { style: "border:1px solid #e2e2ea;padding:8px;color:#22c55e;", "Done" } } }
        }
    }
}
```

## API

| プロパティ | 説明 | 型 | デフォルト |
|------------|------|-----|------------|
| columns | 列定義 | Vec\<Column\> | - |
| data | データソース | Vec\<T\> | - |
