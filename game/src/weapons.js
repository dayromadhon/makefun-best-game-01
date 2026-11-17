// Weapons: the player's side of the gunfight. Firing is hitscan with spread and
// recoil; the view model is a simple gun shape parented to the camera, with a
// muzzle flash light. Grenades are thrown physics objects, handled by combat.
import * as THREE from 'three';
import { GRENADE, WEAPONS } from './config.js';

export function createWeapons(camera, scene) {
  // The view model: a dark gun body, a barrel and a sight, close to the lens.
  const gun = new THREE.Group();
  const gunMat = new THREE.MeshLambertMaterial({ color: 0x565d66 });
  const accentMat = new THREE.MeshLambertMaterial({ color: 0xf0a830 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.14, 0.42), gunMat);
  const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.3), gunMat);
  barrel.position.set(0, 0.03, -0.32);
  const sight = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.05, 0.06), accentMat);
  sight.position.set(0, 0.1, -0.12);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.18, 0.1), gunMat);
  grip.position.set(0, -0.14, 0.12);
  grip.rotation.x = 0.3;
  gun.add(body, barrel, sight, grip);
  gun.position.set(0.34, -0.32, -0.6);
  gun.scale.setScalar(0.55);
  camera.add(gun);

  const flash = new THREE.PointLight(0xffc46b, 0, 9, 2);
  flash.position.set(0.34, -0.26, -1.05);
  camera.add(flash);

  let lastShotAt = -10;
  let reloadingUntil = -1;
  let reloadingWeapon = null;
  let recoil = 0; // pitch kick still to recover, in radians
  let flashUntil = -1;

  function muzzleWorld(out) {
    // The muzzle in world space, for tracers.
    const p = new THREE.Vector3(0.34, -0.3, -0.95);
    camera.localToWorld(p);
    out.x = p.x;
    out.y = p.y;
    out.z = p.z;
    return out;
  }

  return {
    viewModel: gun,
    get recoil() {
      return recoil;
    },
    get reloading() {
      return reloadingWeapon !== null;
    },
    get flashOn() {
      return flashUntil > 0;
    },
    // Spread now, in radians: still and slow is tight, sprinting is wild.
    spreadFor(player, def) {
      const moving = player.state.speed2d / 5.2;
      const base = def.spreadStill + (def.spreadMove - def.spreadStill) * Math.min(1, moving);
      const crouch = player.state.crouched ? 0.75 : 1;
      const slow = player.state.speed2d < 2.7 ? 0.85 : 1;
      return base * crouch * slow;
    },
    // Try to fire. Returns a shot description or null (empty, reloading,
    // semi-auto already fired this press, or the interval has not passed).
    tryFire(now, player, rng, triggerHeld, triggerEdge) {
      const def = WEAPONS[player.state.weapon];
      const ammo = player.state.ammo[player.state.weapon];
      if (reloadingWeapon) return null;
      if (!def.auto && !triggerEdge) return null;
      if (now - lastShotAt < def.interval) return null;
      if (ammo.mag <= 0) return { empty: true, weapon: def.key };
      ammo.mag -= 1;
      lastShotAt = now;
      recoil = Math.min(0.09, recoil + def.kick);
      flashUntil = now + 0.05;
      return { weapon: def.key, def, spread: this.spreadFor(player, def) };
    },
    startReload(now, player) {
      if (reloadingWeapon) return false;
      const def = WEAPONS[player.state.weapon];
      const ammo = player.state.ammo[player.state.weapon];
      if (ammo.mag >= def.mag || ammo.reserve <= 0) return false;
      reloadingWeapon = player.state.weapon;
      reloadingUntil = now + def.reload;
      return true;
    },
    // Returns the weapon key when a reload finishes this step.
    update(now, player) {
      if (reloadingWeapon && now >= reloadingUntil) {
        const def = WEAPONS[reloadingWeapon];
        const ammo = player.state.ammo[reloadingWeapon];
        const need = def.mag - ammo.mag;
        const take = Math.min(need, ammo.reserve);
        ammo.mag += take;
        ammo.reserve -= take;
        const done = reloadingWeapon;
        reloadingWeapon = null;
        return done;
      }
      recoil = Math.max(0, recoil - 0.35 * 0.016);
      flash.intensity = now < flashUntil ? 26 : 0;
      gun.position.z = -0.5 + recoil * 1.2;
      gun.rotation.x = recoil * 0.6;
      return null;
    },
    cancelReload() {
      reloadingWeapon = null;
    },
    throwGrenade(player) {
      if (player.state.grenades <= 0) return null;
      player.state.grenades -= 1;
      const eye = player.eye();
      const fwd = player.forward();
      return {
        pos: { x: eye.x, y: eye.y - 0.1, z: eye.z },
        vel: {
          x: fwd.x * GRENADE.throwSpeed,
          y: 3.5 + Math.sin(player.state.pitch) * GRENADE.throwSpeed,
          z: fwd.z * GRENADE.throwSpeed,
        },
        fuse: GRENADE.fuse,
        bounced: false,
      };
    },
    muzzleWorld,
  };
}
