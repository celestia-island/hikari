# ZoomControls

ZoomControls 컴포넌트는 인터페이스 확대/축소를 제어합니다.

## 기본 사용법

```hikari
rsx! {
    div { style: "padding:1rem;display:inline-flex;gap:4px;align-items:center;border:1px solid #e2e2ea;border-radius:6px;padding:4px;",
        button { style: "width:28px;height:28px;border:none;background:none;cursor:pointer;font-size:16px;", "−" }
        span { style: "font-size:14px;min-width:40px;text-align:center;", "100%" }
        button { style: "width:28px;height:28px;border:none;background:none;cursor:pointer;font-size:16px;", "+" }
    }
}
```

## API

| 속성 | 설명 | 타입 | 기본값 |
|------|------|------|--------|
| zoom | 확대/축소 레벨 | f64 | 1.0 |
| min | 최소값 | f64 | 0.5 |
| max | 최대값 | f64 | 2.0 |
