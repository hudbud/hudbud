// A voxel trout stream. Cast a fly, get it to drift drag-free over a fish,
// set the hook when it rises, and play it in; it comes up holding an image
// from one of the posts. Meshes live in flyFishingScene.ts; this file runs
// the game, the logbook, and the lightbox.
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import * as THREE from 'three';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { BookOpenText, CameraRotate, Feather, HandGrabbing, SpeakerHigh, SpeakerSlash, Trophy, TShirt } from '@phosphor-icons/react';
import { GLASS } from './chrome';
import {
  BANK_Y, trailZ, riverZ, riverSlope, riverHalf, edgeZ, bankZ, lane, laneZ, bedY, reachSpeed, reachChop, waterName,
  WALL_X, LOGFALL_X, FISH_PALETTES, BIKE_WHEEL_R, BIKE_CRANK, BIKE_HIP,
  buildTerrain, buildFish, buildAvatar, buildFly, buildBike, buildBug, buildUnderRock, box, lump,
  DEFAULT_LOOK, SKINS, HAIRS, SHIRTS, WADERS, HAT_COLORS, HATS, FACES, SHADES,
  type FishMesh, type Avatar, type Bike, type SpeciesId, type FlyId, type BugId, type NymphId, type Look,
} from './flyFishingScene';
import { createSound, type Sound } from './flyFishingSound';

export interface FishPost {
  slug: string;
  title: string;
}

interface Catch {
  src: string;
  slug: string;
  title: string;
}
interface Card {
  c: Catch | null; species: SpeciesId; inches: number; fly: FlyId; newPost: boolean; newSpecies: boolean; best: boolean;
  /** It would make the board but we don't have a name yet. */
  ask?: boolean;
  /** Where it landed on the board, once posted. */
  rank?: string;
}
/** The shared high scores, one row per angler. */
interface Boards {
  fish: { name: string; species: SpeciesId; fly: FlyId; inches: number }[];
  sessions: { name: string; count: number; inches: number }[];
}
type Pane = 'log' | 'scores' | 'box' | 'angler' | null;
interface Log { posts: Record<string, string>; species: Partial<Record<SpeciesId, { n: number; best: number }>>; total: number }

type FishState = 'enter' | 'hold' | 'chase' | 'rise' | 'spook' | 'hooked' | 'leap' | 'held' | 'release';
/** Somewhere a trout holds. `big` lies (boulders, the log, the pool) are where the big ones go. */
interface Lie { x: number; z: number; big: boolean; fish: Fish | null }
interface Fish {
  x: number; z: number; y: number; heading: number; len: number; wag: number; seed: number;
  species: SpeciesId;
  /** How much drag it will put up with before refusing. Big fish are fussy. */
  tol: number;
  state: FishState; t: number;
  lie: Lie | null; hx: number; hz: number; cooldown: number;
  runAngle: number; runT: number; energy: number; jumpT: number;
  /** Whether it has made up its mind about the fly on this chase. */
  judged: boolean;
  from: THREE.Vector3; to: THREE.Vector3;
  mesh: FishMesh;
}
interface Ring { mesh: THREE.Mesh; life: number; max: number; size: number }
interface Drop { mesh: THREE.Mesh; v: THREE.Vector3; life: number }
interface Streak { x: number; z: number; len: number; seed: number }
interface Rider { bike: Bike; x: number; dir: number; speed: number; crank: number; wait: number; end: number; rang: boolean }
/** A natural: drifting on the surface, or flying off it. */
interface Bug { id: BugId; root: THREE.Group; wings: THREE.Object3D; x: number; y: number; z: number; vx: number; vy: number; vz: number; t: number; life: number; air: boolean; heading: number }
type Weather = 'clear' | 'cloudy' | 'rain';
type LineState = 'idle' | 'casting' | 'drifting' | 'taken' | 'fighting';

/** The fly and, once it lands, the line lying on the water as a chain of
    nodes from where it touches down (node 0) to the fly (the last node). */
interface Line {
  state: LineState; t: number; fx: number; fz: number; tx: number; tz: number; x: number; y: number; z: number; drift: number;
  nx: Float32Array; nz: Float32Array; rest: number; rest0: number;
  mendT: number; mdx: Float32Array; mdz: Float32Array;
  feeding: boolean;
  /** How fast the line is pulling the fly through the water, and which way. */
  drag: number; dragX: number; dragZ: number;
  /** Mean downstream bow of the line's middle; positive wants an upstream mend. */
  belly: number;
}

interface World {
  xMin: number; xMax: number; avatarX: number; avatarZ: number;
  fly: FlyId;
  /** Hour of the day, 0–24, and how overcast and wet it is, 0–1. */
  hour: number; cloud: number; rain: number;
  /** What's coming off the water, and how hard. */
  hatch: BugId | null; hatchK: number;
  bugs: Bug[];
  walkTo: number | null; walkDir: number; walking: number;
  fish: Fish[];
  lies: Lie[];
  rocks: { x: number; z: number; r: number }[];
  line: Line;
  hooked: Fish | null;
  reeling: boolean;
  tension: number;
  tip: THREE.Vector3;
  time: number;
  castKick: number;
}

const CAST_TIME = 0.6;
const STRIKE_WINDOW = 0.85;
const FISH_COUNT = 13;
const SPEED = 0.75;
/** He can walk between the granite wall and the log fall, a little short of each. */
const WALK_MIN = WALL_X + 0.8;
const WALK_MAX = LOGFALL_X - 1.4;
/** Real seconds per hour of the day. */
const HOUR = 40;
const MAX_CAST = 8.5;
const NODES = 16;
const MEND_TIME = 0.28;
const IMAGE_EXT = /\.(webp|png|jpe?g|gif|avif)$/i;
const POLAR = 0.84;
const YAW = 0.3;
const LOG_KEY = 'hp-fish-log';
const LOOK_KEY = 'hp-fish-look';
const NAME_KEY = 'hp-fish-name';
const BOARD_SIZE = 10;
/** The site's glass, denser: at 70% the bright meadow bleeds through and washes out the text. */
const PANE: CSSProperties = { ...GLASS, background: 'color-mix(in srgb, var(--bg) 90%, transparent)' };
/** Fly line, then a tapered leader, then fine tippet down to the fly. */
const RIG = [
  { points: 44, color: '#d7ff3a', width: 2.4, opacity: 1 },
  { points: 12, color: '#eef6f0', width: 1.3, opacity: 0.8 },
  { points: 6, color: '#ffffff', width: 0.8, opacity: 0.6 },
];

const SPECIES: Record<SpeciesId, { name: string; weight: number; min: number; max: number; wary: number }> = {
  brook: { name: 'brook trout', weight: 0.3, min: 0.42, max: 0.68, wary: 1 },
  rainbow: { name: 'rainbow', weight: 0.38, min: 0.55, max: 1.05, wary: 1 },
  cutthroat: { name: 'cutthroat', weight: 0.17, min: 0.6, max: 1.0, wary: 1.1 },
  brown: { name: 'brown trout', weight: 0.12, min: 0.75, max: 1.35, wary: 1.5 },
  golden: { name: 'golden trout', weight: 0.03, min: 0.6, max: 0.95, wary: 1.3 },
};
const SPECIES_IDS = Object.keys(SPECIES) as SpeciesId[];

/** The fly box. Each fly imitates a bug; the Adams passes for most mayflies and midges. */
const FLIES: { id: FlyId; name: string; size: number; swatch: string; bugs: BugId[]; attractor?: boolean }[] = [
  { id: 'adams', name: 'parachute adams', size: 14, swatch: '#8a8f96', bugs: [], attractor: true },
  { id: 'bwo', name: 'blue-winged olive', size: 18, swatch: '#6f7a3c', bugs: ['bwo'] },
  { id: 'pmd', name: 'pale morning dun', size: 16, swatch: '#f0cf6a', bugs: ['pmd'] },
  { id: 'caddis', name: 'elk hair caddis', size: 14, swatch: '#c9ad7a', bugs: ['caddis'] },
  { id: 'stimi', name: 'stimulator', size: 10, swatch: '#ff8a2a', bugs: ['stone'], attractor: true },
  { id: 'hopper', name: 'chernobyl hopper', size: 8, swatch: '#a7c43a', bugs: ['hopper'], attractor: true },
  { id: 'gnat', name: "griffith's gnat", size: 20, swatch: '#2f4a3a', bugs: ['midge'] },
];
const flyOf = (id: FlyId) => FLIES.find((f) => f.id === id)!;

/** When each bug comes off, 0–1, by hour and weather. */
const bump = (h: number, a: number, b: number) => {
  const m = (a + b) / 2;
  const w = (b - a) / 2;
  return Math.max(0, 1 - ((h - m) / w) ** 2);
};
const HATCHES: Record<BugId, (h: number, cloud: number, rain: number) => number> = {
  midge: (h) => Math.max(bump(h, 4.5, 8.5), bump(h, 20.5, 25), bump(h, -3.5, 1)) * 0.75,
  pmd: (h, c, r) => bump(h, 8.5, 13) * (1 - r * 0.6),
  bwo: (h, c, r) => bump(h, 10, 16.5) * (0.2 + 0.8 * Math.max(c, r)),
  stone: (h, c) => bump(h, 12.5, 17.5) * (1 - c * 0.6) * 0.9,
  hopper: (h, c, r) => bump(h, 11, 17.5) * (1 - c) * (1 - r),
  caddis: (h) => bump(h, 17.8, 22),
};
const BUG_IDS = Object.keys(HATCHES) as BugId[];
const strongest = (h: number, c: number, r: number) => {
  let best: BugId = 'midge';
  for (const id of BUG_IDS) if (HATCHES[id](h, c, r) > HATCHES[best](h, c, r)) best = id;
  return { id: best, k: HATCHES[best](h, c, r) };
};

/** How much a trout wants this fly right now, 0–1. Selective in a hatch, easy-going between. */
function appeal(w: World) {
  const f = flyOf(w.fly);
  const day = w.hour > 7 && w.hour < 19;
  const between = f.attractor ? (f.id === 'hopper' && !day ? 0.45 : 0.8) : 0.6;
  if (!w.hatch) return between;
  const generic = f.id === 'adams' && (w.hatch === 'bwo' || w.hatch === 'pmd' || w.hatch === 'midge');
  const during = f.bugs.includes(w.hatch) ? 1 : generic ? 0.6 : f.attractor ? 0.4 : 0.25;
  const k = clamp((w.hatchK - 0.25) / 0.5, 0, 1);
  return between + (during - between) * k;
}

/** What's under a stone, and what it says about the next hatch. */
const UNDER: Record<BugId, { nymph: NymphId; say: string }> = {
  bwo: { nymph: 'olive', say: 'olive mayfly nymphs, wing pads gone dark. blue-wings are close' },
  pmd: { nymph: 'pale', say: 'pale mayfly nymphs, fat and ready. pmds soon' },
  caddis: { nymph: 'caddis', say: 'caddis cases glued all over it. they come up at dusk' },
  stone: { nymph: 'stone', say: 'golden stone nymphs, big as your thumb. think orange' },
  midge: { nymph: 'midge', say: 'just midge larvae, tiny and red. think small' },
  hopper: { nymph: 'midge', say: 'not much under here. it\'s the grass that\'s ticking: hoppers' },
};
const BUG_NAMES: Record<BugId, string> = { bwo: 'blue-winged olives', pmd: 'pale morning duns', caddis: 'caddis', stone: 'golden stones', hopper: 'hoppers', midge: 'midges' };
const inches = (len: number) => Math.round(len * 18);

const HINT = {
  cast: 'tap the water to cast',
  walk: 'walking the bank',
  strike: 'strike!',
  reel: 'hold to reel',
  run: 'let it run!',
  missed: 'missed. it spat the fly',
  early: 'too soon. spooked it',
  slack: 'too much slack. missed',
  lined: 'lined it. spooked',
  plop: 'right on its nose. spooked',
  refused: 'refused. it saw the drag',
  dragged: 'dragged it over him. spooked',
  snapped: 'snapped off. let the big ones run',
  dead: 'dead drift',
  wrong: 'refused. not what they\'re eating',
  look: 'came up for a look. refused',
  hatchOn: 'bugs coming off the water',
  hatchOff: 'the hatch is petering out',
  wall: 'granite. no way round',
  logfall: 'the log fall. no way over',
  rock: 'turning a rock',
} as const;

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const easeOut = (p: number) => 1 - (1 - p) ** 3;
const approach = (v: number, target: number, rate: number, dt: number) => v + (target - v) * (1 - Math.exp(-dt * rate));
function lerpAngle(a: number, b: number, k: number) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * k;
}

function loadLog(): Log {
  try {
    const l = JSON.parse(localStorage.getItem(LOG_KEY) ?? '');
    if (l && typeof l.total === 'number') return l;
  } catch {}
  return { posts: {}, species: {}, total: 0 };
}

/** The saved kit, with anything stale or unknown put back to his own. */
function loadLook(): Look {
  try {
    const l = JSON.parse(localStorage.getItem(LOOK_KEY) ?? '');
    const pick = <T,>(v: T, ok: readonly T[], d: T) => (ok.includes(v) ? v : d);
    const color = (v: string, ok: { color: string }[], d: string) => pick(v, ok.map((o) => o.color), d);
    const d = DEFAULT_LOOK;
    return {
      skin: pick(l.skin, SKINS.map((o) => o.id), d.skin),
      hair: pick(l.hair, HAIRS.map((o) => o.id), d.hair),
      face: pick(l.face, FACES, d.face),
      hat: pick(l.hat, HATS, d.hat),
      hatColor: color(l.hatColor, HAT_COLORS, d.hatColor),
      shades: pick(l.shades, SHADES, d.shades),
      shirt: color(l.shirt, SHIRTS, d.shirt),
      waders: color(l.waders, WADERS, d.waders),
    };
  } catch {
    return DEFAULT_LOOK;
  }
}

/** Would this make a board of the top ten? */
const makes = <T,>(list: T[], beats: (last: T) => boolean) => list.length < BOARD_SIZE || beats(list[list.length - 1]);

/** Clamp z into the water at x, `pad` in from the banks. */
const wet = (x: number, z: number, pad: number) => clamp(z, edgeZ(-1, x) + pad, edgeZ(1, x) - pad);

/** Downstream current along x: quick in the riffles, lazy in the pool,
    fastest on the thread and slack near the banks. Follows the bends by
    `riverSlope`. */
const current = (x: number, z: number) => SPEED * reachSpeed(x) * Math.max(0.12, 1 - Math.min(1, lane(x, z) ** 2));

/** The current, with a slow pocket in the lee of every boulder. */
function flow(w: World, x: number, z: number) {
  let v = current(x, z);
  for (const r of w.rocks) {
    const dx = x - r.x;
    if (dx < 0 || dx > r.r * 6 || Math.abs(z - r.z) > r.r * 1.1) continue;
    v *= 0.2 + 0.8 * (dx / (r.r * 6)) ** 1.5;
  }
  return v;
}

