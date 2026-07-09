# Hikari UI フレームワーク

Hikari (光) は、以下の技術で構築されたモダンな Rust 向け UI フレームワークです：

- **Tairitsu 0.7** - リアクティブ UI フレームワーク
- **Grass** - SCSS コンパイラ
- **Axum** - SSR 用ウェブサーバー

## 設計理念

Hikari は以下を組み合わせています：

- **アークナイツの美学** - クリーンなライン、高いコントラスト
- **FUI (未来のユーザーインターフェース)** - 発光効果、動的インジケーター
- **伝統的な中国色** - 500 以上の本格的な色名

## クイックスタート

```bash
cargo new my-app
cd my-app
cargo add hikari-components hikari-theme
```

```rust
use hikari_components::{ThemeProvider, Button};

fn App() -> Element {
    rsx! {
        ThemeProvider { palette: "hikari" } {
            Button { label: "こんにちは、Hikari！" }
        }
    }
}
```

## 特徴

- 🎨 500 以上の伝統的な中国色
- 🌙 ライト・ダークテーマ
- 🔧 型安全なユーティリティクラス
- ✨ なめらかなアニメーション
- 📱 レスポンシブコンポーネント
- 🌐 組み込みの i18n サポート

## ドキュメント

完全なドキュメントは [docs.hikari.dev](https://docs.hikari.dev) をご覧ください。
