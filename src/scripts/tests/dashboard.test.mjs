import test from 'node:test';
import assert from 'node:assert/strict';
import { GameState } from '../data/GameState.mjs';
import { EventBus } from '../systems/EventBus.mjs';
import { buildDashboardData, formatDashboardTime } from '../systems/Dashboard.mjs';

test('Tableau de bord vide : le cœur est accessible, aucun score inventé', () => {
  const state = new GameState(new EventBus());
  const data = buildDashboardData(state);
  assert.equal(data.completedCount, 0);
  assert.equal(data.averageScore, null);
  assert.equal(data.totalTimeSeconds, 0);
  assert.deepEqual(data.notionsCovered, []);
  assert.equal(data.levels[0].unlocked, true);
  assert.equal(data.levels[1].unlocked, false);
  assert.equal(data.levels[0].score, null);
});

test('Le tableau de bord agrège les vrais scores et durées restaurés', () => {
  const state = new GameState(new EventBus());
  state.restore({
    unlocked: ['heart', 'lungs', 'brain'],
    results: {
      heart: { score: 90, errors: 1, timeSeconds: 32.4 },
      lungs: { score: 80, errors: 2, timeSeconds: 59.6 },
    },
  });
  const data = buildDashboardData(state);
  assert.equal(data.completedCount, 2);
  assert.equal(data.averageScore, 85);
  assert.equal(data.totalTimeSeconds, 92);
  assert.equal(data.notionsCovered.length, 2);
  assert.equal(data.levels[1].errors, 2);
  assert.equal(data.levels[2].completed, false);
  assert.equal(data.levels[2].score, null);
});

test('Affichage cohérent des durées', () => {
  assert.equal(formatDashboardTime(null), '—');
  assert.equal(formatDashboardTime(0), '0 s');
  assert.equal(formatDashboardTime(72), '1 min 12 s');
  assert.equal(formatDashboardTime(12.8), '13 s');
});
