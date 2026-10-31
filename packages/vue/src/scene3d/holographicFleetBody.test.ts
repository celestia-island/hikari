import { afterEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";

import { fakeAs } from "../test-utils/fakes";
import {
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
});
