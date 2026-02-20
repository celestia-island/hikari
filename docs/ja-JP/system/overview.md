# システムアーキテクチャ概要

Hikariフレームワークはモジュラーデesignを採用し、それぞれが特定の機能領域を担当する複数の独立したパッケージで構成されています。

## コアシステム

### 1. Palette System (hikari-palette)

伝統的な中国色彩システムのRust実装。

**責任**:
- 500種類以上の伝統的な中国色定義を提供
- テーマパレット管理
- ユーティリティクラスジェネレーター
- 不透明度と色ブレンド

**主な機能**:
```rust
use hikari_palette::{ChineseColor, opacity};

// 伝統色を使用
let red = ChineseColor::Cinnabar;
let blue = ChineseColor::Azurite;

// 不透明度処理
let semi_red = opacity(red, 0.5);

// テーマシステム
let theme = Hikari::default();
println!("プライマリ: {}", theme.primary.hex());
```

**デザイン哲学**:
- **文化的自信**: 伝統的な色名を使用
- **型安全性**: コンパイル時の色値チェック
- **高パフォーマンス**: ゼロコスト抽象化

### 2. Theme System (hikari-theme)

テーマコンテキストとスタイル注入システム。

**責任**:
- テーマプロバイダーコンポーネント
- テーマコンテキスト管理
- CSS変数生成
- テーマ切り替え

**主な機能**:
```rust
use hikari_theme::ThemeProvider;

rsx! {
    ThemeProvider { palette: "hikari" } {
        // アプリケーションコンテンツ
        App {}
    }
}
```

