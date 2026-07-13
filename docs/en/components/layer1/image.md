# Image

Image component for displaying images with loading state and error handling.

## Basic Usage

```hikari
rsx! {
    div { style: "padding:1rem;",
        img { src: "https://via.placeholder.com/200x120", alt: "Sample", style: "border-radius:8px;max-width:100%;" }
    }
}
```

## Loading Placeholder

```hikari
rsx! {
    div { style: "padding:1rem;",
        div { style: "width:200px;height:120px;background:#f0f0f0;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#999;", "No Image" }
    }
}
```

## API

| Property | Description | Type | Default |
|----------|-------------|------|---------|
| src | Image URL | String | - |
| alt | Alt text | String | - |
| width | Width | Option\<String\> | None |
| height | Height | Option\<String\> | None |
