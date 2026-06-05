const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const levelEl = document.getElementById('level');
const statsEl = document.getElementById('stats');
const leaderboardEl = document.getElementById('leaderboard');
const overlay = document.getElementById('overlay');
const overlayText = document.getElementById('overlayText');
const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const soundBtn = document.getElementById('soundBtn');
const resetScoresBtn = document.getElementById('resetScoresBtn');
const difficultySelect = document.getElementById('difficultySelect');
const themeSelect = document.getElementById('themeSelect');
const stage = document.querySelector('.stage');

const cell = 28;
const grid = canvas.width / cell;
const bestKey = 'neonSnakeBest';
const leadersKey = 'neonSnakeLeaders';
const themeKey = 'neonSnakeTheme';
const soundKey = 'neonSnakeMuted';

const difficulties = {
  easy: { label: 'Easy', speed: 155, minSpeed: 95, speedStep: 1, obstacleEvery: 999, maxObstacles: 0, lives: 1 },
  normal: { label: 'Normal', speed: 130, minSpeed: 80, speedStep: 2, obstacleEvery: 4, maxObstacles: 6, lives: 1 },
  hard: { label: 'Hard', speed: 105, minSpeed: 65, speedStep: 3, obstacleEvery: 3, maxObstacles: 10, lives: 1 },
  insane: { label: 'Insane', speed: 82, minSpeed: 48, speedStep: 4, obstacleEvery: 2, maxObstacles: 16, lives: 0 }
};

const foodTypes = {
  normal: { score: 10, color: '#ff8fab', glow: '#ff89d5', ttl: 0 },
  golden: { score: 30, color: '#ffd166', glow: '#fff0a3', ttl: 6500 },
  slow: { score: 5, color: '#7bdff2', glow: '#9bf6ff', ttl: 8000 },
  shield: { score: 5, color: '#b8f7d4', glow: '#d8ffe8', ttl: 9000 },
  poison: { score: -10, color: '#ef476f', glow: '#ff6b6b', ttl: 7000 }
};

let snake;
let food;
let obstacles;
let particles;
let dir;
let nextDir;
let score;
let speed;
let loop;
let statsLoop;
let playing = false;
let paused = false;
let muted = localStorage.getItem(soundKey) === 'true';
let shield = 0;
let eaten = 0;
let startTime = 0;
let elapsedBeforePause = 0;
let achievedNewBest = false;
let audioContext;

function readLeaders() {
  try {
    return JSON.parse(localStorage.getItem(leadersKey) || '[]');
  } catch {
    return [];
  }
}

function renderLeaderboard() {
  const leaders = readLeaders();
  leaderboardEl.innerHTML = '';
  leaders.slice(0, 5).forEach((entry) => {
    const li = document.createElement('li');
    li.textContent = `${entry.score} • ${entry.mode} • ${entry.date}`;
    leaderboardEl.appendChild(li);
  });
}

function saveLeader() {
  if (!score) return;
  const leaders = readLeaders();
  leaders.push({
    score,
    mode: difficulties[difficultySelect.value].label,
    date: new Date().toLocaleDateString('ru-RU')
  });
  leaders.sort((a, b) => b.score - a.score);
  localStorage.setItem(leadersKey, JSON.stringify(leaders.slice(0, 5)));
  renderLeaderboard();
}

function getBest() {
  return Number(localStorage.getItem(bestKey) || 0);
}

function setBest(value) {
  localStorage.setItem(bestKey, String(value));
  bestEl.textContent = value;
}

function reset() {
  const difficulty = difficulties[difficultySelect.value];
  snake = [{ x: 8, y: 10 }, { x: 7, y: 10 }, { x: 6, y: 10 }];
  obstacles = [];
  particles = [];
  dir = { x: 1, y: 0 };
  nextDir = { ...dir };
  score = 0;
  speed = difficulty.speed;
  shield = difficulty.lives;
  eaten = 0;
  elapsedBeforePause = 0;
  achievedNewBest = false;
  startTime = Date.now();
  spawnFood();
  updateHud();
}

function currentLevel() {
  return Math.max(1, Math.floor(score / 50) + 1);
}

function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function gameTime() {
  if (paused) return elapsedBeforePause;
  return elapsedBeforePause + Date.now() - startTime;
}

function updateHud() {
  scoreEl.textContent = score;
  bestEl.textContent = getBest();
  levelEl.textContent = currentLevel();
  statsEl.textContent = `Время: ${formatTime(gameTime())} • Длина: ${snake?.length || 3} • Съедено: ${eaten || 0} • Щит: ${shield > 0 ? 'да' : 'нет'}`;
}

function randomCell() {
  return {
    x: Math.floor(Math.random() * grid),
    y: Math.floor(Math.random() * grid)
  };
}

function isOccupied(point) {
  return snake.some((s) => s.x === point.x && s.y === point.y) || obstacles.some((o) => o.x === point.x && o.y === point.y);
}

