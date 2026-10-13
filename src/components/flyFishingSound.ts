/** Synthesized ambience + foley for /fish. Web Audio only — no files. */

export interface SoundState {
  /** 0..24 local hour in the game world. */
  hour: number;
  /** 0..1 rain intensity. */
  rain: number;
  /** 0..1 how close the camera is to whitewater rapids (1 = right next to them). */
  rapids: number;
  /** 0..1 how much riffle (shallow choppy water) is on screen. */
  riffle: number;
  /** 0..1 how fast line is being pulled off the reel by a running fish (drives the reel's clicker "screaming"). */
  lineOut: number;
  /** true while the player is reeling in (slower, regular ratchet clicks). */
  reeling: boolean;
  /** 0..1 a bike rider's proximity to screen center (tire crunch on dirt). */
  bike: number;
}

export interface Sound {
  /** Call from a user gesture (pointerdown/keydown); creates/resumes the AudioContext lazily. Safe to call repeatedly. */
  unlock(): void;
  muted: boolean;
  setMuted(m: boolean): void;
  /** Called every animation frame with dt seconds. Drives continuous beds. */
  update(dt: number, s: SoundState): void;
  cast(): void;
  land(): void;
  mend(): void;
  rise(size: number): void;
  splash(size: number): void;
  strike(): void;
  snap(): void;
  landed(): void;
  rockFlip(): void;
  bell(): void;
  dispose(): void;
}

const KEY = 'hp-fish-muted';
/** Master level when unmuted. */
const LEVEL = 0.5;
/** Bed parameter refresh interval (s). */
const TICK = 1 / 15;

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ramp = (x: number, a: number, b: number) => clamp((x - a) / (b - a));
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const int = (a: number, b: number) => Math.floor(rnd(a, b + 1));

/** Seamlessly looping noise (tail crossfaded into head), RMS-normalized. */
function noise(ctx: AudioContext, secs: number, kind: 'white' | 'pink' | 'brown', ch = 2): AudioBuffer {
  const sr = ctx.sampleRate;
  const len = Math.floor(sr * secs);
  const fade = Math.floor(sr * 0.05);
  const buf = ctx.createBuffer(ch, len, sr);
  for (let c = 0; c < ch; c++) {
    const raw = new Float32Array(len + fade);
    let b0 = 0, b1 = 0, b2 = 0, sum = 0;
    for (let i = 0; i < raw.length; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'pink') {
        b0 = 0.99765 * b0 + w * 0.099046;
        b1 = 0.963 * b1 + w * 0.2965164;
        b2 = 0.57 * b2 + w * 1.0526913;
        raw[i] = b0 + b1 + b2 + w * 0.1848;
      } else if (kind === 'brown') {
        b0 = (b0 + 0.02 * w) / 1.02;
        raw[i] = b0;
      } else raw[i] = w;
      sum += raw[i] * raw[i];
    }
    const k = (kind === 'white' ? 0.5 : 0.25) / Math.sqrt(sum / raw.length);
    const out = buf.getChannelData(c);
    for (let i = 0; i < len; i++) {
      const x = i / fade;
      out[i] = k * (i < fade ? raw[i] * x + raw[len + i] * (1 - x) : raw[i]);
    }
  }
  return buf;
}

