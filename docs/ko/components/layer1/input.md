# Input 입력 필드

Input 컴포넌트는 여러 상태와 사용자 정의 스타일을 지원하는 기본 양식 입력 컴포넌트입니다.

## 3계층 구성

Input 컴포넌트는 3계층 CSS 변수 구성 아키텍처를 지원합니다:

- **Layer1 (기본 계층)**: 테마를 통해 전역 기본값 정의
- **Layer2 (컴포넌트 계층)**: `input-vars.scss`를 통해 컴포넌트 변수 정의
- **Custom (런타임)**: 컴포넌트 속성을 통해 동적 재정의

## 기본 사용법

```hikari
rsx! {
    div { style: "padding:1rem;",
        input { type: "text", placeholder: "Basic input", style: "padding:8px 12px;border:1px solid #d9d9d9;border-radius:6px;font-size:14px;width:240px;" }
    }
}
```

## 비활성화 상태

입력 필드는 비활성화할 수 있으며, 비활성화 상태에서는 편집할 수 없습니다.

```hikari
rsx! {
    div { style: "padding:1rem;",
        input { type: "text", placeholder: "Disabled", disabled: true, style: "padding:8px 12px;border:1px solid #d9d9d9;border-radius:6px;font-size:14px;width:240px;background:#f5f5f5;color:#999;" }
    }
}
```

## 사용자 정의 색상

Custom 계층 속성을 통해 입력 필드 색상을 동적으로 재정의할 수 있습니다.

```rust
Input {
    placeholder: "Custom styled input",
    text_color: Some("#ff0000".to_string()),        // 사용자 정의 텍스트 색상
    border_color: Some("#ff4f00".to_string()),       // 사용자 정의 테두리 색상
    background_color: Some("rgba(255, 255, 255, 0.1)".to_string()), // 사용자 정의 배경색
}
```

## CSS 변수 재정의

`css_vars` 속성을 통해 CSS 변수를 일괄 재정의할 수 있습니다.

```rust
Input {
    placeholder: "CSS Variables Override",
    css_vars: Some(vec![
        ("--hi-input-radius", "16px".to_string()),
        ("--hi-input-border-color-focus", "#22c55e".to_string()),
        ("--hi-input-shadow-focus", "0 0 0 2px rgba(34, 197, 94, 0.3)".to_string()),
    ]),
}
```

## 애니메이션 통합

`animation_id` 속성을 통해 AnimationBuilder와 통합하여 애니메이션 효과를 구현할 수 있습니다.

```rust
Input {
    placeholder: "Animated Input",
    animation_id: Some("animated-input".to_string()),
}

// AnimationBuilder로 애니메이션 제어
AnimationBuilder::new()
    .style("--hi-input-border-color", "rgb(255, 79, 0)")
    .style("--hi-input-shadow-focus", "0 0 0 2px rgba(255, 79, 0, 0.3)")
    .duration(300)
    .apply_to_element("animated-input");
```

## API

### Input Props

| 속성 | 설명 | 타입 | 기본값 |
|------|------|------|--------|
| size | 입력 필드 크기 | InputSize | Medium |
| disabled | 비활성화 여부 | bool | false |
| readonly | 읽기 전용 여부 | bool | false |
| placeholder | 플레이스홀더 텍스트 | Option\<String\> | None |
| value | 입력 값 | Option\<String\> | None |
| input_type | 입력 유형 | Option\<String\> | "text" |
| autofocus | 자동 포커스 여부 | bool | false |
| class | 사용자 정의 CSS 클래스 | String | "" |
| prefix_icon | 접두사 아이콘 | Option\<Element\> | None |
| suffix_icon | 접미사 아이콘 | Option\<Element\> | None |
| oninput | 입력 콜백 | Option\<EventHandler\<String\>\> | None |
| onfocus | 포커스 콜백 | Option\<EventHandler\<FocusEvent\>\> | None |
| onblur | 포커스 해제 콜백 | Option\<EventHandler\<FocusEvent\>\> | None |
| onkeydown | 키 누름 콜백 | Option\<EventHandler\<KeyboardEvent\>\> | None |
| glow | 글로우 효과 활성화 여부 | bool | true |
| glow_blur | 글로우 블러 강도 | GlowBlur | Medium |
| glow_intensity | 글로우 강도 | GlowIntensity | Soft |
| glow_color | 글로우 색상 | GlowColor | Ghost |
| **Custom 계층 속성** | | | |
| text_color | 사용자 정의 텍스트 색상 | Option\<String\> | None |
| placeholder_color | 사용자 정의 플레이스홀더 색상 | Option\<String\> | None |
| border_color | 사용자 정의 테두리 색상 | Option\<String\> | None |
| background_color | 사용자 정의 배경색 | Option\<String\> | None |
| animation_id | AnimationBuilder 애니메이션 ID | Option\<String\> | None |
| css_vars | CSS 변수 일괄 재정의 | Option\<Vec\<(&'static str, String)\>\> | None |

## CSS 변수 참조

### Input CSS 변수

| 변수명 | 설명 | 기본값 |
|--------|------|--------|
| --hi-input-text-color | 텍스트 색상 | var(--hi-color-text-primary) |
| --hi-input-text-color-disabled | 비활성화 텍스트 색상 | var(--hi-color-text-disabled) |
| --hi-input-placeholder-color | 플레이스홀더 색상 | var(--hi-color-text-secondary) |
| --hi-input-placeholder-opacity | 플레이스홀더 불투명도 | 0.6 |
| --hi-input-bg | 배경색 | transparent |
| --hi-input-bg-disabled | 비활성화 배경 | rgba(255, 255, 255, 0.5) |
| --hi-input-border-color | 테두리 색상 | var(--hi-color-border) |
| --hi-input-border-color-focus | 포커스 테두리 색상 | var(--hi-color-primary) |
| --hi-input-border-color-disabled | 비활성화 테두리 색상 | var(--hi-border-color-disabled) |
| --hi-input-border-color-error | 오류 테두리 색상 | var(--hi-color-danger) |
| --hi-input-shadow-focus | 포커스 그림자 | 0 0 0 2px var(--hi-color-primary) |
| --hi-input-radius | 둥근 모서리 | var(--hi-radius-md) |
| --hi-input-padding-x | 수평 패딩 | 0.75rem |
| --hi-input-padding-y | 수직 패딩 | 0.5rem |
| --hi-input-font-size | 글꼴 크기 | var(--hi-font-size-sm) |