function pickFoodType() {
  const roll = Math.random();
  if (roll < 0.58) return 'normal';
  if (roll < 0.72) return 'golden';
  if (roll < 0.84) return 'slow';
  if (roll < 0.94) return 'shield';
  return 'poison';
}

function spawnFood() {
  const type = pickFoodType();
  do {
    food = { ...randomCell(), type, born: Date.now() };
  } while (isOccupied(food));
}

function maybeAddObstacle() {
  const difficulty = difficulties[difficultySelect.value];
  if (!difficulty.maxObstacles || eaten % difficulty.obstacleEvery !== 0 || obstacles.length >= difficulty.maxObstacles) return;

  let obstacle;
  let attempts = 0;
  do {
    obstacle = randomCell();
    attempts += 1;
  } while ((isOccupied(obstacle) || manhattan(obstacle, snake[0]) < 4 || (food && obstacle.x === food.x && obstacle.y === food.y)) && attempts < 80);

  if (attempts < 80) obstacles.push(obstacle);
}

function manhattan(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function cssVar(name) {
  return getComputedStyle(document.body).getPropertyValue(name).trim();
}

function drawCell(x, y, color, glow = color, inset = 3) {
  const px = x * cell;
  const py = y * cell;
  ctx.shadowColor = glow;
  ctx.shadowBlur = 14;
  ctx.fillStyle = color;
  ctx.fillRect(px + inset, py + inset, cell - inset * 2, cell - inset * 2);
  ctx.shadowBlur = 0;
}

function drawCircleCell(x, y, color, glow = color, pulse = 0) {
  const centerX = x * cell + cell / 2;
  const centerY = y * cell + cell / 2;
  ctx.shadowColor = glow;
  ctx.shadowBlur = 18;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(centerX, centerY, cell * (0.28 + pulse), 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}

function drawParticles() {
  particles = particles.filter((p) => p.life > 0);
  particles.forEach((p) => {
    p.x += p.vx;
    p.y += p.vy;
    p.life -= 1;
    ctx.globalAlpha = Math.max(0, p.life / 18);
    drawCircleCell(p.x, p.y, p.color, p.color, -0.16);
    ctx.globalAlpha = 1;
  });
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = 'rgba(121, 174, 255, 0.08)';
  for (let i = 0; i <= grid; i++) {
    ctx.beginPath();
    ctx.moveTo(i * cell, 0);
    ctx.lineTo(i * cell, canvas.height);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i * cell);
    ctx.lineTo(canvas.width, i * cell);
    ctx.stroke();
  }

  obstacles.forEach((o) => drawCell(o.x, o.y, cssVar('--obstacle'), '#b6c2ff', 5));
  snake.forEach((s, i) => drawCell(s.x, s.y, i === 0 ? cssVar('--snake') : cssVar('--snake-body'), cssVar('--accent')));

  if (shield > 0 && snake[0]) {
    ctx.strokeStyle = '#b8f7d4';
    ctx.shadowColor = '#b8f7d4';
    ctx.shadowBlur = 10;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(snake[0].x * cell + cell / 2, snake[0].y * cell + cell / 2, cell * 0.55, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  const meta = foodTypes[food.type];
  const pulse = Math.sin(Date.now() / 160) * 0.05;
  drawCircleCell(food.x, food.y, meta.color, meta.glow, pulse);
  drawParticles();
}

function tick() {
  if (!playing || paused) return;

  const meta = foodTypes[food.type];
  if (meta.ttl && Date.now() - food.born > meta.ttl) spawnFood();

  dir = nextDir;
  const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
  const crashed = head.x < 0 || head.y < 0 || head.x >= grid || head.y >= grid || snake.some((s) => s.x === head.x && s.y === head.y) || obstacles.some((o) => o.x === head.x && o.y === head.y);

  if (crashed) {
    if (shield > 0) {
      shield -= 1;
      flash('#b8f7d4');
      playTone(220, 0.16, 'sawtooth');
      nextDir = { x: -dir.x, y: -dir.y };
      dir = nextDir;
      updateHud();
      return;
    }
    gameOver();
    return;
  }

  snake.unshift(head);

  if (head.x === food.x && head.y === food.y) {
    consumeFood(food.type);
  } else {
    snake.pop();
  }

  updateHud();
  draw();
}

function consumeFood(type) {
  const meta = foodTypes[type];
  eaten += 1;
  score = Math.max(0, score + meta.score);

  if (type === 'slow') speed += 16;
  if (type === 'shield') shield = Math.min(1, shield + 1);
  if (type === 'poison') snake.pop();

  speed = Math.max(difficulties[difficultySelect.value].minSpeed, speed - difficulties[difficultySelect.value].speedStep);
  if (score > getBest()) {
    achievedNewBest = true;
    setBest(score);
  }
  burst(food.x, food.y, meta.color);
  playTone(type === 'poison' ? 120 : 520 + Math.min(score, 300), 0.09, type === 'golden' ? 'triangle' : 'sine');
  maybeAddObstacle();
  spawnFood();
  restartLoop();
}

function burst(x, y, color) {
  for (let i = 0; i < 12; i++) {
    particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 0.18,
      vy: (Math.random() - 0.5) * 0.18,
      life: 18,
      color
    });
  }
  flash(color);
}

function flash(color) {
  canvas.style.boxShadow = `inset 0 0 42px ${color}, 0 0 26px ${color}`;
  setTimeout(() => {
    canvas.style.boxShadow = '';
  }, 130);
}

function restartLoop() {
  clearInterval(loop);
  loop = setInterval(tick, speed);
}

function startGame() {
  overlay.classList.add('hidden');
  overlay.querySelector('h2').textContent = 'Neon Snake';
  overlayText.textContent = 'Ешь импульсы, собирай бонусы и избегай стен, препятствий и хвоста.';
  playing = true;
  paused = false;
  pauseBtn.textContent = 'Пауза';
  reset();
  draw();
  clearInterval(statsLoop);
  statsLoop = setInterval(updateHud, 500);
  restartLoop();
  playTone(440, 0.12, 'triangle');
}

function gameOver() {
  elapsedBeforePause = gameTime();
  playing = false;
  paused = false;
  clearInterval(loop);
  clearInterval(statsLoop);
  saveLeader();
  stage.classList.add('shake');
  setTimeout(() => stage.classList.remove('shake'), 360);
  overlay.classList.remove('hidden');
  overlay.querySelector('h2').textContent = achievedNewBest ? 'Новый рекорд!' : 'Game Over';
  overlayText.textContent = `Счёт: ${score}. Время: ${formatTime(elapsedBeforePause)}. Длина: ${snake.length}. Съедено: ${eaten}. Нажми Space или «Начать игру».`;
  pauseBtn.textContent = 'Пауза';
  playTone(90, 0.3, 'sawtooth');
  updateHud();
}

function setDirection(x, y) {
  if (!playing || paused) return;
  if (x === -dir.x && y === -dir.y) return;
  nextDir = { x, y };
}

function togglePause() {
  if (!playing) return;
  paused = !paused;
  if (paused) {
    elapsedBeforePause += Date.now() - startTime;
  } else {
    startTime = Date.now();
  }
  pauseBtn.textContent = paused ? 'Продолжить' : 'Пауза';
  playTone(paused ? 260 : 420, 0.08, 'triangle');
  updateHud();
}

function playTone(frequency, duration, type = 'sine') {
  if (muted) return;
  audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  gain.gain.setValueAtTime(0.001, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.08, audioContext.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + duration);
}

function setMuted(value) {
  muted = value;
  localStorage.setItem(soundKey, String(muted));
  soundBtn.textContent = muted ? '🔇' : '🔊';
  soundBtn.setAttribute('aria-pressed', String(!muted));
}

function setTheme(theme) {
  document.body.dataset.theme = theme;
  localStorage.setItem(themeKey, theme);
  if (snake && food) draw();
}

function applyDirectionName(direction) {
  const map = {
    up: [0, -1],
    down: [0, 1],
    left: [-1, 0],
    right: [1, 0]
  };
  setDirection(...map[direction]);
}

document.addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase();
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'w', 'a', 's', 'd', 'p'].includes(key)) e.preventDefault();

  if (key === ' ' && !playing) return startGame();
  if (key === 'p') return togglePause();
  if (key === 'arrowup' || key === 'w') setDirection(0, -1);
  if (key === 'arrowdown' || key === 's') setDirection(0, 1);
  if (key === 'arrowleft' || key === 'a') setDirection(-1, 0);
  if (key === 'arrowright' || key === 'd') setDirection(1, 0);
});

