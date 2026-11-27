/**
 * HkMermaidDiagram — the mermaid rendering business component, a peer of
 * the rich-text family (HkMarkdownRenderer renders prose, this renders
 * diagrams), built on the HkBoard 画板 (world camera, pan/zoom).
 *
 * Contract (user direction 2026-11-16):
 *  - the PARSER is never bundled here: hosts register an engine on
 *    `globalThis.hkMermaidParser` (the exact convention the hljs global
 *    gives syntax highlighting). No engine, or a parse failure, or an
 *    unsupported diagram type → the source falls back to a plain code
 *    block — never a broken surface.
 *  - the caller decides the chrome: `minimap` turns the zoom bar off,
 *    `interactive` gates canvas dragging/zoom (an HkBoard prop, passed
 *    straight through).
 *
 * Layout lives in ../mermaid/layout.ts (pure, deterministic); this file
 * only adapts the laid-out model into HkBoard nodes/edges and paints
 * the per-kind node content through the board's `node` slot.
 */

import { computed, defineComponent, ref, type CSSProperties, type PropType, type VNode } from "vue";

import HkBoard, { type BoardEdgeInput, type BoardNodeInput } from "./HkBoard";
import HkMinimap from "./HkMinimap";
import { buildBoardModel, createCanvasMeasureText, type LaidOutNode, type MeasureText } from "../mermaid/layout";
import { getMermaidEngine } from "../mermaid/engine";
import { mermaidReady } from "../mermaid/wasmEngine";
import type { ClassDefinition, ClassVisibility, MermaidDoc, MermaidNodeShape } from "../mermaid/types";
import { BOARD_K_MAX, BOARD_K_MIN, type BoardCamera } from "../utils/boardCamera";
import "./HkMermaidDiagram.scss";

/** Edge (and arrowhead) ink for a diagram. The board default is a subdued
 *  `primary / 38%` meant for scene wiring behind chrome; a diagram's edges
 *  ARE its content, and 62% puts them in the same legibility band as the
 *  node borders they connect (`primary / 55%` in the node sheet) — still
 *  quieter than the border so the boxes lead. */
const MERMAID_EDGE_INK = "rgb(var(--color-primary) / 62%)";

