import { afterEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";

import { fakeAs } from "../test-utils/fakes";
import {
  extractHologramFaces,
  faceInradius,
  hologramHudText,
  makeFleetHologram,
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
  it("draws the real data on the cylindrical band and animates each layer", () => {
    const fillText = mockCanvas();
    const hologram = makeFleetHologram(INPUT, new THREE.Color(0x7fb8dd), false);

    expect(hologram.hudTexture).not.toBeNull();
    const band = hologram.group.getObjectByName("fleet-hologram-hud-band");
    expect(band).toBeInstanceOf(THREE.Mesh);
    expect((band as THREE.Mesh).geometry).toBeInstanceOf(THREE.CylinderGeometry);
    expect(fillText).toHaveBeenCalled();
    for (const call of fillText.mock.calls) {
      expect(call[0]).toBe("node-1 engine stack  ·  Online  ·  3 endpoints");
    }

    // Decorative rings and the text band never widen the body's pointer
    // target. Only the central polyhedron keeps the default raycaster.
    const hits: THREE.Intersection[] = [];
    band?.raycast(new THREE.Raycaster(), hits);
    expect(hits).toHaveLength(0);

    const initialRingY = hologram.rings.map((ring) => ring.pivot.rotation.y);
    poseFleetHologram(hologram, 5, 20);
    expect(hologram.mesh.rotation.y).toBeCloseTo(Math.PI / 2, 6);
    hologram.rings.forEach((ring, index) => {
      expect(ring.pivot.rotation.y).not.toBe(initialRingY[index]);
    });
    expect(hologram.hudTexture?.offset.x).toBeCloseTo(0.09, 6);
    poseFleetHologram(hologram, 10, 20);
    expect(hologram.hudTexture?.offset.x).toBeCloseTo(0.18, 6);
  });

  it("uses three rings for a hub and two for a standard node", () => {
    mockCanvas();
    const hub = makeFleetHologram({ ...INPUT, role: "star" }, new THREE.Color(), false);
    const planet = makeFleetHologram(INPUT, new THREE.Color(), false);
    expect(hub.rings).toHaveLength(3);
    expect(planet.rings).toHaveLength(2);
    expect(hub.mesh.geometry).toBeInstanceOf(THREE.IcosahedronGeometry);
    expect(planet.mesh.geometry).toBeInstanceOf(THREE.DodecahedronGeometry);
  });

  it("gives every face its own detached inset ring, with no shared vertices", () => {
    mockCanvas();
    for (const [role, expectedFaces] of [["star", 20], ["planet", 12]] as const) {
      const hologram = makeFleetHologram(
        { ...INPUT, role },
        new THREE.Color(),
        false,
      );
      const rings = hologram.mesh.getObjectsByProperty(
        "name",
        "fleet-hologram-face-ring",
      );
      expect(rings, `${role} face rings`).toHaveLength(expectedFaces);
      expect(
        hologram.mesh.getObjectsByProperty("name", "fleet-hologram-polyhedron-edges"),
        `${role} shared wireframe`,
      ).toHaveLength(0);

      const vertexKeys = new Set<string>();
      let vertices = 0;
      for (const ring of rings) {
        expect(ring).toBeInstanceOf(THREE.LineLoop);
        const positions = (ring as THREE.LineLoop).geometry.getAttribute("position");
        expect(positions.count).toBe(32);
        for (let i = 0; i < positions.count; i += 1) {
          vertexKeys.add(
            `${positions.getX(i).toFixed(5)}:${positions.getY(i).toFixed(5)}:${positions.getZ(i).toFixed(5)}`,
          );
          vertices += 1;
        }
      }
      // Every ring has its own circumference; no ring shares an edge or
      // vertex with a neighbour, so the old connected cage cannot reappear.
      expect(vertexKeys.size).toBe(vertices);

      // Each ring must stay well INSIDE its own face: map it back to the
      // recovered face polygon, then pin both the 62% radius ratio and the
      // remaining margin. This makes an overflow regression impossible to
      // hide behind the count/name assertions above.
      const faces = extractHologramFaces(hologram.mesh.geometry);
      expect(faces).toHaveLength(expectedFaces);
      const usedFaces = new Set<number>();
      for (const ring of rings) {
        expect(ring.raycast).not.toBe(THREE.LineLoop.prototype.raycast);
        const positions = (ring as THREE.LineLoop).geometry.getAttribute("position");
        const ringCenter = new THREE.Vector3();
        const points: THREE.Vector3[] = [];
        for (let i = 0; i < positions.count; i += 1) {
          const point = new THREE.Vector3(
            positions.getX(i),
            positions.getY(i),
            positions.getZ(i),
          );
          points.push(point);
          ringCenter.add(point);
        }
        ringCenter.multiplyScalar(1 / positions.count);
        const faceIndex = faces.findIndex((face, index) =>
          !usedFaces.has(index) && ringCenter.distanceTo(face.center) < 0.03);
        expect(faceIndex, `${role} ring maps to one face`).toBeGreaterThanOrEqual(0);
        usedFaces.add(faceIndex);
        const face = faces[faceIndex]!;
        const inradius = faceInradius(face);
        const ringRadius = Math.max(...points.map((point) => point.distanceTo(ringCenter)));
        expect(ringRadius / inradius).toBeCloseTo(0.62, 5);
        for (const point of points) {
          expect(point.distanceTo(face.center)).toBeLessThan(inradius);
        }
      }
      expect(usedFaces.size).toBe(expectedFaces);
    }
  });
});
