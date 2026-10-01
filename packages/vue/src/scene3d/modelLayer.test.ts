/* The model layer runs against the REAL three.js GLTFLoader and the real
 * scene graph (only the WebGL renderer is absent — parsing, merging,
 * placement, opacity and disposal are all CPU work). Fixtures are glTF
 * JSON with an inline base64 buffer, so no binary assets live in the
 * repo. */

import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";

import { ModelLayer } from "./modelLayer";

/** A one-triangle GLB (binary glTF) — the same shape the chest holographic
 *  panel loads out of object storage, and immune to any network fetch. */
/** Wrap glTF JSON + a BIN chunk into a GLB container. */
function glbFromJson(jsonObj: unknown, bin: Uint8Array): ArrayBuffer {
  const jsonText = JSON.stringify(jsonObj);
  const enc = new TextEncoder();
  const jsonBytes = enc.encode(jsonText);
  const jsonPad = (4 - (jsonBytes.length % 4)) % 4;
  const binPad = (4 - (bin.length % 4)) % 4;
  const jsonChunkLen = jsonBytes.length + jsonPad;
  const binChunkLen = bin.length + binPad;
  const total = 12 + 8 + jsonChunkLen + 8 + binChunkLen;
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, total, true);
  view.setUint32(12, jsonChunkLen, true);
  view.setUint32(16, 0x4e4f534a, true);
  out.set(jsonBytes, 20);
  for (let i = 0; i < jsonPad; i++) out[20 + jsonBytes.length + i] = 0x20;
  const binStart = 20 + jsonChunkLen;
  view.setUint32(binStart, binChunkLen, true);
  view.setUint32(binStart + 4, 0x004e4942, true);
  out.set(bin, binStart + 8);
  return out.buffer;
}

function triangleGlb(opts: { secondPrimitive?: boolean } = {}): ArrayBuffer {
  const verts = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
  const bin = new Uint8Array(verts.buffer.slice(0));
  const primitives = [{ attributes: { POSITION: 0 } }];
  if (opts.secondPrimitive) primitives.push({ attributes: { POSITION: 0 } });
  const jsonText = JSON.stringify({
    asset: { version: "2.0" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives }],
    buffers: [{ byteLength: bin.byteLength }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: bin.byteLength, target: 34962 }],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 3,
        type: "VEC3",
        max: [1, 1, 0],
        min: [0, 0, 0],
      },
    ],
  });

  return glbFromJson(JSON.parse(jsonText), bin);
}

function meshCount(root: THREE.Object3D): number {
  let n = 0;
  root.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) n += 1;
  });
  return n;
}

