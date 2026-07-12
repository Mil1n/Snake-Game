const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const levelEl = document.getElementById('level');
const statsEl = document.getElementById('stats');
const careerStatsEl = document.getElementById('careerStats');
const leaderboardEl = document.getElementById('leaderboard');
const achievementsEl = document.getElementById('achievements');
const overlay = document.getElementById('overlay');
const overlayText = document.getElementById('overlayText');
const missionEl = document.getElementById('mission');
const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const soundBtn = document.getElementById('soundBtn');
const resetScoresBtn = document.getElementById('resetScoresBtn');
const exportBtn = document.getElementById('exportBtn');
const difficultySelect = document.getElementById('difficultySelect');
const themeSelect = document.getElementById('themeSelect');
const modeSelect = document.getElementById('modeSelect');
const mapSelect = document.getElementById('mapSelect');
const skinSelect = document.getElementById('skinSelect');
const stage = document.querySelector('.stage');

const { difficulties, modes, foodTypes, mapPresets, currentLevel, formatTime, sortLeaders, missionForDate, nextCell, collides } = SnakeCore;
const cell = 28;
const grid = canvas.width / cell;
const keys = {
  best: 'neonSnakeBest', leaders: 'neonSnakeLeaders', theme: 'neonSnakeTheme', sound: 'neonSnakeMuted',
  difficulty: 'neonSnakeDifficulty', mode: 'neonSnakeMode', map: 'neonSnakeMap', skin: 'neonSnakeSkin',
  stats: 'neonSnakeCareerStats', achievements: 'neonSnakeAchievements', customMap: 'neonSnakeCustomMap'
};
const achievementList = [
  { id: 'first-bite', title: 'Первый укус', check: (s) => s.eaten >= 1 },
  { id: 'survivor', title: 'Выживший 2 минуты', check: (s) => s.time >= 120000 },
  { id: 'gold-hunter', title: 'Охотник за золотом', check: (s) => s.food.golden >= 5 },
  { id: 'combo-master', title: 'Комбо x5', check: (s) => s.maxCombo >= 5 },
  { id: 'insane-master', title: 'Insane Master 300+', check: (s) => s.mode === 'insane' && s.score >= 300 }
];

let snake, food, obstacles, customObstacles, particles, dir, nextDir, score, speed, loop, statsLoop, timerLoop;
let playing = false, paused = false, muted = localStorage.getItem(keys.sound) === 'true', shield = 0, eaten = 0;
let startTime = 0, elapsedBeforePause = 0, achievedNewBest = false, audioContext, lastFoodAt = 0, combo = 1, maxCombo = 1;
let doubleNext = false, ghostUntil = 0, frozenUntil = 0, lastDeathReason = 'столкновение', timeLimit = 90000;
let foodCounters = {}, editorMode = false;

