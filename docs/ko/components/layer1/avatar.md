# Avatar

Avatar 컴포넌트는 사용자 또는 엔티티의 아바타 이미지를 표시하는 데 사용됩니다.

## 크기

Xs, Sm, Md, Lg, Xl의 5가지 크기를 지원합니다.

```_hikari_component
pages/components/layer1/avatar#sizes
```

## 모양 변형

Circular(원형), Rounded(둥근모서리), Square(사각형)의 3가지 모양을 지원합니다.

```_hikari_component
pages/components/layer1/avatar#variants
```

## 텍스트 대체

이미지가 없을 경우 이니셜 또는 사용자 지정 텍스트를 표시합니다.

```_hikari_component
pages/components/layer1/avatar#fallback
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
