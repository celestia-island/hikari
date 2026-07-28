# Image

Image component for displaying images with loading state and error handling.

## Basic Usage

```hikari:rust
rsx! {
    div { style: "padding:1rem;",
        img { src: "https://via.placeholder.com/200x120", alt: "Sample", style: "border-radius:8px;max-width:100%;" }
    }
}
```
```hikari:tsx
<HIcon name="heart" :size="32" />
```

## Loading Placeholder

```hikari:rust
rsx! {
    div { style: "padding:1rem;",
        div { style: "width:200px;height:120px;background:#f0f0f0;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#999;", "No Image" }
    }
}
```
```hikari:tsx
<HIcon name="heart" :size="32" />
```

## API

| Property | Description | Type | Default |
|----------|-------------|------|---------|
| src | Image URL | String | - |
| alt | Alt text | String | - |
| width | Width | Option\<String\> | None |
| height | Height | Option\<String\> | None |
