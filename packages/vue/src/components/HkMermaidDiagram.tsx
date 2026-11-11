/**
 * HkMermaidDiagram — the mermaid rendering business component, a peer of
 * the rich-text family (HkMarkdownRenderer renders prose, this renders
 * diagrams), built on the HkBoard 画板 (world camera, grid, minimap,
 * pan/zoom chrome).
 *
 * Contract (user direction 2026-11-16):
 *  - the PARSER is never bundled here: hosts register an engine on
 *    `globalThis.hkMermaidParser` (the exact convention the hljs global
 *    gives syntax highlighting). No engine, or a parse failure, or an
 *    unsupported diagram type → the source falls back to a plain code
 *    block — never a broken surface.
 *  - the caller decides the chrome: `minimap` hides the bottom-right
 *    minimap, `interactive` gates canvas dragging/zoom (HkBoard props,
 *    passed straight through).
 *
 * Layout lives in ../mermaid/layout.ts (pure, deterministic); this file
 * only adapts the laid-out model into HkBoard nodes/edges and paints
 * the per-kind node content through the board's `node` slot.
 */

import { computed, defineComponent, ref, type CSSProperties, type PropType, type VNode } from "vue";

import HkBoard, { type BoardEdgeInput, type BoardNodeInput } from "./HkBoard";
import { buildBoardModel, createCanvasMeasureText, type LaidOutNode, type MeasureText } from "../mermaid/layout";
import { getMermaidEngine } from "../mermaid/engine";
import type { ClassDefinition, ClassVisibility, MermaidDoc, MermaidNodeShape } from "../mermaid/types";
import "./HkMermaidDiagram.scss";

const VISIBILITY_SIGN: Record<ClassVisibility, string> = {
  public: "+",
  private: "-",
  protected: "#",
  internal: "~",
};

/** Stable measure singleton (canvas when the host has one, char-class
 * heuristic otherwise — see layout.ts). */
const measure: MeasureText = createCanvasMeasureText();

function fallbackBlock(source: string): () => VNode {
  return () => (
    <div class="hk-mermaid-fallback" role="note">
      <pre>
        <code>{source}</code>
      </pre>
    </div>
  );
}

