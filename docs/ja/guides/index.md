# Hikari UI フレームワーク

> Tairitsu + Grass + Axum で構築されたモダンな Rust UI フレームワーク
>
> **デザインスタイル**: アークナイツ フラットデザイン + 發光效果 + 伝統的な中国色彩
>
> **名前の由来**: リズムゲーム「Arcaea」の「Hikari」（光）

## Hikariとは？

Hikariは、Rustエコシステム向けに設計されたモダンなUIフレームワークで、伝統的な中国色彩の美学とサイバーパンクインターフェースデザインを融合しています。このフレームワークはモジュラーデesignを採用し、完全なコンポーネントライブラリ、テーマシステム、アニメーションシステムを提供します。

## 主な機能

### 🎨 伝統的な中国色彩システム
- **500種類以上の伝統色**: 完全な伝統的な中国色彩パレット
- **テーマシステム**: 組み込みのHikari（ライト）とTairitsu（ダーク）テーマ
- **型安全性**: コンパイル時の色値チェック

### 🧩 豊富なコンポーネントライブラリ
- **基本コンポーネント**: Button, Input, Card, Badge
- **フィードバックコンポーネント**: Alert, Toast, Tooltip, Spotlight
- **ナビゲーションコンポーネント**: Menu, Tabs, Breadcrumb
- **データコンポーネント**: Table, Tree, Pagination
- **レイアウトコンポーネント**: Layout, Header, Aside, Content, Footer
- **拡張コンポーネント**: Collapsible, DragLayer, ZoomControls

### ✨ 強力なアニメーションシステム
- **宣言的アニメーション**: CSSライクなfluent API
- **動的値**: 実行時計算されるアニメーション値
- **イージング関数**: 30種類以上のイージング関数
- **プリセットアニメーション**: フェード、スライド、スケールなど

### 🎯 高度な機能
- **サーバーサイドレンダリング**: 完全なSSRサポート
- **型安全性**: Rustの型システムを完全に活用
- **レスポンシブデザイン**: 組み込みのレスポンシブレイアウトユーティリティ
- **ビルドシステム**: 自動SCSSコンパイルとアセット生成

## クイックスタート

### 依存関係のインストール

`Cargo.toml`に追加:

```toml
[dependencies]
hikari-components = "0.1"
hikari-palette = "0.1"
hikari-theme = "0.1"
tairitsu = "0.5"
```

### 基本的な使用方法

```rust
use hikari_components::{ThemeProvider, Button};
use hikari_theme::ThemeProvider;

#[component]
fn App() -> Element {
    rsx! {
        ThemeProvider { palette: "hikari" } {
            div { class: "hi-flex hi-flex-col hi-gap-4" {
                Button { label: "クリックして" }
                Button { label: "プライマリボタン", variant: "primary" }
                Button { label: "セカンダリボタン", variant: "secondary" }
            }
        }
    }
}
```

### ビルドと実行

```bash
# 開発モード
cargo run

# ビルド
cargo build --release

# WASM ビルド
trunk build --release
```

## デザイン哲学

### アークナイツ フラットデザイン
- クリーンなラインと明確な情報階層
- 読みやすさを重視した高コントラスト
- ミニマルながらも洗練されたデザイン

### 發光效果
- 微細なグロー効果
- ダイナミックなインジケーター（ブリージングライト、パルスアニメーション）
- 繊細なボーダーと幾何学的パターン

### 伝統的な中国色彩
- プライマリ: 石青（シアン/青）、朱砂（ベーミリオン/赤）、藤黄（ガンボージ/黄）
- ニュートラル: 月白（淡い白）、墨色（墨黒）、缟色（淡いグレー）
- 機能色: 葱倩（成功）、鹅黄（警告）、朱砂（危険）

## プロジェクト構造

```
hikari/
├── packages/
│   ├── hikari-palette/          # 伝統的な中国色彩パレット
│   ├── hikari-theme/            # テーマシステム
│   ├── hikari-animation/        # アニメーションシステム
│   ├── hikari-icons/            # アイコンシステム
│   ├── hikari-components/       # コンポーネントライブラリ
│   ├── hikari-extra-components/ # 拡張コンポーネントライブラリ
│
└── examples/
    ├── website/                 # 公式ウェブサイト
    ├── table-demo/              # テーブルコンポーネントデモ
    ├── tree-demo/               # ツリーコンポーネントデモ
    └── node-graph-demo/         # ノードグラフデモ
```

## ドキュメント

- [コンポーネント](./components/) - UIコンポーネント使用ガイド
- [システム](./system/) - コアシステムアーキテクチャ
- [API リファレンス](https://docs.rs/hikari-components) - Rust API ドキュメント

## 例

### テーマ切り替え

```rust
use hikari_theme::ThemeProvider;

fn App() -> Element {
    let mut theme = use_signal(|| "hikari".to_string());

    rsx! {
        ThemeProvider { palette: "{theme}" } {
            button {
                onclick: move |_| {
                    theme.set(if *theme() == "hikari" {
                        "tairitsu".to_string()
                    } else {
                        "hikari".to_string()
                    });
                },
                "テーマ切り替え"
            }
        }
    }
}
```

### アニメーションの使用

```rust
use hikari_animation::{AnimationBuilder, AnimationContext};
use hikari_animation::style::CssProperty;

// 静的アニメーション
AnimationBuilder::new(&elements)
    .add_style("button", CssProperty::Opacity, "0.8")
    .apply_with_transition("300ms", "ease-in-out");

// 動的アニメーション（マウス追従）
AnimationBuilder::new(&elements)
    .add_style_dynamic("button", CssProperty::Transform, |ctx| {
        let x = ctx.mouse_x();
        let y = ctx.mouse_y();
        format!("translate({}px, {}px)", x, y)
    })
    .apply_with_transition("150ms", "ease-out");
```

## コントリビュート

コントリビュートは大歓迎です！詳細は [CONTRIBUTING.md](../../en-US/guides/CONTRIBUTING.md) をお読みください。

## ライセンス

[MIT License](../../../LICENSE)

## 謝辞

- **Tairitsu** - 強力な Rust UI フレームワーク
- [Grass](https://github.com/kaj/kaj) - 純粋な Rust SCSS コンパイラ
- [Element Plus](https://element-plus.org/) - 優れたコンポーネントライブラリデザイン参考
- [Material UI](https://mui.com/) - モダンな UI デザインインスピレーション

---

**Hikari** - ミニマリズム、テクノロジー、文化的自信