**サポートテーマ**:
- **Hikari (ライト)** - ライトテーマ
  - プライマリ: 藍銅 (#00A0E9)
  - セカンダリ: 朱砂 (#E94B35)
  - アクセント: 藤黄 (#F8B62D)

- **Tairitsu** - ダークテーマ
  - プライマリ: インディゴ (#1a237e)
  - セカンダリ: 朱砂 (#E94B35)
  - アクセント: 鹅黄 (#FFF176)

### 3. Animation System (hikari-animation)

高性能な宣言的アニメーションシステム。

**責任**:
- アニメーションビルダー
- アニメーションコンテキスト
- イージング関数
- プリセットアニメーション

**主な機能**:
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

**アーキテクチャコンポーネント**:
- **builder** - アニメーションビルダーAPI
- **context** - 実行時アニメーションコンテキスト
- **style** - 型安全なCSS操作
- **easing** - 30種類以上のイージング関数
- **tween** - 補間システム
- **timeline** - タイムライン制御
- **presets** - プリセットアニメーション（フェード、スライド、スケール）
- **spotlight** - スポットライト効果

**パフォーマンス機能**:
- WASM最適化
- デバウンス更新
- requestAnimationFrame統合
- リフローとリペイントの最小化

### 4. Icon System (hikari-icons)

アイコン管理とレンダリングシステム。

**責任**:
- アイコン列挙型定義
- SVGコンテンツ生成
- アイコンサイズバリアント
- Lucide Icons統合

**主な機能**:
```rust
use hikari_icons::{Icon, LucideIcon};

rsx! {
    Icon {
        icon: LucideIcon::Search,
        size: 24,
        color: "var(--hi-primary)"
    }
}
```

**アイコンソース**:
- Lucide Icons (1000種類以上のアイコン)
- 拡張可能なカスタムアイコン
- 複数サイズサポート

### 5. Component Library (hikari-components)

完全なUIコンポーネントライブラリ。

**責任**:
- 基本UIコンポーネント
- レイアウトコンポーネント
- スタイルレジストリ
- レスポンシブフック

**コンポーネントカテゴリ**:

1. **基本コンポーネント** (feature: "basic")
   - Button, Input, Card, Badge

2. **フィードバックコンポーネント** (feature: "feedback")
   - Alert, Toast, Tooltip, Spotlight

3. **ナビゲーションコンポーネント** (feature: "navigation")
   - Menu, Tabs, Breadcrumb

4. **レイアウトコンポーネント** (常に利用可能)
   - Layout, Header, Aside, Content, Footer

5. **データコンポーネント** (feature: "data")
   - Table, Tree, Pagination

**モジュラーデザイン**:
```
hikari-components/
├── basic/          # 基本コンポーネント
├── feedback/       # フィードバックコンポーネント
├── navigation/     # ナビゲーションコンポーネント
├── layout/         # レイアウトコンポーネント
├── data/           # データコンポーネント
├── hooks.rs        # Reactフック
├── styled.rs       # スタイルトレイト
└── theme_provider.rs  # テーマプロバイダー
```

**スタイルシステム**:
- SCSSソース
- 型安全なユーティリティクラス
- コンポーネントレベルのスタイル分離
- CSS変数統合

### 6. Build System (hikari-builder)

コンパイル時コード生成とSCSSコンパイル。

**責任**:
- SCSSコンパイル（Grass使用）
- コンポーネント発見
- コード生成
- リソースバンドル

**ビルドプロセス**:
```
1. ワークスペースルートディレクトリを検索
   ↓
2. SCSSファイルをスキャン
   ↓
3. Rust定数を生成
   ↓
4. SCSSバンドルをコンパイル
   ↓
5. public/に出力
```

**使用方法**:
```rust
// build.rs
fn main() {
    hikari_builder::build().expect("ビルド失敗");
}
```

**生成ファイル**:
- `packages/builder/src/generated/components.rs` - コンポーネント定数
- `public/styles/bundle.css` - コンパイル済みCSS

### 7. Render Service (hikari-render-service)

サーバーサイドレンダリングと静的アセット配信。

**責任**:
- HTMLテンプレートレンダリング
- スタイルレジストリ
- ルータービルダー
- 静的アセットサービス
- Axum統合

**主な機能**:
```rust
use hikari_render_service::HikariRenderServicePlugin;

let app = HikariRenderServicePlugin::new()
    .component_style_registry(registry)
    .static_assets("./dist", "/static")
    .add_route("/api/health", get(health_check))
    .build()?;
```

**アーキテクチャモジュール**:
- **html** - HTMLサービス
- **registry** - スタイルレジストリ
- **router** - ルータービルダー
- **static_files** - 静的ファイルサービス
- **styles_service** - スタイル注入
- **plugin** - プラグインシステム

### 8. Extra Components Library (hikari-extra-components)

複雑なインタラクションシナリオ向けの高度なUIコンポーネント。

**責任**:
- 高度なユーティリティコンポーネント
- ドラッグ＆ズームインタラクション
- 折りたたみパネル
- アニメーション統合

**コアコンポーネント**:

1. **Collapsible** - 折りたたみパネル
   - 左右スライドイン/アウトアニメーション
   - 設定可能な幅
   - 展開状態コールバック

2. **DragLayer** - ドラッグレイヤー
   - 境界制約
   - ドラッグイベントコールバック
   - カスタムz-index

3. **ZoomControls** - ズームコントロール
   - キーボードショートカットサポート
   - 設定可能なズーム範囲
   - 複数の配置オプション

**主な機能**:
```rust
use hikari_extra_components::{Collapsible, DragLayer, ZoomControls};

// 折りたたみパネル
Collapsible {
    title: "設定".to_string(),
    expanded: true,
    position: CollapsiblePosition::Right,
    div { "コンテンツ" }
}

// ドラッグレイヤー
DragLayer {
    initial_x: 100.0,
    initial_y: 100.0,
    constraints: DragConstraints {
        min_x: Some(0.0),
        max_x: Some(500.0),
        ..Default::default()
    },
    div { "ドラッグして" }
}

// ズームコントロール
ZoomControls {
    zoom: 1.0,
    on_zoom_change: move |z| println!("ズーム: {}", z)
}
```

## アーキテクチャ原則

### 1. モジュラーデザイン

各パッケージは独立しており、個別に使用可能:

```toml
# パレットのみ使用
[dependencies]
hikari-palette = "0.1"

# コンポーネントとテーマを使用
[dependencies]
hikari-components = "0.1"
hikari-theme = "0.1"

# アニメーションシステムを使用
[dependencies]
hikari-animation = "0.1"
```

### 2. 階層アーキテクチャ

```
┌─────────────────────────────────────┐
│      アプリケーション層 (examples/)   │
├─────────────────────────────────────┤
│    コンポーネント層 (hikari-components)│
├─────────────────────────────────────┤
│  システム層 (theme, animation, icons)│
├─────────────────────────────────────┤
│   基盤層 (palette, builder) │
└─────────────────────────────────────┘
```

### 3. 単方向データフロー

```
ユーザーアクション → イベントハンドラー → 状態更新 → UI再レンダリング
```

### 4. 型安全性

すべてのAPIは型安全:
- コンパイル時チェック
- IDE自動補完
- リファクタリング安全性

### 5. パフォーマンスファースト

- WASM最適化
- 仮想スクロール
- デバウンス/スロットル
- DOM操作の最小化

## ビルドプロセス

### 開発モード
```bash
cargo run
```

### プロダクションビルド
```bash
# 1. Rustコードをビルド
cargo build --release

# 2. ビルドシステムが自動的にSCSSをコンパイル
# 3. CSSバンドルを生成
# 4. 静的アセットをバンドル
```

### WASMビルド
```bash
trunk build --release
```

## 依存関係

```
hikari-components
  ├── hikari-palette
  ├── hikari-theme
  ├── hikari-animation
  └── hikari-icons

hikari-extra-components
  ├── hikari-palette
  ├── hikari-theme
  └── hikari-animation

hikari-render-service
  ├── hikari-components
  └── axum

hikari-builder
  └── grass (SCSSコンパイラ)
```

## 拡張性

### カスタムコンポーネントの追加

```rust
use hikari_components::{StyledComponent, StyleRegistry};

pub struct MyComponent;

impl StyledComponent for MyComponent {
    fn register_styles(registry: &mut StyleRegistry) {
        registry.register("my-component", include_str!("my-component.scss"));
    }
}
```

### カスタムテーマの追加

```rust
use hikari_palette::ThemePalette;

struct CustomTheme;

impl CustomTheme {
    pub fn palette() -> ThemePalette {
        ThemePalette {
            primary: "#FF0000",
            secondary: "#00FF00",
            // ...
        }
    }
}
```

### カスタムアニメーションプリセットの追加

```rust
use hikari_animation::{AnimationBuilder, AnimationContext};

pub fn fade_in(
    builder: AnimationBuilder,
    element: &str,
    duration: u32,
) -> AnimationBuilder {
    builder
        .add_style(element, CssProperty::Opacity, "0")
        .add_style(element, CssProperty::Opacity, "1")
        .apply_with_transition(&format!("{}ms", duration), "ease-out")
}
```

## パフォーマンス最適化

### 1. CSS最適化
- SCSSを最適化されたCSSにコンパイル
- 未使用スタイルの削除（ツリーシェイキング）
- プロダクションCSSの最小化

### 2. WASM最適化
- `wasm-opt`最適化
- 遅延WASMモジュール読み込み
- リニアメモリ最適化

### 3. 実行時最適化
- 仮想スクロール（大規模データリスト）
- デバウンスされたアニメーション更新
- requestAnimationFrame

### 4. ビルド最適化
- 並列コンパイル
- インクリメンタルコンパイル
- バイナリキャッシング

## テスト戦略

### ユニットテスト
各モジュールには完全なユニットテストがあります:

```rust
#[cfg(test)]
mod tests {
    #[test]
    fn test_color_conversion() {
        let color = ChineseColor::Cinnabar;
        assert_eq!(color.hex(), "#E94B35");
    }
}
```

### 統合テスト
`examples/`のサンプルアプリケーションが統合テストとして機能

### ビジュアルリグレッションテスト
Percyなどのツールを使用してUIスナップショットテストを実施

## 次のステップ

- 特定のコンポーネントについては[コンポーネントドキュメント](../components/)を読む
- APIの詳細については[APIドキュメント](https://docs.rs/hikari-components)を参照
- ベストプラクティスを学ぶために[サンプルコード](../../examples/)を参照
