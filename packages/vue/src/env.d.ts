/// <reference types="vite/client" />

// Wildcard shim for SFCs. This package itself is TSX-only (no `.vue`
// sources), but consumers of the published library may add `.vue` files to
// their own build, and a wildcard module declaration is what makes those
// importable. The third type argument (data) is `Record<string, never>`
// rather than `any`: a shim that returns `any` for every component erases
// exactly the prop checking this library exists to provide.
declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<Record<string, never>, Record<string, never>, Record<string, never>>;
  export default component;
}
