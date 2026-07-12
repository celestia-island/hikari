# Tag

Tag 컴포넌트는 레이블이나 표시를 표시하는 데 사용됩니다.

## 기본 사용법

```hikari
rsx! {
    div { style: "padding:1rem;display:flex;gap:8px;flex-wrap:wrap;",
        span { style: "padding:2px 8px;border-radius:4px;background:#f0f0f0;font-size:12px;color:#333;", "Default" }
        span { style: "padding:2px 8px;border-radius:4px;background:rgba(58,110,165,0.1);color:#3a6ea5;font-size:12px;", "Primary" }
        span { style: "padding:2px 8px;border-radius:4px;background:rgba(34,197,94,0.1);color:#22c55e;font-size:12px;", "Success" }
        span { style: "padding:2px 8px;border-radius:4px;background:rgba(245,158,11,0.1);color:#f59e0b;font-size:12px;", "Warning" }
        span { style: "padding:2px 8px;border-radius:4px;background:rgba(239,68,68,0.1);color:#ef4444;font-size:12px;", "Danger" }
    }
}
```

## 닫기 가능한 태그

```hikari
rsx! {
    div { style: "padding:1rem;display:flex;gap:8px;",
        span { style: "padding:2px 8px;border-radius:4px;background:rgba(58,110,165,0.1);color:#3a6ea5;font-size:12px;display:flex;align-items:center;gap:4px;", "Tag ✕" }
    }
}
```

## API

| 속성 | 설명 | 타입 | 기본값 |
|------|------|------|--------|
| children | 태그 내용 | Element | - |
| closable | 닫기 가능 여부 | bool | false |
| on_close | 닫기 콜백 | Option\<EventHandler\> | None |