/** The slice of HkBoard's exposed surface the zoom bar drives. */
interface BoardHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  zoomToPercent: (percent: number) => void;
  reset: () => void;
}

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
            {/* Viewbox inset by 1: the rhombus tips sit ON the box edge
                and a centered stroke would clip its outer half at the
                svg viewport (R7 finding 1). */}
            <svg class="hk-mmd-node__diamond" viewBox={`-1 -1 ${w + 2} ${h + 2}`} aria-hidden="true">
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
    case "group":
      // Subgraph cluster frame: a paint-only shell behind its members. The
      // board marks passthrough nodes so the frame never eats a pan drag.
      return (
        <div class="hk-mmd-group">
          <span class="hk-mmd-group__label">{data.label}</span>
        </div>
      );
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
    /** Show the zoom bar under the diagram (`−` `NN%` `+` reset; the `%`
     *  label opens a slider). It sits in its own row BELOW the board — the
     *  board's own bottom-right dock is an overlay, and at fit zoom it
     *  covered the last node of every wide diagram (measured on
     *  docs.celestia.world 2026-11-27). */
    minimap: { type: Boolean, default: true },
    /** Allow dragging / wheel-zooming the canvas (HkBoard pass-through;
     * node taps keep working either way). */
    interactive: { type: Boolean, default: true },
    /** Engineering dot grid (off by default — a diagram is not a map). */
    grid: { type: Boolean, default: false },
    /** Height of the diagram STAGE in px (default: content-clamped auto).
     *  The zoom bar row below it adds its own height on top. */
    height: { type: [Number, String] as PropType<number | "auto">, default: "auto" },
    /** Fit-zoom ceiling (HkBoard pass-through). */
    fitCap: { type: Number, default: undefined },
  },
  setup(props) {
    // The engine loads asynchronously now, so the first parse can run before it
    // is usable and would cache `parse-failed`. Re-run once the load settles —
    // the same reactive-retry shape `HkQrCode` uses for `qrReady`.
    const engineEpoch = ref(0);
    void mermaidReady
      .then(() => {
        engineEpoch.value += 1;
      })
      .catch(() => {
        // Leave the epoch alone: `parsed` keeps reporting parse-failed, which
        // renders the source as a code block rather than a blank board.
      });

    const parsed = computed<{ doc: MermaidDoc | null; error: string | null }>(() => {
      void engineEpoch.value;
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
        passthrough: n.passthrough,
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
        anchorFrom: e.anchorFrom,
        anchorTo: e.anchorTo,
        dashed: e.dashed,
        arrow: e.arrow,
        ink: MERMAID_EDGE_INK,
        label: e.label ?? undefined,
        via: e.via,
      })),
    );

    const viewportStyle = computed<CSSProperties>(() => {
      const h = props.height === "auto" ? (model.value?.suggestedHeight ?? 240) : props.height;
      return { height: typeof h === "number" ? `${h}px` : h };
    });

    const boardRef = ref<BoardHandle | null>(null);
    /** Last camera the board reported (it emits on every change, tween
     *  frames included). */
    const cam = ref<BoardCamera>({ x: 0, y: 0, k: 1 });
    const zoomPercent = computed(() => Math.round(cam.value.k * 100));

    return () => {
      if (!model.value) {
        return fallbackBlock(props.source)();
      }
      const kind = parsed.value.doc?.kind ?? "graph";
      const headLine =
        props.source.split(/\r\n|\n/).find((l) => {
          const t = l.trim();
          return t !== "" && !t.startsWith("%%");
        }) ?? "";
      return (
        <div
          class="hk-mermaid"
          data-mermaid-kind={kind}
          role="img"
          aria-label={`mermaid ${kind} diagram: ${headLine.trim().slice(0, 80)}`}
        >
          <div class="hk-mermaid__stage" style={viewportStyle.value}>
            <HkBoard
              ref={boardRef}
              nodes={boardNodes.value}
              edges={boardEdges.value}
              minimap={false}
              pan="float"
              interactive={props.interactive}
              grid={props.grid}
              fitOnMount
              fitCap={props.fitCap}
              onViewportChange={(c: BoardCamera) => {
                cam.value = c;
              }}
              v-slots={{
                node: (slotProps: { node: BoardNodeInput }) => <MermaidNodeBody node={slotProps.node} />,
              }}
            />
          </div>
          {props.minimap && (
            <div class="hk-mermaid__toolbar">
              <HkMinimap
                toolbarOnly
                boxes={[]}
                zoom={cam.value.k}
                panX={cam.value.x}
                panY={cam.value.y}
                viewportWidth={0}
                viewportHeight={0}
                contentBounds={{ x: 0, y: 0, w: 0, h: 0 }}
                zoomPercent={zoomPercent.value}
                // The board quantizes onto its own ladder, whose ceiling is
                // the board's `maxK` (default BOARD_K_MAX) — mirror the same
                // bounds here so the buttons disable exactly when the camera
                // has nothing left to reach.
                canZoomIn={cam.value.k < BOARD_K_MAX - 1e-9}
                canZoomOut={cam.value.k > BOARD_K_MIN + 1e-9}
                zoomStepPercent={5}
                minZoomPercent={Math.round(BOARD_K_MIN * 100)}
                maxZoomPercent={Math.round(BOARD_K_MAX * 100)}
                showReset
                // The ± buttons are one-rung steps from wherever the camera
                // is (the board's own ladder logic); the slider is an
                // absolute target.
                onZoomTo={(percent: number, source?: "slider" | "step") => {
                  if (source === "slider") boardRef.value?.zoomToPercent(percent);
                  else if (percent > zoomPercent.value) boardRef.value?.zoomIn();
                  else boardRef.value?.zoomOut();
                }}
                onReset={() => boardRef.value?.reset()}
              />
            </div>
          )}
        </div>
      );
    };
  },
});
