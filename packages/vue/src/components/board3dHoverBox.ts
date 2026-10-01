/**
 * board3dHoverBox — the 8-corner selection frame HkBoard3D draws around
 * the object under the pointer.
 *
 * Why a frame instead of a highlight: hovering used to be the consumer's
 * job, and the usual implementation is "scale the mesh up a little". That
 * resizes the thing the user is aiming at (targets move under the
 * pointer) and tells the user nothing about the object's extent. A
 * corner bracket marks the object without touching it.
 *
 * The frame's colour is the page's: HkBoard3D hands in the palette's text
 * channel in a dark room and its muted channel in a light one.
 *
 * COST MODEL — the box is measured ONCE per hover, in the registered
 * object's own space, and each frame is placed by composing that local
 * box with the object's world matrix. Rigid motion (orbits, a parent's
 * spin, camera-independent flights) is tracked exactly, at O(1) per frame
 * however heavy the object's subtree is. Animation INSIDE the frame
 * target is deliberately not chased: a spinning sphere must not tumble
 * its own selection frame.
 *
 * DECORATION IS NOT SHAPE — sprites (a star's corona) and CSS2D label
 * anchors are skipped when measuring, and invisible subtrees are pruned:
 * a glow that is six times the body must not blow the frame up with it.
 */

import * as THREE from "three";

import {
  HOVER_BOX_MIN_EXTENT_RATIO,
  HOVER_BOX_PADDING,
  hoverBoxSegments,
} from "../utils/scene3d";

/** Drawn in the transparent pass, over whatever the content left behind:
 *  the frame is a pointer affordance, not scenery, so all eight corners
 *  stay readable even where the body covers them (gizmo convention). */
const HOVER_BOX_RENDER_ORDER = 10;

export interface HoverBoxHandle {
  /** The gizmo itself — add it to the scene, never to content. */
  readonly object: THREE.LineSegments;
  /** Wrap `target` measured inside `anchor`'s space; `null` hides the
   *  frame. Measuring happens here and only here. Returns false when
   *  there was nothing measurable to wrap (empty or hidden content), so
   *  the caller knows to look again instead of latching onto a hidden
   *  frame forever. */
  attach(anchor: THREE.Object3D, target: THREE.Object3D | null): boolean;
  /** Re-place the frame from the anchor's current world matrix (per
   *  frame). A no-op while the frame is hidden. */
  refresh(): void;
  /** Hide without forgetting the attachment. */
  hide(): void;
  setColor(color: THREE.ColorRepresentation): void;
  dispose(): void;
}

/**
 * `Object3D.visible` is per NODE: an object under a hidden parent is
 * invisible to the renderer while reading `true` itself. The hover frame
 * must follow the renderer's rule, or it keeps painting a bracket around
 * something nobody can see.
 */
export function isVisibleInHierarchy(obj: THREE.Object3D): boolean {
  for (let node: THREE.Object3D | null = obj; node; node = node.parent) {
    if (!node.visible) return false;
  }
  return true;
}

/** Sprites and CSS2D/CSS3D anchors are decoration, never the object's
 *  shape. */
function isDecoration(obj: THREE.Object3D): boolean {
  const probe = obj as unknown as {
    isSprite?: boolean;
    isCSS2DObject?: boolean;
    isCSS3DObject?: boolean;
  };
  return (
    probe.isSprite === true || probe.isCSS2DObject === true || probe.isCSS3DObject === true
  );
}

/**
 * Bounding box of `target`'s subtree expressed in `anchor`'s local space.
 * Prunes invisible subtrees and decoration; an empty box means "nothing
 * measurable here".
 */
export function frameLocalBounds(
  anchor: THREE.Object3D,
  target: THREE.Object3D,
  out = new THREE.Box3(),
): THREE.Box3 {
  anchor.updateWorldMatrix(true, true);
  const inverseAnchor = anchor.matrixWorld.clone().invert();
  const probe = new THREE.Box3();
  const intoLocal = new THREE.Matrix4();

  out.makeEmpty();
  const walk = (obj: THREE.Object3D): void => {
    if (!obj.visible || isDecoration(obj)) return;
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) {
      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
      const bb = mesh.geometry.boundingBox;
      if (bb) {
        intoLocal.multiplyMatrices(inverseAnchor, obj.matrixWorld);
        probe.copy(bb).applyMatrix4(intoLocal);
        out.union(probe);
      }
    }
    for (const child of obj.children) walk(child);
  };
  walk(target);
  return out;
}

/**
 * Pad the box and floor every degenerate axis so the frame stays a box.
 * Returns false when there is nothing to wrap (an empty or zero-size
 * box), which callers turn into "stay hidden".
 */
export function normalizeHoverBounds(
  box: THREE.Box3,
  padding = HOVER_BOX_PADDING,
  minExtentRatio = HOVER_BOX_MIN_EXTENT_RATIO,
): boolean {
  if (box.isEmpty()) return false;
  const size = box.getSize(new THREE.Vector3());
  const longest = Math.max(size.x, size.y, size.z);
  // A non-finite extent (NaN or ±Infinity from a degenerate geometry
  // bounding box) would compose a NaN placement matrix and silently
  // un-render the frame: nothing measurable, stay hidden.
  if (!(longest > 0) || !Number.isFinite(longest)) return false;
  const floor = minExtentRatio * longest;
  const center = box.getCenter(new THREE.Vector3());
  const half = new THREE.Vector3(
    Math.max(size.x * padding, floor) / 2,
    Math.max(size.y * padding, floor) / 2,
    Math.max(size.z * padding, floor) / 2,
  );
  box.min.set(center.x - half.x, center.y - half.y, center.z - half.z);
  box.max.set(center.x + half.x, center.y + half.y, center.z + half.z);
  return true;
}

export function createHoverBox(): HoverBoxHandle {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(hoverBoxSegments([1, 1, 1]), 3),
  );
  const material = new THREE.LineBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.9,
    depthTest: false,
    depthWrite: false,
  });
  const object = new THREE.LineSegments(geometry, material);
  // The placement matrix is composed from the anchor's world matrix, so
  // three must not derive it from position/quaternion/scale.
  object.matrixAutoUpdate = false;
  object.renderOrder = HOVER_BOX_RENDER_ORDER;
  object.frustumCulled = false;
  object.visible = false;

  const localBox = new THREE.Box3();
  const localMatrix = new THREE.Matrix4();
  const center = new THREE.Vector3();
  const size = new THREE.Vector3();
  const identity = new THREE.Quaternion();
  let anchor: THREE.Object3D | null = null;

  function refresh(): void {
    if (!object.visible || !anchor) return;
    anchor.updateWorldMatrix(true, false);
    object.matrix.multiplyMatrices(anchor.matrixWorld, localMatrix);
    object.matrixWorldNeedsUpdate = true;
  }

  return {
    object,
    attach(nextAnchor, target) {
      anchor = nextAnchor;
      localBox.makeEmpty();
      object.visible = false;
      if (!target) return false;
      frameLocalBounds(nextAnchor, target, localBox);
      if (!normalizeHoverBounds(localBox)) return false;
      localBox.getCenter(center);
      localBox.getSize(size);
      localMatrix.compose(center, identity, size);
      object.visible = true;
      refresh();
      return true;
    },
    refresh,
    hide() {
      object.visible = false;
    },
    setColor(color) {
      material.color.set(color);
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
