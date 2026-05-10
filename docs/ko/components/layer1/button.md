# Button

Button 컴포넌트는 가장 기본적인 사용자 상호작용 컴포넌트로, 다양한 스타일과 상태를 지원합니다.

버튼은 폼 제출, 대화상자 열기, 작업 취소 또는 삭제 작업 수행과 같은 액션이나 이벤트를 트리거하는 데 사용됩니다.

## 버튼 변형

Primary, Secondary, Ghost, Danger의 4가지 변형을 지원합니다.

```_hikari_component
pages/components/layer1/button#variants
```

## 비활성화 상태

버튼을 비활성화할 수 있으며, 이 경우 클릭할 수 없습니다.

```_hikari_component
pages/components/layer1/button#disabled
```

## 아이콘 버튼 크기

아이콘 버튼은 소(24px), 중(32px), 대(40px)의 3가지 크기를 지원합니다.

```_hikari_component
pages/components/layer1/button#icon-sizes
```

## 아이콘 버튼 변형

아이콘 버튼은 Ghost, Primary, Secondary, Danger, Success의 5가지 색상 변형을 지원합니다.

```_hikari_component
pages/components/layer1/button#icon-variants
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
