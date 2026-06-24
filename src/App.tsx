import { useRef, useState, useCallback, useEffect } from 'react';
import { useGameEngine } from './useGameEngine';
import { getDailySeed, getDailyLevelName } from './levelGen';

type Screen = 'menu' | 'game';
type LevelMode = 'daily' | 'infinite';

function formatDate() {
  const now = new Date();
  return now.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
}

function useLocalStorage<T>(key: string, defaultValue: T) {
  const [val, setVal] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : defaultValue;
    } catch { return defaultValue; }
  });
  const set = useCallback((v: T) => {
    setVal(v);
    localStorage.setItem(key, JSON.stringify(v));
  }, [key]);
  return [val, set] as const;
}

// ──────────────────────────────────────────
// GAME SCREEN
// ──────────────────────────────────────────
interface GameScreenProps {
  levelMode: LevelMode;
  onExit: () => void;
  onDailyComplete: () => void;
}

function GameScreen({ levelMode, onExit, onDailyComplete }: GameScreenProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [attempts, setAttempts] = useState(1);
  const [showComplete, setShowComplete] = useState(false);
  const [bestProgress, setBestProgress] = useState(0);

  const handleDeath = useCallback((p: number) => {
    setBestProgress(prev => Math.max(prev, p));
  }, []);

  const handleAttemptChange = useCallback((a: number) => {
    setAttempts(a);
  }, []);

  const handleComplete = useCallback(() => {
    setShowComplete(true);
    if (levelMode === 'daily') onDailyComplete();
  }, [levelMode, onDailyComplete]);

  const handleProgressUpdate = useCallback(() => {}, []);

  const { jump } = useGameEngine({
    canvasRef,
    levelMode,
    onDeath: handleDeath,
    onComplete: handleComplete,
    onProgressUpdate: handleProgressUpdate,
    onAttemptChange: handleAttemptChange,
  });

  const seed = getDailySeed();
  const levelName = getDailyLevelName(seed);
  const bestPct = Math.floor(bestProgress * 100);

  // Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (['Space', 'ArrowUp', 'KeyW'].includes(e.code)) { e.preventDefault(); jump(); }
      if (e.code === 'Escape') onExit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [jump, onExit]);

  // Canvas resize
  useEffect(() => {
    const resize = () => {
      const canvas = canvasRef.current;
      if (!canvas || !canvas.parentElement) return;
      canvas.width = canvas.parentElement.clientWidth;
      canvas.height = canvas.parentElement.clientHeight;
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  return (
    <div className="relative w-full h-full flex flex-col bg-[#050510]">
      {/* Top HUD bar */}
      <div
        className="flex items-center justify-between px-4 py-2 z-10 shrink-0"
        style={{ background: 'rgba(5,5,20,0.85)', backdropFilter: 'blur(10px)', borderBottom: '1px solid rgba(0,255,255,0.08)' }}
      >
        <button
          onClick={onExit}
          className="flex items-center gap-2 transition-all hover:scale-105 active:scale-95 group"
          style={{ color: 'rgba(255,255,255,0.4)' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="group-hover:text-white transition-colors">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          <span className="text-sm font-mono group-hover:text-white transition-colors">Меню</span>
        </button>

        <div className="flex flex-col items-center">
          <span className="font-mono font-bold text-sm" style={{ color: '#00ffff', textShadow: '0 0 8px #00ffff' }}>
            {levelName}
          </span>
          <span className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.3)' }}>
            {levelMode === 'daily' ? '🌟 Daily Challenge' : '♾️ Infinite Mode'}
          </span>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex flex-col items-end">
            <span style={{ color: 'rgba(255,255,255,0.3)' }}>BEST</span>
            <span style={{ color: '#00ffff', textShadow: '0 0 6px #00ffff' }}>{bestPct}%</span>
          </div>
          <div className="flex flex-col items-end">
            <span style={{ color: 'rgba(255,255,255,0.3)' }}>ATT</span>
            <span style={{ color: '#ffffff' }}>{attempts}</span>
          </div>
        </div>
      </div>

      {/* Canvas */}
      <div
        className="relative flex-1 select-none cursor-pointer overflow-hidden"
        onPointerDown={(e) => { e.preventDefault(); jump(); }}
        style={{ touchAction: 'none' }}
      >
        <canvas ref={canvasRef} className="w-full h-full block" />

        {/* Control hint */}
        <div
          className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs font-mono pointer-events-none"
          style={{ color: 'rgba(255,255,255,0.15)' }}
        >
          SPACE / ↑ / ТАП — прыжок
        </div>

        {/* Complete overlay */}
        {showComplete && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
          >
            <div className="flex flex-col items-center gap-6">
              {/* Trophy icon */}
              <div className="text-7xl animate-bounce">🏆</div>

              <div
                className="text-5xl font-black font-mono"
                style={{ color: '#00ffff', textShadow: '0 0 30px #00ffff, 0 0 80px #00ffff44' }}
              >
                COMPLETE!
              </div>
              <div className="text-white/70 text-lg font-mono">100% завершено ✨</div>

              {/* Stats */}
              <div
                className="flex gap-6 px-6 py-3 rounded-xl"
                style={{ background: 'rgba(0,255,255,0.06)', border: '1px solid rgba(0,255,255,0.15)' }}
              >
                <div className="flex flex-col items-center">
                  <span className="text-white/40 text-xs font-mono">ПОПЫТКИ</span>
                  <span className="text-2xl font-black font-mono text-white">{attempts}</span>
                </div>
                <div className="w-px bg-white/10" />
                <div className="flex flex-col items-center">
                  <span className="text-white/40 text-xs font-mono">РЕЖИМ</span>
                  <span className="text-2xl font-black font-mono" style={{ color: '#00ffff' }}>
                    {levelMode === 'daily' ? 'Daily' : '∞'}
                  </span>
                </div>
              </div>

              <div className="flex gap-3 mt-2">
                <button
                  onClick={onExit}
                  className="px-6 py-2.5 rounded-lg font-mono font-bold text-sm transition-all hover:scale-105 active:scale-95"
                  style={{
                    color: '#fff',
                    border: '1px solid rgba(255,255,255,0.2)',
                    background: 'rgba(255,255,255,0.05)',
                  }}
                >
                  ← Главное меню
                </button>
                {levelMode === 'daily' && (
                  <button
                    onClick={() => setShowComplete(false)}
                    className="px-6 py-2.5 rounded-lg font-mono font-bold text-sm transition-all hover:scale-105 active:scale-95"
                    style={{
                      color: '#050510',
                      background: 'linear-gradient(135deg, #00ffff, #7700ff)',
                      boxShadow: '0 0 20px rgba(0,255,255,0.3)',
                    }}
                  >
                    ♾️ Infinite Mode
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────
// ANIMATED BACKGROUND (Menu)
// ──────────────────────────────────────────
function AnimatedBg() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let frame = 0;
    let animId = 0;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Mini cubes
    type Cube = { x: number; y: number; vy: number; size: number; rot: number; rotV: number; color: string; alpha: number };
    const cubes: Cube[] = Array.from({ length: 14 }, () => ({
      x: Math.random() * 1200,
      y: Math.random() * 600,
      vy: -0.3 - Math.random() * 0.5,
      size: 10 + Math.random() * 25,
      rot: Math.random() * 360,
      rotV: (Math.random() - 0.5) * 1.5,
      color: ['#00ffff', '#ff00ff', '#7700ff', '#00ff88', '#ff4400'][Math.floor(Math.random() * 5)],
      alpha: 0.05 + Math.random() * 0.15,
    }));

    const loop = () => {
      animId = requestAnimationFrame(loop);
      frame++;
      const W = canvas.width, H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      // Sky gradient
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#050510');
      sky.addColorStop(1, '#0a0528');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);

      // Floating cubes
      cubes.forEach((cube) => {
        cube.y += cube.vy;
        cube.rot += cube.rotV;
        if (cube.y < -50) { cube.y = H + 50; cube.x = Math.random() * W; }
        ctx.save();
        ctx.translate(cube.x, cube.y);
        ctx.rotate((cube.rot * Math.PI) / 180);
        ctx.globalAlpha = cube.alpha;
        ctx.shadowColor = cube.color;
        ctx.shadowBlur = 15;
        ctx.strokeStyle = cube.color;
        ctx.lineWidth = 1.5;
        const s = cube.size;
        ctx.strokeRect(-s / 2, -s / 2, s, s);
        // inner cross
        ctx.globalAlpha = cube.alpha * 0.5;
        ctx.beginPath(); ctx.moveTo(-s / 2, -s / 2); ctx.lineTo(s / 2, s / 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(s / 2, -s / 2); ctx.lineTo(-s / 2, s / 2); ctx.stroke();
        ctx.restore();
      });

      // Perspective grid
      const color = '#00ffff';
      const gridH = H * 0.4;
      ctx.save();
      ctx.globalAlpha = 0.07;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      const period = 80;
      const offset = -(frame * 0.8) % period;
      for (let x = offset; x <= W; x += period) {
        ctx.beginPath(); ctx.moveTo(x, H); ctx.lineTo(W / 2, H - gridH); ctx.stroke();
      }
      for (let i = 0; i < 6; i++) {
        const t = i / 6;
        const gy = H - gridH * t;
        ctx.globalAlpha = 0.04 + t * 0.05;
        ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
      }
      ctx.restore();

      // Horizontal neon line (ground)
      ctx.save();
      ctx.shadowColor = '#00ffff';
      ctx.shadowBlur = 15;
      ctx.strokeStyle = '#00ffff44';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, H - gridH); ctx.lineTo(W, H - gridH); ctx.stroke();
      ctx.restore();

      // Scanlines
      ctx.save();
      ctx.globalAlpha = 0.025;
      ctx.fillStyle = '#ffffff';
      for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1);
      ctx.restore();
    };

    loop();
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />;
}

// ──────────────────────────────────────────
// MINI PREVIEW CANVAS
// ──────────────────────────────────────────
function MiniPreview({ primaryColor, accentColor }: { primaryColor: string; accentColor: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let frame = 0;
    let animId = 0;
    let playerY = canvas.height - 44;
    let vy = 0;
    let camX = 0;

    const obstacles = [
      { x: 200, type: 'spike' }, { x: 260, type: 'spike' },
      { x: 380, type: 'block', h: 2 }, { x: 500, type: 'spike' },
      { x: 600, type: 'block', h: 1 }, { x: 700, type: 'spike' },
    ];

    const loop = () => {
      animId = requestAnimationFrame(loop);
      frame++;
      const W = canvas.width, H = canvas.height;
      const gY = H - 36;
      camX += 2.5;

      // physics
      vy += 0.35;
      playerY += vy;
      if (playerY >= gY - 22) { playerY = gY - 22; vy = frame % 90 < 4 ? -8 : 0; }

      ctx.clearRect(0, 0, W, H);
      // bg
      ctx.fillStyle = '#050510';
      ctx.fillRect(0, 0, W, H);

      // Ground
      ctx.save();
      ctx.shadowColor = primaryColor;
      ctx.shadowBlur = 8;
      ctx.strokeStyle = primaryColor + '88';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, gY); ctx.lineTo(W, gY); ctx.stroke();
      ctx.restore();

      // Grid on ground
      ctx.save();
      ctx.globalAlpha = 0.12;
      ctx.strokeStyle = primaryColor;
      ctx.lineWidth = 0.5;
      const gs = 20;
      for (let gx = -(camX % gs); gx < W; gx += gs) {
        ctx.beginPath(); ctx.moveTo(gx, gY); ctx.lineTo(gx, H); ctx.stroke();
      }
      ctx.restore();

      // Obstacles
      obstacles.forEach((obs) => {
        const sx = obs.x - camX;
        if (sx < -30 || sx > W + 30) return;
        const th = (obs as any).h ? (obs as any).h * 20 : 0;
        if (obs.type === 'spike') {
          ctx.save();
          ctx.shadowColor = accentColor;
          ctx.shadowBlur = 10;
          ctx.fillStyle = accentColor + '99';
          ctx.beginPath();
          ctx.moveTo(sx, gY);
          ctx.lineTo(sx + 12, gY - 22);
          ctx.lineTo(sx + 24, gY);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = accentColor;
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.restore();
        } else {
          ctx.save();
          ctx.shadowColor = primaryColor + '88';
          ctx.shadowBlur = 8;
          ctx.strokeStyle = primaryColor + 'aa';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(sx, gY - th, 24, th);
          ctx.restore();
        }
      });

      // Player trail
      ctx.save();
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = primaryColor;
      ctx.shadowColor = primaryColor;
      ctx.shadowBlur = 8;
      const ps = 20;
      for (let t = 1; t <= 3; t++) {
        ctx.globalAlpha = 0.1 * (4 - t) / 3;
        ctx.fillRect(32 - t * 6, playerY - 1, ps, ps);
      }
      ctx.restore();

      // Player
      ctx.save();
      ctx.translate(40 + ps / 2, playerY + ps / 2);
      ctx.rotate((frame * 5 * Math.PI) / 180);
      ctx.shadowColor = primaryColor;
      ctx.shadowBlur = 16;
      ctx.fillStyle = primaryColor + 'cc';
      ctx.fillRect(-ps / 2, -ps / 2, ps, ps);
      ctx.strokeStyle = primaryColor;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-ps / 2 + 2, -ps / 2 + 2, ps - 4, ps - 4);
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.shadowBlur = 8;
      ctx.shadowColor = '#fff';
      ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    };

    loop();
    return () => cancelAnimationFrame(animId);
  }, [primaryColor, accentColor]);

  return (
    <canvas
      ref={ref}
      width={320}
      height={80}
      className="w-full rounded-lg"
      style={{ imageRendering: 'pixelated' }}
    />
  );
}

// ──────────────────────────────────────────
// NEON BUTTON
// ──────────────────────────────────────────
function NeonBtn({
  onClick, children, primary = '#00ffff', disabled = false, fullWidth = false, size = 'md'
}: {
  onClick: () => void;
  children: React.ReactNode;
  primary?: string;
  disabled?: boolean;
  fullWidth?: boolean;
  size?: 'sm' | 'md' | 'lg';
}) {
  const pad = size === 'sm' ? 'px-4 py-2 text-sm' : size === 'lg' ? 'px-8 py-4 text-lg' : 'px-6 py-3 text-base';
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`font-mono font-bold rounded-lg transition-all duration-150 ${pad} ${fullWidth ? 'w-full' : ''} ${disabled ? 'opacity-40 cursor-not-allowed' : 'hover:scale-[1.03] active:scale-[0.97]'}`}
      style={{
        color: primary,
        border: `1.5px solid ${primary}`,
        background: `${primary}14`,
        boxShadow: disabled ? 'none' : `0 0 18px ${primary}33, inset 0 0 12px ${primary}0a`,
        textShadow: disabled ? 'none' : `0 0 8px ${primary}`,
      }}
    >
      {children}
    </button>
  );
}

