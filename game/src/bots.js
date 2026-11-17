// Defender bots: three CINDER bots hold Yard 7. Each one patrols or holds a
// lane, reacts to what it sees and hears, fights in bursts, and rotates to a
// planted charge to defuse it. They are deliberately weaker shots than the
// player: three rifles against one pistol must stay fair.
import * as THREE from 'three';
import { BOT, DEFUSE_TIME, SITES } from './config.js';
import { moveAABB } from './map.js';

const BODY_HALF = 0.34;
const HEAD_HALF = 0.16;

function buildBotMesh(scene, name) {
  const group = new THREE.Group();
  const blue = new THREE.MeshLambertMaterial({ color: 0x3d6f8e });
  const dark = new THREE.MeshLambertMaterial({ color: 0x22262c });
  const skin = new THREE.MeshLambertMaterial({ color: 0xc9a06a });
  const visor = new THREE.MeshLambertMaterial({ color: 0x4fa8c9 });
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.75, 0.2), dark);
  legL.position.set(-0.11, 0.375, 0);
  const legR = legL.clone();
  legR.position.x = 0.11;
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.62, 0.32), blue);
  torso.position.set(0, 1.06, 0);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.28, 0.3), skin);
  head.position.set(0, 1.55, 0);
  const visorMesh = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.08, 0.05), visor);
  visorMesh.position.set(0, 1.56, -0.16);
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.1, 0.62), dark);
  gun.position.set(0.2, 1.15, -0.3);
  group.add(legL, legR, torso, head, visorMesh, gun);
  group.userData.flashables = [torso, head];
  group.userData.name = name;
  scene.add(group);
  return group;
}

