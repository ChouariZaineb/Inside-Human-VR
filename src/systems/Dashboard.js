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
 * @param {import('../data/GameState.js').GameState} gameState
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