describe("ModelLayer", () => {
  it("loads a GLB/glTF into the scene and merges its primitives", async () => {
    const scene = new THREE.Scene();
    const layer = new ModelLayer(scene);
    const group = await layer.loadModel("m1", { source: triangleGlb({ secondPrimitive: true }) });

    expect(group).toBeTruthy();
    expect(scene.children).toContain(group);
    // Two primitives sharing a material collapse into ONE merged mesh.
    expect(meshCount(group!)).toBe(1);
    expect(layer.worldPosition("m1")).toEqual([0, 0, 0]);
    layer.dispose();
    expect(scene.children).toHaveLength(0);
  });

  it("applies placement (position, rotation, scale) and reports world space", async () => {
    const scene = new THREE.Scene();
    const layer = new ModelLayer(scene);
    await layer.loadModel("m1", {
      source: triangleGlb(),
      position: [5, 2, -3],
      rotation: [0, Math.PI / 2, 0],
      scale: 2,
    });
    const [x, y, z] = layer.worldPosition("m1")!;
    expect(x).toBeCloseTo(5, 6);
    expect(y).toBeCloseTo(2, 6);
    expect(z).toBeCloseTo(-3, 6);
    const root = layer.objectOf("m1") as THREE.Group;
    // The wrapper carries the placement, so the caller's transform is
    // exactly what worldPosition reports.
    expect(root.scale.x).toBe(2);
    layer.dispose();
  });

  it("drives opacity and restores it", async () => {
    const scene = new THREE.Scene();
    const layer = new ModelLayer(scene);
    await layer.loadModel("m1", { source: triangleGlb(), opacity: 0.5 });
    const material = (layer.objectOf("m1")!.children[0].children[0] as THREE.Mesh)
      .material as THREE.MeshStandardMaterial;
    expect(material.opacity).toBeCloseTo(0.5, 6);
    expect(material.transparent).toBe(true);

    layer.setOpacity("m1", 1);
    expect(material.opacity).toBeCloseTo(1, 6);
    // The dip is REVERSIBLE: an originally opaque material leaves the
    // transparent pass and gets its depth writes back (a full-opacity
    // model stuck transparent shows sorting artifacts).
    expect(material.transparent).toBe(false);
    expect(material.depthWrite).toBe(true);
    // Out-of-range and non-finite values clamp instead of corrupting state.
    layer.setOpacity("m1", Number.NaN);
    expect(material.opacity).toBeCloseTo(1, 6);
    layer.dispose();
  });

  it("highlights a model and restores its original emissive", async () => {
    const scene = new THREE.Scene();
    const layer = new ModelLayer(scene);
    await layer.loadModel("m1", { source: triangleGlb() });
    const material = (layer.objectOf("m1")!.children[0].children[0] as THREE.Mesh)
      .material as THREE.MeshStandardMaterial;
    const before = material.emissive.getHex();

    layer.highlight("m1", 0xff0000);
    expect(material.emissive.getHex()).toBe(0xff0000);
    layer.clearHighlights();
    expect(material.emissive.getHex()).toBe(before);
    layer.dispose();
  });

  it("hands every material to a factory and keeps consumer materials alive", async () => {
    const scene = new THREE.Scene();
    const layer = new ModelLayer(scene);
    const custom = new THREE.MeshBasicMaterial({ color: 0x123456 });
    const disposeSpy = vi.spyOn(custom, "dispose");

    await layer.loadModel("m1", {
      source: triangleGlb(),
      materialFactory: () => custom,
    });
    const mesh = layer.objectOf("m1")!.children[0].children[0] as THREE.Mesh;
    expect(mesh.material).toBe(custom);

    // The consumer made this material — removing the model must not
    // dispose it (it may be shared across models).
    layer.removeModel("m1");
    expect(disposeSpy).not.toHaveBeenCalled();

    // …unless the consumer marks it disposable.
    custom.userData.board3dDisposable = true;
    await layer.loadModel("m2", { source: triangleGlb(), materialFactory: () => custom });
    layer.removeModel("m2");
    expect(disposeSpy).toHaveBeenCalledTimes(1);
    layer.dispose();
  });

  it("disposes the geometry it created when a model goes away", async () => {
    const scene = new THREE.Scene();
    const layer = new ModelLayer(scene);
    await layer.loadModel("m1", { source: triangleGlb() });
    const mesh = layer.objectOf("m1")!.children[0].children[0] as THREE.Mesh;
    const geoSpy = vi.spyOn(mesh.geometry, "dispose");

    layer.removeModel("m1");
    expect(geoSpy).toHaveBeenCalled();
    expect(scene.children).toHaveLength(0);
    layer.dispose();
  });

  it("replaces a model registered under the same id", async () => {
    const scene = new THREE.Scene();
    const layer = new ModelLayer(scene);
    await layer.loadModel("m1", { source: triangleGlb(), position: [1, 0, 0] });
    const first = layer.objectOf("m1");
    await layer.loadModel("m1", { source: triangleGlb(), position: [9, 0, 0] });
    expect(layer.objectOf("m1")).not.toBe(first);
    expect(scene.children).toHaveLength(1);
    expect(layer.worldPosition("m1")![0]).toBeCloseTo(9, 6);
    layer.dispose();
  });

  it("drops a stale load when a newer one supersedes it", async () => {
    const scene = new THREE.Scene();
    const layer = new ModelLayer(scene);
    const slow = layer.loadModel("m1", { source: triangleGlb(), position: [1, 0, 0] });
    const fast = layer.loadModel("m1", { source: triangleGlb(), position: [2, 0, 0] });
    const [a, b] = await Promise.all([slow, fast]);
    // Exactly one of them owns the id afterwards, and the scene holds a
    // single model (no duplicate rigs from a race).
    expect([a, b].filter(Boolean)).toHaveLength(1);
    expect(scene.children).toHaveLength(1);
    expect(layer.worldPosition("m1")![0]).toBeCloseTo(2, 6);
    layer.dispose();
  });

  it("falls back to unmerged meshes when attribute sets differ", async () => {
    const scene = new THREE.Scene();
    const layer = new ModelLayer(scene);
    // One primitive carries NORMAL, the other does not — mergeGeometries
    // refuses mixed attribute sets, so the fallback must keep every
    // geometry instead of silently dropping meshes. Packed as a real GLB
    // (loadModel treats bare strings as URLs).
    const pos = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
    const nor = new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]);
    const bin = new Uint8Array(pos.buffer.byteLength * 3);
    bin.set(new Uint8Array(pos.buffer), 0);
    bin.set(new Uint8Array(nor.buffer), pos.buffer.byteLength);
    const json = {
      asset: { version: "2.0" },
      scene: 0,
      scenes: [{ nodes: [0, 1] }],
      nodes: [{ mesh: 0 }, { mesh: 1 }],
      meshes: [
        { primitives: [{ attributes: { POSITION: 0 } }] },
        { primitives: [{ attributes: { POSITION: 1, NORMAL: 2 } }] },
      ],
      buffers: [{ byteLength: bin.byteLength }],
      bufferViews: [
        { buffer: 0, byteOffset: 0, byteLength: pos.buffer.byteLength, target: 34962 },
        {
          buffer: 0,
          byteOffset: pos.buffer.byteLength,
          byteLength: pos.buffer.byteLength,
          target: 34962,
        },
        {
          buffer: 0,
          byteOffset: pos.buffer.byteLength * 2,
          byteLength: nor.buffer.byteLength,
          target: 34962,
        },
      ],
      accessors: [
        { bufferView: 0, componentType: 5126, count: 3, type: "VEC3", max: [1, 1, 0], min: [0, 0, 0] },
        { bufferView: 1, componentType: 5126, count: 3, type: "VEC3", max: [1, 1, 0], min: [0, 0, 0] },
        { bufferView: 2, componentType: 5126, count: 3, type: "VEC3", max: [1, 1, 1], min: [0, 0, 1] },
      ],
    };
    const group = await layer.loadModel("mixed", { source: glbFromJson(json, bin) });
    expect(group).toBeTruthy();
    let meshes = 0;
    group!.traverse((c) => {
      if ((c as THREE.Mesh).isMesh) meshes += 1;
    });
    expect(meshes).toBeGreaterThanOrEqual(2);
    layer.dispose();
  });

  it("hands the parsed rig to onRig before placement", async () => {
    const scene = new THREE.Scene();
    const layer = new ModelLayer(scene);
    let seen: THREE.Object3D | null = null;
    await layer.loadModel("m1", {
      source: triangleGlb(),
      position: [4, 0, 0],
      // A world-space GLB gets re-centred onto its fixture here.
      onRig: (root) => {
        seen = root;
        root.position.sub(new THREE.Vector3(27, 1.7, 25));
      },
    });
    expect(seen).toBeTruthy();
    // The wrapper still lands exactly where placement said.
    expect(layer.worldPosition("m1")![0]).toBeCloseTo(4, 6);
    layer.dispose();
  });

  it("resolves null (and stays empty) when the source cannot be parsed", async () => {
    const scene = new THREE.Scene();
    const layer = new ModelLayer(scene);
    const result = await layer.loadModel("bad", { source: "not a gltf at all" });
    expect(result).toBeNull();
    expect(scene.children).toHaveLength(0);
    expect(layer.worldPosition("bad")).toBeNull();
    layer.dispose();
  });
});
