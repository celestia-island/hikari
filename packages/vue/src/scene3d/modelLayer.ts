/**
 * modelLayer — GLB models on top of the HkBoard3D engine.
 *
 * This is the MECHANICS half of a holographic scene: parse a GLB (from
 * bytes or a URL), place it, merge its geometry for draw-call sanity,
 * give it a card/label, and expose per-model opacity, highlight and
 * world-position. The AESTHETICS stay with the consumer: pass a
 * `materialFactory` to substitute your own materials (a brand's
 * holographic shader, for example) — the layer only ever touches
 * materials it created or was handed.
 *
 * Ownership: everything the layer adds to the scene is disposed by
 * `dispose()`; a model removed through `removeModel` is disposed unless
 * it was registered with `keepAlive`.
 */

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/** A model's placement and rendering options. */
export interface Board3DModelOptions {
  /** GLB bytes, or a URL the layer fetches. */
  source: ArrayBuffer | string;
  position?: [number, number, number];
  /** Euler rotation in radians. */
  rotation?: [number, number, number];
  /** Uniform scale, or a per-axis triple. */
  scale?: number | [number, number, number];
  /** Substitute materials: return null to keep the GLB's own material. */
  materialFactory?: (mesh: THREE.Mesh, material: THREE.Material) => THREE.Material | null;
  /** Initial opacity 0..1 (applied to every mesh material). */
  opacity?: number;
  /** Count toward framing/minimap bounds (default true). A background
   *  shell usually wants false so it never drives the camera. */
  content?: boolean;
  /** Raycast-pickable (default true). */
  pickable?: boolean;
  /** Accelerate the whole rig? Background shells usually skip shadows. */
  castShadow?: boolean;
  /** Emissive colour applied by `highlight()`. */
  highlightColor?: number;
  /** Extra per-model data for the consumer (stored on userData). */
  userData?: Record<string, unknown>;
}

interface ModelEntry {
  root: THREE.Group;
  /** GLB-derived materials still in use — the parse created them for
   *  this model, so the layer frees them. Factory-supplied materials are
   *  NOT here: the consumer made them (they may be shared across models)
   *  and frees them, unless marked `userData.board3dDisposable`. */
  ownedMaterials: Set<THREE.Material>;
  /** Geometries this layer created (merge output / clones). */
  ownedGeometries: Set<THREE.BufferGeometry>;
  baseOpacity: number;
  highlighted: boolean;
}

const DEFAULT_HIGHLIGHT = 0x66ccff;

/**
 * Merge the meshes of a freshly loaded GLB into one mesh per material.
 * A CAD-grade shell often arrives as hundreds of primitives; merging
 * keeps the draw-call count flat without touching the consumer's
 * materials (they are reused by reference).
 */
function mergeByMaterial(root: THREE.Object3D): {
  geometries: Set<THREE.BufferGeometry>;
} {
  const geometries = new Set<THREE.BufferGeometry>();
  root.updateWorldMatrix(true, false);
  const invRoot = root.matrixWorld.clone().invert();
  const groups = new Map<string, { material: THREE.Material; geos: THREE.BufferGeometry[]; donor: THREE.Mesh }>();
  const sources: THREE.Mesh[] = [];

  root.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return;
    const mesh = child as THREE.Mesh;
    const material = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.Material;
    if (!material) return;
    const key = material.uuid;
    mesh.updateWorldMatrix(true, false);
    const local = new THREE.Matrix4().multiplyMatrices(invRoot, mesh.matrixWorld);
    const geo = mesh.geometry.clone();
    geo.applyMatrix4(local);
    const entry = groups.get(key);
    if (entry) entry.geos.push(geo);
    else groups.set(key, { material, geos: [geo], donor: mesh });
    sources.push(mesh);
  });

  for (const mesh of sources) mesh.parent?.remove(mesh);

  for (const { material, geos, donor } of groups.values()) {
    let merged: THREE.BufferGeometry | null = null;
    try {
      merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
    } catch {
      merged = null;
    }
    if (!merged) {
      // Merging can fail on mixed attribute sets — fall back to the
      // individual geometries so nothing silently disappears.
      for (const geo of geos) {
        const mesh = new THREE.Mesh(geo, material);
        mesh.castShadow = donor.castShadow;
        mesh.receiveShadow = donor.receiveShadow;
        root.add(mesh);
        geometries.add(geo);
      }
      continue;
    }
    merged.computeBoundingBox();
    merged.computeBoundingSphere();
    const mesh = new THREE.Mesh(merged, material);
    mesh.castShadow = donor.castShadow;
    mesh.receiveShadow = donor.receiveShadow;
    mesh.userData.matRole = donor.userData.matRole;
    root.add(mesh);
    geometries.add(merged);
  }
  return { geometries };
}

