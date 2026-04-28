# Builder 시스템

컴파일 타임 코드 생성 및 SCSS 컴파일 시스템입니다.

## 개요

`hikari-builder`가 제공하는 기능:

- **SCSS 컴파일** - Grass를 사용하여 SCSS를 CSS로 컴파일
- **컴포넌트 발견** - SCSS 컴포넌트 파일 자동 발견
- **코드 생성** - Rust 상수 및 타입 생성
- **리소스 번들링** - 최적화된 CSS 번들 생성

## 핵심 기능

### 1. SCSS 컴파일

```rust
// build.rs
fn main() {
    hikari_builder::build().expect("빌드 실패");
}
```

컴파일 프로세스:
1. `packages/components/src/styles/components/` 디렉토리 스캔
2. 모든 `.scss` 파일 컴파일
3. `public/styles/bundle.css`로 출력

### 2. 컴포넌트 발견

컴포넌트를 자동으로 발견하고 상수를 생성합니다:

```rust
// packages/builder/src/generated/components.rs에서 생성됨
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

빌드 구성:

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
    .expect("빌드 실패");
```

## API 참조

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

## 사용 예제

### build.rs에서 사용

```rust
fn main() {
    // 기본 빌드
    hikari_builder::build().unwrap();

    // 또는 커스텀 구성 사용
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

## 다른 시스템과의 통합

- **컴포넌트** - 컴포넌트 SCSS 파일 제공
- **테마** - 테마 변수 및 믹스인 제공
- **Render-service** - 생성된 CSS 번들 사용

## 관련 시스템

- [Palette](./palette.md) - 색상 변수
- [Theme](./theme.md) - SCSS 믹스인
- [컴포넌트](../components/) - 컴포넌트 라이브러리
