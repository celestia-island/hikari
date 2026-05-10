# Avatar

Avatar component is used to display user or entity avatar images.

## Sizes

Supports five sizes: Xs, Sm, Md, Lg, Xl.

```_hikari_component
pages/components/layer1/avatar#sizes
```

## Shape Variants

Supports three shapes: Circular, Rounded, Square.

```_hikari_component
pages/components/layer1/avatar#variants
```

## Text Fallback

When no image is available, displays initials or custom text.

```_hikari_component
pages/components/layer1/avatar#fallback
```

## API

### Props

| Property | Description | Type | Default |
|----------|-------------|------|---------|
| src | Image URL | Option\<String\> | None |
| alt | Alt text | String | - |
| size | Size | AvatarSize | Md |
| variant | Shape variant | AvatarVariant | Circular |
| fallback | Fallback text | Option\<String\> | None |
