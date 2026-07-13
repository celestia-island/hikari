# スイッチコンポーネント

スイッチコンポーネントは複数の色とバリアントでトグル機能を提供します。

## スイッチ基本

Success、Primary、Secondary、Danger、Warning、Infoの複数の色をサポートしています。

```hikari
rsx! {
    div { style: "padding:1rem;display:flex;gap:16px;align-items:center;",
        div { style: "width:40px;height:22px;border-radius:11px;background:#3a6ea5;position:relative;",
            div { style: "position:absolute;right:2px;top:2px;width:18px;height:18px;border-radius:50%;background:#fff;" }
        }
        div { style: "width:40px;height:22px;border-radius:11px;background:#ccc;position:relative;",
            div { style: "position:absolute;left:2px;top:2px;width:18px;height:18px;border-radius:50%;background:#fff;" }
        }
    }
}
```

## スイッチアイコンバリアント

アイコン付きスイッチ、デフォルトで✓と✗シンボルを提供します。

```hikari
rsx! {
    div { style: "padding:1rem;display:flex;gap:8px;align-items:center;",
        span { style: "font-size:16px;", "🌙" }
        div { style: "width:40px;height:22px;border-radius:11px;background:#3a6ea5;position:relative;",
            div { style: "position:absolute;right:2px;top:2px;width:18px;height:18px;border-radius:50%;background:#fff;" } }
        span { style: "font-size:16px;", "☀" }
    }
}
```

## スイッチテキストバリアント

テキストラベル付きスイッチ、スライダー幅を自動調整します。

```hikari
rsx! {
    div { style: "padding:1rem;display:flex;gap:8px;align-items:center;",
        span { style: "font-size:14px;color:#666;", "Off" }
        div { style: "width:40px;height:22px;border-radius:11px;background:#3a6ea5;position:relative;",
            div { style: "position:absolute;right:2px;top:2px;width:18px;height:18px;border-radius:50%;background:#fff;" } }
        span { style: "font-size:14px;color:#333;", "On" }
    }
}
```

## スイッチサイズバリアント

Small、Medium、Largeサイズをサポートしています。

```hikari
rsx! {
    div { style: "padding:1rem;display:flex;gap:16px;align-items:center;",
        div { style: "width:28px;height:16px;border-radius:8px;background:#3a6ea5;position:relative;",
            div { style: "position:absolute;right:1px;top:1px;width:14px;height:14px;border-radius:50%;background:#fff;" } }
        div { style: "width:40px;height:22px;border-radius:11px;background:#3a6ea5;position:relative;",
            div { style: "position:absolute;right:2px;top:2px;width:18px;height:18px;border-radius:50%;background:#fff;" } }
        div { style: "width:52px;height:28px;border-radius:14px;background:#3a6ea5;position:relative;",
            div { style: "position:absolute;right:2px;top:2px;width:24px;height:24px;border-radius:50%;background:#fff;" } }
    }
}
```

## Progress

操作の進行状況を表示するプログレスバーコンポーネント。

```hikari
rsx! {
    div { style: "padding:1rem;",
        div { style: "width:200px;height:6px;background:#e2e2ea;border-radius:3px;overflow:hidden;",
            div { style: "width:60%;height:100%;background:#3a6ea5;border-radius:3px;" }
        }
    }
}
```

## Slider

数値選択用のスライダーコンポーネント。

```hikari
rsx! {
    div { style: "padding:1rem;",
        input { type: "range", min: "0", max: "100", value: "60", style: "width:200px;" }
    }
}
```

## API

### SwitchProps

| プロパティ | 型 | デフォルト | 説明 |
|------------|-----|------------|------|
| checked | `bool` | `false` | チェック状態 |
| on_change | `EventEmitter<bool>` | - | 状態変更コールバック |
| disabled | `bool` | `false` | 無効かどうか |
| size | `SwitchSize` | `Medium` | サイズ |
| variant | `SwitchVariant` | `Default` | バリアントタイプ |
| color | `SwitchColor` | `Success` | チェック時の色 |
| checked_content | `Option<SwitchContent>` | `None` | チェック時のコンテンツ |
| unchecked_content | `Option<SwitchContent>` | `None` | 未チェック時のコンテンツ |

### SwitchVariant

| 値 | 説明 |
|-----|------|
| `Default` | デフォルトスタイル（ドット） |
| `Text` | テキストバリアント |
| `Icon` | アイコンバリアント |
| `Custom` | カスタムバリアント |

### SwitchColor

| 値 | 説明 |
|-----|------|
| `Success` | 成功/オン（緑、デフォルト） |
| `Primary` | プライマリカラー（青） |
| `Secondary` | セカンダリカラー（紫） |
| `Danger` | 危険（赤） |
| `Warning` | 警告（黄） |
| `Info` | 情報（インディゴ） |

### SwitchContent

| 値 | 説明 |
|-----|------|
| `Text(String)` | テキストコンテンツ |
| `Icon(SwitchIcon)` | アイコンコンテンツ |
| `Image(String)` | 画像URL |

### SwitchIcon

| 値 | 説明 |
|-----|------|
| `Check` | チェックアイコン |
| `Close` | 閉じるアイコン |
| `Plus` | プラスアイコン |
| `Minus` | マイナスアイコン |
| `Custom(&'static str)` | カスタムSVGパス |