function makeFish(scene: THREE.Scene): Fish {
  let r = Math.random();
  const species = SPECIES_IDS.find((id) => (r -= SPECIES[id].weight) <= 0) ?? 'rainbow';
  const sp = SPECIES[species];
  // Mostly pan-sized, now and then a big one.
  const len = sp.min + (sp.max - sp.min) * Math.random() ** 1.8;
  const mesh = buildFish(len, FISH_PALETTES[species]);
  scene.add(mesh.root);
  return {
    x: 0, z: 0, y: -0.26, heading: Math.PI, len, wag: rand(0, 6), seed: rand(0, 100),
    species, tol: (0.24 - (len - 0.42) * 0.17) / sp.wary,
    state: 'hold', t: 0, lie: null, hx: 0, hz: 0, cooldown: 0,
    runAngle: 0, runT: 0, energy: 1, jumpT: rand(1.5, 3), judged: false,
    from: new THREE.Vector3(), to: new THREE.Vector3(),
    mesh,
  };
}

/** Find a fish somewhere free to hold, near where it is. Big fish want a boulder. */
function settle(w: World, f: Fish) {
  if (f.lie) f.lie.fish = null;
  const free = w.lies.filter((l) => !l.fish);
  const pool = f.len > 0.9 && free.some((l) => l.big) && Math.random() < 0.8 ? free.filter((l) => l.big) : free;
  pool.sort((a, b) => Math.abs(a.x - f.x) - Math.abs(b.x - f.x));
  const lie = pool[Math.floor(Math.random() * Math.min(3, pool.length))];
  f.lie = lie ?? null;
  if (lie) lie.fish = f;
  f.hx = lie ? lie.x : f.x;
  f.hz = lie ? lie.z : f.z;
}

function spook(f: Fish, angle: number, cooldown: number) {
  f.state = 'spook';
  f.t = 0;
  f.runAngle = angle;
  f.cooldown = cooldown;
}

/** Move toward a point, turning to face travel when moving and upstream when holding. */
function steer(f: Fish, tx: number, tz: number, maxSpeed: number, dt: number) {
  const dx = tx - f.x;
  const dz = tz - f.z;
  const d = Math.hypot(dx, dz) || 1;
  const sp = Math.min(maxSpeed, d * 2.2);
  f.x += (dx / d) * sp * dt;
  f.z += (dz / d) * sp * dt;
  const face = sp > 0.22 ? Math.atan2(dz, dx) : Math.PI;
  f.heading = lerpAngle(f.heading, face, 1 - Math.exp(-dt * 5));
  f.wag += dt * (5 + sp * 10);
}

/** Where the line touches down: out past the rod tip toward the fly, farther the higher the tip. */
function anchorOf(w: World) {
  const dx = w.line.x - w.tip.x;
  const dz = w.line.z - w.tip.z;
  const d = Math.hypot(dx, dz) || 1;
  const out = Math.min(d * 0.4, Math.max(0.4, w.tip.y * 0.7));
  const x = w.tip.x + (dx / d) * out;
  return { x, z: wet(x, w.tip.z + (dz / d) * out, 0.15) };
}

/** Lay the line out from touchdown to fly in loose S-curves, as a good cast lands. */
function layLine(L: Line, a: { x: number; z: number }) {
  const dx = L.x - a.x;
  const dz = L.z - a.z;
  const d = Math.hypot(dx, dz) || 1;
  const ph = rand(0, 6);
  for (let i = 0; i < NODES; i++) {
    const s = i / (NODES - 1);
    const wig = Math.sin(s * Math.PI * 3 + ph) * 0.1 * Math.sin(Math.PI * s);
    L.nx[i] = a.x + dx * s - (dz / d) * wig;
    L.nz[i] = a.z + dz * s + (dx / d) * wig;
  }
  L.rest0 = L.rest = Math.max(0.06, (d / (NODES - 1)) * 1.22);
  L.mendT = 0;
  L.feeding = false;
  L.drag = 0;
}

/** Every node rides the current under it; the chain can bunch up but not
    stretch, so a belly in faster water ends up towing the fly. That tow is
    drag, and fish can see it. */
function driftLine(w: World, dt: number, a: { x: number; z: number }) {
  const L = w.line;
  const last = NODES - 1;
  L.nx[0] = a.x;
  L.nz[0] = a.z;
  for (let i = 1; i < NODES; i++) {
    const v = flow(w, L.nx[i], L.nz[i]) * dt;
    L.nx[i] += v;
    L.nz[i] += v * riverSlope(L.nx[i]);
  }
  if (L.mendT > 0) {
    const k = Math.min(dt, L.mendT) / MEND_TIME;
    for (let i = 1; i < last; i++) {
      L.nx[i] += L.mdx[i] * k;
      L.nz[i] += L.mdz[i] * k;
    }
    L.mendT -= dt;
  }
  if (L.feeding) L.rest = Math.min(L.rest0 * 2.2, L.rest + (0.6 / last) * dt);
  const fx = L.nx[last];
  const fz = L.nz[last];
  for (let i = 1; i < NODES; i++) {
    const dx = L.nx[i] - L.nx[i - 1];
    const dz = L.nz[i] - L.nz[i - 1];
    const d = Math.hypot(dx, dz);
    if (d > L.rest) {
      L.nx[i] = L.nx[i - 1] + (dx / d) * L.rest;
      L.nz[i] = L.nz[i - 1] + (dz / d) * L.rest;
    }
    L.nz[i] = wet(L.nx[i], L.nz[i], 0.1);
  }
  if (L.state === 'drifting') {
    const vx = (L.nx[last] - fx) / dt;
    const vz = (L.nz[last] - fz) / dt;
    const v = Math.hypot(vx, vz);
    L.drag = approach(L.drag, v, 10, dt);
    if (v > 0.01) {
      L.dragX = vx / v;
      L.dragZ = vz / v;
    }
    L.x = L.nx[last];
    L.z = L.nz[last];
  } else {
    // A fish has it: the fly goes where the fish goes.
    L.nx[last] = L.x;
    L.nz[last] = L.z;
    L.drag = 0;
  }
  let b = 0;
  for (let i = 4; i < last - 3; i++) b += L.nx[i] - (L.nx[0] + (L.nx[last] - L.nx[0]) * (i / last));
  L.belly = b / (last - 7);
}

/** Roll the belly over to the `dir` side of the line (-1 upstream). Mending
    the right way takes the line it needs off the reel; mending a line that's
    already bowed that way just tugs the fly. */
function mendLine(L: Line, dir: number) {
  if (L.state !== 'drifting' || L.mendT > 0) return false;
  const last = NODES - 1;
  const cx = L.nx[last] - L.nx[0];
  const cz = L.nz[last] - L.nz[0];
  const c = Math.hypot(cx, cz) || 1;
  // Perpendicular to the chord, pointing to the `dir` side in x.
  const flip = Math.sign(-cz || 1) * dir;
  const px = (-cz / c) * flip;
  const pz = (cx / c) * flip;
  const right = Math.abs(L.belly) < 0.12 || Math.sign(L.belly) === -dir;
  let seg = 0;
  let ox = L.nx[0];
  let oz = L.nz[0];
  for (let i = 0; i <= last; i++) {
    const s = i / last;
    const bx = L.nx[0] + cx * s;
    const bz = L.nz[0] + cz * s;
    const off = Math.abs((L.nx[i] - bx) * px + (L.nz[i] - bz) * pz);
    const k = clamp(4 * (1 - s) - 0.2, 0, 1);
    const tx = L.nx[i] + (bx + px * (off + 0.3 * Math.sin(Math.PI * s)) - L.nx[i]) * k;
    const tz = L.nz[i] + (bz + pz * (off + 0.3 * Math.sin(Math.PI * s)) - L.nz[i]) * k;
    L.mdx[i] = tx - L.nx[i];
    L.mdz[i] = tz - L.nz[i];
    seg = Math.max(seg, Math.hypot(tx - ox, tz - oz));
    ox = tx;
    oz = tz;
  }
  // Lerping between two shapes never stretches a segment past the longer of
  // the two, so this much line means the fly doesn't move at all.
  if (right) L.rest = Math.min(L.rest0 * 2.2, Math.max(L.rest, seg));
  L.mendT = MEND_TIME;
  return true;
}

interface Fx {
  ring: (x: number, z: number, size: number, max?: number, delay?: number) => void;
  splash: (x: number, z: number, n: number) => void;
  snd: Sound;
}

/** Trout hold low in deep water and tuck down near the bed in the shallows. */
const holdDepth = (x: number, z: number) => {
  const b = bedY(x, z);
  return Math.min(-0.14, Math.max(b + 0.12, b * 0.45));
};
interface Callbacks {
  note: (h: string) => void;
  landed: () => void;
  snapped: () => void;
}

function step(w: World, dt: number, fx: Fx, cb: Callbacks, avatarHands: THREE.Vector3) {
  w.time += dt;
  w.castKick = Math.max(0, w.castKick - dt);
  const L = w.line;
  const anchor = anchorOf(w);

  // The fly.
  if (L.state === 'casting') {
    L.t += dt;
    const p = Math.min(1, L.t / CAST_TIME);
    const q = clamp((p - 0.3) / 0.7, 0, 1);
    L.x = L.fx + (L.tx - L.fx) * easeOut(q);
    L.z = L.fz + (L.tz - L.fz) * easeOut(q);
    L.y = Math.sin(Math.PI * q) * 1.2 + (1 - q) * 0.5 * Math.min(1, p / 0.3);
    if (p >= 1) {
      L.state = 'drifting';
      L.drift = 0;
      L.y = 0.03;
      layLine(L, anchor);
      fx.ring(L.x, L.z, 0.35, 0.7);
      fx.snd.land();
      // Line slapped down over a fish, or the fly dropped on a big one's nose.
      for (const f of w.fish) {
        if (f.state !== 'hold' && f.state !== 'chase' && f.state !== 'enter') continue;
        let why: string | null = f.len > 0.8 && Math.hypot(f.x - L.x, f.z - L.z) < f.len * 0.5 ? HINT.plop : null;
        for (let i = 1; !why && i < NODES * 0.75; i++) if (Math.hypot(f.x - L.nx[i], f.z - L.nz[i]) < f.len * 0.45) why = HINT.lined;
        if (why) {
          spook(f, Math.atan2(f.z - L.z, f.x - L.x) || rand(0, 6), 7);
          cb.note(why);
        }
      }
    }
  } else if (L.state === 'drifting' || L.state === 'taken') {
    L.drift += dt;
    driftLine(w, dt, anchor);
    if (L.state === 'drifting') {
      L.y = 0.03 + Math.sin(w.time * 5) * 0.008;
      if (L.x > w.xMax + 0.6 || L.x < w.xMin - 0.6 || L.drift > 25) L.state = 'idle';
    }
  }

  const chasing = w.fish.some((f) => f.state === 'chase' || f.state === 'rise');
  const tipX = w.tip.x;
  const tipZ = Math.max(w.tip.z, edgeZ(-1, w.tip.x) + 0.25);
  const want = appeal(w);
  // Rain on the water hides you; bright midday sun puts them down.
  const bright = (1 - w.cloud) * bump(w.hour, 10, 16);
  const nerve = (0.7 + 0.5 * want) * (1 + w.rain * 0.2 - bright * 0.15);
  const onScreen = (x: number) => x > w.xMin - 1 && x < w.xMax + 1;

  for (const f of w.fish) {
    f.t += dt;
    f.cooldown = Math.max(0, f.cooldown - dt);
    let depth = holdDepth(f.x, f.z);
    switch (f.state) {
      case 'enter':
        steer(f, f.hx, f.hz, 0.8, dt);
        if (Math.hypot(f.hx - f.x, f.hz - f.z) < 0.1) f.state = 'hold';
        break;
      case 'hold': {
        steer(f, f.hx + Math.sin(w.time * 0.7 + f.seed) * 0.08, f.hz + Math.sin(w.time * 0.5 + f.seed) * 0.05, 0.4, dt);
        // A natural rise now and then, to show where they're holding; lots in a hatch.
        if (Math.random() < dt * (0.015 + w.hatchK * 0.12)) {
          fx.ring(f.x + Math.cos(f.heading) * f.len * 0.5, f.z + Math.sin(f.heading) * f.len * 0.5, 0.55, 1.4);
          if (onScreen(f.x)) fx.snd.rise(f.len - 0.4);
        }
        // Naturals drifting down the lane get eaten.
        for (const b of w.bugs) {
          if (b.air || b.life <= 0 || f.cooldown > 0) continue;
          const nose = f.x + f.len * 0.4;
          if (Math.abs(b.x - nose) < 0.25 && Math.abs(b.z - f.z) < 0.3 && Math.random() < dt * 6) {
            b.life = 0;
            fx.ring(b.x, b.z, 0.5, 1.1);
            fx.ring(b.x, b.z, 0.3, 0.8, 0.12);
            if (onScreen(b.x)) fx.snd.rise(f.len - 0.4);
          }
        }
        if (L.state === 'drifting' && !chasing && f.cooldown === 0) {
          // Trout face upstream and feed in a lane: the fly has to come down to them.
          const up = f.x - L.x;
          const lane = Math.abs(L.z - f.z);
          if (up > -0.2 && up < 1.2 + f.len && lane < 0.3 + f.len * 0.45) {
            if (L.drag < f.tol * 1.3 * nerve) {
              if (Math.random() < dt * 2.5 * (0.3 + want * 0.7)) {
                f.state = 'chase';
                f.t = 0;
                f.judged = false;
              }
            } else if (L.drag > f.tol * 3 && up < 0.7 && lane < 0.45) {
              spook(f, rand(-Math.PI, Math.PI), 6);
              cb.note(HINT.dragged);
            }
          }
        }
        break;
      }
      case 'chase': {
        depth = -0.12;
        if (L.state !== 'drifting') {
          f.state = 'hold';
          break;
        }
        steer(f, L.x + 0.08, L.z, 0.9, dt);
        const d = Math.hypot(L.x - f.x, L.z - f.z);
        // Nose to the fly, it decides. Wrong bug in a hatch and it turns away.
        if (d < 0.35 && !f.judged) {
          f.judged = true;
          if (Math.random() > 0.3 + 0.7 * want) {
            f.state = 'hold';
            f.cooldown = 5;
            fx.ring(f.x, f.z, 0.3, 0.6);
            cb.note(want < 0.55 ? HINT.wrong : HINT.look);
            break;
          }
        }
        if (L.drag > f.tol * nerve) {
          // Came up for a look and turned away.
          f.state = 'hold';
          f.cooldown = 4;
          fx.ring(f.x, f.z, 0.3, 0.6);
          cb.note(HINT.refused);
        } else if (d > 2.5) {
          f.state = 'hold';
          f.cooldown = 2;
        } else if (d < 0.14) {
          f.state = 'rise';
          f.t = 0;
          L.state = 'taken';
          fx.ring(L.x, L.z, 0.7, 0.9);
          fx.ring(L.x, L.z, 0.45, 0.9, 0.15);
          fx.splash(L.x, L.z, 6);
          fx.snd.rise(0.4 + f.len * 0.4);
        }
        break;
      }
      case 'rise': {
        depth = -0.04;
        const v = current(f.x, f.z) * dt * 0.6;
        f.x += v;
        f.z += v * riverSlope(f.x);
        f.wag += dt * 8;
        L.x = f.x + Math.cos(f.heading) * f.len * 0.45;
        L.z = f.z + Math.sin(f.heading) * f.len * 0.45;
        if (f.t > STRIKE_WINDOW * (f.len > 1 ? 0.75 : 1)) {
          spook(f, rand(0, Math.PI * 2), 7);
          L.state = 'drifting';
          cb.note(HINT.missed);
        }
        break;
      }
      case 'spook': {
        depth = -0.22;
        const sp = 2.4 * Math.max(0.15, 1 - f.t);
        f.x = clamp(f.x + Math.cos(f.runAngle) * sp * dt, WALL_X + 0.6, LOGFALL_X - 0.4);
        f.z = wet(f.x, f.z + Math.sin(f.runAngle) * sp * dt, 0.45);
        f.heading = lerpAngle(f.heading, f.runAngle, 1 - Math.exp(-dt * 10));
        f.wag += dt * 18;
        if (f.t > 1) {
          settle(w, f);
          f.state = 'enter';
        }
        break;
      }
      case 'hooked': {
        f.runT -= dt;
        if (f.runT <= 0) {
          f.runAngle = Math.atan2(f.z - tipZ, f.x - tipX) + rand(-1.6, 1.6);
          f.runT = rand(0.4, 1.0);
        }
        const run = (0.55 + f.len * 0.55) * f.energy;
        let vx = Math.cos(f.runAngle) * run;
        let vz = Math.sin(f.runAngle) * run;
        const dx = tipX - f.x;
        const dz = tipZ - f.z;
        const d = Math.hypot(dx, dz) || 1;
        // Reeling against a run loads the tippet; let it run and it eases off.
        const away = vx * dx + vz * dz < 0;
        if (w.reeling) {
          vx += (dx / d) * 1.6;
          vz += (dz / d) * 1.6;
          w.tension += ((f.len - 0.35) * f.energy * (away ? 1.8 : 0.5) - 0.1) * dt;
        } else w.tension -= dt * 0.8;
        w.tension = clamp(w.tension, 0, 1);
        f.energy = Math.max(0.18, f.energy - dt * (0.04 + w.tension * 0.14));
        if (w.tension >= 1) {
          w.hooked = null;
          w.reeling = false;
          w.tension = 0;
          L.state = 'idle';
          spook(f, f.runAngle, 12);
          fx.splash(f.x, f.z, 6);
          cb.snapped();
          break;
        }
        f.x = clamp(f.x + vx * dt, w.xMin - 0.5, w.xMax + 0.5);
        f.z = wet(f.x, f.z + vz * dt, 0.2);
        f.heading = lerpAngle(f.heading, Math.atan2(vz, vx), 1 - Math.exp(-dt * 8));
        f.wag += dt * 20;
        // Now and then it jumps clear of the water.
        f.jumpT -= dt;
        depth = -0.08;
        if (f.jumpT < 0) {
          const jp = -f.jumpT / 0.55;
          depth = Math.sin(Math.PI * Math.min(1, jp)) * 0.7;
          if (jp >= 1) {
            f.jumpT = rand(1.6, 3.2);
            fx.ring(f.x, f.z, 0.6, 0.8);
            fx.splash(f.x, f.z, 8);
            fx.snd.splash(f.len * 0.7);
          }
        } else if (Math.random() < dt * 3) {
          fx.ring(f.x, f.z, 0.35, 0.6);
        }
        L.x = f.x + Math.cos(f.heading) * f.len * 0.45;
        L.z = f.z + Math.sin(f.heading) * f.len * 0.45;
        L.y = Math.max(0.02, depth);
        if (d < 0.5) {
          f.state = 'leap';
          f.t = 0;
          f.from.set(f.x, depth, f.z);
          w.hooked = null;
          w.reeling = false;
          w.tension = 0;
          L.state = 'idle';
          fx.splash(f.x, f.z, 12);
          fx.ring(f.x, f.z, 0.8, 0.9);
          fx.snd.splash(0.6);
        }
        break;
      }
      case 'leap':
      case 'held':
      case 'release':
        break;
    }

    // Out of the water: up into his hands, and back.
    if (f.state === 'leap') {
      const p = Math.min(1, f.t / 0.6);
      f.to.copy(avatarHands);
      f.x = f.from.x + (f.to.x - f.from.x) * p;
      f.z = f.from.z + (f.to.z - f.from.z) * p;
      depth = f.from.y + (f.to.y - f.from.y) * p + Math.sin(Math.PI * p) * 1.2;
      f.wag += dt * 30;
      if (p >= 1) {
        f.state = 'held';
        cb.landed();
      }
    } else if (f.state === 'held') {
      f.x = avatarHands.x;
      f.z = avatarHands.z;
      depth = avatarHands.y + Math.sin(w.time * 3) * 0.02;
      f.heading = Math.PI;
      f.wag += dt * 12;
    } else if (f.state === 'release') {
      const p = Math.min(1, f.t / 0.7);
      f.x = f.from.x + (f.to.x - f.from.x) * p;
      f.z = f.from.z + (f.to.z - f.from.z) * p;
      depth = f.from.y + (f.to.y - f.from.y) * p + Math.sin(Math.PI * p) * 1.0;
      f.heading = lerpAngle(f.heading, Math.atan2(f.to.z - f.from.z, f.to.x - f.from.x), 1 - Math.exp(-dt * 8));
      f.wag += dt * 20;
      if (p >= 1) {
        fx.splash(f.x, f.z, 10);
        fx.ring(f.x, f.z, 0.8, 1);
        fx.snd.splash(0.5);
        spook(f, rand(-Math.PI, 0), 10);
      }
    }
    f.y = approach(f.y, depth, f.state === 'leap' || f.state === 'held' || f.state === 'release' || f.state === 'hooked' ? 60 : 4, dt);
  }
}

