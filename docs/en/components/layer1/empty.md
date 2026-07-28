# Empty

Empty component for displaying empty data state.

## Basic Usage

```hikari:rust
rsx! {
    div { style: "padding:2rem;text-align:center;color:#999;",
        p { style: "font-size:14px;margin:0;", "No data available" }
    }
}
```
```hikari:tsx
<HEmptyState icon="inbox" title="No items" description="Nothing to show yet" />
```

## API

| Property | Description | Type | Default |
|----------|-------------|------|---------|
| description | Description text | Option\<String\> | None |
