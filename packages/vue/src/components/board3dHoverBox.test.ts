import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";

import {
  createHoverBox,
  frameLocalBounds,
  isVisibleInHierarchy,
  normalizeHoverBounds,
} from "./board3dHoverBox";
import { HOVER_BOX_MIN_EXTENT_RATIO, HOVER_BOX_PADDING } from "../utils/scene3d";

/** A body mesh plus the decoration a scene normally hangs off it: a glow
 *  sprite far larger than the body and a CSS2D label anchor. */
function fixture() {
  const anchor = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(2, 2, 2),
    new THREE.MeshBasicMaterial(),
  );
  body.position.set(3, 0, 0);
  anchor.add(body);

  const corona = new THREE.Sprite(new THREE.SpriteMaterial());
  corona.scale.setScalar(100);
  anchor.add(corona);

  const chip = new THREE.Mesh(new THREE.BoxGeometry(50, 50, 50), new THREE.MeshBasicMaterial());
  (chip as unknown as { isCSS2DObject: boolean }).isCSS2DObject = true;
  anchor.add(chip);

  anchor.updateMatrixWorld(true);
  return { anchor, body, corona, chip };
}

describe("frameLocalBounds", () => {
  it("measures the shape only — sprites and CSS2D anchors are decoration", () => {
    const { anchor } = fixture();
    const box = frameLocalBounds(anchor, anchor);
    expect(box.min.x).toBeCloseTo(2, 5);
    expect(box.max.x).toBeCloseTo(4, 5);
    expect(box.min.y).toBeCloseTo(-1, 5);
    expect(box.max.z).toBeCloseTo(1, 5);
  });

  it("measures inside the anchor's space, not the world's", () => {
    const { anchor } = fixture();
    const before = frameLocalBounds(anchor, anchor).clone();
    anchor.position.set(40, -12, 7);
    anchor.updateMatrixWorld(true);
    const after = frameLocalBounds(anchor, anchor);
    for (let axis = 0; axis < 3; axis += 1) {
      expect(after.min.getComponent(axis)).toBeCloseTo(before.min.getComponent(axis), 5);
      expect(after.max.getComponent(axis)).toBeCloseTo(before.max.getComponent(axis), 5);
    }
  });

  it("can bound a subtree the frame target points at", () => {
    const { anchor, body } = fixture();
    const box = frameLocalBounds(anchor, body);
    // The body alone: centred on its own origin, no corona, no chip.
    expect(box.getSize(new THREE.Vector3()).toArray()).toEqual([2, 2, 2]);
  });

  it("prunes invisible subtrees", () => {
    const { anchor } = fixture();
    const hidden = new THREE.Mesh(
      new THREE.BoxGeometry(80, 80, 80),
      new THREE.MeshBasicMaterial(),
    );
    anchor.add(hidden);
    expect(frameLocalBounds(anchor, anchor).max.x).toBeCloseTo(40, 5);

    hidden.visible = false;
    expect(frameLocalBounds(anchor, anchor).max.x).toBeCloseTo(4, 5);
  });

  it("returns an empty box for a subtree with nothing measurable", () => {
    const anchor = new THREE.Group();
    anchor.add(new THREE.Object3D());
    expect(frameLocalBounds(anchor, anchor).isEmpty()).toBe(true);
  });
});

describe("normalizeHoverBounds", () => {
  it("pads every axis around the centre", () => {
    const box = new THREE.Box3(new THREE.Vector3(-1, -2, -3), new THREE.Vector3(1, 2, 3));
    expect(normalizeHoverBounds(box)).toBe(true);
    expect(box.min.x).toBeCloseTo(-HOVER_BOX_PADDING, 5);
    expect(box.max.y).toBeCloseTo(2 * HOVER_BOX_PADDING, 5);
    expect(box.getCenter(new THREE.Vector3()).toArray()).toEqual([0, 0, 0]);
  });

  it("floors a degenerate axis so a flat card still reads as a box", () => {
    const box = new THREE.Box3(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(10, 10, 0),
    );
    expect(normalizeHoverBounds(box)).toBe(true);
    const size = box.getSize(new THREE.Vector3());
    expect(size.z).toBeCloseTo(10 * HOVER_BOX_MIN_EXTENT_RATIO, 5);
    // …and the axis it was floored on stays centred on the original plane.
    expect(box.getCenter(new THREE.Vector3()).z).toBeCloseTo(0, 6);
  });

  it("rejects boxes there is nothing to wrap", () => {
    expect(normalizeHoverBounds(new THREE.Box3())).toBe(false);
    const point = new THREE.Box3(new THREE.Vector3(5, 5, 5), new THREE.Vector3(5, 5, 5));
    expect(normalizeHoverBounds(point)).toBe(false);
    // An infinite extent would compose a NaN matrix and un-render the
    // frame silently: it counts as nothing to wrap.
    const infinite = new THREE.Box3(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(Number.POSITIVE_INFINITY, 1, 1),
    );
    expect(normalizeHoverBounds(infinite)).toBe(false);
  });
});

