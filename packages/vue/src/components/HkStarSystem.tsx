/**
 * HkStarSystem — a reusable star / planet / satellite business scene.
 *
 * The host owns real node data and selection; this component owns the
 * deterministic layout, holographic bodies, data-bound HUD bands, camera
 * follow, labels, minimap markers and every GPU resource it creates. RPC,
 * permissions and node actions deliberately stay in the host product.
 */

import {
  defineComponent,
  onBeforeUnmount,
  shallowRef,
  watch,
  type PropType,
} from "vue";

import HkBoard3D, { type Board3DEngine } from "./HkBoard3D";
import {
  buildFleetScene,
  type FleetSceneHandle,
} from "../scene3d/holographicFleetScene";
import {
  buildHolographicFleetSpec,
  type FleetBodySpec,
  type StarSystemBodyInput,
} from "../scene3d/holographicFleetSpec";
import "./HkStarSystem.scss";

export default defineComponent({
  name: "HkStarSystem",
  props: {
    bodies: {
      type: Array as PropType<readonly StarSystemBodyInput[]>,
      required: true,
    },
    /** Controlled selection. Remounts restore the cursor without an
     *  unsolicited camera flight; an explicit change focuses the body. */
    selectedId: { type: String as PropType<string | null>, default: null },
    /** CSS2D needs real elements. Host products may localize and enrich
     *  these chips while the HUD band still uses the body's real fields. */
    makeLabel: {
      type: Function as PropType<(body: FleetBodySpec) => HTMLElement>,
      default: undefined,
    },
    makeCoreLabel: {
      type: Function as PropType<() => HTMLElement>,
      default: undefined,
    },
  },
  emits: {
    "update:selectedId": (_id: string | null) => true,
  },
  setup(props, { emit, expose, slots }) {
    const engineRef = shallowRef<Board3DEngine | null>(null);
    let sceneHandle: FleetSceneHandle | null = null;
    let handleEngine: Board3DEngine | null = null;
    let currentSelection: string | null = null;

    function dropScene(): void {
      sceneHandle?.dispose();
      sceneHandle = null;
      handleEngine = null;
    }

    function defaultLabel(body: FleetBodySpec): HTMLElement {
      const chip = document.createElement("div");
      chip.className = "hk-star-system-chip";
      chip.textContent = [body.label, body.status, body.detail]
        .filter((part) => part.trim().length > 0)
        .join(" · ");
      chip.addEventListener("click", (event) => {
        event.stopPropagation();
        selectBody(body.id);
      });
      return chip;
    }

    function defaultCoreLabel(): HTMLElement {
      const chip = document.createElement("div");
      chip.className = "hk-star-system-chip is-core";
      chip.textContent = "Core";
      return chip;
    }

    function selectBody(id: string | null): void {
      const changed = currentSelection !== id;
      currentSelection = id;
      sceneHandle?.setSelected(id);
      // An explicit click on the ALREADY selected body still re-centres it,
      // matching the original fleet scene; only deselect is idempotent.
      if (id) sceneHandle?.focusBody(id);
      else if (changed) sceneHandle?.frameFleet(600);
      emit("update:selectedId", id);
    }

    watch(() => props.selectedId, (id) => {
      if (id === currentSelection) return;
      currentSelection = id;
      sceneHandle?.setSelected(id);
      if (id) sceneHandle?.focusBody(id);
      else sceneHandle?.frameFleet(600);
    });

    watch(
      [engineRef, () => props.bodies],
      ([engine]) => {
        if (!engine) return;
        if (!sceneHandle || handleEngine !== engine) {
          dropScene();
          sceneHandle = buildFleetScene(engine, {
            makeLabel: (body) => props.makeLabel?.(body) ?? defaultLabel(body),
            registryCoreLabel: () => props.makeCoreLabel?.() ?? defaultCoreLabel(),
          });
          handleEngine = engine;
          // A fresh board restores only the cursor. Focusing here would
          // hijack a scene → list → scene round trip with a new flight.
          currentSelection = props.selectedId;
        }

        const spec = buildHolographicFleetSpec(props.bodies);
        sceneHandle.update(
          spec,
          Object.fromEntries(props.bodies.map((body) => [body.id, !body.online])),
        );

        const selected = props.selectedId;
        const stillExists = selected !== null && props.bodies.some((body) => body.id === selected);
        if (selected && !stillExists) {
          // update() has already re-anchored/stopped the old follow.
          currentSelection = null;
          sceneHandle.setSelected(null);
          emit("update:selectedId", null);
        } else {
          currentSelection = selected;
          sceneHandle.setSelected(selected);
        }
      },
      { immediate: true, deep: true },
    );

    onBeforeUnmount(dropScene);

    expose({
      focusBody(id: string) {
        selectBody(id);
      },
      frameFleet(durationMs?: number): boolean {
        return sceneHandle?.frameFleet(durationMs) ?? false;
      },
    });

    return () => (
      <HkBoard3D
        fov={45}
        minDistance={3}
        maxDistance={420}
        transparentBackground
        initialPosition={[22, -19, 34]}
        onReady={(engine: Board3DEngine) => {
          engineRef.value = engine;
        }}
        onObjectClick={selectBody}
      >
        {{
          default: () => slots.default?.(),
          ...(slots.fallback ? { fallback: () => slots.fallback?.() } : {}),
        }}
      </HkBoard3D>
    );
  },
});
