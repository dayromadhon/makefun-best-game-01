// The HUD: a DOM overlay over the 3D canvas. Everything the player needs to
// read at a glance — health, ammo, money, timer, score, bomb status — plus the
// title screen, buy menu, banners and overlays. The sim calls update() every
// frame with a snapshot; events (kills, banners) go through their own methods.
import { GRENADE, KEVLAR_PRICE, WEAPONS } from './config.js';

function el(tag, cls, parent, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  if (parent) parent.appendChild(node);
  return node;
}

export function createHud(root) {
  const hud = el('div', 'hud', root);
  const crosshair = el('div', 'crosshair', hud);
  el('div', 'ch-dot', crosshair);
  for (const cls of ['ch-t', 'ch-b', 'ch-l', 'ch-r']) el('div', cls, crosshair);
  const hitmarker = el('div', 'hitmarker', hud);
  hitmarker.textContent = '✕';
  const vignette = el('div', 'vignette', hud);

  const topLeft = el('div', 'panel top-left', hud);
  const healthRow = el('div', 'row', topLeft);
  el('span', 'label', healthRow, 'HP');
  const healthBar = el('div', 'bar', healthRow);
  const healthFill = el('div', 'fill', healthBar);
  const healthNum = el('span', 'num', healthRow, '100');
  const armourRow = el('div', 'row', topLeft);
  const armourTag = el('span', 'label', armourRow, 'KEVLAR');
  armourTag.style.display = 'none';
  const moneyRow = el('div', 'row', topLeft);
  el('span', 'label', moneyRow, '$');
  const moneyNum = el('span', 'num money', moneyRow, '800');

  const topCenter = el('div', 'panel top-center', hud);
  const timerEl = el('div', 'timer', topCenter, '1:40');
  const scoreEl = el('div', 'score', topCenter, 'EMBER 0 — 0 CINDER');
  const roundEl = el('div', 'round', topCenter, 'ROUND 1 / 5');

  const topRight = el('div', 'panel top-right', hud);
  const aliveRow = el('div', 'alive', topRight);
  el('span', 'label', aliveRow, 'EMBER');
  const emberDots = el('span', 'dots', aliveRow, '●');
  el('span', 'label', aliveRow, 'CINDER');
  const cinderDots = el('span', 'dots', aliveRow, '●●●');
  const feed = el('div', 'feed', topRight);

  const bottomRight = el('div', 'panel bottom-right', hud);
  const weaponEl = el('div', 'weapon', bottomRight, 'P9 Sidearm');
  const ammoEl = el('div', 'ammo', bottomRight, '12 / 36');
  const ammoHint = el('div', 'hint', bottomRight, '');

  const bottomLeft = el('div', 'panel bottom-left', hud);
  const bombEl = el('div', 'bomb', bottomLeft, 'Charge: carry it to A or B');
  const progressWrap = el('div', 'progress-wrap', bottomLeft);
  const progressLabel = el('div', 'progress-label', progressWrap, '');
  const progressBar = el('div', 'bar', progressWrap);
  const progressFill = el('div', 'fill amber', progressBar);
  progressWrap.style.display = 'none';

  const bannerEl = el('div', 'banner', hud);
  const bannerTitle = el('div', 'banner-title', bannerEl, '');
  const bannerSub = el('div', 'banner-sub', bannerEl, '');
  bannerEl.style.display = 'none';

  const buyEl = el('div', 'buy', hud);
  el('div', 'buy-title', buyEl, 'BUY — press number keys, B closes');
  const buyList = el('div', 'buy-list', buyEl);
  buyEl.style.display = 'none';

  const titleEl = el('div', 'overlay title', hud);
  el('div', 'game-name', titleEl, 'EMBERLINE');
  el('div', 'game-sub', titleEl, 'Solo breach · Yard 7 · first to 3 rounds');
  el('div', 'game-desc', titleEl,
    'You are the EMBER operative. Three CINDER defenders hold the yard. ' +
    'Plant the charge at site A or B and defend it until it blows — or clear every defender.');
  const controls = el('div', 'controls', titleEl);
  controls.innerHTML =
    '<b>WASD</b> move · <b>Mouse</b> aim · <b>Click</b> fire · <b>R</b> reload · <b>G</b> grenade<br>' +
    '<b>E</b> hold to plant · <b>B</b> buy · <b>1/2/3</b> weapons · <b>Shift</b> slow aim · <b>Ctrl</b> crouch<br>' +
    '<b>Space</b> jump · <b>P</b> pause · <b>M</b> mute';
  el('div', 'click-start', titleEl, 'Click to start');

  const pauseEl = el('div', 'overlay pause', hud);
  el('div', 'game-name small', pauseEl, 'PAUSED');
  el('div', 'click-start', pauseEl, 'Click or press P to resume');
  pauseEl.style.display = 'none';

  const endEl = el('div', 'overlay end', hud);
  const endTitle = el('div', 'game-name', endEl, '');
  const endScore = el('div', 'game-sub', endEl, '');
  el('div', 'click-start', endEl, 'Click to play again');
  endEl.style.display = 'none';

  const muteTag = el('div', 'mute-tag', hud, 'MUTED');
  muteTag.style.display = 'none';

  let hitTimer = 0;
  let flashTimer = 0;

  function fmtTime(seconds) {
    const s = Math.max(0, Math.ceil(seconds));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  function renderBuy(player) {
    buyList.innerHTML = '';
    const rows = [];
    for (const key of Object.keys(WEAPONS)) {
      const w = WEAPONS[key];
      rows.push({
        key: key === 'p9' ? '1' : key === 'k9' ? '2' : '3',
        name: w.name,
        price: w.price === 0 ? 'owned' : `$${w.price}`,
        owned: player.state.owned[key],
        current: player.state.weapon === key,
      });
    }
    rows.push({ key: '4', name: `HE Grenade (have ${player.state.grenades})`, price: `$${GRENADE.price}`, owned: false, current: false });
    rows.push({ key: '5', name: 'Kevlar vest', price: `$${KEVLAR_PRICE}`, owned: player.state.armour, current: false });
    for (const row of rows) {
      const div = el('div', `buy-row${row.current ? ' current' : ''}${row.owned ? ' owned' : ''}`, buyList);
      el('span', 'buy-key', div, row.key);
      el('span', 'buy-name', div, row.name);
      el('span', 'buy-price', div, row.owned ? 'OWNED' : row.price);
    }
    el('div', 'buy-money', buyList, `Money: $${player.state.money}`);
  }

  return {
    showTitle() { titleEl.style.display = 'flex'; },
    hideTitle() { titleEl.style.display = 'none'; },
    showBuy(player) {
      buyEl.style.display = 'block';
      if (player) renderBuy(player);
    },
    hideBuy() { buyEl.style.display = 'none'; },
    toggleBuy() {
      buyEl.style.display = buyEl.style.display === 'none' ? 'block' : 'none';
    },
    refreshBuy(player) { renderBuy(player); },
    banner(title, sub, kind) {
      bannerTitle.textContent = title;
      bannerSub.textContent = sub || '';
      bannerEl.className = `banner ${kind || ''}`;
      bannerEl.style.display = 'block';
    },
    hideBanner() { bannerEl.style.display = 'none'; },
    showPause() { pauseEl.style.display = 'flex'; },
    hidePause() { pauseEl.style.display = 'none'; },
    showMatchEnd(won, e, c) {
      endTitle.textContent = won ? 'EMBERLINE WON' : 'CINDER WINS';
      endTitle.style.color = won ? '#f0a830' : '#4fa8c9';
      endScore.textContent = `Final score — EMBER ${e} · ${c} CINDER`;
      endEl.style.display = 'flex';
    },
    hideMatchEnd() { endEl.style.display = 'none'; },
    killFeed(text) {
      const div = el('div', 'feed-item', feed, text);
      setTimeout(() => div.remove(), 6000);
      while (feed.children.length > 5) feed.firstChild.remove();
    },
    hitmarker(kill) {
      hitmarker.className = kill ? 'hitmarker kill' : 'hitmarker';
      hitmarker.style.opacity = '1';
      hitTimer = 0.18;
    },
    flashDamage() {
      vignette.style.opacity = '0.85';
      flashTimer = 0.5;
    },
    setAmmoHint(text) { ammoHint.textContent = text; },
    setMute(muted) { muteTag.style.display = muted ? 'block' : 'none'; },
    setRound(n) { roundEl.textContent = `ROUND ${n} / 5`; },
    update(s, dt) {
      // Crosshair: gap grows with spread, hidden on menus.
      const inGame = s.screen === 'play' || s.screen === 'buy';
      crosshair.style.display = inGame ? 'block' : 'none';
      const gap = 6 + (s.spread || 0.004) * 900;
      crosshair.style.setProperty('--gap', `${gap.toFixed(1)}px`);
      if (hitTimer > 0) {
        hitTimer -= dt;
        if (hitTimer <= 0) hitmarker.style.opacity = '0';
      }
      if (flashTimer > 0) {
        flashTimer -= dt;
        vignette.style.opacity = String(Math.max(0, flashTimer * 1.7));
      }
      healthFill.style.width = `${s.hp}%`;
      healthFill.style.background = s.hp <= 30 ? '#e5484d' : '#f0a830';
      healthNum.textContent = String(s.hp);
      armourTag.style.display = s.armour ? 'inline' : 'none';
      moneyNum.textContent = String(s.money);
      timerEl.textContent = fmtTime(s.timer);
      timerEl.style.color = s.timer <= 10 && s.screen === 'play' ? '#e5484d' : '#ece7db';
      scoreEl.textContent = `EMBER ${s.scoreEmber} — ${s.scoreCinder} CINDER`;
      emberDots.textContent = '●';
      cinderDots.textContent = '●'.repeat(Math.max(0, s.aliveBots));
      const w = WEAPONS[s.weapon];
      weaponEl.textContent = w ? w.name : '';
      ammoEl.textContent = `${s.ammo.mag} / ${s.ammo.reserve}`;
      if (s.reloading) ammoEl.textContent += '  …';
      if (s.planted) {
        bombEl.textContent = `Charge at ${s.planted.site} — detonation in ${Math.ceil(s.planted.fuse)}s`;
        bombEl.style.color = '#e5484d';
      } else {
        bombEl.textContent = 'Charge: carry it to A or B';
        bombEl.style.color = '#ece7db';
      }
      if (s.plantProgress > 0) {
        progressWrap.style.display = 'block';
        progressLabel.textContent = 'PLANTING… hold E';
        progressFill.style.width = `${Math.min(100, (s.plantProgress / 3) * 100)}%`;
      } else if (s.defuseProgress > 0) {
        progressWrap.style.display = 'block';
        progressLabel.textContent = 'DEFUSE IN PROGRESS — stop them!';
        progressFill.style.width = `${Math.min(100, (s.defuseProgress / 5) * 100)}%`;
      } else {
        progressWrap.style.display = 'none';
      }
    },
  };
}
