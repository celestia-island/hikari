# アニメーションシステム

静的値、動的値、複雑なタイムライン、30以上のイージング関数をサポートする高性能な宣言型アニメーションシステム。

## 目次

- [概要](#概要)
- [コア機能](#コア機能)
- [AnimationBuilder](#animationbuilder)
- [Tween](#tween)
- [Easing](#easing)
- [Timeline](#timeline)
- [プリセット](#プリセット)
- [スポットライト](#スポットライト)
- [コンテキスト](#コンテキスト)
- [スタイル](#スタイル)
- [使用例](#使用例)

## 概要

`hikari-animation`は完全なアニメーションソリューションを提供します：

- **宣言型API** - CSSのような流暢な構文
- **動的値** - ランタイム計算のアニメーション値（マウス追従など）
- **高性能** - WASM最適化、デバウンス更新、requestAnimationFrame
- **タイプセーフ** - コンパイル時チェックのCSSプロパティ
- **豊富なプリセット** - フェード、スライド、スケールなどの一般的なアニメーション

## コア機能

### 1. AnimationBuilder

高度なアニメーションビルダーがサポート：

- **複数要素制御** - 複数のDOM要素を同時に制御
- **動的値** - AnimationContextに基づくリアルタイム計算
- **自動トランジション** - インテリジェントなトランジション管理
- **タイプセーフ** - CssProperty列挙型がタイプミスを防止

### 2. Tweenシステム

補間アニメーションシステム：

- **値の補間** - スムーズな数値トランジション
- **カスタムイージング** - 30以上の組み込みイージング関数
- **時間制御** - 継続時間と遅延の制御
- **ループ反復** - ループ再生のサポート

### 3. イージング関数

豊富なイージング関数ライブラリ：

- **基本** - Linear、EaseIn、EaseOut、EaseInOut
- **Sine** - サインイージング
- **Quad** - 2次イージング
- **Cubic** - 3次イージング
- **Quart** - 4次イージング
- **Quint** - 5次イージング
- **Expo** - 指数イージング
- **Circ** - 円形イージング
- **Back** - バック/オーバーシュート効果
- **Elastic** - 弾性効果
- **Bounce** - バウンス効果

### 4. Timeline

タイムライン制御：

- **シーケンシャルアニメーション** - 複数のアニメーションを順番に再生
- **並列アニメーション** - 複数のアニメーションを同時に再生
- **遅延実行** - 正確なタイミング制御
- **アニメーショングループ** - 複雑なアニメーションシーケンスの整理

### 5. プリセット

プリセットアニメーションライブラリ：

- **Fade** - フェードイン/アウト
- **Slide** - スライドイン/アウト
- **Scale** - スケールアニメーション
- **Rotate** - 回転アニメーション
- **Flip** - フリップアニメーション
- **Zoom** - ズームイン/アウト

### 6. スポットライト

スポットライト効果：

- **マウス追従** - 光効果がマウスカーソルに追従
- **グラデーション照明** - スムーズな放射グラデーション
- **パフォーマンス** - デバウンス更新、スロットル再描画
- **自動初期化** - スポットライト要素のスキャンと初期化

## AnimationBuilder

### 基本的な使い方

```rust
use hikari_animation::{AnimationBuilder, AnimationContext};
use hikari_animation::style::CssProperty;
use std::collections::HashMap;

// 要素マッピングを作成
let mut elements = HashMap::new();
elements.insert("button".to_string(), button_element);

// 静的スタイルを適用
AnimationBuilder::new(&elements)
    .add_style("button", CssProperty::Opacity, "0.8")
    .add_class("button", "hi-flex")
    .apply();
```

### 動的値アニメーション

```rust
// マウス追従効果
AnimationBuilder::new(&elements)
    .add_style_dynamic("button", CssProperty::Transform, |ctx| {
        let x = ctx.mouse_x();
        let y = ctx.mouse_y();
        format!("translate({}px, {}px)", x, y)
    })
    .apply_with_transition("150ms", "ease-out");
```

### 複数要素アニメーション

```rust
// 複数の要素を同時に制御
let mut elements = HashMap::new();
elements.insert("button".to_string(), button_element);
elements.insert("icon".to_string(), icon_element);

AnimationBuilder::new(&elements)
    .add_style("button", CssProperty::Opacity, "0.8")
    .add_style("icon", CssProperty::Transform, "scale(1.1)")
    .add_class("button", "hi-flex")
    .apply();
```

### トランジションアニメーション

```rust
// トランジション付きアニメーション
AnimationBuilder::new(&elements)
    .add_style("button", CssProperty::Width, "100px")
    .apply_with_transition("300ms", "ease-in-out");

// カスタムトランジションプロパティ
AnimationBuilder::new(&elements)
    .add_style("button", CssProperty::Transform, "rotate(90deg)")
    .apply_with_transition("500ms", "cubic-bezier(0.68, -0.55, 0.265, 1.55)");
```

### APIリファレンス

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

時間経過に伴う値の補間。

### 基本的なTween

```rust
use hikari_animation::tween::{Tween, TweenBuilder};

let tween = TweenBuilder::new()
    .from(0.0)
    .to(100.0)
    .duration(1000) // ms
    .easing(ease::EaseOut)
    .build();
```

### コールバック付きTween

```rust
let tween = TweenBuilder::new()
    .from(0.0)
    .to(1.0)
    .duration(500)
    .on_update(|value| {
        println!("現在の値: {}", value);
    })
    .on_complete(|| {
        println!("アニメーション完了！");
    })
    .build();
```

### 連鎖Tween

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

イージング関数はアニメーションの速度を制御します。

### 基本的なイージング

```rust
use hikari_animation::easing;

// Linear - イージングなし
linear(0.5); // 0.5

// Ease In - 遅く始まり、速く終わる
ease_in(0.5); // 0.25

// Ease Out - 速く始まり、遅く終わる
ease_out(0.5); // 0.75

// Ease In Out - 両端で遅い
ease_in_out(0.5); // 0.5
```

### 高度なイージング

```rust
// Back - わずかにオーバーシュート
back_out(0.5); // 1.2

// Elastic - 振動
elastic_out(0.5); // 1.0

// Bounce - 終了時にバウンス
bounce_out(0.5); // 0.75
```

### すべてのイージング関数

```rust
// 基本
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

アニメーションシーケンスとタイミングを制御。

### シーケンシャルアニメーション

```rust
use hikari_animation::Timeline;

let mut timeline = Timeline::new();

// アニメーションを順番に追加
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

### 並列アニメーション

```rust
let mut timeline = Timeline::new();

// アニメーションを同時に再生
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

### タイムライン制御

```rust
let timeline = Timeline::new();

// 再生制御
timeline.play();      // 再生開始
timeline.pause();     // 再生一時停止
timeline.reverse();   // 逆再生
timeline.seek(0.5);   // 50%にシーク

// 速度制御
timeline.set_speed(2.0);  // 2倍速
timeline.set_speed(0.5);  // 0.5倍速

// ループ制御
timeline.set_loop(true);
timeline.set_repeat_count(3);
```

## プリセット

プリセットアニメーションライブラリ。

### フェードアニメーション

```rust
use hikari_animation::presets;

// フェードイン
presets::fade_in(&elements, "box", 300);

// フェードアウト
presets::fade_out(&elements, "box", 300);

// 特定の不透明度にフェード
presets::fade_to(&elements, "box", 0.5, 300);
```

### スライドアニメーション

```rust
// 左からスライドイン
presets::slide_in_left(&elements, "box", 300);

// 右からスライドイン
presets::slide_in_right(&elements, "box", 300);

// 左にスライドアウト
presets::slide_out_left(&elements, "box", 300);

// 上からスライドイン
presets::slide_in_top(&elements, "box", 300);
```

### スケールアニメーション

```rust
// 拡大
presets::scale_up(&elements, "box", 1.5, 300);

// 縮小
presets::scale_down(&elements, "box", 0.8, 300);

// パルス
presets::pulse(&elements, "box", 300);
```

### 回転アニメーション

```rust
// 時計回りに回転
presets::rotate_cw(&elements, "box", 90, 500);

// 反時計回りに回転
presets::rotate_ccw(&elements, "box", 90, 500);

// フリップ
presets::flip_x(&elements, "box", 500);
presets::flip_y(&elements, "box", 500);
```

## スポットライト

要素のマウス追従光効果。

### 基本的なスポットライト

```rust
use hikari_animation::spotlight;

// すべてのボタンにスポットライトを初期化
spotlight::init();

// または特定の要素に初期化
spotlight::init_selector(".hi-button");
```

### カスタムスポットライト

```rust
spotlight::Config {
    size: 200,              // スポットライトサイズ（px）
    opacity: 0.15,          // 不透明度（0-1）
    color: "#00A0E9",       // 光の色
    blur: 20,              // ぼかし半径（px）
    transition: "150ms"     // トランジション速度
}.init();
```

### コンポーネントでのスポットライト

```rust
rsx! {
    Button {
        label: "ホバーしてください",
        class: "hi-spotlight",  // スポットライトを有効化
        "Data: spot-{spot_id}"   // 一意の識別子
    }
}
```

### スポットライトの無効化

```rust
// 特定の要素で無効化
spotlight::disable_selector(".no-spotlight");

// すべて無効化
spotlight::disable_all();
```

## コンテキスト

アニメーションコンテキストはランタイム情報を提供。

### マウス位置

```rust
AnimationBuilder::new(&elements)
    .add_style_dynamic("target", CssProperty::Transform, |ctx| {
        let x = ctx.mouse_x();
        let y = ctx.mouse_y();
        format!("translate({}px, {}px)", x, y)
    })
    .apply();
```

### 時間ベースのアニメーション

```rust
.add_style_dynamic("clock", CssProperty::Transform, |ctx| {
    let time = ctx.elapsed_time();
    let angle = (time.as_millis() % 1000) as f64 / 1000.0 * 360.0;
    format!("rotate({}deg)", angle)
})
```

### スクロール位置

```rust
.add_style_dynamic("header", CssProperty::Background, |ctx| {
    let scroll_y = ctx.scroll_y();
    let opacity = (scroll_y / 100.0).min(1.0);
    format!("rgba(0, 160, 233, {})", opacity)
})
```

## スタイル

タイプセーフなCSSプロパティ操作。

### CssProperty列挙型

```rust
use hikari_animation::style::CssProperty;

// カラープロパティ
CssProperty::Color
CssProperty::BackgroundColor
CssProperty::BorderColor

// レイアウトプロパティ
CssProperty::Width
CssProperty::Height
CssProperty::Margin
CssProperty::Padding

// トランスフォームプロパティ
CssProperty::Transform
CssProperty::Translate
CssProperty::Scale
CssProperty::Rotate

// エフェクトプロパティ
CssProperty::Opacity
CssProperty::BoxShadow
CssProperty::Filter
```

### スタイル操作

```rust
// 単一プロパティを設定
builder.add_style("element", CssProperty::Color, "#00A0E9");

// トランスフォームを設定
builder.add_style("element", CssProperty::Transform, "translate(10px, 20px)");

// 不透明度を設定
builder.add_style("element", CssProperty::Opacity, "0.5");

// 複雑なトランスフォーム
builder.add_style("element", CssProperty::Transform,
    "perspective(1000px) rotateX(45deg) translateZ(50px)");
```

## 使用例

### ボタンホバー効果

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
            "ホバーしてください"
        }
    }
}
```

### ローディングアニメーション

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

### パララックススクロール

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
                "コンテンツ"
            }
        }
    }
}
```

### アニメーションカウンター

```rust
#[component]
fn AnimatedCounter() -> Element {
    let mut count = use_signal(|| 0);

    use_effect(move || {
        let target = 1000;
        let duration = 2000; // 2秒
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

## パフォーマンス最適化

### デバウンス更新

```rust
use hikari_animation::AnimationBuilder;

// AnimationBuilderは自動的に更新をデバウンス
AnimationBuilder::new(&elements)
    .add_style_dynamic("element", CssProperty::Transform, |ctx| {
        // これはデバウンスされる - mousemoveごとに更新されない
        let x = ctx.mouse_x();
        format!("translateX({}px)", x)
    })
    .apply_with_transition("100ms", "ease-out");
```

### RequestAnimationFrame

アニメーションシステムはスムーズな60fpsアニメーションのために`requestAnimationFrame`を使用：

```rust
// 自動RAF統合
AnimationBuilder::new(&elements)
    .add_style("anim", CssProperty::Opacity, "1")
    .apply_with_transition("1000ms", "ease");
```

### GPUアクセラレーション

GPUアクセラレーションされたアニメーションのためにtransformとopacityを使用：

```rust
// ✅ 良い - GPUアクセラレーション
builder.add_style("element", CssProperty::Transform, "translateX(100px)");
builder.add_style("element", CssProperty::Opacity, "0.5");

// ❌ 避ける - レイアウトをトリガー
builder.add_style("element", CssProperty::Width, "100px");
builder.add_style("element", CssProperty::Margin, "10px");
```

### Will-changeヒント

```css
/* ブラウザへの最適化ヒント */
.animated-element {
    will-change: transform, opacity;
}
```

## APIリファレンス

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
    // 内部
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

## ベストプラクティス

### 1. トランジションを控えめに使用

```rust
// ✅ 良い - ユーザー操作時のみ
button {
    onmouseenter: move |_| {
        builder.apply_with_transition("200ms", "ease");
    }
}

// ❌ 避ける - 継続的なアニメーション
loop {
    builder.apply_with_transition("16ms", "linear"); // 60fps、重い！
}
```

### 2. レイアウトよりトランスフォームを優先

```rust
// ✅ 良い - GPUアクセラレーション
builder.add_style("el", CssProperty::Transform, "translateX(100px)");

// ❌ 避ける - レイアウトスラッシング
builder.add_style("el", CssProperty::Margin, "100px");
```

### 3. 適切なイージングを使用

```rust
// 自然な感じ
"ease-out"      // 減速
"ease-in-out"   // 加速してから減速

// 機械的な感じ
"linear"        // 一定速度

// 遊び心のある
"elastic-out"   // バウンス
"bounce-out"    // 終了時にバウンス
```

### 4. モーション軽減を尊重

```rust
use_effect(move || {
    let prefers_reduced_motion = window()
        .match_media("(prefers-motion: reduce)")
        .ok()
        .and_then(|m| m.matches());

    if prefers_reduced_motion.unwrap_or(false) {
        // シンプルなアニメーションを使用
        builder.apply_with_transition("0ms", "linear");
    } else {
        // 完全なアニメーション
        builder.apply_with_transition("300ms", "ease-out");
    }
});
```

## 関連システム

- [テーマシステム](./theme.md) - アニメーション用のCSS変数
- [コンポーネント](../components/) - アニメーション付きUIコンポーネント
- [パレットシステム](./palette.md) - 色定義