// ──────────────────────────────────────────
// LOGO
// ──────────────────────────────────────────
function Logo() {
  return (
    <div className="flex flex-col items-center select-none pointer-events-none">
      <div className="relative">
        <div
          className="text-[56px] md:text-[72px] font-black font-mono tracking-tighter leading-none"
          style={{
            background: 'linear-gradient(135deg, #00ffff 0%, #7700ff 50%, #ff00ff 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            filter: 'drop-shadow(0 0 20px rgba(0,255,255,0.5))',
            animation: 'neonPulse 3s ease-in-out infinite',
          }}
        >
          GeoNeon
        </div>
      </div>
      <div
        className="text-xs font-mono tracking-[0.5em] uppercase mt-1"
        style={{ color: 'rgba(255,255,255,0.3)' }}
      >
        Daily Dash
      </div>
    </div>
  );
}

// ──────────────────────────────────────────
// MENU SCREEN
// ──────────────────────────────────────────
function MenuScreen({
  onStart,
  dailyCompleted,
  dailyBest,
  totalAttempts,
}: {
  onStart: (mode: LevelMode) => void;
  dailyCompleted: boolean;
  dailyBest: number;
  totalAttempts: number;
}) {
  const seed = getDailySeed();
  const levelName = getDailyLevelName(seed);
  const bestPct = Math.floor(dailyBest * 100);

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
      {/* Animated background */}
      <AnimatedBg />

      {/* Vignette overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.6) 100%)' }}
      />

      {/* Main content */}
      <div className="relative z-10 w-full max-w-sm mx-auto px-5 py-6 flex flex-col gap-5">
        {/* Logo */}
        <div className="flex justify-center">
          <Logo />
        </div>

        {/* Date chip */}
        <div className="flex justify-center">
          <div
            className="px-4 py-1.5 rounded-full text-xs font-mono"
            style={{
              color: 'rgba(255,255,255,0.45)',
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.04)',
            }}
          >
            {formatDate()}
          </div>
        </div>

        {/* Daily Card */}
        <div
          className="rounded-2xl p-4 flex flex-col gap-3"
          style={{
            background: 'rgba(0,255,255,0.04)',
            border: '1px solid rgba(0,255,255,0.18)',
            boxShadow: '0 0 40px rgba(0,255,255,0.06)',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-base"
                style={{ background: 'rgba(0,255,255,0.12)', border: '1px solid rgba(0,255,255,0.2)' }}
              >
                🌟
              </div>
              <div>
                <div className="font-mono font-bold text-sm text-white">Daily Challenge</div>
                <div className="font-mono text-xs" style={{ color: 'rgba(0,255,255,0.7)' }}>{levelName}</div>
              </div>
            </div>
            {dailyCompleted && (
              <div
                className="px-2.5 py-1 rounded-full text-xs font-mono font-bold"
                style={{ color: '#00ff88', border: '1px solid rgba(0,255,136,0.3)', background: 'rgba(0,255,136,0.08)' }}
              >
                ✓ Done
              </div>
            )}
          </div>

          {/* Preview */}
          <MiniPreview primaryColor="#00ffff" accentColor="#ff00ff" />

          {/* Progress */}
          <div>
            <div className="flex justify-between text-xs font-mono mb-1.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
              <span>Прогресс</span>
              <span style={{ color: '#00ffff' }}>{bestPct}%</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${bestPct}%`,
                  background: 'linear-gradient(90deg, #7700ff, #00ffff)',
                  boxShadow: '0 0 8px rgba(0,255,255,0.6)',
                }}
              />
            </div>
          </div>

          <NeonBtn onClick={() => onStart('daily')} primary="#00ffff" fullWidth>
            {dailyCompleted ? '🔄 Повторить Challenge' : '▶ Начать Daily Challenge'}
          </NeonBtn>
        </div>

        {/* Infinite Card */}
        <div
          className="rounded-2xl p-4 flex flex-col gap-3"
          style={{
            background: 'rgba(119,0,255,0.04)',
            border: '1px solid rgba(119,0,255,0.2)',
            boxShadow: '0 0 40px rgba(119,0,255,0.06)',
          }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-base"
              style={{ background: 'rgba(119,0,255,0.12)', border: '1px solid rgba(119,0,255,0.2)' }}
            >
              ♾️
            </div>
            <div>
              <div className="font-mono font-bold text-sm text-white">Infinite Mode</div>
              <div className="font-mono text-xs" style={{ color: 'rgba(170,68,255,0.7)' }}>
                Бесконечный уровень, новые паттерны
              </div>
            </div>
          </div>
          <NeonBtn onClick={() => onStart('infinite')} primary="#aa44ff" fullWidth>
            ♾️ Играть бесконечно
          </NeonBtn>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-2.5">
          {[
            { label: 'Лучший', value: `${bestPct}%`, color: '#00ffff' },
            { label: 'Попыток', value: String(totalAttempts), color: '#ff00ff' },
            { label: 'Статус', value: dailyCompleted ? '✓' : '—', color: dailyCompleted ? '#00ff88' : 'rgba(255,255,255,0.3)' },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              className="flex flex-col items-center py-2.5 rounded-xl"
              style={{ background: `${color}08`, border: `1px solid ${color}22` }}
            >
              <span className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.3)' }}>{label}</span>
              <span className="text-lg font-black font-mono" style={{ color, textShadow: `0 0 8px ${color}` }}>
                {value}
              </span>
            </div>
          ))}
        </div>

        {/* Hint */}
        <div className="text-center text-xs font-mono" style={{ color: 'rgba(255,255,255,0.15)' }}>
          SPACE / ↑ / W / ТАП — прыжок &nbsp;·&nbsp; ESC — меню
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────
// ROOT APP
// ──────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [levelMode, setLevelMode] = useState<LevelMode>('daily');

  const todayKey = `geoneon-${getDailySeed()}`;
  const [dailyCompleted, setDailyCompleted] = useLocalStorage(`${todayKey}-done`, false);
  const [dailyBest, setDailyBest] = useLocalStorage(`${todayKey}-best`, 0);
  const [totalAttempts, setTotalAttempts] = useLocalStorage('geoneon-attempts', 0);

  const handleStart = useCallback((mode: LevelMode) => {
    setLevelMode(mode);
    setScreen('game');
  }, []);

  const handleExit = useCallback(() => {
    setScreen('menu');
  }, []);

  const handleDailyComplete = useCallback(() => {
    setDailyCompleted(true);
    setDailyBest(1);
    setTotalAttempts(totalAttempts + 1);
  }, [setDailyCompleted, setDailyBest, setTotalAttempts]);

  return (
    <div className="w-screen h-screen overflow-hidden bg-[#050510]">
      <style>{`
        @keyframes neonPulse {
          0%, 100% { filter: drop-shadow(0 0 20px rgba(0,255,255,0.5)); }
          50% { filter: drop-shadow(0 0 35px rgba(119,0,255,0.7)) drop-shadow(0 0 60px rgba(0,255,255,0.3)); }
        }
        * { box-sizing: border-box; }
        canvas { display: block; }
      `}</style>

      {screen === 'menu' ? (
        <MenuScreen
          onStart={handleStart}
          dailyCompleted={dailyCompleted}
          dailyBest={dailyBest}
          totalAttempts={totalAttempts}
        />
      ) : (
        <GameScreen
          levelMode={levelMode}
          onExit={handleExit}
          onDailyComplete={handleDailyComplete}
        />
      )}
    </div>
  );
}
