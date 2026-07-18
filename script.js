const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const levelEl = document.getElementById('level');
const statsEl = document.getElementById('stats');
const careerStatsEl = document.getElementById('careerStats');
const leaderboardEl = document.getElementById('leaderboard');
const overlay = document.getElementById('overlay');
const overlayText = document.getElementById('overlayText');
const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const soundBtn = document.getElementById('soundBtn');
const resetScoresBtn = document.getElementById('resetScoresBtn');
const difficultySelect = document.getElementById('difficultySelect');
const mapSelect = document.getElementById('mapSelect');
const themeSelect = document.getElementById('themeSelect');
const stage = document.querySelector('.stage');

const cell = 28;
const grid = canvas.width / cell;
const bestKey = 'neonSnakeBest';
const leadersKey = 'neonSnakeLeaders';
const themeKey = 'neonSnakeTheme';
const difficultyKey = 'neonSnakeDifficulty';
const mapKey = 'neonSnakeMap';
const careerKey = 'neonSnakeCareerStats';
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
  poison: { score: -10, color: '#ef476f', glow: '#ff6b6b', ttl: 7000 },
  teleport: { score: 15, color: '#c77dff', glow: '#e0aaff', ttl: 8500 },
  double: { score: 20, color: '#f7ff58', glow: '#ffff99', ttl: 8500 }
};

