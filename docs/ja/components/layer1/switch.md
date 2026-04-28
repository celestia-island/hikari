# スイッチコンポーネント

スイッチコンポーネントは複数の色とバリアントでトグル機能を提供します。

## スイッチ基本

Success、Primary、Secondary、Danger、Warning、Infoの複数の色をサポートしています。

```_hikari_component
pages/components/layer1/switch#switch
```

## スイッチアイコンバリアント

アイコン付きスイッチ、デフォルトで✓と✗シンボルを提供します。

```_hikari_component
pages/components/layer1/switch#icon
```

## スイッチテキストバリアント

テキストラベル付きスイッチ、スライダー幅を自動調整します。

```_hikari_component
pages/components/layer1/switch#text
```

## スイッチサイズバリアント

Small、Medium、Largeサイズをサポートしています。

```_hikari_component
pages/components/layer1/switch#sizes
```

## Progress

操作の進行状況を表示するプログレスバーコンポーネント。

```_hikari_component
pages/components/layer1/switch#progress
```

## Slider

数値選択用のスライダーコンポーネント。

```_hikari_component
pages/components/layer1/switch#slider
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
