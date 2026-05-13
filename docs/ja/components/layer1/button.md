# Button

Buttonコンポーネントは最も基本的なユーザーインタラクションコンポーネントで、複数のスタイルと状態をサポートしています。

ボタンはフォームの送信、ダイアログを開く、操作のキャンセル、削除操作の実行などのアクションやイベントをトリガーするために使用されます。

## ボタンバリアント

Primary、Secondary、Ghost、Dangerの4つのバリアントをサポートしています。

```_hikari_component
pages/components/layer1/button#variants
```

## 無効状態

ボタンは無効にすることができ、無効状態ではクリックできません。

```_hikari_component
pages/components/layer1/button#disabled
```

## アイコンボタンサイズ

アイコンボタンは小（24px）、中（32px）、大（40px）の3つのサイズをサポートしています。

```_hikari_component
pages/components/layer1/button#icon-sizes
```

## アイコンボタンバリアント

アイコンボタンはGhost、Primary、Secondary、Danger、Successの5つのカラーバリアントをサポートしています。

```_hikari_component
pages/components/layer1/button#icon-variants
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
