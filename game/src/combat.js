// Combat: the player's hitscan shooting, tracers and impact sparks, and the
// thrown grenade. Shooting resolves against the map's colliders and the bots'
// hitboxes with one segment test, so a wall always beats a bot behind it.
import * as THREE from 'three';
import { GRENADE } from './config.js';
import { moveAABB, raycastShot } from './map.js';

export function createCombat(scene, map) {
  const tracers = [];
  const sparks = [];
  const grenades = [];
  const tracerMat = new THREE.LineBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.9 });
  const sparkGeo = new THREE.SphereGeometry(0.05, 6, 4);
  const sparkMat = new THREE.MeshBasicMaterial({ color: 0xffc46b });

  function addTracer(from, to) {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(from.x, from.y, from.z),
      new THREE.Vector3(to.x, to.y, to.z),
    ]);
    const line = new THREE.Line(geo, tracerMat.clone());
    scene.add(line);
    tracers.push({ line, until: 0 }); // `until` set by the caller via now
    return tracers[tracers.length - 1];
  }

  function addSparks(point, n) {
    for (let i = 0; i < n; i += 1) {
      const mesh = new THREE.Mesh(sparkGeo, sparkMat);
      mesh.position.set(point.x, point.y, point.z);
      scene.add(mesh);
      sparks.push({
        mesh,
        vel: {
          x: (Math.random() - 0.5) * 4,
          y: Math.random() * 3 + 1,
          z: (Math.random() - 0.5) * 4,
        },
        until: 0,
      });
    }
  }

  // Explosion visual: a quick expanding ring and a flash light.
  const ringGeo = new THREE.RingGeometry(0.4, 0.55, 24);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xff9a3d, transparent: true, opacity: 0.9, side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.visible = false;
  scene.add(ring);
  const boomLight = new THREE.PointLight(0xff8a3d, 0, 18, 1.6);
  scene.add(boomLight);
  let ringUntil = -1;

  return {
    grenades,
    // Fire one hitscan shot. Returns {hit, bot, head, point} or {hit:false, point}.
    shoot(origin, dir, spread, range, rng, now) {
      // Jitter the direction inside the spread cone.
      const dx = dir.x + (rng.next() - 0.5) * 2 * spread;
      const dy = dir.y + (rng.next() - 0.5) * 2 * spread;
      const dz = dir.z + (rng.next() - 0.5) * 2 * spread;
      const len = Math.hypot(dx, dy, dz);
      const shotDir = { x: dx / len, y: dy / len, z: dz / len };
      const targets = [];
      for (const c of map.colliders) {
        targets.push({
          minX: c.minX, maxX: c.maxX, minY: c.minY, maxY: c.maxY,
          minZ: c.minZ, maxZ: c.maxZ, tag: { kind: 'world' },
        });
      }
      const hit = raycastShot(origin, shotDir, range, targets);
      const end = hit ? hit.point : {
        x: origin.x + shotDir.x * range,
        y: origin.y + shotDir.y * range,
        z: origin.z + shotDir.z * range,
      };
      const tracer = addTracer(origin, end);
      tracer.until = now + 0.08;
      if (hit && hit.tag.kind === 'world') addSparks(end, 5);
      return { hit: !!hit, world: hit && hit.tag.kind === 'world', point: end };
    },
    // Same as shoot, but bots are targets too. Returns the bot hit, if any.
    // The ray starts at the eye; the tracer is drawn from `tracerFrom` (the
    // gun muzzle) to the same end point, so it reads as a real gunshot.
    shootAtBots(origin, dir, spread, range, bots, rng, now, tracerFrom) {
      const dx = dir.x + (rng.next() - 0.5) * 2 * spread;
      const dy = dir.y + (rng.next() - 0.5) * 2 * spread;
      const dz = dir.z + (rng.next() - 0.5) * 2 * spread;
      const len = Math.hypot(dx, dy, dz);
      const shotDir = { x: dx / len, y: dy / len, z: dz / len };
      const targets = [];
      for (const c of map.colliders) {
        targets.push({
          minX: c.minX, maxX: c.maxX, minY: c.minY, maxY: c.maxY,
          minZ: c.minZ, maxZ: c.maxZ, tag: { kind: 'world' },
        });
      }
      for (const hb of bots.hitboxes()) targets.push(hb);
      const hit = raycastShot(origin, shotDir, range, targets);
      const end = hit ? hit.point : {
        x: origin.x + shotDir.x * range,
        y: origin.y + shotDir.y * range,
        z: origin.z + shotDir.z * range,
      };
      const tracer = addTracer(tracerFrom || origin, end);
      tracer.until = now + 0.08;
      if (hit && hit.tag.kind === 'world') addSparks(end, 5);
      if (hit && hit.tag.kind === 'bot') {
        return { hit: true, bot: hit.tag.bot, head: hit.tag.part === 'head', point: end };
      }
      return { hit: !!hit, bot: null, head: false, point: end };
    },
    // A tracer from a bot's gun to the player (or past them on a miss).
    botTracer(bot, target, now) {
      const from = {
        x: bot.pos.x - Math.sin(bot.yaw) * 0.5,
        y: bot.pos.y + 1.2,
        z: bot.pos.z - Math.cos(bot.yaw) * 0.5,
      };
      const tracer = addTracer(from, target);
      tracer.until = now + 0.08;
    },
    addGrenade(grenade, mesh) {
      grenades.push({ ...grenade, mesh, spin: 0 });
    },
    explode(pos, now, onDamage) {
      ring.position.set(pos.x, 0.06, pos.z);
      ring.scale.set(1, 1, 1);
      ring.visible = true;
      ringUntil = now + 0.45;
      boomLight.position.set(pos.x, 1.5, pos.z);
      boomLight.intensity = 60;
      onDamage(pos);
    },
    update(dt, now, onGrenadeDamage) {
      // Tracers and sparks fade out.
      for (let i = tracers.length - 1; i >= 0; i -= 1) {
        if (now >= tracers[i].until) {
          scene.remove(tracers[i].line);
          tracers[i].line.geometry.dispose();
          tracers[i].line.material.dispose();
          tracers.splice(i, 1);
        }
      }
      for (let i = sparks.length - 1; i >= 0; i -= 1) {
        const s = sparks[i];
        s.vel.y -= 12 * dt;
        s.mesh.position.x += s.vel.x * dt;
        s.mesh.position.y += s.vel.y * dt;
        s.mesh.position.z += s.vel.z * dt;
        if (s.mesh.position.y < 0.03) {
          scene.remove(s.mesh);
          sparks.splice(i, 1);
        }
      }
      if (ring.visible) {
        const t = Math.max(0, (ringUntil - now) / 0.45);
        ring.scale.setScalar(1 + (1 - t) * 12);
        ringMat.opacity = 0.9 * t;
        boomLight.intensity = 60 * t;
        if (t <= 0) ring.visible = false;
      }
      // Grenades: gravity, bounce off the ground and boxes, fuse, boom.
      for (let i = grenades.length - 1; i >= 0; i -= 1) {
        const g = grenades[i];
        g.fuse -= dt;
        g.vel.y -= 20 * dt;
        const next = moveAABB(g.pos, 0.12, 0.24, {
          x: g.vel.x * dt, y: g.vel.y * dt, z: g.vel.z * dt,
        }, map.colliders);
        if (next.y <= 0.12) {
          next.y = 0.12;
          if (Math.abs(g.vel.y) > 1.5 && !g.bounced) {
            g.bounced = true;
          }
          g.vel.y = Math.abs(g.vel.y) * 0.35;
          g.vel.x *= 0.7;
          g.vel.z *= 0.7;
        }
        g.pos = next;
        g.mesh.position.set(g.pos.x, g.pos.y, g.pos.z);
        g.mesh.rotation.x += dt * 9;
        g.mesh.rotation.z += dt * 6;
        if (g.fuse <= 0) {
          scene.remove(g.mesh);
          grenades.splice(i, 1);
          this.explode(g.pos, now, onGrenadeDamage);
        }
      }
    },
  };
}
