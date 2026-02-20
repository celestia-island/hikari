# 테마 시스템

테마 컨텍스트, CSS 변수 및 테마 전환 기능을 제공하는 테마 관리 시스템입니다.

## 목차

- [개요](#개요)
- [ThemeProvider](#themeprovider-테마-프로바이더)
- [ThemeContext](#themecontext-테마-컨텍스트)
- [생성된 리소스](#생성된-리소스)
- [CSS 변수 시스템](#css-변수-시스템)
- [테마 전환](#테마-전환)
- [스타일 커스터마이징](#스타일-커스터마이징)
- [API 레퍼런스](#api-레퍼런스)

## 개요

`hikari-theme`은 완전한 테마 관리 솔루션을 제공합니다:

- **ThemeProvider** - 테마 컨텍스트 프로바이더 컴포넌트
- **ThemeContext** - 테마 구성 및 색상 정의
- **Generated** - 자동 생성된 CSS 변수 및 리소스
- **CSS Variables** - 동적 테마 변수 시스템
- **Theme Switching** - 런타임 테마 전환 지원

모든 테마 컴포넌트의 특징:

- **타입 안전** - 컴파일 시간 테마 식별자 검증
- **반응형** - 다양한 테마에 자동 적응
- **확장 가능** - 커스텀 테마 지원

## ThemeProvider

전체 애플리케이션에 테마 컨텍스트를 제공합니다.

### 기본 사용법

```rust
use dioxus::prelude::*;
use hikari_theme::ThemeProvider;

rsx! {
    ThemeProvider { palette: "hikari".to_string() }
        // 애플리케이션 콘텐츠
        App {}
    }
}
```

### 테마 전환

```rust
#[component]
fn App() -> Element {
    let mut theme = use_signal(|| "hikari".to_string());

    rsx! {
        ThemeProvider { palette: theme() }
            div {
                button {
                    onclick: move |_| {
                        theme.set(if theme() == "hikari" {
                            "tairitsu".to_string()
                        } else {
                            "hikari".to_string()
                        });
                    },
                    "테마 전환"
                }
                // 애플리케이션 콘텐츠
            }
        }
    }
}
```

### Props

| 속성 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `palette` | `String` | `"hikari"` | 테마 식별자 |
| `children` | `Element` | - | 자식 요소 |

### 지원 테마

- **hikari** - 라이트 테마
- **tairitsu** - 다크 테마

## ThemeContext

테마 구성 및 색상 정의를 포함하는 데이터 구조입니다.

### 구조 정의

```rust
pub struct ThemeContext {
    pub palette: String,
    pub colors: Palette,
}
```

### 필드 설명

- **palette** - 테마 식별자 문자열
- **colors** - 테마 팔레트 구성 (`hikari-palette`에서 가져옴)

### 기본값

```rust
impl Default for ThemeContext {
    fn default() -> Self {
        ThemeContext {
            palette: "hikari".to_string(),
            colors: themes::Hikari::palette(),
        }
    }
}
```

## 생성된 리소스

자동 생성된 정적 리소스 및 CSS 변수입니다.

### Tailwind CSS

```rust
use hikari_theme::generated::tailwind;

// 생성된 Tailwind CSS 클래스 접근
let tailwind_classes = tailwind::TAILWIND_CLASSES;
```

### 생성된 콘텐츠

`generated/mod.rs` 모듈에 포함된 내용:

- `tailwind` - Tailwind CSS 생성 클래스 이름 및 변수
- `components` - 컴포넌트 스타일 상수 (빌더에서 생성)

### 파일 위치

```
packages/theme/src/generated/
├── mod.rs           # 모듈 진입점
├── tailwind.rs      # Tailwind CSS 생성 콘텐츠
└── ...              # 기타 생성된 콘텐츠
```

## CSS 변수 시스템

테마 시스템은 동적 테마 전환을 위해 CSS 변수를 사용합니다.

### 루트 변수

`:root` 또는 `[data-theme]` 아래에 정의:

```css
[data-theme="hikari"] {
    --hi-color-primary: #00A0E9;
    --hi-color-secondary: #E94B35;
    --hi-color-accent: #F8B62D;
    --hi-color-background: #FFFFFF;
    --hi-color-surface: #F5F5F5;
    --hi-color-text-primary: #1A1A2E;
    --hi-color-text-secondary: #666666;
}

[data-theme="tairitsu"] {
    --hi-color-primary: #1a237e;
    --hi-color-secondary: #E94B35;
    --hi-color-accent: #FFF176;
    --hi-color-background: #0D1117;
    --hi-color-surface: #161B22;
    --hi-color-text-primary: #C9D1D9;
    --hi-color-text-secondary: #8B949E;
}
```

### CSS 변수 사용

컴포넌트 스타일에서 사용:

```rust
rsx! {
    div {
        style: "color: var(--hi-color-primary); background: var(--hi-color-surface);",
        "테마 변수 사용"
    }
}
```

또는 SCSS에서:

```scss
.my-component {
    color: var(--hi-color-primary);
    background-color: var(--hi-color-surface);
    border: 1px solid var(--hi-color-border);
}
```

### 전체 변수 목록

#### 색상 변수

```css
--hi-color-primary          /* 주요 색상 */
--hi-color-secondary        /* 보조 색상 */
--hi-color-accent           /* 강조 색상 */
--hi-color-success          /* 성공 색상 */
--hi-color-warning          /* 경고 색상 */
--hi-color-danger           /* 위험 색상 */
--hi-color-background       /* 배경 색상 */
--hi-color-surface          /* 표면 색상 */
--hi-color-border           /* 테두리 색상 */
--hi-color-text-primary     /* 주요 텍스트 색상 */
--hi-color-text-secondary   /* 보조 텍스트 색상 */
```

#### 타이포그래피 변수

```css
--hi-font-family-sans       /* 산세리프 폰트 */
--hi-font-family-mono       /* 모노스페이스 폰트 */
--hi-font-size-xs           /* 12px */
--hi-font-size-sm           /* 14px */
--hi-font-size-base         /* 16px */
--hi-font-size-lg           /* 18px */
--hi-font-size-xl           /* 20px */
--hi-font-size-2xl          /* 24px */
--hi-font-size-3xl          /* 30px */
```

#### 간격 변수

```css
--hi-spacing-xs            /* 4px */
--hi-spacing-sm            /* 8px */
--hi-spacing-md            /* 16px */
--hi-spacing-lg            /* 24px */
--hi-spacing-xl            /* 32px */
--hi-spacing-2xl           /* 48px */
```

#### 라디우스 변수

```css
--hi-radius-sm             /* 4px */
--hi-radius-md             /* 8px */
--hi-radius-lg             /* 12px */
--hi-radius-xl             /* 16px */
--hi-radius-full           /* 9999px */
```

#### 그림자 변수

```css
--hi-shadow-sm             /* 작은 그림자 */
--hi-shadow-md             /* 중간 그림자 */
--hi-shadow-lg             /* 큰 그림자 */
--hi-shadow-xl             /* 매우 큰 그림자 */
```

#### 전환 변수

```css
--hi-transition-fast       /* 150ms */
--hi-transition-base       /* 200ms */
--hi-transition-slow       /* 300ms */
```

## 테마 전환

### 런타임 전환

```rust
#[component]
fn ThemeSwitcher() -> Element {
    let mut theme = use_signal(|| "hikari".to_string());

    rsx! {
        ThemeProvider { palette: theme() }
            div {
                button {
                    onclick: move |_| theme.set("hikari".to_string()),
                    class: if theme() == "hikari" { "active" } else { "" },
                    "라이트"
                }
                button {
                    onclick: move |_| theme.set("tairitsu".to_string()),
                    class: if theme() == "tairitsu" { "active" } else { "" },
                    "다크"
                }
            }
        }
    }
}
```

### 테마 저장

```rust
use gloo::storage::LocalStorage;

#[component]
fn PersistentTheme() -> Element {
    // LocalStorage에서 테마 불러오기
    let mut theme = use_signal(|| {
        LocalStorage::get("theme")
            .unwrap_or_else(|_| Ok("hikari".to_string()))
            .unwrap_or("hikari".to_string())
    });

    // 테마 변경 시 LocalStorage에 저장
    use_effect(move || {
        let theme = theme();
        async move {
            if let Err(e) = LocalStorage::set("theme", &theme) {
                eprintln!("테마 저장 실패: {}", e);
            }
        }
    });

    rsx! {
        ThemeProvider { palette: theme() }
            // 애플리케이션 콘텐츠
        }
    }
}
```

### 시스템 테마 감지

```rust
use web_sys::window;

#[component]
fn SystemTheme() -> Element {
    let mut theme = use_signal(|| "hikari".to_string());

    // 시스템 테마 설정 감지
    use_effect(|| {
        let win = window()?;
        let media_query = win.match_media("(prefers-color-scheme: dark)")?;

        let listener = Closure::wrap(Box::new(move |e: Event| {
            let matches = e
                .dyn_ref::<MediaQueryListEvent>()
                .unwrap()
                .matches();
            theme.set(if matches {
                "tairitsu".to_string()
            } else {
                "hikari".to_string()
            });
        }) as Box<dyn Fn(_)>);

        media_query
            .add_listener_with_opt_callback(Some(listener.as_ref().unchecked_ref()))
            .unwrap();
        listener.forget();

        async move {}
    });

    rsx! {
        ThemeProvider { palette: theme() }
            // 애플리케이션 콘텐츠
        }
    }
}
```

## 스타일 커스터마이징

### 테마 변수 오버라이드

```css
/* 전역 스타일에서 테마 변수 오버라이드 */
[data-theme="hikari"] {
    --hi-color-primary: #0066CC;
    --hi-color-secondary: #FF6600;
}
```

### 컴포넌트 레벨 테마

```rust
rsx! {
    // 특정 컴포넌트에 다른 테마 사용
    div {
        "data-theme": "tairitsu",
        style: "background: var(--hi-color-surface);",
        "이 컴포넌트는 다크 테마를 사용합니다"
    }
}
```

### 커스텀 테마 변수

```css
[data-theme="custom"] {
    --hi-color-primary: #FF0066;
    --hi-color-secondary: #00FF99;
    --hi-color-accent: #FFFF00;
    /* ... 기타 변수 */
}
```

## 모범 사례

### 1. 테마 프로바이더 배치

```rust
// 좋음: 애플리케이션 루트에 ThemeProvider 배치
#[component]
fn App() -> Element {
    rsx! {
        ThemeProvider { palette: "hikari".to_string() }
            Router {}
        }
    }
}

// 피해야 함: 여러 ThemeProvider 중첩
#[component]
fn BadExample() -> Element {
    rsx! {
        ThemeProvider { palette: "hikari".to_string() }
            ThemeProvider { palette: "tairitsu".to_string() }
                // 내부 테마가 외부 테마를 오버라이드
            }
        }
    }
}
```

### 2. 테마 전환 애니메이션

```css
/* 부드러운 테마 전환 트랜지션 추가 */
* {
    transition: background-color 0.3s ease,
                color 0.3s ease,
                border-color 0.3s ease;
}
```

### 3. 조건부 스타일링

```rust
rsx! {
    div {
        class: if theme() == "hikari" {
            "light-theme"
        } else {
            "dark-theme"
        },
        "테마에 따라 다른 스타일 적용"
    }
}
```

### 4. CSS 변수 폴백

```css
/* CSS 변수를 지원하지 않는 브라우저를 위한 폴백 */
.my-component {
    background-color: #00A0E9; /* 폴백 값 */
    background-color: var(--hi-color-primary, #00A0E9);
}
```

## API 레퍼런스

### ThemeProvider

```rust
#[component]
pub fn ThemeProvider(
    palette: String,
    children: Element
) -> Element
```

### ThemeContext

```rust
pub struct ThemeContext {
    pub palette: String,
    pub colors: Palette,
}

impl Default for ThemeContext {
    fn default() -> Self { ... }
}
```

## 다른 시스템과의 통합

### 팔레트와의 통합

```rust
use hikari_palette::{ChineseColor, themes};

let hikari_palette = themes::Hikari::palette();
println!("주요 색상: {}", hikari_palette.primary.hex);
```

### 애니메이션과의 통합

```rust
use hikari_animation::AnimationBuilder;
use hikari_theme::ThemeProvider;

// 애니메이션에서 테마 변수 사용
AnimationBuilder::new(&elements)
    .add_style("button", "background-color", "var(--hi-color-primary)")
    .apply_with_transition("300ms", "ease-in-out");
```

### 컴포넌트와의 통합

모든 컴포넌트는 ThemeProvider가 제공한 테마를 자동으로 상속받습니다:

```rust
rsx! {
    ThemeProvider { palette: "hikari".to_string() }
        // 모든 컴포넌트가 자동으로 hikari 테마 사용
        Button { label: "버튼" }
        Card { "카드" }
        Input { placeholder: "입력" }
    }
}
```

## 디자인 철학

### 아크나이츠 스타일

- **라이트 테마 (hikari)**:
  - 주요: 석청 (#00A0E9)
  - 배경: 흰색
  - 텍스트: 어두운색

- **다크 테마 (tairitsu)**:
  - 주요: 인디고 (#1a237e)
  - 배경: 어두운색
  - 텍스트: 밝은색

### FUI 요소

- 은은한 글로우 효과
- 동적 인디케이터 (브레딩 라이트)
- 섬세한 테두리

### 반응형

- 모바일 퍼스트
- 적응형 레이아웃
- 브레이크포인트 시스템

## 관련 시스템

- [팔레트 시스템](./palette.md) - 색상 정의 및 테마 팔레트
- [애니메이션 시스템](./animation.md) - 애니메이션 및 테마 통합
- [컴포넌트](../components/) - 테마를 사용하는 컴포넌트 라이브러리
