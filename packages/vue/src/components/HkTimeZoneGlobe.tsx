// AI-generated: developed with the ZCode agent (model GLM-5.3); human-directed.
/**
 * HkTimeZoneGlobe — the manual solar zone picker as a GLOBE (2026-10-31
 * product direction): the 400-entry IANA dropdown became a spinning
 * sphere cut into 24 equal time-sector wedges.
 *
 * Built ON hikari's shared 3D renderer surface (HkBoard3D), so the
 * picker inherits the board's whole contract for free:
 *
 *  - BASE MAP: the borderless world-plates SVG (theme/solarGlobeMap.ts —
 *    continent silhouettes + tectonic plate lines, never national
 *    borders) rasterized once into a canvas texture; the SVG is
 *    white-alpha, the material tints it with the live theme accent, so
 *    one asset serves dark and light themes;
 *  - SECTORS: 24 pickable wedges of 15 deg longitude (theme/
 *    solarTimeZones.ts) — drag spins the globe, settling snaps the wedge
 *    under the eye INTO the selection, clicking a wedge flies the
 *    camera to it; both write the wedge's REPRESENTATIVE IANA zone
 *    through update:modelValue (the engine stores exact ids, so a
 *    half-hour config survives until the user actually re-picks);
 *  - TURNTABLE: the board's orbit elevation window is pinned
 *    (minPolarAngle === maxPolarAngle) to the eye's ring tilt, so the
 *    sphere can only spin about its vertical axis. It never tips toward
 *    a pole and never rolls — the north hemisphere keeps its 18° tilt
 *    (user direction 2026-11-01: "the globe turns in front of you");
 *  - READOUT: the SELECTED sector stays pinned to the TOP-CENTER of the
 *    stage — always on, and hover never rewrites it (a drag re-selects
 *    without moving the pointer, so a hover preview would be stale at
 *    exactly the moment it is read). It replaced the pointer-following
 *    tooltip, which on a touch screen landed under the very finger doing
 *    the drag (user direction 2026-11-01). The head carries the IANA id
 *    with the translated band name (dropped where the locale's band name
 *    IS the offset label — English), the second line its representative
 *    cities: cities only, never countries (border disputes stay out of a
 *    theme picker);
 *  - MINIMAP: the board pins HkMinimap3D bottom-right — a second,
 *    stereoscopic render of the SAME scene, so the operator always sees
 *    where on the sphere the eye currently sits;
 *  - FALLBACK: no WebGL (old webviews, test DOM) — the board renders
 *    this component's fallback slot content: the same 24 sectors as a
 *    flat, translated, keyboard-reachable list. The picker never
 *    degrades to untranslated raw zone ids.
 *
 * Texture/wedge alignment math lives in one place (theme/
 * solarTimeZones.ts): an equirectangular texture puts longitude L at
 * sphere phi = L + 180 deg, which renders at azimuth atan2(x,z) =
 * L + 90 deg. Wedges, the camera ring and the facing readout all go
 * through textureLngToAzimuthDeg / wedgePhiStartDeg, and the alignment
 * is pinned against the installed three by solarGlobeAlignment.test.ts
 * measuring real geometry vertices.
 */

import {
  computed,
  defineComponent,
  onBeforeUnmount,
  ref,
  shallowRef,
  watch,
} from "vue";

import * as THREE from "three";

import { useI18n } from "../i18n/context";
import {
  SECTOR_SPAN_DEG,
  SOLAR_TIME_ZONE_SECTORS,
  azimuthToTextureLngDeg,
  isRotationalSettle,
  offsetLabel,
  sectorCenterLngDeg,
  sectorIndexForLngDeg,
  sectorIndexForZone,
  textureLngToAzimuthDeg,
  wedgePhiStartDeg,
} from "../theme/solarTimeZones";
import { solarGlobeMapDataUrl } from "../theme/solarGlobeMap";
import HkBoard3D, { type Board3DEngine } from "./HkBoard3D";
import "./HkTimeZoneGlobe.scss";

const DEG = Math.PI / 180;
/** Eye distance and latitude tilt for the fixed-radius ring orbit. */
const EYE_DISTANCE = 2.85;
const EYE_TILT_DEG = 18;
/** The locked orbit elevation (OrbitControls polar angle, degrees from
 *  +Y) that pairs with EYE_TILT_DEG: equal min/max polar bounds keep the
 *  eye on this one ring, so azimuth is the only orbit axis left — the
 *  globe turns in place instead of tipping. */