export class ModelLayer {
  private readonly entries = new Map<string, ModelEntry>();
  private readonly loader = new GLTFLoader();
  /** Bumped per load so a stale async response can be dropped. */
  private readonly loadTokens = new Map<string, number>();

  constructor(private readonly scene: THREE.Scene) {}

  /** Load (or replace) a model under `id`. Resolves to its root, or null
   *  when the id was superseded by a newer load or the parse failed. */
  async loadModel(id: string, opts: Board3DModelOptions): Promise<THREE.Group | null> {
    const token = (this.loadTokens.get(id) ?? 0) + 1;
    this.loadTokens.set(id, token);

    let root: THREE.Object3D | null = null;
    try {
      const gltf = await this.parse(opts.source);
      root = gltf.scene ?? gltf.scenes?.[0] ?? null;
    } catch {
      root = null;
    }
    if (!root) return null;
    // A newer load for the same id landed while we parsed: drop this one.
    if (this.loadTokens.get(id) !== token) return null;

    // Replace a previous model under the same id.
    this.removeModel(id);

    root.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = opts.castShadow ?? !mesh.userData.isShell;
        mesh.receiveShadow = true;
      }
    });

    const { geometries } = mergeByMaterial(root);

    // Materials the parse created belong to this model.
    const ownedMaterials = new Set<THREE.Material>();
    const replaced = new Set<THREE.Material>();
    root.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      for (const material of asMaterials(mesh.material)) ownedMaterials.add(material);
    });
    const materialFactory = opts.materialFactory;
    if (materialFactory) {
      const swaps: Array<[THREE.Mesh, THREE.Material]> = [];
      root.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh) return;
        const current = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.Material;
        const replacement = materialFactory(mesh, current);
        // Returning null keeps the GLB material; returning one hands the
        // material's lifetime to the consumer.
        if (replacement && replacement !== current) swaps.push([mesh, replacement]);
      });
      for (const [mesh, replacement] of swaps) {
        for (const gone of asMaterials(mesh.material)) replaced.add(gone);
        mesh.material = replacement;
      }
    }
    for (const gone of replaced) ownedMaterials.delete(gone);

    // The WRAPPER carries the placement: the parsed scene keeps its own
    // transform (so a consumer can still drive the inner rig), and the
    // layer's reported world position is the placement the caller asked
    // for.
    const group = new THREE.Group();
    if (opts.position) group.position.set(...opts.position);
    if (opts.rotation) group.rotation.set(...opts.rotation);
    if (opts.scale != null) {
      if (typeof opts.scale === "number") group.scale.setScalar(opts.scale);
      else group.scale.set(...opts.scale);
    }
    if (opts.userData) Object.assign(group.userData, opts.userData);
    group.add(root);
    const entry: ModelEntry = {
      root: group,
      ownedMaterials,
      ownedGeometries: geometries,
      baseOpacity: opts.opacity ?? 1,
      highlighted: false,
    };
    this.entries.set(id, entry);
    this.scene.add(group);
    if (entry.baseOpacity < 1) this.setOpacity(id, entry.baseOpacity);
    return group;
  }

  /** Opacity 0..1, multiplicative over the model's base opacity. */
  setOpacity(id: string, opacity: number): void {
    const entry = this.entries.get(id);
    if (!entry) return;
    const v = Math.min(1, Math.max(0, Number.isFinite(opacity) ? opacity : 1));
    entry.baseOpacity = v;
    entry.root.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      for (const material of asMaterials(mesh.material)) {
        const base = (material.userData.baseOpacity as number | undefined) ?? 1;
        material.transparent = v < 1 || material.transparent;
        material.opacity = base * v;
        material.depthWrite = v >= 0.99 ? material.depthWrite : false;
        material.needsUpdate = true;
      }
    });
  }

  /** Object3D for a loaded model (null when absent). */
  objectOf(id: string): THREE.Object3D | null {
    return this.entries.get(id)?.root ?? null;
  }

  highlight(id: string, color: number = DEFAULT_HIGHLIGHT): void {
    const entry = this.entries.get(id);
    if (!entry) return;
    entry.highlighted = true;
    entry.root.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      for (const material of asMaterials(mesh.material)) {
        const emissive = (material as THREE.MeshStandardMaterial).emissive;
        if (!emissive) continue;
        if (material.userData.baseEmissive === undefined) {
          material.userData.baseEmissive = emissive.getHex();
        }
        emissive.setHex(color);
        const intensity = (material as THREE.MeshStandardMaterial).emissiveIntensity;
        if (intensity !== undefined) material.userData.baseEmissiveIntensity ??= intensity;
      }
    });
  }

  clearHighlights(): void {
    for (const entry of this.entries.values()) {
      if (!entry.highlighted) continue;
      entry.highlighted = false;
      entry.root.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh) return;
        for (const material of asMaterials(mesh.material)) {
          const emissive = (material as THREE.MeshStandardMaterial).emissive;
          if (!emissive) continue;
          const base = material.userData.baseEmissive as number | undefined;
          if (base !== undefined) emissive.setHex(base);
          const intensity = material.userData.baseEmissiveIntensity as number | undefined;
          if (intensity !== undefined) (material as THREE.MeshStandardMaterial).emissiveIntensity = intensity;
        }
      });
    }
  }

  worldPosition(id: string): [number, number, number] | null {
    const entry = this.entries.get(id);
    if (!entry) return null;
    // The render loop normally maintains world matrices; a direct query
    // must not depend on a frame having run.
    entry.root.updateWorldMatrix(true, false);
    const v = new THREE.Vector3();
    entry.root.getWorldPosition(v);
    return [v.x, v.y, v.z];
  }

  /** Remove and dispose a model. */
  removeModel(id: string): void {
    const entry = this.entries.get(id);
    if (!entry) return;
    this.loadTokens.set(id, (this.loadTokens.get(id) ?? 0) + 1);
    this.scene.remove(entry.root);
    disposeSubtree(entry.root, entry);
    this.entries.delete(id);
  }

  clear(): void {
    for (const id of [...this.entries.keys()]) this.removeModel(id);
    this.loadTokens.clear();
  }

  dispose(): void {
    this.clear();
  }

  private parse(source: ArrayBuffer | string): Promise<{ scene?: THREE.Object3D; scenes?: THREE.Object3D[] }> {
    if (typeof source === "string") {
      return new Promise((resolve, reject) => {
        this.loader.load(source, (gltf) => resolve(gltf as never), undefined, (err) => reject(err));
      });
    }
    // GLTFLoader.parse handles GLB and JSON buffers alike.
    return new Promise((resolve, reject) => {
      this.loader.parse(source, "", (gltf) => resolve(gltf as never), (err) => reject(err));
    });
  }
}

function asMaterials(material: THREE.Material | THREE.Material[]): THREE.Material[] {
  return Array.isArray(material) ? material : material ? [material] : [];
}

/** Free a model's resources. Geometries are always layer-created (the
 *  merge clones them); materials only when the layer owns them or the
 *  consumer marked them disposable. */
function disposeSubtree(root: THREE.Object3D, entry: ModelEntry): void {
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const geometry of entry.ownedGeometries) geometry.dispose();
    entry.ownedGeometries.clear();
    for (const material of entry.ownedMaterials) material.dispose();
    entry.ownedMaterials.clear();
    for (const material of asMaterials(mesh.material)) {
      if (material.userData.board3dDisposable === true) material.dispose();
    }
  });
}

export { DEFAULT_HIGHLIGHT as BOARD3D_DEFAULT_HIGHLIGHT };
