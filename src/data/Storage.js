/**
 * Stockage local de la progression dans IndexedDB (EF-10).
 * Aucune donnée personnelle ni requête réseau : un seul instantané contient
 * les scores par organe et les niveaux débloqués (GameState.toJSON()).
 */
import { eventBus as defaultBus, EVENTS } from '../systems/EventBus.js';

export const DB_NAME = 'inside-human-vr';
const DB_VERSION = 1;
const STORE_NAME = 'progress';
const SAVE_KEY = 'player';

/** Ouvre la base et crée l'object store lors de sa première utilisation. */
export function openProgressDB(indexedDBApi = globalThis.indexedDB) {
  return new Promise((resolve, reject) => {
    if (!indexedDBApi) {
      reject(new Error('IndexedDB indisponible dans ce navigateur'));
      return;
    }

    let request;
    try {
      request = indexedDBApi.open(DB_NAME, DB_VERSION);
    } catch (error) {
      reject(error);
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Ouverture IndexedDB impossible'));
    request.onblocked = () => reject(new Error('IndexedDB bloquée par un autre onglet'));
  });
}

/** Renvoie un instantané sauvegardé ou null si le joueur n'a pas de progression. */
export async function readProgress(indexedDBApi = globalThis.indexedDB) {
  const db = await openProgressDB(indexedDBApi);
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const request = transaction.objectStore(STORE_NAME).get(SAVE_KEY);
      request.onsuccess = () => resolve(request.result?.snapshot ?? null);
      request.onerror = () => reject(request.error ?? new Error('Lecture de la progression impossible'));
      transaction.onabort = () => reject(transaction.error ?? new Error('Lecture IndexedDB annulée'));
    });
  } finally {
    db.close();
  }
}

/** Sauvegarde l'instantané et attend la validation complète de la transaction. */
export async function writeProgress(snapshot, indexedDBApi = globalThis.indexedDB) {
  const db = await openProgressDB(indexedDBApi);
  try {
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).put({ snapshot, savedAt: Date.now() }, SAVE_KEY);
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error ?? new Error('Sauvegarde IndexedDB annulée'));
      transaction.onerror = () => reject(transaction.error ?? new Error('Sauvegarde IndexedDB impossible'));
    });
  } finally {
    db.close();
  }
}

/** Restaure GameState au démarrage, sans empêcher de jouer si IndexedDB est refusée. */
export async function restoreProgress(gameState, indexedDBApi = globalThis.indexedDB) {
  try {
    const snapshot = await readProgress(indexedDBApi);
    if (!snapshot) return false;
    gameState.restore(snapshot);
    return true;
  } catch (error) {
    console.warn('[Storage] Progression non restaurée :', error);
    return false;
  }
}

/**
 * Persiste immédiatement chaque réussite et déblocage.
 * Les écritures sont mises en file pour éviter qu'une sauvegarde plus ancienne
 * n'écrase la plus récente quand deux événements arrivent à la suite.
 *
 * @returns {{ flush: () => Promise<void>, stop: () => void }}
 */
export function bindProgressAutoSave(gameState, bus = defaultBus, indexedDBApi = globalThis.indexedDB) {
  let queue = Promise.resolve();
  let stopped = false;

  const save = () => {
    if (stopped) return;
    // Capture synchrone : un événement ultérieur peut encore modifier GameState.
    const snapshot = gameState.toJSON();
    queue = queue.then(() => writeProgress(snapshot, indexedDBApi)).catch((error) => {
      console.warn('[Storage] Sauvegarde locale indisponible :', error);
    });
  };

  const offSuccess = bus.on(EVENTS.MISSION_SUCCESS, save);
  const offUnlocked = bus.on(EVENTS.LEVEL_UNLOCKED, save);
  return {
    flush: () => queue,
    stop: () => {
      stopped = true;
      offSuccess();
      offUnlocked();
    },
  };
}
