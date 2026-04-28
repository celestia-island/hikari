# UserGuide

UserGuide 컴포넌트는 기능 소개를 위한 사용자 가이드 컴포넌트입니다.

## 기본 사용법

```_hikari_component
pages/components/layer3/user_guide#basic
```

## API

| 속성 | 설명 | 타입 | 기본값 |
|------|------|------|--------|
| steps | 가이드 단계들 | Vec\<GuideStep\> | - |
| active | 현재 단계 | usize | 0 |
