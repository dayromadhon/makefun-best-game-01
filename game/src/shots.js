// The screenshot scenes behind ?shot=start|play|plant|end. Each one stages the
// real game — same world, same renderer, same HUD — at a fixed moment, so the
// frame is what playing really looks like and the same seed always gives the
// same frame. No pointer lock, no audio, no input: the scene is posed, then
// the sim runs a few steps to settle tracers and bot poses.
import { ECONOMY } from './config.js';

export function stageShot(name, ctx) {
  const { game, player, bots, weapons, combat, hud, rng } = ctx;
  const S = game.state;
  game.setShotMode(true);
  game.startMatch();

  if (name === 'play') {
    // Mid-firefight in the east lane: the player has pushed to mid, a CINDER
    // bot holds the lane ahead, and a shot is in the air.
    S.screen = 'play';
    S.timer = 83;
    player.state.pos = { x: 6, y: 0, z: 6 };
    player.state.yaw = Math.atan2(-(10 - 6), -(-4 - 6));
    player.state.pitch = 0.01;
    player.state.hp = 82;
    player.state.money = 2000;
    player.state.kills = 2;
    player.buyWeapon('k9');
    player.state.ammo.k9 = { mag: 19, reserve: 75 };
    player.state.weapon = 'k9';
    const bot = bots.list[0];
    bot.pos = { x: 10, y: 0, z: -4 };
    bot.yaw = Math.PI;
    bot.state = 'engage';
    bot.mesh.position.set(10, 0, -4);
    bot.mesh.rotation.y = bot.yaw;
    const bot2 = bots.list[1];
    bot2.pos = { x: 13.5, y: 0, z: -9 };
    bot2.yaw = Math.PI * 0.85;
    bot2.mesh.position.set(13.5, 0, -9);
    bot2.mesh.rotation.y = bot2.yaw;
    const eye = player.eye();
    const dir = { x: 0.32, y: 0.02, z: -0.95 };
    const len = Math.hypot(dir.x, dir.y, dir.z);
    dir.x /= len; dir.y /= len; dir.z /= len;
    combat.shootAtBots(eye, dir, 0.004, 70, bots, rng, 0, weapons.muzzleWorld({ x: 0, y: 0, z: 0 }));
    hud.hitmarker(false);
    hud.killFeed('You ▸ Soot  +$300');
    hud.hideBuy();
    hud.hideBanner();
    return;
  }

  if (name === 'plant') {
    // The charge goes down at site A: progress bar mid-way, a defender
    // rotating in through the east door, fuse HUD armed.
    S.screen = 'play';
    S.timer = 41;
    player.state.pos = { x: -17.5, y: 0, z: -8.5 };
    player.state.yaw = -1.45; // facing east, out of the warehouse door
    player.state.pitch = -0.03;
    player.state.hp = 64;
    player.state.armour = true;
    player.state.money = 3200;
    player.state.kills = 3;
    player.buyWeapon('vk47');
    player.state.ammo.vk47 = { mag: 24, reserve: 60 };
    player.state.weapon = 'vk47';
    S.plantProgress = 1.8;
    const bot = bots.list[0];
    bot.pos = { x: -13, y: 0, z: -8.5 };
    bot.yaw = Math.PI / 2;
    bot.state = 'rotate';
    bot.mesh.position.set(-13, 0, -8.5);
    bot.mesh.rotation.y = bot.yaw;
    const bot2 = bots.list[2];
    bot2.pos = { x: -8, y: 0, z: -4 };
    bot2.yaw = Math.PI * 0.7;
    bot2.mesh.position.set(-8, 0, -4);
    bot2.mesh.rotation.y = bot2.yaw;
    hud.killFeed('You ▸ Ash  +$300');
    hud.killFeed('You ▸ Cinder  +$300');
    hud.hideBuy();
    hud.hideBanner();
    return;
  }

  if (name === 'end') {
    // Match won 3–1: the end overlay over the yard at dusk.
    S.screen = 'matchEnd';
    S.scoreEmber = 3;
    S.scoreCinder = 1;
    S.round = 4;
    S.timer = 0;
    player.state.pos = { x: 0, y: 0, z: 6 };
    player.state.yaw = 0.15; // north, into the yard
    player.state.pitch = 0.05;
    player.state.money = 5400;
    player.state.kills = 7;
    hud.setRound(4);
    hud.showMatchEnd(true, 3, 1);
    hud.hideBuy();
    hud.hideBanner();
    return;
  }

  // start (default): buy phase at the south gate, shop open, the yard ahead.
  // Straight down the middle: the mid container block, the lamp and the far
  // wall all read, instead of empty asphalt.
  S.screen = 'buy';
  S.timer = 12;
  player.state.pos = { x: 0, y: 0, z: 13.5 };
  player.state.yaw = 0; // north, down the middle: mid block, lamp, far wall
  player.state.pitch = 0.05;
  player.state.money = ECONOMY.start;
  hud.showBuy(player);
  hud.banner('Round 1', 'Buy phase — press B to close the shop', 'info');
}
