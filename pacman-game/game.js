// GitHub Retro Pac-Man Arcade Engine
// Theme: Git Commits, Octocat Power Pellets & Bug Ghosts

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
  [0,0,0,1,2,1,0,0,1,6,1,0,0,1,2,1,0,0,0],
  [1,1,1,1,2,1,0,1,0,0,0,1,0,1,2,1,1,1,1],
  [0,0,0,0,2,0,0,1,0,0,0,1,0,0,2,0,0,0,0],
  [1,1,1,1,2,1,0,1,1,1,1,1,0,1,2,1,1,1,1],
  [0,0,0,1,2,1,0,0,0,0,0,0,0,1,2,1,0,0,0],
  [1,1,1,1,2,1,2,1,1,1,1,1,2,1,2,1,1,1,1],
  [1,2,2,2,3,2,2,2,1,1,1,2,2,2,3,2,2,2,1],
  [1,2,1,1,2,1,1,2,1,1,1,2,1,1,2,1,1,2,1],
  [1,5,2,1,3,2,2,3,0,0,0,3,2,2,3,1,2,5,1],
  [1,1,2,1,2,1,2,1,1,1,1,1,2,1,2,1,2,1,1],
  [1,4,2,2,4,1,2,2,1,1,1,2,2,1,4,2,2,4,1],
  [1,2,1,1,1,1,1,2,2,2,2,2,1,1,1,1,1,2,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
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
    this.state = 'READY'; // READY, PLAYING, PAUSED, GAMEOVER, VICTORY
    this.frightenedTimer = 0;
    this.frightenedDuration = 450;

    this.pacman = {
      x: 9 * TILE_SIZE + TILE_SIZE / 2,
      y: 16 * TILE_SIZE + TILE_SIZE / 2,
      dirX: -1, // Start moving left immediately
      dirY: 0,
      nextDirX: -1,
      nextDirY: 0,
      speed: 2,
      mouthAngle: 0.2,
      mouthSpeed: 0.04,
      mouthOpening: true
    };

    this.ghosts = [
      { name: 'Merge Conflict', color: '#ff3366', col: 9, row: 8, x: 9 * TILE_SIZE + 12, y: 8 * TILE_SIZE + 12, dirX: 1, dirY: 0, speed: 1.6, inHouse: false },
      { name: 'NullPointer', color: '#ff77aa', col: 8, row: 10, x: 8 * TILE_SIZE + 12, y: 10 * TILE_SIZE + 12, dirX: 1, dirY: 0, speed: 1.5, inHouse: true, exitTimer: 60 },
      { name: 'Memory Leak', color: '#00f0ff', col: 10, row: 10, x: 10 * TILE_SIZE + 12, y: 10 * TILE_SIZE + 12, dirX: -1, dirY: 0, speed: 1.4, inHouse: true, exitTimer: 160 },
      { name: 'Prod Bug', color: '#ff9900', col: 9, row: 11, x: 9 * TILE_SIZE + 12, y: 11 * TILE_SIZE + 12, dirX: 0, dirY: 1, speed: 1.4, inHouse: true, exitTimer: 260 }
    ];

    this.initMap();
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
        case 'ArrowUp':
        case 'w':
        case 'W':
        case 'KeyW':
          this.setDirection(0, -1);
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
        case 'KeyS':
          this.setDirection(0, 1);
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
        case 'KeyA':
          this.setDirection(-1, 0);
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
        case 'KeyD':
          this.setDirection(1, 0);
          break;
        case ' ':
        case 'p':
        case 'P':
        case 'KeyP':
          this.togglePause();
          break;
      }
    };

    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }
      handleKey(e.key || e.code);
    }, { capture: true });

    document.addEventListener('keydown', (e) => {
      handleKey(e.key || e.code);
    });

    // Virtual D-pad
    const addDpadListener = (el, dir) => {
      const trigger = (e) => {
        e.preventDefault();
        e.stopPropagation();
        audio.init();
        if (dir === 'up') this.setDirection(0, -1);
        if (dir === 'down') this.setDirection(0, 1);
        if (dir === 'left') this.setDirection(-1, 0);
        if (dir === 'right') this.setDirection(1, 0);
      };
      el.addEventListener('pointerdown', trigger);
      el.addEventListener('click', trigger);
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

  isWalkable(col, row, isGhost = false) {
    // Tunnel wrapping columns
    if (row === 8 || row === 10 || row === 12) {
      if (col < 0 || col >= COLS) return true;
    }
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return false;
    const tile = this.map[row][col];
    if (tile === 1) return false;
    if (tile === 6) return isGhost; // Ghost gate
    return true;
  }

  setDirection(dx, dy) {
    if (this.state === 'READY') {
      this.startGame();
    }
    if (this.state !== 'PLAYING') return;

    // Instant reverse
    if (dx === -this.pacman.dirX && dy === -this.pacman.dirY) {
      this.pacman.dirX = dx;
      this.pacman.dirY = dy;
      this.pacman.nextDirX = dx;
      this.pacman.nextDirY = dy;
      return;
    }

    this.pacman.nextDirX = dx;
    this.pacman.nextDirY = dy;
  }

  startGame() {
    this.state = 'PLAYING';
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
    this.frightenedTimer = 0;
    this.resetPositions();
    this.updateHUD();
    this.startGame();
  }

  resetPositions() {
    this.pacman.x = 9 * TILE_SIZE + TILE_SIZE / 2;
    this.pacman.y = 16 * TILE_SIZE + TILE_SIZE / 2;
    this.pacman.dirX = -1;
    this.pacman.dirY = 0;
    this.pacman.nextDirX = -1;
    this.pacman.nextDirY = 0;

    this.ghosts[0].x = 9 * TILE_SIZE + 12;
    this.ghosts[0].y = 8 * TILE_SIZE + 12;
    this.ghosts[0].inHouse = false;
    this.ghosts[0].dirX = 1;
    this.ghosts[0].dirY = 0;

    this.ghosts[1].x = 8 * TILE_SIZE + 12;
    this.ghosts[1].y = 10 * TILE_SIZE + 12;
    this.ghosts[1].inHouse = true;
    this.ghosts[1].exitTimer = 60;

    this.ghosts[2].x = 10 * TILE_SIZE + 12;
    this.ghosts[2].y = 10 * TILE_SIZE + 12;
    this.ghosts[2].inHouse = true;
    this.ghosts[2].exitTimer = 160;

    this.ghosts[3].x = 9 * TILE_SIZE + 12;
    this.ghosts[3].y = 11 * TILE_SIZE + 12;
    this.ghosts[3].inHouse = true;
    this.ghosts[3].exitTimer = 260;
  }

  updatePacman() {
    const curCol = Math.floor(this.pacman.x / TILE_SIZE);
    const curRow = Math.floor(this.pacman.y / TILE_SIZE);
    const centerTileX = curCol * TILE_SIZE + TILE_SIZE / 2;
    const centerTileY = curRow * TILE_SIZE + TILE_SIZE / 2;
    const distToCenterX = Math.abs(this.pacman.x - centerTileX);
    const distToCenterY = Math.abs(this.pacman.y - centerTileY);

    // Try turning to requested direction
    if (this.pacman.nextDirX !== 0 || this.pacman.nextDirY !== 0) {
      if (this.pacman.nextDirX !== this.pacman.dirX || this.pacman.nextDirY !== this.pacman.dirY) {
        // Check if turn is perpendicular
        const isTurningHorizontal = this.pacman.nextDirX !== 0 && this.pacman.dirY !== 0;
        const isTurningVertical = this.pacman.nextDirY !== 0 && this.pacman.dirX !== 0;

        if (isTurningHorizontal && distToCenterY <= 6) {
          if (this.isWalkable(curCol + this.pacman.nextDirX, curRow)) {
            this.pacman.y = centerTileY;
            this.pacman.dirX = this.pacman.nextDirX;
            this.pacman.dirY = 0;
          }
        } else if (isTurningVertical && distToCenterX <= 6) {
          if (this.isWalkable(curCol, curRow + this.pacman.nextDirY)) {
            this.pacman.x = centerTileX;
            this.pacman.dirY = this.pacman.nextDirY;
            this.pacman.dirX = 0;
          }
        } else if (this.pacman.dirX === 0 && this.pacman.dirY === 0) {
          // Stopped against a wall: try starting in next direction
          if (this.isWalkable(curCol + this.pacman.nextDirX, curRow + this.pacman.nextDirY)) {
            this.pacman.dirX = this.pacman.nextDirX;
            this.pacman.dirY = this.pacman.nextDirY;
          }
        }
      }
    }

    // Check if moving into wall
    const nextCol = curCol + this.pacman.dirX;
    const nextRow = curRow + this.pacman.dirY;

    if (!this.isWalkable(nextCol, nextRow)) {
      // Approaching wall: clamp at center
      if (this.pacman.dirX === 1 && this.pacman.x >= centerTileX) {
        this.pacman.x = centerTileX;
        this.pacman.dirX = 0;
      } else if (this.pacman.dirX === -1 && this.pacman.x <= centerTileX) {
        this.pacman.x = centerTileX;
        this.pacman.dirX = 0;
      } else if (this.pacman.dirY === 1 && this.pacman.y >= centerTileY) {
        this.pacman.y = centerTileY;
        this.pacman.dirY = 0;
      } else if (this.pacman.dirY === -1 && this.pacman.y <= centerTileY) {
        this.pacman.y = centerTileY;
        this.pacman.dirY = 0;
      }
    }

    // Advance
    this.pacman.x += this.pacman.dirX * this.pacman.speed;
    this.pacman.y += this.pacman.dirY * this.pacman.speed;

    // Wrap around screen tunnels
    if (this.pacman.x < -TILE_SIZE / 2) this.pacman.x = this.canvas.width + TILE_SIZE / 2 - 2;
    if (this.pacman.x > this.canvas.width + TILE_SIZE / 2) this.pacman.x = -TILE_SIZE / 2 + 2;

    // Mouth animation
    if (this.pacman.dirX !== 0 || this.pacman.dirY !== 0) {
      if (this.pacman.mouthOpening) {
        this.pacman.mouthAngle += this.pacman.mouthSpeed;
        if (this.pacman.mouthAngle >= 0.4) this.pacman.mouthOpening = false;
      } else {
        this.pacman.mouthAngle -= this.pacman.mouthSpeed;
        if (this.pacman.mouthAngle <= 0.04) this.pacman.mouthOpening = true;
      }
    }

    // Eat dots
    const eatCol = Math.floor(this.pacman.x / TILE_SIZE);
    const eatRow = Math.floor(this.pacman.y / TILE_SIZE);

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
          this.frightenedTimer = this.frightenedDuration;
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

  updateGhosts() {
    this.ghosts.forEach(ghost => {
      if (ghost.inHouse) {
        ghost.exitTimer--;
        if (ghost.exitTimer <= 0) {
          ghost.inHouse = false;
          ghost.x = 9 * TILE_SIZE + 12;
          ghost.y = 8 * TILE_SIZE + 12;
          ghost.dirX = 1;
          ghost.dirY = 0;
        }
        return;
      }

      const curCol = Math.floor(ghost.x / TILE_SIZE);
      const curRow = Math.floor(ghost.y / TILE_SIZE);
      const centerTileX = curCol * TILE_SIZE + TILE_SIZE / 2;
      const centerTileY = curRow * TILE_SIZE + TILE_SIZE / 2;
      const dist = Math.hypot(ghost.x - centerTileX, ghost.y - centerTileY);

      const currentSpeed = this.frightenedTimer > 0 ? ghost.speed * 0.6 : ghost.speed;

      if (dist <= currentSpeed) {
        ghost.x = centerTileX;
        ghost.y = centerTileY;

        const options = [
          { dx: 1, dy: 0 },
          { dx: -1, dy: 0 },
          { dx: 0, dy: 1 },
          { dx: 0, dy: -1 }
        ].filter(opt => {
          // Don't 180 reverse
          if (opt.dx === -ghost.dirX && opt.dy === -ghost.dirY) return false;
          return this.isWalkable(curCol + opt.dx, curRow + opt.dy, true);
        });

        if (options.length > 0) {
          if (this.frightenedTimer > 0) {
            const pick = options[Math.floor(Math.random() * options.length)];
            ghost.dirX = pick.dx;
            ghost.dirY = pick.dy;
          } else {
            // Target pacman
            options.sort((a, b) => {
              const targetAx = (curCol + a.dx) * TILE_SIZE;
              const targetAy = (curRow + a.dy) * TILE_SIZE;
              const targetBx = (curCol + b.dx) * TILE_SIZE;
              const targetBy = (curRow + b.dy) * TILE_SIZE;
              const distA = Math.hypot(targetAx - this.pacman.x, targetAy - this.pacman.y);
              const distB = Math.hypot(targetBx - this.pacman.x, targetBy - this.pacman.y);
              return distA - distB;
            });
            ghost.dirX = options[0].dx;
            ghost.dirY = options[0].dy;
          }
        } else if (this.isWalkable(curCol - ghost.dirX, curRow - ghost.dirY, true)) {
          // Dead end, allow turnaround
          ghost.dirX = -ghost.dirX;
          ghost.dirY = -ghost.dirY;
        }
      }

      ghost.x += ghost.dirX * currentSpeed;
      ghost.y += ghost.dirY * currentSpeed;

      // Wrap tunnel
      if (ghost.x < -TILE_SIZE / 2) ghost.x = this.canvas.width + TILE_SIZE / 2 - 2;
      if (ghost.x > this.canvas.width + TILE_SIZE / 2) ghost.x = -TILE_SIZE / 2 + 2;

      // Collision with Pacman
      const collisionDist = Math.hypot(ghost.x - this.pacman.x, ghost.y - this.pacman.y);
      if (collisionDist < 15) {
        if (this.frightenedTimer > 0) {
          audio.playEatGhost();
          this.addScore(200);
          ghost.x = 9 * TILE_SIZE + 12;
          ghost.y = 10 * TILE_SIZE + 12;
          ghost.inHouse = true;
          ghost.exitTimer = 180;
        } else {
          audio.playDeath();
          this.lives--;
          this.updateHUD();
          if (this.lives <= 0) {
            this.state = 'GAMEOVER';
            this.showEndScreen('MERGE CONFLICT DETECTED', 'Production was halted by bugs.');
          } else {
            this.resetPositions();
          }
        }
      }
    });
  }

  update() {
    if (this.state !== 'PLAYING') return;

    if (this.frightenedTimer > 0) {
      this.frightenedTimer--;
    }

    this.updatePacman();
    this.updateGhosts();
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

  draw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw Maze
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const tile = this.map[r][c];
        const x = c * TILE_SIZE;
        const y = r * TILE_SIZE;

        if (tile === 1) {
          this.ctx.fillStyle = '#0f1c30';
          this.ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);

          this.ctx.strokeStyle = '#1e3860';
          this.ctx.lineWidth = 2;
          this.ctx.strokeRect(x + 1, y + 1, TILE_SIZE - 2, TILE_SIZE - 2);

          this.ctx.strokeStyle = '#00f0ff';
          this.ctx.lineWidth = 1;
          this.ctx.strokeRect(x + 3, y + 3, TILE_SIZE - 6, TILE_SIZE - 6);
        } else if (tile === 6) {
          this.ctx.fillStyle = '#ff007f';
          this.ctx.fillRect(x, y + TILE_SIZE / 2 - 2, TILE_SIZE, 4);
        } else if (tile === 2) {
          this.ctx.fillStyle = '#0e4429';
          this.ctx.beginPath();
          this.ctx.arc(x + TILE_SIZE / 2, y + TILE_SIZE / 2, 3, 0, Math.PI * 2);
          this.ctx.fill();
        } else if (tile === 3) {
          this.ctx.fillStyle = '#26a641';
          this.ctx.beginPath();
          this.ctx.arc(x + TILE_SIZE / 2, y + TILE_SIZE / 2, 4, 0, Math.PI * 2);
          this.ctx.fill();
        } else if (tile === 4) {
          this.ctx.fillStyle = '#39d353';
          this.ctx.shadowColor = '#39d353';
          this.ctx.shadowBlur = 6;
          this.ctx.beginPath();
          this.ctx.arc(x + TILE_SIZE / 2, y + TILE_SIZE / 2, 5, 0, Math.PI * 2);
          this.ctx.fill();
          this.ctx.shadowBlur = 0;
        } else if (tile === 5) {
          const pulse = (Math.sin(Date.now() / 150) + 1) / 2;
          this.ctx.fillStyle = '#f7b733';
          this.ctx.shadowColor = '#f7b733';
          this.ctx.shadowBlur = 10 + pulse * 8;
          this.ctx.beginPath();
          this.ctx.arc(x + TILE_SIZE / 2, y + TILE_SIZE / 2, 7 + pulse * 2, 0, Math.PI * 2);
          this.ctx.fill();
          this.ctx.shadowBlur = 0;
        }
      }
    }

    // Draw Pacman
    let rotation = 0;
    if (this.pacman.dirX === 1) rotation = 0;
    else if (this.pacman.dirX === -1) rotation = Math.PI;
    else if (this.pacman.dirY === 1) rotation = Math.PI / 2;
    else if (this.pacman.dirY === -1) rotation = -Math.PI / 2;

    this.ctx.save();
    this.ctx.translate(this.pacman.x, this.pacman.y);
    this.ctx.rotate(rotation);

    this.ctx.fillStyle = '#f7b733';
    this.ctx.shadowColor = '#f7b733';
    this.ctx.shadowBlur = 10;
    this.ctx.beginPath();
    this.ctx.arc(
      0, 0,
      10,
      this.pacman.mouthAngle * Math.PI,
      (2 - this.pacman.mouthAngle) * Math.PI
    );
    this.ctx.lineTo(0, 0);
    this.ctx.fill();
    this.ctx.restore();

    // Draw Ghosts
    this.ghosts.forEach(ghost => {
      this.ctx.save();
      this.ctx.translate(ghost.x, ghost.y);

      let ghostColor = ghost.color;
      if (this.frightenedTimer > 0) {
        const flash = this.frightenedTimer < 120 && Math.floor(this.frightenedTimer / 10) % 2 === 0;
        ghostColor = flash ? '#ffffff' : '#1e90ff';
      }

      this.ctx.fillStyle = ghostColor;
      this.ctx.shadowColor = ghostColor;
      this.ctx.shadowBlur = 8;

      this.ctx.beginPath();
      this.ctx.arc(0, -2, 9, Math.PI, 0, false);
      this.ctx.lineTo(9, 8);
      this.ctx.lineTo(5, 5);
      this.ctx.lineTo(0, 8);
      this.ctx.lineTo(-5, 5);
      this.ctx.lineTo(-9, 8);
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.shadowBlur = 0;

      // Eyes
      this.ctx.fillStyle = '#ffffff';
      this.ctx.beginPath();
      this.ctx.arc(-4, -3, 3, 0, Math.PI * 2);
      this.ctx.arc(4, -3, 3, 0, Math.PI * 2);
      this.ctx.fill();

      // Pupils
      this.ctx.fillStyle = '#0a0e17';
      const pOffsetX = ghost.dirX * 1.5;
      const pOffsetY = ghost.dirY * 1.5;
      this.ctx.beginPath();
      this.ctx.arc(-4 + pOffsetX, -3 + pOffsetY, 1.5, 0, Math.PI * 2);
      this.ctx.arc(4 + pOffsetX, -3 + pOffsetY, 1.5, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.restore();
    });
  }

  loop() {
    this.update();
    this.draw();
    requestAnimationFrame(() => this.loop());
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

  game.loop();
});
