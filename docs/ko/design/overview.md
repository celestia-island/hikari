# 패키지 아키텍처: hikari-components

Hikari의 컴포넌트 체계는 단일 패키지 `hikari-components`로 모였습니다. `rsx!`로 작성한 렌더링
컴포넌트가 리액티브 hooks, 타입이 지정된 palette class, `StyledComponent` CSS와 함께 있습니다.

> **폐기: `hikari-extra-components`.** 이 패키지는 렌더링 컴포넌트와 별도로 프레임워크 비의존
> *데이터 모델*(`TimelineState`, `ZoomControlsState`, `GuideStep`, 노드 그래프 모델 등)을 제공해
> 같은 개념에 같은 이름의 타입이 둘 존재했습니다 — 예컨대 `TimelinePosition`의 기본값이 한쪽은
> `Left`, 다른 쪽은 `Alternate`였습니다. 워크스페이스에 의존하는 곳이 없고 노드 그래프 모델도 자체
> 테스트에서만 참조되어 패키지를 삭제했습니다. 중복이던 컴포넌트는 모두 이곳에 남아 있습니다:
> `display::{Timeline, DragLayer, UserGuide, ZoomControls}`,
> `production::{VideoPlayer, RichTextEditor, CodeHighlight}`.
