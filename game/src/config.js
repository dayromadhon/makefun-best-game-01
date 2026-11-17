// EMBERLINE configuration: every number the game tunes lives here, so a balance
// change is one edit, never a hunt through the sim. Yard 7 is a container yard at
// dusk; EMBER (the player, amber) attacks, CINDER (blue) defends two bombsites.
export const PALETTE = {
  sky: 0x27364a,
  fog: 0x2c3a4a,
  ground: 0x33363c,
  groundLine: 0xd8c95a,
  wall: 0x3a3f46,
  wallTop: 0x4a5058,
  containerAmber: 0x8a5a22,
  containerRust: 0x7a3b2e,
  containerTeal: 0x2e5a66,
  containerGrey: 0x565d66,
  crate: 0x6b5a34,
  barrel: 0x5a2e2e,
  siteA: 0xf0a830,
  siteB: 0x4fa8c9,
  ember: 0xf0a830,
  cinder: 0x4fa8c9,
  danger: 0xe5484d,
  ink: 0xece7db,
  muted: 0x8b959e,
};

export const ARENA = { halfX: 23, halfZ: 17, wallHeight: 5 };

// Round and match structure.
export const ROUND_TIME = 100; // seconds of play after the buy phase
export const BUY_TIME = 15; // seconds the buy phase lasts
export const FUSE_TIME = 35; // seconds from plant to detonation
export const PLANT_TIME = 3; // seconds holding E inside a site to plant
export const DEFUSE_TIME = 5; // seconds a defender must hold at a planted site
export const MATCH_TARGET = 3; // first side to this many round wins takes the match
export const MAX_ROUNDS = 5; // the match never runs longer than this
export const ROUND_END_PAUSE = 4; // seconds the round banner stays up

// Economy. Money is per player; the round awards land at round end.
export const ECONOMY = {
  start: 800,
  kill: 300,
  win: 3250,
  loss: 1900,
  plant: 300,
};

// Weapons: hitscan, head shots pay double-ish. Prices are buy-menu prices;
// the pistol is owned from the first round.
export const WEAPONS = {
  p9: {
    key: 'p9', name: 'P9 Sidearm', price: 0,
    mag: 12, reserve: 36, interval: 0.22, reload: 1.4,
    body: 26, head: 78, spreadStill: 0.004, spreadMove: 0.03,
    auto: false, kick: 0.011, range: 60,
  },
  k9: {
    key: 'k9', name: 'K9 Ripper SMG', price: 1500,
    mag: 25, reserve: 100, interval: 0.075, reload: 1.6,
    body: 22, head: 66, spreadStill: 0.006, spreadMove: 0.04,
    auto: true, kick: 0.007, range: 55,
  },
  vk47: {
    key: 'vk47', name: 'VK-47 Longshot', price: 2700,
    mag: 30, reserve: 90, interval: 0.1, reload: 1.9,
    body: 34, head: 100, spreadStill: 0.0022, spreadMove: 0.028,
    auto: true, kick: 0.014, range: 70,
  },
};

export const GRENADE = {
  price: 300, fuse: 1.6, killRadius: 3.5, hurtRadius: 7,
  maxDamage: 120, throwSpeed: 13, selfFactor: 0.5,
};

export const KEVLAR_PRICE = 650;

// The player.
export const PLAYER = {
  health: 100,
  walkSpeed: 5.2,
  slowSpeed: 2.6, // Shift: walk slow, steadier aim
  crouchSpeed: 2.4,
  accelGround: 42,
  accelAir: 9,
  friction: 9,
  gravity: 20,
  jumpSpeed: 7.2,
  eyeHeight: 1.62,
  eyeCrouch: 1.15,
  radius: 0.42, // half-width of the player's AABB
  height: 1.75,
};

// Defender bots. Their rifles are weaker than the player's on purpose: three
// bots against one player must feel fair, not like a firing squad.
export const BOT = {
  count: 3,
  names: ['Ash', 'Cinder', 'Soot'],
  health: 100,
  speed: 3.4,
  strafeSpeed: 2.2,
  bodyDamage: 12,
  headDamage: 36,
  headChance: 0.15,
  burstMin: 3,
  burstMax: 5,
  burstInterval: 0.11,
  burstPauseMin: 0.9,
  burstPauseMax: 1.4,
  reactionMin: 0.35,
  reactionMax: 0.7,
  visionRange: 45,
  visionFov: 100, // degrees, total cone
  hearRange: 30,
  hitBase: 0.34, // hit chance at 10 m, standing still target
  hitFalloff: 0.011, // chance lost per extra metre
  hitMovePenalty: 0.16, // chance lost when the target sprints
  radius: 0.42,
  height: 1.75,
};

// Bombsites: centre on the ground, radius the player must stand inside to plant.
export const SITES = {
  A: { letter: 'A', center: { x: -17.5, z: -8.5 }, radius: 4.2 },
  B: { letter: 'B', center: { x: 17.5, z: 8.5 }, radius: 4.2 },
};

// Spawns: EMBER enters from the south gate, CINDER holds the north side.
export const SPAWNS = {
  // Forward is (-sin yaw, -cos yaw): yaw 0 looks north (-z), toward the
  // sites; yaw PI looks south (+z), toward the gate.
  player: { x: 0, z: 14.5, yaw: 0 }, // facing north, into the yard
  bots: [
    { x: -14, z: -12, yaw: Math.PI },
    { x: 2, z: -13.5, yaw: Math.PI },
    { x: 15, z: -11, yaw: Math.PI },
  ],
};