function readJson(key, fallback) { try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch { return fallback; } }
function writeJson(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
function readLeaders() { return readJson(keys.leaders, []); }
function readStats() { return readJson(keys.stats, { games: 0, totalTime: 0, totalFood: 0, bestLength: 3, deaths: {}, favoriteModes: {} }); }
function readAchievements() { return readJson(keys.achievements, []); }
function getBest() { return Number(localStorage.getItem(keys.best) || 0); }
function setBest(value) { localStorage.setItem(keys.best, String(value)); bestEl.textContent = value; }

function renderLeaderboard() {
  leaderboardEl.innerHTML = '';
  readLeaders().slice(0, 5).forEach((entry) => {
    const li = document.createElement('li');
    li.textContent = `${entry.score} • ${entry.mode} • ${entry.date}`;
    leaderboardEl.appendChild(li);
  });
}

function renderAchievements() {
  const unlocked = readAchievements();
  achievementsEl.innerHTML = '';
  achievementList.forEach((item) => {
    const li = document.createElement('li');
    li.className = unlocked.includes(item.id) ? 'unlocked' : '';
    li.textContent = `${unlocked.includes(item.id) ? 'Открыто' : 'Скрыто'}: ${item.title}`;
    achievementsEl.appendChild(li);
  });
}

function renderCareerStats() {
  const s = readStats();
  careerStatsEl.textContent = `Партий: ${s.games} • Лучшая длина: ${s.bestLength} • Всего еды: ${s.totalFood}`;
}

function saveLeader() {
  if (!score) return;
  const leaders = readLeaders();
  leaders.push({ score, mode: `${modes[modeSelect.value].label}/${difficulties[difficultySelect.value].label}`, date: new Date().toLocaleDateString('ru-RU') });
  writeJson(keys.leaders, sortLeaders(leaders));
  renderLeaderboard();
}

function updateCareer(reason = lastDeathReason) {
  const s = readStats();
  s.games += 1;
  s.totalTime += gameTime();
  s.totalFood += eaten;
  s.bestLength = Math.max(s.bestLength, snake.length);
  s.deaths[reason] = (s.deaths[reason] || 0) + 1;
  s.favoriteModes[modeSelect.value] = (s.favoriteModes[modeSelect.value] || 0) + 1;
  writeJson(keys.stats, s);
  renderCareerStats();
}

function unlockAchievements() {
  const unlocked = new Set(readAchievements());
  const snapshot = { eaten, time: gameTime(), food: foodCounters, maxCombo, mode: difficultySelect.value, score };
  achievementList.forEach((item) => { if (item.check(snapshot)) unlocked.add(item.id); });
  writeJson(keys.achievements, [...unlocked]);
  renderAchievements();
}

function selectedObstacles() {
  if (mapSelect.value === 'custom') return readJson(keys.customMap, []).map(([x, y]) => ({ x, y }));
  if (modeSelect.value === 'challenge' && mapSelect.value === 'none') return mapPresets.cross.obstacles.map(([x, y]) => ({ x, y }));
  return (mapPresets[mapSelect.value]?.obstacles || []).map(([x, y]) => ({ x, y }));
}

function reset() {
  const difficulty = difficulties[difficultySelect.value];
  snake = [{ x: 8, y: 10 }, { x: 7, y: 10 }, { x: 6, y: 10 }];
  obstacles = selectedObstacles();
  customObstacles = obstacles;
  particles = [];
  dir = { x: 1, y: 0 };
  nextDir = { ...dir };
  score = 0;
  speed = difficulty.speed;
  shield = difficultySelect.value === 'insane' ? 0 : difficulty.lives;
  eaten = 0; combo = 1; maxCombo = 1; doubleNext = false; ghostUntil = 0; frozenUntil = 0;
  foodCounters = Object.fromEntries(Object.keys(foodTypes).map((k) => [k, 0]));
  elapsedBeforePause = 0;
  achievedNewBest = false;
  lastDeathReason = 'столкновение';
  startTime = Date.now();
  spawnFood();
  updateHud();
}

function gameTime() { return paused ? elapsedBeforePause : elapsedBeforePause + Date.now() - startTime; }
function cssVar(name) { return getComputedStyle(document.body).getPropertyValue(name).trim(); }
function randomCell() { return { x: Math.floor(Math.random() * grid), y: Math.floor(Math.random() * grid) }; }
function isOccupied(point) { return snake.some((s) => s.x === point.x && s.y === point.y) || obstacles.some((o) => o.x === point.x && o.y === point.y); }

function pickFoodType() {
  if (modeSelect.value === 'classic') return 'normal';
  const roll = Math.random();
  if (roll < 0.42) return 'normal';
  if (roll < 0.55) return 'golden';
  if (roll < 0.65) return 'slow';
  if (roll < 0.75) return 'shield';
  if (roll < 0.83) return 'poison';
  if (roll < 0.88) return 'teleport';
  if (roll < 0.92) return 'double';
  if (roll < 0.95) return 'ghost';
  if (roll < 0.98) return 'shrink';
  return 'freeze';
}

function spawnFood() {
  const type = pickFoodType();
  let attempts = 0;
  do { food = { ...randomCell(), type, born: Date.now() }; attempts += 1; } while (isOccupied(food) && attempts < 120);
}

function maybeAddObstacle() {
  if (modeSelect.value === 'classic' || modeSelect.value === 'zen' || Date.now() < frozenUntil) return;
  const difficulty = difficulties[difficultySelect.value];
  if (!difficulty.maxObstacles || eaten % difficulty.obstacleEvery !== 0 || obstacles.length >= difficulty.maxObstacles + selectedObstacles().length) return;
  let obstacle, attempts = 0;
  do { obstacle = randomCell(); attempts += 1; } while ((isOccupied(obstacle) || Math.abs(obstacle.x - snake[0].x) + Math.abs(obstacle.y - snake[0].y) < 4 || (food && obstacle.x === food.x && obstacle.y === food.y)) && attempts < 80);
  if (attempts < 80) obstacles.push(obstacle);
}

function drawCell(x, y, color, glow = color, inset = 3) {
  const px = x * cell, py = y * cell;
  ctx.shadowColor = glow; ctx.shadowBlur = 14; ctx.fillStyle = color;
  ctx.fillRect(px + inset, py + inset, cell - inset * 2, cell - inset * 2);
  ctx.shadowBlur = 0;
}

function drawHead(head) {
  drawCell(head.x, head.y, skinSelect.value === 'ghost' ? 'rgba(255,255,255,.68)' : cssVar('--snake'), cssVar('--accent'), skinSelect.value === 'pixel' ? 1 : 3);
  const cx = head.x * cell + cell / 2, cy = head.y * cell + cell / 2;
  ctx.fillStyle = '#08101f';
  const eyeOffsetX = dir.y ? 5 : dir.x * 5;
  const eyeOffsetY = dir.x ? 5 : dir.y * 5;
  ctx.beginPath(); ctx.arc(cx + eyeOffsetX - dir.y * 4, cy + eyeOffsetY - dir.x * 4, 2.2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + eyeOffsetX + dir.y * 4, cy + eyeOffsetY + dir.x * 4, 2.2, 0, Math.PI * 2); ctx.fill();
}

function drawCircleCell(x, y, color, glow = color, pulse = 0) {
  const centerX = x * cell + cell / 2, centerY = y * cell + cell / 2;
  ctx.shadowColor = glow; ctx.shadowBlur = 18; ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(centerX, centerY, cell * (0.28 + pulse), 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
}

function drawParticles() {
  particles = particles.filter((p) => p.life > 0);
  particles.forEach((p) => { p.x += p.vx; p.y += p.vy; p.life -= 1; ctx.globalAlpha = Math.max(0, p.life / 18); drawCircleCell(p.x, p.y, p.color, p.color, -0.16); ctx.globalAlpha = 1; });
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = 'rgba(121, 174, 255, 0.08)';
  for (let i = 0; i <= grid; i++) { ctx.beginPath(); ctx.moveTo(i * cell, 0); ctx.lineTo(i * cell, canvas.height); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, i * cell); ctx.lineTo(canvas.width, i * cell); ctx.stroke(); }
  obstacles.forEach((o) => drawCell(o.x, o.y, Date.now() < frozenUntil ? '#a0c4ff' : cssVar('--obstacle'), '#b6c2ff', 5));
  snake.forEach((s, i) => {
    if (i === 0) return drawHead(s);
    const rainbow = `hsl(${(i * 24 + Date.now() / 50) % 360} 90% 66%)`;
    drawCell(s.x, s.y, skinSelect.value === 'rainbow' ? rainbow : cssVar('--snake-body'), cssVar('--accent'), skinSelect.value === 'dragon' ? 5 : 3);
  });
  if (shield > 0 && snake[0]) { ctx.strokeStyle = '#b8f7d4'; ctx.shadowColor = '#b8f7d4'; ctx.shadowBlur = 10; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(snake[0].x * cell + cell / 2, snake[0].y * cell + cell / 2, cell * 0.55, 0, Math.PI * 2); ctx.stroke(); ctx.shadowBlur = 0; }
  if (Date.now() < ghostUntil && snake[0]) drawCircleCell(snake[0].x, snake[0].y, 'rgba(255,255,255,.25)', '#ffffff', .22);
  const meta = foodTypes[food.type];
  drawCircleCell(food.x, food.y, meta.color, meta.glow, Math.sin(Date.now() / 160) * 0.05);
  drawParticles();
}

function tick() {
  if (!playing || paused) return;
  if (modeSelect.value === 'time' && gameTime() >= timeLimit) return gameOver('истекло время');
  const meta = foodTypes[food.type];
  if (meta.ttl && Date.now() - food.born > meta.ttl) spawnFood();
  dir = nextDir;
  const wrap = modeSelect.value === 'zen';
  const head = nextCell(snake[0], dir, grid, wrap);
  const crash = collides(head, snake, obstacles, grid, Date.now() < ghostUntil);
  if (crash.crashed) {
    lastDeathReason = crash.wall ? 'стена' : crash.body ? 'хвост' : 'препятствие';
    if (shield > 0 && !crash.wall) { shield -= 1; flash('#b8f7d4'); playTone(220, 0.16, 'sawtooth'); nextDir = { x: -dir.x, y: -dir.y }; dir = nextDir; updateHud(); return; }
    gameOver(lastDeathReason); return;
  }
  snake.unshift(head);
  if (head.x === food.x && head.y === food.y) consumeFood(food.type); else snake.pop();
  updateHud(); draw();
}

function consumeFood(type) {
  const now = Date.now(), meta = foodTypes[type];
  combo = now - lastFoodAt < 3500 ? Math.min(combo + 1, 9) : 1;
  lastFoodAt = now; maxCombo = Math.max(maxCombo, combo); scoreEl.classList.add('combo-pop'); setTimeout(() => scoreEl.classList.remove('combo-pop'), 280);
  eaten += 1; foodCounters[type] = (foodCounters[type] || 0) + 1;
  const multiplier = doubleNext ? combo * 2 : combo;
  score = Math.max(0, score + meta.score * multiplier);
  doubleNext = false;
  if (type === 'slow') speed += 16;
  if (type === 'shield') shield = Math.min(2, shield + 1);
  if (type === 'poison') { combo = 1; if (snake.length > 3) snake.pop(); }
  if (type === 'teleport') snake[0] = safeTeleport();
  if (type === 'double') doubleNext = true;
  if (type === 'ghost') ghostUntil = Date.now() + 7000;
  if (type === 'shrink') snake.splice(Math.max(3, snake.length - 3));
  if (type === 'freeze') frozenUntil = Date.now() + 9000;
  speed = Math.max(difficulties[difficultySelect.value].minSpeed, speed - difficulties[difficultySelect.value].speedStep);
  if (score > getBest()) { achievedNewBest = true; setBest(score); }
  burst(food.x, food.y, meta.color); playTone(type === 'poison' ? 120 : 520 + Math.min(score, 300), 0.09, type === 'golden' ? 'triangle' : 'sine'); maybeAddObstacle(); spawnFood(); restartLoop(); unlockAchievements(); updateMission();
}

function safeTeleport() { let point, attempts = 0; do { point = randomCell(); attempts += 1; } while (isOccupied(point) && attempts < 120); return point; }
function burst(x, y, color) { for (let i = 0; i < 12; i++) particles.push({ x, y, vx: (Math.random() - 0.5) * 0.18, vy: (Math.random() - 0.5) * 0.18, life: 18, color }); flash(color); }
function flash(color) { canvas.style.boxShadow = `inset 0 0 42px ${color}, 0 0 26px ${color}`; if (navigator.vibrate) navigator.vibrate(18); setTimeout(() => { canvas.style.boxShadow = ''; }, 130); }
function restartLoop() { clearInterval(loop); loop = setInterval(tick, speed); }

function startGame() {
  editorMode = false; stage.classList.remove('editor-hint'); overlay.classList.add('hidden'); overlay.querySelector('h2').textContent = 'Neon Snake'; overlayText.textContent = modes[modeSelect.value].description;
  playing = true; paused = false; pauseBtn.textContent = 'Пауза'; reset(); draw(); clearInterval(statsLoop); clearInterval(timerLoop); statsLoop = setInterval(updateHud, 500); timerLoop = setInterval(draw, 120); restartLoop(); playTone(440, 0.12, 'triangle');
}

function gameOver(reason = lastDeathReason) {
  elapsedBeforePause = gameTime(); playing = false; paused = false; clearInterval(loop); clearInterval(statsLoop); clearInterval(timerLoop); lastDeathReason = reason;
  saveLeader(); updateCareer(reason); unlockAchievements(); stage.classList.add('shake'); setTimeout(() => stage.classList.remove('shake'), 360); overlay.classList.remove('hidden');
  overlay.querySelector('h2').textContent = achievedNewBest ? 'Новый рекорд!' : 'Game Over';
  overlayText.textContent = `Причина: ${reason}. Счёт: ${score}. Время: ${formatTime(elapsedBeforePause)}. Длина: ${snake.length}. Комбо: x${maxCombo}. До рекорда: ${Math.max(0, getBest() - score)}.`;
  pauseBtn.textContent = 'Пауза'; playTone(90, 0.3, 'sawtooth'); updateHud(); updateMission();
}

function setDirection(x, y) { if (!playing || paused) return; if (x === -dir.x && y === -dir.y) return; nextDir = { x, y }; }
function togglePause() { if (!playing) return; paused = !paused; if (paused) elapsedBeforePause += Date.now() - startTime; else startTime = Date.now(); pauseBtn.textContent = paused ? 'Продолжить' : 'Пауза'; playTone(paused ? 260 : 420, 0.08, 'triangle'); updateHud(); }
function playTone(frequency, duration, type = 'sine') { if (muted) return; audioContext ||= new (window.AudioContext || window.webkitAudioContext)(); const oscillator = audioContext.createOscillator(); const gain = audioContext.createGain(); oscillator.type = type; oscillator.frequency.value = frequency; oscillator.connect(gain); gain.connect(audioContext.destination); gain.gain.setValueAtTime(0.001, audioContext.currentTime); gain.gain.exponentialRampToValueAtTime(0.08, audioContext.currentTime + 0.01); gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration); oscillator.start(); oscillator.stop(audioContext.currentTime + duration); }
function setMuted(value) { muted = value; localStorage.setItem(keys.sound, String(muted)); soundBtn.textContent = muted ? '🔇' : '🔊'; soundBtn.setAttribute('aria-pressed', String(!muted)); }
function setTheme(theme) { document.body.dataset.theme = theme; localStorage.setItem(keys.theme, theme); if (snake && food) draw(); }
function persistSelect(select, key) { localStorage.setItem(key, select.value); if (!playing) { reset(); draw(); updateMission(); } }

