# Avatar

Avatar 컴포넌트는 사용자 또는 엔티티의 아바타 이미지를 표시하는 데 사용됩니다.

## 크기

Xs, Sm, Md, Lg, Xl의 5가지 크기를 지원합니다.

```hikari
rsx! {
    div { style: "display:flex;gap:8px;padding:1rem;align-items:center;",
        div { style: "width:16px;height:16px;border-radius:50%;background:#3a6ea5;display:flex;align-items:center;justify-content:center;color:#fff;font-size:8px;", "XS" }
        div { style: "width:24px;height:24px;border-radius:50%;background:#3a6ea5;display:flex;align-items:center;justify-content:center;color:#fff;font-size:10px;", "S" }
        div { style: "width:32px;height:32px;border-radius:50%;background:#3a6ea5;display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;", "M" }
        div { style: "width:40px;height:40px;border-radius:50%;background:#3a6ea5;display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;", "L" }
        div { style: "width:48px;height:48px;border-radius:50%;background:#3a6ea5;display:flex;align-items:center;justify-content:center;color:#fff;font-size:16px;", "XL" }
    }
}
```

## 모양 변형

Circular(원형), Rounded(둥근모서리), Square(사각형)의 3가지 모양을 지원합니다.

```hikari
rsx! {
    div { style: "display:flex;gap:12px;padding:1rem;align-items:center;",
        div { style: "width:40px;height:40px;border-radius:50%;background:#3a6ea5;display:flex;align-items:center;justify-content:center;color:#fff;", "A" }
        div { style: "width:40px;height:40px;border-radius:8px;background:#3a6ea5;display:flex;align-items:center;justify-content:center;color:#fff;", "B" }
        div { style: "width:40px;height:40px;border-radius:0;background:#3a6ea5;display:flex;align-items:center;justify-content:center;color:#fff;", "C" }
    }
}
```

## 텍스트 대체

이미지가 없을 경우 이니셜 또는 사용자 지정 텍스트를 표시합니다.

```hikari
rsx! {
    div { style: "display:flex;gap:8px;padding:1rem;",
        div { style: "width:40px;height:40px;border-radius:50%;background:#3a6ea5;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:600;", "JD" }
    }
}
```

## API

### Props

| 속성 | 설명 | 타입 | 기본값 |
|------|------|------|--------|
| src | 이미지 URL | Option\<String\> | None |
| alt | 대체 텍스트 | String | - |
| size | 크기 | AvatarSize | Md |
| variant | 모양 변형 | AvatarVariant | Circular |
| fallback | 대체 텍스트 | Option\<String\> | None |
