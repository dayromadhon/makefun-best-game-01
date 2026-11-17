// The match: one state machine owns the screens, the round flow, the economy
// and the plant/defuse objective. The sim calls update() once per fixed step;
// rendering and the HUD read the state it keeps. EMBER is the player alone,
// CINDER is the three defender bots: first side to 3 round wins takes the match.
import * as THREE from 'three';
import {
  BUY_TIME, DEFUSE_TIME, ECONOMY, FUSE_TIME, GRENADE, KEVLAR_PRICE,
  MATCH_TARGET, MAX_ROUNDS, PLANT_TIME, ROUND_END_PAUSE, ROUND_TIME, WEAPONS,
} from './config.js';

export function createGame(ctx) {
  const { scene, map, player, bots, weapons, combat, audio, hud, rng } = ctx;
  const S = {
    screen: 'title', // title | buy | play | paused | roundEnd | matchEnd
    round: 1,
    scoreEmber: 0,
    scoreCinder: 0,
    timer: BUY_TIME,
    planted: null, // { site, fuse }
    plantProgress: 0,
    defuseProgress: 0,
    roundEndTimer: 0,
    roundEndReason: '',
    roundEndWon: false,
    moneyAward: 0,
    time: 0,
    lockGraceUntil: 0, // after start/resume, the lock has this long to engage
    lastTickSecond: -1,
    beepAt: 0,
  };

  function inSite(pos) {
    for (const key of Object.keys(map.sites)) {
      const site = map.sites[key];
      const d = Math.hypot(pos.x - site.center.x, pos.z - site.center.z);
      if (d < site.radius) return key;
    }
    return null;
  }

  function startRound(n) {
    S.round = n;
    S.timer = BUY_TIME;
    S.planted = null;
    S.plantProgress = 0;
    S.defuseProgress = 0;
    const survived = n > 1 && player.state.alive;
    player.resetRound(map.spawns.player, survived);
    bots.reset(map.spawns.bots);
    S.screen = 'buy';
    hud.showBuy();
    hud.setRound(n);
    hud.banner(`Round ${n}`, 'Buy phase — press B to close the shop', 'info');
  }

  function startMatch() {
    S.scoreEmber = 0;
    S.scoreCinder = 0;
    player.state.money = ECONOMY.start;
    player.reset(map.spawns.player, ECONOMY.start);
    // requestPointerLock resolves asynchronously, so the very next update
    // still sees locked === false; without a grace period the game would
    // pause on the first frame after every start.
    S.lockGraceUntil = S.time + 1.5;
    startRound(1);
    hud.hideTitle();
    hud.hideMatchEnd();
  }

  function endRound(won, reason) {
    if (S.screen !== 'play' && S.screen !== 'buy') return;
    S.screen = 'roundEnd';
    S.roundEndTimer = ROUND_END_PAUSE;
    S.roundEndWon = won;
    S.roundEndReason = reason;
    let award = won ? ECONOMY.win : ECONOMY.loss;
    if (won) S.scoreEmber += 1;
    else S.scoreCinder += 1;
    S.moneyAward = award;
    player.state.money += award;
    hud.hideBuy();
    hud.banner(
      won ? 'Round won' : 'Round lost',
      `${reason}  ·  +$${award}`,
      won ? 'win' : 'lose',
    );
    if (won) audio.roundWin();
    else audio.roundLose();
  }

  function endMatch() {
    S.screen = 'matchEnd';
    const won = S.scoreEmber > S.scoreCinder;
    hud.showMatchEnd(won, S.scoreEmber, S.scoreCinder);
    if (won) audio.roundWin();
    else audio.roundLose();
  }

  function firePlayer(now, triggerHeld, triggerEdge) {
    const shot = weapons.tryFire(now, player, rng, triggerHeld, triggerEdge);
    if (!shot) return;
    if (shot.empty) {
      audio.dryFire();
      hud.setAmmoHint('Empty — press R to reload');
      return;
    }
    audio.shot(shot.weapon);
    bots.hear(player.eye(), now);
    const eye = player.eye();
    const fwd = player.forward();
    const pitch = player.state.pitch;
    const dir = {
      x: fwd.x * Math.cos(pitch),
      y: Math.sin(pitch),
      z: fwd.z * Math.cos(pitch),
    };
    const muzzle = weapons.muzzleWorld({ x: 0, y: 0, z: 0 });
    const res = combat.shootAtBots(eye, dir, shot.spread, shot.def.range, bots, rng, now, muzzle);
    if (res.bot) {
      const killed = bots.damage(res.bot, res.head ? shot.def.head : shot.def.body, now);
      audio.hit();
      hud.hitmarker(killed);
      if (killed) {
        player.state.kills += 1;
        player.state.money += ECONOMY.kill;
        audio.kill();
        hud.killFeed(`You ▸ ${res.bot.name}  +$${ECONOMY.kill}`);
        if (bots.aliveCount() === 0) endRound(true, 'All defenders eliminated');
      }
    }
  }

  function throwGrenade(now) {
    const g = weapons.throwGrenade(player);
    if (!g) {
      audio.denied();
      return;
    }
    audio.grenadePin();
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 10, 8),
      new THREE.MeshLambertMaterial({ color: 0x2e4a2e }),
    );
    mesh.position.set(g.pos.x, g.pos.y, g.pos.z);
    scene.add(mesh);
    combat.addGrenade(g, mesh);
  }

  function grenadeDamage(pos) {
    audio.explosion();
    hud.flashDamage();
    for (const bot of bots.list) {
      if (!bot.alive) continue;
      const d = Math.hypot(bot.pos.x - pos.x, bot.pos.z - pos.z);
      if (d > GRENADE.hurtRadius) continue;
      const dmg = d <= GRENADE.killRadius
        ? GRENADE.maxDamage
        : Math.round(GRENADE.maxDamage * (1 - (d - GRENADE.killRadius) / (GRENADE.hurtRadius - GRENADE.killRadius)));
      const killed = bots.damage(bot, dmg, S.time);
      if (killed) {
        player.state.kills += 1;
        player.state.money += ECONOMY.kill;
        audio.kill();
        hud.killFeed(`You ▸ ${bot.name} (grenade)  +$${ECONOMY.kill}`);
        if (bots.aliveCount() === 0) endRound(true, 'All defenders eliminated');
      }
    }
    const pd = Math.hypot(player.state.pos.x - pos.x, player.state.pos.z - pos.z);
    if (pd <= GRENADE.hurtRadius && player.state.alive) {
      const dmg = pd <= GRENADE.killRadius
        ? GRENADE.maxDamage
        : Math.round(GRENADE.maxDamage * (1 - (pd - GRENADE.killRadius) / (GRENADE.hurtRadius - GRENADE.killRadius)));
      const died = player.damage(Math.round(dmg * GRENADE.selfFactor));
      if (died) endRound(false, 'Caught by your own grenade');
    }
  }

  function buy(key) {
    if (S.screen !== 'buy') return false;
    let ok = false;
    if (key === 'grenade') ok = player.buyGrenade();
    else if (key === 'armour') ok = player.buyArmour();
    else if (WEAPONS[key]) ok = player.buyWeapon(key);
    if (ok) {
      audio.buy();
      hud.refreshBuy(player);
    } else {
      audio.denied();
    }
    return ok;
  }

  return {
    state: S,
    startMatch,
    startRound,
    buy,
    update(dt, input, now) {
      S.time = now;
      const actions = input.takeActions();
      const mouse = input.takeMouse();

      if (actions & 32) { // ACTION_MUTE
        const muted = audio.toggleMute();
        hud.setMute(muted);
      }

      if (S.screen === 'title') {
        if (actions & 1) { // ACTION_CONFIRM
          audio.unlock();
          input.lock();
          startMatch();
        }
        return;
      }

      if (S.screen === 'matchEnd') {
        if (actions & 1) {
          audio.unlock();
          input.lock();
          startMatch();
        }
        return;
      }

      if (S.screen === 'paused') {
        if ((actions & 2) || (actions & 1)) { // PAUSE or CONFIRM resumes
          S.screen = S.pausedFrom || 'play';
          hud.hidePause();
          input.lock();
          S.lockGraceUntil = S.time + 1.5; // same first-frame race as start
        }
        return;
      }

      // Pause from play or buy, or when pointer lock is lost mid-round.
      // The grace period after a start/resume is honoured so a still-pending
      // lock request does not pause the game on the first frame.
      if ((actions & 2) || ((S.screen === 'play' || S.screen === 'buy') && !input.locked && !S.shotMode && now > S.lockGraceUntil)) {
        if (S.screen === 'play' || S.screen === 'buy') {
          S.pausedFrom = S.screen;
          S.screen = 'paused';
          hud.showPause();
          input.unlock();
          return;
        }
      }

      // Look and move in buy and play.
      if (input.locked) player.look(mouse.dx, mouse.dy);
      const move = input.move();
      player.update(dt, {
        x: move.x, z: move.z,
        slow: input.slow, crouch: input.crouch,
      }, input.jump);

      if (actions & 16) { // ACTION_BUY
        if (S.screen === 'buy') hud.toggleBuy();
      }
      // Number keys buy during the buy phase and switch weapons in play.
      // (buy() returns false when already owned or unaffordable; switching
      // then only takes effect for weapons the player already owns.)
      if (S.screen === 'buy') {
        if (actions & 64) { if (!buy('p9')) player.switchWeapon('p9'); }
        if (actions & 128) { if (!buy('k9')) player.switchWeapon('k9'); }
        if (actions & 256) { if (!buy('vk47')) player.switchWeapon('vk47'); }
        if (actions & 512) buy('grenade');
        if (actions & 1024) buy('armour');
      } else {
        if (actions & 64) player.switchWeapon('p9');
        if (actions & 128) player.switchWeapon('k9');
        if (actions & 256) player.switchWeapon('vk47');
      }
      if (actions & 4) { // ACTION_RELOAD
        if (weapons.startReload(now, player)) audio.reload();
      }
      if (actions & 8) throwGrenade(now); // ACTION_GRENADE

      const reloaded = weapons.update(now, player);
      if (reloaded) hud.setAmmoHint('');

      if (S.screen === 'buy') {
        S.timer -= dt;
        const sec = Math.ceil(S.timer);
        if (sec !== S.lastTickSecond) {
          S.lastTickSecond = sec;
          if (sec <= 5 && sec > 0) audio.tick();
        }
        if (S.timer <= 0) {
          S.screen = 'play';
          S.timer = ROUND_TIME;
          hud.hideBuy();
          hud.banner('Go!', 'Plant the charge at A or B — or clear the site', 'info');
        }
        return;
      }

      if (S.screen === 'roundEnd') {
        S.roundEndTimer -= dt;
        if (S.roundEndTimer <= 0) {
          hud.hideBanner();
          if (S.scoreEmber >= MATCH_TARGET || S.scoreCinder >= MATCH_TARGET || S.round >= MAX_ROUNDS) {
            endMatch();
          } else {
            startRound(S.round + 1);
          }
        }
        return;
      }

      if (S.screen !== 'play') return;

      // --- Play -------------------------------------------------------------
      S.timer -= dt;
      const sec = Math.ceil(S.timer);
      if (sec !== S.lastTickSecond) {
        S.lastTickSecond = sec;
        if (sec <= 5 && sec > 0) audio.tick();
      }

      // Firing: semi-auto needs a fresh click (triggerEdge), auto holds.
      const triggerHeld = input.firing;
      const triggerEdge = triggerHeld && !S.wasFiring;
      S.wasFiring = triggerHeld;
      if (triggerHeld || triggerEdge) firePlayer(now, triggerHeld, triggerEdge);

      // Planting: hold E inside a site, unplanted.
      const site = inSite(player.state.pos);
      if (!S.planted && site && input.plantHeld && player.state.alive) {
        S.plantProgress += dt;
        if (S.time >= S.beepAt) {
          audio.plantBeep();
          S.beepAt = S.time + 0.5;
        }
        if (S.plantProgress >= PLANT_TIME) {
          S.planted = { site, fuse: FUSE_TIME };
          S.plantProgress = 0;
          player.state.money += ECONOMY.plant;
          audio.planted();
          hud.killFeed(`Charge planted at ${site}  +$${ECONOMY.plant}`);
          hud.banner('Charge planted!', `Defend it — detonation in ${FUSE_TIME}s`, 'win');
        }
      } else {
        S.plantProgress = Math.max(0, S.plantProgress - dt * 2);
      }

      // Fuse countdown once planted.
      if (S.planted) {
        S.planted.fuse -= dt;
        if (S.planted.fuse <= 0) {
          endRound(true, 'Charge detonated');
          return;
        }
      }

      // Defuse progress: the furthest along of any living bot.
      let maxDefuse = 0;
      for (const bot of bots.list) {
        if (bot.alive) maxDefuse = Math.max(maxDefuse, bot.defuseProgress);
      }
      S.defuseProgress = maxDefuse;

      // Bots act.
      bots.update(dt, {
        player,
        planted: S.planted,
        time: now,
        onBotShot: (bot, hit, damage, head) => {
          const eye = player.eye();
          combat.botTracer(bot, {
            x: eye.x + (hit ? 0 : (rng.next() - 0.5) * 2),
            y: eye.y + (hit ? 0 : (rng.next() - 0.5) * 1.5),
            z: eye.z + (hit ? 0 : (rng.next() - 0.5) * 2),
          }, now);
          audio.enemyShot();
          if (hit && player.state.alive) {
            const died = player.damage(damage);
            audio.hurt();
            hud.flashDamage();
            if (died) {
              hud.killFeed(`${bot.name} ▸ You`);
              endRound(false, 'Eliminated');
            }
          }
        },
        onDefused: () => {
          endRound(false, 'Charge defused');
        },
      });

      combat.update(dt, now, (pos) => grenadeDamage(pos));

      if (S.timer <= 0 && !S.planted) {
        endRound(false, 'Time expired — no plant');
      }
    },
    // Shot mode: the game is staged, not played; the HUD reads this state.
    setShotMode(on) {
      S.shotMode = on;
    },
  };
}
