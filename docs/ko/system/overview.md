# 시스템 아키텍처 개요

Hikari 프레임워크는 모듈식 디자인을 채택하며, Tairitsu 런타임 기반으로 6개의 독립적인 패키지로 구성됩니다.

## 패키지 개요

| 패키지 | 설명 |
|---|---|
| hikari-palette | 전통 중국 색채 시스템 (500+ 색상), 테마 팔레트 관리 |
| hikari-animation | 선언적 애니메이션 시스템, 이징 함수, 보간, 타임라인 제어 |
| hikari-icons | Material Design Icons (7000+) 통합, SVG 생성 |
| hikari-theme | 테마 컨텍스트, CSS 변수 생성, 테마 전환 |
| hikari-components | 핵심 UI 컴포넌트 라이브러리 (40+ 컴포넌트) |
| hikari-extra-components | 고급 컴포넌트 (노드 편집기, 리치 텍스트 등) |

## 계층형 아키텍처

```
┌─────────────────────────────────────┐
│      애플리케이션 계층 (examples/)    │
├─────────────────────────────────────┤
│   컴포넌트 계층 (components, extra)   │
├─────────────────────────────────────┤
│  시스템 계층 (theme, animation, icons)│
├─────────────────────────────────────┤
│   기반 계층 (palette)                │
└─────────────────────────────────────┘
```

## 패키지 의존성

```
hikari-palette ◄──── hikari-animation
      ▲                    │
      │                    ▼
      ├──────────── hikari-icons
      │
      ├─── hikari-theme
      │
      ├─── hikari-components ◄── hikari-theme, hikari-icons
      │
      └─── hikari-extra-components ◄── hikari-theme, hikari-icons
```

## 외부 의존성

모든 패키지는 **Tairitsu** 프레임워크 (tairitsu-vdom, tairitsu-hooks, tairitsu-style, tairitsu-web) 를 반응형 UI / WASM 런타임으로 사용합니다.
