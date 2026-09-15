class RetroAudio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.wakaAlt = false;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playTone(freq, type, duration, gainVal = 0.08) {
    if (this.muted || !this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {}
  }

  playWaka() {
    this.init();
    const freq = this.wakaAlt ? 330 : 490;
    this.wakaAlt = !this.wakaAlt;
    this.playTone(freq, 'triangle', 0.06, 0.05);
  }

  playPowerPellet() {
    this.init();
    this.playTone(600, 'square', 0.12, 0.08);
  }

  playEatGhost() {
    this.init();
    if (this.muted || !this.ctx) return;
    [320, 480, 640, 880].forEach((freq, idx) => {
      setTimeout(() => this.playTone(freq, 'sine', 0.08, 0.09), idx * 40);
    });
  }

  playDeath() {
    this.init();
    if (this.muted || !this.ctx) return;
    for (let i = 0; i < 7; i++) {
      setTimeout(() => {
        this.playTone(420 - i * 45, 'sawtooth', 0.09, 0.08);
      }, i * 65);
    }
  }

  playStart() {
    this.init();
    if (this.muted || !this.ctx) return;
    const notes = [261.6, 329.6, 392.0, 523.3];
    notes.forEach((freq, idx) => {
      setTimeout(() => this.playTone(freq, 'sine', 0.12, 0.08), idx * 90);
    });
  }
}

const audio = new RetroAudio();

const TILE_SIZE = 24;
const COLS = 19;
const ROWS = 21;
const TUNNEL_ROW = 10;
const STEP_MS = 1000 / 60;

// Ghost house geometry
const HOUSE_DOOR = { col: 9, row: 7 };                       // tile just above the gate
const HOUSE_DOOR_X = HOUSE_DOOR.col * TILE_SIZE + TILE_SIZE / 2;
const HOUSE_DOOR_Y = HOUSE_DOOR.row * TILE_SIZE + TILE_SIZE / 2;
const HOUSE_Y = 9 * TILE_SIZE + TILE_SIZE;                   // vertical middle of the house interior

// Original arcade timing (frames @60fps): scatter / chase alternation
const MODE_SCHEDULE = [
  ['SCATTER', 7 * 60], ['CHASE', 20 * 60],
  ['SCATTER', 7 * 60], ['CHASE', 20 * 60],
  ['SCATTER', 5 * 60], ['CHASE', 20 * 60],
  ['SCATTER', 5 * 60], ['CHASE', Infinity]
];

// Decision priority when distances tie: up, left, down, right (like the arcade)
const DIRS = [
  { dx: 0, dy: -1 },
  { dx: -1, dy: 0 },
  { dx: 0, dy: 1 },
  { dx: 1, dy: 0 }
];

const SPEED = {
  pacman: 2.0,
  ghost: 1.8,
  elroy1: 1.9,
  elroy2: 2.0,
  frightened: 1.1,
  tunnel: 1.0,
  eyes: 4.0,
  house: 0.4,
  exit: 1.2,
  enter: 2.0
};

// 1 = Wall, 2 = Light Commit (10), 3 = Med Commit (50), 4 = Dark Commit (100), 5 = Power Pellet (50), 0 = Empty, 6 = Ghost Gate
const INITIAL_MAP = [
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,5,2,2,2,2,2,2,1,1,1,2,2,2,2,2,2,5,1],
  [1,2,1,1,2,1,1,2,1,1,1,2,1,1,2,1,1,2,1],
  [1,3,1,1,3,1,1,3,2,2,2,3,1,1,3,1,1,3,1],
  [1,2,2,2,2,2,2,2,1,1,1,2,2,2,2,2,2,2,1],
  [1,2,1,1,2,1,2,1,1,1,1,1,2,1,2,1,1,2,1],
  [1,4,2,2,4,1,2,2,1,1,1,2,2,1,4,2,2,4,1],
  [1,1,1,1,2,1,1,0,0,0,0,0,1,1,2,1,1,1,1],
  [1,1,1,1,2,1,0,0,1,6,1,0,0,1,2,1,1,1,1],
  [1,1,1,1,2,1,0,1,0,0,0,1,0,1,2,1,1,1,1],
  [0,0,0,0,2,0,0,1,0,0,0,1,0,0,2,0,0,0,0],
  [1,1,1,1,2,1,0,1,1,1,1,1,0,1,2,1,1,1,1],
  [1,1,1,1,2,1,0,0,0,0,0,0,0,1,2,1,1,1,1],
  [1,1,1,1,2,1,2,1,1,1,1,1,2,1,2,1,1,1,1],
  [1,2,2,2,3,2,2,2,1,1,1,2,2,2,3,2,2,2,1],
  [1,2,1,1,2,1,1,2,1,1,1,2,1,1,2,1,1,2,1],
  [1,5,2,1,3,2,2,3,0,0,0,3,2,2,3,1,2,5,1],
  [1,1,2,1,2,1,2,1,1,1,1,1,2,1,2,1,2,1,1],
  [1,4,2,2,4,1,2,2,1,1,1,2,2,1,4,2,2,4,1],
  [1,2,1,1,1,1,1,2,2,2,2,2,1,1,1,1,1,2,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
];

