import { afterEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";

import { fakeAs } from "../test-utils/fakes";
import {
  hologramHudText,
  makeFleetHologram,
  makeSatelliteHologram,
  poseFleetHologram,
  type FleetHologramInput,
} from "./holographicFleetBody";

const INPUT: FleetHologramInput = {
  id: "node-1",
  label: "node-1 engine stack",
  status: "Online",
  detail: "3 endpoints",
  role: "planet",
  radius: 1,
};

function mockCanvas(): ReturnType<typeof vi.fn> {
  const fillText = vi.fn();
  const gradient = fakeAs<CanvasGradient>({ addColorStop: vi.fn() });
  const context = fakeAs<CanvasRenderingContext2D>({
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    fillText,
    measureText: (text: string) => fakeAs<TextMetrics>({ width: text.length * 24 }),
    createRadialGradient: () => gradient,
  });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context);
  return fillText;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("hologramHudText", () => {
  it("contains only the real label, current status and supplied detail", () => {
    expect(hologramHudText(INPUT)).toBe("node-1 engine stack  ·  Online  ·  3 endpoints");
    expect(hologramHudText({ ...INPUT, status: "Offline", detail: "" }))
      .toBe("node-1 engine stack  ·  Offline");
    expect(hologramHudText({ ...INPUT, label: "", status: "", detail: "" }))
      .toBe("node-1");
  });
});

describe("makeFleetHologram", () => {
  it("pins the real-data ticker to the centre of the front dial", () => {
    const fillText = mockCanvas();
    const hologram = makeFleetHologram(INPUT, new THREE.Color(0x7fb8dd), false);

    expect(hologram.hudTexture).not.toBeNull();
    expect(hologram.hudPanel).not.toBeNull();
    expect(hologram.hudPanel!.geometry).toBeInstanceOf(THREE.PlaneGeometry);
    // The ticker is a child of the camera-facing dial, AT its centre: the
    // dial owns the plane, so facing the dial faces the text (user
    // direction 2026-10-31 — no wrapping ribbon).
    expect(hologram.frontDial.children).toContain(hologram.hudPanel);
    expect(hologram.hudPanel!.position.x).toBe(0);
    expect(hologram.hudPanel!.position.y).toBe(0);
    for (const call of fillText.mock.calls) {
      expect(call[0]).toBe("node-1 engine stack  ·  Online  ·  3 endpoints");
    }

    // The text plane never widens the body's pointer target.
    const hits: THREE.Intersection[] = [];
    hologram.hudPanel!.raycast(new THREE.Raycaster(), hits);
    expect(hits).toHaveLength(0);
  });

  it("gives main cores denser dial content than node cores", () => {
    mockCanvas();
    const hub = makeFleetHologram({ ...INPUT, role: "star" }, new THREE.Color(), false);
    const node = makeFleetHologram(INPUT, new THREE.Color(), false);

    const dialCounts = (hologram: ReturnType<typeof makeFleetHologram>) => ({
      rings: hologram.frontDial.getObjectsByProperty("name", "fleet-hologram-face-dial-ring").length,
      arcs: hologram.frontDial.getObjectsByProperty("name", "fleet-hologram-face-dial-arc").length,
      core: hologram.frontDial.getObjectsByProperty("name", "fleet-hologram-face-dial-core").length,
      ticks: (() => {
        const ticks = hologram.frontDial.getObjectByName("fleet-hologram-face-dial-ticks");
        if (!ticks) return 0;
        return (ticks as THREE.LineSegments).geometry.getAttribute("position").count / 2;
      })(),
      spindle: hologram.shell.getObjectsByProperty(
        "name",
        "fleet-hologram-ring-spindle-circle",
      ).length,
    });

    // User direction 2026-10-31: a main core's ball is bigger AND carries
    // more content; a node core is smaller and sparser — never identical.
    expect(dialCounts(hub)).toEqual({ rings: 3, ticks: 48, arcs: 2, core: 1, spindle: 9 });
    expect(dialCounts(node)).toEqual({ rings: 2, ticks: 28, arcs: 1, core: 1, spindle: 6 });
  });

  it("builds the ball from circles only — no solid sphere, no wireframe cage", () => {
    mockCanvas();
    for (const role of ["star", "planet"] as const) {
      const hologram = makeFleetHologram({ ...INPUT, role }, new THREE.Color(), false);

      // No SphereGeometry anywhere: the pick proxy is an invisible
      // icosahedron, everything visible is a circle, a plane or a disc.
      const spheres: THREE.Mesh[] = [];
      hologram.group.traverse((obj) => {
        if (obj instanceof THREE.Mesh && obj.geometry instanceof THREE.SphereGeometry) {
          spheres.push(obj);
        }
      });
      expect(spheres, `${role} solid spheres`).toHaveLength(0);

      // The shell is six overlapping support dials whose rims merge into
      // one rounded envelope — the fused structures must not leave a
      // readable cube behind (no shared wireframe, no box edges).
      const shellDials = hologram.shell.getObjectsByProperty("name", "fleet-hologram-face-dial");
      expect(shellDials, `${role} shell dial count`).toHaveLength(6);
      // Each support dial carries ONE outline ring only — content belongs
      // to the front dial, so the sphere cannot re-clutter.
      for (const dial of shellDials) {
        expect(dial.getObjectsByProperty("name", "fleet-hologram-face-dial-ring"))
          .toHaveLength(1);
        expect(dial.getObjectsByProperty("name", "fleet-hologram-face-dial-ticks"))
          .toHaveLength(0);
      }
      expect(
        hologram.group.getObjectsByProperty("name", "fleet-hologram-polyhedron-edges"),
        `${role} shared wireframe cage`,
      ).toHaveLength(0);

      // Exactly ONE detailed dial exists and it faces the camera group.
      const focus = hologram.frontDial.getObjectsByProperty(
        "name",
        "fleet-hologram-face-dial",
      );
      expect(focus).toHaveLength(1);

      // Only the invisible centre proxy answers raycasts: every other
      // line and plane has an instance-level raycast override.
      const pickables: THREE.Object3D[] = [];
      hologram.group.traverse((obj) => {
        if (Object.prototype.hasOwnProperty.call(obj, "raycast")) return;
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Line) pickables.push(obj);
      });
      expect(pickables, `${role} pickable objects`).toHaveLength(1);
      expect(pickables[0]).toBe(hologram.mesh);
      const material = hologram.mesh.material as THREE.MeshBasicMaterial;
      expect(material.opacity).toBe(0);
    }
  });

  it("hides the circular focus mark until the scene selects the body", () => {
    mockCanvas();
    const hologram = makeFleetHologram(INPUT, new THREE.Color(), false);
    expect(hologram.selectionRing.visible).toBe(false);
    for (const line of hologram.selectionRing.children) {
      expect(line).toBeInstanceOf(THREE.LineLoop);
      expect(line).not.toBeInstanceOf(THREE.LineSegments);
    }
  });

  it("animates each layer independently and faces the camera", () => {
    mockCanvas();
    const hologram = makeFleetHologram(INPUT, new THREE.Color(), false);

    const camera = new THREE.PerspectiveCamera();
    camera.position.set(3, -2, 5);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();

    poseFleetHologram(hologram, 5, 20, camera.quaternion);
    // The shell turns as a ball of circles…
    expect(hologram.shell.rotation.y).toBeCloseTo(Math.PI / 2, 6);
    // …the front dial and the focus ring face the camera (component-wise:
    // Quaternion instances never satisfy reference equality)…
    expect(hologram.frontDial.quaternion.angleTo(camera.quaternion)).toBeCloseTo(0, 6);
    expect(hologram.selectionRing.quaternion.angleTo(camera.quaternion)).toBeCloseTo(0, 6);
    // …the dial's ticks sweep…
    expect(hologram.frontSpinner.rotation.z).toBeCloseTo(0.55, 6);
    // …and the real-data ticker scrolls across the dial's centre.
    expect(hologram.hudTexture?.offset.x).toBeCloseTo(0.09, 6);
    poseFleetHologram(hologram, 10, 20, camera.quaternion);
    expect(hologram.hudTexture?.offset.x).toBeCloseTo(0.18, 6);
  });
});

describe("makeSatelliteHologram", () => {
  it("is a miniature crossed-dial shell with no text and no solid sphere", () => {
    const satellite = makeSatelliteHologram(0.2, new THREE.Color(0x9fb8dd), false);

    // Endpoint tier: three crossed support dials plus a three-ring
    // spindle — the gateway's language, minimal content, no ticker.
    expect(satellite.getObjectsByProperty("name", "fleet-hologram-face-dial"))
      .toHaveLength(3);
    expect(satellite.getObjectsByProperty("name", "fleet-hologram-ring-spindle-circle"))
      .toHaveLength(3);
    expect(satellite.getObjectsByProperty("name", "fleet-hologram-hud-panel"))
      .toHaveLength(0);
    let meshes = 0;
    satellite.traverse((obj) => {
      if (obj instanceof THREE.Mesh) meshes += 1;
    });
    expect(meshes).toBe(0);

    // Nothing in a satellite may answer raycasts.
    const hits = new THREE.Raycaster().intersectObject(satellite, true);
    expect(hits).toHaveLength(0);
  });
});