describe("isVisibleInHierarchy", () => {
  it("follows the renderer's rule — a hidden ANCESTOR hides the child", () => {
    const root = new THREE.Group();
    const parent = new THREE.Group();
    const leaf = new THREE.Object3D();
    root.add(parent);
    parent.add(leaf);
    expect(isVisibleInHierarchy(leaf)).toBe(true);

    parent.visible = false;
    // The leaf still reads visible=true: three only skips the subtree.
    expect(leaf.visible).toBe(true);
    expect(isVisibleInHierarchy(leaf)).toBe(false);
    expect(isVisibleInHierarchy(parent)).toBe(false);

    parent.visible = true;
    leaf.visible = false;
    expect(isVisibleInHierarchy(leaf)).toBe(false);
    expect(isVisibleInHierarchy(parent)).toBe(true);
  });
});

describe("createHoverBox", () => {
  it("wraps a target and follows its anchor's world matrix", () => {
    const { anchor, body } = fixture();
    const frame = createHoverBox();
    expect(frame.object.visible).toBe(false);

    frame.attach(anchor, body);
    expect(frame.object.visible).toBe(true);
    // The body is 2 units at x = 3 → padded half-extent on every axis.
    const half = (2 * HOVER_BOX_PADDING) / 2;
    expect(frame.object.matrix.elements[12]).toBeCloseTo(3, 5);
    expect(frame.object.matrix.elements[0]).toBeCloseTo(half * 2, 5);

    // Rigid motion of the anchor is tracked exactly, at O(1).
    anchor.position.set(-8, 5, 1);
    anchor.updateMatrixWorld(true);
    frame.refresh();
    expect(frame.object.matrix.elements[12]).toBeCloseTo(-5, 5);
    expect(frame.object.matrix.elements[13]).toBeCloseTo(5, 5);
    expect(frame.object.matrix.elements[14]).toBeCloseTo(1, 5);
    // …and the frame never rewrites three's own transform bookkeeping.
    expect(frame.object.matrixWorldNeedsUpdate).toBe(true);

    frame.dispose();
  });

  it("stays hidden for a null target, an empty subtree, or a hide()", () => {
    const { anchor } = fixture();
    const frame = createHoverBox();
    // The return value is the caller's "look again" signal: an empty
    // measurement must not latch a hidden frame for good.
    expect(frame.attach(anchor, null)).toBe(false);
    expect(frame.object.visible).toBe(false);

    expect(frame.attach(anchor, new THREE.Object3D())).toBe(false);
    expect(frame.object.visible).toBe(false);

    expect(frame.attach(anchor, anchor)).toBe(true);
    expect(frame.object.visible).toBe(true);
    // A hidden frame is not re-placed behind the consumer's back.
    frame.hide();
    const before = frame.object.matrix.clone();
    frame.refresh();
    expect(frame.object.matrix.equals(before)).toBe(true);
    frame.dispose();
  });

  it("takes its colour from the caller and frees its own GPU resources", () => {
    const frame = createHoverBox();
    frame.setColor("#123456");
    const material = frame.object.material as THREE.LineBasicMaterial;
    expect(material.color.getHexString()).toBe("123456");

    const geoSpy = vi.spyOn(frame.object.geometry, "dispose");
    const matSpy = vi.spyOn(material, "dispose");
    frame.dispose();
    expect(geoSpy).toHaveBeenCalled();
    expect(matSpy).toHaveBeenCalled();
  });
});