export default function FlyFishing({ posts }: { posts: FishPost[] }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const tensionRef = useRef<HTMLSpanElement>(null);
  const flipRef = useRef<() => void>(() => {});
  const releaseRef = useRef<() => void>(() => {});
  const poolRef = useRef<{ slug: string; title: string; images: string[] }[]>([]);
  const seenRef = useRef(new Set<string>());
  const pendingRef = useRef<{ c: Catch | null; species: SpeciesId; inches: number; fly: FlyId } | null>(null);
  const tieRef = useRef<(id: FlyId) => void>(() => {});
  const rockRef = useRef<() => void>(() => {});
  const putBackRef = useRef<() => void>(() => {});
  const soundRef = useRef<Sound | null>(null);
  const logRef = useRef<Log>(loadLog());
  const openRef = useRef(false);
  const logOpenRef = useRef(false);
  const dressRef = useRef<(look: Look) => void>(() => {});
  const boardsRef = useRef<Boards | null>(null);
  const nameRef = useRef('');
  /** This visit: a fresh id per page load, and the running tally. */
  const sessionRef = useRef({ id: '', count: 0, inches: 0 });

  const [hint, setHint] = useState<string>(HINT.cast);
  const [count, setCount] = useState(0);
  const [fighting, setFighting] = useState(false);
  const [card, setCard] = useState<Card | null>(null);
  const [log, setLog] = useState<Log>(logRef.current);
  const [pane, setPane] = useState<Pane>(null);
  const [poolSize, setPoolSize] = useState(0);
  const [flyId, setFlyId] = useState<FlyId>('adams');
  const [under, setUnder] = useState<{ bugs: NymphId[]; say: string } | null>(null);
  const [clock, setClock] = useState('');
  const [onWater, setOnWater] = useState<BugId | null>(null);
  const [muted, setMuted] = useState(false);
  const [look, setLook] = useState<Look>(DEFAULT_LOOK);
  const [boards, setBoards] = useState<Boards | null | 'offline'>(null);
  const [board, setBoard] = useState<'fish' | 'sessions'>('fish');
  const [name, setName] = useState('');
  /** The name the server settled on, for spotting your own rows. */
  const [you, setYou] = useState('');
  const cardRef = useRef<HTMLElement>(null);
  openRef.current = !!card;
  logOpenRef.current = !!pane || !!under;
  /** One panel at a time down in the corner. */
  const panel = (which: Pane) => {
    setPane(which);
    setUnder(null);
  };
  const toggle = (which: Exclude<Pane, null>) => panel(pane === which ? null : which);

  useEffect(() => {
    const l = loadLook();
    setLook(l);
    dressRef.current(l);
    const saved = localStorage.getItem(NAME_KEY) ?? '';
    nameRef.current = saved;
    setName(saved || (localStorage.getItem('hp-thoughts-name') ?? '').slice(0, 12));
    setYou(saved);
    sessionRef.current.id = crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    fetchBoards();
  }, []);

  function fetchBoards() {
    fetch('/api/fish/scores')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((b: Boards) => {
        boardsRef.current = b;
        setBoards(b);
      })
      .catch(() => {
        if (!boardsRef.current) setBoards('offline');
      });
  }

  /** Post whatever this catch and this visit earned. Resolves to the card's badge. */
  async function postScore(p: { species: SpeciesId; fly: FlyId; inches: number }, as: string) {
    const b = boardsRef.current;
    if (!b || !as) return undefined;
    const s = sessionRef.current;
    const fish = makes(b.fish, (r) => p.inches > r.inches);
    const session = makes(b.sessions, (r) => s.count > r.count || (s.count === r.count && s.inches > r.inches));
    if (!fish && !session) return undefined;
    try {
      const r = await fetch('/api/fish/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: as,
          sessionId: s.id,
          fish: fish ? { species: p.species, fly: p.fly, inches: p.inches } : undefined,
          session: session ? { count: s.count, inches: s.inches } : undefined,
        }),
      });
      if (!r.ok) return undefined;
      const next: Boards & { name: string } = await r.json();
      boardsRef.current = next;
      setBoards(next);
      setYou(next.name);
      const mine = (row: { name: string }) => row.name.toLowerCase() === next.name.toLowerCase();
      const fi = next.fish.findIndex((row) => mine(row) && row.inches === p.inches);
      const si = next.sessions.findIndex((row) => mine(row) && row.count === s.count);
      if (fi >= 0) return `#${fi + 1} biggest fish`;
      if (si >= 0) return `#${si + 1} best visit`;
    } catch {}
    return undefined;
  }

  function saveName(raw: string) {
    const n = raw.trim().slice(0, 12);
    nameRef.current = n;
    setName(n);
    try {
      if (n) localStorage.setItem(NAME_KEY, n);
      else localStorage.removeItem(NAME_KEY);
    } catch {}
    return n;
  }

  function dress(next: Look) {
    setLook(next);
    dressRef.current(next);
    try {
      localStorage.setItem(LOOK_KEY, JSON.stringify(next));
    } catch {}
  }

  useEffect(() => {
    const titles = new Map(posts.map((p) => [p.slug, p.title]));
    fetch('/gallery.json')
      .then((r) => r.json())
      .then((map: Record<string, string[]>) => {
        poolRef.current = Object.entries(map)
          .filter(([slug]) => titles.has(slug))
          .map(([slug, images]) => ({ slug, title: titles.get(slug)!, images: images.filter((src) => IMAGE_EXT.test(src)) }))
          .filter((p) => p.images.length);
        setPoolSize(poolRef.current.length);
      })
      .catch(() => {});
  }, [posts]);

  /** A random post, then a random image from it, so photo-heavy trips don't
      flood the creel. Leans toward posts you haven't pulled out yet. */
  function pickCatch(): Catch | null {
    const pool = poolRef.current;
    if (!pool.length) return null;
    const fresh = pool.filter((p) => !logRef.current.posts[p.slug]);
    const from = fresh.length && Math.random() < 0.7 ? fresh : pool;
    for (let tries = 0; tries < 12; tries++) {
      const post = from[Math.floor(Math.random() * from.length)];
      const src = post.images[Math.floor(Math.random() * post.images.length)];
      if (!seenRef.current.has(src) || tries === 11) {
        seenRef.current.add(src);
        return { src, slug: post.slug, title: post.title };
      }
    }
    return null;
  }

  useEffect(() => {
    const host = hostRef.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.setClearColor('#97cb53');
    const el = renderer.domElement;
    Object.assign(el.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', touchAction: 'none', cursor: 'crosshair' });
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', 'A voxel trout stream. Tap the water to cast and your bank to walk; swipe to mend, hold for slack; tap when a fish rises, hold to reel. Keys: space, arrows, M and N to mend, S for slack, F for the fly box, 1 to 7 to tie on, R to turn a rock, V to switch sides, H for high scores, C to change your angler.');
    host.appendChild(el);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
    const hemi = new THREE.HemisphereLight('#ffffff', '#9cc96b', 1.5);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight('#fff4e0', 2.4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0008;
    scene.add(sun, sun.target);

    const terrain = buildTerrain(POLAR);
    scene.add(terrain.group);

    const av: Avatar = buildAvatar(loadLook());
    scene.add(av.root);
    // A little hop when he changes his kit.
    let hop = 0;
    dressRef.current = (l) => {
      av.dress(l);
      hop = 0.001;
    };
    let fly = buildFly();
    scene.add(fly);
    const sound = createSound();
    soundRef.current = sound;
    setMuted(sound.muted);

    // The rig, drawn as screen-space lines so each section keeps its weight at any zoom.
    const rig = RIG.map((r) => {
      const geo = new LineGeometry();
      geo.setPositions(new Float32Array(r.points * 3));
      const mat = new LineMaterial({ color: r.color, linewidth: r.width, transparent: r.opacity < 1, opacity: r.opacity });
      const line = new Line2(geo, mat);
      line.frustumCulled = false;
      scene.add(line);
      return { ...r, geo, mat, line, pos: new Float32Array(r.points * 3) };
    });

    // A V of wake behind the fly when the line drags it.
    const wakeMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false });
    const wake = new THREE.Group();
    for (const s of [-1, 1]) {
      const arm = new THREE.Group();
      arm.rotation.y = s * 0.45;
      const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), wakeMat);
      m.scale.set(0.45, 0.01, 0.03);
      m.position.x = -0.22;
      m.renderOrder = 3;
      arm.add(m);
      wake.add(arm);
    }
    scene.add(wake);

    // Current streaks on the surface.
    const streaks: Streak[] = Array.from({ length: 170 }, () => {
      const x = rand(-13, 13);
      return { x, z: laneZ(x, rand(-0.9, 0.9)), len: rand(0.2, 0.55), seed: rand(0, 100) };
    });
    const streakMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.5, depthWrite: false });
    const streakMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), streakMat, streaks.length);
    streakMesh.renderOrder = 3;
    scene.add(streakMesh);

    // Ring and droplet pools.
    const rings: Ring[] = Array.from({ length: 16 }, () => {
      const mesh = new THREE.Mesh(
        new THREE.RingGeometry(0.82, 1, 24),
        new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false }),
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.visible = false;
      mesh.renderOrder = 4;
      scene.add(mesh);
      return { mesh, life: 1, max: 1, size: 1 };
    });
    const drops: Drop[] = Array.from({ length: 48 }, () => {
      const mesh = box(0.07, 0.07, 0.07, '#ffffff', 0, -5, 0, false);
      mesh.visible = false;
      scene.add(mesh);
      return { mesh, v: new THREE.Vector3(), life: 0 };
    });
    let ringIdx = 0;
    let dropIdx = 0;
    const fx: Fx = {
      snd: sound,
      ring(x, z, size, max = 0.8, delay = 0) {
        const r = rings[ringIdx++ % rings.length];
        r.life = -delay;
        r.max = max;
        r.size = size;
        r.mesh.position.set(x, 0.02, z);
      },
      splash(x, z, n) {
        for (let i = 0; i < n; i++) {
          const d = drops[dropIdx++ % drops.length];
          d.life = rand(0.4, 0.7);
          d.mesh.position.set(x + rand(-0.1, 0.1), 0.05, z + rand(-0.1, 0.1));
          const a = rand(0, Math.PI * 2);
          const s = rand(0.6, 1.4);
          d.v.set(Math.cos(a) * s, rand(2, 3.4), Math.sin(a) * s);
          d.mesh.visible = true;
        }
      },
    };

    // Time of day starts at the local clock; ?t=21&wx=rain to try another.
    const q = new URLSearchParams(location.search);
    const now0 = new Date();
    const hour0 = Number(q.get('t') ?? NaN);
    let weather: Weather = (['clear', 'cloudy', 'rain'] as const).find((x) => x === q.get('wx')) ?? (Math.random() < 0.5 ? 'clear' : Math.random() < 0.6 ? 'cloudy' : 'rain');
    const WX = { clear: { cloud: 0.08, rain: 0 }, cloudy: { cloud: 0.75, rain: 0 }, rain: { cloud: 0.9, rain: 1 } };
    let nextWeather = rand(1, 3) * HOUR;

    const world: World = {
      xMin: -6, xMax: 6, avatarX: 0, avatarZ: bankZ(0),
      fly: 'adams',
      hour: Number.isFinite(hour0) ? hour0 : now0.getHours() + now0.getMinutes() / 60,
      cloud: WX[weather].cloud, rain: WX[weather].rain * (Math.random() < 0.5 ? 0.45 : 1),
      hatch: null, hatchK: 0, bugs: [],
      walkTo: null, walkDir: 0, walking: 0,
      fish: [], lies: [], rocks: terrain.rocks,
      line: {
        state: 'idle', t: 0, fx: 0, fz: 0, tx: 0, tz: 0, x: 0, y: 1, z: edgeZ(-1, 0), drift: 0,
        nx: new Float32Array(NODES), nz: new Float32Array(NODES), rest: 0.3, rest0: 0.3,
        mendT: 0, mdx: new Float32Array(NODES), mdz: new Float32Array(NODES), feeding: false, drag: 0, dragX: 1, dragZ: 0, belly: 0,
      },
      hooked: null, reeling: false, tension: 0, tip: new THREE.Vector3(0, 2, edgeZ(-1, 0)), time: 0, castKick: 0,
    };
    let rainHeavy = world.rain > 0.6;
    {
      const h = strongest(world.hour, world.cloud, world.rain);
      if (h.k > 0.35) world.hatch = h.id;
      world.hatchK = world.hatch ? h.k : 0;
    }

    // Rain: streaks falling around wherever we're looking, and rings where they land.
    const RAIN_N = 260;
    const rainMat = new THREE.MeshBasicMaterial({ color: '#d8e6f2', transparent: true, opacity: 0.4, depthWrite: false });
    const rainMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.018, 0.32, 0.018), rainMat, RAIN_N);
    rainMesh.frustumCulled = false;
    rainMesh.renderOrder = 5;
    scene.add(rainMesh);
    const rainDrops = Array.from({ length: RAIN_N }, () => ({ x: rand(-12, 12), y: rand(0, 9), z: rand(-7, 7) }));
    const DIMPLE_N = 70;
    const dimpleMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.35, depthWrite: false });
    const dimpleMesh = new THREE.InstancedMesh(new THREE.RingGeometry(0.75, 1, 14).rotateX(-Math.PI / 2), dimpleMat, DIMPLE_N);
    dimpleMesh.frustumCulled = false;
    dimpleMesh.renderOrder = 4;
    scene.add(dimpleMesh);
    const dimples = Array.from({ length: DIMPLE_N }, () => ({ x: 0, z: 0, life: 1 }));
    let dimpleIdx = 0;

    // Fireflies over the grass on summer nights.
    const FLY_N = 64;
    const glowMat = new THREE.MeshBasicMaterial({ color: '#e9ff8a', transparent: true, opacity: 0.95, depthWrite: false });
    const glowMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.09, 0.09, 0.09), glowMat, FLY_N);
    glowMesh.frustumCulled = false;
    scene.add(glowMesh);
    const glows = Array.from({ length: FLY_N }, (_, i) => {
      const x = rand(-13, 13);
      const side = i % 3 ? 1 : -1;
      return { x, z: edgeZ(side, x) + side * rand(0.3, 2.6), y: rand(0.55, 1.6), seed: rand(0, 100) };
    });

    // Naturals, pooled by kind.
    const bugPool: Partial<Record<BugId, Bug[]>> = {};
    const spawnBug = (id: BugId) => {
      const free = (bugPool[id] ??= []).find((b) => b.life <= 0 && !b.root.visible);
      let b = free;
      if (!b) {
        const m = buildBug(id);
        scene.add(m.root);
        b = { id, root: m.root, wings: m.wings, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, t: 0, life: 0, air: false, heading: Math.PI };
        bugPool[id]!.push(b);
      }
      const x = rand(world.xMin - 1.5, world.xMax);
      const bank = id === 'hopper';
      const z = laneZ(x, bank ? Math.sign(rand(-1, 1)) * rand(0.7, 0.92) : rand(-0.85, 0.85));
      Object.assign(b, { x, z, t: 0, vx: 0, vy: 0, vz: 0, heading: Math.PI });
      if (id === 'midge') Object.assign(b, { air: true, y: rand(0.15, 0.9), life: rand(4, 8) });
      else if (id === 'hopper' || id === 'stone') Object.assign(b, { air: true, y: 0.8, vy: 0.2, vz: -Math.sign(z - riverZ(x)) * 0.6, life: rand(6, 10) });
      else Object.assign(b, { air: false, y: 0.02, life: rand(3, 6) });
      b.root.visible = true;
      world.bugs.push(b);
    };
    let bugDebt = 0;
    const stepBugs = (dt: number, t: number) => {
      if (world.hatch) {
        bugDebt += dt * world.hatchK * (world.hatch === 'midge' ? 6 : world.hatch === 'hopper' ? 0.8 : 2.6);
        while (bugDebt > 1 && world.bugs.length < 60) {
          bugDebt -= 1;
          spawnBug(world.hatch);
        }
      }
      for (const b of world.bugs) {
        b.t += dt;
        b.life -= dt;
        if (b.id === 'midge') {
          // A loose cloud, now and then touching down.
          b.x += (Math.sin(t * 3 + b.t * 5 + b.x) * 0.3 + current(b.x, b.z) * 0.2) * dt;
          b.z += Math.cos(t * 2.6 + b.t * 4) * 0.25 * dt;
          b.y = Math.max(0.02, b.y + Math.sin(t * 4 + b.t * 7) * 0.4 * dt);
          b.air = b.y > 0.05;
        } else if (b.air && b.y > 0.03 && b.life > 0 && b.vy <= 0.5) {
          // Hoppers and stones blown in off the bank, landing with a plop.
          b.vy -= 3 * dt;
          b.x += b.vx * dt;
          b.z += b.vz * dt;
          b.y += b.vy * dt;
          if (b.y <= 0.02) {
            b.y = 0.02;
            b.air = false;
            fx.ring(b.x, b.z, 0.35, 0.6);
          }
        } else if (!b.air && b.life > 0) {
          // On the water, riding the current: duns drying their wings, a hopper kicking.
          const v = flow(world, b.x, b.z) * dt;
          b.x += v;
          b.z = wet(b.x, b.z + v * riverSlope(b.x), 0.15);
          b.y = 0.02 + Math.sin(t * 5 + b.x) * 0.006;
          b.heading = Math.PI + Math.sin(b.t * 2) * 0.3;
          if (b.id === 'hopper' && Math.random() < dt * 0.5) fx.ring(b.x, b.z, 0.22, 0.4);
          if (b.id === 'caddis' && Math.random() < dt * 1.2) b.z = wet(b.x, b.z + rand(-0.2, 0.2), 0.15);
          // Duns that make it fly off.
          if (b.life < 0.6 && b.id !== 'hopper') {
            b.air = true;
            b.vy = 0.9;
            b.vx = rand(-0.4, 0.6);
            b.vz = rand(-0.3, 0.3);
          }
        } else if (b.air && b.vy > 0.5) {
          b.x += b.vx * dt;
          b.z += b.vz * dt;
          b.y += b.vy * dt;
        }
        b.root.position.set(b.x, b.y, b.z);
        b.root.rotation.y = -b.heading;
        b.wings.rotation.x = b.air ? Math.sin(t * 46 + b.x * 9) * 0.7 : 0;
        if (b.life <= 0 && (!b.air || b.y > 3 || b.id === 'midge')) b.root.visible = false;
        if (b.y > 3 && b.air) b.life = Math.min(b.life, 0);
      }
      world.bugs = world.bugs.filter((b) => b.root.visible);
    };

    // The sky: the sun's color, strength and angle through the day, dimmed by cloud and rain.
    const SKY: [number, string, number, string, string, number][] = [
      [0, '#8fa6ff', 0.45, '#3b4a7c', '#22302a', 0.68],
      [4.6, '#8fa6ff', 0.4, '#3f4c7c', '#24302a', 0.7],
      [6, '#ffab73', 1.1, '#d8a9b6', '#6b7a4c', 1.0],
      [7.5, '#ffe7c4', 2.0, '#f4f4ff', '#93bf66', 1.35],
      [12, '#fff4e0', 2.4, '#ffffff', '#9cc96b', 1.5],
      [17, '#ffe8bf', 2.25, '#fff6ea', '#9cc96b', 1.4],
      [19.2, '#ffa257', 1.7, '#ffd6ae', '#8aa95a', 1.05],
      [20.6, '#ff6f61', 0.55, '#7c6c9c', '#3e4a3a', 0.7],
      [22, '#8fa6ff', 0.45, '#3b4a7c', '#22302a', 0.68],
      [24, '#8fa6ff', 0.45, '#3b4a7c', '#22302a', 0.68],
    ];
    const ca = new THREE.Color();
    const cc = new THREE.Color();
    let glow = 1;
    let lum = 1;
    let clockKey = '';
    const smooth = (a: number, b: number, x: number) => {
      const u = clamp((x - a) / (b - a), 0, 1);
      return u * u * (3 - 2 * u);
    };
    const stepSky = (dt: number) => {
      world.hour = (world.hour + dt / HOUR) % 24;
      const h = world.hour;
      // Weather drifts in and out every hour or three.
      nextWeather -= dt;
      if (nextWeather <= 0) {
        nextWeather = rand(1, 3) * HOUR;
        const r = Math.random();
        weather = weather === 'clear' ? (r < 0.7 ? 'cloudy' : 'rain') : weather === 'rain' ? (r < 0.6 ? 'cloudy' : 'clear') : r < 0.55 ? 'clear' : 'rain';
        rainHeavy = Math.random() < 0.5;
      }
      world.cloud = approach(world.cloud, WX[weather].cloud, 0.08, dt);
      world.rain = approach(world.rain, WX[weather].rain * (rainHeavy ? 1 : 0.45), 0.1, dt);

      const i = SKY.findIndex((k) => k[0] > h);
      const a = SKY[i - 1];
      const b = SKY[i];
      const u = (h - a[0]) / (b[0] - a[0]);
      const dim = (1 - 0.6 * world.cloud) * (1 - 0.35 * world.rain);
      sun.color.set(a[1]).lerp(cc.set(b[1]), u).lerp(cc.set('#dfe6ee'), world.cloud * 0.6);
      sun.intensity = (a[2] + (b[2] - a[2]) * u) * dim;
      hemi.color.set(a[3]).lerp(cc.set(b[3]), u).lerp(cc.set('#aab7c6'), world.cloud * 0.35 + world.rain * 0.25);
      hemi.groundColor.set(a[4]).lerp(cc.set(b[4]), u);
      hemi.intensity = (a[5] + (b[5] - a[5]) * u) * (1 - 0.18 * world.rain);
      lum = clamp((hemi.intensity / 1.5) * 0.6 + (sun.intensity / 2.4) * 0.4, 0, 1);
      glow = 0.3 + 0.7 * lum;
      renderer.setClearColor(ca.set('#97cb53').multiplyScalar(0.2 + 0.8 * lum));
      // East to west across the stream by day, the moon up high at night.
      const p = clamp((h - 5.5) / 15, 0, 1);
      const day = smooth(5, 6, h) * (1 - smooth(20.4, 21.2, h));
      sunDir.set(-10 * Math.cos(p * Math.PI), 6 + 9 * Math.sin(p * Math.PI), 7);
      sunDir.lerp(moonDir, 1 - day);

      // What's coming off the water.
      const top = strongest(h, world.cloud, world.rain);
      if (!world.hatch && top.k > 0.4) {
        world.hatch = top.id;
        cb.note(HINT.hatchOn);
      } else if (world.hatch) {
        const cur = HATCHES[world.hatch](h, world.cloud, world.rain);
        if (top.id !== world.hatch && top.k > cur + 0.25) world.hatch = top.id;
        else if (cur < 0.22) {
          world.hatch = null;
          cb.note(HINT.hatchOff);
        }
      }
      world.hatchK = approach(world.hatchK, world.hatch ? HATCHES[world.hatch](h, world.cloud, world.rain) : 0, 0.6, dt);
      setOnWater(world.hatch && world.hatchK > 0.3 ? world.hatch : null);

      // The clock pill, every five minutes of river time.
      const mins = Math.floor((h * 60) / 5) * 5;
      const sky = world.rain > 0.6 ? 'rain' : world.rain > 0.12 ? 'drizzle' : world.cloud > 0.5 ? 'overcast' : lum < 0.4 ? 'stars out' : 'clear';
      const key = `${Math.floor(mins / 60) % 12 || 12}:${String(mins % 60).padStart(2, '0')} ${mins < 720 ? 'am' : 'pm'} · ${sky} · ${waterName(camX)}`;
      if (key !== clockKey) {
        clockKey = key;
        setClock(key);
      }
    };
    const moonDir = new THREE.Vector3(5, 13, 6);

    const stepWeatherFx = (dt: number, t: number) => {
      // Rain falling around the camera target, slanting a little downstream.
      const n = Math.round(RAIN_N * Math.min(1, world.rain * 1.1));
      rainMesh.count = n;
      rainMat.opacity = 0.15 + 0.35 * glow;
      quat.setFromAxisAngle(tmp.set(0, 0, 1), -0.12);
      for (let i = 0; i < n; i++) {
        const d = rainDrops[i];
        d.y -= 10 * dt;
        d.x += 1.2 * dt;
        if (d.y < 0) {
          d.y += 9;
          d.x = rand(-fw / 2 - 3, fw / 2 + 2);
          d.z = rand(-7, 7);
        }
        matrix.compose(scl.set(target.x + d.x, d.y, target.z + d.z), quat, tmp.set(1, 1, 1));
        rainMesh.setMatrixAt(i, matrix);
      }
      rainMesh.instanceMatrix.needsUpdate = true;
      // Dimples where it lands.
      let spawn = dt * 70 * world.rain;
      while (spawn > Math.random()) {
        spawn -= 1;
        const dp = dimples[dimpleIdx++ % DIMPLE_N];
        dp.x = rand(world.xMin - 1, world.xMax + 1);
        dp.z = laneZ(dp.x, rand(-0.95, 0.95));
        dp.life = 0;
      }
      dimpleMat.opacity = 0.45 * glow;
      quat.identity();
      dimples.forEach((dp, i) => {
        dp.life = Math.min(1, dp.life + dt * 2.4);
        const sc = dp.life < 1 ? 0.03 + 0.17 * easeOut(dp.life) : 0.0001;
        matrix.compose(scl.set(dp.x, 0.025, dp.z), quat, tmp.set(sc, sc, sc));
        dimpleMesh.setMatrixAt(i, matrix);
      });
      dimpleMesh.instanceMatrix.needsUpdate = true;
      // Fireflies, once it's properly dark and dry.
      const dark = clamp((0.42 - lum) / 0.22, 0, 1) * (1 - clamp(world.rain * 2, 0, 1));
      glowMesh.visible = dark > 0;
      if (dark > 0) {
        glows.forEach((g, i) => {
          const blink = Math.max(0, Math.sin(t * 1.3 + g.seed * 7)) ** 3;
          const x = g.x + Math.sin(t * 0.3 + g.seed) * 0.5;
          const sc = 0.0001 + blink * dark;
          matrix.compose(scl.set(x, g.y + Math.sin(t * 0.7 + g.seed) * 0.15, g.z + Math.cos(t * 0.25 + g.seed) * 0.4), quat, tmp.set(sc, sc, sc));
          glowMesh.setMatrixAt(i, matrix);
        });
        glowMesh.instanceMatrix.needsUpdate = true;
      }
      streakMat.opacity = 0.5 * glow;
    };

    // Lies: the soft water behind each boulder and under the log, plus a
    // scatter of seams. Big fish take the boulders.
    // The pool holds big fish too; the seams either side of the thread hold most of the rest.
    world.lies = terrain.rocks
      .filter((r) => r.x > -12.5 && r.x < LOGFALL_X - 0.6)
      .map((r) => ({ x: r.x + r.r + 0.45, z: wet(r.x + r.r + 0.45, r.z, 0.35), big: true, fish: null }));
    world.lies.push({ ...terrain.logLie, big: true, fish: null });
    for (const [x, v] of [[5.6, 0.1], [7.7, -0.25], [8.6, 0.3]]) world.lies.push({ x, z: laneZ(x, v), big: true, fish: null });
    for (let tries = 0; world.lies.length < 32 && tries < 600; tries++) {
      const x = rand(-12, LOGFALL_X - 0.8);
      const z = laneZ(x, Math.random() < 0.6 ? (Math.random() < 0.5 ? -1 : 1) * rand(0.45, 0.65) : rand(-0.8, 0.8));
      if (terrain.rocks.some((r) => Math.hypot(x - r.x, z - r.z) < r.r + 0.5)) continue;
      if (world.lies.some((l) => Math.hypot(x - l.x, z - l.z) < 1.2)) continue;
      world.lies.push({ x, z, big: false, fish: null });
    }
    world.fish = Array.from({ length: FISH_COUNT }, () => makeFish(scene)).sort((a, b) => b.len - a.len);
    for (const f of world.fish) {
      f.x = rand(-12, LOGFALL_X - 1);
      settle(world, f);
      f.x = f.hx;
      f.z = f.hz;
    }

    const ray = new THREE.Raycaster();
    const hit = new THREE.Vector3();
    const toPlane = (nx: number, ny: number, y: number) => {
      ray.setFromCamera(new THREE.Vector2(nx, ny), camera);
      return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -y), hit) ? hit.clone() : null;
    };

    // Camera: looking across at him from the trail side, or from behind him
    // (view 1). It swings between the two and follows him along the bank.
    let fw = 1;
    let fh = 1;
    let view = 0;
    let viewK = 0;
    let camX = 0;
    let camYaw = YAW;
    // Tall screens look further up the stream, so it runs down the phone.
    let baseYaw = YAW;
    let tall = 0;
    let treesHidden = false;
    const target = new THREE.Vector3();
    const sunOff = new THREE.Vector3();
    const sunDir = new THREE.Vector3(-6, 14, 7);
    const up = new THREE.Vector3(0, 1, 0);
    const probe = new THREE.Vector3();
    const frame = () => {
      const k = viewK * viewK * (3 - 2 * viewK);
      camYaw = baseYaw + (Math.PI - 2 * baseYaw) * k;
      const az = bankZ(camX);
      const across = (trailZ(camX) - az) * Math.cos(POLAR);
      // Facing us, his cap near the top and the trail below; from behind,
      // his boots near the bottom and the trail beyond. Tall screens center it.
      const blockA = 2.6 + across + 0.7 * Math.cos(POLAR);
      const yA = fh / 2 - Math.max(2.6, (fh - blockA) / 2 + 2.6);
      const blockB = 0.9 + across + 1.5;
      const yB = -fh / 2 + Math.max(0.9, (fh - blockB) / 2 + 0.9);
      const s = -(yA + (yB - yA) * k) / Math.cos(POLAR);
      // Looking up the stream, slide upstream too so there's water to cast to.
      target.set(camX - s * Math.sin(camYaw) - 2 * tall, 0, az - s * Math.cos(camYaw));
      camera.position.set(Math.sin(camYaw) * Math.sin(POLAR), Math.cos(POLAR), Math.cos(camYaw) * Math.sin(POLAR)).multiplyScalar(30).add(target);
      camera.lookAt(target);
      camera.updateMatrixWorld();
      sun.position.copy(target).add(sunOff.copy(sunDir).applyAxisAngle(up, camYaw - baseYaw));
      sun.target.position.copy(target);
      // From behind him, the trees on his bank would stand in front of the water.
      if (k > 0.5 !== treesHidden) {
        treesHidden = k > 0.5;
        terrain.screen.visible = !treesHidden;
      }
      // Playable stretch of river: as much of the thread as is on screen.
      if (viewK === 0 || viewK === 1) {
        let lo = Infinity;
        let hi = -Infinity;
        for (let x = camX - 24; x <= camX + 24; x += 0.25) {
          const p = probe.set(x, 0, riverZ(x)).project(camera);
          if (Math.abs(p.x) < 0.94 && Math.abs(p.y) < 0.86) {
            lo = Math.min(lo, x);
            hi = Math.max(hi, x);
          }
        }
        if (hi > lo) {
          world.xMin = lo + 0.3;
          world.xMax = hi - 0.3;
        }
      }
    };
    const resize = () => {
      const rect = host.getBoundingClientRect();
      const aspect = rect.width / Math.max(1, rect.height);
      renderer.setSize(rect.width, rect.height, false);
      for (const r of rig) r.mat.resolution.set(rect.width, rect.height);
      tall = clamp((0.9 - aspect) / 0.4, 0, 1);
      baseYaw = YAW + 0.5 * tall;
      // Phones keep a stream's width across; a tablet on end shouldn't zoom in
      // past ~90px a block, nor a phone on its side out past ~55.
      fh = Math.max(clamp(rect.height / 55, 6.4, 9.2), 6.8 / aspect, aspect < 1 ? rect.height / 90 : 0);
      fw = fh * aspect;
      Object.assign(camera, { left: -fw / 2, right: fw / 2, top: fh / 2, bottom: -fh / 2 });
      camera.updateProjectionMatrix();
      const sh = Math.max(fw, fh) * 1.1;
      Object.assign(sun.shadow.camera, { left: -sh, right: sh, top: sh, bottom: -sh, near: 1, far: 50 });
      sun.shadow.camera.updateProjectionMatrix();
      frame();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    // The status pill: event notes hold for a beat, otherwise it reads the state.
    let lastHint: string = HINT.cast;
    let holdUntil = 0;
    let lastFighting = false;
    const say = (h: string) => {
      if (h === lastHint) return;
      lastHint = h;
      setHint(h);
      // A tap in the hand when a fish takes, where phones allow it.
      if (h === HINT.strike) navigator.vibrate?.(35);
    };
    const upArrow = () => (Math.cos(camYaw) > 0 ? '←' : '→');
    const driftHint = () => {
      const L = world.line;
      if (L.drag < 0.07) return HINT.dead;
      const fix = Math.abs(L.belly) > 0.12 ? `swipe ${L.belly > 0 ? upArrow() : upArrow() === '←' ? '→' : '←'} to mend` : 'hold for slack';
      return `${L.drag < 0.18 ? 'a little drag' : 'dragging'} · ${fix}`;
    };

    const cb: Callbacks = {
      note: (h) => {
        say(h);
        holdUntil = world.time + 1.8;
      },
      landed: () => {
        const p = pendingRef.current;
        pendingRef.current = null;
        if (!p) return;
        sound.landed();
        navigator.vibrate?.([20, 60, 20]);
        const prev = logRef.current;
        const s = prev.species[p.species];
        const next: Log = {
          total: prev.total + 1,
          posts: p.c ? { ...prev.posts, [p.c.slug]: prev.posts[p.c.slug] ?? p.c.src } : prev.posts,
          species: { ...prev.species, [p.species]: { n: (s?.n ?? 0) + 1, best: Math.max(s?.best ?? 0, p.inches) } },
        };
        const c: Card = { ...p, newPost: !!p.c && !prev.posts[p.c.slug], newSpecies: !s, best: !!s && p.inches > s.best };
        const visit = sessionRef.current;
        visit.count += 1;
        visit.inches += p.inches;
        // Make the board: post under the saved name, or ask for one on the card.
        const b = boardsRef.current;
        if (b && !nameRef.current) {
          c.ask = makes(b.fish, (r) => p.inches > r.inches) || makes(b.sessions, (r) => visit.count > r.count || (visit.count === r.count && visit.inches > r.inches));
        } else if (b) {
          postScore(p, nameRef.current).then((rank) => rank && setCard((cur) => (cur && cur.inches === p.inches && cur.species === p.species ? { ...cur, rank } : cur)));
        }
        logRef.current = next;
        try {
          localStorage.setItem(LOG_KEY, JSON.stringify(next));
        } catch {}
        setLog(next);
        setCount((n) => n + 1);
        // A beat to admire it before the card comes up.
        setTimeout(() => setCard(c), 700);
      },
      snapped: () => {
        pendingRef.current = null;
        sound.snap();
        cb.note(HINT.snapped);
      },
    };

    const holding = () => world.fish.some((f) => f.state === 'leap' || f.state === 'held');
    const busy = () => holding() || (viewK !== 0 && viewK !== 1);

    const walkTo = (x: number) => {
      const L = world.line;
      if (L.state === 'fighting' || L.state === 'taken' || holding()) return;
      if (x < WALK_MIN - 0.3) cb.note(HINT.wall);
      else if (x > WALK_MAX + 0.3) cb.note(HINT.logfall);
      world.walkTo = clamp(x, WALK_MIN, WALK_MAX);
      crouch = 0;
    };

    const strike = () => {
      const L = world.line;
      const f = world.fish.find((x) => x.state === 'rise');
      if (!f) return;
      let path = 0;
      for (let i = 1; i < NODES; i++) path += Math.hypot(L.nx[i] - L.nx[i - 1], L.nz[i] - L.nz[i - 1]);
      // A pile of loose line soaks up the strike.
      if ((L.rest * (NODES - 1)) / Math.max(0.5, path) > 1.6 && Math.random() < 0.5) {
        spook(f, rand(0, Math.PI * 2), 7);
        L.state = 'drifting';
        cb.note(HINT.slack);
        return;
      }
      f.state = 'hooked';
      f.runT = 0;
      f.energy = 1;
      f.jumpT = rand(0.6, 1.4);
      world.hooked = f;
      world.reeling = true;
      world.tension = 0;
      L.state = 'fighting';
      const c = pickCatch();
      pendingRef.current = { c, species: f.species, inches: inches(f.len), fly: world.fly };
      sound.strike();
      if (c) new Image().src = c.src;
      fx.splash(f.x, f.z, 8);
    };

    /** Tap: strike, reel, cast to the water, or walk to a spot on his bank. `auto` casts somewhere upstream. */
    const act = (nx: number, ny: number, auto = false) => {
      const L = world.line;
      if (busy()) return;
      if (L.state === 'taken') return strike();
      if (L.state === 'fighting') {
        world.reeling = true;
        return;
      }
      let p: THREE.Vector3 | null;
      if (auto) {
        const x = world.avatarX - rand(1, 5);
        p = new THREE.Vector3(x, 0, laneZ(x, rand(-0.75, 0.55)));
      } else p = toPlane(nx, ny, 0);
      if (!p) return;
      if (p.z < edgeZ(-1, p.x) || p.z > edgeZ(1, p.x)) {
        const b = toPlane(nx, ny, BANK_Y);
        if (b && b.z < edgeZ(-1, b.x)) walkTo(b.x);
        return;
      }
      crouch = 0;
      const chaser = world.fish.find((f) => f.state === 'chase');
      if (L.state === 'drifting' && chaser) {
        spook(chaser, rand(0, Math.PI * 2), 5);
        cb.note(HINT.early);
      }
      const dx = p.x - world.avatarX;
      const dz = p.z - world.avatarZ;
      const d = Math.hypot(dx, dz);
      if (d > MAX_CAST) p.set(world.avatarX + (dx / d) * MAX_CAST, 0, world.avatarZ + (dz / d) * MAX_CAST);
      for (const f of world.fish) if (f.state === 'chase') f.state = 'hold';
      Object.assign(L, {
        state: 'casting', t: 0, feeding: false,
        fx: L.state === 'idle' ? world.tip.x : L.x,
        fz: L.state === 'idle' ? world.tip.z : L.z,
        tx: clamp(p.x, Math.max(world.xMin, WALL_X + 0.6), Math.min(world.xMax, LOGFALL_X - 0.4)),
      });
      L.tz = wet(L.tx, p.z, 0.15);
      world.walkTo = null;
      world.castKick = 0.25;
      sound.cast();
    };
    const mend = (dir: number) => {
      if (busy()) return;
      if (mendLine(world.line, dir)) sound.mend();
    };
    flipRef.current = () => {
      if (!holding()) view = 1 - view;
    };
    releaseRef.current = () => {
      const f = world.fish.find((x) => x.state === 'held');
      if (!f) return;
      f.state = 'release';
      f.t = 0;
      f.from.set(f.x, f.y, f.z);
      const x = f.x + rand(-1.5, 1.5);
      f.to.set(x, -0.1, laneZ(x, rand(-0.6, 0.2)));
    };

    // Tie on another fly. Reels in first.
    tieRef.current = (id) => {
      const L = world.line;
      if (L.state === 'fighting' || L.state === 'taken' || holding()) return;
      L.state = 'idle';
      world.fly = id;
      scene.remove(fly);
      fly = buildFly(id);
      scene.add(fly);
      setFlyId(id);
      const f = flyOf(id);
      cb.note(`tied on a #${f.size} ${f.name}`);
    };

    // Turn a stone at the edge: he crouches, lifts it, and we get a close look.
    let crouch = 0;
    let stone: THREE.Object3D | null = null;
    let stoneAt = { x: 0, z: 0 };
    rockRef.current = () => {
      const L = world.line;
      if (L.state === 'fighting' || L.state === 'taken' || holding() || busy()) return;
      if (crouch > 0) {
        crouch = 0;
        setUnder(null);
        return;
      }
      L.state = 'idle';
      world.walkTo = null;
      crouch = 0.001;
      if (stone) scene.remove(stone);
      stone = lump('#7d7466', 0.34, 0.16, 0.26, rand(0, 9));
      stoneAt = { x: world.avatarX + 0.25, z: edgeZ(-1, world.avatarX + 0.25) + 0.18 };
      stone.position.set(stoneAt.x, -0.04, stoneAt.z);
      scene.add(stone);
      sound.rockFlip();
      cb.note(HINT.rock);
      // What's under it says what's coming off next.
      const next = strongest(world.hour + 1.5, world.cloud, world.rain);
      const id = next.k > 0.15 ? next.id : world.hatch ?? 'midge';
      const kinds: NymphId[] = ['olive', 'pale', 'caddis', 'stone', 'midge'];
      const bugs: NymphId[] = Array.from({ length: 3 + Math.floor(Math.random() * 2) }, () => UNDER[id].nymph);
      for (let i = 0; i < 1 + Math.floor(Math.random() * 2); i++) bugs.push(kinds[Math.floor(Math.random() * kinds.length)]);
      setTimeout(() => {
        if (crouch > 0) {
          setPane(null);
          setUnder({ bugs, say: UNDER[id].say });
        }
      }, 650);
    };
    putBackRef.current = () => {
      crouch = 0;
    };

    // Pointer: a tap acts at once, except mid-drift, where a sideways swipe
    // mends, a press-and-hold feeds slack, and a quick tap recasts.
    let gesture: { x: number; y: number; t: number; nx: number; ny: number; mode: 'pending' | 'done' | 'slack' } | null = null;
    const ndc = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      return [((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1];
    };
    const onDown = (e: PointerEvent) => {
      sound.unlock();
      if (openRef.current) return;
      if (logOpenRef.current) {
        setPane(null);
        setUnder(null);
        crouch = 0;
        return;
      }
      el.setPointerCapture(e.pointerId);
      const [nx, ny] = ndc(e);
      if (world.line.state === 'drifting' && !busy()) gesture = { x: e.clientX, y: e.clientY, t: performance.now(), nx, ny, mode: 'pending' };
      else act(nx, ny);
    };
    const onMove = (e: PointerEvent) => {
      if (gesture?.mode !== 'pending') return;
      const dx = e.clientX - gesture.x;
      if (Math.abs(dx) > 22 && Math.abs(dx) > Math.abs(e.clientY - gesture.y)) {
        // Screen right is downstream from the trail side, upstream from behind him.
        mend(Math.sign(dx) * Math.sign(Math.cos(camYaw)));
        gesture.mode = 'done';
      }
    };
    const onUp = () => {
      if (gesture?.mode === 'pending' && world.line.state === 'drifting') act(gesture.nx, gesture.ny);
      gesture = null;
      world.reeling = false;
      world.line.feeding = false;
    };
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);

    // Keys: space works the rod, arrows walk, M and N mend, S feeds slack, V turns the view.
    const typing = (e: KeyboardEvent) => (e.target as HTMLElement).closest('input, textarea, button, a, [contenteditable]');
    const onKey = (e: KeyboardEvent) => {
      sound.unlock();
      if (openRef.current || typing(e) || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (/^[1-7]$/.test(k) && !e.repeat) {
        tieRef.current(FLIES[Number(k) - 1].id);
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        if (!e.repeat) act(2, 2, true);
      } else if (k === 'arrowleft' || k === 'arrowright' || k === 'a' || k === 'd') {
        e.preventDefault();
        const L = world.line;
        if (L.state === 'fighting' || L.state === 'taken' || holding()) return;
        world.walkDir = (k === 'arrowleft' || k === 'a' ? -1 : 1) * Math.sign(Math.cos(camYaw));
        crouch = 0;
      } else if ((k === 'm' || k === 'n') && !e.repeat) mend(k === 'm' ? -1 : 1);
      else if (k === 's' && world.line.state === 'drifting') world.line.feeding = true;
      else if (k === 'v' && !e.repeat) flipRef.current();
      else if ((k === 'l' || k === 'h' || k === 'f' || k === 'c') && !e.repeat) {
        const which = ({ l: 'log', h: 'scores', f: 'box', c: 'angler' } as const)[k];
        setPane((o) => (o === which ? null : which));
        setUnder(null);
      } else if (k === 'r' && !e.repeat) rockRef.current();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (e.code === 'Space') world.reeling = false;
      if (k === 's') world.line.feeding = false;
      if (k === 'arrowleft' || k === 'arrowright' || k === 'a' || k === 'd') world.walkDir = 0;
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);

    const hands = new THREE.Vector3();
    const tmp = new THREE.Vector3();
    const matrix = new THREE.Matrix4();
    const quat = new THREE.Quaternion();
    const scl = new THREE.Vector3();
    const poly = new Float32Array(64 * 3);
    const cum = new Float32Array(64);
    let yaw = 0;
    let pitch = 0.75;
    let bend = 0.05;
    let stride = 0;
    let face = 1;

    // Now and then someone rides by on the trail, sometimes a pair.
    const riders: Rider[] = [];
    let nextRide = rand(4, 8);
    const ride = (dir: number, speed: number, wait: number) => {
      let r = riders.find((x) => !x.bike.root.visible && x.wait <= 0);
      if (!r) {
        r = { bike: buildBike(), x: 0, dir, speed, crank: 0, wait: 0, end: 0, rang: false };
        scene.add(r.bike.root);
        riders.push(r);
      }
      // Start and finish just off screen, measured along the trail.
      const reach = (world.xMax - world.xMin) / 2 + 8;
      const mid = target.x + (trailZ(target.x) - target.z) * Math.tan(camYaw);
      Object.assign(r, { x: mid - dir * reach, end: mid + dir * reach, dir, speed, wait, rang: false });
      r.bike.root.visible = wait <= 0;
    };
    let bikeNear = 0;
    const stepRiders = (dt: number) => {
      bikeNear = 0;
      nextRide -= dt;
      if (nextRide <= 0 && (viewK === 0 || viewK === 1)) {
        const dir = Math.random() < 0.5 ? 1 : -1;
        const speed = rand(2.2, 3.2);
        ride(dir, speed, 0);
        if (Math.random() < 0.25) ride(dir, speed, rand(0.35, 0.6));
        nextRide = rand(15, 35);
      }
      for (const r of riders) {
        if (r.wait > 0) {
          r.wait -= dt;
          if (r.wait <= 0) r.bike.root.visible = true;
          continue;
        }
        if (!r.bike.root.visible) continue;
        r.x += r.dir * r.speed * dt;
        bikeNear = Math.max(bikeNear, clamp(1 - Math.abs(r.x - camX) / 9, 0, 1));
        // A friendly ding passing an angler, sometimes.
        if (!r.rang && Math.abs(r.x - world.avatarX) < 3) {
          r.rang = true;
          if (Math.random() < 0.45) sound.bell();
        }
        if ((r.x - r.end) * r.dir > 0) {
          r.bike.root.visible = false;
          continue;
        }
        const slope = (trailZ(r.x + 0.05) - trailZ(r.x - 0.05)) / 0.1;
        r.bike.root.position.set(r.x, BANK_Y, trailZ(r.x));
        r.bike.root.rotation.y = -Math.atan2(r.dir * slope, r.dir);
        // Wheels roll at ground speed; the cranks turn slower, in a big gear.
        const turn = (r.speed / 1.45 / BIKE_WHEEL_R) * dt;
        for (const w of r.bike.wheels) w.rotation.z -= turn;
        r.crank += turn * 0.45;
        r.bike.legs.forEach((leg, i) => {
          const a = r.crank + i * Math.PI;
          const px = BIKE_CRANK.x + Math.cos(a) * BIKE_CRANK.r;
          const py = BIKE_CRANK.y - Math.sin(a) * BIKE_CRANK.r;
          const dx = px - BIKE_HIP.x;
          const dy = py - (BIKE_HIP.y - 0.04);
          leg.rotation.z = Math.atan2(dx, -dy);
          leg.children[0].scale.y = Math.hypot(dx, dy);
        });
      }
    };

    /** Sample n points between arc lengths a and b of the polyline into out. */
    let seg = 0;
    const sample = (pn: number, a: number, b: number, n: number, out: Float32Array) => {
      for (let i = 0; i < n; i++) {
        const s = a + ((b - a) * i) / (n - 1);
        while (seg < pn - 2 && cum[seg + 1] < s) seg++;
        const u = clamp((s - cum[seg]) / (cum[seg + 1] - cum[seg] || 1), 0, 1);
        for (let j = 0; j < 3; j++) out[i * 3 + j] = poly[seg * 3 + j] + (poly[seg * 3 + 3 + j] - poly[seg * 3 + j]) * u;
      }
    };

    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = clamp((now - last) / 1000, 0, 0.05);
      last = now;
      const t = world.time;
      const L = world.line;
      const isHolding = holding();

      // Walking the bank reels in and moves the camera with him.
      if (world.walkDir || world.walkTo !== null) {
        const goal = world.walkDir ? clamp(world.avatarX + world.walkDir, WALK_MIN, WALK_MAX) : world.walkTo!;
        const dx = goal - world.avatarX;
        if (world.walkDir && Math.abs(dx) < 0.04 && world.time > holdUntil) cb.note(world.walkDir < 0 ? HINT.wall : HINT.logfall);
        if (Math.abs(dx) < 0.04 || L.state === 'fighting' || L.state === 'taken' || isHolding) {
          world.walkTo = null;
          world.walking = 0;
        } else {
          if (L.state !== 'idle') L.state = 'idle';
          world.avatarX += Math.sign(dx) * Math.min(Math.abs(dx), 2.4 * dt);
          world.walking = Math.sign(dx);
        }
      } else world.walking = 0;
      world.avatarZ = bankZ(world.avatarX);
      camX = approach(camX, world.avatarX, 2.5, dt);
      stepSky(dt);
      viewK = view > viewK ? Math.min(view, viewK + dt / 1.1) : Math.max(view, viewK - dt / 1.1);
      frame();
      if (gesture?.mode === 'pending' && now - gesture.t > 280 && L.state === 'drifting') {
        gesture.mode = 'slack';
        L.feeding = true;
      }

      // Hands are where a landed fish ends up: held out broadside, grip and grin.
      av.hands.getWorldPosition(hands);
      step(world, dt, fx, cb, hands);
      stepBugs(dt, t);
      const hooked = world.hooked;
      sound.update(dt, {
        hour: world.hour,
        rain: world.rain,
        rapids: clamp((-6 - camX) / 7, 0, 1),
        riffle: reachChop(camX),
        lineOut: hooked && !world.reeling ? clamp(hooked.energy * (0.55 + hooked.len * 0.55) / 1.3, 0, 1) : 0,
        reeling: L.state === 'fighting' && world.reeling,
        bike: bikeNear,
      });

      // Status.
      if (L.state === 'taken') say(HINT.strike);
      else if (world.time > holdUntil) {
        if (L.state === 'fighting') say(world.tension > 0.7 ? HINT.run : HINT.reel);
        else if (L.state === 'drifting') say(driftHint());
        else if (L.state === 'idle') say(world.walking ? HINT.walk : HINT.cast);
      }
      if ((L.state === 'fighting') !== lastFighting) {
        lastFighting = L.state === 'fighting';
        setFighting(lastFighting);
      }
      if (tensionRef.current) {
        tensionRef.current.style.width = `${Math.round(world.tension * 100)}%`;
        tensionRef.current.style.background = world.tension > 0.7 ? '#ff5a4e' : 'var(--accent)';
      }

      // Angler pose.
      const aim = world.hooked ?? (L.state !== 'idle' ? (L.state === 'casting' ? { x: L.tx, z: L.tz } : L) : null);
      const wantYaw = aim ? clamp(Math.atan2(aim.x - world.avatarX, aim.z - world.avatarZ), -1.2, 1.2) : 0;
      if (world.walking) face = world.walking;
      const kick = L.mendT > 0 ? Math.sign(L.mdx[NODES >> 1]) * Math.sin((1 - L.mendT / MEND_TIME) * Math.PI) * 0.35 : 0;
      // Turn to show off a fish to whichever side the camera is on.
      yaw = approach(yaw, isHolding ? (view ? Math.PI : 0) : world.walking ? face * Math.PI / 2 : wantYaw + kick, world.walking ? 10 : 6, dt);
      av.root.rotation.y = Math.PI + yaw;
      let wantPitch = 0.45 + Math.sin(t * 1.5) * 0.03;
      let wantBend = 0.05;
      if (world.walking) wantPitch = 0.25;
      else if (L.state === 'casting') wantPitch = L.t / CAST_TIME < 0.3 ? -0.55 : 0.9;
      else if (L.state === 'drifting' || L.state === 'taken') wantPitch = 0.55 + (L.feeding ? Math.sin(t * 22) * 0.06 : 0) - (L.mendT > 0 ? 0.25 : 0);
      else if (L.state === 'fighting') {
        wantPitch = 0.3 + Math.sin(t * 9) * 0.05;
        wantBend = 0.3 + world.tension * 0.6;
      } else if (isHolding) wantPitch = -0.2;
      pitch = approach(pitch, wantPitch, L.state === 'casting' || L.mendT > 0 ? 20 : 6, dt);
      bend = approach(bend, wantBend, 8, dt);
      // Held out to his right so it reads full length instead of end-on.
      av.rod.rotation.set(-pitch, 0, -0.55);
      av.rodUpper.rotation.x = -bend;
      av.rightArm.rotation.x = isHolding ? 1.3 : clamp(0.35 + pitch * 0.65, -0.3, 1.4);
      av.leftArm.rotation.x = isHolding ? 1.3 : L.state === 'fighting' && world.reeling ? 0.9 + Math.sin(t * 16) * 0.35 : world.walking ? Math.sin(stride) * 0.4 : 0.45;
      av.rod.visible = !isHolding;
      if (world.walking) stride += dt * 11;
      av.legs.forEach((leg, i) => (leg.rotation.x = world.walking ? Math.sin(stride + i * Math.PI) * 0.55 : approach(leg.rotation.x, 0, 12, dt)));
      av.body.rotation.x = L.state === 'fighting' ? 0.12 : 0;
      av.body.position.y = Math.abs(Math.sin(world.walking ? stride : t * 2)) * (world.walking ? 0.04 : 0.015) + (isHolding ? Math.abs(Math.sin(t * 6)) * 0.04 : 0);
      av.body.scale.y = 1 - Math.sin((world.castKick / 0.25) * Math.PI) * 0.06;
      if (hop > 0) {
        hop += dt;
        av.body.position.y += Math.sin(Math.min(1, hop / 0.32) * Math.PI) * 0.14;
        if (hop > 0.32) hop = 0;
      }
      // Turning a stone: down on his heels, the stone up and over in his hand.
      if (crouch > 0) {
        crouch += dt;
        const c = Math.min(1, crouch / 0.35);
        av.body.position.y -= 0.22 * c;
        av.legs.forEach((leg) => (leg.rotation.x = -1.1 * c));
        av.body.rotation.x = 0.5 * c;
        av.rightArm.rotation.x = 1.0 * c;
        av.leftArm.rotation.x = 1.2 * c;
        av.rod.visible = c < 0.6;
        yaw = approach(yaw, 0.35, 6, dt);
        av.root.rotation.y = Math.PI + yaw;
        if (stone) {
          const u = clamp((crouch - 0.3) / 0.45, 0, 1);
          stone.position.set(stoneAt.x - 0.08 * u, -0.04 + 0.55 * easeOut(u), stoneAt.z - 0.1 * u);
          stone.rotation.set(Math.PI * easeOut(u), 0, 0.3 * u);
        }
      } else if (stone) {
        // Set it back the way it was.
        stone.position.y -= dt * 2.5;
        stone.rotation.x = Math.max(0, stone.rotation.x - dt * 9);
        if (stone.position.y < -0.05) {
          scene.remove(stone);
          stone = null;
          fx.ring(stoneAt.x, stoneAt.z, 0.3, 0.5);
        }
      }
      av.root.position.set(world.avatarX, BANK_Y, world.avatarZ);
      av.root.updateMatrixWorld(true);
      av.rodTip.getWorldPosition(world.tip);

      // Fly and line.
      const tip = world.tip;
      fly.visible = L.state !== 'taken' && L.state !== 'fighting';
      if (L.state === 'idle') {
        L.x = tip.x;
        L.y = tip.y - 0.4;
        L.z = tip.z;
      }
      fly.position.set(L.x, L.y, L.z);
      fly.rotation.y = L.state === 'idle' ? yaw + Math.PI / 2 : 0;
      let pn = 0;
      const push = (x: number, y: number, z: number) => {
        poly[pn * 3] = x;
        poly[pn * 3 + 1] = y;
        poly[pn * 3 + 2] = z;
        pn++;
      };
      const curve = (cx: number, cy: number, cz: number, ex: number, ey: number, ez: number, n: number, end: boolean) => {
        for (let i = 0; i < (end ? n + 1 : n); i++) {
          const s = i / n;
          const a = (1 - s) * (1 - s);
          const b = 2 * (1 - s) * s;
          const c = s * s;
          push(a * tip.x + b * cx + c * ex, a * tip.y + b * cy + c * ey, a * tip.z + b * cz + c * ez);
        }
      };
      if (L.state === 'drifting' || L.state === 'taken') {
        // Rod tip down to where the line touches, then the line on the water.
        const ax = L.nx[0];
        const az = L.nz[0];
        curve((tip.x + ax) / 2, tip.y * 0.35, (tip.z + az) / 2, ax, 0.03, az, 8, false);
        const lift = L.mendT > 0 ? Math.sin((1 - L.mendT / MEND_TIME) * Math.PI) * 0.4 : 0;
        for (let i = 0; i < NODES; i++) {
          const s = i / (NODES - 1);
          push(L.nx[i], i === NODES - 1 ? L.y : 0.02 + lift * Math.sin(Math.PI * s), L.nz[i]);
        }
      } else {
        const ctrl = tmp.set((tip.x + L.x) / 2, (tip.y + L.y) / 2, (tip.z + L.z) / 2);
        if (L.state === 'casting') ctrl.y += Math.sin(Math.PI * clamp((L.t / CAST_TIME - 0.3) / 0.7, 0, 1)) * 0.9 + 0.3;
        else if (L.state === 'fighting') ctrl.y *= 0.85;
        curve(ctrl.x, ctrl.y, ctrl.z, L.x, L.y, L.z, 24, true);
      }
      cum[0] = 0;
      for (let i = 1; i < pn; i++) cum[i] = cum[i - 1] + Math.hypot(poly[i * 3] - poly[i * 3 - 3], poly[i * 3 + 1] - poly[i * 3 - 2], poly[i * 3 + 2] - poly[i * 3 - 1]);
      const total = cum[pn - 1];
      const tippet = Math.min(0.45, total * 0.12);
      const leader = Math.min(1.1, total * 0.3);
      const bounds = [0, total - tippet - leader, total - tippet, total];
      seg = 0;
      rig.forEach((r, j) => {
        r.line.visible = !isHolding;
        sample(pn, bounds[j], bounds[j + 1], r.points, r.pos);
        const at = r.geo.attributes.instanceStart as THREE.InterleavedBufferAttribute;
        const buf = at.data.array as Float32Array;
        for (let i = 0; i < r.points - 1; i++) buf.set(r.pos.subarray(i * 3, i * 3 + 6), i * 6);
        at.data.needsUpdate = true;
      });

      // Wake: the fly furrowing the surface, opening behind the way it's being towed.
      const wk = L.state === 'drifting' ? clamp((L.drag - 0.05) * 3, 0, 0.75) : 0;
      wake.visible = wk > 0;
      if (wake.visible) {
        wakeMat.opacity = wk * glow;
        wake.position.set(L.x, 0.02, L.z);
        wake.rotation.y = -Math.atan2(L.dragZ, L.dragX);
        wake.scale.setScalar(0.6 + Math.min(1, L.drag * 3));
        if (Math.random() < dt * L.drag * 25) fx.ring(L.x, L.z, 0.18, 0.5);
      }

      // Fish meshes.
      for (const f of world.fish) {
        f.mesh.root.position.set(f.x, f.y, f.z);
        f.mesh.root.rotation.set(0, -f.heading, 0);
        if (f.state === 'held') f.mesh.root.rotation.set(0, -f.heading, 0.12 + Math.sin(t * 10) * 0.08);
        f.mesh.root.scale.setScalar(f.state === 'held' ? 1.35 : approach(f.mesh.root.scale.x, 1, 6, dt));
        f.mesh.tail.rotation.y = Math.sin(f.wag) * (f.state === 'hold' ? 0.3 : 0.55);
      }

      // Surface streaks, slipping around rocks and idling in their lee.
      streaks.forEach((s, i) => {
        const v = flow(world, s.x, s.z);
        const sl = riverSlope(s.x);
        s.x += v * dt;
        s.z = wet(s.x, s.z + v * sl * dt + Math.sin(t * 0.8 + s.seed) * dt * 0.04, 0.12);
        for (const r of world.rocks) {
          const dx = s.x - r.x;
          const dz = s.z - r.z;
          const d = Math.hypot(dx, dz);
          if (d < r.r + 0.35 && dx < r.r) s.z += Math.sign(dz || 1) * (r.r + 0.35 - d) * 0.2;
        }
        if (s.x > Math.min(camX + 13, LOGFALL_X) || s.x < camX - 13) {
          s.x = s.x < camX - 13 ? s.x + 26 : Math.max(WALL_X, s.x - 26);
          s.z = laneZ(s.x, rand(-0.9, 0.9));
        }
        const k = v / SPEED;
        const ch = reachChop(s.x);
        matrix.compose(
          scl.set(s.x, 0.012 + ch * 0.03, s.z),
          quat.setFromAxisAngle(up, -Math.atan(sl)),
          tmp.set(s.len * (0.5 + k * 0.7), 0.01, 0.04 * (1 + ch * 1.5)),
        );
        streakMesh.setMatrixAt(i, matrix);
      });
      streakMesh.instanceMatrix.needsUpdate = true;

      terrain.update(t);
      stepWeatherFx(dt, t);

      for (const r of rings) {
        r.life += dt;
        const p = r.life / r.max;
        r.mesh.visible = r.life >= 0 && p < 1;
        if (!r.mesh.visible) continue;
        const sc = Math.max(0.01, r.size * easeOut(p));
        r.mesh.scale.set(sc, sc, sc);
        (r.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - p) * 0.8 * glow;
      }
      stepRiders(dt);

      for (const d of drops) {
        if (!d.mesh.visible) continue;
        d.life -= dt;
        d.v.y -= 9 * dt;
        d.mesh.position.addScaledVector(d.v, dt);
        if (d.life <= 0 || d.mesh.position.y < 0) d.mesh.visible = false;
      }

      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKeyUp);
      sound.dispose();
      soundRef.current = null;
      renderer.dispose();
      el.remove();
    };
  }, []);

  function release() {
    setCard(null);
    releaseRef.current();
  }

  function closeRock() {
    setUnder(null);
    putBackRef.current();
  }

  useEffect(() => {
    if (!card && !pane && !under) return;
    if (card) cardRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (card) release();
      else {
        panel(null);
        putBackRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [card, pane, under]);

  const pill: CSSProperties = {
    ...PANE,
    position: 'absolute',
    left: 16,
    top: 16,
    zIndex: 5,
    borderRadius: 999,
    padding: '6px 12px',
    fontSize: 12,
    color: 'var(--fg)',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    pointerEvents: 'none',
    userSelect: 'none',
  };
  const round: CSSProperties = {
    ...PANE,
    width: 46, height: 46, borderRadius: 23,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'var(--fg)', cursor: 'pointer',
  };
  const caught = Object.keys(log.posts).length;
  const good = hint === HINT.strike || hint === HINT.dead;
  const tied = flyOf(flyId);
  const corner: CSSProperties = {
    ...PANE, position: 'absolute', left: 16, bottom: 72, zIndex: 15,
    width: 'min(300px, calc(100% - 32px))', maxHeight: 'calc(100% - 104px)', overflowY: 'auto',
    borderRadius: 14, padding: 14, fontSize: 12, color: 'var(--fg-dim)',
    display: 'flex', flexDirection: 'column', gap: 12,
  };

  return (
    <div ref={hostRef} className="hp-fish" style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      <div style={pill} aria-live="polite">
        <span style={{ color: good ? 'var(--accent)' : undefined }}>{hint}</span>
        {fighting && (
          <span aria-hidden style={{ width: 48, height: 4, borderRadius: 2, background: 'var(--tile)', overflow: 'hidden' }}>
            <span ref={tensionRef} style={{ display: 'block', height: '100%', width: 0, borderRadius: 2 }} />
          </span>
        )}
        {count > 0 && <span style={{ color: 'var(--fg-dim)' }}>{count} landed</span>}
      </div>
      {clock && (
        <div style={{ ...pill, top: 52, padding: '4px 10px', fontSize: 11, color: 'var(--fg-dim)' }}>
          {clock}
        </div>
      )}

      <div className="hp-fish-bar" style={{ position: 'absolute', left: 16, bottom: 16, zIndex: 15, display: 'flex', gap: 8 }}>
        <button style={round} onMouseDown={(e) => e.preventDefault()} aria-label="logbook" title="logbook (L)" aria-expanded={pane === 'log'} onClick={() => toggle('log')}>
          <BookOpenText size={18} weight="bold" />
        </button>
        <button style={round} onMouseDown={(e) => e.preventDefault()} aria-label={`fly box, ${tied.name} tied on`} title="fly box (F)" aria-expanded={pane === 'box'} onClick={() => toggle('box')}>
          <span style={{ position: 'relative', display: 'flex' }}>
            <Feather size={18} weight="bold" />
            <span aria-hidden style={{ position: 'absolute', right: -5, bottom: -4, width: 8, height: 8, borderRadius: 4, background: tied.swatch, boxShadow: '0 0 0 1.5px var(--bg)' }} />
          </span>
        </button>
        <button style={round} onMouseDown={(e) => e.preventDefault()} aria-label="turn a rock" title="turn a rock (R)" aria-expanded={!!under} onClick={() => (under ? closeRock() : rockRef.current())}>
          <HandGrabbing size={18} weight="bold" />
        </button>
      </div>
      {/* Scores, kit, view and sound: on in the row on wide screens, up under search on phones. */}
      <div className="hp-fish-view" style={{ position: 'absolute', left: 178, bottom: 16, zIndex: 15, display: 'flex', gap: 8 }}>
        <button
          style={round}
          onMouseDown={(e) => e.preventDefault()}
          aria-label="high scores"
          title="high scores (H)"
          aria-expanded={pane === 'scores'}
          onClick={() => {
            if (pane !== 'scores') fetchBoards();
            toggle('scores');
          }}
        >
          <Trophy size={18} weight="bold" />
        </button>
        <button style={round} onMouseDown={(e) => e.preventDefault()} aria-label="angler" title="angler (C)" aria-expanded={pane === 'angler'} onClick={() => toggle('angler')}>
          <TShirt size={18} weight="bold" />
        </button>
        <button style={round} onMouseDown={(e) => e.preventDefault()} aria-label="switch sides" title="switch sides (V)" onClick={() => flipRef.current()}>
          <CameraRotate size={18} weight="bold" />
        </button>
        <button
          style={round}
          onMouseDown={(e) => e.preventDefault()}
          aria-label={muted ? 'sound off' : 'sound on'}
          aria-pressed={!muted}
          title={muted ? 'sound off' : 'sound on'}
          onClick={() => {
            const s = soundRef.current;
            if (!s) return;
            s.unlock();
            s.setMuted(!s.muted);
            setMuted(s.muted);
          }}
        >
          {muted ? <SpeakerSlash size={18} weight="bold" /> : <SpeakerHigh size={18} weight="bold" />}
        </button>
      </div>

      {pane === 'box' && (
        <section aria-label="Fly box" className="hp-fish-pane" style={corner}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--fg)', fontSize: 13 }}>
            <span>fly box</span>
            <span style={{ color: 'var(--fg-dim)' }}>{onWater ? `on the water: ${BUG_NAMES[onWater]}` : 'nothing hatching'}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, margin: '0 -6px' }}>
            {FLIES.map((f, i) => (
              <button
                key={f.id}
                className="hp-fish-fly"
                onClick={() => tieRef.current(f.id)}
                aria-pressed={f.id === flyId}
                style={{
                  display: 'grid', gridTemplateColumns: '14px 1fr auto 14px', alignItems: 'center', gap: 10,
                  padding: '7px 6px', borderRadius: 8, fontSize: 12, textAlign: 'left', cursor: 'pointer',
                  background: f.id === flyId ? 'var(--tile)' : 'none',
                  color: f.id === flyId ? 'var(--fg)' : 'var(--fg-dim)',
                }}
              >
                <span aria-hidden style={{ width: 10, height: 10, borderRadius: 5, background: f.swatch, boxShadow: '0 0 0 1px var(--rule)' }} />
                <span>{f.name} <span style={{ color: 'var(--fg-dim)' }}>#{f.size}</span></span>
                <span style={{ color: 'var(--fg-dim)' }}>{f.id === flyId ? 'tied on' : ''}</span>
                <span aria-hidden className="hp-fish-keys" style={{ color: 'var(--fg-dim)', fontSize: 11 }}>{i + 1}</span>
              </button>
            ))}
          </div>
          <div style={{ lineHeight: 1.55 }}>
            In a hatch they get picky: match the bug. Between, anything buggy will do. Turn a rock to see what's coming.
          </div>
        </section>
      )}

      {under && <UnderRockView bugs={under.bugs} say={under.say} onClose={closeRock} />}

      {pane === 'scores' && (
        <section aria-label="High scores" className="hp-fish-pane" style={corner}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', color: 'var(--fg)', fontSize: 13 }}>
            <span>high scores</span>
            <div role="tablist" aria-label="Board" style={{ display: 'flex', gap: 2, margin: '-4px -6px -4px 0' }}>
              {(['fish', 'sessions'] as const).map((b) => (
                <button
                  key={b}
                  role="tab"
                  aria-selected={board === b}
                  onClick={() => setBoard(b)}
                  style={{
                    padding: '4px 8px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
                    background: board === b ? 'var(--tile)' : 'none', color: board === b ? 'var(--fg)' : 'var(--fg-dim)',
                  }}
                >
                  {b === 'fish' ? 'biggest fish' : 'best visit'}
                </button>
              ))}
            </div>
          </div>
          {boards === null ? (
            <div>reading the board…</div>
          ) : boards === 'offline' ? (
            <div>The board's gone quiet. Try again in a bit.</div>
          ) : (
            <ol role="tabpanel" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {(board === 'fish' ? boards.fish : boards.sessions).length === 0 && <li>Nobody yet. First fish takes it.</li>}
              {(board === 'fish' ? boards.fish : boards.sessions).map((row, i) => {
                const mine = !!you && row.name.toLowerCase() === you.toLowerCase();
                return (
                  <li key={row.name} style={{ display: 'grid', gridTemplateColumns: '18px 1fr auto', columnGap: 8, alignItems: 'baseline' }}>
                    <span style={{ color: 'var(--fg-faint)' }}>{i + 1}</span>
                    <span style={{ minWidth: 0 }}>
                      <span style={{ color: mine ? 'var(--accent)' : 'var(--fg)' }}>{row.name}</span>
                      <span style={{ display: 'block', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {'species' in row ? `${SPECIES[row.species]?.name ?? row.species} on a #${flyOf(row.fly)?.size} ${flyOf(row.fly)?.name}` : `${row.inches}″ all told`}
                      </span>
                    </span>
                    <span style={{ color: 'var(--fg)' }}>{'species' in row ? `${row.inches}″` : `${row.count} fish`}</span>
                  </li>
                );
              })}
            </ol>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setYou(saveName(name));
              (document.activeElement as HTMLElement | null)?.blur();
            }}
            style={{ display: 'flex', alignItems: 'center', gap: 8, borderTop: '1px solid var(--rule)', paddingTop: 12 }}
          >
            <label htmlFor="hp-fish-name" style={{ whiteSpace: 'nowrap' }}>fishing as</label>
            <input
              id="hp-fish-name"
              value={name}
              maxLength={12}
              placeholder="your name"
              autoComplete="nickname"
              onChange={(e) => setName(e.target.value)}
              onBlur={() => setYou(saveName(name))}
              style={{ flex: 1, minWidth: 0, background: 'var(--tile)', color: 'var(--fg)', border: 0, borderRadius: 6, padding: '6px 8px', fontSize: 12 }}
            />
          </form>
          <div style={{ lineHeight: 1.55, marginTop: -4 }}>
            Shared with everyone who fishes here. Land one that makes the top ten and it goes up under your name.
          </div>
        </section>
      )}

      {pane === 'angler' && <AnglerPane look={look} onChange={dress} style={corner} />}

      {pane === 'log' && (
        <section aria-label="Logbook" className="hp-fish-pane" style={corner}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--fg)', fontSize: 13 }}>
            <span>logbook</span>
            <span style={{ color: 'var(--fg-dim)' }}>{log.total} landed</span>
          </div>
          <div>
            <div style={{ marginBottom: 6 }}>{caught} of {poolSize || '…'} posts fished out</div>
            <div style={{ height: 4, borderRadius: 2, background: 'var(--rule)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${poolSize ? (caught / poolSize) * 100 : 0}%`, background: 'var(--accent)' }} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', columnGap: 12, rowGap: 4 }}>
            {SPECIES_IDS.map((id) => {
              const s = log.species[id];
              return (
                <div key={id} style={{ display: 'contents', color: s ? 'var(--fg)' : 'var(--fg-dim)' }}>
                  <span>{SPECIES[id].name}</span>
                  <span style={{ textAlign: 'right' }}>{s ? `×${s.n}` : ''}</span>
                  <span style={{ textAlign: 'right' }}>{s ? `${s.best}″` : 'not yet'}</span>
                </div>
              );
            })}
          </div>
          {caught > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 4 }}>
              {Object.entries(log.posts).map(([slug, src]) => (
                <a key={slug} href={`/posts/${slug}`} title={posts.find((p) => p.slug === slug)?.title ?? slug} style={{ aspectRatio: '1', borderRadius: 4, overflow: 'hidden', background: 'var(--tile)' }}>
                  <img src={src} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                </a>
              ))}
            </div>
          )}
          <div style={{ lineHeight: 1.55, borderTop: '1px solid var(--rule)', paddingTop: 12 }}>
            Cast above a fish and let the fly come down to it. Trout take a dead drift; when the line bellies and drags,
            swipe across to mend it upstream, or hold to feed slack. When bugs are coming off, tie on something that
            looks like them. Big fish are fussy, and they'll break you off if you reel while they run.
            <div className="hp-fish-keys" style={{ marginTop: 8, color: 'var(--fg)' }}>space cast · ←→ walk · M/N mend · S slack · F flies · 1–7 tie on · R turn a rock · V switch sides · H scores · C angler</div>
          </div>
        </section>
      )}

      {card && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={card.c ? `Caught: ${card.c.title}` : 'Nothing on the hook'}
          onClick={release}
          style={{
            position: 'absolute', inset: 0, zIndex: 20,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
            background: 'color-mix(in srgb, var(--bg-inner) 35%, transparent)',
            WebkitBackdropFilter: 'blur(6px)', backdropFilter: 'blur(6px)',
            animation: 'hp-fish-in 220ms ease-out',
          }}
        >
          <style>{`
            @keyframes hp-fish-in { from { opacity: 0 } to { opacity: 1 } }
            @keyframes hp-fish-up { from { opacity: 0; transform: translateY(14px) scale(.97) } to { opacity: 1; transform: none } }
          `}</style>
          <figure
            ref={cardRef}
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            style={{
              outline: 'none',
              ...PANE, margin: 0, borderRadius: 14, padding: 8,
              maxWidth: 'min(100%, 880px)', display: 'flex', flexDirection: 'column',
              animation: 'hp-fish-up 320ms cubic-bezier(.2,.9,.3,1.1)',
            }}
          >
            {card.c ? (
              <img
                src={card.c.src}
                alt={`From ${card.c.title}`}
                style={{ display: 'block', maxWidth: '100%', maxHeight: 'calc(100dvh - 240px)', borderRadius: 8, objectFit: 'contain', background: 'var(--tile)' }}
              />
            ) : (
              <div style={{ padding: '40px 56px', color: 'var(--fg-dim)', fontSize: 14 }}>An old boot. Try another cast.</div>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '2px 10px', padding: '10px 6px 0', fontSize: 13, color: 'var(--fg)' }}>
              <span>{card.inches}″ {SPECIES[card.species].name} <span style={{ color: 'var(--fg-dim)' }}>on a #{flyOf(card.fly).size} {flyOf(card.fly).name}</span></span>
              {[card.rank, card.newSpecies && 'new species', card.best && 'personal best', card.newPost && 'new post'].filter(Boolean).map((b) => (
                <span key={b as string} style={{ color: 'var(--accent)', fontSize: 12 }}>{b}</span>
              ))}
            </div>
            {card.ask && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const as = saveName(name);
                  if (!as) return;
                  setYou(as);
                  setCard((cur) => cur && { ...cur, ask: false });
                  postScore(card, as).then((rank) => rank && setCard((cur) => (cur === null ? cur : { ...cur, rank })));
                }}
                className="hp-fish-ask"
                style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 10px', padding: '8px 6px 2px', fontSize: 13, color: 'var(--fg)' }}
              >
                <label htmlFor="hp-fish-card-name" style={{ whiteSpace: 'nowrap' }}>That one makes the board.</label>
                <input
                  id="hp-fish-card-name"
                  value={name}
                  maxLength={12}
                  placeholder="your name"
                  autoComplete="nickname"
                  onChange={(e) => setName(e.target.value)}
                  style={{ flex: 1, minWidth: 0, width: 120, background: 'var(--tile)', color: 'var(--fg)', border: 0, borderRadius: 6, padding: '6px 8px', fontSize: 13 }}
                />
                <button type="submit" disabled={!name.trim()} style={{ background: 'none', color: 'var(--accent)', fontSize: 13, padding: 0, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  put it up
                </button>
              </form>
            )}
            <figcaption style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '4px 6px 4px', fontSize: 13 }}>
              {card.c && (
                <span style={{ minWidth: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--fg-dim)' }}>
                  <span style={{ color: 'var(--fg-faint)' }}>from </span>
                  {card.c.title}
                </span>
              )}
              {card.c && (
                <a href={`/posts/${card.c.slug}`} style={{ color: 'var(--accent)', whiteSpace: 'nowrap' }}>
                  see the post →
                </a>
              )}
              <button
                onClick={release}
                style={{ marginLeft: card.c ? 0 : 'auto', background: 'none', color: 'var(--fg-dim)', fontSize: 13, padding: 0, cursor: 'pointer' }}
              >
                release
              </button>
            </figcaption>
          </figure>
        </div>
      )}
    </div>
  );
}