/** Per-kind node painters (the board `node` slot body). */
function MermaidNodeBody(props: { node: BoardNodeInput }): VNode {
  const n = props.node;
  const data = n.data as Partial<LaidOutNode["data"]> & {
    shape?: MermaidNodeShape;
    label?: string;
    subtle?: boolean;
    header?: boolean;
    cls?: ClassDefinition;
    ticks?: number[];
    dayW?: number;
    doc?: MermaidDoc;
  };

  switch (n.kind) {
    case "shape": {
      const shape = data.shape ?? "rounded";
      const label = data.label ?? n.label ?? "";
      if (shape === "diamond") {
        // True rhombus via SVG polygon (horizontal diagonal = node width,
        // vertical = node height) — a CSS-rotated square is only a
        // rhombus when the box IS square, and the node box is sized for
        // the label, not for the shape (R4 finding 1).
        const w = n.w || 72;
        const h = n.h || 56;
        const pts = `${w / 2},0 ${w},${h / 2} ${w / 2},${h} 0,${h / 2}`;
        return (
          <div class="hk-mmd-node hk-mmd-node--diamond">
            <svg class="hk-mmd-node__diamond" viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
              <polygon points={pts} />
            </svg>
            <span class="hk-mmd-node__label">{label}</span>
          </div>
        );
      }
      const shapeClass = shape === "circle" ? "circle" : shape === "rect" ? "rect" : "rounded";
      return (
        <div class={`hk-mmd-node hk-mmd-node--${shapeClass}`}>
          <span class="hk-mmd-node__label">{label}</span>
        </div>
      );
    }
    case "participant":
      return <div class="hk-mmd-participant">{data.label}</div>;
    case "class": {
      const cls = data.cls;
      if (!cls) return <div class="hk-mmd-class" />;
      return (
        <div class="hk-mmd-class">
          <div class="hk-mmd-class__title">{cls.name}</div>
          {cls.attributes.length > 0 && (
            <div class="hk-mmd-class__block">
              {cls.attributes.map((m, i) => (
                <div key={i} class="hk-mmd-class__member">
                  {VISIBILITY_SIGN[m.visibility]}{m.name}{m.typeInfo ? `: ${m.typeInfo}` : ""}
                </div>
              ))}
            </div>
          )}
          {cls.methods.length > 0 && (
            <div class="hk-mmd-class__block hk-mmd-class__block--methods">
              {cls.methods.map((m, i) => (
                <div key={i} class="hk-mmd-class__member">
                  {VISIBILITY_SIGN[m.visibility]}{m.name}(){m.typeInfo ? `: ${m.typeInfo}` : ""}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }
    case "section":
      return <div class={{ "hk-mmd-section": true, "hk-mmd-section--subtle": Boolean(data.subtle), "hk-mmd-section--header": Boolean(data.header) }}>{data.label}</div>;
    case "task":
      return <div class="hk-mmd-task" title={String(data.name ?? "")}>{data.label}</div>;
    case "axis": {
      const ticks = data.ticks ?? [];
      const dayW = data.dayW ?? 30;
      return (
        <div class="hk-mmd-axis">
          {ticks.map((t) => (
            <span key={t} class="hk-mmd-axis__tick" style={{ left: `${t * dayW}px` }}>
              {t}d
            </span>
          ))}
        </div>
      );
    }
    case "pie": {
      const doc = data.doc;
      if (!doc || doc.kind !== "pie") return <div />;
      const total = doc.slices.reduce((s, x) => s + x.value, 0) || 1;
      const R = 92;
      const CX = 116;
      const CY = 116;
      let angle = -Math.PI / 2;
      const arcs = doc.slices.map((slice, i) => {
        const sweep = (slice.value / total) * Math.PI * 2;
        const a0 = angle;
        const a1 = angle + sweep;
        angle = a1;
        const large = sweep > Math.PI ? 1 : 0;
        const p0 = `${CX + R * Math.cos(a0)},${CY + R * Math.sin(a0)}`;
        const p1 = `${CX + R * Math.cos(a1)},${CY + R * Math.sin(a1)}`;
        const d = sweep >= Math.PI * 2 - 1e-6
          ? `M ${CX + R},${CY} A ${R},${R} 0 1 1 ${CX - R},${CY} A ${R},${R} 0 1 1 ${CX + R},${CY}`
          : `M ${CX},${CY} L ${p0} A ${R},${R} 0 ${large} 1 ${p1} Z`;
        return { d, pct: Math.round((slice.value / total) * 100), slice, i };
      });
      return (
        <div class="hk-mmd-pie">
          {doc.title && <div class="hk-mmd-pie__title">{doc.title}</div>}
          <div class="hk-mmd-pie__body">
            <svg width={232} height={232} viewBox="0 0 232 232" class="hk-mmd-pie__svg">
              {arcs.map((a) => (
                <path key={a.i} class={`hk-mmd-pie__slice hk-mmd-pie__slice--${a.i % 6}`} d={a.d} />
              ))}
              <circle cx={CX} cy={CY} r={R * 0.55} class="hk-mmd-pie__hole" />
            </svg>
            <div class="hk-mmd-pie__legend">
              {doc.slices.map((s, i) => (
                <div key={i} class="hk-mmd-pie__legend-row">
                  <span class={`hk-mmd-pie__dot hk-mmd-pie__slice--${i % 6}`} />
                  <span class="hk-mmd-pie__legend-label">{s.label}</span>
                  <span class="hk-mmd-pie__legend-value">{s.value} · {arcs[i].pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }
    case "quadrant": {
      const doc = data.doc;
      if (!doc || doc.kind !== "quadrant") return <div />;
      const W = 540;
      const H = 420;
      const L = 56;
      const T = 44;
      const PW = W - L - 24;
      const PH = H - T - 40;
      // Mermaid quadrant coords are 0..1 (parser + Rust reference agree);
      // clamp defends the frame against out-of-range input (the Rust
      // renderer clamps into its grid the same way).
      const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
      const px = (x: number): number => L + clamp01(x) * PW;
      const py = (y: number): number => T + (1 - clamp01(y)) * PH;
      return (
        <div class="hk-mmd-quadrant">
          {doc.title && <div class="hk-mmd-quadrant__title">{doc.title}</div>}
          <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} class="hk-mmd-quadrant__svg">
            <rect x={L} y={T} width={PW} height={PH} class="hk-mmd-quadrant__frame" />
            <line x1={L + PW / 2} y1={T} x2={L + PW / 2} y2={T + PH} class="hk-mmd-quadrant__mid" />
            <line x1={L} y1={T + PH / 2} x2={L + PW} y2={T + PH / 2} class="hk-mmd-quadrant__mid" />
            {doc.quadrants.map((q, i) =>
              q ? (
                <text
                  key={i}
                  class="hk-mmd-quadrant__q"
                  x={i % 2 === 0 ? L + PW * 0.25 : L + PW * 0.75}
                  y={i < 2 ? T + PH * 0.25 : T + PH * 0.75}
                  text-anchor="middle"
                  dominant-baseline="middle"
                >
                  {q}
                </text>
              ) : null,
            )}
            <text x={L - 10} y={T + 10} class="hk-mmd-quadrant__axis" text-anchor="end">{doc.yAxisTop}</text>
            <text x={L - 10} y={T + PH} class="hk-mmd-quadrant__axis" text-anchor="end">{doc.yAxisBottom}</text>
            <text x={L} y={T + PH + 26} class="hk-mmd-quadrant__axis" text-anchor="start">{doc.xAxisLeft}</text>
            <text x={L + PW} y={T + PH + 26} class="hk-mmd-quadrant__axis" text-anchor="end">{doc.xAxisRight}</text>
            {doc.points.map((p, i) => (
              <g key={i} class="hk-mmd-quadrant__point">
                <circle cx={px(p.x)} cy={py(p.y)} r={5} />
                <text x={px(p.x) + 9} y={py(p.y) + 4}>{p.label}</text>
              </g>
            ))}
          </svg>
        </div>
      );
    }
    default:
      return <div class="hk-mmd-node">{data.label ?? ""}</div>;
  }
}

export default defineComponent({
  name: "HkMermaidDiagram",
  props: {
    /** Raw mermaid source. */
    source: { type: String, required: true },
    /** Show the bottom-right minimap (HkBoard pass-through). */
    minimap: { type: Boolean, default: true },
    /** Allow dragging / wheel-zooming the canvas (HkBoard pass-through;
     * node taps keep working either way). */
    interactive: { type: Boolean, default: true },
    /** Engineering dot grid (off by default — a diagram is not a map). */
    grid: { type: Boolean, default: false },
    /** Explicit viewport height in px (default: content-clamped auto). */
    height: { type: [Number, String] as PropType<number | "auto">, default: "auto" },
    /** Fit-zoom ceiling (HkBoard pass-through). */
    fitCap: { type: Number, default: undefined },
  },
  setup(props) {
    const parsed = computed<{ doc: MermaidDoc | null; error: string | null }>(() => {
      const engine = getMermaidEngine();
      if (!engine) return { doc: null, error: "no-engine" };
      try {
        const doc = engine.parse(props.source);
        if (!doc) return { doc: null, error: "parse-failed" };
        return { doc, error: null };
      } catch {
        return { doc: null, error: "parse-failed" };
      }
    });

    const model = computed(() => (parsed.value.doc ? buildBoardModel(parsed.value.doc, measure) : null));

    const boardNodes = computed<BoardNodeInput[]>(() =>
      (model.value?.nodes ?? []).map((n) => ({
        id: n.id,
        x: n.x,
        y: n.y,
        w: n.w,
        h: n.h,
        hidden: n.hidden,
        kind: n.kind,
        data: n.data,
      })),
    );

    const boardEdges = computed<BoardEdgeInput[]>(() =>
      (model.value?.edges ?? []).map((e) => ({
        id: e.id,
        from: e.from,
        to: e.to,
        style: e.style,
        dashed: e.dashed,
        arrow: e.arrow,
        label: e.label ?? undefined,
        via: e.via,
      })),
    );

    const viewportStyle = computed<CSSProperties>(() => {
      const h = props.height === "auto" ? (model.value?.suggestedHeight ?? 240) : props.height;
      return { height: typeof h === "number" ? `${h}px` : h };
    });

    return () => {
      if (!model.value) {
        return fallbackBlock(props.source)();
      }
      const kind = parsed.value.doc?.kind ?? "graph";
      const headLine = props.source.split(/\r\n|\n/).find((l) => l.trim() !== "") ?? "";
      return (
        <div
          class="hk-mermaid"
          style={viewportStyle.value}
          data-mermaid-kind={kind}
          role="img"
          aria-label={`mermaid ${kind} diagram: ${headLine.trim().slice(0, 80)}`}
        >
          <HkBoard
            nodes={boardNodes.value}
            edges={boardEdges.value}
            minimap={props.minimap}
            interactive={props.interactive}
            grid={props.grid}
            fitOnMount
            fitCap={props.fitCap}
            v-slots={{
              node: (slotProps: { node: BoardNodeInput }) => <MermaidNodeBody node={slotProps.node} />,
            }}
          />
        </div>
      );
    };
  },
});
