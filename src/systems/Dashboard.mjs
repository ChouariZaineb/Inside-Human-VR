/**
 * Tableau de bord pédagogique — semaine 3, Malouli Melek.
 *
 * Lit les résultats produits par GameState et restaurés par Storage.js.
 * Ne modifie jamais la progression et ne touche pas aux fonctionnalités PWA.
 */

/** Libellés et notions identiques au contenu pédagogique de levels.json. */
export const DASHBOARD_LEVELS = Object.freeze([
  {
    id: 'heart',
    label: 'Le cœur',
    notion: 'La circulation sanguine, le rôle des cavités et des valves',
  },
  {
    id: 'lungs',
    label: 'Les poumons',
    notion: "Les échanges gazeux entre l'air et le sang",
  },
  {
    id: 'brain',
    label: 'Le cerveau',
    notion: "La transmission de l'influx nerveux et le rôle des synapses",
  },
]);

/**
 * Construit le résumé de progression à partir de GameState.
 * Un niveau est considéré réussi s'il existe dans gameState.results.
 * Les notions sont affichées comme abordées, pas comme une certification de connaissances.
 * @param {import('../data/GameState.mjs').GameState} gameState
 */
export function buildDashboardData(gameState) {
  const levels = DASHBOARD_LEVELS.map(({ id, label, notion }) => {
    const result = gameState.results?.[id] ?? null;
    const completed = Boolean(result);
    return {
      id,
      label,
      notion,
      completed,
      unlocked: gameState.isUnlocked(id),
      score: completed && Number.isFinite(result.score) ? result.score : null,
      timeSeconds: completed && Number.isFinite(result.timeSeconds) ? result.timeSeconds : null,
      errors: completed && Number.isFinite(result.errors) ? result.errors : null,
    };
  });
  const completed = levels.filter((level) => level.completed);
  const scored = completed.filter((level) => level.score !== null);
  const timed = completed.filter((level) => level.timeSeconds !== null);
  const totalTimeSeconds = timed.reduce((sum, level) => sum + level.timeSeconds, 0);
  const averageScore = scored.length
    ? Math.round(scored.reduce((sum, level) => sum + level.score, 0) / scored.length)
    : null;

  return {
    levels,
    completedCount: completed.length,
    levelCount: DASHBOARD_LEVELS.length,
    averageScore,
    totalTimeSeconds,
    notionsCovered: completed.map((level) => level.notion),
  };
}

/** Secondes affichées au format lisible ; null => pas encore de résultat. */
export function formatDashboardTime(seconds) {
  if (seconds === null || !Number.isFinite(seconds)) return '—';
  const total = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return minutes ? `${minutes} min ${String(rest).padStart(2, '0')} s` : `${rest} s`;
}

/** Construit un élément DOM sans injecter de HTML provenant des données. */
function makeElement(document, tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

/** Affiche le tableau de bord dans un conteneur HTML de la page d'accueil. */
export function renderDashboard(container, data) {
  if (!container) return;
  const doc = container.ownerDocument;
  const summary = makeElement(doc, 'div', 'dashboard-summary');

  for (const [label, value] of [
    ['Missions réussies', `${data.completedCount} / ${data.levelCount}`],
    ['Score moyen', data.averageScore === null ? '—' : `${data.averageScore} / 100`],
    ['Temps des missions', data.completedCount ? formatDashboardTime(data.totalTimeSeconds) : '—'],
  ]) {
    const card = makeElement(doc, 'div', 'dashboard-stat');
    card.append(
      makeElement(doc, 'span', 'dashboard-stat-label', label),
      makeElement(doc, 'strong', 'dashboard-stat-value', value),
    );
    summary.append(card);
  }

  const list = makeElement(doc, 'ol', 'dashboard-results');
  for (const level of data.levels) {
    const item = makeElement(doc, 'li', 'dashboard-result');
    const heading = makeElement(doc, 'h4', null, level.label);
    const state = level.completed ? `Réussi · ${level.score ?? '—'}/100`
      : level.unlocked ? 'Accessible · pas encore terminé' : 'Verrouillé';
    const detail = makeElement(doc, 'p', 'dashboard-result-meta', state);
    const time = makeElement(doc, 'p', 'dashboard-result-meta',
      `Temps : ${formatDashboardTime(level.timeSeconds)} · Erreurs : ${level.errors ?? '—'}`);
    const notion = makeElement(doc, 'p', 'dashboard-notion',
      level.completed ? `Notion abordée : ${level.notion}` : 'Notion à découvrir après la mission.');
    item.append(heading, detail, time, notion);
    list.append(item);
  }

  const note = makeElement(doc, 'p', 'dashboard-note',
    'Résultats enregistrés localement dans ce navigateur. Une notion abordée ne remplace pas une évaluation des connaissances.');
  container.replaceChildren(summary, list, note);
}

/**
 * Connecte l'affichage au score et aux niveaux débloqués.
 * @returns {() => void} Permet de se désabonner si l'interface est détruite.
 */
export function mountDashboard({ container, gameState, eventBus }) {
  if (!container) return () => {};
  const refresh = () => renderDashboard(container, buildDashboardData(gameState));
  const offSuccess = eventBus.on('missionSuccess', refresh);
  const offUnlocked = eventBus.on('levelUnlocked', refresh);
  refresh(); // Après restoreProgress() : résultats déjà enregistrés visibles.
  return () => {
    offSuccess();
    offUnlocked();
  };
}
