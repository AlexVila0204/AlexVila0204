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

  playTone(freq, type, duration, gainVal = 0.1) {
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
    this.playTone(freq, 'triangle', 0.08, 0.06);
  }

  playPowerPellet() {
    this.init();
    this.playTone(600, 'square', 0.15, 0.08);
  }

  playEatGhost() {
    this.init();
    if (this.muted || !this.ctx) return;
    [300, 450, 600, 800].forEach((freq, idx) => {
      setTimeout(() => this.playTone(freq, 'sine', 0.09, 0.1), idx * 40);
    });
  }

  playDeath() {
    this.init();
    if (this.muted || !this.ctx) return;
    for (let i = 0; i < 8; i++) {
      setTimeout(() => {
        this.playTone(400 - i * 35, 'sawtooth', 0.1, 0.08);
      }, i * 70);
    }
  }

  playStart() {
    this.init();
    if (this.muted || !this.ctx) return;
    const notes = [261.6, 293.7, 329.6, 392.0, 523.3];
    notes.forEach((freq, idx) => {
      setTimeout(() => this.playTone(freq, 'sine', 0.15, 0.1), idx * 100);
    });
  }
}

const audio = new RetroAudio();

// Maze layout (19 cols x 21 rows)
// 1 = Wall, 2 = Light Commit (10pts), 3 = Medium Commit (50pts), 4 = Dark Commit (100pts), 5 = Power Pellet, 0 = Empty, 6 = Ghost Gate
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

