/* Ground mechanics run on the real three scene graph; the shader compiles
 * at render time (never here), so these tests pin structure, visibility,
 * fit and disposal — the parts that can silently break a scene. */

import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";

import { createGround } from "./ground";

describe("createGround", () => {
  it("disabled: adds nothing but still yields a usable handle", () => {
    const scene = new THREE.Scene();
    const handle = createGround(scene, { enabled: false });
    expect(scene.children).toHaveLength(0);
    expect(() => {
      handle.setVisible(true);
      handle.fit(new THREE.Box3());
    }).not.toThrow();
    handle.dispose();
    expect(scene.children).toHaveLength(0);
  });

  it("enabled: builds a shadow catcher and the grid, then disposes both", () => {
    const scene = new THREE.Scene();
    const handle = createGround(scene, { enabled: true, y: -2 });
    // Group + shadow plane + grid plane.
    const group = scene.children[0] as THREE.Group;
    expect(scene.children).toHaveLength(1);
    expect(group.children.length).toBe(2);
    const [shadow, grid] = group.children as [THREE.Mesh, THREE.Mesh];
    expect((shadow.material as THREE.Material).type).toBe("ShadowMaterial");
    expect((grid.material as THREE.Material).type).toBe("ShaderMaterial");
    expect(shadow.position.y).toBe(-2);
    expect(grid.position.y).toBeCloseTo(-2 + 0.01, 6);
    expect(shadow.receiveShadow).toBe(true);
    expect(grid.frustumCulled).toBe(false);

    const spies = [
      vi.spyOn(shadow.geometry, "dispose"),
      vi.spyOn(grid.geometry, "dispose"),
      vi.spyOn(shadow.material as THREE.Material, "dispose"),
      vi.spyOn(grid.material as THREE.Material, "dispose"),
    ];
    handle.dispose();
    for (const spy of spies) expect(spy).toHaveBeenCalled();
    expect(scene.children).toHaveLength(0);
  });

  it("shadowOpacity 0 skips the catcher", () => {
    const scene = new THREE.Scene();
    const handle = createGround(scene, { enabled: true, shadowOpacity: 0 });
    expect((scene.children[0] as THREE.Group).children).toHaveLength(1);
    handle.dispose();
  });

  it("setVisible toggles the whole group", () => {
    const scene = new THREE.Scene();
    const handle = createGround(scene, { enabled: true });
    handle.setVisible(false);
    expect((scene.children[0] as THREE.Group).visible).toBe(false);
    handle.setVisible(true);
    expect((scene.children[0] as THREE.Group).visible).toBe(true);
    handle.dispose();
  });

  it("fit retargets the fade and dot bounds onto the content", () => {
    const scene = new THREE.Scene();
    const handle = createGround(scene, { enabled: true });
    const grid = (scene.children[0] as THREE.Group).children[1] as THREE.Mesh;
    const uniforms = (grid.material as THREE.ShaderMaterial).uniforms as Record<
      string,
      { value: unknown }
    >;
    handle.fit(
      new THREE.Box3(new THREE.Vector3(-10, 0, -4), new THREE.Vector3(30, 5, 8)),
    );
    // Centred on the box's XZ mid, fade sized by its extent.
    const center = uniforms.uCenter.value as THREE.Vector2;
    expect(center.x).toBeCloseTo(10, 6);
    expect(center.y).toBeCloseTo(2, 6);
    // extent = max(40, 12) = 40 → fade starts at 40/2 + 10.
    expect(uniforms.uFadeStart.value).toBeCloseTo(30, 6);
    const dotMin = uniforms.uDotMin.value as THREE.Vector2;
    const dotMax = uniforms.uDotMax.value as THREE.Vector2;
    expect(dotMin.x).toBeCloseTo(-12, 6);
    expect(dotMax.x).toBeCloseTo(32, 6);
    handle.dispose();
  });
});