function build(ctx: AudioContext) {
  const white = noise(ctx, 2, 'white', 1);
  const pink = noise(ctx, 3, 'pink');
  const brown = noise(ctx, 4, 'brown');

  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.ratio.value = 3;
  comp.connect(ctx.destination);
  const master = ctx.createGain();
  master.gain.value = 0;
  master.connect(comp);
  const sfx = ctx.createGain();
  sfx.connect(master);

  const bed = (buf: AudioBuffer, type: BiquadFilterType, freq: number, q: number) => {
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.value = 0;
    src.connect(f).connect(g).connect(master);
    src.start(0, Math.random() * buf.duration);
    return { f, g: g.gain };
  };

  // Crickets: two always-on sines gated by scheduled pulse envelopes.
  const crickets = ctx.createGain();
  crickets.gain.value = 0;
  crickets.connect(master);
  const voices = [4350, 4800].map((freq, i) => {
    const osc = ctx.createOscillator();
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = 0;
    const p = ctx.createStereoPanner();
    p.pan.value = i ? 0.55 : -0.45;
    osc.connect(g).connect(p).connect(crickets);
    osc.start();
    return { g: g.gain, next: 0, period: rnd(0.55, 0.85), pulses: int(3, 4) };
  });

  // Reel ratchet: tiny decaying noise click into a shared resonant band.
  const click = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.006), ctx.sampleRate);
  const cd = click.getChannelData(0);
  for (let i = 0; i < cd.length; i++) cd[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.0012));
  const reelF = ctx.createBiquadFilter();
  reelF.type = 'bandpass';
  reelF.frequency.value = 3200;
  reelF.Q.value = 1.6;
  const reel = ctx.createGain();
  reel.gain.value = 0.35;
  reelF.connect(reel).connect(sfx);

  return {
    white, click, master, sfx, crickets, voices, reelF, reel,
    river: bed(pink, 'lowpass', 650, 0.7),
    riffle: bed(pink, 'bandpass', 1600, 0.8),
    rapids: bed(pink, 'lowpass', 2400, 0.4),
    roar: bed(brown, 'lowpass', 500, 0.5),
    rain: bed(pink, 'highpass', 3000, 0.5),
    wind: bed(pink, 'bandpass', 500, 1),
    bike: bed(pink, 'bandpass', 1100, 1),
  };
}

type Graph = ReturnType<typeof build>;
interface Tone { type?: OscillatorType; pan?: number; attack?: number }
interface Burst { dur: number; vol: number; type?: BiquadFilterType; f0: number; f1?: number; q?: number; pan?: number; attack?: number }