// Blinky / Pinky / Inky / Clyde personalities, GitHub themed
const GHOST_DEFS = [
  { name: 'Merge Conflict', color: '#ff3366', homeX: 9,  scatter: { col: COLS - 2, row: -2 },       exitDelay: 0 },
  { name: 'NullPointer',    color: '#ff77aa', homeX: 9,  scatter: { col: 1, row: -2 },              exitDelay: 60 },
  { name: 'Memory Leak',    color: '#00f0ff', homeX: 8,  scatter: { col: COLS - 2, row: ROWS + 1 }, exitDelay: 300 },
  { name: 'Prod Bug',       color: '#ff9900', homeX: 10, scatter: { col: 1, row: ROWS + 1 },        exitDelay: 600 }
];

class PacmanGame {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.canvas.width = COLS * TILE_SIZE;
    this.canvas.height = ROWS * TILE_SIZE;

    this.map = [];
    this.score = 0;
    this.highScore = parseInt(localStorage.getItem('gh_pacman_highscore') || '12040', 10);
    this.commitsEaten = 0;
    this.totalCommits = 0;
    this.lives = 3;
    this.state = 'READY'; // READY, PLAYING, PAUSED, DYING, GAMEOVER, VICTORY

    this.frightenedTimer = 0;
    this.frightenedDuration = 7 * 60;
    this.ghostCombo = 0;
    this.freezeTimer = 0;
    this.readyTimer = 0;
    this.deathTimer = 0;
    this.popups = [];

    this.modeIndex = 0;
    this.mode = MODE_SCHEDULE[0][0];
    this.modeTimer = MODE_SCHEDULE[0][1];

    this.lastTime = 0;
    this.accumulator = 0;

    this.pacman = {
      x: 0, y: 0,
      dirX: -1, dirY: 0,
      nextDirX: -1, nextDirY: 0,
      faceX: -1, faceY: 0,
      moving: false,
      speed: SPEED.pacman,
      mouthAngle: 0.2,
      mouthSpeed: 0.04,
      mouthOpening: true
    };

    this.ghosts = GHOST_DEFS.map((def, id) => ({
      id,
      name: def.name,
      color: def.color,
      homeX: def.homeX * TILE_SIZE + TILE_SIZE / 2,
      scatter: def.scatter,
      exitDelay: def.exitDelay,
      x: 0, y: 0,
      dirX: 0, dirY: 0,
      state: 'house', // house, exiting, normal, frightened, eaten, entering
      exitTimer: 0,
      bobDir: 1,
      decidedKey: -1
    }));

