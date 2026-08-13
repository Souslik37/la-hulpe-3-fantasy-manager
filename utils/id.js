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

  window.LH3.utils.id = { uid };
})();