/** The underside of the stone he just turned, in its own little renderer. */
function UnderRockView({ bugs, say, onClose }: { bugs: NymphId[]; say: string; onClose: () => void }) {
  const hostRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = hostRef.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    const el = renderer.domElement;
    Object.assign(el.style, { display: 'block', width: '100%', height: '100%' });
    host.appendChild(el);
    const view = buildUnderRock(bugs);
    const size = () => {
      const r = host.getBoundingClientRect();
      renderer.setSize(r.width, r.height, false);
      view.camera.aspect = r.width / Math.max(1, r.height);
      view.camera.updateProjectionMatrix();
    };
    size();
    let raf = 0;
    let last = performance.now();
    const t0 = last;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = clamp((now - last) / 1000, 0, 0.05);
      last = now;
      view.tick((now - t0) / 1000, dt);
      renderer.render(view.scene, view.camera);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      view.scene.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose();
      });
      renderer.dispose();
      el.remove();
    };
  }, [bugs]);
  return (
    <section
      aria-label="Under the rock"
      className="hp-fish-pane"
      style={{
        ...PANE, position: 'absolute', right: 16, bottom: 72, zIndex: 15,
        width: 'min(300px, calc(100% - 32px))', borderRadius: 14, padding: 8,
        display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12, color: 'var(--fg)',
        animation: 'hp-fish-rock 260ms cubic-bezier(.2,.9,.3,1.1)',
      }}
    >
      <style>{`@keyframes hp-fish-rock { from { opacity: 0; transform: translateY(10px) scale(.96) } to { opacity: 1; transform: none } }`}</style>
      <div ref={hostRef} role="img" aria-label={`Under the rock: ${say}`} style={{ aspectRatio: '1.4', borderRadius: 8, overflow: 'hidden', background: '#33494c' }} />
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, padding: '0 6px 4px' }}>
        <span style={{ flex: 1, lineHeight: 1.45 }}>{say}</span>
        <button onClick={onClose} style={{ background: 'none', color: 'var(--fg-dim)', fontSize: 12, padding: 0, cursor: 'pointer', whiteSpace: 'nowrap' }}>
          put it back
        </button>
      </div>
    </section>
  );
}

