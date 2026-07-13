# 스위치 컴포넌트

스위치 컴포넌트는 다양한 색상과 변형으로 토글 기능을 제공합니다.

## 스위치 기본

Success, Primary, Secondary, Danger, Warning, Info의 여러 색상을 지원합니다.

```hikari
rsx! {
    div { style: "padding:1rem;display:flex;gap:16px;align-items:center;",
        div { style: "width:40px;height:22px;border-radius:11px;background:#3a6ea5;position:relative;",
            div { style: "position:absolute;right:2px;top:2px;width:18px;height:18px;border-radius:50%;background:#fff;" }
        }
        div { style: "width:40px;height:22px;border-radius:11px;background:#ccc;position:relative;",
            div { style: "position:absolute;left:2px;top:2px;width:18px;height:18px;border-radius:50%;background:#fff;" }
        }
    }
}
```

## 스위치 아이콘 변형

아이콘이 있는 스위치, 기본적으로 ✓ 및 ✗ 기호를 제공합니다.

```hikari
rsx! {
    div { style: "padding:1rem;display:flex;gap:8px;align-items:center;",
        span { style: "font-size:16px;", "🌙" }
        div { style: "width:40px;height:22px;border-radius:11px;background:#3a6ea5;position:relative;",
            div { style: "position:absolute;right:2px;top:2px;width:18px;height:18px;border-radius:50%;background:#fff;" } }
        span { style: "font-size:16px;", "☀" }
    }
}
```

## 스위치 텍스트 변형

텍스트 레이블이 있는 스위치, 슬라이더 너비가 자동으로 조정됩니다.

```hikari
rsx! {
    div { style: "padding:1rem;display:flex;gap:8px;align-items:center;",
        span { style: "font-size:14px;color:#666;", "Off" }
        div { style: "width:40px;height:22px;border-radius:11px;background:#3a6ea5;position:relative;",
            div { style: "position:absolute;right:2px;top:2px;width:18px;height:18px;border-radius:50%;background:#fff;" } }
        span { style: "font-size:14px;color:#333;", "On" }
    }
}
```

## 스위치 크기 변형

Small, Medium, Large 크기를 지원합니다.

```hikari
rsx! {
    div { style: "padding:1rem;display:flex;gap:16px;align-items:center;",
        div { style: "width:28px;height:16px;border-radius:8px;background:#3a6ea5;position:relative;",
            div { style: "position:absolute;right:1px;top:1px;width:14px;height:14px;border-radius:50%;background:#fff;" } }
        div { style: "width:40px;height:22px;border-radius:11px;background:#3a6ea5;position:relative;",
            div { style: "position:absolute;right:2px;top:2px;width:18px;height:18px;border-radius:50%;background:#fff;" } }
        div { style: "width:52px;height:28px;border-radius:14px;background:#3a6ea5;position:relative;",
            div { style: "position:absolute;right:2px;top:2px;width:24px;height:24px;border-radius:50%;background:#fff;" } }
    }
}
```

## Progress

작업 진행률을 표시하는 진행 바 컴포넌트입니다.

```hikari
rsx! {
    div { style: "padding:1rem;",
        div { style: "width:200px;height:6px;background:#e2e2ea;border-radius:3px;overflow:hidden;",
            div { style: "width:60%;height:100%;background:#3a6ea5;border-radius:3px;" }
        }
    }
}
```

## Slider

숫자 선택을 위한 슬라이더 컴포넌트입니다.

```hikari
rsx! {
    div { style: "padding:1rem;",
        input { type: "range", min: "0", max: "100", value: "60", style: "width:200px;" }
    }
}
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
