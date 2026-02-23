# Number Input 숫자 입력

Number Input 컴포넌트는 스테퍼 기능을 지원하는 숫자 입력용입니다.

## 기본 사용법

```_hikari_component
pages/components/layer1/number_input#basic
```

## 크기

3가지 크기 지원: 작음, 중간(기본값), 큼.

```_hikari_component
pages/components/layer1/number_input#sizes
```

## 비활성화 상태

```_hikari_component
pages/components/layer1/number_input#disabled
```

## 스테퍼와 범위 제한

최소값, 최대값, 스텝 크기를 설정할 수 있습니다.

```_hikari_component
pages/components/layer1/number_input#stepper
```

## API

| 속성 | 설명 | 타입 | 기본값 |
|------|------|------|--------|
| value | 현재 값 | i64 | 0 |
| on_change | 값 변경 콜백 | EventHandler<i64> | - |
| min | 최소값 | Option<i64> | None |
| max | 최대값 | Option<i64> | None |
| step | 스텝 크기 | i64 | 1 |
| disabled | 비활성화 여부 | bool | false |
| size | 크기 | NumberInputSize | Medium |
| class | 사용자 정의 클래스 | String | "" |
| style | 사용자 정의 스타일 | String | "" |

### NumberInputSize

- `Small` - 작은 크기 (24px)
- `Medium` - 중간 크기 (32px, 기본값)
- `Large` - 큰 크기 (40px)
