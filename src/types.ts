export type GameMode = 'menu' | 'playing' | 'dead' | 'complete';
export type LevelMode = 'daily' | 'infinite';

export interface Obstacle {
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'spike' | 'block' | 'platform' | 'gap';
  color: string;
}

export interface Segment {
  obstacles: Obstacle[];
  groundY: number;
  ceilingY: number | null; // null = no ceiling
  color: string;
  accentColor: string;
}

export interface LevelData {
  seed: number;
  segments: Segment[];
  bpm: number;
  name: string;
  colorTheme: ColorTheme;
  totalLength: number; // in world units
}

export interface ColorTheme {
  bg: string;
  bgGlow: string;
  ground: string;
  groundGlow: string;
  player: string;
  playerGlow: string;
  obstacle: string;
  obstacleGlow: string;
  accent: string;
  accentGlow: string;
  sky: string;
  skyBottom: string;
}

export interface PlayerState {
  x: number;
  y: number;
  vy: number;
  onGround: boolean;
  rotation: number;
  isDead: boolean;
  trail: { x: number; y: number; alpha: number }[];
}

export interface GameState {
  mode: GameMode;
  levelMode: LevelMode;
  progress: number; // 0-1 for daily level
  score: number;
  attempts: number;
  dailyCompleted: boolean;
  bestProgress: number;
}

export const COLOR_THEMES: ColorTheme[] = [
  {
    bg: '#050510',
    bgGlow: '#0a0a3a',
    ground: '#00ffff',
    groundGlow: '#00ffff',
    player: '#00ffff',
    playerGlow: '#00ffff',
    obstacle: '#ff00ff',
    obstacleGlow: '#ff00ff',
    accent: '#7700ff',
    accentGlow: '#7700ff',
    sky: '#050520',
    skyBottom: '#0a0535',
  },
  {
    bg: '#050810',
    bgGlow: '#001a3a',
    ground: '#00ff88',
    groundGlow: '#00ff88',
    player: '#00ff88',
    playerGlow: '#00ff88',
    obstacle: '#ff4400',
    obstacleGlow: '#ff6600',
    accent: '#0088ff',
    accentGlow: '#0088ff',
    sky: '#020510',
    skyBottom: '#051520',
  },
  {
    bg: '#100505',
    bgGlow: '#2a0a00',
    ground: '#ff4488',
    groundGlow: '#ff4488',
    player: '#ff4488',
    playerGlow: '#ff4488',
    obstacle: '#ffcc00',
    obstacleGlow: '#ffcc00',
    accent: '#ff0044',
    accentGlow: '#ff0044',
    sky: '#100208',
    skyBottom: '#200510',
  },
  {
    bg: '#020510',
    bgGlow: '#001030',
    ground: '#aa00ff',
    groundGlow: '#cc44ff',
    player: '#cc44ff',
    playerGlow: '#cc44ff',
    obstacle: '#00ccff',
    obstacleGlow: '#00ccff',
    accent: '#ff00aa',
    accentGlow: '#ff00aa',
    sky: '#02030e',
    skyBottom: '#060215',
  },
];
