# Page Chrome: The Action-Bar Grammar

Admin and console pages share ONE header contract: the page owns the top-right
action cluster through declared-purpose slots, and the cluster — not the page
body — is where its primary affordances live.

## The canonical slots

Every registration declares a PURPOSE; the cluster renders canonical slots by
rank, regardless of the order the views register them in:

```text
[create][filter][search][refresh][window]
```

Registrations whose purpose is not one of the canonical slots are customs:
they render AFTER the enum zone, stuffed right-to-left in reverse registration
order, so the canonical zone never moves.

## The create rule

A page's primary create action — the affordance that creates a new top-level
entity (a provider, a channel, a group, an access rule, a theme on the shared
line) — is a **plus icon button in the top-right cluster, left of refresh**.
It is never a standalone button inside the page body.

The visible label an in-body button would have carried becomes the button's
accessible name and tooltip; the page keeps owning its own create dialog.

**In-context adds are exempt.** A plus that adds a row to a sub-list inside an
editor, dialog, wizard, or card ("add a model row", "add a member", "add a
mount scheme") is part of that local grammar, not the page's create action,
and stays where it is.

## Geometry

The cluster is one row of chrome: every icon button steps the same size ladder
(`useChromeActionSize`), with 16 px glyphs. A flat fixed-size button beside
ladder-sized neighbors reads as a different button family — compose the
cluster from the shared helpers, never hand-pinned sizes.

## Reference implementation

hikari supplies the chrome: `HkAdminHeader`'s action row, `HkIconButton`, and
`useChromeActionSize`. Hosts register through an action-bar context that
renders the slots above; the chest webui's `useActionBar` /
`usePageCreateAction` is the reference implementation of this grammar.