    this.initMap();
    this.resetPositions();
    this.bindEvents();
    this.updateHUD();
  }

  initMap() {
    this.map = INITIAL_MAP.map(row => [...row]);
    this.totalCommits = 0;
    this.commitsEaten = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if ([2, 3, 4, 5].includes(this.map[r][c])) {
          this.totalCommits++;
        }
      }
    }
  }

  bindEvents() {
    const handleKey = (key) => {
      audio.init();
      switch (key) {
        case 'ArrowUp': case 'w': case 'W': case 'KeyW':
          this.setDirection(0, -1);
          break;
        case 'ArrowDown': case 's': case 'S': case 'KeyS':
          this.setDirection(0, 1);
          break;
        case 'ArrowLeft': case 'a': case 'A': case 'KeyA':
          this.setDirection(-1, 0);
          break;
        case 'ArrowRight': case 'd': case 'D': case 'KeyD':
          this.setDirection(1, 0);
          break;
        case ' ': case 'p': case 'P': case 'KeyP':
          this.togglePause();
          break;
      }
    };

    // Single capture-phase listener: works regardless of which element has focus.
    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }
      if (e.repeat) return;
      handleKey(e.key || e.code);
    }, { capture: true });

    // Virtual D-pad
    const addDpadListener = (el, dir) => {
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        audio.init();
        if (dir === 'up') this.setDirection(0, -1);
        if (dir === 'down') this.setDirection(0, 1);
        if (dir === 'left') this.setDirection(-1, 0);
        if (dir === 'right') this.setDirection(1, 0);
      });
    };

    document.querySelectorAll('.d-btn').forEach(btn => {
      addDpadListener(btn, btn.getAttribute('data-dir'));
    });

    // Swipe controls
    let touchStartX = 0;
    let touchStartY = 0;
    window.addEventListener('touchstart', (e) => {
      if (e.touches && e.touches[0]) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        audio.init();
      }
    }, { passive: true });

    window.addEventListener('touchend', (e) => {
      if (e.changedTouches && e.changedTouches[0]) {
        const dx = e.changedTouches[0].clientX - touchStartX;
        const dy = e.changedTouches[0].clientY - touchStartY;
        if (Math.abs(dx) > 20 || Math.abs(dy) > 20) {
          if (Math.abs(dx) > Math.abs(dy)) {
            this.setDirection(dx > 0 ? 1 : -1, 0);
          } else {
            this.setDirection(0, dy > 0 ? 1 : -1);
          }
        }
      }
    }, { passive: true });
  }

  // ---------------------------------------------------------------------------
  // Maze helpers
  // ---------------------------------------------------------------------------

  isWalkable(col, row, allowGate = false) {
    if (row === TUNNEL_ROW && (col < 0 || col >= COLS)) return true;
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return false;
    const tile = this.map[row][col];
    if (tile === 1) return false;
    if (tile === 6) return allowGate;
    return true;
  }

  isTunnel(col, row) {
    return row === TUNNEL_ROW && (col <= 3 || col >= COLS - 4);
  }

  wrapX(entity) {
    const width = COLS * TILE_SIZE;
    if (entity.x < -TILE_SIZE / 2) entity.x += width;
    else if (entity.x > width + TILE_SIZE / 2) entity.x -= width;
  }

  // ---------------------------------------------------------------------------
  // Game flow
  // ---------------------------------------------------------------------------

  setDirection(dx, dy) {
    if (this.state === 'READY') {
      this.startGame();
    }
    if (this.state !== 'PLAYING') return;

    const p = this.pacman;
    // Instant reverse, no need to be aligned
    if (dx === -p.dirX && dy === -p.dirY) {
      p.dirX = dx;
      p.dirY = dy;
    }
    p.nextDirX = dx;
    p.nextDirY = dy;
  }

  startGame() {
    this.state = 'PLAYING';
    this.readyTimer = 90;
    const startOverlay = document.getElementById('startOverlay');
    if (startOverlay) startOverlay.classList.add('hidden');
    const gameOverOverlay = document.getElementById('gameOverOverlay');
    if (gameOverOverlay) gameOverOverlay.classList.add('hidden');
    audio.playStart();
  }

  togglePause() {
    const pauseLabel = document.getElementById('pauseLabel');
    if (this.state === 'PLAYING') {
      this.state = 'PAUSED';
      if (pauseLabel) pauseLabel.textContent = 'Resume';
    } else if (this.state === 'PAUSED') {
      this.state = 'PLAYING';
      if (pauseLabel) pauseLabel.textContent = 'Pause';
    }
  }

  restart() {
    this.initMap();
    this.score = 0;
    this.lives = 3;
    this.popups = [];
    this.resetPositions();
    this.updateHUD();
    this.startGame();
  }

  resetPositions() {
    const p = this.pacman;
    p.x = 9 * TILE_SIZE + TILE_SIZE / 2;
    p.y = 16 * TILE_SIZE + TILE_SIZE / 2;
    p.dirX = -1; p.dirY = 0;
    p.nextDirX = -1; p.nextDirY = 0;
    p.faceX = -1; p.faceY = 0;
    p.moving = false;
    p.mouthAngle = 0.2;

    this.frightenedTimer = 0;
    this.freezeTimer = 0;
    this.ghostCombo = 0;
    this.modeIndex = 0;
    this.mode = MODE_SCHEDULE[0][0];
    this.modeTimer = MODE_SCHEDULE[0][1];

    this.ghosts.forEach(ghost => {
      ghost.decidedKey = -1;
      ghost.bobDir = ghost.id % 2 === 0 ? 1 : -1;
      if (ghost.id === 0) {
        // Blinky starts outside, right above the door, heading left
        ghost.x = HOUSE_DOOR_X;
        ghost.y = HOUSE_DOOR_Y;
        ghost.dirX = -1; ghost.dirY = 0;
        ghost.state = 'normal';
        ghost.decidedKey = HOUSE_DOOR.row * COLS + HOUSE_DOOR.col;
      } else {
        ghost.x = ghost.homeX;
        ghost.y = HOUSE_Y;
        ghost.dirX = 0; ghost.dirY = ghost.bobDir;
        ghost.state = 'house';
        ghost.exitTimer = ghost.exitDelay;
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Pac-Man
  // ---------------------------------------------------------------------------

  updatePacman() {
    const p = this.pacman;
    const col = Math.floor(p.x / TILE_SIZE);
    const row = Math.floor(p.y / TILE_SIZE);
    const cx = col * TILE_SIZE + TILE_SIZE / 2;
    const cy = row * TILE_SIZE + TILE_SIZE / 2;

    // 1. Buffered turn (with a little cornering tolerance, like the arcade)
    if (p.nextDirX !== p.dirX || p.nextDirY !== p.dirY) {
      const wantHorizontal = p.nextDirX !== 0;
      const aligned = wantHorizontal ? Math.abs(p.y - cy) <= 6 : Math.abs(p.x - cx) <= 6;
      if (aligned && this.isWalkable(col + p.nextDirX, row + p.nextDirY)) {
        if (wantHorizontal) p.y = cy; else p.x = cx;
        p.dirX = p.nextDirX;
        p.dirY = p.nextDirY;
      }
    }

    // 2. Advance, never past the tile centre if the next tile is a wall
    let step = p.speed;
    if (!this.isWalkable(col + p.dirX, row + p.dirY)) {
      const ahead = p.dirX !== 0 ? (cx - p.x) * p.dirX : (cy - p.y) * p.dirY;
      step = Math.max(0, Math.min(step, ahead));
    }
    p.moving = step > 0;
    if (p.moving) {
      p.x += p.dirX * step;
      p.y += p.dirY * step;
      p.faceX = p.dirX;
      p.faceY = p.dirY;
    }
    this.wrapX(p);

    // 3. Mouth animation
    if (p.moving) {
      if (p.mouthOpening) {
        p.mouthAngle += p.mouthSpeed;
        if (p.mouthAngle >= 0.4) p.mouthOpening = false;
      } else {
        p.mouthAngle -= p.mouthSpeed;
        if (p.mouthAngle <= 0.04) p.mouthOpening = true;
      }
    }

    // 4. Eat dots
    const eatCol = Math.floor(p.x / TILE_SIZE);
    const eatRow = Math.floor(p.y / TILE_SIZE);
    if (eatRow >= 0 && eatRow < ROWS && eatCol >= 0 && eatCol < COLS) {
      const tile = this.map[eatRow][eatCol];
      if ([2, 3, 4, 5].includes(tile)) {
        this.map[eatRow][eatCol] = 0;
        this.commitsEaten++;

        if (tile === 2) {
          this.addScore(10);
          audio.playWaka();
        } else if (tile === 3) {
          this.addScore(50);
          audio.playWaka();
        } else if (tile === 4) {
          this.addScore(100);
          audio.playWaka();
        } else if (tile === 5) {
          this.addScore(50);
          this.startFrightened();
          audio.playPowerPellet();
        }

        this.updateHUD();

        if (this.commitsEaten >= this.totalCommits) {
          this.state = 'VICTORY';
          this.showEndScreen('ALL COMMITS SHIPPED', 'You resolved all conflicts and deployed cleanly.');
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Ghost AI (arcade rules: scatter/chase modes, per-ghost targets, no U-turns)
  // ---------------------------------------------------------------------------

  startFrightened() {
    this.frightenedTimer = this.frightenedDuration;
    this.ghostCombo = 0;
    this.ghosts.forEach(ghost => {
      if (ghost.state === 'normal' || ghost.state === 'frightened') {
        ghost.state = 'frightened';
        this.reverseGhost(ghost);
      }
    });
  }

  reverseGhost(ghost) {
    ghost.dirX = -ghost.dirX;
    ghost.dirY = -ghost.dirY;
    // Re-evaluate at the next tile centre: the way back may be a wall
    ghost.decidedKey = -1;
  }

  advanceMode() {
    if (this.modeIndex >= MODE_SCHEDULE.length - 1) return;
    this.modeIndex++;
    this.mode = MODE_SCHEDULE[this.modeIndex][0];
    this.modeTimer = MODE_SCHEDULE[this.modeIndex][1];
    // Mode switch forces every roaming ghost to turn around
    this.ghosts.forEach(ghost => {
      if (ghost.state === 'normal') this.reverseGhost(ghost);
    });
  }

  pacmanTile() {
    return {
      col: Math.floor(this.pacman.x / TILE_SIZE),
      row: Math.floor(this.pacman.y / TILE_SIZE)
    };
  }

  ghostTile(ghost) {
    return {
      col: Math.floor(ghost.x / TILE_SIZE),
      row: Math.floor(ghost.y / TILE_SIZE)
    };
  }

  isElroy(ghost) {
    return ghost.id === 0 && (this.totalCommits - this.commitsEaten) <= 25;
  }

  ghostTarget(ghost) {
    if (ghost.state === 'eaten') return HOUSE_DOOR;

    // Blinky in "Cruise Elroy" keeps chasing even in scatter
    if (this.mode === 'SCATTER' && !this.isElroy(ghost)) return ghost.scatter;

    const pac = this.pacmanTile();
    const fx = this.pacman.faceX;
    const fy = this.pacman.faceY;

    switch (ghost.id) {
      case 0: // Blinky: straight at Pac-Man
        return pac;
      case 1: { // Pinky: 4 tiles ahead (with the famous "up" overflow quirk)
        const t = { col: pac.col + fx * 4, row: pac.row + fy * 4 };
        if (fy === -1) t.col -= 4;
        return t;
      }
      case 2: { // Inky: vector from Blinky through 2 tiles ahead, doubled
        const blinky = this.ghostTile(this.ghosts[0]);
        const mid = { col: pac.col + fx * 2, row: pac.row + fy * 2 };
        if (fy === -1) mid.col -= 2;
        return { col: mid.col + (mid.col - blinky.col), row: mid.row + (mid.row - blinky.row) };
      }
      default: { // Clyde: chase when far, retreat to corner when within 8 tiles
        const g = this.ghostTile(ghost);
        const d = Math.hypot(g.col - pac.col, g.row - pac.row);
        return d > 8 ? pac : ghost.scatter;
      }
    }
  }

  ghostSpeed(ghost) {
    if (ghost.state === 'eaten') return SPEED.eyes;
    const t = this.ghostTile(ghost);
    if (this.isTunnel(t.col, t.row)) return SPEED.tunnel;
    if (ghost.state === 'frightened') return SPEED.frightened;
    if (ghost.id === 0) {
      const left = this.totalCommits - this.commitsEaten;
      if (left <= 10) return SPEED.elroy2;
      if (left <= 25) return SPEED.elroy1;
    }
    return SPEED.ghost;
  }

  chooseGhostDir(ghost, col, row) {
    if (ghost.state === 'eaten' && col === HOUSE_DOOR.col && row === HOUSE_DOOR.row) {
      ghost.state = 'entering';
      ghost.dirX = 0;
      ghost.dirY = 1;
      return;
    }

    let options = DIRS.filter(d =>
      !(d.dx === -ghost.dirX && d.dy === -ghost.dirY) &&
      this.isWalkable(col + d.dx, row + d.dy)
    );
    if (options.length === 0) {
      // Dead end: only then may a ghost turn around
      options = DIRS.filter(d => this.isWalkable(col + d.dx, row + d.dy));
      if (options.length === 0) return;
    }

    let pick = options[0];
    if (ghost.state === 'frightened') {
      pick = options[Math.floor(Math.random() * options.length)];
    } else {
      const target = this.ghostTarget(ghost);
      let best = Infinity;
      for (const d of options) {
        const dist = Math.hypot(col + d.dx - target.col, row + d.dy - target.row);
        if (dist < best) {
          best = dist;
          pick = d;
        }
      }
    }
    ghost.dirX = pick.dx;
    ghost.dirY = pick.dy;
  }

  moveGhost(ghost, speed) {
    let remaining = speed;
    let guard = 0;
    while (remaining > 0.0001 && guard++ < 4) {
      const col = Math.floor(ghost.x / TILE_SIZE);
      const row = Math.floor(ghost.y / TILE_SIZE);
      const cx = col * TILE_SIZE + TILE_SIZE / 2;
      const cy = row * TILE_SIZE + TILE_SIZE / 2;
      const key = row * COLS + col;
      const ahead = ghost.dirX !== 0 ? (cx - ghost.x) * ghost.dirX : (cy - ghost.y) * ghost.dirY;

      if (ahead >= 0 && ahead <= remaining && ghost.decidedKey !== key) {
        // Reach the tile centre this frame: snap, decide once, spend the rest of the step
        ghost.x = cx;
        ghost.y = cy;
        remaining -= ahead;
        ghost.decidedKey = key;
        this.chooseGhostDir(ghost, col, row);
        if (ghost.state === 'entering') return;
        continue;
      }

      ghost.x += ghost.dirX * remaining;
      ghost.y += ghost.dirY * remaining;
      remaining = 0;
    }
    this.wrapX(ghost);
  }

  updateGhost(ghost) {
    switch (ghost.state) {
      case 'house': {
        ghost.y += ghost.bobDir * SPEED.house;
        if (ghost.y > HOUSE_Y + 5) ghost.bobDir = -1;
        if (ghost.y < HOUSE_Y - 5) ghost.bobDir = 1;
        ghost.dirX = 0;
        ghost.dirY = ghost.bobDir;
        if (ghost.exitTimer > 0) ghost.exitTimer--;
        else ghost.state = 'exiting';
        return;
      }
      case 'exiting': {
        const dx = HOUSE_DOOR_X - ghost.x;
        if (Math.abs(dx) > 0.5) {
          const stepX = Math.min(SPEED.exit, Math.abs(dx));
          ghost.x += Math.sign(dx) * stepX;
          ghost.dirX = Math.sign(dx);
          ghost.dirY = 0;
        } else if (ghost.y > HOUSE_DOOR_Y) {
          ghost.x = HOUSE_DOOR_X;
          ghost.y = Math.max(HOUSE_DOOR_Y, ghost.y - SPEED.exit);
          ghost.dirX = 0;
          ghost.dirY = -1;
        } else {
          ghost.y = HOUSE_DOOR_Y;
          ghost.state = this.frightenedTimer > 0 ? 'frightened' : 'normal';
          ghost.dirX = 0;
          ghost.dirY = -1;
          this.chooseGhostDir(ghost, HOUSE_DOOR.col, HOUSE_DOOR.row);
          ghost.decidedKey = HOUSE_DOOR.row * COLS + HOUSE_DOOR.col;
        }
        return;
      }
      case 'entering': {
        ghost.dirX = 0;
        ghost.dirY = 1;
        ghost.y = Math.min(HOUSE_Y, ghost.y + SPEED.enter);
        if (ghost.y >= HOUSE_Y) {
          ghost.state = 'house';
          ghost.exitTimer = 30;
          ghost.bobDir = 1;
        }
        return;
      }
      default:
        this.moveGhost(ghost, this.ghostSpeed(ghost));
    }
  }

  checkCollisions() {
    const p = this.pacman;
    for (const ghost of this.ghosts) {
      const collidable = ghost.state === 'normal' || ghost.state === 'frightened' || ghost.state === 'exiting';
      if (!collidable) continue;
      if (Math.abs(ghost.x - p.x) >= 12 || Math.abs(ghost.y - p.y) >= 12) continue;

      const scared = ghost.state === 'frightened' || (ghost.state === 'exiting' && this.frightenedTimer > 0);
      if (scared) {
        const points = 200 * Math.pow(2, this.ghostCombo);
        this.ghostCombo = Math.min(this.ghostCombo + 1, 3);
        this.addScore(points);
        this.updateHUD();
        this.popups.push({ x: ghost.x, y: ghost.y, text: String(points), timer: 60 });
        ghost.state = 'eaten';
        ghost.decidedKey = -1;
        if (ghost.dirX === 0 && ghost.dirY === 0) ghost.dirY = -1;
        this.freezeTimer = 30;
        audio.playEatGhost();
      } else {
        this.state = 'DYING';
        this.deathTimer = 100;
        this.lives--;
        this.updateHUD();
        audio.playDeath();
        return;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Main update (fixed 60 Hz step)
  // ---------------------------------------------------------------------------

  update() {
    if (this.state === 'DYING') {
      this.deathTimer--;
      if (this.deathTimer <= 0) {
        if (this.lives <= 0) {
          this.state = 'GAMEOVER';
          this.showEndScreen('MERGE CONFLICT DETECTED', 'Production was halted by bugs.');
        } else {
          this.resetPositions();
          this.state = 'PLAYING';
          this.readyTimer = 60;
        }
      }
      return;
    }

    if (this.state !== 'PLAYING') return;

    if (this.readyTimer > 0) {
      this.readyTimer--;
      return;
    }

    this.popups.forEach(pop => pop.timer--);
    this.popups = this.popups.filter(pop => pop.timer > 0);

    if (this.freezeTimer > 0) {
      this.freezeTimer--;
      return;
    }

    if (this.frightenedTimer > 0) {
      // Scatter/chase clock pauses while ghosts are frightened (arcade behaviour)
      this.frightenedTimer--;
      if (this.frightenedTimer === 0) {
        this.ghosts.forEach(ghost => {
          if (ghost.state === 'frightened') ghost.state = 'normal';
        });
      }
    } else if (this.modeTimer !== Infinity) {
      this.modeTimer--;
      if (this.modeTimer <= 0) this.advanceMode();
    }

    this.updatePacman();
    if (this.state !== 'PLAYING') return;

    this.ghosts.forEach(ghost => this.updateGhost(ghost));
    this.checkCollisions();
  }

  addScore(pts) {
    this.score += pts;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('gh_pacman_highscore', this.highScore);
    }
  }

  updateHUD() {
    const s1 = document.getElementById('score1Up');
    if (s1) s1.textContent = this.score.toString().padStart(5, '0');

    const sh = document.getElementById('scoreHigh');
    if (sh) sh.textContent = this.highScore.toString().padStart(5, '0');

    const sc = document.getElementById('scoreCommits');
    if (sc) sc.textContent = `${this.commitsEaten}/${this.totalCommits}`;

    const livesContainer = document.getElementById('livesDisplay');
    if (livesContainer) {
      livesContainer.innerHTML = Array.from({ length: Math.max(0, this.lives) })
        .map(() => '<svg class="life-icon" viewBox="0 0 20 20" width="15" height="15"><path d="M10 0 A10 10 0 1 0 20 10 L10 10 Z" fill="#f7b733"/></svg>')
        .join('');
    }
  }

  showEndScreen(title, subtitle) {
    const et = document.getElementById('endTitle');
    if (et) et.textContent = title;
    const es = document.getElementById('endSubtitle');
    if (es) es.textContent = subtitle;
    const go = document.getElementById('gameOverOverlay');
    if (go) go.classList.remove('hidden');
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.drawMaze();
    this.drawPacman();
    this.ghosts.forEach(ghost => this.drawGhost(ghost));
    this.drawPopups();

    if (this.readyTimer > 0 && this.state === 'PLAYING') {
      ctx.save();
      ctx.font = 'bold 14px "Press Start 2P", "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#f7b733';
      ctx.shadowColor = '#f7b733';
      ctx.shadowBlur = 8;
      ctx.fillText('READY!', 9 * TILE_SIZE + TILE_SIZE / 2, 12 * TILE_SIZE + TILE_SIZE / 2 + 1);
      ctx.restore();
    }
  }

  drawMaze() {
    const ctx = this.ctx;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const tile = this.map[r][c];
        const x = c * TILE_SIZE;
        const y = r * TILE_SIZE;

        if (tile === 1) {
          ctx.fillStyle = '#0f1c30';
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);

          ctx.strokeStyle = '#1e3860';
          ctx.lineWidth = 2;
          ctx.strokeRect(x + 1, y + 1, TILE_SIZE - 2, TILE_SIZE - 2);

          ctx.strokeStyle = '#00f0ff';
          ctx.lineWidth = 1;
          ctx.strokeRect(x + 3, y + 3, TILE_SIZE - 6, TILE_SIZE - 6);
        } else if (tile === 6) {
          ctx.fillStyle = '#ff007f';
          ctx.fillRect(x, y + TILE_SIZE / 2 - 2, TILE_SIZE, 4);
        } else if (tile === 2) {
          ctx.fillStyle = '#0e4429';
          ctx.beginPath();
          ctx.arc(x + TILE_SIZE / 2, y + TILE_SIZE / 2, 3, 0, Math.PI * 2);
          ctx.fill();
        } else if (tile === 3) {
          ctx.fillStyle = '#26a641';
          ctx.beginPath();
          ctx.arc(x + TILE_SIZE / 2, y + TILE_SIZE / 2, 4, 0, Math.PI * 2);
          ctx.fill();
        } else if (tile === 4) {
          ctx.fillStyle = '#39d353';
          ctx.shadowColor = '#39d353';
          ctx.shadowBlur = 6;
          ctx.beginPath();
          ctx.arc(x + TILE_SIZE / 2, y + TILE_SIZE / 2, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        } else if (tile === 5) {
          const pulse = (Math.sin(Date.now() / 150) + 1) / 2;
          ctx.fillStyle = '#f7b733';
          ctx.shadowColor = '#f7b733';
          ctx.shadowBlur = 10 + pulse * 8;
          ctx.beginPath();
          ctx.arc(x + TILE_SIZE / 2, y + TILE_SIZE / 2, 7 + pulse * 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }
    }
  }

  drawPacman() {
    const ctx = this.ctx;
    const p = this.pacman;

    let rotation = 0;
    if (p.faceX === 1) rotation = 0;
    else if (p.faceX === -1) rotation = Math.PI;
    else if (p.faceY === 1) rotation = Math.PI / 2;
    else if (p.faceY === -1) rotation = -Math.PI / 2;

    let mouth = p.mouthAngle;
    if (this.state === 'DYING') {
      // Death animation: mouth opens all the way round, then vanish
      const progress = 1 - this.deathTimer / 100;
      if (progress > 0.9) return;
      mouth = 0.1 + Math.min(progress / 0.9, 1) * 0.9;
      rotation = -Math.PI / 2;
    }

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(rotation);
    ctx.fillStyle = '#f7b733';
    ctx.shadowColor = '#f7b733';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(0, 0, 10, mouth * Math.PI, (2 - mouth) * Math.PI);
    ctx.lineTo(0, 0);
    ctx.fill();
    ctx.restore();
  }

  drawGhost(ghost) {
    const ctx = this.ctx;
    const eyesOnly = ghost.state === 'eaten' || ghost.state === 'entering';
    const scared = ghost.state === 'frightened' ||
      ((ghost.state === 'house' || ghost.state === 'exiting') && this.frightenedTimer > 0);

    ctx.save();
    ctx.translate(ghost.x, ghost.y);

    if (!eyesOnly) {
      let bodyColor = ghost.color;
      if (scared) {
        const flash = this.frightenedTimer < 120 && Math.floor(this.frightenedTimer / 12) % 2 === 0;
        bodyColor = flash ? '#f5f5f5' : '#1e3fff';
      }

      ctx.fillStyle = bodyColor;
      ctx.shadowColor = bodyColor;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(0, -2, 9, Math.PI, 0, false);
      ctx.lineTo(9, 8);
      ctx.lineTo(5, 5);
      ctx.lineTo(0, 8);
      ctx.lineTo(-5, 5);
      ctx.lineTo(-9, 8);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;

      if (scared) {
        // Scared face: small eyes + zigzag mouth
        const faceColor = bodyColor === '#f5f5f5' ? '#ff3366' : '#f5d6a0';
        ctx.fillStyle = faceColor;
        ctx.fillRect(-5, -4, 2, 2);
        ctx.fillRect(3, -4, 2, 2);
        ctx.strokeStyle = faceColor;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(-6, 3);
        ctx.lineTo(-4, 1);
        ctx.lineTo(-2, 3);
        ctx.lineTo(0, 1);
        ctx.lineTo(2, 3);
        ctx.lineTo(4, 1);
        ctx.lineTo(6, 3);
        ctx.stroke();
        ctx.restore();
        return;
      }
    }

    // Eyes
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-4, -3, 3, 0, Math.PI * 2);
    ctx.arc(4, -3, 3, 0, Math.PI * 2);
    ctx.fill();

    // Pupils look in the travel direction
    ctx.fillStyle = eyesOnly ? '#1e3fff' : '#0a0e17';
    const pOffsetX = ghost.dirX * 1.5;
    const pOffsetY = ghost.dirY * 1.5;
    ctx.beginPath();
    ctx.arc(-4 + pOffsetX, -3 + pOffsetY, 1.5, 0, Math.PI * 2);
    ctx.arc(4 + pOffsetX, -3 + pOffsetY, 1.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  drawPopups() {
    const ctx = this.ctx;
    if (this.popups.length === 0) return;
    ctx.save();
    ctx.font = 'bold 10px "Press Start 2P", "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    this.popups.forEach(pop => {
      ctx.globalAlpha = Math.min(1, pop.timer / 20);
      ctx.fillStyle = '#00f0ff';
      ctx.fillText(pop.text, pop.x, pop.y - (60 - pop.timer) * 0.2);
    });
    ctx.restore();
  }

  loop(now) {
    if (!this.lastTime) this.lastTime = now;
    let delta = now - this.lastTime;
    this.lastTime = now;
    if (delta > 100) delta = 100; // tab was hidden: don't fast-forward
    this.accumulator += delta;
    while (this.accumulator >= STEP_MS) {
      this.update();
      this.accumulator -= STEP_MS;
    }
    this.draw();
    requestAnimationFrame((t) => this.loop(t));
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('gameCanvas');
  const game = new PacmanGame(canvas);

  const startBtn = document.getElementById('startBtn');
  if (startBtn) {
    startBtn.addEventListener('click', (e) => {
      e.preventDefault();
      startBtn.blur();
      canvas.focus();
      audio.init();
      game.startGame();
    });
  }

  canvas.addEventListener('click', () => {
    canvas.focus();
  });

  const restartBtn = document.getElementById('restartBtn');
  if (restartBtn) {
    restartBtn.addEventListener('click', (e) => {
      e.preventDefault();
      audio.init();
      game.restart();
    });
  }

  const pauseBtn = document.getElementById('pauseBtn');
  if (pauseBtn) {
    pauseBtn.addEventListener('click', (e) => {
      e.preventDefault();
      game.togglePause();
    });
  }

  const muteBtn = document.getElementById('muteBtn');
  if (muteBtn) {
    muteBtn.addEventListener('click', (e) => {
      e.preventDefault();
      audio.muted = !audio.muted;
      const muteIcon = document.getElementById('muteIcon');
      const muteLabel = document.getElementById('muteLabel');
      if (audio.muted) {
        if (muteIcon) {
          muteIcon.innerHTML = '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line>';
        }
        if (muteLabel) muteLabel.textContent = 'Muted';
      } else {
        if (muteIcon) {
          muteIcon.innerHTML = '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>';
        }
        if (muteLabel) muteLabel.textContent = 'Sound';
      }
    });
  }

  requestAnimationFrame((t) => game.loop(t));
});