const mapPresets = {
  dynamic: [],
  cross: [[9, 6], [9, 7], [9, 8], [9, 11], [9, 12], [9, 13], [6, 9], [7, 9], [8, 9], [11, 9], [12, 9], [13, 9]],
  arena: [[4, 4], [5, 4], [14, 4], [15, 4], [4, 15], [5, 15], [14, 15], [15, 15], [4, 5], [15, 5], [4, 14], [15, 14]],
  corridors: [[5, 3], [5, 4], [5, 5], [5, 6], [5, 13], [5, 14], [5, 15], [14, 4], [14, 5], [14, 6], [14, 7], [14, 12], [14, 13], [14, 14], [10, 9], [10, 10]]
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
let lastDeathReason = 'столкновение';
let doubleNext = false;
let audioContext;

function readLeaders() {
  try {
    return JSON.parse(localStorage.getItem(leadersKey) || '[]');
  } catch {
    return [];
  }
}

function readCareerStats() {
  try {
    return JSON.parse(localStorage.getItem(careerKey) || '{"games":0,"totalTime":0,"bestLength":3,"totalEaten":0}');
  } catch {
    return { games: 0, totalTime: 0, bestLength: 3, totalEaten: 0 };
  }
}

function saveCareerStats() {
  const stats = readCareerStats();
  stats.games += 1;
  stats.totalTime += elapsedBeforePause;
  stats.bestLength = Math.max(stats.bestLength, snake.length);
  stats.totalEaten += eaten;
  localStorage.setItem(careerKey, JSON.stringify(stats));
  renderCareerStats();
}

function renderCareerStats() {
  const stats = readCareerStats();
  careerStatsEl.textContent = `Партий: ${stats.games} • Время: ${formatTime(stats.totalTime)} • Макс. длина: ${stats.bestLength} • Еды: ${stats.totalEaten}`;
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
  obstacles = presetObstacles();
  particles = [];
  dir = { x: 1, y: 0 };
  nextDir = { ...dir };
  score = 0;
  speed = difficulty.speed;
  shield = difficulty.lives;
  eaten = 0;
  elapsedBeforePause = 0;
  achievedNewBest = false;
  lastDeathReason = 'столкновение';
  doubleNext = false;
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

function presetObstacles() {
  return (mapPresets[mapSelect.value] || []).map(([x, y]) => ({ x, y }));
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
  if (roll < 0.90) return 'shield';
  if (roll < 0.96) return 'poison';
  if (roll < 0.985) return 'teleport';
  return 'double';
}

function spawnFood() {
  const type = pickFoodType();
  do {
    food = { ...randomCell(), type, born: Date.now() };
  } while (isOccupied(food));
}

function maybeAddObstacle() {
  const difficulty = difficulties[difficultySelect.value];
  if (mapSelect.value !== 'dynamic') return;
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

function drawHead(head) {
  drawCell(head.x, head.y, cssVar('--snake'), cssVar('--accent'));
  const centerX = head.x * cell + cell / 2;
  const centerY = head.y * cell + cell / 2;
  const forwardX = dir.x * 5;
  const forwardY = dir.y * 5;
  const sideX = dir.y * 4;
  const sideY = -dir.x * 4;
  ctx.fillStyle = '#08101f';
  ctx.beginPath();
  ctx.arc(centerX + forwardX + sideX, centerY + forwardY + sideY, 2.3, 0, Math.PI * 2);
  ctx.arc(centerX + forwardX - sideX, centerY + forwardY - sideY, 2.3, 0, Math.PI * 2);
  ctx.fill();
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
  snake.forEach((s, i) => {
    if (i === 0) drawHead(s);
    else drawCell(s.x, s.y, cssVar('--snake-body'), cssVar('--accent'));
  });

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
  const hitWall = head.x < 0 || head.y < 0 || head.x >= grid || head.y >= grid;
  const hitTail = snake.some((s) => s.x === head.x && s.y === head.y);
  const hitObstacle = obstacles.some((o) => o.x === head.x && o.y === head.y);
  const crashed = hitWall || hitTail || hitObstacle;

  if (crashed) {
    lastDeathReason = hitWall ? 'стена' : hitTail ? 'хвост' : 'препятствие';
    if (shield > 0) {
      shield -= 1;
      flash('#b8f7d4');
      playTone(220, 0.16, 'sawtooth');
      nextDir = { x: -dir.x, y: -dir.y };
      dir = nextDir;
      updateHud();
      return;
    }
    gameOver(lastDeathReason);
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
  score = Math.max(0, score + meta.score * (doubleNext ? 2 : 1));
  doubleNext = false;

  if (type === 'slow') speed += 16;
  if (type === 'shield') shield = Math.min(1, shield + 1);
  if (type === 'poison') snake.pop();
  if (type === 'teleport') snake[0] = safeCell();
  if (type === 'double') doubleNext = true;

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

function safeCell() {
  let point;
  let attempts = 0;
  do {
    point = randomCell();
    attempts += 1;
  } while (isOccupied(point) && attempts < 100);
  return point;
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

function gameOver(reason = lastDeathReason) {
  elapsedBeforePause = gameTime();
  playing = false;
  paused = false;
  clearInterval(loop);
  clearInterval(statsLoop);
  saveLeader();
  saveCareerStats();
  stage.classList.add('shake');
  setTimeout(() => stage.classList.remove('shake'), 360);
  overlay.classList.remove('hidden');
  overlay.querySelector('h2').textContent = achievedNewBest ? 'Новый рекорд!' : 'Game Over';
  overlayText.textContent = `Причина: ${reason}. Счёт: ${score}. Время: ${formatTime(elapsedBeforePause)}. Длина: ${snake.length}. Съедено: ${eaten}. Нажми Space или «Начать игру».`;
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
  localStorage.removeItem(careerKey);
  renderLeaderboard();
  renderCareerStats();
  updateHud();
});
themeSelect.addEventListener('change', () => setTheme(themeSelect.value));
mapSelect.addEventListener('change', () => {
  localStorage.setItem(mapKey, mapSelect.value);
  if (!playing) {
    reset();
    draw();
  }
});
difficultySelect.addEventListener('change', () => {
  localStorage.setItem(difficultyKey, difficultySelect.value);
  if (!playing) updateHud();
});

bestEl.textContent = getBest();
renderLeaderboard();
renderCareerStats();
setMuted(muted);
difficultySelect.value = localStorage.getItem(difficultyKey) || 'normal';
mapSelect.value = localStorage.getItem(mapKey) || 'dynamic';
themeSelect.value = localStorage.getItem(themeKey) || 'mint';
setTheme(themeSelect.value);
reset();
draw();