function updateHud() {
  scoreEl.textContent = score; bestEl.textContent = getBest(); levelEl.textContent = currentLevel(score);
  const timeText = modeSelect.value === 'time' ? `${formatTime(Math.max(0, timeLimit - gameTime()))} осталось` : formatTime(gameTime());
  statsEl.textContent = `Время: ${timeText} • Длина: ${snake?.length || 3} • Съедено: ${eaten || 0} • Щит: ${shield > 0 ? shield : 'нет'} • Комбо: x${combo}`;
}

function updateMission() {
  const m = missionForDate();
  const value = m.metric === 'score' ? score : m.metric === 'eaten' ? eaten : m.metric === 'time' ? gameTime() : m.metric === 'shieldFood' ? foodCounters.shield || 0 : foodCounters.golden || 0;
  missionEl.textContent = `Миссия дня: ${m.text} — ${Math.min(m.target, value)}/${m.target}`;
}

function toggleCustomObstacle(event) {
  if (mapSelect.value !== 'custom' || playing) return;
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor((event.clientX - rect.left) / (rect.width / grid));
  const y = Math.floor((event.clientY - rect.top) / (rect.height / grid));
  const list = readJson(keys.customMap, []);
  const index = list.findIndex(([cx, cy]) => cx === x && cy === y);
  if (index >= 0) list.splice(index, 1); else list.push([x, y]);
  writeJson(keys.customMap, list); reset(); draw();
}