export function createBots(scene, map, rng) {
  const bots = [];
  for (let i = 0; i < BOT.count; i += 1) {
    bots.push({
      id: i,
      name: BOT.names[i],
      mesh: buildBotMesh(scene, BOT.names[i]),
      pos: { x: 0, y: 0, z: 0 },
      yaw: 0,
      hp: BOT.health,
      alive: true,
      state: 'hold',
      home: 13 + i, // waypoint ids 13, 14, 15: the defender holds
      targetWp: 13 + i,
      waitUntil: 0,
      reactionUntil: 0,
      burstLeft: 0,
      burstTimer: 0,
      burstPauseUntil: 0,
      alertPos: null,
      alertUntil: 0,
      defuseProgress: 0,
      flashUntil: 0,
      stuckTimer: 0,
      lastX: 0,
      lastZ: 0,
      scanPhase: rng.range(0, Math.PI * 2),
      deadAt: 0,
    });
  }

  function nearestWaypoint(x, z) {
    let best = 0;
    let bestD = Infinity;
    for (const wp of map.waypoints) {
      const d = (wp.x - x) ** 2 + (wp.z - z) ** 2;
      if (d < bestD) {
        bestD = d;
        best = wp.id;
      }
    }
    return best;
  }

  function seesPlayer(bot, player, time) {
    if (!player.state.alive) return false;
    const dx = player.state.pos.x - bot.pos.x;
    const dz = player.state.pos.z - bot.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist > BOT.visionRange) return false;
    const fx = -Math.sin(bot.yaw);
    const fz = -Math.cos(bot.yaw);
    const dot = (dx * fx + dz * fz) / Math.max(0.001, dist);
    const halfFov = (BOT.visionFov / 2) * (Math.PI / 180);
    if (dot < Math.cos(halfFov)) return false;
    const eyeA = { x: bot.pos.x, y: 1.5, z: bot.pos.z };
    const eyeB = { x: player.state.pos.x, y: player.state.pos.y + 1.4, z: player.state.pos.z };
    return !map.blocked(eyeA, eyeB);
  }

  function faceToward(bot, x, z, dt) {
    const want = Math.atan2(-(x - bot.pos.x), -(z - bot.pos.z));
    let diff = want - bot.yaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const turn = 6 * dt;
    bot.yaw += Math.max(-turn, Math.min(turn, diff));
  }

  function walkToward(bot, x, z, dt, speed) {
    const dx = x - bot.pos.x;
    const dz = z - bot.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.15) return true;
    const vx = (dx / dist) * speed;
    const vz = (dz / dist) * speed;
    const next = moveAABB(bot.pos, BOT.radius, BOT.height, { x: vx * dt, y: 0, z: vz * dt }, map.colliders);
    const moved = Math.hypot(next.x - bot.pos.x, next.z - bot.pos.z);
    bot.pos = next;
    faceToward(bot, x, z, dt);
    // Stuck against a wall: give up on this waypoint after a second.
    if (moved < speed * dt * 0.25) {
      bot.stuckTimer += dt;
      if (bot.stuckTimer > 1) {
        bot.stuckTimer = 0;
        return true;
      }
    } else {
      bot.stuckTimer = 0;
    }
    return false;
  }

  return {
    list: bots,
    reset(spawns) {
      for (let i = 0; i < bots.length; i += 1) {
        const bot = bots[i];
        const s = spawns[i % spawns.length];
        bot.pos = { x: s.x, y: 0, z: s.z };
        bot.yaw = s.yaw;
        bot.hp = BOT.health;
        bot.alive = true;
        bot.state = 'hold';
        bot.targetWp = bot.home;
        bot.waitUntil = 0;
        bot.reactionUntil = 0;
        bot.burstLeft = 0;
        bot.burstTimer = 0;
        bot.burstPauseUntil = 0;
        bot.alertPos = null;
        bot.alertUntil = 0;
        bot.defuseProgress = 0;
        bot.flashUntil = 0;
        bot.deadAt = 0;
        bot.mesh.visible = true;
        bot.mesh.rotation.set(0, bot.yaw, 0);
        bot.mesh.position.set(bot.pos.x, 0, bot.pos.z);
      }
    },
    aliveCount() {
      return bots.filter((b) => b.alive).length;
    },
    // AABBs for the player's raycasts: body and head per living bot.
    hitboxes() {
      const out = [];
      for (const bot of bots) {
        if (!bot.alive) continue;
        out.push({
          minX: bot.pos.x - BODY_HALF, maxX: bot.pos.x + BODY_HALF,
          minY: bot.pos.y + 0.75, maxY: bot.pos.y + 1.37,
          minZ: bot.pos.z - BODY_HALF, maxZ: bot.pos.z + BODY_HALF,
          tag: { kind: 'bot', bot, part: 'body' },
        });
        out.push({
          minX: bot.pos.x - HEAD_HALF, maxX: bot.pos.x + HEAD_HALF,
          minY: bot.pos.y + 1.41, maxY: bot.pos.y + 1.72,
          minZ: bot.pos.z - HEAD_HALF, maxZ: bot.pos.z + HEAD_HALF,
          tag: { kind: 'bot', bot, part: 'head' },
        });
      }
      return out;
    },
    damage(bot, amount, time) {
      if (!bot.alive) return false;
      bot.hp -= amount;
      bot.flashUntil = time + 0.12;
      bot.defuseProgress = 0; // a hit interrupts a defuse
      if (bot.hp <= 0) {
        bot.hp = 0;
        bot.alive = false;
        bot.deadAt = time;
        bot.mesh.rotation.x = -Math.PI / 2 + 0.12;
        bot.mesh.position.y = 0.25;
        return true;
      }
      return false;
    },
    // A gunshot the bots can hear: defenders inside range turn toward it.
    hear(pos, time) {
      for (const bot of bots) {
        if (!bot.alive) continue;
        const d = Math.hypot(pos.x - bot.pos.x, pos.z - bot.pos.z);
        if (d < BOT.hearRange && bot.state !== 'engage') {
          bot.alertPos = { x: pos.x, z: pos.z };
          bot.alertUntil = time + 4;
        }
      }
    },
    update(dt, ctx) {
      const { player, planted, time } = ctx;
      for (const bot of bots) {
        if (!bot.alive) continue;
        // Hit flash: briefly brighten the body material.
        const flash = time < bot.flashUntil;
        for (const m of bot.mesh.userData.flashables) {
          m.material.emissive.setHex(flash ? 0x881111 : 0x000000);
        }
        const playerVisible = seesPlayer(bot, player, time);
        const playerPos = player.state.pos;

        if (playerVisible && bot.state !== 'engage') {
          bot.state = 'engage';
          bot.reactionUntil = time + rng.range(BOT.reactionMin, BOT.reactionMax);
          bot.burstLeft = 0;
        } else if (!playerVisible && bot.state === 'engage') {
          bot.state = planted ? 'rotate' : 'hold';
          bot.targetWp = bot.home;
        }

        if (planted && bot.state !== 'engage') {
          // A planted charge pulls every defender to its site.
          const site = SITES[planted.site];
          const dSite = Math.hypot(site.center.x - bot.pos.x, site.center.z - bot.pos.z);
          if (dSite < site.radius) {
            bot.state = 'defuse';
          } else {
            bot.state = 'rotate';
            bot.targetWp = nearestWaypoint(site.center.x, site.center.z);
          }
        } else if (bot.state === 'defuse' && !planted) {
          bot.state = 'hold';
        }

        if (bot.state === 'defuse') {
          faceToward(bot, SITES[planted.site].center.x, SITES[planted.site].center.z, dt);
          bot.defuseProgress += dt;
          if (bot.defuseProgress >= DEFUSE_TIME) {
            ctx.onDefused(bot);
            bot.defuseProgress = 0;
          }
        } else if (bot.state === 'engage') {
          faceToward(bot, playerPos.x, playerPos.z, dt);
          // Strafe while fighting, so the player must track a moving target.
          const strafe = Math.sin(time * 1.7 + bot.id * 2.1) > 0 ? 1 : -1;
          const fx = -Math.sin(bot.yaw);
          const fz = -Math.cos(bot.yaw);
          const px = -fz * strafe;
          const pz = fx * strafe;
          const dist = Math.hypot(playerPos.x - bot.pos.x, playerPos.z - bot.pos.z);
          if (dist > 14) {
            walkToward(bot, playerPos.x, playerPos.z, dt, BOT.speed);
          } else if (dist < 5) {
            walkToward(bot, bot.pos.x - fx * 2, bot.pos.z - fz * 2, dt, BOT.speed * 0.7);
          } else {
            const next = moveAABB(bot.pos, BOT.radius, BOT.height, {
              x: px * BOT.strafeSpeed * dt, y: 0, z: pz * BOT.strafeSpeed * dt,
            }, map.colliders);
            bot.pos = next;
          }
          // Burst fire once the reaction time has passed.
          if (time >= bot.reactionUntil) {
            if (bot.burstLeft > 0) {
              bot.burstTimer -= dt;
              if (bot.burstTimer <= 0) {
                bot.burstTimer = BOT.burstInterval;
                bot.burstLeft -= 1;
                const d = Math.hypot(playerPos.x - bot.pos.x, playerPos.z - bot.pos.z);
                let chance = BOT.hitBase - BOT.hitFalloff * Math.max(0, d - 10);
                if (player.state.speed2d > 4) chance -= BOT.hitMovePenalty;
                if (player.state.crouched) chance -= 0.05;
                const hit = rng.chance(Math.max(0.03, chance));
                const head = hit && rng.chance(BOT.headChance);
                ctx.onBotShot(bot, hit, head ? BOT.headDamage : BOT.bodyDamage, head);
              }
            } else if (time >= bot.burstPauseUntil) {
              bot.burstLeft = rng.int(BOT.burstMin, BOT.burstMax);
              bot.burstPauseUntil = time + rng.range(BOT.burstPauseMin, BOT.burstPauseMax);
            }
          }
        } else if (bot.state === 'rotate') {
          const wp = map.waypoints[bot.targetWp];
          const arrived = walkToward(bot, wp.x, wp.z, dt, BOT.speed);
          if (arrived) {
            bot.targetWp = rng.pick(wp.links);
          }
        } else if (bot.state === 'hold') {
          // Cover an angle, scanning slowly; a heard shot pulls the bot over.
          if (bot.alertPos && time < bot.alertUntil) {
            const arrived = walkToward(bot, bot.alertPos.x, bot.alertPos.z, dt, BOT.speed);
            if (arrived) {
              bot.alertPos = null;
              bot.state = 'patrol';
              bot.waitUntil = time + rng.range(1, 3);
            }
          } else {
            bot.scanPhase += dt * 0.5;
            bot.yaw += Math.sin(bot.scanPhase) * 0.35 * dt;
            if (time >= bot.waitUntil && rng.chance(dt * 0.25)) {
              bot.state = 'patrol';
              bot.targetWp = rng.pick(map.waypoints[bot.home].links);
            }
          }
        } else if (bot.state === 'patrol') {
          const wp = map.waypoints[bot.targetWp];
          const arrived = walkToward(bot, wp.x, wp.z, dt, BOT.speed * 0.8);
          if (arrived) {
            if (rng.chance(0.5)) {
              bot.state = 'hold';
              bot.targetWp = bot.home;
              bot.waitUntil = time + rng.range(2, 5);
            } else {
              bot.targetWp = rng.pick(wp.links);
            }
          }
        }

        bot.mesh.position.set(bot.pos.x, bot.mesh.position.y, bot.pos.z);
        if (bot.alive) bot.mesh.rotation.y = bot.yaw;
      }
    },
  };
}
