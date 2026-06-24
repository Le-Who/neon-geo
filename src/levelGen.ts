import { LevelData, Obstacle, ColorTheme, COLOR_THEMES } from './types';

// ─── Seeded RNG (mulberry32) ───────────────────────────────────────────────────
function mkRNG(seed: number) {
  let s = seed >>> 0;
  return (): number => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── Daily seed ────────────────────────────────────────────────────────────────
export function getDailySeed(): number {
  const d = new Date();
  const str = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h >>> 0);
}

export function getDailyLevelName(seed: number): string {
  const rng = mkRNG(seed ^ 0xdeadbeef);
  const adjs = ['Cosmic', 'Neon', 'Quantum', 'Plasma', 'Stellar', 'Hyper', 'Turbo', 'Void', 'Pixel', 'Laser', 'Dark', 'Solar', 'Cyber', 'Digital', 'Phantom'];
  const nouns = ['Rush', 'Storm', 'Wave', 'Pulse', 'Dash', 'Surge', 'Blaze', 'Strike', 'Flash', 'Force', 'Core', 'Gate', 'Ring', 'Drive', 'Sky'];
  const a = adjs[Math.floor(rng() * adjs.length)];
  const n = nouns[Math.floor(rng() * nouns.length)];
  return `${a} ${n}`;
}

// ─── Obstacle ──────────────────────────────────────────────────────────────────
function makeObs(x: number, y: number, w: number, h: number, type: Obstacle['type'], color: string): Obstacle {
  return { x, y, width: w, height: h, type, color };
}

// ─── Pattern library ──────────────────────────────────────────────────────────
const TILE = 40;

type Pattern = (x: number, gY: number, rng: () => number, theme: ColorTheme) => { obs: Obstacle[]; w: number };

const pSingle: Pattern = (x, gY, _r, t) => ({
  obs: [makeObs(x, gY - TILE, TILE, TILE, 'spike', t.obstacle)],
  w: TILE,
});

const pDouble: Pattern = (x, gY, _r, t) => ({
  obs: [
    makeObs(x, gY - TILE, TILE, TILE, 'spike', t.obstacle),
    makeObs(x + TILE, gY - TILE, TILE, TILE, 'spike', t.obstacle),
  ],
  w: TILE * 2,
});

const pTriple: Pattern = (x, gY, _r, t) => ({
  obs: [
    makeObs(x, gY - TILE, TILE, TILE, 'spike', t.obstacle),
    makeObs(x + TILE, gY - TILE, TILE, TILE, 'spike', t.obstacle),
    makeObs(x + TILE * 2, gY - TILE, TILE, TILE, 'spike', t.obstacle),
  ],
  w: TILE * 3,
});

const pBlock1: Pattern = (x, gY, _r, t) => ({
  obs: [makeObs(x, gY - TILE, TILE, TILE, 'block', t.accent)],
  w: TILE,
});

const pBlock2: Pattern = (x, gY, _r, t) => ({
  obs: [
    makeObs(x, gY - TILE * 2, TILE, TILE * 2, 'block', t.accent),
  ],
  w: TILE,
});

const pPlatformSpike: Pattern = (x, gY, rng, t) => {
  const platW = 2 + Math.floor(rng() * 2);
  const platH = 1 + Math.floor(rng() * 2);
  const obs: Obstacle[] = [];
  for (let i = 0; i < platW; i++) {
    obs.push(makeObs(x + i * TILE, gY - platH * TILE, TILE, platH * TILE, 'block', t.accent));
  }
  // spike on end of platform
  obs.push(makeObs(x + (platW - 1) * TILE, gY - platH * TILE - TILE, TILE, TILE, 'spike', t.obstacle));
  return { obs, w: platW * TILE + TILE };
};

