# アバター

アバターコンポーネントは、ユーザーまたはエンティティのアバター画像を表示するために使用されます。

## サイズ

5つのサイズをサポート：Xs、Sm、Md、Lg、Xl。

```_hikari_component
pages/components/layer1/avatar#sizes
```

## 形状バリアント

3つの形状をサポート：円形、角丸、正方形。

```_hikari_component
pages/components/layer1/avatar#variants
```

## テキストフォールバック

画像がない場合、イニシャルまたはカスタムテキストを表示します。

```_hikari_component
pages/components/layer1/avatar#fallback
```

## API

### プロパティ

| プロパティ | 説明 | 型 | デフォルト値 |
|----------|-------------|------|---------|
| src | 画像URL | Option\<String\> | None |
| alt | 代替テキスト | String | - |
| size | サイズ | AvatarSize | Md |
| variant | 形状バリアント | AvatarVariant | Circular |
| fallback | フォールバックテキスト | Option\<String\> | None |