let touchStart = null;
canvas.addEventListener('pointerdown', (event) => {
  touchStart = { x: event.clientX, y: event.clientY };
});
canvas.addEventListener('pointerup', (event) => {
  if (!touchStart) return;
  const dx = event.clientX - touchStart.x;
  const dy = event.clientY - touchStart.y;
  touchStart = null;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
  if (Math.abs(dx) > Math.abs(dy)) setDirection(dx > 0 ? 1 : -1, 0);
  else setDirection(0, dy > 0 ? 1 : -1);
});

document.querySelectorAll('.touch-btn').forEach((button) => {
  button.addEventListener('click', () => applyDirectionName(button.dataset.dir));
});

pauseBtn.addEventListener('click', togglePause);
startBtn.addEventListener('click', startGame);
soundBtn.addEventListener('click', () => setMuted(!muted));
resetScoresBtn.addEventListener('click', () => {
  localStorage.removeItem(bestKey);
  localStorage.removeItem(leadersKey);
  renderLeaderboard();
  updateHud();
});
themeSelect.addEventListener('change', () => setTheme(themeSelect.value));
difficultySelect.addEventListener('change', () => {
  if (!playing) updateHud();
});

bestEl.textContent = getBest();
renderLeaderboard();
setMuted(muted);
themeSelect.value = localStorage.getItem(themeKey) || 'mint';
setTheme(themeSelect.value);
reset();
draw();
