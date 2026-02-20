# Animation 시스템

정적 값, 동적 값, 복잡한 타임라인 및 30개 이상의 이징 함수를 지원하는 고성능 선언적 애니메이션 시스템입니다.

## 목차

- [개요](#개요)
- [핵심 기능](#핵심-기능)
- [AnimationBuilder](#animationbuilder)
- [Tween](#tween)
- [Easing](#easing)
- [Timeline](#timeline)
- [Presets](#presets)
- [Spotlight](#spotlight)
- [Context](#context)
- [Style](#style)
- [사용 예제](#사용-예제)

## 개요

`hikari-animation`이 제공하는 완전한 애니메이션 솔루션:

- **선언적 API**: CSS와 유사한 플루언트 문법
- **동적 값**: 런타임 계산 애니메이션 값 (마우스 추적 등)
- **고성능**: WASM 최적화, 디바운스 업데이트, requestAnimationFrame
- **타입 안전**: 컴파일 타임 검사 CSS 속성
- **풍부한 프리셋**: 페이드, 슬라이드, 스케일 및 기타 일반 애니메이션

## 핵심 기능

### 1. AnimationBuilder

고급 애니메이션 빌더가 지원하는 기능:

- **다중 요소 제어**: 여러 DOM 요소를 동시에 제어
- **동적 값**: AnimationContext 기반 실시간 계산
- **자동 트랜지션**: 지능형 트랜지션 관리
- **타입 안전**: CssProperty enum으로 오타 방지

### 2. Tween 시스템

보간 애니메이션 시스템:

- **값 보간**: 부드러운 숫자 전환
- **커스텀 이징**: 30개 이상의 내장 이징 함수
- **시간 제어**: 지속 시간 및 지연 제어
- **루프 반복**: 루프 재생 지원

### 3. Easing 함수

풍부한 이징 함수 라이브러리:

- **기본**: Linear, EaseIn, EaseOut, EaseInOut
- **Sine**: 사인 이징
- **Quad**: 이차 이징
- **Cubic**: 삼차 이징
- **Quart**: 사차 이징
- **Quint**: 오차 이징
- **Expo**: 지수 이징
- **Circ**: 원형 이징
- **Back**: 백/오버슈트 효과
- **Elastic**: 탄성 효과
- **Bounce**: 바운스 효과

### 4. Timeline

타임라인 제어:

- **순차 애니메이션**: 여러 애니메이션을 순서대로 재생
- **병렬 애니메이션**: 여러 애니메이션을 동시에 재생
- **지연 실행**: 정밀한 타이밍 제어
- **애니메이션 그룹**: 복잡한 애니메이션 시퀀스 구성

### 5. Presets

프리셋 애니메이션 라이브러리:

- **Fade**: 페이드 인/아웃
- **Slide**: 슬라이드 인/아웃
- **Scale**: 스케일 애니메이션
- **Rotate**: 회전 애니메이션
- **Flip**: 플립 애니메이션
- **Zoom**: 확대/축소

### 6. Spotlight

스포트라이트 효과:

- **마우스 추적**: 마우스 커서를 따라가는 글로우 효과
- **그라디언트 조명**: 부드러운 방사형 그라디언트
- **성능**: 디바운스 업데이트, 스로틀 리페인트
- **자동 초기화**: 스포트라이트 요소 스캔 및 초기화

## AnimationBuilder

### 기본 사용법

```rust
use hikari_animation::{AnimationBuilder, AnimationContext};
use hikari_animation::style::CssProperty;
use std::collections::HashMap;

// 요소 매핑 생성
let mut elements = HashMap::new();
elements.insert("button".to_string(), button_element);

// 정적 스타일 적용
AnimationBuilder::new(&elements)
    .add_style("button", CssProperty::Opacity, "0.8")
    .add_class("button", "hi-flex")
    .apply();
```

### 동적 값 애니메이션

```rust
// 마우스 추적 효과
AnimationBuilder::new(&elements)
    .add_style_dynamic("button", CssProperty::Transform, |ctx| {
        let x = ctx.mouse_x();
        let y = ctx.mouse_y();
        format!("translate({}px, {}px)", x, y)
    })
    .apply_with_transition("150ms", "ease-out");
```

### 다중 요소 애니메이션

```rust
// 여러 요소를 동시에 제어
let mut elements = HashMap::new();
elements.insert("button".to_string(), button_element);
elements.insert("icon".to_string(), icon_element);

AnimationBuilder::new(&elements)
    .add_style("button", CssProperty::Opacity, "0.8")
    .add_style("icon", CssProperty::Transform, "scale(1.1)")
    .add_class("button", "hi-flex")
    .apply();
```

### 트랜지션 애니메이션

```rust
// 트랜지션과 함께 애니메이션
AnimationBuilder::new(&elements)
    .add_style("button", CssProperty::Width, "100px")
    .apply_with_transition("300ms", "ease-in-out");

// 커스텀 트랜지션 속성
AnimationBuilder::new(&elements)
    .add_style("button", CssProperty::Transform, "rotate(90deg)")
    .apply_with_transition("500ms", "cubic-bezier(0.68, -0.55, 0.265, 1.55)");
```

### API 참조

```rust
impl AnimationBuilder {
    pub fn new(elements: &HashMap<String, Element>) -> Self;

    pub fn add_style(self, element: &str, property: CssProperty, value: &str) -> Self;
    pub fn add_style_dynamic<F>(self, element: &str, property: CssProperty, f: F) -> Self
    where
        F: Fn(&AnimationContext) -> String + 'static;

    pub fn add_class(self, element: &str, class: &str) -> Self;
    pub fn remove_class(self, element: &str, class: &str) -> Self;

    pub fn apply(self);
    pub fn apply_with_transition(self, duration: &str, easing: &str);
}
```

## Tween

시간에 따른 값 사이의 보간입니다.

### 기본 Tween

```rust
use hikari_animation::tween::{Tween, TweenBuilder};

let tween = TweenBuilder::new()
    .from(0.0)
    .to(100.0)
    .duration(1000) // ms
    .easing(ease::EaseOut)
    .build();
```

### 콜백이 있는 Tween

```rust
let tween = TweenBuilder::new()
    .from(0.0)
    .to(1.0)
    .duration(500)
    .on_update(|value| {
        println!("현재 값: {}", value);
    })
    .on_complete(|| {
        println!("애니메이션 완료!");
    })
    .build();
```

### 연결된 Tween

```rust
let mut timeline = Timeline::new();

timeline.push(
    TweenBuilder::new()
        .from(0.0)
        .to(100.0)
        .duration(300)
        .build()
);

timeline.push(
    TweenBuilder::new()
        .from(100.0)
        .to(0.0)
        .duration(300)
        .delay(200)
        .build()
);

timeline.play();
```

## Easing

이징 함수는 애니메이션 속도를 제어합니다.

### 기본 이징

```rust
use hikari_animation::easing;

// Linear - 이징 없음
linear(0.5); // 0.5

// Ease In - 느리게 시작, 빠르게 끝
ease_in(0.5); // 0.25

// Ease Out - 빠르게 시작, 느리게 끝
ease_out(0.5); // 0.75

// Ease In Out - 양쪽 끝에서 느림
ease_in_out(0.5); // 0.5
```

### 고급 이징

```rust
// Back - 약간 오버슈트
back_out(0.5); // 1.2

// Elastic - 진동
elastic_out(0.5); // 1.0

// Bounce - 끝에서 바운스
bounce_out(0.5); // 0.75
```

### 모든 이징 함수

```rust
// 기본
pub fn linear(t: f64) -> f64;
pub fn ease_in(t: f64) -> f64;
pub fn ease_out(t: f64) -> f64;
pub fn ease_in_out(t: f64) -> f64;

// Sine
pub fn sine_in(t: f64) -> f64;
pub fn sine_out(t: f64) -> f64;
pub fn sine_in_out(t: f64) -> f64;

// Quad
pub fn quad_in(t: f64) -> f64;
pub fn quad_out(t: f64) -> f64;
pub fn quad_in_out(t: f64) -> f64;

// Cubic
pub fn cubic_in(t: f64) -> f64;
pub fn cubic_out(t: f64) -> f64;
pub fn cubic_in_out(t: f64) -> f64;

// Quart
pub fn quart_in(t: f64) -> f64;
pub fn quart_out(t: f64) -> f64;
pub fn quart_in_out(t: f64) -> f64;

// Quint
pub fn quint_in(t: f64) -> f64;
pub fn quint_out(t: f64) -> f64;
pub fn quint_in_out(t: f64) -> f64;

// Expo
pub fn expo_in(t: f64) -> f64;
pub fn expo_out(t: f64) -> f64;
pub fn expo_in_out(t: f64) -> f64;

// Circ
pub fn circ_in(t: f64) -> f64;
pub fn circ_out(t: f64) -> f64;
pub fn circ_in_out(t: f64) -> f64;

// Back
pub fn back_in(t: f64) -> f64;
pub fn back_out(t: f64) -> f64;
pub fn back_in_out(t: f64) -> f64;

// Elastic
pub fn elastic_in(t: f64) -> f64;
pub fn elastic_out(t: f64) -> f64;
pub fn elastic_in_out(t: f64) -> f64;

// Bounce
pub fn bounce_in(t: f64) -> f64;
pub fn bounce_out(t: f64) -> f64;
pub fn bounce_in_out(t: f64) -> f64;
```

## Timeline

애니메이션 시퀀스와 타이밍을 제어합니다.

### 순차 애니메이션

```rust
use hikari_animation::Timeline;

let mut timeline = Timeline::new();

// 시퀀스로 애니메이션 추가
timeline.add(
    AnimationBuilder::new(&elements)
        .add_style("box", CssProperty::Opacity, "0")
        .build()
);

timeline.add(
    AnimationBuilder::new(&elements)
        .add_style("box", CssProperty::Opacity, "1")
        .with_delay(200)
        .build()
);

timeline.play();
```

### 병렬 애니메이션

```rust
let mut timeline = Timeline::new();

// 애니메이션을 동시에 재생
timeline.add_parallel(
    AnimationBuilder::new(&elements)
        .add_style("box", CssProperty::Transform, "translateX(100px)")
        .build()
);

timeline.add_parallel(
    AnimationBuilder::new(&elements)
        .add_style("box", CssProperty::Opacity, "0.5")
        .build()
);

timeline.play();
```

### 타임라인 제어

```rust
let timeline = Timeline::new();

// 재생 제어
timeline.play();      // 재생 시작
timeline.pause();     // 재생 일시정지
timeline.reverse();   // 역방향 재생
timeline.seek(0.5);   // 50%로 이동

// 속도 제어
timeline.set_speed(2.0);  // 2배속
timeline.set_speed(0.5);  // 0.5배속

// 루프 제어
timeline.set_loop(true);
timeline.set_repeat_count(3);
```

## Presets

미리 만들어진 애니메이션 프리셋입니다.

### Fade 애니메이션

```rust
use hikari_animation::presets;

// 페이드 인
presets::fade_in(&elements, "box", 300);

// 페이드 아웃
presets::fade_out(&elements, "box", 300);

// 특정 불투명도로 페이드
presets::fade_to(&elements, "box", 0.5, 300);
```

### Slide 애니메이션

```rust
// 왼쪽에서 슬라이드 인
presets::slide_in_left(&elements, "box", 300);

// 오른쪽에서 슬라이드 인
presets::slide_in_right(&elements, "box", 300);

// 왼쪽으로 슬라이드 아웃
presets::slide_out_left(&elements, "box", 300);

// 위쪽에서 슬라이드 인
presets::slide_in_top(&elements, "box", 300);
```

### Scale 애니메이션

```rust
// 확대
presets::scale_up(&elements, "box", 1.5, 300);

// 축소
presets::scale_down(&elements, "box", 0.8, 300);

// 펄스
presets::pulse(&elements, "box", 300);
```

### Rotate 애니메이션

```rust
// 시계 방향 회전
presets::rotate_cw(&elements, "box", 90, 500);

// 반시계 방향 회전
presets::rotate_ccw(&elements, "box", 90, 500);

// 플립
presets::flip_x(&elements, "box", 500);
presets::flip_y(&elements, "box", 500);
```

### 커스텀 프리셋

```rust
use hikari_animation::presets::PresetBuilder;

let custom_preset = PresetBuilder::new()
    .duration(500)
    .easing("ease-out")
    .add_keyframe(0.0, vec![
        (CssProperty::Opacity, "0"),
        (CssProperty::Transform, "translateY(-20px)")
    ])
    .add_keyframe(1.0, vec![
        (CssProperty::Opacity, "1"),
        (CssProperty::Transform, "translateY(0)")
    ])
    .build();

custom_preset.apply(&elements, "element");
```

## Spotlight

요소에 대한 마우스 추적 글로우 효과입니다.

### 기본 Spotlight

```rust
use hikari_animation::spotlight;

// 모든 버튼에 스포트라이트 초기화
spotlight::init();

// 또는 특정 요소에 초기화
spotlight::init_selector(".hi-button");
```

### 커스텀 Spotlight

```rust
spotlight::Config {
    size: 200,              // 스포트라이트 크기 (px)
    opacity: 0.15,          // 불투명도 (0-1)
    color: "#00A0E9",       // 글로우 색상
    blur: 20,              // 블러 반경 (px)
    transition: "150ms"     // 트랜지션 속도
}.init();
```

### 컴포넌트에서 Spotlight 사용

```rust
rsx! {
    Button {
        label: "호버하세요",
        class: "hi-spotlight",  // 스포트라이트 활성화
        "Data: spot-{spot_id}"   // 고유 식별자
    }
}
```

### Spotlight 비활성화

```rust
// 특정 요소에서 비활성화
spotlight::disable_selector(".no-spotlight");

// 모두 비활성화
spotlight::disable_all();
```

## Context

애니메이션 컨텍스트는 런타임 정보를 제공합니다.

### 마우스 위치

```rust
AnimationBuilder::new(&elements)
    .add_style_dynamic("target", CssProperty::Transform, |ctx| {
        let x = ctx.mouse_x();
        let y = ctx.mouse_y();
        format!("translate({}px, {}px)", x, y)
    })
    .apply();
```

### 시간 기반 애니메이션

```rust
.add_style_dynamic("clock", CssProperty::Transform, |ctx| {
    let time = ctx.elapsed_time();
    let angle = (time.as_millis() % 1000) as f64 / 1000.0 * 360.0;
    format!("rotate({}deg)", angle)
})
```

### 스크롤 위치

```rust
.add_style_dynamic("header", CssProperty::Background, |ctx| {
    let scroll_y = ctx.scroll_y();
    let opacity = (scroll_y / 100.0).min(1.0);
    format!("rgba(0, 160, 233, {})", opacity)
})
```

## Style

타입 안전한 CSS 속성 조작입니다.

### CssProperty Enum

```rust
use hikari_animation::style::CssProperty;

// 색상 속성
CssProperty::Color
CssProperty::BackgroundColor
CssProperty::BorderColor

// 레이아웃 속성
CssProperty::Width
CssProperty::Height
CssProperty::Margin
CssProperty::Padding

// Transform 속성
CssProperty::Transform
CssProperty::Translate
CssProperty::Scale
CssProperty::Rotate

// 효과 속성
CssProperty::Opacity
CssProperty::BoxShadow
CssProperty::Filter
```

### 스타일 조작

```rust
// 단일 속성 설정
builder.add_style("element", CssProperty::Color, "#00A0E9");

// Transform 설정
builder.add_style("element", CssProperty::Transform, "translate(10px, 20px)");

// 불투명도 설정
builder.add_style("element", CssProperty::Opacity, "0.5");

// 복잡한 Transform
builder.add_style("element", CssProperty::Transform,
    "perspective(1000px) rotateX(45deg) translateZ(50px)");
```

### 커스텀 CSS 속성

```rust
// 커스텀 속성
builder.add_style("element", CssProperty::Custom("--my-var"), "value");

// 그리고 사용
builder.add_style("element", CssProperty::Color, "var(--my-var)");
```

## 사용 예제

### 버튼 호버 효과

```rust
use hikari_animation::{AnimationBuilder, AnimationContext};
use hikari_animation::style::CssProperty;

#[component]
fn AnimatedButton() -> Element {
    let elements = use_signal(|| {
        let mut map = HashMap::new();
        map.insert("btn".to_string(), get_button_element());
        map
    });

    rsx! {
        button {
            class: "hi-button hi-spotlight",
            onmouseenter: move |_| {
                AnimationBuilder::new(&elements())
                    .add_style("btn", CssProperty::Transform, "scale(1.05)")
                    .add_style("btn", CssProperty::BoxShadow, "0 8px 16px rgba(0, 160, 233, 0.3)")
                    .apply_with_transition("200ms", "ease-out");
            },
            onmouseleave: move |_| {
                AnimationBuilder::new(&elements())
                    .add_style("btn", CssProperty::Transform, "scale(1)")
                    .add_style("btn", CssProperty::BoxShadow, "none")
                    .apply_with_transition("200ms", "ease-out");
            },
            "호버하세요"
        }
    }
}
```

### 로딩 애니메이션

```rust
#[component]
fn LoadingSpinner() -> Element {
    let elements = use_signal(|| HashMap::new());

    use_effect(move || {
        let elements = elements.clone();
        async move {
            loop {
                AnimationBuilder::new(&elements())
                    .add_style("spinner", CssProperty::Transform, "rotate(0deg)")
                    .build();

                AnimationBuilder::new(&elements())
                    .add_style("spinner", CssProperty::Transform, "rotate(360deg)")
                    .apply_with_transition("1000ms", "linear");

                tokio::time::sleep(Duration::from_millis(1000)).await;
            }
        }
    });

    rsx! {
        div {
            id: "spinner",
            style: "width: 40px; height: 40px; border: 4px solid var(--hi-color-primary); border-top-color: transparent; border-radius: 50%;"
        }
    }
}
```

### 패럴랙스 스크롤

```rust
#[component]
fn ParallaxSection() -> Element {
    let scroll_y = use_signal(|| 0.0);

    rsx! {
        div {
            onscroll: move |e| {
                scroll_y.set(e.scroll_y());

                AnimationBuilder::new(&elements())
                    .add_style_dynamic("bg", CssProperty::Transform, |ctx| {
                        let y = ctx.scroll_y() * 0.5;
                        format!("translateY({}px)", y)
                    })
                    .apply_with_transition("100ms", "ease-out");
            },
            div {
                id: "bg",
                style: "position: fixed; width: 100%; height: 100%; background: url(bg.jpg);"
            },
            div {
                style: "position: relative; z-index: 1;",
                "콘텐츠"
            }
        }
    }
}
```

### 애니메이션 카운터

```rust
#[component]
fn AnimatedCounter() -> Element {
    let mut count = use_signal(|| 0);

    use_effect(move || {
        let target = 1000;
        let duration = 2000; // 2초
        let steps = 60;
        let step_value = target as f64 / steps as f64;
        let step_duration = duration / steps;

        async move {
            for i in 0..=steps {
                count.set((i as f64 * step_value) as i32);
                tokio::time::sleep(Duration::from_millis(step_duration)).await;
            }
        }
    });

    rsx! {
        div {
            class: "counter",
            "{count()}"
        }
    }
}
```

## 성능 최적화

### 디바운스 업데이트

```rust
use hikari_animation::AnimationBuilder;

// AnimationBuilder는 자동으로 업데이트를 디바운스함
AnimationBuilder::new(&elements)
    .add_style_dynamic("element", CssProperty::Transform, |ctx| {
        // 디바운스됨 - 모든 mousemove에서 업데이트되지 않음
        let x = ctx.mouse_x();
        format!("translateX({}px)", x)
    })
    .apply_with_transition("100ms", "ease-out");
```

### RequestAnimationFrame

애니메이션 시스템은 부드러운 60fps 애니메이션을 위해 `requestAnimationFrame`을 사용합니다:

```rust
// 자동 RAF 통합
AnimationBuilder::new(&elements)
    .add_style("anim", CssProperty::Opacity, "1")
    .apply_with_transition("1000ms", "ease");
```

### GPU 가속

GPU 가속 애니메이션을 위해 transform과 opacity를 사용하세요:

```rust
// ✅ 좋음 - GPU 가속
builder.add_style("element", CssProperty::Transform, "translateX(100px)");
builder.add_style("element", CssProperty::Opacity, "0.5");

// ❌ 피하세요 - 레이아웃 트리거
builder.add_style("element", CssProperty::Width, "100px");
builder.add_style("element", CssProperty::Margin, "10px");
```

### Will-change 힌트

```css
/* 브라우저 최적화를 위한 힌트 */
.animated-element {
    will-change: transform, opacity;
}
```

## API 참조

### AnimationBuilder

```rust
pub struct AnimationBuilder<'a> {
    elements: &'a HashMap<String, Element>,
}

impl<'a> AnimationBuilder<'a> {
    pub fn new(elements: &'a HashMap<String, Element>) -> Self;

    pub fn add_style(self, element: &str, property: CssProperty, value: &str) -> Self;
    pub fn add_style_dynamic<F>(self, element: &str, property: CssProperty, f: F) -> Self
    where
        F: Fn(&AnimationContext) -> String + 'static;

    pub fn add_class(self, element: &str, class: &str) -> Self;
    pub fn remove_class(self, element: &str, class: &str) -> Self;

    pub fn apply(self);
    pub fn apply_with_transition(self, duration: &str, easing: &str);
    pub fn apply_with_custom_transition(self, transition: &str);
}
```

### AnimationContext

```rust
pub struct AnimationContext<'a> {
    pub mouse_x: f64,
    pub mouse_y: f64,
    pub scroll_x: f64,
    pub scroll_y: f64,
    pub elapsed_time: Duration,
    pub window_width: f64,
    pub window_height: f64,
}

impl<'a> AnimationContext<'a> {
    pub fn mouse_x(&self) -> f64;
    pub fn mouse_y(&self) -> f64;
    pub fn scroll_x(&self) -> f64;
    pub fn scroll_y(&self) -> f64;
    pub fn elapsed_time(&self) -> Duration;
}
```

### Timeline

```rust
pub struct Timeline {
    // 내부
}

impl Timeline {
    pub fn new() -> Self;

    pub fn add(&mut self, animation: Animation) -> &mut Self;
    pub fn add_parallel(&mut self, animation: Animation) -> &mut Self;

    pub fn play(&mut self);
    pub fn pause(&mut self);
    pub fn stop(&mut self);
    pub fn reverse(&mut self);
    pub fn seek(&mut self, progress: f64);

    pub fn set_speed(&mut self, speed: f64);
    pub fn set_loop(&mut self, loop: bool);
    pub fn set_repeat_count(&mut self, count: usize);
}
```

## 모범 사례

### 1. 트랜지션은 적당히 사용

```rust
// ✅ 좋음 - 사용자 상호작용에서만
button {
    onmouseenter: move |_| {
        builder.apply_with_transition("200ms", "ease");
    }
}

// ❌ 피하세요 - 지속적인 애니메이션
loop {
    builder.apply_with_transition("16ms", "linear"); // 60fps, 무거움!
}
```

### 2. 레이아웃보다 Transform 선호

```rust
// ✅ 좋음 - GPU 가속
builder.add_style("el", CssProperty::Transform, "translateX(100px)");

// ❌ 피하세요 - 레이아웃 스래싱
builder.add_style("el", CssProperty::Margin, "100px");
```

### 3. 적절한 이징 사용

```rust
// 자연스러운 느낌
"ease-out"      // 감속
"ease-in-out"   // 가속 후 감속

// 기계적인 느낌
"linear"        // 일정한 속도

// 장난스러운 느낌
"elastic-out"   // 바운스
"bounce-out"    // 끝에서 바운스
```

### 4. 움직임 감소 존중

```rust
use_effect(move || {
    let prefers_reduced_motion = window()
        .match_media("(prefers-motion: reduce)")
        .ok()
        .and_then(|m| m.matches());

    if prefers_reduced_motion.unwrap_or(false) {
        // 더 간단한 애니메이션 사용
        builder.apply_with_transition("0ms", "linear");
    } else {
        // 전체 애니메이션
        builder.apply_with_transition("300ms", "ease-out");
    }
});
```

## 관련 시스템

- [테마 시스템](./theme.md) - 애니메이션용 CSS 변수
- [컴포넌트](../components/) - 애니메이션 UI 컴포넌트
- [Palette 시스템](./palette.md) - 색상 정의
