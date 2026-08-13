/**
 * La Hulpe 3 Fantasy Manager — Postes de la composition
 *
 * 15 postes, disposés en lignes façon schéma de composition rugby. Purement
 * visuel : n'importe quel joueur peut occuper n'importe quel poste — mais
 * l'INDEX d'un joueur dans `manager.squad.starters` détermine quel poste il
 * occupe (voir pages/myTeam.js et services/communityService.js, qui
 * partagent tous les deux cette même liste pour ne jamais désynchroniser).
 */
(function () {
  window.LH3 = window.LH3 || {};
  window.LH3.data = window.LH3.data || {};

  const PITCH_ROWS = [
    [{ n: 15, label: 'Arrière' }],
    [{ n: 11, label: 'Ailier' }, { n: 12, label: 'Centre' }, { n: 13, label: 'Centre' }, { n: 14, label: 'Ailier' }],
    [{ n: 10, label: 'Ouv.' }, { n: 9, label: 'Mêlée' }],
    [{ n: 7, label: '3e ligne' }, { n: 8, label: '3e ligne' }, { n: 6, label: '3e ligne' }],
    [{ n: 5, label: '2e ligne' }, { n: 4, label: '2e ligne' }],
    [{ n: 1, label: 'Pilier' }, { n: 2, label: 'Talon.' }, { n: 3, label: 'Pilier' }],
  ];

  // Liste à plat, dans l'ordre exact des index de `squad.starters` (15 entrées).
  const POSITIONS = PITCH_ROWS.reduce((acc, row) => acc.concat(row), []);

  function positionAtIndex(idx) {
    return POSITIONS[idx] || null;
  }

  window.LH3.data.PITCH_ROWS = PITCH_ROWS;
  window.LH3.data.POSITIONS = POSITIONS;
  window.LH3.data.positionAtIndex = positionAtIndex;
})();