const TILE_SIZE = 24;
const COLS = 19;
const ROWS = 21;

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
    this.frightenedDuration = 450; // frames (~7.5 sec)

    this.pacman = {
      x: 9 * TILE_SIZE + TILE_SIZE / 2,
      y: 16 * TILE_SIZE + TILE_SIZE / 2,
      dirX: 0,
      dirY: 0,
      nextDirX: 0,
      nextDirY: 0,
      speed: 2,
      mouthAngle: 0.2,
      mouthSpeed: 0.03,
      mouthOpening: true,
      rotation: 0
    };

    this.ghosts = [
      { name: 'Merge Conflict', color: '#ff3366', x: 9 * TILE_SIZE + 12, y: 10 * TILE_SIZE, dirX: 0, dirY: -1, speed: 1.6, inHouse: false },
      { name: 'NullPointer', color: '#ff77aa', x: 8 * TILE_SIZE + 12, y: 10 * TILE_SIZE, dirX: 1, dirY: 0, speed: 1.5, inHouse: true, exitTimer: 60 },
      { name: 'Memory Leak', color: '#00f0ff', x: 10 * TILE_SIZE + 12, y: 10 * TILE_SIZE, dirX: -1, dirY: 0, speed: 1.4, inHouse: true, exitTimer: 180 },
      { name: 'Prod Bug', color: '#ff9900', x: 9 * TILE_SIZE + 12, y: 11 * TILE_SIZE, dirX: 0, dirY: 1, speed: 1.4, inHouse: true, exitTimer: 300 }
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
    window.addEventListener('keydown', (e) => {
      audio.init();
      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          this.setDirection(0, -1);
          e.preventDefault();
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          this.setDirection(0, 1);
          e.preventDefault();
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          this.setDirection(-1, 0);
          e.preventDefault();
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          this.setDirection(1, 0);
          e.preventDefault();
          break;
        case ' ':
        case 'p':
        case 'P':
          this.togglePause();
          e.preventDefault();
          break;
      }
    });

    // Virtual D-pad for touch devices
    document.querySelectorAll('.d-btn').forEach(btn => {
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        audio.init();
        const dir = btn.getAttribute('data-dir');
        if (dir === 'up') this.setDirection(0, -1);
        if (dir === 'down') this.setDirection(0, 1);
        if (dir === 'left') this.setDirection(-1, 0);
        if (dir === 'right') this.setDirection(1, 0);
      });
    });

    // Touch swipes
    let touchStartX = 0;
    let touchStartY = 0;
    this.canvas.addEventListener('touchstart', (e) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      audio.init();
    }, { passive: true });

    this.canvas.addEventListener('touchend', (e) => {
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;
      if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > 20) this.setDirection(1, 0);
        else if (dx < -20) this.setDirection(-1, 0);
      } else {
        if (dy > 20) this.setDirection(0, 1);
        else if (dy < -20) this.setDirection(0, -1);
      }
    }, { passive: true });
  }

  setDirection(dx, dy) {
    if (this.state === 'READY') {
      this.startGame();
    }
    this.pacman.nextDirX = dx;
    this.pacman.nextDirY = dy;
  }

  startGame() {
    this.state = 'PLAYING';
    document.getElementById('startOverlay').classList.add('hidden');
    document.getElementById('gameOverOverlay').classList.add('hidden');
    audio.playStart();
  }

  togglePause() {
    if (this.state === 'PLAYING') {
      this.state = 'PAUSED';
      document.getElementById('pauseBtn').textContent = '▶️ Resume';
    } else if (this.state === 'PAUSED') {
      this.state = 'PLAYING';
      document.getElementById('pauseBtn').textContent = '⏸️ Pause';
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
    this.pacman.dirX = 0;
    this.pacman.dirY = 0;
    this.pacman.nextDirX = 0;
    this.pacman.nextDirY = 0;

    this.ghosts[0].x = 9 * TILE_SIZE + 12;
    this.ghosts[0].y = 8 * TILE_SIZE;
    this.ghosts[0].inHouse = false;
    this.ghosts[0].dirX = 1;
    this.ghosts[0].dirY = 0;

    this.ghosts[1].x = 8 * TILE_SIZE + 12;
    this.ghosts[1].y = 10 * TILE_SIZE;
    this.ghosts[1].inHouse = true;
    this.ghosts[1].exitTimer = 60;

    this.ghosts[2].x = 10 * TILE_SIZE + 12;
    this.ghosts[2].y = 10 * TILE_SIZE;
    this.ghosts[2].inHouse = true;
    this.ghosts[2].exitTimer = 160;

    this.ghosts[3].x = 9 * TILE_SIZE + 12;
    this.ghosts[3].y = 11 * TILE_SIZE;
    this.ghosts[3].inHouse = true;
    this.ghosts[3].exitTimer = 260;
  }

  isWall(x, y) {
    const col = Math.floor(x / TILE_SIZE);
    const row = Math.floor(y / TILE_SIZE);
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return false;
    return this.map[row][col] === 1;
  }

  canMove(x, y, dx, dy) {
    const margin = 3;
    const testPoints = [];
    if (dx === 1) testPoints.push({ x: x + 10, y: y - 8 }, { x: x + 10, y: y + 8 });
    else if (dx === -1) testPoints.push({ x: x - 10, y: y - 8 }, { x: x - 10, y: y + 8 });
    else if (dy === 1) testPoints.push({ x: x - 8, y: y + 10 }, { x: x + 8, y: y + 10 });
    else if (dy === -1) testPoints.push({ x: x - 8, y: y - 10 }, { x: x + 8, y: y - 10 });

    return !testPoints.some(pt => this.isWall(pt.x, pt.y));
  }

  update() {
    if (this.state !== 'PLAYING') return;

    // Frightened timer countdown
    if (this.frightenedTimer > 0) {
      this.frightenedTimer--;
    }

    // Attempt to turn
    if (this.pacman.nextDirX !== 0 || this.pacman.nextDirY !== 0) {
      const tileCenterX = Math.floor(this.pacman.x / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2;
      const tileCenterY = Math.floor(this.pacman.y / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2;
      const dist = Math.hypot(this.pacman.x - tileCenterX, this.pacman.y - tileCenterY);

      if (dist < 4 && this.canMove(tileCenterX, tileCenterY, this.pacman.nextDirX, this.pacman.nextDirY)) {
        this.pacman.x = tileCenterX;
        this.pacman.y = tileCenterY;
        this.pacman.dirX = this.pacman.nextDirX;
        this.pacman.dirY = this.pacman.nextDirY;
        this.pacman.nextDirX = 0;
        this.pacman.nextDirY = 0;
      }
    }

    // Move Pacman
    if (this.canMove(this.pacman.x, this.pacman.y, this.pacman.dirX, this.pacman.dirY)) {
      this.pacman.x += this.pacman.dirX * this.pacman.speed;
      this.pacman.y += this.pacman.dirY * this.pacman.speed;

      // Wrap around tunnel
      if (this.pacman.x < 0) this.pacman.x = this.canvas.width;
      if (this.pacman.x > this.canvas.width) this.pacman.x = 0;

      // Animate mouth
      if (this.pacman.mouthOpening) {
        this.pacman.mouthAngle += this.pacman.mouthSpeed;
        if (this.pacman.mouthAngle >= 0.4) this.pacman.mouthOpening = false;
      } else {
        this.pacman.mouthAngle -= this.pacman.mouthSpeed;
        if (this.pacman.mouthAngle <= 0.05) this.pacman.mouthOpening = true;
      }
    }

    // Check eating dots
    const curCol = Math.floor(this.pacman.x / TILE_SIZE);
    const curRow = Math.floor(this.pacman.y / TILE_SIZE);

    if (curRow >= 0 && curRow < ROWS && curCol >= 0 && curCol < COLS) {
      const tile = this.map[curRow][curCol];
      if ([2, 3, 4, 5].includes(tile)) {
        this.map[curRow][curCol] = 0;
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
          // Power Pellet
          this.addScore(50);
          this.frightenedTimer = this.frightenedDuration;
          audio.playPowerPellet();
        }

        this.updateHUD();

        // Victory check
        if (this.commitsEaten >= this.totalCommits) {
          this.state = 'VICTORY';
          this.showEndScreen('🎉 ALL COMMITS SHIPPED!', 'You resolved all conflicts and deployed cleanly.');
        }
      }
    }

    // Update Ghosts
    this.ghosts.forEach(ghost => {
      if (ghost.inHouse) {
        ghost.exitTimer--;
        if (ghost.exitTimer <= 0) {
          ghost.inHouse = false;
          ghost.x = 9 * TILE_SIZE + 12;
          ghost.y = 8 * TILE_SIZE;
        }
        return;
      }

      // Move ghost
      const speed = this.frightenedTimer > 0 ? ghost.speed * 0.6 : ghost.speed;
      ghost.x += ghost.dirX * speed;
      ghost.y += ghost.dirY * speed;

      // Ghost wrap tunnel
      if (ghost.x < 0) ghost.x = this.canvas.width;
      if (ghost.x > this.canvas.width) ghost.x = 0;

      // Ghost path decision at tile center
      const tileCenterX = Math.floor(ghost.x / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2;
      const tileCenterY = Math.floor(ghost.y / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2;
      const dist = Math.hypot(ghost.x - tileCenterX, ghost.y - tileCenterY);

      if (dist < 2) {
        ghost.x = tileCenterX;
        ghost.y = tileCenterY;

        const possibleDirs = [
          { dx: 1, dy: 0 },
          { dx: -1, dy: 0 },
          { dx: 0, dy: 1 },
          { dx: 0, dy: -1 }
        ].filter(d => !(d.dx === -ghost.dirX && d.dy === -ghost.dirY) && this.canMove(tileCenterX, tileCenterY, d.dx, d.dy));

        if (possibleDirs.length > 0) {
          if (this.frightenedTimer > 0) {
            // Random direction away
            const choice = possibleDirs[Math.floor(Math.random() * possibleDirs.length)];
            ghost.dirX = choice.dx;
            ghost.dirY = choice.dy;
          } else {
            // Target Pacman
            possibleDirs.sort((a, b) => {
              const distA = Math.hypot((ghost.x + a.dx * TILE_SIZE) - this.pacman.x, (ghost.y + a.dy * TILE_SIZE) - this.pacman.y);
              const distB = Math.hypot((ghost.x + b.dx * TILE_SIZE) - this.pacman.x, (ghost.y + b.dy * TILE_SIZE) - this.pacman.y);
              return distA - distB;
            });
            ghost.dirX = possibleDirs[0].dx;
            ghost.dirY = possibleDirs[0].dy;
          }
        }
      }

      // Collision with Pacman
      const collisionDist = Math.hypot(ghost.x - this.pacman.x, ghost.y - this.pacman.y);
      if (collisionDist < 14) {
        if (this.frightenedTimer > 0) {
          // Eat ghost!
          audio.playEatGhost();
          this.addScore(200);
          ghost.x = 9 * TILE_SIZE + 12;
          ghost.y = 10 * TILE_SIZE;
          ghost.inHouse = true;
          ghost.exitTimer = 180;
        } else {
          // Pacman death
          audio.playDeath();
          this.lives--;
          this.updateHUD();
          if (this.lives <= 0) {
            this.state = 'GAMEOVER';
            this.showEndScreen('💀 MERGE CONFLICT DETECTED', 'Production was halted by bugs.');
          } else {
            this.resetPositions();
          }
        }
      }
    });
  }

  addScore(pts) {
    this.score += pts;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('gh_pacman_highscore', this.highScore);
    }
  }

  updateHUD() {
    document.getElementById('score1Up').textContent = this.score.toString().padStart(5, '0');
    document.getElementById('scoreHigh').textContent = this.highScore.toString().padStart(5, '0');
    document.getElementById('scoreCommits').textContent = `${this.commitsEaten}/${this.totalCommits}`;

    // Lives display
    const livesContainer = document.getElementById('livesDisplay');
    if (livesContainer) {
      livesContainer.innerHTML = '🟡 '.repeat(Math.max(0, this.lives));
    }
  }

  showEndScreen(title, subtitle) {
    document.getElementById('endTitle').textContent = title;
    document.getElementById('endSubtitle').textContent = subtitle;
    document.getElementById('gameOverOverlay').classList.remove('hidden');
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
          // Neon retro wall
          this.ctx.fillStyle = '#0f1c30';
          this.ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);

          this.ctx.strokeStyle = '#1e3860';
          this.ctx.lineWidth = 2;
          this.ctx.strokeRect(x + 1, y + 1, TILE_SIZE - 2, TILE_SIZE - 2);

          this.ctx.strokeStyle = '#00f0ff';
          this.ctx.lineWidth = 1;
          this.ctx.strokeRect(x + 3, y + 3, TILE_SIZE - 6, TILE_SIZE - 6);
        } else if (tile === 6) {
          // Ghost gate
          this.ctx.fillStyle = '#ff007f';
          this.ctx.fillRect(x, y + TILE_SIZE / 2 - 2, TILE_SIZE, 4);
        } else if (tile === 2) {
          // Light commit dot (GitHub level 1)
          this.ctx.fillStyle = '#0e4429';
          this.ctx.beginPath();
          this.ctx.arc(x + TILE_SIZE / 2, y + TILE_SIZE / 2, 3, 0, Math.PI * 2);
          this.ctx.fill();
        } else if (tile === 3) {
          // Medium commit dot (GitHub level 2)
          this.ctx.fillStyle = '#26a641';
          this.ctx.beginPath();
          this.ctx.arc(x + TILE_SIZE / 2, y + TILE_SIZE / 2, 4, 0, Math.PI * 2);
          this.ctx.fill();
        } else if (tile === 4) {
          // Dark green commit dot (GitHub level 3)
          this.ctx.fillStyle = '#39d353';
          this.ctx.shadowColor = '#39d353';
          this.ctx.shadowBlur = 6;
          this.ctx.beginPath();
          this.ctx.arc(x + TILE_SIZE / 2, y + TILE_SIZE / 2, 5, 0, Math.PI * 2);
          this.ctx.fill();
          this.ctx.shadowBlur = 0;
        } else if (tile === 5) {
          // Power Pellet (Octocat pill / Gold star pulse)
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
        // Flashing blue/white
        const flash = this.frightenedTimer < 120 && Math.floor(this.frightenedTimer / 10) % 2 === 0;
        ghostColor = flash ? '#ffffff' : '#1e90ff';
      }

      this.ctx.fillStyle = ghostColor;
      this.ctx.shadowColor = ghostColor;
      this.ctx.shadowBlur = 8;

      // Head
      this.ctx.beginPath();
      this.ctx.arc(0, -2, 9, Math.PI, 0, false);
      // Body & Tentacles
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

  document.getElementById('startBtn').addEventListener('click', () => {
    audio.init();
    game.startGame();
  });

  document.getElementById('restartBtn').addEventListener('click', () => {
    audio.init();
    game.restart();
  });

  document.getElementById('pauseBtn').addEventListener('click', () => {
    game.togglePause();
  });

  document.getElementById('muteBtn').addEventListener('click', () => {
    audio.muted = !audio.muted;
    document.getElementById('muteBtn').textContent = audio.muted ? '🔇 Unmute' : '🔊 Sound';
  });

  game.loop();
});
