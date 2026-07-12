# Collapsible

Collapsible는 접을 수 있는 패널 컴포넌트입니다.

## 기본 사용법

```hikari
rsx! {
    div { style: "padding:1rem;border:1px solid #e2e2ea;border-radius:8px;max-width:300px;",
        div { style: "padding:12px;font-weight:600;cursor:pointer;background:#f7f7fa;", "Click to expand ▼" }
        div { style: "padding:12px;color:#666;font-size:14px;", "Collapsible content" }
    }
}
```

## API

| 속성 | 설명 | 타입 | 기본값 |
|------|------|------|--------|
| title | 제목 | String | - |
| expanded | 확장 상태 | bool | false |