export function createSound(): Sound {
  let ctx: AudioContext | null = null;
  let G: Graph | null = null;
  let muted = false;
  try { muted = typeof localStorage !== 'undefined' && localStorage.getItem(KEY) === '1'; } catch { /* private mode */ }

  let clock = 0, acc = 0, nextClick = 0, quietUntil = 0;
  const ph = Array.from({ length: 6 }, () => Math.random() * 6.28);
  const timers = { gurgle: 1, drop: 0.3, bird: 2, owl: 25, grit: 0.1 };

  const onVis = () => {
    if (!ctx) return;
    if (document.visibilityState === 'hidden') void ctx.suspend();
    else void ctx.resume();
  };

  /** Envelope gain: fast attack, exponential decay to silence by t + dur. */
  const env = (c: AudioContext, t: number, vol: number, attack: number, dur: number) => {
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(dur, attack + 0.005));
    return g;
  };

  /** Route through a panner (if panned); returns the chain head and a cleanup. */
  const route = (c: AudioContext, g: Graph, src: AudioScheduledSourceNode, nodes: AudioNode[], pan: number) => {
    const all = [src, ...nodes];
    if (pan) {
      const p = c.createStereoPanner();
      p.pan.value = clamp(pan, -1, 1);
      all.push(p);
    }
    for (let i = 0; i < all.length - 1; i++) all[i].connect(all[i + 1]);
    all[all.length - 1].connect(g.sfx);
    src.onended = () => all.forEach((n) => n.disconnect());
  };

  const tone = (t: number, f0: number, f1: number, dur: number, vol: number, o: Tone = {}) => {
    if (!ctx || !G) return;
    const osc = ctx.createOscillator();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(f1, t + dur);
    route(ctx, G, osc, [env(ctx, t, vol, o.attack ?? 0.005, dur)], o.pan ?? 0);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  };

  const burst = (t: number, b: Burst): BiquadFilterNode | null => {
    if (!ctx || !G) return null;
    const src = ctx.createBufferSource();
    src.buffer = G.white;
    const f = ctx.createBiquadFilter();
    f.type = b.type ?? 'bandpass';
    f.Q.value = b.q ?? 1;
    f.frequency.setValueAtTime(b.f0, t);
    if (b.f1) f.frequency.exponentialRampToValueAtTime(b.f1, t + b.dur);
    route(ctx, G, src, [f, env(ctx, t, b.vol, b.attack ?? 0.003, b.dur)], b.pan ?? 0);
    src.start(t, Math.random() * Math.max(0, G.white.duration - b.dur - 0.1));
    src.stop(t + b.dur + 0.05);
    return f;
  };

  /** Water droplet: sine with a quick upward resonance sweep. */
  const plip = (t: number, f: number, vol: number, pan = rnd(-0.5, 0.5), dur = 0.06) =>
    tone(t, f, f * rnd(1.7, 2.3), dur, vol, { pan, attack: 0.002 });

  const now = () => (ctx ? ctx.currentTime + 0.01 : 0);

  const bird = (t: number) => {
    const pan = rnd(-0.85, 0.85), v = rnd(0.015, 0.04), f = rnd(2600, 4200);
    switch (int(0, 3)) {
      case 0: // chip-chip-chip
        for (let i = 0, n = int(2, 5); i < n; i++) tone(t + i * rnd(0.09, 0.13), f * 1.25, f * 0.8, 0.05, v, { pan });
        break;
      case 1: // trill
        for (let i = 0, n = int(8, 16); i < n; i++) tone(t + i * 0.045, f, f * 1.1, 0.03, v * 0.7, { pan });
        break;
      case 2: // fee-bee whistle
        tone(t, f * 1.05, f, 0.3, v, { pan, attack: 0.04 });
        tone(t + 0.38, f * 0.86, f * 0.83, 0.36, v * 0.9, { pan, attack: 0.04 });
        break;
      default: { // warble
        let tt = t;
        for (let i = 0, n = int(4, 8); i < n; i++) {
          const d = rnd(0.05, 0.12);
          tone(tt, f * rnd(0.8, 1.3), f * rnd(0.7, 1.4), d, v, { pan });
          tt += d + rnd(0.01, 0.04);
        }
      }
    }
  };

  const splash = (size: number, t = now()) => {
    const s = clamp(size);
    burst(t, { dur: 0.25 + 0.4 * s, vol: 0.35 + 0.4 * s, type: 'lowpass', f0: 3000 + 2500 * s, f1: 500, q: 0.5, attack: 0.008 });
    burst(t, { dur: 0.12 + 0.1 * s, vol: 0.4, f0: 1400, f1: 700, q: 0.6 });
    for (let i = 0, n = int(3, 3 + 5 * s); i < n; i++) plip(t + rnd(0.06, 0.5 + 0.3 * s), rnd(400, 1300), rnd(0.015, 0.035));
  };

  const set = (p: AudioParam, v: number, at: number, tc = 0.15) => p.setTargetAtTime(v, at, tc);

  const sound: Sound = {
    get muted() { return muted; },
    set muted(m: boolean) { sound.setMuted(m); },

    unlock() {
      if (typeof window === 'undefined') return;
      if (!ctx) {
        const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AC) return;
        try {
          ctx = new AC();
          G = build(ctx);
        } catch {
          ctx = null;
          G = null;
          return;
        }
        document.addEventListener('visibilitychange', onVis);
        if (!muted) G.master.gain.setTargetAtTime(LEVEL, ctx.currentTime, 0.4);
      }
      if (ctx.state === 'suspended' && document.visibilityState !== 'hidden') void ctx.resume();
    },

    setMuted(m) {
      muted = m;
      try { localStorage.setItem(KEY, m ? '1' : '0'); } catch { /* ignore */ }
      if (!ctx || !G) return;
      const g = G.master.gain;
      g.cancelScheduledValues(ctx.currentTime);
      g.setValueAtTime(g.value, ctx.currentTime);
      g.setTargetAtTime(m ? 0 : LEVEL, ctx.currentTime, 0.1);
    },

    update(dt, s) {
      if (!ctx || !G || ctx.state !== 'running') return;
      const g = G;
      const t = ctx.currentTime;
      clock += dt;
      const h = ((s.hour % 24) + 24) % 24;
      const night = h >= 12 ? ramp(h, 19, 21) : 1 - ramp(h, 4.5, 6);
      const dawn = ramp(h, 4.8, 5.8) * (1 - ramp(h, 7.5, 9));
      const day = ramp(h, 6, 8) * (1 - ramp(h, 18, 20));
      const dusk = ramp(h, 17, 18.5) * (1 - ramp(h, 20, 21.5));
      const birds = Math.max(dawn, 0.3 * day, 0.5 * dusk) * (1 - 0.8 * s.rain);

      // Reel ratchet, scheduled ahead on the audio clock.
      const running = s.lineOut > 0.02;
      const rate = t < quietUntil ? 0 : running ? 10 + 30 * s.lineOut : s.reeling ? 12 : 0;
      if (!rate) nextClick = 0;
      else {
        if (nextClick < t) nextClick = t + 0.01;
        while (nextClick < t + 0.12) {
          const src = ctx.createBufferSource();
          src.buffer = g.click;
          src.playbackRate.value = running ? rnd(0.85, 1.15) : rnd(0.97, 1.03);
          src.connect(g.reelF);
          src.onended = () => src.disconnect();
          src.start(nextClick);
          nextClick += (1 / rate) * (running ? rnd(0.85, 1.15) : rnd(0.97, 1.03));
        }
      }

      // Crickets: rhythmic pulse groups per voice.
      if (night > 0.02) {
        for (const v of g.voices) {
          if (v.next < t) v.next = t + rnd(0.05, 0.5);
          while (v.next < t + 0.25) {
            for (let i = 0; i < v.pulses; i++) {
              const p = v.next + i * 0.04;
              v.g.setValueAtTime(0, p);
              v.g.linearRampToValueAtTime(1, p + 0.005);
              v.g.linearRampToValueAtTime(0, p + 0.02);
            }
            v.next += v.period * rnd(0.95, 1.05);
          }
        }
      }

      // Random one-shots.
      if ((timers.gurgle -= dt) <= 0) {
        const v = 0.025 + 0.03 * s.riffle;
        plip(t + 0.02, rnd(250, 750), v, rnd(-0.7, 0.7), rnd(0.05, 0.09));
        if (Math.random() < 0.3) plip(t + rnd(0.08, 0.18), rnd(300, 900), v * 0.7);
        timers.gurgle = rnd(0.8, 4) / (0.6 + s.riffle + s.rapids);
      }
      if (s.rain > 0.05 && (timers.drop -= dt) <= 0) {
        if (Math.random() < 0.6) plip(t + 0.01, rnd(1800, 4000), 0.018 * s.rain, rnd(-0.9, 0.9), 0.025);
        else burst(t + 0.01, { dur: 0.01, vol: 0.25 * s.rain, type: 'highpass', f0: 5000, pan: rnd(-0.9, 0.9) });
        timers.drop = rnd(0.02, 0.15) / s.rain;
      }
      if (birds > 0.02 && (timers.bird -= dt) <= 0) {
        bird(t + 0.02);
        timers.bird = rnd(0.8, 4.5) / birds;
      }
      if ((timers.owl -= dt) <= 0) {
        if (night > 0.9 && s.rain < 0.5) {
          const pan = rnd(-0.7, 0.7);
          tone(t + 0.02, 410, 380, 0.45, 0.05, { pan, attack: 0.09 });
          tone(t + 0.6, 400, 360, 0.6, 0.045, { pan, attack: 0.1 });
        }
        timers.owl = rnd(25, 70);
      }
      if (s.bike > 0.05 && (timers.grit -= dt) <= 0) {
        burst(t + 0.01, { dur: 0.012, vol: rnd(0.2, 0.5) * s.bike, f0: rnd(1800, 4000), q: 2 });
        timers.grit = rnd(0.02, 0.09) / s.bike;
      }

      // Beds, throttled.
      if ((acc += dt) < TICK) return;
      acc = 0;
      const m1 = 0.5 + 0.3 * Math.sin(clock * 0.21 + ph[0]) + 0.2 * Math.sin(clock * 0.83 + ph[1]);
      const m2 = 0.5 + 0.3 * Math.sin(clock * 0.13 + ph[2]) + 0.2 * Math.sin(clock * 0.57 + ph[3]);
      const gust = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(clock * 0.11 + ph[4])) * (0.6 + 0.4 * Math.sin(clock * 0.37 + ph[5]));
      set(g.river.g, 0.22 * (0.8 + 0.4 * m1), t);
      set(g.river.f.frequency, 500 + 300 * m2 + 300 * s.riffle, t);
      set(g.riffle.g, s.riffle * 0.35 * (0.75 + 0.5 * m2), t);
      set(g.riffle.f.frequency, 1400 + 800 * m1, t);
      set(g.rapids.g, s.rapids * 0.5, t, 0.3);
      set(g.roar.g, s.rapids * 0.45, t, 0.3);
      set(g.rain.g, s.rain * 0.2, t, 0.4);
      set(g.wind.g, (0.07 + 0.14 * s.rain) * gust, t, 0.4);
      set(g.wind.f.frequency, 350 + 400 * gust, t, 0.4);
      set(g.bike.g, s.bike * 0.3 * rnd(0.4, 1), t, 0.03);
      set(g.crickets.gain, 0.02 * night * (1 - 0.6 * s.rain), t, 0.5);
      set(g.reel.gain, running ? 0.3 + 0.15 * s.lineOut : 0.35, t, 0.05);
    },

    cast() {
      const t = now();
      const f = burst(t, { dur: 0.42, vol: 0.55, f0: 400, q: 1.2, attack: 0.14, pan: -0.15 });
      f?.frequency.exponentialRampToValueAtTime(2000, t + 0.15);
      f?.frequency.exponentialRampToValueAtTime(600, t + 0.42);
      burst(t + 0.05, { dur: 0.3, vol: 0.05, type: 'highpass', f0: 4500, attack: 0.1 });
    },

    land() {
      const t = now();
      plip(t, 1500, 0.02, 0, 0.03);
      burst(t, { dur: 0.012, vol: 0.08, type: 'highpass', f0: 2500 });
    },

    mend() {
      burst(now(), { dur: 0.28, vol: 0.35, f0: 700, f1: 1600, q: 0.9, attack: 0.08, pan: rnd(-0.3, 0.3) });
    },

    rise(size) {
      const s = clamp(size), t = now(), pan = rnd(-0.3, 0.3);
      burst(t, { dur: 0.04, vol: 0.15 + 0.2 * s, type: 'lowpass', f0: 1500, pan });
      plip(t + 0.01, 900 - 500 * s, 0.035 + 0.05 * s, pan, 0.06 + 0.04 * s);
    },

    splash,

    strike() {
      const t = now();
      burst(t, { dur: 0.14, vol: 0.6, f0: 1500, f1: 5000, q: 2, attack: 0.01 });
      splash(0.35, t + 0.05);
    },

    snap() {
      const t = now();
      burst(t, { dur: 0.015, vol: 0.3, type: 'highpass', f0: 3000 });
      tone(t, 1400, 1100, 0.3, 0.05, { type: 'triangle' });
      tone(t, 2900, 2600, 0.15, 0.025);
      quietUntil = (ctx?.currentTime ?? 0) + 0.8;
    },

    landed() {
      const t = now();
      [1046.5, 1318.5, 1568].forEach((f, i) => tone(t + i * 0.09, f, f, 0.6, 0.03));
    },

    rockFlip() {
      const t = now();
      burst(t, { dur: 0.03, vol: 0.8, f0: 2200, q: 4 });
      tone(t, 220, 160, 0.08, 0.08);
      burst(t + 0.02, { dur: 0.18, vol: 0.3, f0: 500, f1: 900, q: 1.5, attack: 0.03 });
      burst(t + 0.07, { dur: 0.025, vol: 0.5, f0: 1700, q: 4 });
      for (let i = 0, n = int(3, 5); i < n; i++) plip(t + rnd(0.2, 1), rnd(700, 1600), 0.03);
    },

    bell() {
      const t = now(), pan = rnd(-0.5, 0.5);
      for (const d of [0, 0.16]) {
        [1, 2.32, 3.9].forEach((r, i) => tone(t + d, 1750 * r, 1750 * r, 0.9 - i * 0.25, [0.04, 0.016, 0.006][i], { pan, attack: 0.002 }));
      }
    },

    dispose() {
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVis);
      if (ctx) void ctx.close();
      ctx = null;
      G = null;
    },
  };
  return sound;
}
