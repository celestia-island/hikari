# Hikari UI 프레임워크

Hikari (光) 는 다음 기술로 구축된 모던 Rust UI 프레임워크입니다:

- **Tairitsu 0.7** - 반응형 UI 프레임워크
- **Grass** - SCSS 컴파일러
- **Axum** - SSR용 웹 서버

## 디자인 철학

Hikari는 다음을 결합합니다:

- **Arknights 미학** - 깔끔한 선, 높은 대비
- **FUI (미래 사용자 인터페이스)** - 글로우 효과, 동적 인디케이터
- **전통 중국색** - 500개 이상의 정통 색상 이름

## 빠른 시작

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
            Button { label: "안녕하세요, Hikari!" }
        }
    }
}
```

## 기능

- 🎨 500개 이상의 전통 중국색
- 🌙 라이트 및 다크 테마
- 🔧 타입 안전한 유틸리티 클래스
- ✨ 부드러운 애니메이션
- 📱 반응형 컴포넌트
- 🌐 내장 i18n 지원

## 문서

전체 문서는 [docs.hikari.dev](https://docs.hikari.dev)를 방문하세요.
