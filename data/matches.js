/**
 * La Hulpe 3 Fantasy Manager — Calendrier de saison (seed)
 *
 * 18 journées avec adversaires/dates placeholders. Tout est modifiable
 * depuis la page Administration — ces valeurs ne servent qu'à démarrer
 * l'appli avec un calendrier cohérent avant la première édition par un admin.
 *
 * status: 'verrouille' (pronostics fermés) | 'ouvert' (pronostics possibles)
 *         | 'termine' (résultat encodé)
 */
(function () {
  window.LH3 = window.LH3 || {};
  window.LH3.data = window.LH3.data || {};

  const SEED_DATES = [
    '2026-08-01', '2026-08-08', '2026-08-15', '2026-08-22', '2026-08-29',
    '2026-09-05', '2026-09-12', '2026-09-19', '2026-09-26', '2026-10-03',
    '2026-10-10', '2026-10-17', '2026-10-24', '2026-10-31', '2026-11-07',
    '2026-11-14', '2026-11-21', '2026-11-28',
  ];

  const totalMatchdays = window.LH3.data.CONFIG.season.totalMatchdays;

  const MATCHES = SEED_DATES.slice(0, totalMatchdays).map((date, i) => ({
    id: 'md-' + (i + 1),
    matchday: i + 1,
    opponent: 'Adversaire J' + (i + 1),
    date,
    status: i === 0 ? 'ouvert' : 'verrouille',
    result: null, // { scoreFor, scoreAgainst, totalTries, tryScorers: [playerId], manOfMatchId, blunderId }
  }));

  window.LH3.data.MATCHES = MATCHES;
})();
