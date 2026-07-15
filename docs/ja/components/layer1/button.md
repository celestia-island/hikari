# Button

Buttonコンポーネントは最も基本的なユーザーインタラクションコンポーネントで、複数のスタイルと状態をサポートしています。

ボタンはフォームの送信、ダイアログを開く、操作のキャンセル、削除操作の実行などのアクションやイベントをトリガーするために使用されます。

## ボタンバリアント

Primary、Secondary、Ghost、Dangerの4つのバリアントをサポートしています。

```hikari
rsx! {
    div { style: "display:flex;gap:8px;padding:1rem;flex-wrap:wrap;",
        button { style: "padding:6px 16px;border:none;border-radius:4px;background:#3a6ea5;color:#fff;cursor:pointer;", "Primary" }
        button { style: "padding:6px 16px;border:1px solid #ccc;border-radius:4px;background:#fff;color:#333;cursor:pointer;", "Secondary" }
        button { style: "padding:6px 16px;border:none;border-radius:4px;background:transparent;color:#3a6ea5;cursor:pointer;", "Ghost" }
        button { style: "padding:6px 16px;border:none;border-radius:4px;background:#ef4444;color:#fff;cursor:pointer;", "Danger" }
    }
}
```

## 無効状態

ボタンは無効にすることができ、無効状態ではクリックできません。

```hikari
rsx! {
    div { style: "display:flex;gap:8px;padding:1rem;",
        button { style: "padding:6px 16px;border:none;border-radius:4px;background:#3a6ea5;color:#fff;", "Normal" }
        button { disabled: true, style: "padding:6px 16px;border:none;border-radius:4px;background:#ccc;color:#999;cursor:not-allowed;", "Disabled" }
    }
}
```

## アイコンボタンサイズ

アイコンボタンは小（24px）、中（32px）、大（40px）の3つのサイズをサポートしています。

```hikari
rsx! {
    div { style: "display:flex;gap:12px;padding:1rem;align-items:center;",
        button { style: "width:24px;height:24px;border:1px solid #ccc;border-radius:4px;background:#fff;cursor:pointer;", "" }
        button { style: "width:32px;height:32px;border:1px solid #ccc;border-radius:4px;background:#fff;cursor:pointer;", "" }
        button { style: "width:40px;height:40px;border:1px solid #ccc;border-radius:4px;background:#fff;cursor:pointer;", "" }
    }
}
```

## アイコンボタンバリアント

アイコンボタンはGhost、Primary、Secondary、Danger、Successの5つのカラーバリアントをサポートしています。

```hikari
rsx! {
    div { style: "display:flex;gap:8px;padding:1rem;",
        button { style: "width:32px;height:32px;border:none;border-radius:4px;background:transparent;color:#666;cursor:pointer;", "G" }
        button { style: "width:32px;height:32px;border:none;border-radius:4px;background:#3a6ea5;color:#fff;cursor:pointer;", "P" }
        button { style: "width:32px;height:32px;border:1px solid #ccc;border-radius:4px;background:#fff;color:#333;cursor:pointer;", "S" }
        button { style: "width:32px;height:32px;border:none;border-radius:4px;background:#ef4444;color:#fff;cursor:pointer;", "D" }
        button { style: "width:32px;height:32px;border:none;border-radius:4px;background:#22c55e;color:#fff;cursor:pointer;", "✓" }
    }
}
```

## API

### Button Props

| プロパティ | 説明 | 型 | デフォルト |
|------------|------|-----|------------|
| variant | ボタンスタイルバリアント | ButtonVariant | Primary |
| size | ボタンサイズ | ButtonSize | Medium |
| disabled | 無効かどうか | bool | false |
| children | ボタンコンテンツ | Element | - |

### IconButton Props

| プロパティ | 説明 | 型 | デフォルト |
|------------|------|-----|------------|
| icon | 表示するアイコン | MdiIcon | - |
| size | ボタンサイズ | IconButtonSize | Large |
| variant | カラーバリアント | IconButtonVariant | Ghost |
| glow | グロー効果を有効にする | bool | true |
| disabled | 無効かどうか | bool | false |
| onclick | クリックハンドラー | EventHandler\<MouseEvent\> | - |