/** The wardrobe: him on a patch of grass, turning, and the kit below. */
function AnglerPane({ look, onChange, style }: { look: Look; onChange: (l: Look) => void; style: CSSProperties }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const dressRef = useRef<(l: Look) => void>(() => {});
  useEffect(() => {
    const host = hostRef.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setClearColor('#97cb53');
    const el = renderer.domElement;
    Object.assign(el.style, { display: 'block', width: '100%', height: '100%' });
    host.appendChild(el);
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight('#ffffff', '#9cc96b', 1.6));
    const sun = new THREE.DirectionalLight('#fff4e0', 2.2);
    sun.position.set(-2, 4, -3);
    scene.add(sun);
    const av = buildAvatar(look);
    av.rod.visible = false;
    av.leftArm.rotation.x = av.rightArm.rotation.x = 0.15;
    scene.add(av.root, box(1.5, 0.12, 1.5, '#86bd4a', 0, -0.06, 0, false));
    const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 50);
    camera.position.set(0, 1.9, -5.4);
    camera.lookAt(0, 1.05, 0);
    let hop = 0;
    dressRef.current = (l) => {
      av.dress(l);
      hop = 0.001;
    };
    const size = () => {
      const r = host.getBoundingClientRect();
      renderer.setSize(r.width, r.height, false);
      camera.aspect = r.width / Math.max(1, r.height);
      camera.updateProjectionMatrix();
    };
    size();
    let raf = 0;
    let last = performance.now();
    const t0 = last;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = clamp((now - last) / 1000, 0, 0.05);
      last = now;
      const t = (now - t0) / 1000;
      av.root.rotation.y = Math.sin(t * 0.7) * 0.7;
      av.body.position.y = Math.abs(Math.sin(t * 2)) * 0.015;
      if (hop > 0) {
        hop += dt;
        av.body.position.y += Math.sin(Math.min(1, hop / 0.32) * Math.PI) * 0.12;
        if (hop > 0.32) hop = 0;
      }
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      renderer.dispose();
      el.remove();
    };
  }, []);

  const set = (patch: Partial<Look>) => {
    const next = { ...look, ...patch };
    onChange(next);
    dressRef.current(next);
  };
  const row: CSSProperties = { display: 'grid', gridTemplateColumns: '52px 1fr', alignItems: 'center', columnGap: 8 };
  const swatches = (key: 'skin' | 'hair' | 'hatColor' | 'shirt' | 'waders', list: { id: string; name: string; color: string }[], label: string) => (
    <div style={row} role="radiogroup" aria-label={label}>
      <span>{label}</span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {list.map((o) => {
          const value = key === 'skin' || key === 'hair' ? o.id : o.color;
          const on = look[key] === value;
          return (
            <button
              key={o.id}
              role="radio"
              aria-checked={on}
              aria-label={o.name}
              title={o.name}
              onClick={() => set({ [key]: value })}
              style={{
                width: 22, height: 22, borderRadius: 11, padding: 0, cursor: 'pointer', background: o.color,
                boxShadow: on ? '0 0 0 2px var(--bg), 0 0 0 3.5px var(--fg)' : 'inset 0 0 0 1px rgba(0,0,0,.15)',
              }}
            />
          );
        })}
      </div>
    </div>
  );
  const choices = <K extends 'face' | 'hat' | 'shades'>(key: K, list: readonly Look[K][], label: string, names: Record<Look[K], string>) => (
    <div style={row} role="radiogroup" aria-label={label}>
      <span>{label}</span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, margin: '0 -6px' }}>
        {list.map((v) => (
          <button
            key={v}
            role="radio"
            aria-checked={look[key] === v}
            onClick={() => set({ [key]: v } as Partial<Look>)}
            style={{
              padding: '4px 6px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
              background: look[key] === v ? 'var(--tile)' : 'none', color: look[key] === v ? 'var(--fg)' : 'var(--fg-dim)',
            }}
          >
            {names[v]}
          </button>
        ))}
      </div>
    </div>
  );
  const isDefault = (Object.keys(DEFAULT_LOOK) as (keyof Look)[]).every((k) => look[k] === DEFAULT_LOOK[k]);

  return (
    <section aria-label="Angler" className="hp-fish-pane" style={style}>
      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--fg)', fontSize: 13 }}>
        <span>angler</span>
        {!isDefault && (
          <button onClick={() => set(DEFAULT_LOOK)} style={{ background: 'none', color: 'var(--fg-dim)', fontSize: 12, padding: 0, cursor: 'pointer' }}>
            back to hudson
          </button>
        )}
      </div>
      <div ref={hostRef} role="img" aria-label="Your angler" style={{ aspectRatio: '1.7', borderRadius: 8, overflow: 'hidden', background: '#97cb53', flexShrink: 0 }} />
      {swatches('skin', SKINS, 'skin')}
      {swatches('hair', HAIRS, 'hair')}
      {choices('face', FACES, 'face', { stache: 'stache', beard: 'beard', stubble: 'stubble', clean: 'clean' })}
      {choices('hat', HATS, 'hat', { cap: 'cap', bucket: 'bucket', beanie: 'beanie', none: 'none' })}
      {look.hat !== 'none' && swatches('hatColor', HAT_COLORS, '')}
      {choices('shades', SHADES, 'shades', { mirror: 'mirrored', tint: 'tinted', none: 'none' })}
      {swatches('shirt', SHIRTS, 'shirt')}
      {swatches('waders', WADERS, 'waders')}
    </section>
  );
}
