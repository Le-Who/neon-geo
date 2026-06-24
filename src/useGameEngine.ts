import { useRef, useEffect, useCallback } from 'react';
import { generateLevel, getDailySeed } from './levelGen';
import { ColorTheme } from './types';

export interface GameEngineOptions {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  levelMode: 'daily' | 'infinite';
  onDeath: (progress: number, attempts: number) => void;
  onComplete: (progress: number) => void;
  onProgressUpdate: (progress: number) => void;
  onAttemptChange: (attempts: number) => void;
}

const TILE = 40;
const GRAVITY = 0.62;
const JUMP_VEL = -13.5;
const PLAYER_SIZE = 32;
const PLAYER_X = 130;
const SPEED = 5.5;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
  shape: 'circle' | 'square' | 'star';
}

interface Star {
  x: number;
  y: number;
  size: number;
  alpha: number;
  speed: number;
  twinkle: number;
}

interface TrailPoint {
  x: number;
  y: number;
  alpha: number;
  rotation: number;
  size: number;
}

export function useGameEngine(options: GameEngineOptions) {
  const { canvasRef, levelMode, onDeath, onComplete, onProgressUpdate, onAttemptChange } = options;
  const animRef = useRef<number>(0);
  const stateRef = useRef<'playing' | 'dead' | 'complete'>('playing');
  const playerRef = useRef({ x: PLAYER_X, y: 0, vy: 0, rotation: 0, onGround: false });
  const cameraXRef = useRef(0);
  const jumpRef = useRef(false);
  const jumpBufferRef = useRef(0); // coyote time
  const particlesRef = useRef<Particle[]>([]);
  const starsRef = useRef<Star[]>([]);
  const trailRef = useRef<TrailPoint[]>([]);
  const frameRef = useRef(0);
  const levelRef = useRef<any>(null);
  const bgPulseRef = useRef(0);
  const attemptsRef = useRef(1);
  const deathTimerRef = useRef(0);
  const lastJumpFrameRef = useRef(-100);

  const initLevel = useCallback(() => {
    const seed = getDailySeed();
    levelRef.current = generateLevel(seed, levelMode === 'infinite');
    const groundY = levelRef.current.groundY ?? 420;
    playerRef.current = { x: PLAYER_X, y: groundY - PLAYER_SIZE, vy: 0, rotation: 0, onGround: true };
    cameraXRef.current = 0;
    stateRef.current = 'playing';
    particlesRef.current = [];
    trailRef.current = [];
    jumpRef.current = false;
    frameRef.current = 0;
    bgPulseRef.current = 0;
  }, [levelMode]);

  const initStars = useCallback((w: number, h: number) => {
    starsRef.current = Array.from({ length: 120 }, () => ({
      x: Math.random() * w,
      y: Math.random() * h * 0.8,
      size: Math.random() * 2.2 + 0.3,
      alpha: Math.random() * 0.8 + 0.2,
      speed: Math.random() * 0.25 + 0.05,
      twinkle: Math.random() * Math.PI * 2,
    }));
  }, []);

  const spawnDeathParticles = useCallback((x: number, y: number, theme: ColorTheme) => {
    const colors = [theme.player, theme.accent, '#ffffff', theme.obstacle];
    for (let i = 0; i < 32; i++) {
      const angle = (i / 32) * Math.PI * 2 + Math.random() * 0.3;
      const spd = 1.5 + Math.random() * 6;
      particlesRef.current.push({
        x, y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd - 1.5,
        life: 1,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 2 + Math.random() * 6,
        shape: Math.random() > 0.5 ? 'square' : 'circle',
      });
    }
  }, []);

  const spawnLandParticles = (x: number, y: number, color: string) => {
    for (let i = 0; i < 6; i++) {
      particlesRef.current.push({
        x: x + Math.random() * PLAYER_SIZE,
        y: y + PLAYER_SIZE,
        vx: (Math.random() - 0.5) * 3,
        vy: -Math.random() * 2,
        life: 0.8,
        color,
        size: 2 + Math.random() * 3,
        shape: 'circle',
      });
    }
  };

  const jump = useCallback(() => {
    if (stateRef.current !== 'playing') return;
    jumpRef.current = true;
    lastJumpFrameRef.current = frameRef.current;
  }, []);

  // ══════════════════════════════════════
  // DRAW HELPERS
  // ══════════════════════════════════════

  const neonLine = (ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color: string, lw = 2, blur = 10) => {
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = blur;
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
  };

  const drawSpike = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) => {
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 18;
    // body
    ctx.fillStyle = color + 'aa';
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    ctx.lineTo(x + w / 2, y);
    ctx.lineTo(x + w, y + h);
    ctx.closePath();
    ctx.fill();
    // bright outline
    ctx.shadowBlur = 8;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // inner highlight
    ctx.shadowBlur = 5;
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + w * 0.25, y + h * 0.6);
    ctx.lineTo(x + w / 2, y + h * 0.05);
    ctx.lineTo(x + w * 0.75, y + h * 0.6);
    ctx.stroke();
    ctx.restore();
  };

  const drawBlock = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) => {
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 16;
    // fill
    ctx.fillStyle = color + '33';
    ctx.fillRect(x, y, w, h);
    // border
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
    // inner grid
    ctx.shadowBlur = 4;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 1;
    for (let cx = x + w / 4; cx < x + w; cx += w / 4) {
      ctx.beginPath(); ctx.moveTo(cx, y); ctx.lineTo(cx, y + h); ctx.stroke();
    }
    for (let cy = y + h / 4; cy < y + h; cy += h / 4) {
      ctx.beginPath(); ctx.moveTo(x, cy); ctx.lineTo(x + w, cy); ctx.stroke();
    }
    // corner dots
    ctx.globalAlpha = 0.8;
    ctx.shadowBlur = 6;
    ctx.fillStyle = color;
    [[x + 4, y + 4], [x + w - 4, y + 4], [x + 4, y + h - 4], [x + w - 4, y + h - 4]].forEach(([cx, cy]) => {
      ctx.beginPath(); ctx.arc(cx, cy, 2, 0, Math.PI * 2); ctx.fill();
    });
    ctx.restore();
  };

  const drawPlayer = (ctx: CanvasRenderingContext2D, px: number, py: number, rotation: number, theme: ColorTheme, alive: boolean) => {
    const cx = px + PLAYER_SIZE / 2;
    const cy = py + PLAYER_SIZE / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((rotation * Math.PI) / 180);

    if (alive) {
      const s = PLAYER_SIZE;
      // outer glow shell
      ctx.shadowColor = theme.playerGlow;
      ctx.shadowBlur = 25;
      ctx.fillStyle = theme.player + '55';
      ctx.fillRect(-s / 2 - 3, -s / 2 - 3, s + 6, s + 6);

      // main body
      ctx.shadowBlur = 15;
      ctx.fillStyle = theme.player + 'cc';
      ctx.fillRect(-s / 2, -s / 2, s, s);

      // bright border
      ctx.shadowBlur = 8;
      ctx.strokeStyle = theme.player;
      ctx.lineWidth = 2;
      ctx.strokeRect(-s / 2 + 1, -s / 2 + 1, s - 2, s - 2);

      // inner orb
      const radGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 0.35);
      radGrad.addColorStop(0, '#ffffff');
      radGrad.addColorStop(0.4, theme.player + 'dd');
      radGrad.addColorStop(1, theme.player + '00');
      ctx.fillStyle = radGrad;
      ctx.shadowBlur = 12;
      ctx.shadowColor = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.35, 0, Math.PI * 2);
      ctx.fill();

      // diagonal slash detail
      ctx.shadowBlur = 5;
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-s / 2 + 5, -s / 2 + 5);
      ctx.lineTo(s / 2 - 5, s / 2 - 5);
      ctx.stroke();

      // corner squares
      ctx.shadowBlur = 8;
      ctx.fillStyle = theme.accent;
      const cs = 5;
      [[-s/2+2, -s/2+2], [s/2-cs-2, -s/2+2], [-s/2+2, s/2-cs-2], [s/2-cs-2, s/2-cs-2]].forEach(([bx, by]) => {
        ctx.fillRect(bx, by, cs, cs);
      });
    }
    ctx.restore();
  };

  const drawBackground = (ctx: CanvasRenderingContext2D, W: number, H: number, theme: ColorTheme, camX: number, frame: number, groundY: number) => {
    // Deep sky gradient
    const sky = ctx.createLinearGradient(0, 0, 0, groundY);
    sky.addColorStop(0, theme.sky);
    sky.addColorStop(0.6, theme.skyBottom);
    sky.addColorStop(1, theme.bg);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // Stars
    starsRef.current.forEach((star) => {
      const sx = ((star.x - camX * star.speed * 0.5) % W + W) % W;
      const twinkle = 0.6 + 0.4 * Math.sin(frame * 0.04 + star.twinkle);
      ctx.save();
      ctx.globalAlpha = star.alpha * twinkle;
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#aaaaff';
      ctx.shadowBlur = star.size * 4;
      ctx.beginPath();
      ctx.arc(sx, star.y, star.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // Scanlines
    ctx.save();
    ctx.globalAlpha = 0.03;
    ctx.fillStyle = '#ffffff';
    for (let sy = 0; sy < H; sy += 4) ctx.fillRect(0, sy, W, 1);
    ctx.restore();

    // BG pulse
    if (bgPulseRef.current > 0) {
      const pulse = bgPulseRef.current;
      const rg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.9);
      rg.addColorStop(0, theme.accent + Math.floor(pulse * 50).toString(16).padStart(2, '0'));
      rg.addColorStop(1, 'transparent');
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, W, H);
      bgPulseRef.current = Math.max(0, pulse - 0.025);
    }

    // Perspective grid (moving)
    ctx.save();
    ctx.globalAlpha = 0.1;
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 1;
    const gridPeriod = TILE * 3;
    const offsetX = -(camX * 0.4) % gridPeriod;
    for (let gx = offsetX; gx < W; gx += gridPeriod) {
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, groundY); ctx.stroke();
    }
    const horizonY = groundY * 0.3;
    for (let i = 0; i < 6; i++) {
      const t = i / 6;
      const gy = horizonY + (groundY - horizonY) * t;
      ctx.globalAlpha = 0.04 + t * 0.08;
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
    }
    ctx.restore();
  };

  const drawGround = (ctx: CanvasRenderingContext2D, W: number, H: number, groundY: number, theme: ColorTheme, camX: number) => {
    // Ground fill
    const gg = ctx.createLinearGradient(0, groundY, 0, H);
    gg.addColorStop(0, theme.ground + '22');
    gg.addColorStop(1, theme.ground + '08');
    ctx.fillStyle = gg;
    ctx.fillRect(0, groundY, W, H - groundY);

    // Main neon line
    neonLine(ctx, 0, groundY, W, groundY, theme.ground, 3, 20);

    // Grid tiles on floor
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = theme.ground;
    ctx.shadowColor = theme.groundGlow;
    ctx.shadowBlur = 5;
    ctx.lineWidth = 1;
    const tileW = TILE;
    const startX = -(camX % tileW);
    for (let gx = startX; gx <= W; gx += tileW) {
      ctx.beginPath(); ctx.moveTo(gx, groundY); ctx.lineTo(gx, H); ctx.stroke();
    }
    const tileH = TILE;
    for (let gy = groundY + tileH; gy < H; gy += tileH) {
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
    }
    ctx.restore();
  };

  const drawTrail = (ctx: CanvasRenderingContext2D, theme: ColorTheme) => {
    trailRef.current.forEach((pt) => {
      ctx.save();
      ctx.globalAlpha = pt.alpha * 0.55;
      ctx.translate(pt.x + pt.size / 2, pt.y + pt.size / 2);
      ctx.rotate((pt.rotation * Math.PI) / 180);
      ctx.shadowColor = theme.playerGlow;
      ctx.shadowBlur = 12;
      ctx.fillStyle = theme.player;
      ctx.fillRect(-pt.size / 2, -pt.size / 2, pt.size, pt.size);
      ctx.restore();
    });
  };

  const drawParticles = (ctx: CanvasRenderingContext2D) => {
    particlesRef.current.forEach((p) => {
      ctx.save();
      ctx.globalAlpha = p.life;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 14;
      ctx.fillStyle = p.color;
      if (p.shape === 'square') {
        const s = p.size * p.life;
        ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });
  };

  const drawProgressBar = (ctx: CanvasRenderingContext2D, W: number, progress: number, theme: ColorTheme) => {
    const bx = 40, by = 14, bw = W - 80, bh = 5;
    // track
    ctx.save();
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(bx, by, bw, bh);
    // checkpoint markers
    [0.25, 0.5, 0.75].forEach((cp) => {
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = theme.accent;
      ctx.fillRect(bx + bw * cp - 1, by - 2, 2, bh + 4);
    });
    // fill
    ctx.globalAlpha = 1;
    const fillGrad = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    fillGrad.addColorStop(0, theme.accent);
    fillGrad.addColorStop(1, theme.player);
    ctx.shadowColor = theme.playerGlow;
    ctx.shadowBlur = 10;
    ctx.fillStyle = fillGrad;
    ctx.fillRect(bx, by, bw * progress, bh);
    // percentage label
    ctx.shadowBlur = 6;
    ctx.font = 'bold 13px monospace';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.floor(progress * 100)}%`, W - 18, by + 13);
    ctx.restore();
  };

  const checkCollision = (px: number, py: number, obstacles: any[], groundY: number) => {
    const margin = 4;
    const pL = px + margin, pR = px + PLAYER_SIZE - margin;
    const pT = py + margin, pB = py + PLAYER_SIZE - margin;

    if (pB >= groundY) return { hit: false, onGround: true };

    for (const obs of obstacles) {
      const oL = obs.x + margin, oR = obs.x + obs.width - margin;
      const oT = obs.y + margin, oB = obs.y + obs.height - margin;
      if (pR > oL && pL < oR && pB > oT && pT < oB) {
        return { hit: true, onGround: false };
      }
    }
    return { hit: false, onGround: false };
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    initLevel();
    initStars(canvas.width, canvas.height);

    let localState: 'playing' | 'dead' | 'complete' = 'playing';
    let deathTimer = 0;
    let wasOnGround = true;

    const resetLevel = () => {
      const seed = getDailySeed();
      levelRef.current = generateLevel(seed, levelMode === 'infinite');
      const groundY = levelRef.current.groundY ?? 420;
      playerRef.current = { x: PLAYER_X, y: groundY - PLAYER_SIZE, vy: 0, rotation: 0, onGround: true };
      cameraXRef.current = 0;
      localState = 'playing';
      stateRef.current = 'playing';
      particlesRef.current = [];
      trailRef.current = [];
      jumpRef.current = false;
      frameRef.current = 0;
      wasOnGround = true;
      attemptsRef.current++;
      onAttemptChange(attemptsRef.current);
    };

    const loop = () => {
      animRef.current = requestAnimationFrame(loop);
      const level = levelRef.current;
      if (!level) return;

      const W = canvas.width, H = canvas.height;
      const groundY: number = level.groundY ?? 420;
      const theme: ColorTheme = level.colorTheme;
      const obstacles: any[] = level.obstacles ?? [];
      frameRef.current++;
      const frame = frameRef.current;

      // BPM pulse
      const bpmFrames = Math.round((60 / level.bpm) * 60);
      if (frame % bpmFrames === 0) bgPulseRef.current = 1;

      // ── UPDATE ──
      if (localState === 'playing') {
        const player = playerRef.current;

        // Scroll
        cameraXRef.current += SPEED;
        const worldX = cameraXRef.current - PLAYER_X + 60;

        // Physics
        player.vy += GRAVITY;
        player.y += player.vy;

        // Rotation
        if (!player.onGround) {
          player.rotation += 5.5;
        } else {
          const snap = Math.round(player.rotation / 90) * 90;
          player.rotation += (snap - player.rotation) * 0.25;
        }

        // Trail
        if (frame % 3 === 0) {
          const size = PLAYER_SIZE * (0.7 + Math.random() * 0.3);
          trailRef.current.push({ x: PLAYER_X, y: player.y, alpha: 0.55, rotation: player.rotation, size });
          if (trailRef.current.length > 12) trailRef.current.shift();
        }
        trailRef.current.forEach((t) => { t.alpha *= 0.86; });

        // Visible obstacles (for collision)
        const visObs = obstacles.filter((obs) => {
          const sx = obs.x - worldX;
          return sx > -80 && sx < W + 80;
        });

        // Collision
        const { hit, onGround } = checkCollision(PLAYER_X, player.y, visObs.map((o) => ({ ...o, x: o.x - worldX })), groundY);

        if (onGround) {
          if (!wasOnGround) {
            spawnLandParticles(PLAYER_X, groundY, theme.player);
          }
          player.y = groundY - PLAYER_SIZE;
          player.vy = 0;
          player.onGround = true;
          jumpBufferRef.current = 6; // coyote frames
        } else {
          player.onGround = false;
          if (jumpBufferRef.current > 0) jumpBufferRef.current--;
        }
        wasOnGround = player.onGround;

        // Jump input (with jump buffer)
        const jumpBuffered = frame - lastJumpFrameRef.current < 8;
        if ((jumpRef.current || jumpBuffered) && (player.onGround || jumpBufferRef.current > 0)) {
          player.vy = JUMP_VEL;
          player.onGround = false;
          jumpBufferRef.current = 0;
          jumpRef.current = false;
        } else {
          jumpRef.current = false;
        }

        // Death
        if (hit || player.y > groundY + 60 || player.y < -120) {
          localState = 'dead';
          stateRef.current = 'dead';
          deathTimer = 90;
          const progress = Math.min(worldX / level.totalLength, 1);
          spawnDeathParticles(PLAYER_X + PLAYER_SIZE / 2, player.y + PLAYER_SIZE / 2, theme);
          onDeath(progress, attemptsRef.current);
        }

        // Complete
        if (levelMode === 'daily' && worldX >= level.totalLength) {
          localState = 'complete';
          stateRef.current = 'complete';
          onComplete(1);
        }

        const progress = Math.min(worldX / level.totalLength, 1);
        if (frame % 8 === 0) onProgressUpdate(progress);

      } else if (localState === 'dead') {
        deathTimer--;
        particlesRef.current.forEach((p) => {
          p.x += p.vx; p.y += p.vy;
          p.vy += 0.15;
          p.life *= 0.93;
        });
        particlesRef.current = particlesRef.current.filter((p) => p.life > 0.03);
        if (deathTimer <= 0) {
          particlesRef.current = [];
          resetLevel();
        }
      }

      const worldX = cameraXRef.current - PLAYER_X + 60;

      // ── DRAW ──
      ctx.clearRect(0, 0, W, H);
      drawBackground(ctx, W, H, theme, cameraXRef.current, frame, groundY);
      drawGround(ctx, W, H, groundY, theme, cameraXRef.current);
      drawTrail(ctx, theme);

      // Obstacles
      obstacles.forEach((obs) => {
        const sx = obs.x - worldX;
        if (sx > W + 100 || sx < -100) return;
        if (obs.type === 'spike') {
          drawSpike(ctx, sx, obs.y, obs.width, obs.height, obs.color);
        } else {
          drawBlock(ctx, sx, obs.y, obs.width, obs.height, obs.color);
        }
      });

      // Player (hide during death flash)
      deathTimerRef.current = deathTimer;
      const showPlayer = localState === 'playing' || (localState === 'dead' && deathTimer > 50 && Math.floor(deathTimer / 4) % 2 === 0);
      if (showPlayer) {
        drawPlayer(ctx, PLAYER_X, playerRef.current.y, playerRef.current.rotation, theme, localState === 'playing');
      }

      drawParticles(ctx);

      // Update particles in playing state
      if (localState === 'playing') {
        particlesRef.current.forEach((p) => {
          p.x += p.vx; p.y += p.vy;
          p.vy += 0.1;
          p.life *= 0.92;
        });
        particlesRef.current = particlesRef.current.filter((p) => p.life > 0.03);
      }

      // Progress bar
      if (levelMode === 'daily') {
        const prog = Math.min(worldX / level.totalLength, 1);
        drawProgressBar(ctx, W, prog, theme);
      }

      // Level name bottom-left
      ctx.save();
      ctx.font = 'bold 15px monospace';
      ctx.fillStyle = theme.player;
      ctx.shadowColor = theme.playerGlow;
      ctx.shadowBlur = 10;
      ctx.textAlign = 'left';
      ctx.fillText(level.name, 18, H - 28);
      ctx.globalAlpha = 0.5;
      ctx.font = '12px monospace';
      ctx.fillStyle = '#fff';
      ctx.shadowBlur = 0;
      ctx.fillText(`Attempt ${attemptsRef.current}`, 18, H - 12);
      ctx.restore();

      // Mode badge top-right
      ctx.save();
      ctx.font = '11px monospace';
      ctx.fillStyle = theme.accent + 'cc';
      ctx.textAlign = 'right';
      ctx.fillText(levelMode === 'daily' ? '🌟 DAILY' : '♾️ INFINITE', W - 16, H - 12);
      ctx.restore();

      // Complete flash
      if (localState === 'complete') {
        ctx.save();
        ctx.fillStyle = `rgba(0,0,0,${0.5 + 0.1 * Math.sin(frame * 0.1)})`;
        ctx.fillRect(0, 0, W, H);
        ctx.shadowColor = theme.player;
        ctx.shadowBlur = 40;
        ctx.fillStyle = theme.player;
        ctx.font = `bold ${56 + Math.sin(frame * 0.08) * 4}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText('COMPLETE!', W / 2, H / 2 - 16);
        ctx.shadowBlur = 15;
        ctx.font = '22px monospace';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('100% ✨', W / 2, H / 2 + 26);
        ctx.restore();
      }


    };

    loop();
    return () => cancelAnimationFrame(animRef.current);
  }, [levelMode, initLevel, initStars, spawnDeathParticles, onDeath, onComplete, onProgressUpdate, onAttemptChange]);

  return { jump };
}
