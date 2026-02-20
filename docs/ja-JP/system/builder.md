# ビルダーシステム

コンパイル時のコード生成とSCSSコンパイルシステム。

## 概要

`hikari-builder`は以下を提供します：

- **SCSSコンパイル** - Grassを使用してSCSSをCSSにコンパイル
- **コンポーネント検出** - SCSSコンポーネントファイルの自動検出
- **コード生成** - Rust定数と型の生成
- **リソースバンドル** - 最適化されたCSSバンドルの作成

## コア機能

### 1. SCSSコンパイル

```rust
// build.rs
fn main() {
    hikari_builder::build().expect("ビルドに失敗しました");
}
```

コンパイルプロセス：
1. `packages/components/src/styles/components/`ディレクトリをスキャン
2. すべての`.scss`ファイルをコンパイル
3. `public/styles/bundle.css`に出力

### 2. コンポーネント検出

コンポーネントを自動検出し、定数を生成：

```rust
// packages/builder/src/generated/components.rsで生成
pub const AVAILABLE_COMPONENTS: &[&str] = &[
    "button",
    "input",
    "card",
    "badge",
    // ...
];

pub fn default_components() -> Vec<String> {
    AVAILABLE_COMPONENTS
        .iter()
        .map(|s| s.to_string())
        .collect()
}
```

### 3. BuildConfig

ビルド設定：

```rust
use hikari_builder::{Builder, BuildConfig};

let config = BuildConfig {
    components: vec![
        "button".to_string(),
        "input".to_string(),
    ],
    output_dir: "dist".into(),
    minify_css: true,
    ..BuildConfig::default()
};

Builder::new(config)
    .build()
    .expect("ビルドに失敗しました");
```

## APIリファレンス

### build()

```rust
pub fn build() -> Result<(), Box<dyn std::error::Error>>
```

### Builder

```rust
pub struct Builder {
    config: BuildConfig,
}

impl Builder {
    pub fn new(config: BuildConfig) -> Self;
    pub fn build(self) -> Result<(), Box<dyn std::error::Error>>;
}
```

### BuildConfig

```rust
pub struct BuildConfig {
    pub components: Vec<String>,
    pub output_dir: PathBuf,
    pub minify_css: bool,
    pub scss_entry: PathBuf,
}

impl Default for BuildConfig {
    fn default() -> Self { ... }
}
```

## 使用例

### build.rsでの使用

```rust
fn main() {
    // デフォルトビルド
    hikari_builder::build().unwrap();

    // またはカスタム設定を使用
    let config = hikari_builder::BuildConfig {
        components: vec![
            "button".to_string(),
            "card".to_string(),
        ],
        ..Default::default()
    };

    hikari_builder::Builder::new(config)
        .build()
        .unwrap();
}
```

## 他のシステムとの統合

- **コンポーネント** - コンポーネントSCSSファイルを提供
- **テーマ** - テーマ変数とミックスインを提供
- **Render-service** - 生成されたCSSバンドルを使用

## 関連システム

- [パレット](./palette.md) - 色変数
- [テーマ](./theme.md) - SCSSミックスイン
- [コンポーネント](../components/) - コンポーネントライブラリ