const ORBIT_POLAR_DEG = 90 - EYE_TILT_DEG;
/** Sphere and wedge radii — the wedges ride slightly above the base to
 *  keep the highlight out of the texture's z-fight band. */
const GLOBE_RADIUS = 1;
const WEDGE_RADIUS = 1.004;
const WEDGE_HOVER_OPACITY = 0.16;
const WEDGE_SELECTED_OPACITY = 0.34;

/** Camera position on the tilt ring facing longitude [lngDeg]. */
function ringPosition(lngDeg: number, dist = EYE_DISTANCE): [number, number, number] {
  const a = textureLngToAzimuthDeg(lngDeg) * DEG;
  const t = EYE_TILT_DEG * DEG;
  return [dist * Math.cos(t) * Math.sin(a), dist * Math.sin(t), dist * Math.cos(t) * Math.cos(a)];
}

/** Longitude the eye currently faces (the picker's under-the-eye
 *  meridian). Degenerate exactly at the poles — the orbit's tilt keeps
 *  the eye off them and the snap simply keeps the band. */
function facingLngDeg(camera: THREE.Camera): number {
  return azimuthToTextureLngDeg(Math.atan2(camera.position.x, camera.position.z) / DEG);
}

/** three sphere phi start for a sector's west edge (texture phi = lng + 180 deg). */
function wedgePhiStart(offset: number): number {
  return wedgePhiStartDeg(sectorCenterLngDeg(offset)) * DEG;
}

/** Locale key of a sector's translated band name (m11..m1, z0, p1..p12). */
export function sectorNameKey(offset: number): string {
  const k = offset === 0 ? "z0" : offset < 0 ? "m" + String(-offset) : "p" + String(offset);
  return "hikari::theme.solar.sector." + k;
}

/** Locale key of a representative city slug. */
export function cityKey(slug: string): string {
  return "hikari::theme.solar.city." + slug;
}

