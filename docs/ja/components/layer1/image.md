# 画像

画像コンポーネントは、読み込み状態とエラー処理付きで画像を表示します。

## 基本的な使い方

```hikari
rsx! {
    div { style: "padding:1rem;",
        img { src: "https://via.placeholder.com/200x120", alt: "Sample", style: "border-radius:8px;max-width:100%;" }
    }
}
```

## 読み込みプレースホルダー

```hikari
rsx! {
    div { style: "padding:1rem;",
        div { style: "width:200px;height:120px;background:#f0f0f0;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#999;", "No Image" }
    }
}
```

## API

| プロパティ | 説明 | 型 | デフォルト値 |
|----------|-------------|------|---------|
| src | 画像URL | String | - |
| alt | 代替テキスト | String | - |
| width | 幅 | Option\<String\> | None |
| height | 高さ | Option\<String\> | None |
