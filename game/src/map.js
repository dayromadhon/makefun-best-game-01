// Yard 7: an industrial container yard at dusk, built from boxes. Every solid box
// is also an axis-aligned collider, so the same list drives movement, bullets and
// line of sight. All boxes stay axis-aligned on purpose: a rotated box would
// need an oriented collider, and the yard reads just as well without them.
import * as THREE from 'three';
import { ARENA, PALETTE, SITES, SPAWNS } from './config.js';

const materials = new Map();
function mat(color) {
  if (!materials.has(color)) {
    materials.set(color, new THREE.MeshLambertMaterial({ color }));
  }
  return materials.get(color);
}

// Segment vs AABB, slab method. Returns the entry distance along the segment
// (0..1) or Infinity when the segment never enters the box.
export function segmentHitsBox(ax, ay, az, bx, by, bz, box) {
  const dx = bx - ax;
  const dy = by - ay;
  const dz = bz - az;
  let tmin = 0;
  let tmax = 1;
  const axes = [
    [dx, ax, box.minX, box.maxX],
    [dy, ay, box.minY, box.maxY],
    [dz, az, box.minZ, box.maxZ],
  ];
  for (let i = 0; i < 3; i += 1) {
    const [d, o, lo, hi] = axes[i];
    if (Math.abs(d) < 1e-9) {
      if (o < lo || o > hi) return Infinity;
    } else {
      let t1 = (lo - o) / d;
      let t2 = (hi - o) / d;
      if (t1 > t2) {
        const tmp = t1;
        t1 = t2;
        t2 = tmp;
      }
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return Infinity;
    }
  }
  return tmin;
}

