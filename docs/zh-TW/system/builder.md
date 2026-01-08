# Builder 構建系統

編譯時代碼生成和 SCSS 編譯系統。

## 概述

`hikari-builder` 提供：

- **SCSS 編譯** - 使用 Grass 編譯 SCSS 到 CSS
- **元件發現** - 自動發現 SCSS 元件檔案
- **程式碼生成** - 生成 Rust 常數和型別
- **資源打包** - 建立優化的 CSS bundle

## 核心功能

### 1. SCSS 編譯

```rust
// build.rs
fn main() {
    hikari_builder::build().expect("Build failed");
}
```

編譯過程：
1. 掃描 `packages/components/src/styles/components/` 目錄
2. 編譯所有 `.scss` 檔案
3. 輸出到 `public/styles/bundle.css`

### 2. 元件發現

自動發現元件並生成常數：

```rust
// 生成在 packages/builder/src/generated/components.rs
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

構建配置：

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
    .expect("Build failed");
```

## API 參考

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

## 使用示例

### 在 build.rs 中使用

```rust
fn main() {
    // 預設構建
    hikari_builder::build().unwrap();

    // 或使用自訂配置
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

## 與其他系統整合

- **Components** - 提供元件 SCSS 檔案
- **Theme** - 提供主題變數和 mixins
- **Render-service** - 使用生成的 CSS bundle

## 相關系統

- [Palette 調色板](./palette.md) - 顏色變數
- [Theme 主題](./theme.md) - SCSS mixins
- [Components 元件](../components/) - 元件庫
