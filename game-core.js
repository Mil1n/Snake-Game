const SnakeCore = (() => {
  const difficulties = {
    easy: { label: 'Easy', speed: 155, minSpeed: 95, speedStep: 1, obstacleEvery: 999, maxObstacles: 0, lives: 1 },
    normal: { label: 'Normal', speed: 130, minSpeed: 80, speedStep: 2, obstacleEvery: 4, maxObstacles: 6, lives: 1 },
    hard: { label: 'Hard', speed: 105, minSpeed: 65, speedStep: 3, obstacleEvery: 3, maxObstacles: 10, lives: 1 },
    insane: { label: 'Insane', speed: 82, minSpeed: 48, speedStep: 4, obstacleEvery: 2, maxObstacles: 16, lives: 0 }
  };

  const modes = {
    arcade: { label: 'Arcade', description: 'Бонусы, препятствия, ускорение и щиты.' },
    classic: { label: 'Classic', description: 'Только классическая еда и хвост.' },
    zen: { label: 'Zen', description: 'Стены переносят змейку на другую сторону.' },
    challenge: { label: 'Challenge', description: 'Играй на готовых картах с препятствиями.' },
    time: { label: 'Time Attack', description: 'Набери максимум за ограниченное время.' }
  };

  const foodTypes = {
    normal: { score: 10, color: '#ff8fab', glow: '#ff89d5', ttl: 0, label: '+10' },
    golden: { score: 30, color: '#ffd166', glow: '#fff0a3', ttl: 6500, label: '+30' },
    slow: { score: 5, color: '#7bdff2', glow: '#9bf6ff', ttl: 8000, label: 'замедление' },
    shield: { score: 5, color: '#b8f7d4', glow: '#d8ffe8', ttl: 9000, label: 'щит' },
    poison: { score: -10, color: '#ef476f', glow: '#ff6b6b', ttl: 7000, label: 'яд' },
    teleport: { score: 12, color: '#c77dff', glow: '#e0aaff', ttl: 9000, label: 'телепорт' },
    double: { score: 8, color: '#f7ff58', glow: '#ffff99', ttl: 9000, label: 'x2' },
    ghost: { score: 8, color: '#ffffff', glow: '#9bf6ff', ttl: 8500, label: 'призрак' },
    shrink: { score: 6, color: '#80ffdb', glow: '#64dfdf', ttl: 8500, label: 'сжатие' },
    freeze: { score: 6, color: '#a0c4ff', glow: '#bde0fe', ttl: 8500, label: 'заморозка' }
  };

  const mapPresets = {
    none: { label: 'Без карты', obstacles: [] },
    cross: { label: 'Крест', obstacles: [[9, 6], [9, 7], [9, 8], [9, 11], [9, 12], [9, 13], [6, 9], [7, 9], [8, 9], [11, 9], [12, 9], [13, 9]] },
    arena: { label: 'Арена', obstacles: [[4, 4], [5, 4], [14, 4], [15, 4], [4, 15], [5, 15], [14, 15], [15, 15], [4, 5], [15, 5], [4, 14], [15, 14]] },
    corridors: { label: 'Коридоры', obstacles: [[5, 3], [5, 4], [5, 5], [5, 6], [5, 13], [5, 14], [5, 15], [14, 4], [14, 5], [14, 6], [14, 7], [14, 12], [14, 13], [14, 14], [10, 9], [10, 10]] }
  };

  function currentLevel(score) {
    return Math.max(1, Math.floor(score / 50) + 1);
  }

  function formatTime(ms) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
    const seconds = String(totalSeconds % 60).padStart(2, '0');
    return `${minutes}:${seconds}`;
  }

  function sortLeaders(leaders) {
    return [...leaders].sort((a, b) => b.score - a.score).slice(0, 5);
  }

  function missionForDate(date = new Date()) {
    const daySeed = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
    const missions = [
      { id: 'score-150', text: 'Набери 150 очков', target: 150, metric: 'score' },
      { id: 'eat-12', text: 'Съешь 12 импульсов', target: 12, metric: 'eaten' },
      { id: 'shield-2', text: 'Собери 2 щита', target: 2, metric: 'shieldFood' },
      { id: 'golden-3', text: 'Собери 3 золотых импульса', target: 3, metric: 'goldenFood' },
      { id: 'time-90', text: 'Продержись 90 секунд', target: 90000, metric: 'time' }
    ];
    return missions[daySeed % missions.length];
  }

  function nextCell(head, dir, grid, wrap = false) {
    let x = head.x + dir.x;
    let y = head.y + dir.y;
    if (wrap) {
      x = (x + grid) % grid;
      y = (y + grid) % grid;
    }
    return { x, y };
  }

  function collides(point, snake, obstacles, grid, ghost = false) {
    const wall = point.x < 0 || point.y < 0 || point.x >= grid || point.y >= grid;
    const body = !ghost && snake.some((s) => s.x === point.x && s.y === point.y);
    const obstacle = obstacles.some((o) => o.x === point.x && o.y === point.y);
    return { wall, body, obstacle, crashed: wall || body || obstacle };
  }

  const api = { difficulties, modes, foodTypes, mapPresets, currentLevel, formatTime, sortLeaders, missionForDate, nextCell, collides };
  return api;
})();

if (typeof module !== 'undefined') module.exports = SnakeCore;
