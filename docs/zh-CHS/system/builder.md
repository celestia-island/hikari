# Builder 构建系统

编译时代码生成和 SCSS 编译系统。

## 概述

`hikari-builder` 提供：

- **SCSS 编译** - 使用 Grass 编译 SCSS 到 CSS
- **组件发现** - 自动发现 SCSS 组件文件
- **代码生成** - 生成 Rust 常量和类型
- **资源打包** - 创建优化的 CSS bundle

## 核心功能

### 1. SCSS 编译

```rust
// build.rs
fn main() {
    hikari_builder::build().expect("Build failed");
}
```

编译过程：
1. 扫描 `packages/components/src/styles/components/` 目录
2. 编译所有 `.scss` 文件
3. 输出到 `public/styles/bundle.css`

### 2. 组件发现

自动发现组件并生成常量：

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

构建配置：

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

## API 参考

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
    // 默认构建
    hikari_builder::build().unwrap();

    // 或使用自定义配置
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

## 与其他系统集成

- **Components** - 提供组件 SCSS 文件
- **Theme** - 提供主题变量和 mixins
- **Render-service** - 使用生成的 CSS bundle

## 相关系统

- [Palette 调色板](./palette.md) - 颜色变量
- [Theme 主题](./theme.md) - SCSS mixins
- [Components 组件](../components/) - 组件库
