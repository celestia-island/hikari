import { useSSRContext } from "vue";

/**
 * Real-file stand-in for @vitejs/plugin-vue-jsx's SSR virtual module.
 *
 * When the plugin SSR-transforms a component that registers JSX components,
 * it appends `import { ssrRegisterHelper } from "/__vue-jsx-ssr-register-helper"`
 * and serves that id as a VIRTUAL module. Vitest fetches the virtual module
 * itself, but the module runner derives the module's `import.meta.url` from
 * the id alone — a rootless `file:///__vue-jsx-ssr-register-helper` — and
 * vitest's evaluator builds the module context with a plain Node
 * `createRequire(url)`. Windows rejects a file URL without a drive letter
 * (ERR_INVALID_ARG_VALUE), so every `@vitest-environment node` suite that
 * imports a .tsx component died before running a single test (hikari#1058).
 *
 * The alias in vite.config.ts points that id HERE, so the runner sees a real
 * file path and `createRequire` gets a normal, absolute file URL. The body
 * mirrors the plugin's virtual module — it wraps `setup` so a server render
 * records the component's module into `ssrContext.modules` — keep the two
 * in sync when upgrading the plugin.
 */

/** A component options object the plugin's SSR transform can rewire. */
interface SsrRegisterableComponent {
  setup?: (props: unknown, ctx: unknown) => unknown;
}

export function ssrRegisterHelper(
  comp: SsrRegisterableComponent,
  filename: string,
): void {
  const setup = comp.setup;
  comp.setup = (props, ctx) => {
    const ssrContext = useSSRContext();
    if (ssrContext) {
      const modules = ssrContext.modules ?? (ssrContext.modules = new Set());
      modules.add(filename);
    }
    if (setup) return setup(props, ctx);
  };
}
