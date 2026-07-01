# アイコンシステム

アイコン管理およびレンダリングシステム。Material Design Icons (MDI)と統合されています。

## 概要

`hikari-icons`は以下を提供します：

- **1000以上のアイコン** - 完全なMaterial Design Icons (MDI)コレクション
- **タイプセーフ** - 列挙型ベースのアイコン名
- **SVGレンダリング** - クライアントサイドおよびサーバーサイドレンダリング
- **ランタイム読み込み** - オンデマンドでのアイコンSVG読み込み

## アイコンコンポーネント

### 基本的な使い方

```rust
use hikari_icons::{Icon, MdiIcon};

rsx! {
    Icon {
        icon: MdiIcon::Magnify,
        size: 24,
        color: "var(--hi-color-primary)"
    }
}
```

### 利用可能なアイコン

```rust
pub enum MdiIcon {
    // ナビゲーション
    Home,
    Menu,
    Magnify,
    Cog,
    ChevronDown,
    ChevronLeft,
    ChevronRight,

    // アクション
    Pencil,
    Delete,
    Check,
    Close,
    Plus,
    Minus,

    // ステータス
    AlertCircleOutline,
    CheckCircleOutline,
    InformationOutline,
    AlertOutline,

    // ... 1000以上のアイコン
}
```

### プロパティ

| プロパティ | 型 | デフォルト値 | 説明 |
|----------|------|---------|-------------|
| `icon` | `MdiIcon` | - | アイコンタイプ |
| `size` | `u32` | `24` | アイコンサイズ |
| `color` | `&str` | - | 色 |

## ランタイム読み込み

### クライアントサイドレンダリング

```rust
use hikari_icons::runtime;

// アイコンSVGを非同期で読み込み
async fn load_icon(name: &str) -> Result<String, Error> {
    runtime::load_icon(name).await
}
```

### サーバーサイドレンダリング

```rust
use hikari_icons::server;

// サーバーサイドでアイコンをレンダリング
fn render_icon(name: &str) -> String {
    server::render_icon(name)
}
```

## APIリファレンス

### Icon

```rust
#[component]
pub fn Icon(
    icon: MdiIcon,
    size: Option<u32>,
    color: Option<&str>,
    class: Option<String>,
    style: Option<String>
) -> Element
```

### MdiIcon

```rust
pub enum MdiIcon {
    // 1000以上のアイコンバリアント
}
```

### runtime

```rust
pub mod runtime {
    pub async fn load_icon(name: &str) -> Result<String, Error>;
}
```

### server

```rust
pub mod server {
    pub fn render_icon(name: &str) -> String;
}
```

## 他のシステムとの統合

- **コンポーネント** - Button、Inputなどのコンポーネントで使用されるアイコン
- **Render-service** - 静的アイコンファイルサービス
- **テーマ** - アイコンの色はテーマから継承

## 関連システム

- [コンポーネント](../components/) - アイコンを使用するコンポーネント
- [Render-service](./render-service.md) - アイコンファイルサービス
- [パレット](./palette.md) - アイコンの色
