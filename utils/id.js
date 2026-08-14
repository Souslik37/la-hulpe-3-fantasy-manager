/**
 * La Hulpe 3 Fantasy Manager — Génération d'identifiants
 */
(function () {
  window.LH3 = window.LH3 || {};
  window.LH3.utils = window.LH3.utils || {};

  function uid(prefix) {
    const rand = Math.random().toString(36).slice(2, 9);
    const time = Date.now().toString(36);
    return (prefix ? prefix + '-' : '') + time + rand;
  }

  /** Pour les colonnes Postgres de type `uuid` (ex: match_comments.id, journal.id) — uid() ne convient pas, son format n'est pas un UUID valide. */
  function uuid() {
    return crypto.randomUUID();
  }

  window.LH3.utils.id = { uid, uuid };
})();
