# Delete Gate Window

An open-and-go delete confirmation window. ANY delete-related surface mounts it with `open` + `title`; the default slot renders the message area; the only confirm control is a serpentine walk (a full traced lane with random right-angle corners) — the walk IS the confirmation, and there is deliberately no second dialog.

## The house rule for the message slot

**The slot copy must carry EVERY key fact of the thing being deleted, each wrapped in an [`HkDeleteFact`](#hkdeletefact) emphasis tag** — so the irreversible act visibly names its target instead of waving at an anonymous blob:

- the name of the thing, plus its per-locale alias where one exists;
- its owner;
- its size/counters (how many resources are attached);
- the names of everything attached to it.

A reviewer reading the slot must be able to answer "what exactly am I deleting?" from the facts alone.

## Usage

```hikari:tsx
<HkDeleteGateWindow
  v-model:open="open"
  title="删除工作区"
  label="此工作区"
  grab-hint="按住摇杆沿路径拖到最右端"
  tracking-hint="继续——到达终点即删除"
  :turns="[5, 7]"
  @confirm="performDelete"
>
  <div class="hk-delete-gate-message">
    <HkDeleteFact label="名称" value="ml-lab" />
    <HkDeleteFact label="所有者" value="demiurge" />
    <HkDeleteFact label="来源" value="7 个仓库" />
  </div>
</HkDeleteGateWindow>
```

## Props

| prop | type | notes |
|---|---|---|
| `open` | boolean | visibility, `v-model:open` |
| `title` | string | window title |
| `label` | string | what is being deleted (gate `aria-label`) |
| `grab-hint` | string | hint before grabbing (localized) |
| `tracking-hint` | string | hint while tracking (localized) |
| `turns` | `[min, max]` | corner-count range; default `[3, 5]`; **higher stakes → more turns** (a `[5, 7]` lane walks more corners); even numbers clamp DOWN (at-most) |
| `seed` | number | pins the random lane (tests / design review) |
| `disabled` | boolean | freezes the gate (e.g. delete RPC in flight) |

## Events

| event | payload | fires when |
|---|---|---|
| `confirm` | — | full walk released at the goal (the parent performs the actual deletion) |
| `cancel` | progress 0..1 | released short of the goal (spring back) |
| `update:open` | boolean | window closed by the user or by the confirm |

## HkDeleteFact

One emphasised key fact: a bordered chip pairing a muted `label` with a strong `value`. Use one per fact; never render a bare value.

## Accessibility

- the knob is a slider handle: arrow keys walk the lane, `Enter` confirms at the end, `Escape` cancels — keyboard parity with the pointer walk;
- `aria-live` announces progress in twenty-percent bands;
- reduced motion replaces the spring with an instant reset.
