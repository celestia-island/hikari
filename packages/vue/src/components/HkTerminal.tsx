import {
  defineComponent,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";

import { FitAddon } from "@xterm/addon-fit";
import { ImageAddon } from "@xterm/addon-image";
import { Terminal, type ITheme } from "@xterm/xterm";

// xterm's own core stylesheet (element layout, viewport scrolling, the
// hidden helper textarea) — the component is self-sufficient only with
// it in place; sideEffects in package.json keeps bundlers from pruning.
import "@xterm/xterm/css/xterm.css";

import "./HkTerminal.scss";

/**
 * HkTerminal — the shared terminal rendering surface (a rich component in
 * the HkMarkdownRenderer class, not a thin wrapper).
 *
 * Owns the whole xterm.js lifecycle: creation, fitting, image-protocol
 * decoding, theming from the hikari theme channels, and disposal. The
 * consumer owns the DATA — it feeds bytes in through `write` (Uint8Array
 * passthrough keeps split UTF-8 and APC/SIXEL/kitty payloads intact) and
 * listens to `data` / `resize` to drive its transport.
 *
 * Props
 * - `cols` / `rows`: initial grid (autoFit re-fits to the host afterwards).
 * - `autoFit`: keep the grid matched to the host box (ResizeObserver).
 *   (Mount-only: toggling after mount has no effect.)
 * - `enableImages`: decode kitty graphics / SIXEL / iTerm2 IIP payloads
 *   in-band (remote-control sessions push screenshots through the PTY;
 *   mount-only).
 * - `fontSize` / `fontFamily`: terminal typography (defaults to the
 *   hikari mono stack).
 * - `scrollback`: scrollback buffer size.
 * - `cursorBlink`: blinking caret.
 *
 * Events
 * - `data(text)`: keystrokes and pastes (UTF-8 text, as xterm emits).
 * - `resize({cols, rows})`: the grid changed (autoFit or option change).
 *
 * Exposed API
 * - `write(data: string | Uint8Array)` — binary-safe feed.
 * - `writeln`, `clear`, `reset`, `fit`, `focus`, `dimensions`.
 *
 * Theming: the xterm theme is derived from the hikari color channels
 * (`--color-background` / `--color-text` / `--color-primary` / …) at
 * mount, and re-derived when the document element's class or style
 * changes (the light/dark switch mechanism consumers use).
 */

/** Resolve an `r g b` triplet channel (with fallback) to `#rrggbb`. */
function channelToHex(host: HTMLElement, name: string, fallback: string): string {
  const raw = getComputedStyle(host).getPropertyValue(name).trim();
  const parts = raw.split(/\s+/).map((p) => Number.parseFloat(p));
  if (parts.length === 3 && parts.every((n) => Number.isFinite(n) && n >= 0 && n <= 255)) {
    return (
      "#" +
      parts
        .map((n) => Math.round(n).toString(16).padStart(2, "0"))
        .join("")
    );
  }
  // Some channels are already full colors (rgb(...) / #hex) — pass through.
  if (raw && !raw.includes(" ")) return raw;
  return fallback;
}

function deriveXtermTheme(host: HTMLElement): ITheme {
  return {
    background: channelToHex(host, "--color-background", "#14161a"),
    foreground: channelToHex(host, "--color-text", "#e6e6e6"),
    cursor: channelToHex(host, "--color-primary", "#7aa2f7"),
    cursorAccent: channelToHex(host, "--color-background", "#14161a"),
    selectionBackground: channelToHex(host, "--color-selected-bg", "#3b4356") + "88",
  };
}

const FAMILY_FALLBACK =
  "ui-monospace, 'SF Mono', Menlo, Consolas, 'DejaVu Sans Mono', monospace";

export default defineComponent({
  name: "HkTerminal",
  props: {
    cols: { type: Number, default: 80 },
    rows: { type: Number, default: 24 },
    autoFit: { type: Boolean, default: true },
    enableImages: { type: Boolean, default: true },
    fontSize: { type: Number, default: 13 },
    fontFamily: { type: String, default: FAMILY_FALLBACK },
    scrollback: { type: Number, default: 2000 },
    cursorBlink: { type: Boolean, default: true },
  },
  emits: {
    data: (text: string) => typeof text === "string",
    resize: (dims: { cols: number; rows: number }) =>
      typeof dims?.cols === "number" && typeof dims?.rows === "number",
  },
  setup(props, { emit, expose }) {
    const hostRef = ref<HTMLElement>();
    let term: Terminal | null = null;
    let fitAddon: FitAddon | null = null;
    let observer: ResizeObserver | null = null;
    let themeObserver: MutationObserver | null = null;

    function emitResize(cols: number, rows: number) {
      emit("resize", { cols, rows });
    }

    onMounted(() => {
      const host = hostRef.value;
      if (!host) return;
      const t = new Terminal({
        cursorBlink: props.cursorBlink,
        fontSize: props.fontSize,
        fontFamily: props.fontFamily,
        cols: props.cols,
        rows: props.rows,
        scrollback: props.scrollback,
        theme: deriveXtermTheme(host),
        allowProposedApi: true,
      });
      const fa = new FitAddon();
      t.loadAddon(fa);
      if (props.enableImages) {
        // Image protocols: kitty graphics (APC _G) + SIXEL + iTerm2 IIP —
        // remote-control sessions push screenshots and plots through the
        // same PTY stream; their escape sequences must render as images.
        // 0.10.0-beta is currently the only kitty implementation for
        // xterm.js (alpha upstream).
        t.loadAddon(
          new ImageAddon({
            enableSizeReports: true,
            sixelSupport: true,
            iipSupport: true,
            kittySupport: true,
            sixelPaletteLimit: 256,
            storageLimit: 256,
            showPlaceholder: false,
          }),
        );
      }
      t.open(host);
      t.onData((text) => emit("data", text));
      t.onResize(({ cols, rows }) => emitResize(cols, rows));
      term = t;
      fitAddon = fa;
      if (props.autoFit) {
        fa.fit();
        observer = new ResizeObserver(() => {
          if (!fitAddon || !term) return;
          fitAddon.fit();
        });
        observer.observe(host);
      }
      // Re-derive colors when the consumer flips the theme (host apps
      // switch light/dark by mutating :root class or style).
      const retheme = () => {
        if (term && hostRef.value) term.options.theme = deriveXtermTheme(hostRef.value);
      };
      if (typeof MutationObserver !== "undefined") {
        themeObserver = new MutationObserver(retheme);
        themeObserver.observe(document.documentElement, {
          attributes: true,
          attributeFilter: ["class", "style", "data-theme", "data-mode"],
        });
      }
    });

    onBeforeUnmount(() => {
      observer?.disconnect();
      observer = null;
      themeObserver?.disconnect();
      themeObserver = null;
      term?.dispose();
      term = null;
      fitAddon = null;
    });

    // Live option updates (recreate-free where xterm supports it).
    watch(
      () => [props.fontSize, props.fontFamily, props.scrollback, props.cursorBlink],
      ([fontSize, fontFamily, scrollback, cursorBlink]) => {
        if (!term) return;
        term.options.fontSize = fontSize as number;
        term.options.fontFamily = fontFamily as string;
        term.options.scrollback = scrollback as number;
        term.options.cursorBlink = cursorBlink as boolean;
        fitAddon?.fit();
      },
    );
    watch(
      () => [props.cols, props.rows],
      ([cols, rows]) => {
        if (!term) return;
        if (term.cols !== (cols as number) || term.rows !== (rows as number)) {
          // term.resize fires xterm's own onResize, which emits to the
          // consumer exactly once — emitting here as well would double
          // every resize.
          term.resize(cols as number, rows as number);
        }
      },
    );

    expose({
      /** Binary-safe feed: Uint8Array goes to xterm's UTF-8 decoder, so
       * multi-byte sequences split across writes survive. */
      write(data: string | Uint8Array) {
        term?.write(data);
      },
      writeln(data: string) {
        term?.writeln(data);
      },
      clear() {
        term?.clear();
      },
      reset() {
        term?.reset();
      },
      fit() {
        fitAddon?.fit();
      },
      focus() {
        term?.focus();
      },
      /** Current grid size (null before mount). */
      get dimensions(): { cols: number; rows: number } | null {
        return term ? { cols: term.cols, rows: term.rows } : null;
      },
    });

    return () => <div ref={hostRef} class="hk-terminal" />;
  },
});

/** Test seam: pure helpers (no DOM dependency beyond getComputedStyle). */
export const __testables = { channelToHex };
