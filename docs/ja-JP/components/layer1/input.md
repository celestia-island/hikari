# Input 入力欄

Input コンポーネントは、複数の状態とカスタムスタイルをサポートする基本的なフォーム入力コンポーネントです。

## 3層構成

Input コンポーネントは、3層の CSS 変数設定アーキテクチャをサポートしています：

- **Layer1 (ベース層)**: テーマを通じてグローバルなデフォルト値を定義
- **Layer2 (コンポーネント層)**: `input-vars.scss` を通じてコンポーネント変数を定義
- **Custom (ランタイム)**: コンポーネントプロパティを通じて動的に上書き

## 基本的な使い方

```_hikari_component
pages/components/layer1/input#basic
```

## 無効状態

入力欄は無効にすることができ、無効状態では編集できません。

```_hikari_component
pages/components/layer1/input#disabled
```

## カスタムカラー

Custom レイヤーのプロパティを通じて、入力欄の色を動的に上書きできます。

```rust
Input {
    placeholder: "Custom styled input",
    text_color: Some("#ff0000".to_string()),        // カスタムテキスト色
    border_color: Some("#ff4f00".to_string()),       // カスタムボーダー色
    background_color: Some("rgba(255, 255, 255, 0.1)".to_string()), // カスタム背景色
}
```

## CSS 変数の上書き

`css_vars` プロパティを通じて CSS 変数を一括上書きできます。

```rust
Input {
    placeholder: "CSS Variables Override",
    css_vars: Some(vec![
        ("--hi-input-radius", "16px".to_string()),
        ("--hi-input-border-color-focus", "#22c55e".to_string()),
        ("--hi-input-shadow-focus", "0 0 0 2px rgba(34, 197, 94, 0.3)".to_string()),
    ]),
}
```

## アニメーション統合

`animation_id` プロパティを通じて AnimationBuilder と統合してアニメーション効果を実現できます。

```rust
Input {
    placeholder: "Animated Input",
    animation_id: Some("animated-input".to_string()),
}

// AnimationBuilder でアニメーションを制御
AnimationBuilder::new()
    .style("--hi-input-border-color", "rgb(255, 79, 0)")
    .style("--hi-input-shadow-focus", "0 0 0 2px rgba(255, 79, 0, 0.3)")
    .duration(300)
    .apply_to_element("animated-input");
```

## API

### Input Props

| プロパティ | 説明 | 型 | デフォルト |
|-----------|----------|------|-----------|
| size | 入力欄のサイズ | InputSize | Medium |
| disabled | 無効かどうか | bool | false |
| readonly | 読み取り専用かどうか | bool | false |
| placeholder | プレースホルダーテキスト | Option\<String\> | None |
| value | 入力値 | Option\<String\> | None |
| input_type | 入力タイプ | Option\<String\> | "text" |
| autofocus | 自動フォーカスするか | bool | false |
| class | カスタム CSS クラス | String | "" |
| prefix_icon | 接頭辞アイコン | Option\<Element\> | None |
| suffix_icon | 接尾辞アイコン | Option\<Element\> | None |
| oninput | 入力コールバック | Option\<EventHandler\<String\>\> | None |
| onfocus | フォーカスコールバック | Option\<EventHandler\<FocusEvent\>\> | None |
| onblur | ブラー コールバック | Option\<EventHandler\<FocusEvent\>\> | None |
| onkeydown | キー押下コールバック | Option\<EventHandler\<KeyboardEvent\>\> | None |
| glow | グロー効果を有効にするか | bool | true |
| glow_blur | グローブラーストレングス | GlowBlur | Medium |
| glow_intensity | グロー強度 | GlowIntensity | Soft |
| glow_color | グロー色 | GlowColor | Ghost |
| **Custom レイヤープロパティ** | | | |
| text_color | カスタムテキスト色 | Option\<String\> | None |
| placeholder_color | カスタムプレースホルダー色 | Option\<String\> | None |
| border_color | カスタムボーダー色 | Option\<String\> | None |
| background_color | カスタム背景色 | Option\<String\> | None |
| animation_id | AnimationBuilder アニメーション ID | Option\<String\> | None |
| css_vars | CSS 変数一括上書き | Option\<Vec\<(&'static str, String)\>\> | None |

## CSS 変数リファレンス

### Input CSS 変数

| 変数名 | 説明 | デフォルト |
|--------|----------|-----------|
| --hi-input-text-color | テキスト色 | var(--hi-color-text-primary) |
| --hi-input-text-color-disabled | 無効時のテキスト色 | var(--hi-color-text-disabled) |
| --hi-input-placeholder-color | プレースホルダー色 | var(--hi-color-text-secondary) |
| --hi-input-placeholder-opacity | プレースホルダー不透明度 | 0.6 |
| --hi-input-bg | 背景色 | transparent |
| --hi-input-bg-disabled | 無効時の背景 | rgba(255, 255, 255, 0.5) |
| --hi-input-border-color | ボーダー色 | var(--hi-color-border) |
| --hi-input-border-color-focus | フォーカス時のボーダー色 | var(--hi-color-primary) |
| --hi-input-border-color-disabled | 無効時のボーダー色 | var(--hi-border-color-disabled) |
| --hi-input-border-color-error | エラー時のボーダー色 | var(--hi-color-danger) |
| --hi-input-shadow-focus | フォーカスシャドウ | 0 0 0 2px var(--hi-color-primary) |
| --hi-input-radius | 角丸 | var(--hi-radius-md) |
| --hi-input-padding-x | 水平パディング | 0.75rem |
| --hi-input-padding-y | 垂直パディング | 0.5rem |
| --hi-input-font-size | フォントサイズ | var(--hi-font-size-sm) |

## 関連ドキュメント

- [デザインシステム概要](../../design-system/overview.md)
- [Layer1 ベースレイヤー](../../design-system/layer1.md)
- [Layer2 コンポーネントレイヤー](../../design-system/layer2.md)
- [Custom カスタムレイヤー](../../design-system/custom.md)
