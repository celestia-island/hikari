# Button

Button 컴포넌트는 가장 기본적인 사용자 상호작용 컴포넌트로, 다양한 스타일과 상태를 지원합니다.

버튼은 폼 제출, 대화상자 열기, 작업 취소 또는 삭제 작업 수행과 같은 액션이나 이벤트를 트리거하는 데 사용됩니다.

## 버튼 변형

Primary, Secondary, Ghost, Danger의 4가지 변형을 지원합니다.

```hikari
rsx! {
    div { style: "display:flex;gap:8px;padding:1rem;flex-wrap:wrap;",
        button { style: "padding:6px 16px;border:none;border-radius:4px;background:#3a6ea5;color:#fff;cursor:pointer;", "Primary" }
        button { style: "padding:6px 16px;border:1px solid #ccc;border-radius:4px;background:#fff;color:#333;cursor:pointer;", "Secondary" }
        button { style: "padding:6px 16px;border:none;border-radius:4px;background:transparent;color:#3a6ea5;cursor:pointer;", "Ghost" }
        button { style: "padding:6px 16px;border:none;border-radius:4px;background:#ef4444;color:#fff;cursor:pointer;", "Danger" }
    }
}
```

## 비활성화 상태

버튼을 비활성화할 수 있으며, 이 경우 클릭할 수 없습니다.

```hikari
rsx! {
    div { style: "display:flex;gap:8px;padding:1rem;",
        button { style: "padding:6px 16px;border:none;border-radius:4px;background:#3a6ea5;color:#fff;", "Normal" }
        button { disabled: true, style: "padding:6px 16px;border:none;border-radius:4px;background:#ccc;color:#999;cursor:not-allowed;", "Disabled" }
    }
}
```

## 아이콘 버튼 크기

아이콘 버튼은 소(24px), 중(32px), 대(40px)의 3가지 크기를 지원합니다.

```hikari
rsx! {
    div { style: "display:flex;gap:12px;padding:1rem;align-items:center;",
        button { style: "width:24px;height:24px;border:1px solid #ccc;border-radius:4px;background:#fff;cursor:pointer;", "" }
        button { style: "width:32px;height:32px;border:1px solid #ccc;border-radius:4px;background:#fff;cursor:pointer;", "" }
        button { style: "width:40px;height:40px;border:1px solid #ccc;border-radius:4px;background:#fff;cursor:pointer;", "" }
    }
}
```

## 아이콘 버튼 변형

아이콘 버튼은 Ghost, Primary, Secondary, Danger, Success의 5가지 색상 변형을 지원합니다.

```hikari
rsx! {
    div { style: "display:flex;gap:8px;padding:1rem;",
        button { style: "width:32px;height:32px;border:none;border-radius:4px;background:transparent;color:#666;cursor:pointer;", "G" }
        button { style: "width:32px;height:32px;border:none;border-radius:4px;background:#3a6ea5;color:#fff;cursor:pointer;", "P" }
        button { style: "width:32px;height:32px;border:1px solid #ccc;border-radius:4px;background:#fff;color:#333;cursor:pointer;", "S" }
        button { style: "width:32px;height:32px;border:none;border-radius:4px;background:#ef4444;color:#fff;cursor:pointer;", "D" }
        button { style: "width:32px;height:32px;border:none;border-radius:4px;background:#22c55e;color:#fff;cursor:pointer;", "✓" }
    }
}
```

## API

### Button Props

| 속성 | 설명 | 타입 | 기본값 |
|------|------|------|--------|
| variant | 버튼 스타일 변형 | ButtonVariant | Primary |
| size | 버튼 크기 | ButtonSize | Medium |
| disabled | 비활성화 여부 | bool | false |
| children | 버튼 콘텐츠 | Element | - |

### IconButton Props

| 속성 | 설명 | 타입 | 기본값 |
|------|------|------|--------|
| icon | 표시할 아이콘 | MdiIcon | - |
| size | 버튼 크기 | IconButtonSize | Large |
| variant | 색상 변형 | IconButtonVariant | Ghost |
| glow | 글로우 효과 활성화 | bool | true |
| disabled | 비활성화 여부 | bool | false |
| onclick | 클릭 핸들러 | EventHandler\<MouseEvent\> | - |