const pZigzag: Pattern = (x, gY, rng, t) => {
  const count = 3 + Math.floor(rng() * 3);
  const obs: Obstacle[] = [];
  for (let i = 0; i < count; i++) {
    if (i % 2 === 0) {
      obs.push(makeObs(x + i * TILE * 1.6, gY - TILE, TILE, TILE, 'spike', t.obstacle));
    } else {
      obs.push(makeObs(x + i * TILE * 1.6, gY - TILE * 2, TILE, TILE, 'block', t.accent));
    }
  }
  return { obs, w: count * TILE * 1.6 };
};

const pWall: Pattern = (x, gY, rng, t) => {
  const h = 2 + Math.floor(rng() * 2);
  const gapRow = Math.floor(rng() * h);
  const obs: Obstacle[] = [];
  for (let i = 0; i < h; i++) {
    if (i === gapRow) continue;
    obs.push(makeObs(x, gY - (i + 1) * TILE, TILE, TILE, 'block', t.accent));
  }
  return { obs, w: TILE };
};

const pSpikeRun: Pattern = (x, gY, rng, t) => {
  const n = 4 + Math.floor(rng() * 4);
  const obs: Obstacle[] = [];
  for (let i = 0; i < n; i++) {
    const h = rng() > 0.4 ? TILE : TILE * 0.6;
    obs.push(makeObs(x + i * TILE, gY - h, TILE, h, 'spike', t.obstacle));
  }
  return { obs, w: n * TILE };
};

const pStairs: Pattern = (x, gY, rng, t) => {
  const steps = 2 + Math.floor(rng() * 3);
  const obs: Obstacle[] = [];
  for (let i = 0; i < steps; i++) {
    const h = (i + 1);
    obs.push(makeObs(x + i * TILE, gY - h * TILE, TILE, h * TILE, 'block', t.accent));
    if (i === steps - 1) {
      obs.push(makeObs(x + i * TILE, gY - h * TILE - TILE, TILE, TILE, 'spike', t.obstacle));
    }
  }
  return { obs, w: steps * TILE };
};

const ALL_PATTERNS: Pattern[] = [
  pSingle, pDouble, pTriple, pBlock1, pBlock2,
  pPlatformSpike, pZigzag, pWall, pSpikeRun, pStairs,
];

// Difficulty progression: 0 = easy, 1 = hard
function getPatternSet(difficulty: number): Pattern[] {
  if (difficulty < 0.3) return [pSingle, pDouble, pBlock1, pBlock2];
  if (difficulty < 0.6) return [pSingle, pDouble, pBlock1, pPlatformSpike, pZigzag, pWall];
  return ALL_PATTERNS;
}

// ─── Main generator ────────────────────────────────────────────────────────────
export function generateLevel(seed: number, infinite = false): LevelData & { groundY: number; obstacles: Obstacle[] } {
  const rng = mkRNG(seed);
  const themeIdx = Math.floor(rng() * COLOR_THEMES.length);
  const colorTheme = COLOR_THEMES[themeIdx];

  const CANVAS_H = 480;
  const GROUND_Y = CANVAS_H - 55;
  const totalLength = infinite ? 99999 : 9000;

  const obstacles: Obstacle[] = [];

  // Safe opening
  let curX = 340;
  const endX = infinite ? 99999 : totalLength - 350;

  while (curX < endX) {
    // Difficulty ramp 0→1 over the level
    const t = Math.min(curX / endX, 1);
    const difficulty = Math.pow(t, 0.7); // ease into hard

    const patterns = getPatternSet(difficulty);
    const pat = patterns[Math.floor(rng() * patterns.length)];
    const { obs, w } = pat(curX, GROUND_Y, rng, colorTheme);
    obstacles.push(...obs);

    // Gap between patterns (shorter gaps = harder)
    const minGap = TILE * (2 - difficulty * 1.2);
    const maxGap = TILE * (4 - difficulty * 1.5);
    const gap = minGap + rng() * Math.max(0, maxGap - minGap);
    curX += w + gap;
  }

  const name = getDailyLevelName(seed);
  const bpm = 135 + Math.floor(rng() * 50);

  return {
    seed,
    segments: [],
    bpm,
    name,
    colorTheme,
    totalLength,
    groundY: GROUND_Y,
    obstacles,
  } as any;
}

export type { LevelData };
