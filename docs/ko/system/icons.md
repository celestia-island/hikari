# Icons 시스템

아이콘 관리 및 렌더링 시스템으로, Lucide Icons와 통합되어 있습니다.

## 개요

`hikari-icons`가 제공하는 기능:

- **1000개 이상의 아이콘** - Lucide Icons 전체 컬렉션
- **타입 안전** - Enum 기반 아이콘 이름
- **SVG 렌더링** - 클라이언트 및 서버 사이드 렌더링
- **런타임 로딩** - 온디맨드 아이콘 SVG 로딩

## Icon 컴포넌트

### 기본 사용법

```rust
use dioxus::prelude::*;
use hikari_icons::{Icon, LucideIcon};

rsx! {
    Icon {
        icon: LucideIcon::Search,
        size: 24,
        color: "var(--hi-color-primary)"
    }
}
```

### 사용 가능한 아이콘

```rust
pub enum LucideIcon {
    // 내비게이션
    Home,
    Menu,
    Search,
    Settings,
    ChevronDown,
    ChevronLeft,
    ChevronRight,

    // 액션
    Edit,
    Trash,
    Check,
    X,
    Plus,
    Minus,

    // 상태
    AlertCircle,
    CheckCircle,
    Info,
    AlertTriangle,

    // ... 1000개 이상의 아이콘
}
```

### Props

| 속성 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `icon` | `LucideIcon` | - | 아이콘 타입 |
| `size` | `u32` | `24` | 아이콘 크기 |
| `color` | `&str` | - | 색상 |

## 런타임 로딩

### 클라이언트 사이드 렌더링

```rust
use hikari_icons::runtime;

// 비동기로 아이콘 SVG 로드
async fn load_icon(name: &str) -> Result<String, Error> {
    runtime::load_icon(name).await
}
```

### 서버 사이드 렌더링

```rust
use hikari_icons::server;

// 서버 사이드 아이콘 렌더링
fn render_icon(name: &str) -> String {
    server::render_icon(name)
}
```

## API 참조

### Icon

```rust
#[component]
pub fn Icon(
    icon: LucideIcon,
    size: Option<u32>,
    color: Option<&str>,
    class: Option<String>,
    style: Option<String>
) -> Element
```

### LucideIcon

```rust
pub enum LucideIcon {
    // 1000개 이상의 아이콘 변형
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

## 다른 시스템과의 통합

- **컴포넌트** - Button, Input 및 기타 컴포넌트에서 사용되는 아이콘
- **Render-service** - 정적 아이콘 파일 서비스
- **테마** - 아이콘 색상이 테마에서 상속됨

## 관련 시스템

- [컴포넌트](../components/) - 아이콘을 사용하는 컴포넌트들
- [Render-service](./render-service.md) - 아이콘 파일 서비스
- [Palette](./palette.md) - 아이콘 색상
