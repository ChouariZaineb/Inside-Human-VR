import test from 'node:test';
import assert from 'node:assert/strict';
import { EventBus, EVENTS } from '../src/systems/EventBus.js';
import { GameState, PHASE } from '../src/data/GameState.js';
import { bindProgressAutoSave, readProgress, restoreProgress, writeProgress } from '../src/data/Storage.js';

// IndexedDB simulée : les tests restent autonomes et ne requièrent pas de navigateur.
function fakeIndexedDB() {
  let created = false;
  const rows = new Map();
  const db = {
    objectStoreNames: { contains: () => created },
    createObjectStore: () => { created = true; },
    close: () => {},
    transaction: () => {
      const transaction = {
        error: null,
        objectStore: () => ({
          get: (key) => {
            const request = { result: null };
            queueMicrotask(() => {
              request.result = rows.get(key) ?? null;
              request.onsuccess?.();
            });
            return request;
          },
          put: (data, key) => {
            rows.set(key, data);
            queueMicrotask(() => transaction.oncomplete?.());
          },
        }),
      };
      return transaction;
    },
  };

  return {
    open: () => {
      const request = { result: db, error: null };
      queueMicrotask(() => {
        if (!created) request.onupgradeneeded?.();
        request.onsuccess?.();
      });
      return request;
    },
  };
}

test('Le cœur débloque les poumons et la sauvegarde restaure score et progression', async () => {
  const db = fakeIndexedDB();
  const bus = new EventBus();
  let now = 0;
  const state = new GameState(bus, () => now);
  const autoSave = bindProgressAutoSave(state, bus, db);

  assert.equal(state.isUnlocked('heart'), true);
  assert.equal(state.isUnlocked('lungs'), false);
  state.startLevel('heart');
  state.setPhase(PHASE.EXPLORATION);
  state.setPhase(PHASE.MISSION);
  now = 3000;
  state.recordCorrect();
  state.recordError('left_atrium');
  now = 5000;
  const result = state.finishLevel({ nextLevelId: 'lungs' });
  assert.equal(result.score, 90);
  assert.equal(result.timeSeconds, 5);
  assert.equal(state.isUnlocked('lungs'), true);

  await autoSave.flush();
  const restored = new GameState(new EventBus());
  assert.equal(await restoreProgress(restored, db), true);
  assert.equal(restored.isUnlocked('lungs'), true);
  assert.equal(restored.isUnlocked('brain'), false);
  assert.equal(restored.results.heart.score, 90);
  autoSave.stop();
});

test('Un ancien instantané ne doit pas écraser un nouveau déblocage', async () => {
  const db = fakeIndexedDB();
  const bus = new EventBus();
  const state = new GameState(bus);
  const autoSave = bindProgressAutoSave(state, bus, db);
  state.unlock('lungs');
  state.unlock('brain');
  await autoSave.flush();
  assert.deepEqual((await readProgress(db)).unlocked.sort(), ['brain', 'heart', 'lungs']);
  autoSave.stop();
});

test('La lecture et l’écriture IndexedDB fonctionnent et sont facultatives', async () => {
  const db = fakeIndexedDB();
  assert.equal(await readProgress(db), null);
  const snapshot = { unlocked: ['heart'], results: {} };
  await writeProgress(snapshot, db);
  assert.deepEqual(await readProgress(db), snapshot);

  const state = new GameState(new EventBus());
  assert.equal(await restoreProgress(state, null), false); // mode privé : on peut quand même jouer
  assert.equal(state.isUnlocked('heart'), true);
});