export default defineComponent({
  name: "HkTimeZoneGlobe",
  props: {
    /** Selected IANA zone id (the manual config's draft value). */
    modelValue: { type: String, required: true },
  },
  emits: {
    update: (_zoneId: string) => true,
    "update:modelValue": (_zoneId: string) => true,
  },
  setup(props, { emit }) {
    const { t } = useI18n();
    const engine = shallowRef<Board3DEngine | null>(null);
    const hoveredSector = ref<number | null>(null);
    // The stage readout is a HUD for the CANVAS; without WebGL the board's
    // fallback list is the whole interface (every sector already shows its
    // zone there), so the HUD steps aside instead of covering its first
    // rows.
    const webglFailed = ref(false);

    // Per-mount three handles the board does NOT own (we created them,
    // we dispose them — the board never disposes consumer objects).
    const owned: Array<{ dispose(): void }> = [];
    let baseMaterial: THREE.MeshBasicMaterial | null = null;
    let texture: THREE.CanvasTexture | null = null;
    let wedgeMaterials: THREE.MeshBasicMaterial[] = [];
    let onThemeDisposer: (() => void) | null = null;
    let onControlsStart: (() => void) | null = null;
    let onControlsEnd: (() => void) | null = null;
    let gestureStartAzDeg: number | null = null;
    let flyGuardTimer = 0;

    const selectedSector = computed(() => sectorIndexForZone(props.modelValue));

    // The pinned readout reports the COMMITTED selection, never the
    // hovered wedge. Hover already answers "what am I pointing at" on the
    // globe itself (the wedge highlight); the always-on chip must keep
    // answering "what is selected", because a drag that re-selects does
    // not move the pointer — a hover preview there would go stale at
    // exactly the moment the user is looking at it.
    const selectedInfo = computed(() => SOLAR_TIME_ZONE_SECTORS[selectedSector.value] ?? null);

    function citiesLine(sector: { cities: readonly string[] }): string {
      const sep = t("hikari::theme.solar.citySeparator", ", ");
      return sector.cities.map((slug) => t(cityKey(slug))).join(sep);
    }

    function applyHighlights(): void {
      const sel = selectedSector.value;
      const hov = hoveredSector.value;
      wedgeMaterials.forEach((mat, i) => {
        mat.opacity = i === hov ? WEDGE_HOVER_OPACITY : i === sel ? WEDGE_SELECTED_OPACITY : 0;
      });
    }

    watch(selectedSector, applyHighlights);
    watch(hoveredSector, applyHighlights);

    function emitZone(index: number): void {
      const sector = SOLAR_TIME_ZONE_SECTORS[index];
      if (!sector || sector.zone === props.modelValue) return;
      emit("update:modelValue", sector.zone);
      emit("update", sector.zone);
    }

    function buildScene(eng: Board3DEngine): void {
      // Base sphere — the board-tinted borderless world map.
      const geometry = new THREE.SphereGeometry(GLOBE_RADIUS, 96, 64);
      // transparent is the WHOLE LOOK: the base map is white-alpha (the
      // ocean carries alpha 0), so without the flag three ignores the
      // texture alpha and renders the sphere as an opaque dark ball.
      // With it the globe reads as a holo: continents and plate lines
      // floating over the theme surface, nothing solid behind them.
      baseMaterial = new THREE.MeshBasicMaterial({ color: 0x8899aa, transparent: true });
      const sphere = new THREE.Mesh(geometry, baseMaterial);
      eng.setObject("globe-base", {
        object: sphere, pickable: false, content: true, marker: "none",
      });
      owned.push(geometry, baseMaterial);

      // Rasterize the embedded SVG once (data URL, then canvas, then
      // texture). The SVG is white-alpha; onTheme below tints the
      // material with the live accent, so dark and light themes share
      // one texture.
      const img = new Image();
      img.decoding = "async";
      img.onload = () => {
        if (!baseMaterial) return;
        const canvas = document.createElement("canvas");
        canvas.width = 2048;
        canvas.height = 1024;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = Math.min(8, eng.renderer.capabilities.getMaxAnisotropy());
        baseMaterial.map = texture;
        baseMaterial.needsUpdate = true;
      };
      img.src = solarGlobeMapDataUrl();

      // The 24 sector wedges: transparent highlight shells, pickable.
      wedgeMaterials = SOLAR_TIME_ZONE_SECTORS.map((sector, i) => {
        const wedgeGeometry = new THREE.SphereGeometry(
          WEDGE_RADIUS,
          12,
          28,
          wedgePhiStart(sector.offset),
          SECTOR_SPAN_DEG * DEG,
        );
        const material = new THREE.MeshBasicMaterial({
          color: 0x8899aa,
          transparent: true,
          opacity: 0,
          depthWrite: false,
        });
        const wedge = new THREE.Mesh(wedgeGeometry, material);
        wedge.renderOrder = 2;
        eng.setObject("sector-" + String(i), {
          object: wedge, pickable: true, content: false, marker: "none",
        });
        owned.push(wedgeGeometry, material);
        return material;
      });

      // Theme re-tone: the board fires once immediately, then on every
      // data-theme/style mutation.
      onThemeDisposer = eng.onTheme((_bg, primary) => {
        baseMaterial?.color.set(primary);
        for (const mat of wedgeMaterials) mat.color.set(primary);
      });

      // Drag settle: snap-select the wedge now facing the eye — but
      // ONLY for gestures that actually rotated the globe. OrbitControls
      // fires "end" on every pointer-up (even a zero-movement click) and
      // every wheel zoom, and neither may rewrite the draft: a stored
      // half-hour id (Asia/Kolkata…) survives until a real re-pick. A
      // wedge click's camera flight re-enters through here too — the
      // guard keeps the flight from re-writing the same selection.
      onControlsStart = () => {
        gestureStartAzDeg = Math.atan2(eng.camera.position.x, eng.camera.position.z) / DEG;
      };
      onControlsEnd = () => {
        const endAz = Math.atan2(eng.camera.position.x, eng.camera.position.z) / DEG;
        const rotated = gestureStartAzDeg !== null
          && isRotationalSettle(gestureStartAzDeg, endAz);
        gestureStartAzDeg = null;
        if (flyGuardTimer || !rotated) return;
        emitZone(sectorIndexForLngDeg(azimuthToTextureLngDeg(endAz)));
      };
      eng.controls.addEventListener("start", onControlsStart);
      eng.controls.addEventListener("end", onControlsEnd);

      applyHighlights();
    }

    function onReady(eng: Board3DEngine): void {
      engine.value = eng;
      buildScene(eng);
    }

    function onObjectClick(id: string): void {
      const m = /^sector-(\d+)$/.exec(id);
      if (!m || !engine.value) return;
      const idx = parseInt(m[1] ?? "", 10);
      const sector = SOLAR_TIME_ZONE_SECTORS[idx];
      if (!sector) return;
      emitZone(idx);
      // Fly the eye to the wedge (a user grab cancels the flight; the
      // short guard keeps the flight's controls-end from re-emitting).
      engine.value.flyTo(ringPosition(sectorCenterLngDeg(sector.offset)), [0, 0, 0], 450);
      flyGuardTimer = window.setTimeout(() => { flyGuardTimer = 0; }, 470);
    }

    function onObjectHover(id: string | null): void {
      const m = id ? /^sector-(\d+)$/.exec(id) : null;
      hoveredSector.value = m ? parseInt(m[1] ?? "", 10) : null;
    }

    function onBoardError(): void {
      webglFailed.value = true;
    }

    onBeforeUnmount(() => {
      if (flyGuardTimer) window.clearTimeout(flyGuardTimer);
      if (engine.value) {
        if (onControlsEnd) engine.value.controls.removeEventListener("end", onControlsEnd);
        if (onControlsStart) engine.value.controls.removeEventListener("start", onControlsStart);
      }
      onThemeDisposer?.();
      onThemeDisposer = null;
      texture?.dispose();
      texture = null;
      for (const o of owned.splice(0)) o.dispose();
      wedgeMaterials = [];
      baseMaterial = null;
      engine.value = null;
    });

    // The fallback list (no WebGL / test DOM): the same 24 sectors as a
    // flat, translated list — keyboard reachable, emit-wise identical.
    const fallbackList = () => (
      <div
        class="hk-timezone-globe__list"
        role="listbox"
        aria-label={t("hikari::theme.solar.globeListLabel")}
        data-test="hk-timezone-globe-list"
      >
        {SOLAR_TIME_ZONE_SECTORS.map((sector, i) => (
          <button
            type="button"
            role="option"
            class={{
              "hk-timezone-globe__option": true,
              "hk-timezone-globe__option--selected": i === selectedSector.value,
            }}
            aria-selected={i === selectedSector.value}
            data-zone={sector.zone}
            data-test="hk-timezone-globe-option"
            onClick={() => emitZone(i)}
          >
            <span class="hk-timezone-globe__option-offset">{offsetLabel(sector.offset)}</span>
            <span class="hk-timezone-globe__option-name">{t(sectorNameKey(sector.offset))}</span>
            <span class="hk-timezone-globe__option-zone">{sector.zone}</span>
            <span class="hk-timezone-globe__option-cities">{citiesLine(sector)}</span>
          </button>
        ))}
      </div>
    );

    return () => {
      const info = selectedInfo.value;
      // In `en`, a band's translated name IS its offset label ("UTC+8"), so
      // rendering both would read "UTC+8 UTC+8". Keep the name only where
      // the locale actually names the band differently.
      const infoOffset = info ? offsetLabel(info.offset) : "";
      const infoName = info ? t(sectorNameKey(info.offset)) : "";
      const initialEye = ringPosition(sectorCenterLngDeg(
        SOLAR_TIME_ZONE_SECTORS[selectedSector.value]?.offset ?? 0,
      ));
      return (
        <div
          class="hk-timezone-globe"
          role="group"
          aria-label={t("hikari::theme.solar.globeLabel")}
          data-test="hk-timezone-globe"
        >
          <div class="hk-timezone-globe__stage">
            {info && !webglFailed.value && (
              <div
                class="hk-timezone-globe__readout"
                data-test="hk-timezone-globe-readout"
                role="status"
                aria-live="polite"
                aria-atomic="true"
              >
                <span class="hk-timezone-globe__readout-head">
                  <span class="hk-timezone-globe__readout-offset">{infoOffset}</span>
                  {infoName !== infoOffset && (
                    <span class="hk-timezone-globe__readout-name">{infoName}</span>
                  )}
                  <span class="hk-timezone-globe__readout-zone">{info.zone}</span>
                </span>
                <span class="hk-timezone-globe__readout-cities">{citiesLine(info)}</span>
              </div>
            )}
            <HkBoard3D
              interactive
              minimap
              minimapCollapsible
              minimapDefaultCollapsed
              hoverBox={false}
              transparentBackground
              enablePan={false}
              // Turntable: equal polar bounds pin the eye to its ring, so
              // the globe spins about its vertical axis only.
              minPolarAngle={ORBIT_POLAR_DEG}
              maxPolarAngle={ORBIT_POLAR_DEG}
              fov={38}
              minDistance={2.15}
              maxDistance={3.6}
              initialPosition={initialEye}
              initialTarget={[0, 0, 0]}
              onReady={onReady}
              onObjectClick={onObjectClick}
              onObjectHover={onObjectHover}
              onError={onBoardError}
            >
              {{ fallback: fallbackList }}
            </HkBoard3D>
          </div>
          <p class="hk-timezone-globe__hint">{t("hikari::theme.solar.globeHint")}</p>
        </div>
      );
    };
  },
});
