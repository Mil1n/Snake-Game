const assert = require('assert');
const core = require('./game-core');

assert.strictEqual(core.currentLevel(0), 1);
assert.strictEqual(core.currentLevel(49), 1);
assert.strictEqual(core.currentLevel(50), 2);
assert.strictEqual(core.formatTime(90000), '01:30');
assert.deepStrictEqual(core.sortLeaders([{ score: 3 }, { score: 10 }, { score: 7 }]), [{ score: 10 }, { score: 7 }, { score: 3 }]);
assert.deepStrictEqual(core.nextCell({ x: 0, y: 0 }, { x: -1, y: 0 }, 20, true), { x: 19, y: 0 });
assert.strictEqual(core.collides({ x: 1, y: 1 }, [{ x: 1, y: 1 }], [], 20).body, true);
assert.strictEqual(core.collides({ x: 1, y: 1 }, [{ x: 1, y: 1 }], [], 20, true).body, false);
assert.ok(core.missionForDate(new Date('2026-07-12')).text.length > 0);
console.log('core tests passed');
