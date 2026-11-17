// The player: a first-person body with a position, a view direction, health and
// armour, and a small armoury. Movement is axis-separated AABB sliding against
// the map's colliders; the camera sits at eye height above the feet.
import { PLAYER, WEAPONS } from './config.js';
import { moveAABB } from './map.js';

export function createPlayer(map) {
  const state = {
    pos: { x: 0, y: 0, z: 14.5 },
    vel: { x: 0, y: 0, z: 0 },
    yaw: 0, // facing north, into the yard (forward is (-sin yaw, -cos yaw))
    pitch: 0,
    hp: PLAYER.health,
    armour: false,
    alive: true,
    onGround: true,
    crouched: false,
    money: 0,
    owned: { p9: true, k9: false, vk47: false },
    weapon: 'p9',
    ammo: {
      p9: { mag: WEAPONS.p9.mag, reserve: WEAPONS.p9.reserve },
      k9: { mag: 0, reserve: 0 },
      vk47: { mag: 0, reserve: 0 },
    },
    grenades: 0,
    kills: 0,
    speed2d: 0, // horizontal speed, for spread and the HUD
  };

  function eyeHeight() {
    return state.crouched ? PLAYER.eyeCrouch : PLAYER.eyeHeight;
  }

  return {
    state,
    reset(spawn, money) {
      state.pos = { x: spawn.x, y: 0, z: spawn.z };
      state.vel = { x: 0, y: 0, z: 0 };
      state.yaw = spawn.yaw;
      state.pitch = 0;
      state.hp = PLAYER.health;
      state.armour = false;
      state.alive = true;
      state.onGround = true;
      state.crouched = false;
      state.money = money;
      state.owned = { p9: true, k9: false, vk47: false };
      state.weapon = 'p9';
      state.ammo = {
        p9: { mag: WEAPONS.p9.mag, reserve: WEAPONS.p9.reserve },
        k9: { mag: 0, reserve: 0 },
        vk47: { mag: 0, reserve: 0 },
      };
      state.grenades = 0;
      state.kills = 0;
      state.speed2d = 0;
    },
    // A fresh round keeps the bought weapons of a survivor; a dead player
    // drops back to the pistol with no armour.
    resetRound(spawn, survived) {
      state.pos = { x: spawn.x, y: 0, z: spawn.z };
      state.vel = { x: 0, y: 0, z: 0 };
      state.yaw = spawn.yaw;
      state.pitch = 0;
      state.hp = PLAYER.health;
      state.alive = true;
      state.onGround = true;
      state.crouched = false;
      state.grenades = 0;
      state.speed2d = 0;
      if (!survived) {
        state.armour = false;
        state.owned = { p9: true, k9: false, vk47: false };
        state.weapon = 'p9';
        state.ammo = {
          p9: { mag: WEAPONS.p9.mag, reserve: WEAPONS.p9.reserve },
          k9: { mag: 0, reserve: 0 },
          vk47: { mag: 0, reserve: 0 },
        };
      } else {
        const def = WEAPONS[state.weapon];
        state.ammo[state.weapon] = { mag: def.mag, reserve: def.reserve };
      }
    },
    eye() {
      return { x: state.pos.x, y: state.pos.y + eyeHeight(), z: state.pos.z };
    },
    look(dx, dy) {
      state.yaw -= dx * 0.0022;
      state.pitch -= dy * 0.0022;
      const lim = Math.PI / 2 - 0.01;
      if (state.pitch > lim) state.pitch = lim;
      if (state.pitch < -lim) state.pitch = -lim;
    },
    // Forward on the ground plane for the current yaw.
    forward() {
      return { x: -Math.sin(state.yaw), z: -Math.cos(state.yaw) };
    },
    right() {
      return { x: Math.cos(state.yaw), z: -Math.sin(state.yaw) };
    },
    update(dt, move, wantJump) {
      if (!state.alive) return;
      state.crouched = move.crouch;
      const speed = state.crouched
        ? PLAYER.crouchSpeed
        : move.slow ? PLAYER.slowSpeed : PLAYER.walkSpeed;
      const fwd = this.forward();
      const rgt = this.right();
      const wishX = fwd.x * -move.z + rgt.x * move.x;
      const wishZ = fwd.z * -move.z + rgt.z * move.x;
      const accel = state.onGround ? PLAYER.accelGround : PLAYER.accelAir;
      state.vel.x += wishX * accel * dt;
      state.vel.z += wishZ * accel * dt;
      // Friction when no wish direction: stop cleanly instead of sliding.
      if (move.x === 0 && move.z === 0 && state.onGround) {
        const f = Math.max(0, 1 - PLAYER.friction * dt);
        state.vel.x *= f;
        state.vel.z *= f;
      }
      const hSpeed = Math.hypot(state.vel.x, state.vel.z);
      if (hSpeed > speed) {
        state.vel.x = (state.vel.x / hSpeed) * speed;
        state.vel.z = (state.vel.z / hSpeed) * speed;
      }
      state.vel.y -= PLAYER.gravity * dt;
      if (wantJump && state.onGround) {
        state.vel.y = PLAYER.jumpSpeed;
        state.onGround = false;
      }
      const next = moveAABB(state.pos, PLAYER.radius, PLAYER.height, {
        x: state.vel.x * dt,
        y: state.vel.y * dt,
        z: state.vel.z * dt,
      }, map.colliders);
      // Landed on the ground or a box top.
      if (next.y <= 0) {
        next.y = 0;
        state.vel.y = 0;
        state.onGround = true;
      } else if (next.y < state.pos.y && state.vel.y < 0) {
        state.vel.y = 0;
        state.onGround = true;
      } else if (next.y === state.pos.y && state.vel.y <= 0 && state.pos.y > 0) {
        state.onGround = true;
      }
      state.pos = next;
      state.speed2d = Math.hypot(state.vel.x, state.vel.z);
    },
    // Damage, with Kevlar absorbing half. Returns true when this kills.
    damage(amount) {
      if (!state.alive) return false;
      let rest = amount;
      if (state.armour) rest = Math.ceil(amount / 2);
      state.hp -= rest;
      if (state.hp <= 0) {
        state.hp = 0;
        state.alive = false;
        return true;
      }
      return false;
    },
    buyWeapon(key) {
      const def = WEAPONS[key];
      if (!def || state.owned[key]) return false;
      if (state.money < def.price) return false;
      state.money -= def.price;
      state.owned[key] = true;
      state.ammo[key] = { mag: def.mag, reserve: def.reserve };
      state.weapon = key;
      return true;
    },
    buyGrenade() {
      if (state.money < 300 || state.grenades >= 2) return false;
      state.money -= 300;
      state.grenades += 1;
      return true;
    },
    buyArmour() {
      if (state.armour || state.money < 650) return false;
      state.money -= 650;
      state.armour = true;
      return true;
    },
    switchWeapon(key) {
      if (state.owned[key]) state.weapon = key;
    },
  };
}
