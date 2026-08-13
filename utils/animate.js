/**
 * La Hulpe 3 Fantasy Manager — Micro-animations (discrètes)
 *
 * Compteurs animés pour les nombres clés du dashboard/stats. Les barres de
 * progression, elles, s'animent en CSS pur (voir .progress-fill,
 * .pc-attr-fill, .bar-chart-fill dans styles.css) — pas besoin de JS pour ça.
 */
(function () {
  window.LH3 = window.LH3 || {};
  window.LH3.utils = window.LH3.utils || {};

  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

  /** Anime le texte de `el` de 0 (ou `from`) jusqu'à `target` sur `duration` ms. */
  function animateCounter(el, target, opts) {
    opts = opts || {};
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.textContent = (opts.prefix || '') + target + (opts.suffix || '');
      return;
    }
    const duration = opts.duration || 800;
    const from = opts.from || 0;
    const startTime = performance.now();

    function tick(now) {
      const progress = Math.min(1, (now - startTime) / duration);
      const value = Math.round(from + (target - from) * easeOutCubic(progress));
      el.textContent = (opts.prefix || '') + value + (opts.suffix || '');
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  window.LH3.utils.animate = { animateCounter };
})();
