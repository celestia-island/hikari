# Number Input

Number Input 컴포넌트는 스테퍼를 지원하는 숫자 입력 컴포넌트입니다.

## 기본 사용법

```_hikari_component
pages/components/layer1/number_input#basic
```

## 스테퍼 포함

```_hikari_component
pages/components/layer1/number_input#stepper
```

## API

| 속성 | 설명 | 타입 | 기본값 |
|------|------|------|--------|
| value | 현재 값 | i64 | 0 |
| min | 최소값 | Option\<i64\> | None |
| max | 최대값 | Option\<i64\> | None |
| step | 단계 크기 | i64 | 1 |
