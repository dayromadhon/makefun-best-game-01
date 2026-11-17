// Boot and the one loop: the world advances in fixed 1/60 s steps and the
// renderer paints what is there. The game moves between title, buy, play,
// paused, round end and match end; ?shot=start|play|plant|end (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import * as THREE from 'three';
import { WEAPONS } from './config.js';
import { createRandom } from './rng.js';
import { buildMap } from './map.js';
import { createInput } from './input.js';
import { createPlayer } from './player.js';
import { createWeapons } from './weapons.js';
import { createBots } from './bots.js';
import { createCombat } from './combat.js';
import { createAudio } from './audio.js';
import { createGame } from './game.js';
import { createHud } from './hud.js';
import { stageShot } from './shots.js';

const STEP = 1 / 60;
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);
const rng = createRandom(seed);

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x27364a);
scene.fog = new THREE.Fog(0x2c3a4a, 35, 110);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 200);
camera.rotation.order = 'YXZ';
scene.add(camera);

const hemi = new THREE.HemisphereLight(0x8fa3bf, 0x2a2118, 1.35);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffd9a0, 1.9);
sun.position.set(-18, 26, 12);
scene.add(sun);
// A soft light that rides with the player: it keeps the gun and the ground at
// the player's feet readable, the way a dusk yard's spill light would.
const playerLight = new THREE.PointLight(0xffe0b0, 6, 11, 1.5);
playerLight.position.set(0, 0.3, 0.2);
camera.add(playerLight);

const map = buildMap(scene);
const input = createInput(canvas);
const player = createPlayer(map);
const weapons = createWeapons(camera, scene);
const bots = createBots(scene, map, rng);
const combat = createCombat(scene, map);
const audio = createAudio();
const hud = createHud(document.getElementById('hud'));
const game = createGame({ scene, map, player, bots, weapons, combat, audio, hud, rng });

function snapshot() {
  const S = game.state;
  const def = WEAPONS[player.state.weapon];
  return {
    screen: S.screen,
    hp: player.state.hp,
    armour: player.state.armour,
    money: player.state.money,
    weapon: player.state.weapon,
    ammo: player.state.ammo[player.state.weapon],
    reloading: weapons.reloading,
    timer: S.timer,
    scoreEmber: S.scoreEmber,
    scoreCinder: S.scoreCinder,
    aliveBots: bots.aliveCount(),
    planted: S.planted,
    plantProgress: S.plantProgress,
    defuseProgress: S.defuseProgress,
    spread: weapons.spreadFor(player, def),
  };
}

function paint() {
  const eye = player.eye();
  camera.position.set(eye.x, eye.y, eye.z);
  camera.rotation.y = player.state.yaw;
  camera.rotation.x = player.state.pitch + weapons.recoil;
  hud.update(snapshot(), STEP);
  renderer.render(scene, camera);
}

function runShot(name) {
  stageShot(name, { game, player, bots, weapons, combat, hud, rng });
  let painted = 0;
  function frame() {
    paint();
    painted += 1;
    if (painted < 2) requestAnimationFrame(frame);
    else window.__shotReady = true;
  }
  requestAnimationFrame(frame);
}

function runGame() {
  let accumulator = 0;
  let last = performance.now();
  let now = 0;

  // Overlay clicks are the gestures that start, resume and restart: they
  // unlock audio, take pointer lock, and queue the confirm the sim reads.
  document.querySelectorAll('.overlay').forEach((node) => {
    node.addEventListener('click', () => {
      audio.unlock();
      input.lock();
      input.queueConfirm();
    });
  });

  function frame(t) {
    requestAnimationFrame(frame);
    const dt = Math.min((t - last) / 1000, MAX_FRAME);
    last = t;
    accumulator += dt;
    let steps = 0;
    while (accumulator >= STEP && steps < 5) {
      now += STEP;
      game.update(STEP, input, now);
      accumulator -= STEP;
      steps += 1;
    }
    if (steps === 5) accumulator = 0;
    paint();
  }

  hud.showTitle();
  requestAnimationFrame(frame);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

if (shot) runShot(shot);
else runGame();

// Debug handle for local play-testing (read-only state inspection, plus a
// repaint for staging camera angles in screenshots).
window.__emberline = { game, player, bots, weapons, input, paint };
