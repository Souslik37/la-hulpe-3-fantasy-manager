/**
 * La Hulpe 3 Fantasy Manager — Page Règles
 *
 * Explique en clair ce que le code fait déjà (voir NOTES.md pour le détail
 * technique) — aucune logique ici, uniquement de la présentation. Les
 * valeurs sont lues depuis data/config.js pour ne jamais se désynchroniser
 * si les réglages changent.
 */
(function () {
  window.LH3 = window.LH3 || {};
  window.LH3.pages = window.LH3.pages || {};

  const { el } = window.LH3.utils.dom;

  function buildPeTable() {
    const { peBadgeClass, formatSigned } = window.LH3.utils.format;
    const pe = window.LH3.data.CONFIG.pe;
    const rows = [
      ['Résultat (victoire / nul / défaite) deviné', pe.correctResult],
      ['Score exact deviné', pe.exactScore],
      ['Écart de points deviné', pe.correctDifference],
      ['Nombre total d\'essais deviné', pe.correctTotalTries],
      ['Nombre total de points deviné', pe.correctTotalPoints],
      ['Par joueur marqueur d\'essai deviné (il marque vraiment)', pe.perCorrectTryScorer],
      ['Par joueur coché qui ne marque PAS', pe.perWrongTryScorer],
      ['Homme du match deviné', pe.correctManOfMatch],
      ['Boulette du match devinée', pe.correctBlunderOfMatch],
    ];
    return el('div', {}, rows.map(([label, value]) => el('div', { className: 'boost-row' }, [
      el('div', { className: 'boost-label' }, [label]),
      el('div', { className: 'badge ' + peBadgeClass(value) }, [formatSigned(value) + ' PE']),
    ])));
  }

  function buildPresenceTable() {
    const { peBadgeClass, formatSigned } = window.LH3.utils.format;
    return el('div', {}, window.LH3.data.CONFIG.presence.tiers.map((t) => el('div', { className: 'boost-row' }, [
      el('div', { className: 'boost-label' }, [t.label]),
      el('div', { className: 'badge ' + peBadgeClass(t.pe) }, [formatSigned(t.pe) + ' PE']),
    ])));
  }

  function buildRarityTable() {
    const tiers = window.LH3.data.CONFIG.rarity.tiers;
    const order = window.LH3.data.CONFIG.rarity.order;
    return el('div', {}, order.map((key) => {
      const t = tiers[key];
      return el('div', { className: 'boost-row' }, [
        el('div', { className: 'boost-label' }, [t.label]),
        el('div', { className: 'muted' }, [t.min + ' – ' + t.max]),
      ]);
    }));
  }

  function buildPrestigeTable() {
    const levels = window.LH3.data.CONFIG.prestige.levels;
    return el('div', {}, levels.map((l) => el('div', { className: 'boost-row' }, [
      el('div', { className: 'boost-label' }, [l.name]),
      el('div', { className: 'muted' }, ['à partir de ' + l.peRequired + ' PE']),
    ])));
  }

  function render(root) {
    const CONFIG = window.LH3.data.CONFIG;
    root.innerHTML = '';
    root.appendChild(el('div', { className: 'page-header' }, [
      el('h1', {}, ['📖 Règles du jeu']),
      el('p', {}, ['Comment tout se calcule, en détail — pour ne plus jamais se demander pourquoi tu as gagné (ou pas) des PE (Points d\'Expérience).']),
    ]));

    root.appendChild(el('div', { className: 'card', style: { marginBottom: '18px' } }, [
      el('h3', { style: { marginBottom: '10px' } }, ['🎮 Comment ça marche']),
      el('p', { className: 'small', style: { lineHeight: '1.6' } }, [
        'Une seule monnaie fait tout tourner : le ', el('b', {}, ['PE']), '. Tu en gagnes en pronostiquant bien et en étant assidu aux entraînements, et ce PE ',
        el('b', {}, ['est directement']), ' ton budget pour booster les attributs de ton équipe — pas de conversion, pas de système séparé. ',
        'Le but du jeu : ', el('b', {}, ['bien pronostiquer et venir aux entraînements pour avoir la meilleure équipe']), '. Ton classement (page Classements) reflète ce même total de PE.',
      ]),
    ]));

    root.appendChild(el('div', { className: 'card', style: { marginBottom: '18px' } }, [
      el('h3', { style: { marginBottom: '10px' } }, ['✨ Comment les PE (Points d\'Expérience) sont calculés']),
      el('p', { className: 'small', style: { marginBottom: '12px', lineHeight: '1.6' } }, [
        'Chaque pronostic est noté sur plusieurs critères ', el('b', {}, ['indépendants']), ' qui s\'additionnent. ',
        'Seul les marqueurs d\'essai comportent un vrai risque : chaque nom coché rapporte +' + CONFIG.pe.perCorrectTryScorer + ' PE s\'il marque vraiment, mais ',
        el('b', {}, ['coûte ' + CONFIG.pe.perWrongTryScorer + ' PE']),
        ' s\'il ne marque pas. Cocher tout le monde "au cas où" est donc perdant en moyenne — vise une short-list de joueurs en qui tu as vraiment confiance. ',
        el('b', {}, ['Un vrai filet de sécurité']), ' : même une journée complètement ratée (beaucoup de mauvais marqueurs cochés, tout faux par ailleurs) ne fait jamais reculer ton PE cumulé — au pire, elle rapporte 0. Le PE ne peut baisser qu\'en valeur relative au classement, jamais en te retirant ce que tu as déjà.',
      ]),
      buildPeTable(),
    ]));

    root.appendChild(el('div', { className: 'card', style: { marginBottom: '18px' } }, [
      el('h3', { style: { marginBottom: '10px' } }, ['🙌 Bonus d\'assiduité']),
      el('p', { className: 'small', style: { marginBottom: '12px', lineHeight: '1.6' } }, [
        'Environ 4 fois par saison, l\'admin distribue un bonus de PE selon ta présence aux entraînements — une appréciation globale, pas un pointage précis. ',
        el('b', {}, ['Toujours additif']), ', jamais de pénalité : au pire, 0 PE ce coup-ci. Contrairement aux pronostics, ça ne demande aucun talent particulier — juste être là — donc c\'est volontairement généreux : c\'est ce qui garantit que tout le monde progresse, même sans être un crack du pronostic.',
      ]),
      buildPresenceTable(),
    ]));

    root.appendChild(el('div', { className: 'card', style: { marginBottom: '18px' } }, [
      el('h3', { style: { marginBottom: '10px' } }, ['🎉 Événements du club']),
      el('p', { className: 'small', style: { lineHeight: '1.6' } }, [
        'De temps en temps, la vie du club elle-même te rapporte des PE — une "Braderie de La Hulpe", un "Cadeau du président", ou n\'importe quel autre coup de folie du moment. Ce sont de ',
        el('b', {}, ['vrais PE']),
        ', exactement comme ceux gagnés sur un match ou à l\'entraînement — pas une monnaie à part. Parfois, l\'événement suggère un attribut où les mettre (la Braderie sur Troisième mi-temps, par exemple, parce que c\'est bien de ça qu\'il s\'agit) — mais ce n\'est qu\'une ',
        el('b', {}, ['indication']),
        ', jamais une obligation : libre à toi de les répartir où tu veux.',
      ]),
    ]));

    root.appendChild(el('div', { className: 'card', style: { marginBottom: '18px' } }, [
      el('h3', { style: { marginBottom: '10px' } }, ['🧮 Points d\'attributs']),
      el('p', { className: 'small', style: { lineHeight: '1.6' } }, [
        'Chaque manager démarre avec ' + CONFIG.season.startingPoints + ' points à répartir librement sur les attributs de ses joueurs ',
        '(chaque attribut part de ' + CONFIG.season.baseAttribute + ' et plafonne à ' + CONFIG.season.maxAttribute + '). ',
        'Tout PE gagné (pronostics + assiduité) s\'ajoute ', el('b', {}, ['directement']), ' à ce budget, PE par PE. ',
        'Il ne descend jamais sous ces ' + CONFIG.season.startingPoints + ' points de départ : une série de pronostics ratés peut faire passer ton PE sous 0 pour le classement, mais jamais entamer ton budget déjà acquis.',
      ]),
    ]));

    root.appendChild(el('div', { className: 'dash-grid' }, [
      el('div', { className: 'span-2 card' }, [
        el('h3', { style: { marginBottom: '10px' } }, ['💎 Paliers de rareté']),
        el('p', { className: 'small', style: { marginBottom: '10px' } }, ['Selon la note générale (moyenne des 10 attributs) d\'un joueur.']),
        buildRarityTable(),
      ]),
      el('div', { className: 'span-2 card' }, [
        el('h3', { style: { marginBottom: '10px' } }, ['🎖️ Paliers de prestige']),
        el('p', { className: 'small', style: { marginBottom: '10px' } }, ['Selon ton total de PE cumulés sur la saison.']),
        buildPrestigeTable(),
      ]),
    ]));
  }

  window.LH3.pages.rules = { render };
})();