function exportSave() {
  const payload = { best: getBest(), leaders: readLeaders(), stats: readStats(), achievements: readAchievements() };
  navigator.clipboard?.writeText(JSON.stringify(payload, null, 2));
  overlayText.textContent = 'Экспорт результатов скопирован в буфер обмена (если браузер разрешил доступ).';
}

function applyDirectionName(direction) { const map = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }; setDirection(...map[direction]); }

document.addEventListener('keydown', (e) => { const key = e.key.toLowerCase(); if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'w', 'a', 's', 'd', 'p'].includes(key)) e.preventDefault(); if (key === ' ' && !playing) return startGame(); if (key === 'p') return togglePause(); if (key === 'arrowup' || key === 'w') setDirection(0, -1); if (key === 'arrowdown' || key === 's') setDirection(0, 1); if (key === 'arrowleft' || key === 'a') setDirection(-1, 0); if (key === 'arrowright' || key === 'd') setDirection(1, 0); });
let touchStart = null;
canvas.addEventListener('pointerdown', (event) => { touchStart = { x: event.clientX, y: event.clientY }; });
canvas.addEventListener('pointerup', (event) => { if (mapSelect.value === 'custom' && !playing) return toggleCustomObstacle(event); if (!touchStart) return; const dx = event.clientX - touchStart.x, dy = event.clientY - touchStart.y; touchStart = null; if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return; if (Math.abs(dx) > Math.abs(dy)) setDirection(dx > 0 ? 1 : -1, 0); else setDirection(0, dy > 0 ? 1 : -1); });
document.querySelectorAll('.touch-btn').forEach((button) => button.addEventListener('click', () => applyDirectionName(button.dataset.dir)));
pauseBtn.addEventListener('click', togglePause); startBtn.addEventListener('click', startGame); soundBtn.addEventListener('click', () => setMuted(!muted)); exportBtn.addEventListener('click', exportSave);
resetScoresBtn.addEventListener('click', () => { Object.values(keys).forEach((key) => localStorage.removeItem(key)); setMuted(false); renderLeaderboard(); renderAchievements(); renderCareerStats(); reset(); draw(); updateHud(); });
themeSelect.addEventListener('change', () => setTheme(themeSelect.value));
difficultySelect.addEventListener('change', () => persistSelect(difficultySelect, keys.difficulty)); modeSelect.addEventListener('change', () => persistSelect(modeSelect, keys.mode)); skinSelect.addEventListener('change', () => persistSelect(skinSelect, keys.skin));
mapSelect.addEventListener('change', () => { persistSelect(mapSelect, keys.map); stage.classList.toggle('editor-hint', mapSelect.value === 'custom' && !playing); });

bestEl.textContent = getBest(); renderLeaderboard(); renderAchievements(); renderCareerStats(); setMuted(muted);
themeSelect.value = localStorage.getItem(keys.theme) || 'mint'; difficultySelect.value = localStorage.getItem(keys.difficulty) || 'normal'; modeSelect.value = localStorage.getItem(keys.mode) || 'arcade'; mapSelect.value = localStorage.getItem(keys.map) || 'none'; skinSelect.value = localStorage.getItem(keys.skin) || 'neon';
setTheme(themeSelect.value); reset(); draw(); updateMission();
