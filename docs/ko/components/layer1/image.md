# Image

Image 컴포넌트는 로딩 상태와 오류 처리를 지원하는 이미지 표시 컴포넌트입니다.

## 기본 사용법

```hikari
rsx! {
    div { style: "padding:1rem;",
        img { src: "https://via.placeholder.com/200x120", alt: "Sample", style: "border-radius:8px;max-width:100%;" }
    }
}
```

## 로딩 플레이스홀더

```hikari
rsx! {
    div { style: "padding:1rem;",
        div { style: "width:200px;height:120px;background:#f0f0f0;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#999;", "No Image" }
    }
}
```

## API

| 속성 | 설명 | 타입 | 기본값 |
|------|------|------|--------|
| src | 이미지 URL | String | - |
| alt | 대체 텍스트 | String | - |
| width | 너비 | Option\<String\> | None |
| height | 높이 | Option\<String\> | None |
