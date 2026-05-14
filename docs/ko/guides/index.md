# Hikari UI 프레임워크

> Tairitsu + Grass + Axum 기반의 현대적인 Rust UI 프레임워크
>
> **디자인 스타일**: 플랫 디자인 + 글로우 효과 + 전통 중국 색채
>
> **이름 유래**: 리듬 게임 Arcaea의 "Hikari" (빛)

## Hikari란?

Hikari는 Rust 생태계를 위해 설계된 현대적인 UI 프레임워크로, 전통 중국 색채의 미학과 SF 인터페이스 디자인을 결합합니다. 이 프레임워크는 모듈식 디자인을 채택하여 완전한 컴포넌트 라이브러리, 테마 시스템, 애니메이션 시스템을 제공합니다.

## 핵심 기능

### 🎨 전통 중국 색채 시스템
- **660+ 전통 색상**: 완전한 전통 중국 색상 팔레트
- **테마 시스템**: 기본 제공 Hikari (라이트) 및 Tairitsu (다크) 테마
- **타입 안전**: 컴파일 시간 검증 색상 값

### 🧩 풍부한 컴포넌트 라이브러리
- **기본 컴포넌트**: Button, Input, Card, Badge
- **피드백 컴포넌트**: Alert, Toast, Tooltip, Spotlight
- **내비게이션 컴포넌트**: Menu, Tabs, Breadcrumb
- **데이터 컴포넌트**: Table, Tree, Pagination
- **레이아웃 컴포넌트**: Layout, Header, Aside, Content, Footer
- **추가 컴포넌트**: Collapsible, DragLayer, ZoomControls

### ✨ 강력한 애니메이션 시스템
- **선언적 애니메이션**: CSS 스타일의 유창한 API
- **동적 값**: 런타임 계산 애니메이션 값
- **이징 함수**: 30+ 이징 함수
- **프리셋 애니메이션**: 페이드, 슬라이드, 스케일 등

### 🎯 고급 기능
- **서버 사이드 렌더링**: 완전한 SSR 지원
- **타입 안전**: Rust 타입 시스템의 완전한 활용
- **반응형 디자인**: 기본 제공 반응형 레이아웃 유틸리티
- **빌드 시스템**: 자동화된 SCSS 컴파일 및 에셋 생성

## 빠른 시작

### 의존성 설치

`Cargo.toml`에 추가:

```toml
[dependencies]
hikari-components = "0.1"
hikari-palette = "0.1"
hikari-theme = "0.1"
tairitsu = "0.5"
```

### 기본 사용법

```rust
use hikari_components::{ThemeProvider, Button};
use hikari_theme::ThemeProvider;

#[component]
fn App() -> Element {
    rsx! {
        ThemeProvider { palette: "hikari" } {
            div { class: "hi-flex hi-flex-col hi-gap-4" {
                Button { label: "클릭하세요" }
                Button { label: "기본 버튼", variant: "primary" }
                Button { label: "보조 버튼", variant: "secondary" }
            }
        }
    }
}
```

### 빌드 및 실행

```bash
# 개발 모드
cargo run

# 빌드
cargo build --release

# WASM 빌드
trunk build --release
```

## 디자인 철학

### 플랫 디자인
- 깔끔한 라인과 명확한 정보 계층
- 가독성을 위한 높은 대비
- 미니멀하면서도 세련된 디자인

### 글로우 효과
- 은은한 글로우 효과
- 동적 인디케이터 (브레딩 라이트, 펄스 애니메이션)
- 섬세한 테두리와 기하학적 패턴

### 전통 중국 색채
- 주요: 분홍, 창취, 강황
- 중성: 정백 (순백), 묵색 (먹색), 효색 (연한 회색)
- 기능: 총청 (성공), 행황 (경고), 주홍 (위험)

## 프로젝트 구조

```
hikari/
├── packages/
│   ├── hikari-palette/          # 전통 중국 색상 팔레트
│   ├── hikari-theme/            # 테마 시스템
│   ├── hikari-animation/        # 애니메이션 시스템
│   ├── hikari-icons/            # 아이콘 시스템
│   ├── hikari-components/       # 컴포넌트 라이브러리
│   ├── hikari-extra-components/ # 추가 컴포넌트 라이브러리
│
└── examples/
    ├── website/                 # 공식 웹사이트
    ├── table-demo/              # 테이블 컴포넌트 데모
    ├── tree-demo/               # 트리 컴포넌트 데모
    └── node-graph-demo/         # 노드 그래프 데모
```

## 문서

- [컴포넌트](./components/) - UI 컴포넌트 사용 가이드
- [시스템](./system/) - 핵심 시스템 아키텍처
- [API 레퍼런스](https://docs.rs/hikari-components) - Rust API 문서

## 예제

### 테마 전환

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
                "테마 전환"
            }
        }
    }
}
```

### 애니메이션 사용

```rust
use hikari_animation::{AnimationBuilder, AnimationContext};
use hikari_animation::style::CssProperty;

// 정적 애니메이션
AnimationBuilder::new(&elements)
    .add_style("button", CssProperty::Opacity, "0.8")
    .apply_with_transition("300ms", "ease-in-out");

// 동적 애니메이션 (마우스 추적)
AnimationBuilder::new(&elements)
    .add_style_dynamic("button", CssProperty::Transform, |ctx| {
        let x = ctx.mouse_x();
        let y = ctx.mouse_y();
        format!("translate({}px, {}px)", x, y)
    })
    .apply_with_transition("150ms", "ease-out");
```

## 기여

기여를 환영합니다! 자세한 내용은 [CONTRIBUTING.md](../../en-US/guides/CONTRIBUTING.md)를 참조하세요.

## 라이선스

[MIT 라이선스](../../../LICENSE)

## 감사의 말

- **Tairitsu** - 강력한 Rust UI 프레임워크
- [Grass](https://github.com/kaj/kaj) - 순수 Rust SCSS 컴파일러
- [Element Plus](https://element-plus.org/) - 훌륭한 컴포넌트 라이브러리 디자인 참조
- [Material UI](https://mui.com/) - 현대적인 UI 디자인 영감

---

**Hikari** - 미니멀리즘, 기술, 문화적 자신감
