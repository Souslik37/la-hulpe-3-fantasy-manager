/**
 * La Hulpe 3 Fantasy Manager — Roster de base
 *
 * 31 joueurs du club. Tous démarrent avec les mêmes attributs de base (50).
 * Chaque manager appliquera ensuite ses propres boosts par-dessus cette base
 * (voir services/playerService.js) — les valeurs ici ne changent jamais.
 *
 * `avatarUrl: null` => un avatar temporaire (initiales + couleur) est généré
 * à la volée par utils/avatar.js. Le jour où de vraies illustrations cartoon
 * existent, il suffira de renseigner `avatarUrl` pour chaque joueur.
 */
(function () {
  window.LH3 = window.LH3 || {};
  window.LH3.data = window.LH3.data || {};

  const NAMES = [
    'Amaury', 'Ambroise', 'Anthony', 'Aurélien', 'Baptiste', 'Cédric', 'Dorian',
    'FloDa', 'François', 'Fred', 'Guillaume', 'Harold', 'Jonathan', 'Hubert',
    'Lancelot', 'Max Poelaert', 'Max Spork', 'Max Petit', 'Milan', 'Nath',
    'Nicolas', 'Theo', 'Thom', 'Tristan', 'Vini', 'Alex LC', 'Alex Claeys',
    'Lucien', 'Édouard', 'Paul', 'Sylvain', 'Adrien', 'Thib Van Ca',
  ];

  const COMBINING_MARKS = /[\u0300-\u036f]/g;

  function slugify(name) {
    return name
      .normalize('NFD').replace(COMBINING_MARKS, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  function baseAttributes() {
    const base = window.LH3.data.CONFIG.season.baseAttribute;
    const attrs = {};
    window.LH3.data.CONFIG.attributes.forEach((a) => {
      attrs[a.key] = base;
    });
    return attrs;
  }

  // Avatars cartoon reçus au fur et à mesure (voir assets/avatars/). Un
  // joueur absent de cette liste retombe automatiquement sur l'avatar
  // "initiales + couleur" généré par utils/avatar.js — aucune autre
  // modification n'est nécessaire quand une nouvelle image arrive, il
  // suffit d'ajouter une ligne ici avec le même id que le joueur.
  const AVATARS = {
    'alex-lc': 'assets/avatars/alex-lc.png',
    'anthony': 'assets/avatars/anthony.png',
    'baptiste': 'assets/avatars/baptiste.png',
    'cedric': 'assets/avatars/cedric.png',
    'dorian': 'assets/avatars/dorian.png',
    'edouard': 'assets/avatars/edouard.png',
    'floda': 'assets/avatars/floda.png',
    'francois': 'assets/avatars/francois.png',
    'harold': 'assets/avatars/harold.png',
    'jonathan': 'assets/avatars/jonathan.png',
    'lancelot': 'assets/avatars/lancelot.png',
    'lucien': 'assets/avatars/lucien.png',
    'max-poelaert': 'assets/avatars/max-poelaert.png',
    'max-spork': 'assets/avatars/max-spork.png',
    'milan': 'assets/avatars/milan.png',
    'nath': 'assets/avatars/nath.png',
    'sylvain': 'assets/avatars/sylvain.png',
    'thom': 'assets/avatars/thom.png',
    'alex-claeys': 'assets/avatars/alex-claeys.png',
    'ambroise': 'assets/avatars/ambroise.png',
    'fred': 'assets/avatars/fred.png',
    'guillaume': 'assets/avatars/guillaume.png',
    'hubert': 'assets/avatars/hubert.png',
    'nicolas': 'assets/avatars/nicolas.png',
    'theo': 'assets/avatars/theo.png',
    'tristan': 'assets/avatars/tristan.png',
    'vini': 'assets/avatars/vini.png',
    'adrien': 'assets/avatars/adrien.png',
    'thib-van-ca': 'assets/avatars/thib-van-ca.png',
    'amaury': 'assets/avatars/amaury.png',
    'max-petit': 'assets/avatars/max-petit.png',
    'paul': 'assets/avatars/paul.png',
    'aurelien': 'assets/avatars/aurelien.png',
  };

  const PLAYERS = NAMES.map((name) => {
    const id = slugify(name);
    return {
      id,
      name,
      avatarUrl: AVATARS[id] || null,
      baseAttributes: baseAttributes(),
    };
  });

  window.LH3.data.PLAYERS = PLAYERS;
})();
