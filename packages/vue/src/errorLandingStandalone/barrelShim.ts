// AI-generated: developed with the DeepSeek Harness agent (model
// DeepSeek-V4.1-Flash) directed and reviewed by langyo — SySL-1.0 §2.3
// disclosure.
//
// Standalone-build barrel shim.
//
// `HkJsonTree` reaches `useClipboard` through the package barrel
// (`@celestia-island/hikari` -> `src/index.ts`). The barrel is the whole
// library — every component, its stylesheet and the wasm-composable
// surface — none of which a self-contained error page may carry. The
// standalone build aliases the bare specifier to THIS module, which
// re-exports the same names from the same real source files: no copy, no
// duplicate instance, only the graph pruned to what the page imports.
// A named import the shim does not export fails the build loudly, so a
// future barrel import in a bundled component cannot silently widen the
// page — extend the shim (with the real source module as its target)
// instead of re-widening the alias.
export { useClipboard } from "../runtime/useClipboard";
