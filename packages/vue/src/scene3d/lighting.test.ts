/* The lighting rig is plain three.js object management — everything here
 * runs on a real scene graph with no GL involved. */

import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";

import { LightingRig } from "./lighting";

function lightCount(scene: THREE.Scene, ctor: Function): number {
  let n = 0;
  for (const child of scene.children) if (child.constructor === ctor) n += 1;
  return n;
}

describe("LightingRig", () => {
  it("installs ambient, directional (shadow-casting) and hemisphere lights", () => {
    const scene = new THREE.Scene();
    const rig = new LightingRig(scene);
    expect(lightCount(scene, THREE.AmbientLight)).toBe(1);
    expect(lightCount(scene, THREE.DirectionalLight)).toBe(1);
    expect(lightCount(scene, THREE.HemisphereLight)).toBe(1);
    const sun = scene.children.find((c) => c.constructor === THREE.DirectionalLight) as unknown as THREE.DirectionalLight;
    expect(sun.castShadow).toBe(true);
    expect(scene.children).toContain(sun.target);
    rig.dispose();
    expect(scene.children).toHaveLength(0);
  });

  it("applies a descriptor: ambient, directional and rebuilt points", () => {
    const scene = new THREE.Scene();
    const rig = new LightingRig(scene);
    rig.apply({
      ambientColor: [0.2, 0.4, 0.6],
      ambientIntensity: 0.8,
      directionalColor: [1, 0.9, 0.8],
      directionalIntensity: 1.5,
      directionalPosition: [10, 20, 30],
      points: [
        { color: [1, 0, 0], intensity: 3, range: 12, position: [1, 2, 3] },
        { color: [0, 1, 0], intensity: 2, range: 8, position: [-1, 0, 0] },
      ],
    });
    const ambient = scene.children.find((c) => c.constructor === THREE.AmbientLight) as unknown as THREE.AmbientLight;
    const sun = scene.children.find((c) => c.constructor === THREE.DirectionalLight) as unknown as THREE.DirectionalLight;
    expect(ambient.intensity).toBeCloseTo(0.8, 6);
    expect(ambient.color.r).toBeCloseTo(0.2, 5);
    expect(sun.intensity).toBeCloseTo(1.5, 6);
    expect(sun.position.x).toBeCloseTo(10, 5);
    expect(lightCount(scene, THREE.PointLight)).toBe(2);

    // Re-applying REPLACES the points (no accumulation).
    rig.apply({ points: [{ color: [0, 0, 1], intensity: 1, range: 4, position: [0, 0, 0] }] });
    expect(lightCount(scene, THREE.PointLight)).toBe(1);
    rig.dispose();
    expect(lightCount(scene, THREE.PointLight)).toBe(0);
  });

  it("floors the ambient intensity only when a floor is configured", () => {
    const scene = new THREE.Scene();
    const floored = new LightingRig(scene, { minAmbientIntensity: 1.0 });
    floored.apply({ ambientIntensity: 0.2 });
    const ambient = scene.children.find((c) => c.constructor === THREE.AmbientLight) as unknown as THREE.AmbientLight;
    expect(ambient.intensity).toBeCloseTo(1.0, 6);
    floored.dispose();

    const honest = new LightingRig(new THREE.Scene());
    honest.apply({ ambientIntensity: 0.2 });
    const a2 = honest["scene"].children.find(
      (c) => c.constructor === THREE.AmbientLight,
    ) as unknown as THREE.AmbientLight;
    expect(a2.intensity).toBeCloseTo(0.2, 6);
    honest.dispose();
  });

  it("drives a policy sun and the night fill", () => {
    const scene = new THREE.Scene();
    const rig = new LightingRig(scene);
    rig.setSun([5, 6, 7], [1, 0.5, 0.2], 2.2);
    const sun = scene.children.find((c) => c.constructor === THREE.DirectionalLight) as unknown as THREE.DirectionalLight;
    expect(sun.position.x).toBeCloseTo(5, 5);
    expect(sun.intensity).toBeCloseTo(2.2, 5);

    const ambient = scene.children.find((c) => c.constructor === THREE.AmbientLight) as unknown as THREE.AmbientLight;
    const hemi = scene.children.find((c) => c.constructor === THREE.HemisphereLight) as unknown as THREE.HemisphereLight;
    rig.setNightFill(true);
    expect(ambient.intensity).toBeCloseTo(0.4, 5);
    expect(hemi.intensity).toBeCloseTo(0.2, 5);
    rig.setNightFill(false);
    expect(ambient.intensity).toBeCloseTo(1.2, 5);
    rig.dispose();
  });

  it("resizes the shadow frustum and recenters the sun target", () => {
    const scene = new THREE.Scene();
    const rig = new LightingRig(scene);
    rig.setShadowBounds(30, 4, -6);
    const sun = scene.children.find((c) => c.constructor === THREE.DirectionalLight) as unknown as THREE.DirectionalLight;
    expect(sun.shadow.camera.left).toBe(-30);
    expect(sun.shadow.camera.right).toBe(30);
    expect(sun.target.position.x).toBeCloseTo(4, 5);
    expect(sun.target.position.z).toBeCloseTo(-6, 5);
    // The minimum extent floor applies.
    rig.setShadowBounds(1);
    expect(sun.shadow.camera.left).toBe(-15);
    rig.dispose();
  });

  it("dispose strips every light it created", () => {
    const scene = new THREE.Scene();
    const rig = new LightingRig(scene);
    rig.apply({ points: [{ color: [1, 1, 1], intensity: 1, range: 5, position: [0, 0, 0] }] });
    const removeSpy = vi.spyOn(scene, "remove");
    rig.dispose();
    // Every rig light (ambient, sun, sun target, hemi, the point) left.
    expect(removeSpy).toHaveBeenCalledTimes(6);
    expect(scene.children).toHaveLength(0);
  });
});
