# 스위치 컴포넌트

스위치 컴포넌트는 다양한 색상과 변형으로 토글 기능을 제공합니다.

## 스위치 기본

Success, Primary, Secondary, Danger, Warning, Info의 여러 색상을 지원합니다.

```_hikari_component
pages/components/layer1/switch#switch
```

## 스위치 아이콘 변형

아이콘이 있는 스위치, 기본적으로 ✓ 및 ✗ 기호를 제공합니다.

```_hikari_component
pages/components/layer1/switch#icon
```

## 스위치 텍스트 변형

텍스트 레이블이 있는 스위치, 슬라이더 너비가 자동으로 조정됩니다.

```_hikari_component
pages/components/layer1/switch#text
```

## 스위치 크기 변형

Small, Medium, Large 크기를 지원합니다.

```_hikari_component
pages/components/layer1/switch#sizes
```

## Progress

작업 진행률을 표시하는 진행 바 컴포넌트입니다.

```_hikari_component
pages/components/layer1/switch#progress
```

## Slider

숫자 선택을 위한 슬라이더 컴포넌트입니다.

```_hikari_component
pages/components/layer1/switch#slider
```

## API

### SwitchProps

| 속성 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| checked | `bool` | `false` | 체크 여부 |
| on_change | `EventEmitter<bool>` | - | 상태 변경 콜백 |
| disabled | `bool` | `false` | 비활성화 여부 |
| size | `SwitchSize` | `Medium` | 크기 |
| variant | `SwitchVariant` | `Default` | 변형 타입 |
| color | `SwitchColor` | `Success` | 체크 시 색상 |
| checked_content | `Option<SwitchContent>` | `None` | 체크 시 콘텐츠 |
| unchecked_content | `Option<SwitchContent>` | `None` | 체크 해제 시 콘텐츠 |

### SwitchVariant

| 값 | 설명 |
|------|------|
| `Default` | 기본 스타일 (점) |
| `Text` | 텍스트 변형 |
| `Icon` | 아이콘 변형 |
| `Custom` | 커스텀 변형 |

### SwitchColor

| 값 | 설명 |
|------|------|
| `Success` | 성공/켜짐 (녹색, 기본값) |
| `Primary` | 주요 색상 (파랑) |
| `Secondary` | 보조 색상 (보라) |
| `Danger` | 위험 (빨강) |
| `Warning` | 경고 (노랑) |
| `Info` | 정보 (인디고) |

### SwitchContent

| 값 | 설명 |
|------|------|
| `Text(String)` | 텍스트 콘텐츠 |
| `Icon(SwitchIcon)` | 아이콘 콘텐츠 |
| `Image(String)` | 이미지 URL |

### SwitchIcon

| 값 | 설명 |
|------|------|
| `Check` | 체크 아이콘 |
| `Close` | 닫기 아이콘 |
| `Plus` | 더하기 아이콘 |
| `Minus` | 빼기 아이콘 |
| `Custom(&'static str)` | 커스텀 SVG 경로 |