export function buildMap(scene) {
  const colliders = [];
  const meshes = [];

  function box(cx, cy, cz, w, h, d, color, opts = {}) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, opts.material || mat(color));
    mesh.position.set(cx, cy, cz);
    scene.add(mesh);
    meshes.push(mesh);
    if (!opts.noCollide) {
      colliders.push({
        minX: cx - w / 2, maxX: cx + w / 2,
        minY: cy - h / 2, maxY: cy + h / 2,
        minZ: cz - d / 2, maxZ: cz + d / 2,
        mesh,
      });
    }
    return mesh;
  }

  function flat(cx, cz, w, d, color, y = 0.02, opacity = 1) {
    const material = new THREE.MeshBasicMaterial({
      color, transparent: opacity < 1, opacity, depthWrite: false,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(cx, y, cz);
    scene.add(mesh);
    meshes.push(mesh);
    return mesh;
  }

  // --- Ground and sky dressing -------------------------------------------
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(ARENA.halfX * 2 + 4, ARENA.halfZ * 2 + 4),
    new THREE.MeshLambertMaterial({ color: PALETTE.ground }),
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
  meshes.push(ground);

  // Painted lane lines and a centre line, thin geometry strips on the asphalt.
  flat(0, 0, 0.25, ARENA.halfZ * 2, PALETTE.groundLine, 0.02, 0.55);
  flat(-11.5, 0, 0.18, ARENA.halfZ * 2, 0x8b959e, 0.02, 0.3);
  flat(11.5, 0, 0.18, ARENA.halfZ * 2, 0x8b959e, 0.02, 0.3);
  flat(0, 8, ARENA.halfX * 2, 0.18, 0x8b959e, 0.02, 0.3);
  flat(0, -8, ARENA.halfX * 2, 0.18, 0x8b959e, 0.02, 0.3);

  // --- Outer walls ---------------------------------------------------------
  const W = ARENA.halfX;
  const D = ARENA.halfZ;
  const H = ARENA.wallHeight;
  box(0, H / 2, -D - 0.5, W * 2 + 2, H, 1, PALETTE.wall);
  box(0, H / 2, D + 0.5, W * 2 + 2, H, 1, PALETTE.wall);
  box(-W - 0.5, H / 2, 0, 1, H, D * 2 + 2, PALETTE.wall);
  box(W + 0.5, H / 2, 0, 1, H, D * 2 + 2, PALETTE.wall);
  // Wall caps, a lighter strip so the yard's edge reads at dusk.
  box(0, H + 0.15, -D - 0.5, W * 2 + 2, 0.3, 1.2, PALETTE.wallTop, { noCollide: true });
  box(0, H + 0.15, D + 0.5, W * 2 + 2, 0.3, 1.2, PALETTE.wallTop, { noCollide: true });

  // --- Site A: warehouse, west (open to the east, two door gaps) -----------
  const siteA = SITES.A;
  box(-21.5, 2, -8.5, 1, 4, 9, PALETTE.wall); // west wall
  box(-17.5, 2, -12.8, 9, 4, 1, PALETTE.wall); // north wall
  box(-17.5, 2, -4.2, 9, 4, 1, PALETTE.wall); // south wall
  box(-19.5, 4.4, -8.5, 5, 0.4, 9, PALETTE.containerGrey, { noCollide: true }); // roof lip
  box(-20, 0.6, -11.5, 2.4, 1.2, 1.4, PALETTE.crate); // crates inside
  box(-15.5, 0.5, -6, 1.6, 1, 1.6, PALETTE.crate);
  flat(siteA.center.x, siteA.center.z, 7, 7, PALETTE.siteA, 0.03, 0.16);
  flat(siteA.center.x, siteA.center.z - 3.5, 7, 0.3, PALETTE.siteA, 0.03, 0.7);
  flat(siteA.center.x, siteA.center.z + 3.5, 7, 0.3, PALETTE.siteA, 0.03, 0.7);
  flat(siteA.center.x - 3.5, siteA.center.z, 0.3, 7, PALETTE.siteA, 0.03, 0.7);
  flat(siteA.center.x + 3.5, siteA.center.z, 0.3, 7, PALETTE.siteA, 0.03, 0.7);

  // --- Site B: container stack, east ---------------------------------------
  const siteB = SITES.B;
  box(19.5, 1.3, 8.5, 6, 2.6, 2.6, PALETTE.containerTeal); // ground container
  box(19.5, 3.9, 8.5, 6, 2.6, 2.6, PALETTE.containerRust); // stacked on top
  box(14.5, 1.3, 11.5, 2.6, 2.6, 6, PALETTE.containerAmber); // side container
  box(15, 0.5, 5.5, 1.6, 1, 1.6, PALETTE.crate);
  flat(siteB.center.x, siteB.center.z, 7, 7, PALETTE.siteB, 0.03, 0.16);
  flat(siteB.center.x, siteB.center.z - 3.5, 7, 0.3, PALETTE.siteB, 0.03, 0.7);
  flat(siteB.center.x, siteB.center.z + 3.5, 7, 0.3, PALETTE.siteB, 0.03, 0.7);
  flat(siteB.center.x - 3.5, siteB.center.z, 0.3, 7, PALETTE.siteB, 0.03, 0.7);
  flat(siteB.center.x + 3.5, siteB.center.z, 0.3, 7, PALETTE.siteB, 0.03, 0.7);

  // --- Mid: the central container block ------------------------------------
  box(-3.5, 1.3, -1, 2.6, 2.6, 7, PALETTE.containerRust);
  box(3.5, 1.3, -1, 2.6, 2.6, 7, PALETTE.containerAmber);
  box(0, 3.9, -1, 4.4, 2.6, 2.6, PALETTE.containerGrey); // bridge over the gap
  box(0, 0.5, 4.5, 2, 1, 2, PALETTE.crate);

  // --- Cover: crates and barrels scattered along the lanes -----------------
  const cover = [
    // x, z, w, h, d, color
    [-8, 5, 2.4, 2.4, 1.2, PALETTE.containerTeal],
    [-8, -6, 1.2, 1.2, 1.2, PALETTE.crate],
    [-11, 9, 1.2, 1.2, 1.2, PALETTE.crate],
    [-11, 10.4, 1, 1, 1, PALETTE.crate],
    [8, -6, 2.4, 2.4, 1.2, PALETTE.containerGrey],
    [8, 5, 1.2, 1.2, 1.2, PALETTE.crate],
    [11, -9, 1.2, 1.2, 1.2, PALETTE.crate],
    [11, 9.5, 1.2, 1.2, 1.2, PALETTE.crate],
    [-5, -11, 2.4, 2.4, 1.2, PALETTE.containerAmber],
    [5, -11, 1.2, 1.2, 1.2, PALETTE.crate],
    [-14, 0, 1, 1, 1, PALETTE.crate],
    [14, 0, 1, 1, 1, PALETTE.crate],
    [-5, 11.5, 1.2, 1.2, 1.2, PALETTE.crate],
    [5, 11.5, 1.2, 1.2, 1.2, PALETTE.crate],
  ];
  for (const [x, z, w, h, d, color] of cover) box(x, h / 2, z, w, h, d, color);

  // Barrels (cylinders, but their collider is the same AABB the sim uses).
  const barrelGeo = new THREE.CylinderGeometry(0.42, 0.42, 1.1, 10);
  const barrelMat = mat(PALETTE.barrel);
  for (const [x, z] of [[-6.5, -4.5], [6.5, 4.5], [-13, -5.5], [13, 5.5], [-2, -13], [2, 13]]) {
    const mesh = new THREE.Mesh(barrelGeo, barrelMat);
    mesh.position.set(x, 0.55, z);
    scene.add(mesh);
    meshes.push(mesh);
    colliders.push({
      minX: x - 0.42, maxX: x + 0.42, minY: 0, maxY: 1.1,
      minZ: z - 0.42, maxZ: z + 0.42, mesh,
    });
  }

  // --- Sodium lamps: emissive heads on poles, with real point lights --------
  const lampPositions = [[-10, 0], [10, 0], [0, -8]];
  for (const [x, z] of lampPositions) {
    box(x, 2.5, z, 0.18, 5, 0.18, 0x2b2f36);
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.25, 0.5),
      new THREE.MeshBasicMaterial({ color: 0xffc46b }),
    );
    head.position.set(x, 5.1, z);
    scene.add(head);
    meshes.push(head);
    const light = new THREE.PointLight(0xffb45e, 30, 22, 1.8);
    light.position.set(x, 4.8, z);
    scene.add(light);
  }

  // --- Waypoints: lanes, approaches, holds ---------------------------------
  // Nodes the bots walk between. Edges are listed by index; every edge is a
  // straight, cover-free walk, so bots never need pathfinding, just a target.
  const waypointPos = [
    [0, 14.5], // 0 player spawn / south gate
    [-6, 10], [6, 10], // 1 2 south connectors
    [-10, 4], [10, 4], // 3 4 south lanes
    [-10, -8], [10, -8], // 5 6 mid lanes
    [-17.5, -8.5], [17.5, 8.5], // 7 8 sites A and B
    [-4, 0], [4, 0], // 9 10 around the mid block
    [-14, 4], [14, -4], // 11 12 west/east lanes
    [-13, -11], [0, -13.5], [13, -10], // 13 14 15 defender holds
    [-6, -11], [6, -11], // 16 17 north connectors
    [10, 8], [-14, -2], // 18 19 B approach, A connector
  ];
  const waypoints = waypointPos.map(([x, z], i) => ({ id: i, x, z, links: [] }));
  const link = (a, b) => {
    waypoints[a].links.push(b);
    waypoints[b].links.push(a);
  };
  link(0, 1); link(0, 2); link(1, 3); link(2, 4);
  link(3, 5); link(4, 6); link(5, 9); link(6, 10);
  link(9, 10); link(5, 7); link(6, 8); link(7, 13); link(7, 19);
  link(8, 18); link(8, 15); link(3, 11); link(4, 12);
  link(11, 19); link(12, 18); link(5, 16); link(6, 17);
  link(16, 13); link(17, 15); link(13, 14); link(14, 15);
  link(9, 16); link(10, 17); link(1, 11); link(2, 12);
  link(19, 13); link(18, 15);

  return {
    colliders,
    meshes,
    waypoints,
    sites: SITES,
    spawns: SPAWNS,
    // True when any solid box stands between two points (eye height given).
    blocked(a, b) {
      for (let i = 0; i < colliders.length; i += 1) {
        if (segmentHitsBox(a.x, a.y, a.z, b.x, b.y, b.z, colliders[i]) !== Infinity) return true;
      }
      return false;
    },
  };
}

