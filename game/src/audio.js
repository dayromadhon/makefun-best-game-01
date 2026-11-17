// Synthesised sound effects: every sound is built from WebAudio oscillators and
// filtered noise at play time, so the game ships no audio files at all. The
// context is created lazily on the first user gesture (browsers block audio
// before one) and stays silent in screenshot mode, where there is no gesture.
export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, gain, slideTo) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise(dur, gain, filterFreq, filterType) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = filterType || 'lowpass';
    filter.frequency.value = filterFreq || 1200;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    src.start(t0);
  }

  return {
    // Call from the first user gesture (the start click). Safe to call often.
    unlock() {
      if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {});
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    get muted() {
      return muted;
    },
    shot(weaponKey) {
      if (!ensure()) return;
      if (weaponKey === 'k9') {
        noise(0.09, 0.5, 2600, 'bandpass');
        tone(190, 0.07, 'square', 0.16, 70);
      } else if (weaponKey === 'vk47') {
        noise(0.14, 0.65, 1500);
        tone(130, 0.12, 'sawtooth', 0.22, 55);
      } else {
        noise(0.08, 0.45, 3200, 'bandpass');
        tone(240, 0.06, 'square', 0.13, 90);
      }
    },
    enemyShot() {
      if (!ensure()) return;
      noise(0.08, 0.22, 1800, 'bandpass');
      tone(150, 0.07, 'square', 0.07, 70);
    },
    dryFire() {
      tone(1400, 0.03, 'square', 0.08);
    },
    hit() {
      tone(1250, 0.05, 'sine', 0.2);
    },
    kill() {
      tone(880, 0.09, 'sine', 0.22);
      setTimeout(() => tone(1320, 0.12, 'sine', 0.2), 70);
    },
    hurt() {
      tone(110, 0.18, 'sawtooth', 0.25, 60);
      noise(0.12, 0.2, 500);
    },
    reload() {
      tone(700, 0.04, 'square', 0.1);
      setTimeout(() => tone(500, 0.04, 'square', 0.1), 140);
      setTimeout(() => tone(900, 0.05, 'square', 0.12), 320);
    },
    buy() {
      tone(660, 0.07, 'sine', 0.18);
      setTimeout(() => tone(990, 0.09, 'sine', 0.18), 80);
    },
    denied() {
      tone(220, 0.12, 'square', 0.14, 160);
    },
    plantBeep() {
      tone(1050, 0.07, 'sine', 0.2);
    },
    planted() {
      tone(1050, 0.1, 'sine', 0.22);
      setTimeout(() => tone(1050, 0.1, 'sine', 0.22), 140);
      setTimeout(() => tone(1400, 0.18, 'sine', 0.24), 300);
    },
    defuseBeep() {
      tone(750, 0.07, 'sine', 0.18);
    },
    explosion() {
      noise(0.9, 0.9, 300);
      tone(70, 0.8, 'sine', 0.5, 30);
    },
    grenadePin() {
      tone(1800, 0.03, 'square', 0.1);
    },
    bounce() {
      tone(320, 0.05, 'sine', 0.1, 180);
    },
    roundWin() {
      [523, 659, 784].forEach((f, i) => setTimeout(() => tone(f, 0.16, 'sine', 0.2), i * 110));
    },
    roundLose() {
      [392, 330, 262].forEach((f, i) => setTimeout(() => tone(f, 0.18, 'sine', 0.2), i * 120));
    },
    tick() {
      tone(980, 0.04, 'sine', 0.12);
    },
  };
}
