# 로그인 모드

Hikari는 하나의 로그인 흐름(`HkLoginFlow`)과, 그 주변의 세 가지 요소를 제공하여 모든 Celestia 프런트엔드가 서버의 로그인 정책 문서로부터 같은 로그인 UI를 마운트할 수 있게 합니다. 디스커버리 어댑터, 핸드오프 화면, 그리고 실제 링크가 될 수 있는 채널 행입니다.

```mermaid
flowchart LR
  D[로그인 정책 문서] --> A[hkLoginPlanFromDiscovery]
  A -->|local / federated| F[HkLoginFlow]
  A -->|relay| S[HkAuthHandoff status=redirecting]
  S --> R[중앙 로그인]
  R -->|콜백| C[HkAuthHandoff status=completing]
  C -->|성공| O[HkAuthHandoff status=success]
  C -->|실패| X[HkAuthHandoff status=failed / expired]
```

## 세 가지 모드

| 모드 | 비밀번호 폼 | 공급자 행 | 호스트가 마운트하는 것 |
| --- | --- | --- | --- |
| `local` | 자격 증명 채널 하나 | `oauth`가 아닌 모든 종류의 입구 (현재 `passkey`, `custom`) | 채널 하나뿐인 `HkLoginFlow`. 세그먼트 그룹 없음 |
| `federated`, `password: true` | 자격 증명 채널 하나 | 폼 아래에 모든 방법 (`oauth`, `passkey`, `custom`) | 채널 하나뿐인 `HkLoginFlow` |
| `federated`, `password: false` | 없음 | 각 방법이 각자 `sso` 채널이 됨 | 방법마다 채널이 하나씩인 `HkLoginFlow` |
| `relay` | 없음 | 없음 | **`HkLoginFlow`를 마운트하지 않음** — `HkAuthHandoff`가 중앙 로그인으로 이동 |

## 디스커버리 어댑터

`loginDiscovery.ts`는 순수 함수 집합입니다. 반응성 없음, 엔드포인트 없음, URL 조립 없음. 타입은 와이어 문서(`version`, `mode`, `password`, `methods[]`, `relay`)와 필드 단위로 일치합니다.

```tsx
import {
  hkLoginPlanFromDiscovery, hkRelayEntryHref,
  HkAuthHandoff, HkLoginFlow,
} from "@celestia-island/hikari/vue";

const plan = hkLoginPlanFromDiscovery(policy, {
  credentialsKey: "cloud",          // 기본값 "cloud"
  credentialsLabel: "Celestia",     // 선택적 세그먼트 라벨
  divider: "다른 방법으로 로그인",    // 선택적. 전달하지 않으면 렌더링되지 않음
});
const channel = ref(plan.defaultChannel ?? "");
```

| 내보내기 | 결과 |
| --- | --- |
| `hkLoginPlanFromDiscovery(doc, copy?)` | `{ mode, channels, defaultChannel }`. relay 모드에서는 `channels`가 `[]`, `defaultChannel`이 `null` |
| `hkRelayEntryHref(doc, returnTo?)` | relay 모드가 아니면 `null`. 그 외에는 진입 URL을 반환하며, 돌아갈 주소가 같은 출처 경로일 때만 덧붙임 |
| `hkIsSameOriginPath(raw)` | `/x`는 `true`. `//host`, `/`, 상대·절대 URL은 `false` |

알 수 없는 방법 종류와 `id`가 비어 있는 방법은 무시됩니다. 어댑터는 이해하지 못하는 문서 때문에 예외를 던지지 않습니다.

## 핸드오프 화면

`HkAuthHandoff`는 폼이 아닌 로그인 화면입니다. relay 스플래시, 콜백 교환, 그리고 종결 상태를 담당합니다. `HkAuthScreen` 위에 구축되며 인증 카드 문법(logo, 제목, 설명)을 사용합니다.

```tsx
<HkAuthHandoff
  status={state}                 // "redirecting" | "completing" | "success" | "failed" | "expired"
  logoSrc="/logo.svg"
  href={entryHref ?? undefined}  // redirecting: 이동 대상
  delayMs={600}
  onRedirect={(href) => allow(href)}  // false를 반환하면 취소
  onRetry={() => restart()}
  onBack={() => router.push("/login")}
/>
```

| 속성 | 기본값 | 효과 |
| --- | --- | --- |
| `status` | 필수 | `redirecting` / `completing`: 스피너와 정중한 라이브 영역. `failed` / `expired`: `role="alert"` |
| `title` / `description` | `undefined` | `hikari::authHandoff.*`의 상태 문구를 덮어씀. 설명은 기본적으로 없음 |
| `logoSrc` | `undefined` | 로고 없음 |
| `href` | `undefined` | 지정하면 `delayMs` 후 이동. 지정하지 않으면 호스트가 `redirect`에서 이동 |
| `delayMs` | `0` | 스플래시를 보여 준 뒤 이동하기까지의 시간 |
| `actions` | `failed` / `expired`는 `["back"]`, 나머지는 `[]` | 기본 제공 버튼. `actions` 슬롯이 이를 대체 |

이벤트: `redirect(href)`, `retry()`, `back()`. 슬롯: `header`, `footer`(`HkAuthScreen`으로 전달), `actions`.

## 링크 행

`HkAuthChannelListEntry`와 이를 전달하는 `HkLoginSsoChannel`은 `href`를 가질 수 있습니다. 그러면 해당 행은 실제 `<a href>`로 렌더링됩니다. 가운데 클릭과 Ctrl 클릭이 동작하고 크롤러도 대상을 볼 수 있습니다. `select(key)`(또는 `sso-click`)는 여전히 먼저 발생하며 내비게이션은 결코 막히지 않습니다. 비활성 링크에는 `href`가 없고, 비활성 버튼과 마찬가지로 건너뛰며 `aria-disabled="true"`를 가집니다. `href`가 없으면 행은 이전처럼 `<button type="button">`입니다.

## 호스트의 책임

- 로그인 정책 문서는 서버에서 검증한다. hikari는 전달받은 것을 신뢰한다.
- relay 모드에서는 `HkLoginFlow`를 마운트하지 않고 `HkAuthHandoff`를 마운트한다.
- 돌아갈 주소로는 같은 출처 경로만 전달한다. `hkIsSameOriginPath` 또는 자체 허용 목록을 사용한다.
- 행의 `href`도 같은 출처 경로여야 한다(문서는 서버에서 검증된다). hikari는 이를 검사하지 않는다.