// Move an AABB (centre pos, half extents, feet at pos.y) by `delta`, one axis
// at a time, sliding along anything it touches. Returns the new position.
export function moveAABB(pos, half, height, delta, colliders) {
  const out = { x: pos.x, y: pos.y, z: pos.z };
  const axes = [
    ['x', delta.x, half],
    ['z', delta.z, half],
    ['y', delta.y, 0],
  ];
  for (const [axis, d, h] of axes) {
    if (d === 0) continue;
    out[axis] += d;
    const minX = out.x - half;
    const maxX = out.x + half;
    const minY = out.y;
    const maxY = out.y + height;
    const minZ = out.z - half;
    const maxZ = out.z + half;
    for (let i = 0; i < colliders.length; i += 1) {
      const c = colliders[i];
      if (maxX <= c.minX || minX >= c.maxX) continue;
      if (maxY <= c.minY || minY >= c.maxY) continue;
      if (maxZ <= c.minZ || minZ >= c.maxZ) continue;
      if (axis === 'x') out.x = d > 0 ? c.minX - half - 0.001 : c.maxX + half + 0.001;
      else if (axis === 'z') out.z = d > 0 ? c.minZ - half - 0.001 : c.maxZ + half + 0.001;
      else out.y = d > 0 ? c.minY - height - 0.001 : c.maxY + 0.001;
    }
  }
  return out;
}

// Shoot a ray from `origin` along `dir` (unit) up to `maxDist`. `targets` are
// AABBs with a `tag` ({kind:'world'} or {kind:'bot', bot, part:'head'|'body'}).
// Returns the nearest hit or null.
export function raycastShot(origin, dir, maxDist, targets) {
  const end = {
    x: origin.x + dir.x * maxDist,
    y: origin.y + dir.y * maxDist,
    z: origin.z + dir.z * maxDist,
  };
  let best = null;
  let bestT = Infinity;
  for (let i = 0; i < targets.length; i += 1) {
    const t = segmentHitsBox(origin.x, origin.y, origin.z, end.x, end.y, end.z, targets[i]);
    if (t !== Infinity && t < bestT) {
      bestT = t;
      best = targets[i];
    }
  }
  if (!best) return null;
  const dist = bestT * maxDist;
  return {
    tag: best.tag,
    dist,
    point: {
      x: origin.x + dir.x * dist,
      y: origin.y + dir.y * dist,
      z: origin.z + dir.z * dist,
    },
  };
}
