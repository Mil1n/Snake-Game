const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const overlay = document.getElementById('overlay');
const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');

const cell = 28;
const grid = canvas.width / cell;

let snake;
let food;
let dir;
let nextDir;
let score;
let speed;
let loop;
let playing = false;
let paused = false;

const best = Number(localStorage.getItem('neonSnakeBest') || 0);
bestEl.textContent = best;

function reset() {
  snake = [{ x: 8, y: 10 }, { x: 7, y: 10 }, { x: 6, y: 10 }];
  dir = { x: 1, y: 0 };
  nextDir = { ...dir };
  score = 0;
  speed = 130;
  spawnFood();
  scoreEl.textContent = score;
}

function spawnFood() {
  do {
    food = {
      x: Math.floor(Math.random() * grid),
      y: Math.floor(Math.random() * grid)
    };
  } while (snake.some(s => s.x === food.x && s.y === food.y));
}

function drawCell(x, y, color, glow = color) {
  const px = x * cell;
  const py = y * cell;
  ctx.shadowColor = glow;
  ctx.shadowBlur = 14;
  ctx.fillStyle = color;
  ctx.fillRect(px + 3, py + 3, cell - 6, cell - 6);
  ctx.shadowBlur = 0;
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = 'rgba(121, 174, 255, 0.08)';
  for (let i = 0; i < grid; i++) {
    ctx.beginPath();
    ctx.moveTo(i * cell, 0);
    ctx.lineTo(i * cell, canvas.height);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i * cell);
    ctx.lineTo(canvas.width, i * cell);
    ctx.stroke();
  }

  snake.forEach((s, i) => drawCell(s.x, s.y, i === 0 ? '#71ffcf' : '#34d8b0', '#66ffe1'));
  drawCell(food.x, food.y, '#ff8fab', '#ff89d5');
}

function tick() {
  if (!playing || paused) return;

  dir = nextDir;
  const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

  if (head.x < 0 || head.y < 0 || head.x >= grid || head.y >= grid || snake.some(s => s.x === head.x && s.y === head.y)) {
    gameOver();
    return;
  }

  snake.unshift(head);

  if (head.x === food.x && head.y === food.y) {
    score += 10;
    speed = Math.max(80, speed - 2);
    scoreEl.textContent = score;
    if (score > Number(localStorage.getItem('neonSnakeBest') || 0)) {
      localStorage.setItem('neonSnakeBest', String(score));
      bestEl.textContent = score;
    }
    spawnFood();
    clearInterval(loop);
    loop = setInterval(tick, speed);
  } else {
    snake.pop();
  }

  draw();
}

function startGame() {
  overlay.classList.add('hidden');
  playing = true;
  paused = false;
  pauseBtn.textContent = 'Pause';
  reset();
  draw();
  clearInterval(loop);
  loop = setInterval(tick, speed);
}

function gameOver() {
  playing = false;
  clearInterval(loop);
  overlay.classList.remove('hidden');
  overlay.querySelector('h2').textContent = 'Game Over';
  overlay.querySelector('p').textContent = `Your score: ${score}. Press Space or Start to play again.`;
}

function setDirection(x, y) {
  if (!playing || paused) return;
  if (x === -dir.x && y === -dir.y) return;
  nextDir = { x, y };
}

document.addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase();
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'w', 'a', 's', 'd', 'p'].includes(key)) e.preventDefault();

  if (key === ' ' && !playing) return startGame();
  if (key === 'p' && playing) {
    paused = !paused;
    pauseBtn.textContent = paused ? 'Resume' : 'Pause';
    return;
  }
  if (key === 'arrowup' || key === 'w') setDirection(0, -1);
  if (key === 'arrowdown' || key === 's') setDirection(0, 1);
  if (key === 'arrowleft' || key === 'a') setDirection(-1, 0);
  if (key === 'arrowright' || key === 'd') setDirection(1, 0);
});

pauseBtn.addEventListener('click', () => {
  if (!playing) return;
  paused = !paused;
  pauseBtn.textContent = paused ? 'Resume' : 'Pause';
});
startBtn.addEventListener('click', startGame);

draw();
