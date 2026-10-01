/**
 * lighting — the standard three-point rig for a board scene: ambient,
 * a shadow-casting directional "sun", a hemisphere fill, and a dynamic
 * set of point lights from a descriptor.
 *
 * Ported from shittim-chest's private pipeline. Two chest-era hacks are
 * generalised into explicit options here: the ambient floor (scenes used
 * to arrive with unusably dark ambient values — a floor of 1.0 was
 * silently applied; now the consumer states it) and the sun-by-wallclock
 * (the rig exposes a sun handle; WHERE the sun sits is policy).
 */

import * as THREE from "three";

export interface Board3DLightPoint {
  /** Linear RGB 0..1. */
  color: [number, number, number];
  intensity: number;
  range: number;
  position: [number, number, number];
}

export interface Board3DLightingDescriptor {
  ambientColor?: [number, number, number];
  ambientIntensity?: number;
  directionalColor?: [number, number, number];
  directionalIntensity?: number;
  directionalPosition?: [number, number, number];
  points?: Board3DLightPoint[];
}

export interface LightingRigOptions {
  /** Floor applied to descriptor ambient intensities. Scenes authored
   *  with very dark ambient render as black plastic without one; pass 0
   *  to honour the descriptor exactly. */
  minAmbientIntensity?: number;
  /** Shadow map resolution for the directional light. */
  shadowMapSize?: number;
}

export class LightingRig {
  private readonly ambient: THREE.AmbientLight;
  private readonly sun: THREE.DirectionalLight;
  private readonly hemi: THREE.HemisphereLight;
  private points: THREE.PointLight[] = [];
  private readonly minAmbient: number;

  constructor(
    private readonly scene: THREE.Scene,
    opts: LightingRigOptions = {},
  ) {
    this.minAmbient = opts.minAmbientIntensity ?? 0;
    const shadowMapSize = opts.shadowMapSize ?? 4096;

    this.ambient = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(this.ambient);

    this.sun = new THREE.DirectionalLight(0xfff5e6, 2.0);
    this.sun.position.set(20, 40, 20);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(shadowMapSize, shadowMapSize);
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 300;
    this.sun.shadow.camera.left = -40;
    this.sun.shadow.camera.right = 40;
    this.sun.shadow.camera.top = 40;
    this.sun.shadow.camera.bottom = -40;
    this.sun.shadow.bias = -0.0003;
    this.sun.shadow.normalBias = 0.04;
    this.sun.shadow.radius = 4;
    scene.add(this.sun);
    scene.add(this.sun.target);

    this.hemi = new THREE.HemisphereLight(0xb0c4de, 0x3a3a4a, 0.5);
    scene.add(this.hemi);
  }

  /** Apply a scene's lighting descriptor (points are rebuilt). */
  apply(desc: Board3DLightingDescriptor): void {
    if (desc.ambientColor) this.ambient.color.setRGB(...desc.ambientColor);
    if (desc.ambientIntensity != null) {
      this.ambient.intensity = Math.max(desc.ambientIntensity, this.minAmbient);
    }
    if (desc.directionalColor) this.sun.color.setRGB(...desc.directionalColor);
    if (desc.directionalIntensity != null) this.sun.intensity = desc.directionalIntensity;
    if (desc.directionalPosition) this.sun.position.set(...desc.directionalPosition);

    for (const pl of this.points) this.scene.remove(pl);
    this.points = [];
    for (const p of desc.points ?? []) {
      const r = Math.round(Math.min(Math.max(p.color[0], 0), 1) * 255);
      const g = Math.round(Math.min(Math.max(p.color[1], 0), 1) * 255);
      const b = Math.round(Math.min(Math.max(p.color[2], 0), 1) * 255);
      const pl = new THREE.PointLight((r << 16) | (g << 8) | b, p.intensity, p.range);
      pl.position.set(...p.position);
      this.scene.add(pl);
      this.points.push(pl);
    }
  }

  setAmbientIntensity(v: number): void {
    this.ambient.intensity = v;
  }

  /** Policy-driven sun (e.g. a wall-clock day/night arc). */
  setSun(pos: [number, number, number], color: [number, number, number], intensity: number): void {
    this.sun.position.set(...pos);
    this.sun.color.setRGB(...color);
    this.sun.intensity = intensity;
    this.sun.target.updateMatrixWorld();
  }

  /** Night-mode fill used together with a dimmed sun. */
  setNightFill(night: boolean): void {
    this.ambient.intensity = night ? 0.4 : 1.2;
    this.hemi.intensity = night ? 0.2 : 0.5;
  }

  /** Resize the shadow frustum onto the scene extent and recenter. */
  setShadowBounds(extent: number, targetX = 0, targetZ = 0): void {
    const e = Math.max(extent, 15);
    this.sun.shadow.camera.left = -e;
    this.sun.shadow.camera.right = e;
    this.sun.shadow.camera.top = e;
    this.sun.shadow.camera.bottom = -e;
    this.sun.shadow.camera.updateProjectionMatrix();
    this.sun.target.position.set(targetX, 0, targetZ);
    this.sun.target.updateMatrixWorld();
  }

  dispose(): void {
    for (const pl of this.points) this.scene.remove(pl);
    this.points = [];
    this.scene.remove(this.ambient, this.sun, this.sun.target, this.hemi);
  }
}
