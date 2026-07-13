# QRCode

QR 코드 생성 컴포넌트입니다.

## 기본 사용법

```hikari
rsx! {
    div { style: "padding:1rem;",
        div { style: "width:100px;height:100px;background:#000;display:grid;grid-template-columns:repeat(10,1fr);",
            div { style: "background:#fff;aspect-ratio:1;", "" }
        }
    }
}
```

## API

| 속성 | 설명 | 타입 | 기본값 |
|------|------|------|--------|
| value | QR 코드 내용 | String | - |
| size | 크기 | u32 | 128 |
